"""
Pacote do Banco de Dados Relacional da Telemetria CSG.
"""

from database.connection import Base, get_db, get_engine, get_session_factory, init_db
from database.models import Alerta, LoteIngestao, Motorista, Veiculo
from database.repository import export_dashboard_json, get_summary_stats

__all__ = [
    "Base",
    "get_engine",
    "get_session_factory",
    "get_db",
    "init_db",
    "Veiculo",
    "Motorista",
    "Alerta",
    "LoteIngestao",
    "get_summary_stats",
    "export_dashboard_json",
]
