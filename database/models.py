"""
Modelos ORM relacionais para o banco de dados de telemetria da Casagrande.
Mapeia Veículos, Motoristas, Lotes de Ingestão e Alertas/Eventos.
"""

from datetime import datetime
import enum
from typing import Any, Dict, Optional

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from database.connection import Base


class Veiculo(Base):
    """
    Tabela de cadastro e agregação de Veículos da frota.
    """
    __tablename__ = "veiculos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    placa = Column(String(20), unique=True, index=True, nullable=False)
    prefixo = Column(String(50), nullable=True)
    categoria = Column(String(50), index=True, nullable=False, default="Não Classificado")
    uo = Column(String(50), default="CASAGRANDE")
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relacionamento com Alertas
    alertas = relationship("Alerta", back_populates="veiculo_rel")

    def __repr__(self) -> str:
        return f"<Veiculo placa={self.placa} categoria={self.categoria}>"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "placa": self.placa,
            "prefixo": self.prefixo,
            "categoria": self.categoria,
            "uo": self.uo,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Motorista(Base):
    """
    Tabela de cadastro e agregação de Condutores da frota.
    """
    __tablename__ = "motoristas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nome = Column(String(150), index=True, nullable=False)
    cpf = Column(String(30), index=True, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relacionamento com Alertas
    alertas = relationship("Alerta", back_populates="motorista_rel")

    def __repr__(self) -> str:
        return f"<Motorista nome={self.nome} cpf={self.cpf}>"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "nome": self.nome,
            "cpf": self.cpf,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class LoteIngestao(Base):
    """
    Registro histórico e auditoria de cada lote de planilha ingerido.
    """
    __tablename__ = "lotes_ingestao"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nome_arquivo = Column(String(255), nullable=False)
    tamanho_bytes = Column(Integer, nullable=True)
    hash_arquivo = Column(String(64), index=True, nullable=True)
    data_ingestao = Column(DateTime, default=func.now())
    total_linhas_lidas = Column(Integer, default=0)
    total_alertas_inseridos = Column(Integer, default=0)
    total_alertas_atualizados = Column(Integer, default=0)
    total_alertas_velocidade = Column(Integer, default=0)
    status = Column(String(50), default="SUCESSO")  # SUCESSO, ERRO, PARCIAL
    mensagem_erro = Column(Text, nullable=True)
    tempo_execucao_segundos = Column(Float, default=0.0)

    # Relacionamento com Alertas carregados neste lote
    alertas = relationship("Alerta", back_populates="lote_rel")

    def __repr__(self) -> str:
        return f"<LoteIngestao id={self.id} arquivo={self.nome_arquivo} status={self.status}>"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "nome_arquivo": self.nome_arquivo,
            "data_ingestao": self.data_ingestao.isoformat() if self.data_ingestao else None,
            "total_linhas_lidas": self.total_linhas_lidas,
            "total_alertas_inseridos": self.total_alertas_inseridos,
            "total_alertas_atualizados": self.total_alertas_atualizados,
            "total_alertas_velocidade": self.total_alertas_velocidade,
            "status": self.status,
            "tempo_execucao_segundos": self.tempo_execucao_segundos,
        }


class Alerta(Base):
    """
    Tabela principal com todos os registros de telemetria e infrações.
    Possui chave de deduplicação hash_id para permitir upsert idempotente.
    """
    __tablename__ = "alertas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    hash_id = Column(String(64), unique=True, index=True, nullable=False)

    # Foreign Keys relacionais
    veiculo_id = Column(Integer, ForeignKey("veiculos.id", ondelete="SET NULL"), nullable=True, index=True)
    motorista_id = Column(Integer, ForeignKey("motoristas.id", ondelete="SET NULL"), nullable=True, index=True)
    lote_id = Column(Integer, ForeignKey("lotes_ingestao.id", ondelete="SET NULL"), nullable=True, index=True)

    # Dados cadastrais e organizacionais
    placa = Column(String(20), index=True, nullable=False)
    prefixo = Column(String(50), nullable=True)
    categoria = Column(String(50), index=True, nullable=False, default="Não Classificado")
    motorista = Column(String(150), index=True, nullable=False, default="Sem Identificação")
    cpf = Column(String(30), nullable=True)
    uo = Column(String(50), default="CASAGRANDE")

    # Classificação e métricas do evento
    tipo = Column(String(100), index=True, nullable=False)
    nivel = Column(String(20), index=True, nullable=False, default="BAIXO")
    limiar = Column(Float, nullable=True)
    velocidade = Column(Float, nullable=True)
    delta = Column(Float, nullable=True)
    pct = Column(Float, nullable=True)
    duracao_str = Column(String(20), default="00:00:00")
    duracao_segundos = Column(Integer, default=0)

    # Localização e georreferenciamento
    logradouro = Column(String(200), index=True, nullable=True)
    cidade = Column(String(100), index=True, nullable=True)
    estado = Column(String(50), default="MS")
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    # Temporal
    data_evento = Column(Date, index=True, nullable=True)
    hora_evento = Column(String(20), nullable=True)
    data_hora = Column(DateTime, index=True, nullable=True)
    hora_inteira = Column(Integer, index=True, nullable=True)

    # Campos operacionais e de auditoria da telemetria
    status = Column(String(50), default="NOVO")
    ponto_referencia = Column(String(255), nullable=True)
    cerca_eletronica = Column(String(255), nullable=True)
    rotulo = Column(String(100), nullable=True)
    grupo = Column(String(100), nullable=True)
    atribuido = Column(String(100), nullable=True)
    visualizado_por = Column(String(100), nullable=True)
    feedback_video = Column(String(100), nullable=True)
    usuario_feedback = Column(String(100), nullable=True)
    ultimo_comentario = Column(Text, nullable=True)
    integrador = Column(String(100), nullable=True)
    alerta_desconsiderado = Column(String(20), default="NÃO")
    desconsiderado_por = Column(String(100), nullable=True)
    desconsiderado_em = Column(String(100), nullable=True)

    # Flag booleano para acelerar consultas analíticas do dashboard
    is_velocidade = Column(Boolean, index=True, default=False)

    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relacionamentos ORM
    veiculo_rel = relationship("Veiculo", back_populates="alertas")
    motorista_rel = relationship("Motorista", back_populates="alertas")
    lote_rel = relationship("LoteIngestao", back_populates="alertas")

    # Índices compostos para consultas rápidas
    __table_args__ = (
        Index("idx_alerta_data_tipo", "data_evento", "tipo"),
        Index("idx_alerta_placa_data", "placa", "data_evento"),
        Index("idx_alerta_motorista_data", "motorista", "data_evento"),
        Index("idx_alerta_isvel_data", "is_velocidade", "data_evento"),
    )

    def __repr__(self) -> str:
        return f"<Alerta id={self.id} placa={self.placa} tipo={self.tipo} data={self.data_evento}>"

    def to_dashboard_dict(self) -> Dict[str, Any]:
        """
        Exporta no formato exato esperado pelo dashboard_velocidade.html.
        Garante compatibilidade total com a interface existente.
        """
        data_br = self.data_evento.strftime("%d/%m/%Y") if self.data_evento else ""
        vel = self.velocidade
        lim = self.limiar
        dlt = self.delta

        return {
            "id": self.id,
            "placa": self.placa,
            "prefixo": self.prefixo or "-",
            "categoria": self.categoria,
            "motorista": self.motorista,
            "cpf": self.cpf or "-",
            "uo": self.uo or "CASAGRANDE",
            "tipo": self.tipo,
            "nivel": self.nivel,
            "limiar": lim,
            "limiar_str": f"{lim:.0f} km/h" if lim is not None else "-",
            "velocidade": vel,
            "valor": vel,
            "valor_str": f"{vel:.0f} km/h" if vel is not None else "-",
            "delta": dlt if dlt is not None else 0.0,
            "delta_str": f"+{dlt:.0f} km/h" if dlt is not None else "-",
            "pct": self.pct if self.pct is not None else 0.0,
            "duracao_str": self.duracao_str or "00:00:00",
            "duracao_sec": self.duracao_segundos or 0,
            "logradouro": self.logradouro or "Não Informado",
            "cidade": self.cidade or "Não Informada",
            "estado": self.estado or "MS",
            "lat": self.latitude,
            "lng": self.longitude,
            "data": data_br,
            "hora": self.hora_evento or "00:00:00",
            "hour": self.hora_inteira if self.hora_inteira is not None else 0,
            "status": self.status or "NOVO",
        }


class UserRole(str, enum.Enum):
    """Papéis de usuário no sistema RBAC."""
    ADMIN = "admin"
    VIEWER = "viewer"


class Usuario(Base):
    """
    Tabela de Usuários do sistema para autenticação e controle de acesso RBAC.
    Papéis (roles):
      - 'admin': permissão total (visualização, filtros, gestão de usuários e upload de novas planilhas).
      - 'viewer': permissão restrita à visualização de dashboards, filtros e relatórios consolidados.
    """
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), index=True, nullable=False, default=UserRole.VIEWER.value)
    nome_completo = Column(String(150), nullable=True)
    ativo = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    def __repr__(self) -> str:
        return f"<Usuario id={self.id} username='{self.username}' role='{self.role}' ativo={self.ativo}>"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "role": self.role,
            "nome_completo": self.nome_completo,
            "ativo": self.ativo,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

