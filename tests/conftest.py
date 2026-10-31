"""
Configuração global de fixtures do pytest para os testes da API e Backend CSG.
"""

import os
os.environ["TESTING"] = "true"
from datetime import date, datetime
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from backend.dependencies import get_db_session
from backend.main import app
from backend.security import create_access_token
from database.connection import Base
from database.models import Alerta, LoteIngestao, Motorista, Usuario, UserRole, Veiculo
from database.repository import seed_default_users


@pytest.fixture(scope="session")
def engine():
    """Engine SQLite em memória compartilhado via StaticPool para testes."""
    eng = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=eng)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=eng)
    with SessionLocal() as s:
        seed_default_users(s)
        s.commit()
    return eng


@pytest.fixture(scope="function")
def db_session(engine):
    """Sessão transacional limpa para cada caso de teste."""
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = SessionLocal()

    # Cria tabelas se necessário
    Base.metadata.create_all(bind=engine)

    # Popula veículos de teste
    if not session.query(Veiculo).first():
        v1 = Veiculo(placa="UGY5G31", prefixo="Z8852D", categoria="CAVALO", uo="CASAGRANDE")
        v2 = Veiculo(placa="RVH9A52", prefixo="P1002A", categoria="CAÇAMBA", uo="CASAGRANDE")
        v3 = Veiculo(placa="QAA1234", prefixo="L3001C", categoria="LEVES", uo="CASAGRANDE")
        session.add_all([v1, v2, v3])

        m1 = Motorista(nome="SENIVALDO COSTA RODRIGUES", cpf="96521430149")
        m2 = Motorista(nome="JOÃO CARLOS SILVA", cpf="12345678900")
        session.add_all([m1, m2])

        lote = LoteIngestao(
            nome_arquivo="amostra_teste.xlsx",
            total_linhas_lidas=2,
            total_alertas_inseridos=2,
            total_alertas_velocidade=2,
            status="SUCESSO",
        )
        session.add(lote)
        session.commit()

        # Alertas de teste
        a1 = Alerta(
            hash_id="hash_test_1",
            placa="UGY5G31",
            categoria="CAVALO",
            motorista="SENIVALDO COSTA RODRIGUES",
            tipo="EXCESSO_VELOCIDADE",
            nivel="ALTO",
            limiar=80.0,
            velocidade=102.0,
            delta=22.0,
            pct=27.5,
            duracao_str="00:03:15",
            duracao_segundos=195,
            logradouro="MS-436",
            cidade="Camapuã",
            estado="MS",
            data_evento=date(2026, 10, 25),
            hora_evento="14:30:00",
            hora_inteira=14,
            is_velocidade=True,
            veiculo_id=v1.id,
            motorista_id=m1.id,
            lote_id=lote.id,
        )
        a2 = Alerta(
            hash_id="hash_test_2",
            placa="RVH9A52",
            categoria="CAÇAMBA",
            motorista="JOÃO CARLOS SILVA",
            tipo="EXCESSO_VELOCIDADE_POR_VIA",
            nivel="MEDIO",
            limiar=60.0,
            velocidade=78.0,
            delta=18.0,
            pct=30.0,
            duracao_str="00:01:10",
            duracao_segundos=70,
            logradouro="MS-112",
            cidade="Cassilândia",
            estado="MS",
            data_evento=date(2026, 10, 24),
            hora_evento="09:15:00",
            hora_inteira=9,
            is_velocidade=True,
            veiculo_id=v2.id,
            motorista_id=m2.id,
            lote_id=lote.id,
        )
        session.add_all([a1, a2])
        session.commit()

    yield session
    session.close()


@pytest.fixture(scope="function")
def client(engine, db_session):
    """TestClient configurado com override thread-safe da sessão de banco de dados."""
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    def override_get_db():
        session = SessionLocal()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    app.dependency_overrides[get_db_session] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def admin_token():
    """Gera token JWT válido com perfil Admin."""
    return create_access_token(data={"sub": "admin", "role": UserRole.ADMIN.value})


@pytest.fixture
def viewer_token():
    """Gera token JWT válido com perfil Viewer."""
    return create_access_token(data={"sub": "viewer", "role": UserRole.VIEWER.value})


@pytest.fixture
def admin_headers(admin_token):
    """Cabeçalhos HTTP com Bearer Token de Admin."""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def viewer_headers(viewer_token):
    """Cabeçalhos HTTP com Bearer Token de Viewer."""
    return {"Authorization": f"Bearer {viewer_token}"}
