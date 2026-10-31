"""
Router para servir dados do Dashboard e Telemetria diretamente do Banco de Dados.
Remove completamente qualquer necessidade de leitura de arquivos físicos locais.
"""

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.dependencies import get_db_session, require_viewer_or_admin
from backend.schemas.dashboard import (
    DashboardDataResponse,
    FilterOptionsResponse,
    MotoristaRankingItem,
    PaginatedAlertsResponse,
    PremiacaoItem,
    RankingsResponse,
    SummaryResponse,
    VeiculoRankingItem,
)
from database.models import Usuario
from database.repository import (
    get_dashboard_data,
    get_filter_options,
    get_paginated_alerts,
    get_premiacao_data,
    get_rankings,
    get_summary_stats,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard & Telemetria"])


@router.get(
    "/data",
    response_model=DashboardDataResponse,
    summary="Dataset consolidado completo do dashboard (Direto do Banco)",
    description=(
        "Recupera o dataset estruturado (meta e records) diretamente da base de dados relacional. "
        "Substitui a leitura estática do arquivo dashboard_data.json, garantindo sincronização em tempo real."
    ),
)
def get_consolidated_dashboard_data(
    _user: Usuario = Depends(require_viewer_or_admin),
    session: Session = Depends(get_db_session),
) -> DashboardDataResponse:
    """Retorna dados consolidados para alimentar os componentes e gráficos do dashboard."""
    payload = get_dashboard_data(session)
    return DashboardDataResponse(**payload)


@router.get(
    "/summary",
    response_model=SummaryResponse,
    summary="Resumo de indicadores executivos (KPIs)",
    description="Retorna métricas consolidadas: total de alertas, excessos de velocidade, frota ativa, condutores e período.",
)
def get_dashboard_summary(
    _user: Usuario = Depends(require_viewer_or_admin),
    session: Session = Depends(get_db_session),
) -> SummaryResponse:
    """Retorna indicadores chave de telemetria."""
    stats = get_summary_stats(session)
    return SummaryResponse(**stats)


@router.get(
    "/filters",
    response_model=FilterOptionsResponse,
    summary="Opções dinâmicas para os filtros da interface",
    description="Retorna listas atualizadas de categorias, placas por categoria, motoristas e datas para os menus suspensos.",
)
def get_dashboard_filters(
    _user: Usuario = Depends(require_viewer_or_admin),
    session: Session = Depends(get_db_session),
) -> FilterOptionsResponse:
    """Retorna opções dinâmicas para filtros em cascata."""
    options = get_filter_options(session)
    return FilterOptionsResponse(**options)


@router.get(
    "/alerts",
    response_model=PaginatedAlertsResponse,
    summary="Consulta analítica paginada de alertas",
    description="Permite filtrar e paginar alertas por placa, categoria, condutor, tipo, nível de severidade e faixa de datas.",
)
def list_alerts(
    page: int = Query(1, ge=1, description="Número da página"),
    page_size: int = Query(50, ge=1, le=500, description="Registros por página"),
    placa: Optional[str] = Query(None, description="Filtro por placa veicular"),
    categoria: Optional[str] = Query(None, description="Filtro por categoria"),
    motorista: Optional[str] = Query(None, description="Filtro por condutor"),
    tipo: Optional[str] = Query(None, description="Tipo de alerta"),
    nivel: Optional[str] = Query(None, description="Nível de risco (BAIXO, MEDIO, ALTO)"),
    data_inicio: Optional[date] = Query(None, description="Data inicial (AAAA-MM-DD)"),
    data_fim: Optional[date] = Query(None, description="Data final (AAAA-MM-DD)"),
    min_velocidade: Optional[float] = Query(None, description="Velocidade mínima registrada"),
    is_velocidade: Optional[bool] = Query(True, description="Filtrar apenas alertas de excesso de velocidade"),
    _user: Usuario = Depends(require_viewer_or_admin),
    session: Session = Depends(get_db_session),
) -> PaginatedAlertsResponse:
    """Busca paginada de alertas com filtros combinados."""
    result = get_paginated_alerts(
        session=session,
        page=page,
        page_size=page_size,
        placa=placa,
        categoria=categoria,
        motorista=motorista,
        tipo=tipo,
        nivel=nivel,
        data_inicio=data_inicio,
        data_fim=data_fim,
        min_velocidade=min_velocidade,
        is_velocidade=is_velocidade,
    )
    return PaginatedAlertsResponse(**result)


@router.get(
    "/rankings",
    response_model=RankingsResponse,
    summary="Rankings de reincidência de motoristas e veículos",
    description="Top condutores e veículos com mais infrações de velocidade, picos e deltas médios.",
)
def get_fleet_rankings(
    limit: int = Query(10, ge=1, le=50, description="Quantidade de registros nos rankings"),
    _user: Usuario = Depends(require_viewer_or_admin),
    session: Session = Depends(get_db_session),
) -> RankingsResponse:
    """Retorna rankings dos maiores ofensores da frota."""
    rankings = get_rankings(session, limit=limit)
    return RankingsResponse(
        top_motoristas=[MotoristaRankingItem(**m) for m in rankings["top_motoristas"]],
        top_veiculos=[VeiculoRankingItem(**v) for v in rankings["top_veiculos"]],
    )


@router.get(
    "/premiacao",
    response_model=List[PremiacaoItem],
    summary="Apuração do Programa de Premiação (Motorista x Caminhão)",
    description="Avalia a conformidade de condutores em veículos pesados baseando-se no teto regulamentar de 80 km/h.",
)
def get_premiacao_report(
    limite_kmh: float = Query(80.0, ge=50.0, le=120.0, description="Teto regulamentar da política"),
    _user: Usuario = Depends(require_viewer_or_admin),
    session: Session = Depends(get_db_session),
) -> List[PremiacaoItem]:
    """Retorna lista de elegibilidade e conformidade da premiação."""
    data = get_premiacao_data(session, threshold_kmh=limite_kmh)
    return [PremiacaoItem(**item) for item in data]
