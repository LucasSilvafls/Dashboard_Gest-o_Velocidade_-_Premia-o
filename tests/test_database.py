"""
Testes de integração para os modelos e conexão do banco de dados (database).
"""

from datetime import date, datetime
import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from database.connection import Base
from database.models import Alerta, LoteIngestao, Motorista, Veiculo
from database.repository import get_summary_stats


@pytest.fixture
def db_session() -> Session:
    """Cria banco SQLite em memória isolado para os testes."""
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(bind=engine)
    SessionTesting = sessionmaker(bind=engine)
    session = SessionTesting()
    yield session
    session.close()


class TestDatabaseModels:
    def test_create_veiculo_and_motorista(self, db_session: Session):
        veiculo = Veiculo(
            placa="UGY5G31",
            prefixo="Z8852D89A",
            categoria="CAVALO",
            uo="CASAGRANDE",
        )
        motorista = Motorista(
            nome="SENIVALDO COSTA RODRIGUES",
            cpf="96521430149",
        )
        lote = LoteIngestao(
            nome_arquivo="teste.xlsx",
            total_linhas_lidas=10,
            status="SUCESSO",
        )

        db_session.add_all([veiculo, motorista, lote])
        db_session.commit()

        assert veiculo.id is not None
        assert motorista.id is not None
        assert lote.id is not None

        # Cria alerta vinculado aos relacionamentos
        alerta = Alerta(
            hash_id="abc123hash",
            veiculo_id=veiculo.id,
            motorista_id=motorista.id,
            lote_id=lote.id,
            placa=veiculo.placa,
            categoria=veiculo.categoria,
            motorista=motorista.nome,
            tipo="EXCESSO_VELOCIDADE",
            nivel="ALTO",
            limiar=80.0,
            velocidade=102.0,
            delta=22.0,
            pct=27.5,
            data_evento=date(2026, 10, 25),
            hora_evento="10:12:29",
            is_velocidade=True,
        )
        db_session.add(alerta)
        db_session.commit()

        assert alerta.id is not None
        # Verifica relacionamentos reversos ORM
        assert len(veiculo.alertas) == 1
        assert len(motorista.alertas) == 1
        assert len(lote.alertas) == 1
        assert alerta.veiculo_rel.placa == "UGY5G31"
        assert alerta.motorista_rel.nome == "SENIVALDO COSTA RODRIGUES"

    def test_to_dashboard_dict(self, db_session: Session):
        alerta = Alerta(
            hash_id="hash_dashboard_test",
            placa="RVH9A52",
            categoria="CAÇAMBA",
            motorista="JOÃO SILVA",
            tipo="EXCESSO_VELOCIDADE_POR_VIA",
            nivel="MEDIO",
            limiar=60.0,
            velocidade=75.0,
            delta=15.0,
            pct=25.0,
            duracao_str="00:01:30",
            duracao_segundos=90,
            logradouro="MS-436",
            cidade="Camapuã",
            estado="MS",
            latitude=-19.5321,
            longitude=-53.2845,
            data_evento=date(2026, 10, 25),
            hora_evento="14:20:00",
            hora_inteira=14,
            is_velocidade=True,
        )
        db_session.add(alerta)
        db_session.commit()

        d = alerta.to_dashboard_dict()
        assert d["placa"] == "RVH9A52"
        assert d["categoria"] == "CAÇAMBA"
        assert d["velocidade"] == 75.0
        assert d["limiar_str"] == "60 km/h"
        assert d["valor_str"] == "75 km/h"
        assert d["delta_str"] == "+15 km/h"
        assert d["data"] == "25/10/2026"
        assert d["hour"] == 14

    def test_summary_stats(self, db_session: Session):
        v = Veiculo(placa="TEST001", categoria="LEVE")
        m = Motorista(nome="CONDUTOR TESTE")
        a1 = Alerta(
            hash_id="h1",
            placa="TEST001",
            categoria="LEVE",
            motorista="CONDUTOR TESTE",
            tipo="EXCESSO_VELOCIDADE",
            nivel="ALTO",
            is_velocidade=True,
            data_evento=date(2026, 10, 20),
        )
        a2 = Alerta(
            hash_id="h2",
            placa="TEST001",
            categoria="LEVE",
            motorista="CONDUTOR TESTE",
            tipo="DISTRACAO_MOTORISTA",
            nivel="BAIXO",
            is_velocidade=False,
            data_evento=date(2026, 10, 22),
        )
        db_session.add_all([v, m, a1, a2])
        db_session.commit()

        stats = get_summary_stats(db_session)
        assert stats["total_alertas"] == 2
        assert stats["total_velocidade"] == 1
        assert stats["total_veiculos"] == 1
        assert stats["total_motoristas"] == 1
        assert stats["distribuicao_telemetria"]["EXCESSO_VELOCIDADE"] == 1
        assert stats["distribuicao_telemetria"]["DISTRACAO_MOTORISTA"] == 1
