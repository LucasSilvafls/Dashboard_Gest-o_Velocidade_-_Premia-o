# 🚛 Painel de Controle de Velocidade e Telemetria da Frota
### Casagrande Locações e Transportes • Unidade Operacional CSG

![Status](https://img.shields.io/badge/Status-Produção_v2.0-success?style=for-the-badge&logo=shield)
![Plataforma](https://img.shields.io/badge/Plataforma-HTML5_SPA_Offline_First-blue?style=for-the-badge&logo=html5)
![Stack](https://img.shields.io/badge/Stack-Python_ETL_+_Tailwind_+_Chart.js-informational?style=for-the-badge&logo=python)
![Governança](https://img.shields.io/badge/Governança-Premiação_80_km%2Fh-orange?style=for-the-badge&logo=award)

---

## 📌 Sumário Executivo

O **Painel de Controle de Velocidade e Telemetria da Frota** é uma solução corporativa desenvolvida para a **Casagrande Locações e Transportes**, projetada para transformar dados brutos de telemetria veicular (sensores embarcados, tacógrafos e rastreadores) em inteligência operacional e governança de segurança do trabalho (SESMT).

A plataforma consolida o monitoramento contínuo da frota pesada e leve, viabilizando diagnósticos precisos sobre excessos de velocidade, pontos críticos de rodovias no Mato Grosso do Sul e Goiás, reincidência de condutores, e a apuração transparente do **Programa de Premiação de Direção Segura: Motorista x Caminhão**.

---

## 📊 Números-Chave da Base Operacional

| Indicador | Valor Registrado | Observações |
| :--- | :--- | :--- |
| **Alertas Brutos Ingeridos** | **16.067** | Telemetria completa (velocidade, fadiga, distração, marcha lenta, freadas). |
| **Excessos de Velocidade Monitorados** | **9.051** | **56,3%** do volume total de eventos da frota. |
| **Veículos Ativos com Ocorrências** | **35 veículos** | Distribuídos em 7 categorias funcionais. |
| **Categorias de Veículos Mapeadas** | **7 categorias** | Cavalos Mecânicos, Caçambas, Leves, Pipas, Comboios, Munk e Ônibus. |
| **Condutores Identificados** | **21 motoristas** | Monitorados via crachá eletrônico / chaveiro iButton. |
| **Período de Apuração da Amostra** | **26/09/2026 a 25/10/2026** | 30 dias contínuos de operação rodoviária e frentes de serviço. |
| **Pico Absoluto de Velocidade** | **158 km/h** | Veículo leve na Rodovia MS-436. |
| **Teto Regulamentar de Caminhões** | **80 km/h** | Limite máximo estrito para qualificação na premiação corporativa. |

---

## 🚀 Principais Diferenciais e Recursos da Solução

1. **Arquitetura 100% Autônoma (Zero-Dependency & Offline-First):**
   - O dashboard é entregue como um arquivo executável único: [dashboard_velocidade.html](file:///c:/Users/Administrador/Documents/01 - PROJETOS/Dashboard Velocidades CSG/dashboard_velocidade.html).
   - Não requer instalação de servidores web, bancos de dados, nem conexão ativa com a internet. Abre com duplo clique em qualquer navegador moderno.
2. **Design System Industrial de Telemetria:**
   - Suporte nativo e instantâneo a **Tema Escuro** (para salas de controle / CCO) e **Tema Claro** (para relatórios executivos e impressão).
   - Identidade visual oficial da Casagrande Locações e Transportes com logotipos embutidos em Base64.
3. **Filtros Operacionais em Cascata Inteligente:**
   - Filtro por Dia, Categoria do Veículo, Tipo de Excesso (90 km/h da empresa vs Placa da via), Placa (atualizada dinamicamente pela categoria selecionada), Gravidade e Status de Identificação do Condutor.
4. **Cinco Abas de Análise Especializada:**
   - **Aba 1 (Resumo Geral e Horários):** Dinâmica temporal diária, curva horária (0h às 23h) e distribuição por turnos de trabalho.
   - **Aba 2 (Ocorrências Graves e Pontos de Atenção):** Curva de Pareto de risco, desvios de longa duração (> 10 minutos), e ranking de rodovias críticas (MS-436, MS-112, MS-320).
   - **Aba 3 (Ranking Frota e Condutores):** Top 10 veículos e motoristas mais reincidentes, com comparativo por categoria.
   - **Aba 4 (Lista Completa de Ocorrências):** Tabela analítica com paginação, busca instantânea, ordenação por colunas e modal detalhado com link para o **Google Maps** via coordenadas GPS (WGS84).
   - **Aba 5 (Premiação Motorista x Caminhão):** Módulo de bonificação salarial baseado no teto de 80 km/h para caminhões, simulador de cenários (80, 85, 90 km/h) e geração de **Dossiê Individual de Auditoria** para impressão.
5. **Ingestão Dinâmica de Novas Planilhas no Navegador:**
   - Suporta upload local via arrastar-e-soltar de arquivos `.csv`, `.xlsx`, `.ods` e `.json`, recalculando todo o painel diretamente na memória do navegador com total respeito à LGPD.
6. **Exportação de Dados:**
   - Exportação em formato `.csv` de qualquer visão filtrada ou da listagem oficial de premiação.

---

## 📚 Documentação Técnica Completa

Para aprofundar-se em cada aspecto do projeto, consulte os guias especializados na pasta [`docs/`](file:///c:/Users/Administrador/Documents/01 - PROJETOS/Dashboard Velocidades CSG/docs/):

```
docs/
├── ARCHITECTURE.md          -> Arquitetura técnica, pipeline ETL, stack e fluxo reativo
├── API_DOCUMENTATION.md     -> Documentação completa da API RESTful, RBAC, JWT e endpoints
├── DATA_DICTIONARY.md       -> Dicionário de dados, tipos, regras de limpeza e schemas
├── USER_GUIDE.md            -> Manual de operação completo do usuário e analista
├── PREMIACAO_REGULATION.md  -> Regulamento oficial da premiação motorista x caminhão (80 km/h)
└── DEPLOYMENT_MAINTENANCE.md-> Guia de implantação, execução de scripts e manutenção
```

- [📘 Guia do Usuário e Manual Operacional](file:///c:/Users/Administrador/Documents/01 - PROJETOS/Dashboard Velocidades CSG/docs/USER_GUIDE.md)
- [📡 Documentação da API RESTful e RBAC](file:///c:/Users/Administrador/Documents/01 - PROJETOS/Dashboard Velocidades CSG/docs/API_DOCUMENTATION.md)
- [🏗️ Arquitetura do Sistema e Engenharia de Dados](file:///c:/Users/Administrador/Documents/01 - PROJETOS/Dashboard Velocidades CSG/docs/ARCHITECTURE.md)
- [📖 Dicionário de Dados e Regras de Negócio](file:///c:/Users/Administrador/Documents/01 - PROJETOS/Dashboard Velocidades CSG/docs/DATA_DICTIONARY.md)
- [🏆 Regulamento da Premiação de Direção Segura](file:///c:/Users/Administrador/Documents/01 - PROJETOS/Dashboard Velocidades CSG/docs/PREMIACAO_REGULATION.md)
- [⚙️ Guia de Implantação e Atualização de Dados](file:///c:/Users/Administrador/Documents/01 - PROJETOS/Dashboard Velocidades CSG/docs/DEPLOYMENT_MAINTENANCE.md)

---

## ⚡ Como Usar (Guia Rápido)

### 1. Para Usuários Finais e Gestores
1. Baixe ou acesse o arquivo [`dashboard_velocidade.html`](file:///c:/Users/Administrador/Documents/01 - PROJETOS/Dashboard Velocidades CSG/dashboard_velocidade.html).
2. Dê um duplo clique para abrir no Google Chrome, Microsoft Edge ou outro navegador.
3. Utilize os filtros superiores para refinar a análise ou navegue pelas 5 abas temáticas.

### 2. Para Desenvolvedores e Engenheiros de Dados (Atualização do Dataset)
Caso receba uma nova planilha de telemetria no formato Excel (`.xlsx`) ou CSV e deseje alimentar o banco e compilar o dashboard:

```powershell
# 1. Instalar dependências (FastAPI, SQLAlchemy, pandas, openpyxl, pyjwt, bcrypt, pytest)
pip install fastapi uvicorn sqlalchemy pandas openpyxl pyjwt bcrypt python-multipart pytest

# 2. Executar ingestão da planilha Excel no banco de dados relacional (com upsert e exportação automática do JSON)
python ingest.py Historico_Alertas.xlsx --mode upsert --export-json

# 3. Iniciar o servidor Backend da API RESTful (FastAPI + Swagger UI)
python server.py --host 0.0.0.0 --port 8000 --reload
# Acesse a documentação interativa em: http://localhost:8000/docs

# 4. Compilar o novo dashboard HTML autossuficiente
python build_dashboard_html.py

# 5. Executar a suíte de testes automatizados (78 testes cobrindo ETL, Banco, API e Frontend SPA)
pytest tests/ -v
```

O arquivo final `dashboard_velocidade.html` será compilado sincronizado com o banco de dados em menos de 1 segundo. Você também pode acessar diretamente via navegador através da API em `http://localhost:8000/dashboard`.

---

## 🔐 Autenticação, API e Níveis de Permissão (RBAC)

A API RESTful em **FastAPI** disponibiliza autenticação via **JWT Bearer** e controle de permissões por perfil:

| Usuário Padrão | Senha Padrão | Perfil (Role) | Permissões |
| :--- | :--- | :--- | :--- |
| **`admin`** | `admin123` | **`admin`** | Acesso total: Visualização de dados, relatórios, gestão de usuários e **upload de novas planilhas** (`POST /api/upload`). |
| **`viewer`** | `viewer123` | **`viewer`** | Visualização de todos os painéis, filtros e relatórios. **Bloqueio automático ao upload (HTTP 403 Forbidden).** |

Consulte o [📡 Manual Completo da API](file:///c:/Users/Administrador/Documents/01 - PROJETOS/Dashboard Velocidades CSG/docs/API_DOCUMENTATION.md) para detalhes de todos os endpoints e exemplos de integração.

---

## 🗂️ Estrutura do Repositório

```
Dashboard Velocidades CSG/
├── README.md                      # Sumário executivo e guia geral do projeto
├── GLOSSARY.md                    # Glossário de termos de domínio e telemetria
├── pytest.ini                     # Configuração da suíte de testes automatizados
├── .gitignore                     # Configuração de exclusão de artefatos temporários
├── server.py                      # Inicializador do servidor Backend API (uvicorn backend.main:app)
├── ingest.py                      # Ponto de entrada CLI para ingestão de planilhas Excel/CSV
├── build_dashboard_html.py        # Compilador rápido do HTML autossuficiente (<0.5s de build)
├── dashboard_template.html        # Template desacoplado com injeção limpa de assets e dados
├── dashboard_velocidade.html      # Aplicação web final SPA servida em /dashboard ou offline
├── telemetria.db                  # Banco de dados relacional SQLite (ou PostgreSQL via DATABASE_URL)
│
├── backend/                       # Camada de Backend, API RESTful e Autenticação
│   ├── config.py                  # Configurações globais, variáveis de ambiente e segurança
│   ├── security.py                # Criptografia Bcrypt e emissão/validação de tokens JWT
│   ├── dependencies.py            # Injeção de dependências (Sessão DB, get_current_user, require_admin)
│   ├── schemas/                   # Schemas Pydantic para validação e tipagem forte
│   │   ├── auth.py                # Schemas de login, tokens JWT e usuários
│   │   ├── dashboard.py           # Schemas dos endpoints do dashboard, KPIs e filtros
│   │   └── ingestion.py           # Schemas de upload e auditoria de lotes
│   ├── routers/                   # Roteadores modulares de endpoints
│   │   ├── auth.py                # /api/auth (Login, /me, usuários)
│   │   ├── dashboard.py           # /api/dashboard (Dados consolidados, KPIs, filtros, premiação)
│   │   ├── upload.py              # /api/upload (Upload restrito a Admin) e /api/upload/lotes
│   │   └── veiculos.py            # /api/veiculos e /api/motoristas
│   └── main.py                    # Aplicação principal FastAPI com Swagger UI, CORS e rota /dashboard
│
├── data/                          # Diretório de datasets operacionais e bases consolidadas
│   ├── Historico_Alertas.xlsx     # Base operacional em planilha Excel (.xlsx) oficial
│   ├── Historico_Alertas.csv      # Base de dados em formato CSV para exportações
│   └── dashboard_data.json        # Base estruturada JSON sincronizada a partir do banco relacional
│
├── database/                      # Módulo da camada de banco de dados relacional
│   ├── connection.py              # Gerenciador de conexão SQLAlchemy (SQLite & PostgreSQL)
│   ├── models.py                  # Modelos ORM: Veiculo, Motorista, Alerta, LoteIngestao, Usuario
│   └── repository.py              # Consultas analíticas, exportação e consultas RBAC
│
├── frontend/                      # Arquitetura modular da interface SPA
│   ├── assets/                    # Identidade visual oficial
│   │   ├── logo_casagrande.png    # Logotipo corporativo versão clara
│   │   └── logo_casagrande_dark.png # Logotipo corporativo versão escura
│   ├── components/                # Componentes HTML desacoplados (abas e modais)
│   ├── css/                       # Design System, tokens semânticos e estilos industriais
│   ├── js/                        # Módulos JavaScript (API, Auth, Charts, Filtros, Premiação, etc.)
│   └── index.html                 # Master template base da aplicação
│
├── ingestion/                     # Módulo de ETL e ingestão de planilhas
│   ├── excel_reader.py            # Leitura robusta de .xlsx via openpyxl com mapeamento de aliases
│   ├── cleaner.py                 # Higienização de strings, coordenadas, datas BR e hash SHA-256
│   ├── etl.py                     # Pipeline ETL com suporte a upsert idempotente
│   └── cli.py                     # Interface de linha de comando com relatórios e métricas
│
├── scripts/                       # Scripts auxiliares e ferramentas de manutenção
│   └── generate_data.py           # Script utilitário para geração direta do payload JSON a partir de CSV
│
├── tests/                         # Suíte de 78 testes unitários e de integração
│   ├── conftest.py                # Fixtures globais, TestClient e tokens JWT de teste
│   ├── test_api_auth.py           # Testes de login, emissão JWT e controle de papéis
│   ├── test_api_dashboard.py      # Testes de entrega de dados consolidados via API
│   ├── test_api_upload.py         # Testes de bloqueio de Viewer (403) e upload Admin (200)
│   ├── test_cleaner.py            # Testes de funções de higienização
│   ├── test_excel_reader.py       # Testes de leitura de arquivos Excel
│   ├── test_database.py           # Testes dos modelos ORM e repositório
│   ├── test_frontend_spa.py       # Testes da interface SPA, Modal de Login, RBAC e Painel de Upload
│   └── test_ingestion.py          # Testes de ponta a ponta do pipeline ETL
│
├── uploads/                       # Diretório protegido para recepção de uploads via API (/api/upload)
│   └── .gitkeep                   # Marcador de diretório versionado
│
└── docs/                          # Manuais e documentações especializadas
    ├── ARCHITECTURE.md            # Arquitetura, tecnologias, esquema ER e fluxo de dados
    ├── API_DOCUMENTATION.md       # Manual completo da API RESTful, RBAC e OpenAPI
    ├── DATA_DICTIONARY.md         # Dicionário de campos brutos e tratados
    ├── USER_GUIDE.md              # Manual de uso passo a passo da interface
    ├── PREMIACAO_REGULATION.md    # Regras e critérios do Programa de Premiação
    ├── DEPLOYMENT_MAINTENANCE.md  # Procedimentos de deploy, atualização e suporte
    └── adr/                       # Registros de Decisão de Arquitetura (ADRs)
```

---

## 🏢 Créditos Institucionais

- **Cliente / Organização:** Casagrande Locações e Transportes
- **Unidade Gestora:** Unidade Operacional CSG (Mato Grosso do Sul / Goiás)
- **Áreas Atendidas:** Gestão de Frotas, Logística, SESMT (Segurança do Trabalho) e Recursos Humanos.
