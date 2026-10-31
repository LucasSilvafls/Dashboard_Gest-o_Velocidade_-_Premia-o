"""
Router de Autenticação, Emissão de Tokens JWT e Gestão de Usuários.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from backend.dependencies import get_current_user, get_db_session, require_admin
from backend.schemas.auth import LoginRequest, Token, UserCreate, UserResponse
from backend.security import create_access_token, verify_password
from database.models import UserRole, Usuario
from database.repository import create_usuario, get_usuario_by_username, list_usuarios

router = APIRouter(prefix="/auth", tags=["Autenticação & Controle de Acesso"])


@router.post(
    "/login",
    response_model=Token,
    summary="Login via JSON e obtenção de Token JWT",
    description="Autentica com nome de usuário e senha, retornando o Token Bearer JWT com o papel do usuário (role: admin ou viewer).",
)
def login_json(
    credentials: LoginRequest,
    session: Session = Depends(get_db_session),
) -> Token:
    """Realiza autenticação via payload JSON."""
    user = get_usuario_by_username(session, credentials.username)
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais incorretas: Usuário ou senha inválidos.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.ativo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Conta de usuário inativa. Contate o administrador.",
        )

    access_token = create_access_token(
        data={"sub": user.username, "role": user.role}
    )

    return Token(
        access_token=access_token,
        token_type="bearer",
        role=user.role,
        username=user.username,
        nome_completo=user.nome_completo,
    )


@router.post(
    "/token",
    response_model=Token,
    summary="Login OAuth2 compatível com Swagger UI",
    description="Endpoint padrão de formulário OAuth2 Password Flow utilizado pelo botão 'Authorize' da documentação interativa Swagger.",
)
def login_oauth2_form(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: Session = Depends(get_db_session),
) -> Token:
    """Realiza autenticação via formulário OAuth2 padrão."""
    user = get_usuario_by_username(session, form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais incorretas: Usuário ou senha inválidos.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.ativo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Conta de usuário inativa.",
        )

    access_token = create_access_token(
        data={"sub": user.username, "role": user.role}
    )

    return Token(
        access_token=access_token,
        token_type="bearer",
        role=user.role,
        username=user.username,
        nome_completo=user.nome_completo,
    )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Obter perfil do usuário autenticado",
    description="Retorna os dados cadastrais e papel atribuído do usuário portador do token JWT atual.",
)
def get_current_user_profile(
    current_user: Usuario = Depends(get_current_user),
) -> UserResponse:
    """Retorna o perfil do usuário logado."""
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        role=current_user.role,
        nome_completo=current_user.nome_completo,
        ativo=current_user.ativo,
        created_at=current_user.created_at.isoformat() if current_user.created_at else None,
    )


@router.get(
    "/users",
    response_model=List[UserResponse],
    summary="Listar todos os usuários (Apenas Admin)",
    description="Exibe a lista de todos os usuários cadastrados na plataforma. Exclusivo para administradores.",
)
def list_all_users(
    _admin: Usuario = Depends(require_admin),
    session: Session = Depends(get_db_session),
) -> List[UserResponse]:
    """Lista todos os usuários cadastrados."""
    users = list_usuarios(session)
    return [
        UserResponse(
            id=u.id,
            username=u.username,
            email=u.email,
            role=u.role,
            nome_completo=u.nome_completo,
            ativo=u.ativo,
            created_at=u.created_at.isoformat() if u.created_at else None,
        )
        for u in users
    ]


@router.post(
    "/users",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastrar novo usuário (Apenas Admin)",
    description="Permite que um administrador cadastre novos colaboradores definindo o papel ('admin' ou 'viewer').",
)
def create_new_user(
    user_in: UserCreate,
    _admin: Usuario = Depends(require_admin),
    session: Session = Depends(get_db_session),
) -> UserResponse:
    """Cria um novo usuário na base."""
    existing = get_usuario_by_username(session, user_in.username)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"O nome de usuário '{user_in.username}' já está cadastrado.",
        )

    # Valida papel
    valid_roles = [r.value for r in UserRole]
    if user_in.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Papel inválido '{user_in.role}'. Opções válidas: {valid_roles}",
        )

    new_user = create_usuario(
        session=session,
        username=user_in.username,
        raw_password=user_in.password,
        role=user_in.role,
        email=user_in.email,
        nome_completo=user_in.nome_completo,
    )

    return UserResponse(
        id=new_user.id,
        username=new_user.username,
        email=new_user.email,
        role=new_user.role,
        nome_completo=new_user.nome_completo,
        ativo=new_user.ativo,
        created_at=new_user.created_at.isoformat() if new_user.created_at else None,
    )
