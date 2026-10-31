"""
Schemas Pydantic para Autenticação, Usuários e Tokens JWT.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginRequest(BaseModel):
    """Corpo da requisição de login via JSON."""
    username: str = Field(..., description="Nome de usuário para autenticação", examples=["admin", "viewer"])
    password: str = Field(..., description="Senha do usuário", examples=["admin123", "viewer123"])


class Token(BaseModel):
    """Resposta com o Token de Acesso JWT e metadados do usuário."""
    access_token: str = Field(..., description="Token JWT Bearer assinado")
    token_type: str = Field("bearer", description="Tipo de autenticação (Bearer)")
    role: str = Field(..., description="Papel do usuário: 'admin' ou 'viewer'")
    username: str = Field(..., description="Nome de usuário autenticado")
    nome_completo: Optional[str] = Field(None, description="Nome completo do colaborador")


class TokenPayload(BaseModel):
    """Conteúdo decodificado (claims) do token JWT."""
    sub: str = Field(..., description="Subject: username")
    role: str = Field(..., description="Role: admin ou viewer")
    exp: Optional[int] = Field(None, description="Timestamp de expiração Unix")
    iat: Optional[int] = Field(None, description="Timestamp de emissão Unix")


class UserCreate(BaseModel):
    """Payload para criação de novo usuário no sistema."""
    username: str = Field(..., min_length=3, max_length=50, description="Login único de acesso")
    password: str = Field(..., min_length=6, description="Senha do usuário")
    role: str = Field("viewer", description="Papel: 'admin' ou 'viewer'")
    email: Optional[str] = Field(None, description="E-mail corporativo")
    nome_completo: Optional[str] = Field(None, description="Nome completo")


class UserResponse(BaseModel):
    """Dados públicos do usuário retornados pela API."""
    id: int
    username: str
    email: Optional[str] = None
    role: str
    nome_completo: Optional[str] = None
    ativo: bool
    created_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
