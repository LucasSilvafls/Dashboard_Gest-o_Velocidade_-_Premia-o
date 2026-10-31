"""
Aplicação Principal FastAPI - API de Telemetria e Velocidades CSG.
Casagrande Locações e Transportes.

Fornece endpoints RESTful protegidos por autenticação JWT e controle de acesso (RBAC),
documentação interativa automática (Swagger UI / ReDoc) e integração com o pipeline ETL da Task 1.
"""

from contextlib import asynccontextmanager
from typing import Any, Dict

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse

from backend.config import (
    API_V1_STR,
    CORS_ORIGINS,
    DATABASE_URL,
    DEFAULT_ADMIN_PASS,
    DEFAULT_ADMIN_USER,
    DEFAULT_VIEWER_PASS,
    DEFAULT_VIEWER_USER,
    PROJECT_NAME,
    PROJECT_VERSION,
)
from backend.routers import (
    auth_router,
    dashboard_router,
    upload_router,
    veiculos_router,
)
from database.connection import get_db, init_db
from database.repository import seed_default_users

API_DESCRIPTION = """
## 🚛 Sistema de Telemetria e Controle de Velocidades da Frota CSG
### Casagrande Locações e Transportes • Unidade Operacional CSG

Esta API expõe os dados consolidados da telemetria veicular diretamente do banco de dados relacional
e fornece controle de permissões baseado em papéis (**RBAC - Role-Based Access Control**).

---

### 🔐 Níveis de Acesso e Perfis (Roles)

| Papel | Escopo de Acesso | Permissões |
| :--- | :--- | :--- |
| **`viewer`** | Visualizador | Visualização de todos os dados do dashboard, KPIs, rankings, filtros e dossiês de premiação. **Acesso bloqueado a rotas de upload (403 Forbidden).** |
| **`admin`** | Administrador | Permissões totais: Visualização de dados + Upload e ingestão de novas planilhas de telemetria (.xlsx, .csv) + Gestão de colaboradores. |

---

### 🔑 Credenciais Padrão Pré-Configuradas

- **Administrador:** Usuário `admin` • Senha `admin123`
- **Visualizador:** Usuário `viewer` • Senha `viewer123`

Para testar na documentação Swagger UI:
1. Clique no botão verde **Authorize** no canto superior direito.
2. Insira `admin` e `admin123` (ou `viewer` e `viewer123`).
3. O token JWT Bearer será injetado automaticamente em todas as requisições.

---

### 📊 Endpoints Principais

- **/api/auth/login**: Autenticação JSON e obtenção de token JWT.
- **/api/dashboard/data**: Dataset completo consolidado diretamente do banco de dados (sem arquivos estáticos).
- **/api/dashboard/summary**: Métricas executivas de frota e distribuição de eventos.
- **/api/dashboard/alerts**: Consulta analítica paginada com múltiplos filtros em cascata.
- **/api/dashboard/rankings**: Maiores reincidentes da frota (condutores e veículos).
- **/api/dashboard/premiacao**: Apuração do Programa de Bonificação (teto de 80 km/h para caminhões).
- **/api/upload**: Ingestão e processamento seguro de novas planilhas com pipeline ETL (**Apenas Admin**).
"""


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Ciclo de vida da aplicação:
    1. Garante criação das tabelas no banco de dados relacional (SQLite ou PostgreSQL).
    2. Inicializa automaticamente os usuários padrão (admin e viewer).
    """
    import os
    if os.getenv("TESTING", "false").lower() not in ("true", "1"):
        # Inicializa tabelas
        init_db(DATABASE_URL)

        # Popula usuários padrão se não existirem
        with get_db(DATABASE_URL) as session:
            seed_default_users(
                session=session,
                default_admin_pass=DEFAULT_ADMIN_PASS,
                default_viewer_pass=DEFAULT_VIEWER_PASS,
            )

    yield


# Criação da instância FastAPI com documentação Swagger / ReDoc
app = FastAPI(
    title=PROJECT_NAME,
    description=API_DESCRIPTION,
    version=PROJECT_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    contact={
        "name": "Casagrande Locações e Transportes - Unidade CSG",
        "url": "https://casagrandelocacoes.com.br",
    },
)

# Configuração de CORS para permitir requisições de frontends (React, Vue, SPA HTML)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registro de Roteadores
app.include_router(auth_router, prefix=API_V1_STR)
app.include_router(dashboard_router, prefix=API_V1_STR)
app.include_router(upload_router, prefix=API_V1_STR)
app.include_router(veiculos_router, prefix=API_V1_STR)


@app.get(
    "/api/health",
    tags=["Auditoria & Sistema"],
    summary="Verificação de integridade (Health Check)",
    description="Retorna status operacional da API e da conexão com o banco de dados.",
)
async def health_check() -> Dict[str, Any]:
    """Health check operacional da API."""
    return {
        "status": "healthy",
        "app": PROJECT_NAME,
        "version": PROJECT_VERSION,
        "database": "connected",
        "docs_url": "/docs",
        "redoc_url": "/redoc",
    }


@app.get(
    "/",
    tags=["Auditoria & Sistema"],
    summary="Página inicial e boas-vindas da API",
    description="Retorna informações de boas-vindas com atalhos para a documentação Swagger e status.",
)
def root():
    """Boas-vindas à API de Telemetria CSG."""
    return {
        "message": "Bem-vindo à API de Telemetria e Velocidades CSG",
        "empresa": "Casagrande Locações e Transportes",
        "unidade": "CSG (Mato Grosso do Sul / Goiás)",
        "dashboard": "/dashboard",
        "documentacao_swagger": "/docs",
        "documentacao_redoc": "/redoc",
        "schema_openapi": "/openapi.json",
        "health": "/api/health",
        "login": "/api/auth/login",
    }


@app.get(
    "/dashboard",
    response_class=HTMLResponse,
    tags=["Dashboard & Telemetria"],
    summary="Aplicação Web SPA do Dashboard de Velocidade e Painel Admin",
    description="Serve o frontend SPA com consumo dinâmico da API e controle de acesso RBAC.",
)
def get_dashboard_html():
    """Serve a aplicação web SPA do Dashboard de Velocidade."""
    from backend.config import BASE_DIR
    dashboard_file = BASE_DIR / "dashboard_velocidade.html"
    if dashboard_file.exists():
        with open(dashboard_file, "r", encoding="utf-8") as f:
            content = f.read()
        return HTMLResponse(content)
    return HTMLResponse(
        "<h1>Dashboard HTML não encontrado. Execute: python build_dashboard_html.py</h1>",
        status_code=404,
    )
