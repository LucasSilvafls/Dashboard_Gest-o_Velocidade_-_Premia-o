"""
Módulo de conexão com o Banco de Dados Relacional.
Suporta SQLite (padrão local e testes) e PostgreSQL (produção).
Compatível com SQLAlchemy 2.0+.
"""

import os
from contextlib import contextmanager
from typing import Generator, Optional, Union

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

# URL padrão para desenvolvimento local: SQLite em arquivo
DEFAULT_DB_URL = os.getenv("DATABASE_URL", "sqlite:///telemetria.db")

# Base declarativa compartilhada
Base = declarative_base()


def get_engine(db_url: Optional[str] = None) -> Engine:
    """
    Cria e configura o Engine do SQLAlchemy.
    Configura pragmas de integridade referencial e performance para SQLite.
    """
    url = db_url or os.getenv("DATABASE_URL", DEFAULT_DB_URL)

    # Configuração específica para SQLite
    if url.startswith("sqlite"):
        engine = create_engine(
            url,
            connect_args={"check_same_thread": False},
            echo=os.getenv("SQL_ECHO", "false").lower() in ("true", "1", "yes"),
        )

        # Ativa suporte a chaves estrangeiras no SQLite
        @event.listens_for(engine, "connect")
        def set_sqlite_pragma(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            try:
                cursor.execute("PRAGMA foreign_keys=ON;")
                cursor.execute("PRAGMA synchronous=NORMAL;")
            finally:
                cursor.close()

        return engine

    # Configuração para PostgreSQL ou outros dialetos relacionais
    return create_engine(
        url,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        echo=os.getenv("SQL_ECHO", "false").lower() in ("true", "1", "yes"),
    )


def get_session_factory(engine: Optional[Engine] = None) -> sessionmaker:
    """Retorna uma fábrica de sessões (sessionmaker) configurada."""
    eng = engine or get_engine()
    return sessionmaker(autocommit=False, autoflush=False, bind=eng)


@contextmanager
def get_db(db_url: Optional[str] = None) -> Generator[Session, None, None]:
    """
    Gerenciador de contexto para sessões do banco de dados.
    Garante rollback em caso de exceção e fechamento da conexão.
    """
    engine = get_engine(db_url)
    session_factory = get_session_factory(engine)
    session: Session = session_factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_db(
    engine_or_url: Optional[Union[Engine, str]] = None, drop_all: bool = False
) -> None:
    """
    Inicializa as tabelas no banco de dados.
    Aceita uma instância de Engine, string de conexão ou None (usa default).
    Se drop_all=True, remove todas as tabelas antes de recriá-las.
    """
    if isinstance(engine_or_url, str):
        eng = get_engine(engine_or_url)
    elif engine_or_url is not None:
        eng = engine_or_url
    else:
        eng = get_engine()

    if drop_all:
        Base.metadata.drop_all(bind=eng)
    Base.metadata.create_all(bind=eng)
