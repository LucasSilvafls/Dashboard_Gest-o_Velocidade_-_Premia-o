"""
Módulo de Roteamento de Endpoints da API CSG Telemetria.
"""

from backend.routers.auth import router as auth_router
from backend.routers.dashboard import router as dashboard_router
from backend.routers.upload import router as upload_router
from backend.routers.veiculos import router as veiculos_router

__all__ = ["auth_router", "dashboard_router", "upload_router", "veiculos_router"]
