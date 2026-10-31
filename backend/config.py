"""
Configurações da aplicação backend CSG Telemetria.
Suporta variáveis de ambiente para fácil deploy em produção ou Docker.
"""

import os
from pathlib import Path
from typing import List

# Diretório raiz do projeto
BASE_DIR = Path(__file__).resolve().parent.parent

# Configurações de Segurança e JWT
SECRET_KEY: str = os.getenv(
    "JWT_SECRET_KEY", "csg_telemetria_secret_key_super_secure_2026_casagrande_telematics_jwt"
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

# CORS
CORS_ORIGINS: List[str] = [
    "*",
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
