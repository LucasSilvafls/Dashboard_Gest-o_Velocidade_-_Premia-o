"""
Schemas Pydantic para Ingestão de Planilhas e Auditoria de Lotes.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class UploadResultResponse(BaseModel):
    """Resposta estruturada após o processamento da planilha de telemetria."""
    arquivo: str
    lote_id: int
    modo: str
    total_lidas: int = Field(..., description="Total de linhas brutas processadas")
    inseridos: int = Field(..., description="Novos registros inseridos no banco")
    atualizados: int = Field(..., description="Registros já existentes atualizados via upsert")
    total_velocidade: int = Field(..., description="Registros categorizados como excesso de velocidade")
    tempo_segundos: float = Field(..., description="Duração do processamento em segundos")
    status: str = Field("SUCESSO", description="Status da ingestão: SUCESSO, PARCIAL ou ERRO")
    erros: List[str] = Field(default_factory=list, description="Lista de avisos ou inconsistências pontuais")
    uploaded_by: str = Field(..., description="Login do usuário administrador que realizou o upload")
    message: str = Field("Upload e ingestão concluídos com sucesso.", description="Mensagem de retorno")


class LoteResponse(BaseModel):
    """Detalhes de auditoria de um lote de planilha processado."""
    id: int
    nome_arquivo: str
    data_ingestao: Optional[str] = None
    total_linhas_lidas: int
    total_alertas_inseridos: int
    total_alertas_atualizados: int
    total_alertas_velocidade: int
    status: str
    tempo_execucao_segundos: float
