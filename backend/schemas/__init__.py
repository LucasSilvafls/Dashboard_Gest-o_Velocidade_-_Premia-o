"""
Schemas Pydantic para validação e serialização da API.
"""

from backend.schemas.auth import (
    LoginRequest,
    Token,
    TokenPayload,
    UserCreate,
    UserResponse,
)
from backend.schemas.dashboard import (
    AlertDetail,
    DashboardDataResponse,
    FilterOptionsResponse,
    MotoristaRankingItem,
    PaginatedAlertsResponse,
    PremiacaoItem,
    SummaryResponse,
    VeiculoRankingItem,
)
from backend.schemas.ingestion import (
    LoteResponse,
    UploadResultResponse,
)

__all__ = [
    "LoginRequest",
    "Token",
    "TokenPayload",
    "UserCreate",
    "UserResponse",
    "AlertDetail",
    "DashboardDataResponse",
    "FilterOptionsResponse",
    "MotoristaRankingItem",
    "PaginatedAlertsResponse",
    "PremiacaoItem",
    "SummaryResponse",
    "VeiculoRankingItem",
    "LoteResponse",
    "UploadResultResponse",
]
