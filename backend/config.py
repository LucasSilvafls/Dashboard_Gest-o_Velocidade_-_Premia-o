"""
Configurações da aplicação backend CSG Telemetria.
Suporta variáveis de ambiente para fácil deploy em produção ou Docker.
"""

import os
from pathlib import Path
from typing import List

# Diretório raiz do projeto
BASE_DIR = Path(__file__).resolve().parent.parent

import secrets
import warnings

# Configurações de Segurança e JWT
_env_secret = os.getenv("JWT_SECRET_KEY")
if _env_secret:
    SECRET_KEY: str = _env_secret
elif os.getenv("TESTING", "").lower() in ("true", "1"):
    SECRET_KEY: str = "csg_telemetria_test_secret_key_fixed_for_test_harness_2026"
else:
    # Em produção ou execução padrão sem JWT_SECRET_KEY configurada,
    # gera um segredo criptográfico aleatório único por processo (256-bit)
    SECRET_KEY: str = secrets.token_urlsafe(32)
    warnings.warn(
        "AVISO DE SEGURANÇA: JWT_SECRET_KEY não foi definida no ambiente. "
        "Um segredo criptográfico efêmero aleatório foi gerado automaticamente. "
        "Para manter sessões persistentes entre reinicializações em produção, "
        "configure a variável de ambiente JWT_SECRET_KEY.",
        UserWarning,
        stacklevel=2,
    )

ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24 horas

# Banco de dados e diretórios de dados
DATA_DIR: Path = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{ (BASE_DIR / 'telemetria.db').as_posix() }")

# Prefixos e URLs da API
API_V1_STR: str = "/api"
PROJECT_NAME: str = "Painel de Controle de Velocidade CSG - Backend API"
PROJECT_VERSION: str = "2.0.0"

# Usuários padrão de inicialização (Seed)
DEFAULT_ADMIN_USER: str = os.getenv("DEFAULT_ADMIN_USER", "admin")
DEFAULT_ADMIN_PASS: str = os.getenv("DEFAULT_ADMIN_PASS", "admin123")
DEFAULT_VIEWER_USER: str = os.getenv("DEFAULT_VIEWER_USER", "viewer")
DEFAULT_VIEWER_PASS: str = os.getenv("DEFAULT_VIEWER_PASS", "viewer123")

# Uploads
UPLOAD_DIR: Path = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MAX_UPLOAD_SIZE_BYTES: int = 50 * 1024 * 1024  # 50 MB
ALLOWED_EXTENSIONS: set = {".xlsx", ".xls", ".csv"}

# CORS - Origens autorizadas estritas (sem curinga '*' quando allow_credentials=True)
_custom_cors = [orig.strip() for orig in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",") if orig.strip()]
CORS_ORIGINS: List[str] = _custom_cors or [
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8000",
    "http://localhost:8080",
    "http://127.0.0.1",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8000",
    "http://127.0.0.1:8080",
]
