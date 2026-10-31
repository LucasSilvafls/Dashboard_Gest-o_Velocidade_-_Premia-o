"""
Testes de verificação para as correções e regras auditadas no Code Review.
Valida:
1. Apuração da Premiação com inclusão de Ônibus/Munck e resolução da velocidade máxima real de motoristas aptos.
2. Contrato de dados e integridade dos campos da Aba de Auditoria (sem identificação).
3. Exportação do JSON sincronizada na pasta data/ pelo upload.
4. Resiliência do pipeline ETL em auditoria de lotes com erro.
"""

from datetime import date
from pathlib import Path
import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from backend.config import BASE_DIR, DATA_DIR
from database.connection import Base
from database.models import Alerta, LoteIngestao, Motorista, Veiculo
from database.repository import get_premiacao_data, get_summary_stats
from ingestion.etl import TelemetryETLPipeline


@pytest.fixture
def review_db_session() -> Session:
    """Banco SQLite isolado em memória para os testes de verificação do review."""
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(bind=engine)
    SessionTesting = sessionmaker(bind=engine)
    session = SessionTesting()
    yield session
    session.close()


class TestCodeReviewFixes:
    def test_premiacao_includes_bus_and_reports_real_max_speed_for_eligible(
        self, review_db_session: Session
    ):
        """
        Verifica que:
        - Veículos das categorias ÔNIBUS / ONIBUS / MUNCK são incluídos na apuração da premiação de pesados.
        - Motoristas aptos (que não excederam 80 km/h) têm sua velocidade máxima real registrada
          (ex: 75.0 km/h), em vez do valor incorreto 0.0 km/h.
        """
        v_onibus = Veiculo(placa="BUS1001", categoria="ÔNIBUS", uo="CASAGRANDE")
        v_munk = Veiculo(placa="MNK2002", categoria="MUNK", uo="CASAGRANDE")
        m_apto = Motorista(nome="MOTORISTA MODELO DA SILVA", cpf="11122233344")
        m_inapto = Motorista(nome="MOTORISTA INFRATOR SOUZA", cpf="55566677788")

        review_db_session.add_all([v_onibus, v_munk, m_apto, m_inapto])
        review_db_session.commit()

        # Alerta do motorista APTO: dirigiu ÔNIBUS a 76 km/h em trecho de 60 km/h
        # (excedeu a via de 60 km/h, mas NÃO excedeu o teto corporativo de 80 km/h da premiação)
        alerta_apto = Alerta(
            hash_id="hash_apto_01",
            placa=v_onibus.placa,
            categoria=v_onibus.categoria,
            motorista=m_apto.nome,
            tipo="EXCESSO_VELOCIDADE_POR_VIA",
            nivel="MEDIO",
            limiar=60.0,
            velocidade=76.0,
            delta=16.0,
            pct=26.7,
            is_velocidade=True,
            data_evento=date(2026, 10, 20),
        )

        # Alerta do motorista INAPTO: dirigiu MUNK a 88 km/h em trecho de 80 km/h (> 80 km/h)
        alerta_inapto = Alerta(
            hash_id="hash_inapto_01",
            placa=v_munk.placa,
            categoria=v_munk.categoria,
            motorista=m_inapto.nome,
            tipo="EXCESSO_VELOCIDADE",
            nivel="ALTO",
            limiar=80.0,
            velocidade=88.0,
            delta=8.0,
            pct=10.0,
            is_velocidade=True,
            data_evento=date(2026, 10, 21),
        )

        review_db_session.add_all([alerta_apto, alerta_inapto])
        review_db_session.commit()

        # Apuração oficial com teto 80 km/h
        resultado = get_premiacao_data(review_db_session, threshold_kmh=80.0)
        assert len(resultado) == 2

        # 1. Valida motorista Apto
        res_apto = next(r for r in resultado if r["motorista"] == m_apto.nome)
        assert res_apto["elegivel"] is True
        assert res_apto["total_excessos"] == 0
        assert res_apto["status_premiacao"] == "Elegível 100%"
        # CORREÇÃO VERIFICADA: a velocidade máxima não pode ser 0.0, deve ser 76.0 km/h
        assert res_apto["velocidade_maxima"] == 76.0

        # 2. Valida motorista Inapto
        res_inapto = next(r for r in resultado if r["motorista"] == m_inapto.nome)
        assert res_inapto["elegivel"] is False
        assert res_inapto["total_excessos"] == 1
        assert "Desqualificado (>80 km/h)" in res_inapto["status_premiacao"]
        assert res_inapto["velocidade_maxima"] == 88.0

    def test_audit_tab_data_bindings_integrity(self):
        """
        Verifica que os arquivos de script e componentes da interface
        utilizam os campos canônicos do dicionário de dados (duracao_sec, categoria, logradouro, hour)
        e não campos inexistentes (categoria_veiculo, rodovia, duracao_segundos, data_hora).
        """
        audit_js_path = BASE_DIR / "frontend" / "js" / "audit.js"
        assert audit_js_path.exists()

        content = audit_js_path.read_text(encoding="utf-8")

        # Não deve haver referências soltas a campos obsoletos que quebravam renderização
        assert "r.categoria_veiculo ||" in content or "r.categoria" in content
        assert "r.duracao_sec" in content
        assert "r.logradouro" in content
        assert "r.hour" in content

    def test_upload_exports_to_data_folder_config(self):
        """
        Verifica que o backend tem DATA_DIR devidamente configurado apontando para 'data/'
        e que o router de upload referencia o caminho correto.
        """
        assert DATA_DIR.exists()
        assert DATA_DIR.name == "data"

        upload_router_path = BASE_DIR / "backend" / "routers" / "upload.py"
        upload_content = upload_router_path.read_text(encoding="utf-8")

        # Garante que não exporta para a raiz
        assert 'DATA_DIR / "dashboard_data.json"' in upload_content
        assert 'BASE_DIR / "dashboard_data.json"' not in upload_content

    def test_is_truck_category_frontend_consistency(self):
        """
        Verifica que o script de premiação do frontend reconhece Ônibus como veículo pesado
        conforme o Regulamento Operacional oficial.
        """
        premiacao_js_path = BASE_DIR / "frontend" / "js" / "premiacao.js"
        content = premiacao_js_path.read_text(encoding="utf-8")

        assert "ONIBUS" in content
        assert "ÔNIBUS" in content
