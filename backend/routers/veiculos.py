"""
Router para consulta cadastral de Veículos e Condutores da frota CSG.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.dependencies import get_db_session, require_viewer_or_admin
from database.models import Motorista, Usuario, Veiculo

router = APIRouter(tags=["Frotas & Motoristas"])


@router.get(
    "/veiculos",
    summary="Listar veículos da frota",
    description="Retorna os veículos cadastrados na base de telemetria, agrupados por categoria e UO.",
)
def list_vehicles(
    categoria: Optional[str] = Query(None, description="Filtrar por categoria específica"),
    _user: Usuario = Depends(require_viewer_or_admin),
    session: Session = Depends(get_db_session),
) -> List[Dict[str, Any]]:
    """Consulta veículos da frota."""
    query = select(Veiculo)
    if categoria:
        query = query.where(Veiculo.categoria.ilike(f"%{categoria.strip()}%"))
    query = query.order_by(Veiculo.categoria, Veiculo.placa)

    veiculos = session.scalars(query).all()
    return [v.to_dict() for v in veiculos]


@router.get(
    "/motoristas",
    summary="Listar condutores identificados",
    description="Retorna os motoristas com cadastro ou alertas registrados via iButton/crachá eletrônico.",
)
def list_drivers(
    busca: Optional[str] = Query(None, description="Busca por parte do nome"),
    _user: Usuario = Depends(require_viewer_or_admin),
    session: Session = Depends(get_db_session),
) -> List[Dict[str, Any]]:
    """Consulta motoristas da frota."""
    query = select(Motorista)
    if busca:
        query = query.where(Motorista.nome.ilike(f"%{busca.strip()}%"))
    query = query.order_by(Motorista.nome)

    motoristas = session.scalars(query).all()
    return [m.to_dict() for m in motoristas]
