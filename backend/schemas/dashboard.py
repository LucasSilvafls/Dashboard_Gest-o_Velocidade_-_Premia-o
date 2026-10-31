"""
Schemas Pydantic para os endpoints do Dashboard de Velocidade e Telemetria.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class AlertDetail(BaseModel):
    """Estrutura detalhada de um alerta de velocidade."""
    id: int
    placa: str
    prefixo: Optional[str] = "-"
    categoria: str
    motorista: str
    cpf: Optional[str] = "-"
    uo: str = "CASAGRANDE"
    tipo: str
    nivel: str
    limiar: Optional[float] = None
    limiar_str: Optional[str] = "-"
    velocidade: Optional[float] = None
    valor: Optional[float] = None
    valor_str: Optional[str] = "-"
    delta: Optional[float] = 0.0
    delta_str: Optional[str] = "-"
    pct: Optional[float] = 0.0
    duracao_str: Optional[str] = "00:00:00"
    duracao_sec: Optional[int] = 0
    logradouro: Optional[str] = "Não Informado"
    cidade: Optional[str] = "Não Informada"
    estado: Optional[str] = "MS"
    lat: Optional[float] = None
    lng: Optional[float] = None
    data: Optional[str] = ""
    hora: Optional[str] = "00:00:00"
    hour: Optional[int] = 0
    status: Optional[str] = "NOVO"


class SummaryResponse(BaseModel):
    """Métricas executivas consolidadas da frota."""
    total_alertas: int = Field(..., description="Total de alertas brutos na base relacional")
    total_velocidade: int = Field(..., description="Total de alertas de excesso de velocidade")
    total_veiculos: int = Field(..., description="Total de veículos com ocorrências")
    total_motoristas: int = Field(..., description="Total de condutores identificados")
    periodo: str = Field(..., description="Período de apuração (ex: 26/09/2026 a 25/10/2026)")
    distribuicao_telemetria: Dict[str, int] = Field(
        ..., description="Distribuição de contagem por tipo de evento de telemetria"
    )


class FilterOptionsResponse(BaseModel):
    """Listas dinâmicas para preenchimento dos filtros operacionais."""
    categorias: List[str]
    category_plates: Dict[str, List[str]]
    placas: List[str]
    motoristas: List[str]
    tipos: List[str]
    datas: List[str]


class DashboardMeta(BaseModel):
    """Metadados estruturados do dataset consolidado."""
    app_name: str = "Controle_Velocidade_CSG"
    total_file_alerts: int
    total_speed_alerts: int
    period: str
    uo: str = "CASAGRANDE"
    telemetry_distribution: Dict[str, int]
    categorias: List[str]
    category_plates: Dict[str, List[str]]
    placas: List[str]
    motoristas: List[str]
    tipos: List[str]
    logradouros: List[str]
    datas: List[str]


class DashboardDataResponse(BaseModel):
    """Dataset completo consolidado diretamente do banco para renderização da interface."""
    meta: DashboardMeta
    records: List[AlertDetail]


class PaginatedAlertsResponse(BaseModel):
    """Resultado paginado de consulta detalhada de alertas."""
    total: int
    page: int
    page_size: int
    total_pages: int
    items: List[AlertDetail]


class MotoristaRankingItem(BaseModel):
    """Item do ranking de reincidência de condutores."""
    motorista: str
    total_alertas: int
    pico_velocidade: float
    delta_medio: float
    duracao_total_sec: int


class VeiculoRankingItem(BaseModel):
    """Item do ranking de veículos com mais excessos."""
    placa: str
    categoria: str
    total_alertas: int
    pico_velocidade: float
    delta_medio: float


class RankingsResponse(BaseModel):
    """Rankings combinados de condutores e veículos."""
    top_motoristas: List[MotoristaRankingItem]
    top_veiculos: List[VeiculoRankingItem]


class PremiacaoItem(BaseModel):
    """Status de conformidade do motorista no Programa de Premiação 80 km/h."""
    motorista: str
    total_excessos: int
    velocidade_maxima: float
    delta_medio: float
    elegivel: bool
    status_premiacao: str
