"""
Injeção de Dependências do FastAPI para Sessões de Banco, Autenticação e RBAC.
"""

from typing import Callable, Generator, List

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from backend.config import DATABASE_URL
from backend.security import decode_access_token
from database.connection import get_engine, get_session_factory
from database.models import UserRole, Usuario
from database.repository import get_usuario_by_username

# Scheme OAuth2 para documentação Swagger e extração do cabeçalho Authorization: Bearer <token>
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/auth/token",
    description="Insira as credenciais de login ou o token JWT Bearer obtido via /api/auth/login",
)


def get_db_session() -> Generator[Session, None, None]:
    """
    Dependência FastAPI que fornece uma sessão limpa com o banco relacional.
    Garante commit automático ao finalizar a requisição e rollback em caso de falha.
    """
    engine = get_engine(DATABASE_URL)
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


def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: Session = Depends(get_db_session),
) -> Usuario:
    """
    Valida o token JWT e recupera o usuário autenticado da base relacional.
    Retorna 401 Unauthorized se o token for inválido, expirado ou usuário inativo.
    """
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de autenticação inválido ou expirado.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    username: str = payload.get("sub", "")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identificação do usuário ausente no token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    usuario = get_usuario_by_username(session, username)
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário associado ao token não encontrado no banco de dados.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not usuario.ativo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário desativado pelo administrador do sistema.",
        )

    return usuario


def require_role(allowed_roles: List[str]) -> Callable[[Usuario], Usuario]:
    """
    Fábrica de dependências para controle de acesso baseado em papéis (RBAC).
    Garante que apenas usuários com os perfis autorizados acessem o recurso.
    Retorna 403 Forbidden com mensagem explicativa se o papel não for autorizado.
    """
    def role_checker(current_user: Usuario = Depends(get_current_user)) -> Usuario:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Acesso negado. Ação restrita aos perfis: [{', '.join(allowed_roles)}]. "
                    f"Seu perfil atual é '{current_user.role}'."
                ),
            )
        return current_user

    return role_checker


# Dependências diretas para injeção rápida nas rotas
require_admin = require_role([UserRole.ADMIN.value])
require_viewer_or_admin = require_role([UserRole.VIEWER.value, UserRole.ADMIN.value])
