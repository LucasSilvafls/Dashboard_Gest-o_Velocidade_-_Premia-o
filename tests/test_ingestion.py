"""
Testes de integração de ponta a ponta para o Pipeline ETL (ingestão de planilhas Excel para o Banco de Dados).
"""

import json
from pathlib import Path
import openpyxl
import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from database.connection import Base, get_db, init_db
from database.models import Alerta, LoteIngestao, Motorista, Veiculo
from database.repository import export_dashboard_json
from ingestion.etl import TelemetryETLPipeline


@pytest.fixture
def test_db_path(tmp_path: Path) -> Path:
    """Retorna caminho de um banco de dados temporário SQLite."""
    db_file = tmp_path / "test_telemetria.db"
    return db_file


@pytest.fixture
def sample_telemetry_excel(tmp_path: Path) -> Path:
    """Cria uma planilha Excel real (.xlsx) com múltiplos cenários operacionais."""
    excel_path = tmp_path / "telemetria_amostra.xlsx"
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Dados_Telemetria"

    headers = [
        "PLACA", "CATEGORIA", "PREFIXO", "MOTORISTA", "CPF", "UO",
        "TIPO", "NIVEL", "LIMIAR", "EXCESSO", "DURACAO", "LOGRADOURO",
        "CIDADE", "ESTADO", "LATITUDE", "LONGITUDE", "DATA", "HORA", "STATUS"
    ]
    ws.append(headers)

    # 1. Alerta de velocidade Cavalo Mecânico
    ws.append([
        "UGY5G31", "CAVALO", "Z8852D89A", "SENIVALDO COSTA RODRIGUES", "96521430149", "CASAGRANDE",
        "EXCESSO_VELOCIDADE", "ALTO", "80 km/h", "102 km/h", "00:02:15", "MS-112",
        "Inocência", "Mato Grosso do Sul", -21.503626, -50.031464, "25/10/2026", "10:12:29", "NOVO"
    ])

    # 2. Alerta de velocidade Caçamba
    ws.append([
        "RVH9A52", "CAÇAMBA", "Z11223344", "JOÃO DA SILVA FRANÇA", "11122233344", "CASAGRANDE",
        "EXCESSO_VELOCIDADE_POR_VIA", "MEDIO", "60 km/h", "75 km/h", "00:01:45", "MS-436",
        "Camapuã", "Mato Grosso do Sul", -19.532100, -53.284500, "25/10/2026", "11:30:00", "NOVO"
    ])

    # 3. Alerta de velocidade Veículo Leve
    ws.append([
        "RWG3A16", "LEVE", "Z99887766", "PAULO HENRIQUE", "55566677788", "CASAGRANDE",
        "EXCESSO_VELOCIDADE", "BAIXO", "90 km/h", "98 km/h", "00:00:30", "MS-320",
        "Paraíso das Águas", "Mato Grosso do Sul", -19.012345, -53.012345, "25/10/2026", "14:15:00", "NOVO"
    ])

    # 4. Alerta de fadiga/videotelemetria (não é velocidade)
    ws.append([
        "UGY5G31", "CAVALO", "Z8852D89A", "SENIVALDO COSTA RODRIGUES", "96521430149", "CASAGRANDE",
        "DISTRACAO_MOTORISTA", "MEDIO", "-", "-", "00:00:05", "MS-112",
        "Inocência", "Mato Grosso do Sul", -21.504000, -50.032000, "25/10/2026", "10:15:00", "NOVO"
    ])

    # 5. Linha vazia acidental (deve ser ignorada sem falha)
    ws.append([None] * len(headers))

    # 6. Alerta com condutor não identificado
    ws.append([
        "RWG4D55", "COMBOIO", "Z55443322", "-", "-", "CASAGRANDE",
        "EXCESSO_VELOCIDADE", "ALTO", "80 km/h", "105 km/h", "00:03:00", "MS-112",
        "Cassilândia", "Mato Grosso do Sul", -19.123456, -51.654321, "25/10/2026", "16:00:00", "NOVO"
    ])

    wb.save(excel_path)
    return excel_path


class TestETLIntegration:
    def test_full_pipeline_ingestion(self, test_db_path: Path, sample_telemetry_excel: Path):
        db_url = f"sqlite:///{test_db_path}"
        pipeline = TelemetryETLPipeline(db_url=db_url)

        # 1. Executa primeira ingestão
        res1 = pipeline.ingest_file(sample_telemetry_excel, mode="upsert")

        assert res1.status == "SUCESSO"
        assert res1.total_lidas == 5  # 5 linhas com placa válida
        assert res1.inseridos == 5
        assert res1.atualizados == 0
        assert res1.total_velocidade == 4  # 4 de velocidade e 1 distração
        assert res1.tempo_segundos > 0

        # Verifica dados no banco relacional
        with get_db(db_url) as session:
            veiculos = session.scalars(select(Veiculo)).all()
            motoristas = session.scalars(select(Motorista)).all()
            alertas = session.scalars(select(Alerta)).all()
            lotes = session.scalars(select(LoteIngestao)).all()

            assert len(veiculos) == 4  # UGY5G31, RVH9A52, RWG3A16, RWG4D55
            assert len(motoristas) >= 4  # Senivaldo, João, Paulo, Sem Identificação
            assert len(alertas) == 5
            assert len(lotes) == 1

            # Valida condutor não identificado
            comboio_alerta = session.scalars(
                select(Alerta).where(Alerta.placa == "RWG4D55")
            ).first()
            assert comboio_alerta.motorista == "Sem Identificação"

            # Valida relacionamento Veículo -> Alertas
            ugy = session.scalars(select(Veiculo).where(Veiculo.placa == "UGY5G31")).first()
            assert len(ugy.alertas) == 2  # 1 velocidade + 1 distração

    def test_upsert_idempotency(self, test_db_path: Path, sample_telemetry_excel: Path):
        """
        Garante que rodar o processo 2 vezes com o mesmo arquivo não gera duplicatas no banco de dados.
        """
        db_url = f"sqlite:///{test_db_path}"
        pipeline = TelemetryETLPipeline(db_url=db_url)

        # Primeira execução: insere
        res1 = pipeline.ingest_file(sample_telemetry_excel, mode="upsert")
        assert res1.inseridos == 5

        # Segunda execução: deve atualizar os 5 sem duplicar
        res2 = pipeline.ingest_file(sample_telemetry_excel, mode="upsert")
        assert res2.inseridos == 0
        assert res2.atualizados == 5

        with get_db(db_url) as session:
            total_alertas = session.query(Alerta).count()
            # Permanece exatamente 5, provando que o upsert é idempotente
            assert total_alertas == 5

    def test_export_to_dashboard_json(self, test_db_path: Path, sample_telemetry_excel: Path, tmp_path: Path):
        """
        Testa a geração do arquivo JSON para consumo pelo dashboard HTML.
        """
        db_url = f"sqlite:///{test_db_path}"
        pipeline = TelemetryETLPipeline(db_url=db_url)
        pipeline.ingest_file(sample_telemetry_excel, mode="upsert")

        json_out = tmp_path / "dashboard_export.json"
        with get_db(db_url) as session:
            payload = export_dashboard_json(session, output_path=str(json_out))

        assert json_out.exists()
        assert "meta" in payload
        assert "records" in payload
        # No payload estruturado do dashboard, apenas registros de velocidade entram no array records
        assert len(payload["records"]) == 4
        assert payload["meta"]["total_speed_alerts"] == 4
        assert "CAVALO" in payload["meta"]["categorias"]
        assert "CAÇAMBA" in payload["meta"]["categorias"]
        assert len(payload["meta"]["placas"]) == 4
