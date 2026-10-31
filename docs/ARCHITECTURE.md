# 🏗️ Arquitetura do Sistema e Engenharia de Dados

> **Projeto:** Painel de Controle de Velocidade e Telemetria de Frota  
> **Empresa:** Casagrande Locações e Transportes  
> **Versão:** 2.0 (Suporte a Categorização de Frotas e Módulo de Premiação)  
> **Classificação:** Documentação Técnica de Engenharia  

---

## 1. Visão Geral da Arquitetura

O sistema adota o paradigma **Jamstack Serverless / Client-Side Engine** de alta performance:
- Toda a preparação, sanitização e estruturação dos dados brutos de telemetria é realizada via pipeline **ETL Python** offline.
- O resultado é compilado em um executável/documento HTML único (`dashboard_velocidade.html`), contendo o bundle completo de estilos, bibliotecas, lógica analítica reativa e o dataset estruturado embutido em formato JSON.
- A aplicação é **100% autônoma e offline-first**: não depende de servidores web dinâmicos, bancos de dados em tempo de execução ou chamadas de API externas para navegar, filtrar, tabular e gerar gráficos.

```mermaid
flowchart TD
    subgraph Ingestao["1. Fontes de Dados (Planilhas Excel e Telemetria)"]
        XLSX["Historico_Alertas.xlsx<br/>(Planilha Excel .xlsx via openpyxl)"]
        CSV1["Historico_Alertas.csv<br/>(Legado CSV com delimitador ;)"]
    end

    subgraph Pipeline["2. Módulo de Ingestão e Limpeza (ingestion/)"]
        READER["excel_reader.py<br/>(Detecção de Cabeçalho, Aliases, OpenPyXL)"]
        CLEAN["cleaner.py<br/>(Regex, WGS84, Datas BR, Hash SHA-256)"]
        ETL["etl.py (TelemetryETLPipeline)<br/>Upsert Idempotente / Clean Insert"]
    end

    subgraph Database["3. Banco de Dados Relacional (database/)"]
        ENG["SQLAlchemy 2.0 (SQLite / PostgreSQL)"]
        T_VEICULOS[("Tabela veiculos")]
        T_MOTORISTAS[("Tabela motoristas")]
        T_LOTES[("Tabela lotes_ingestao (Auditoria)")]
        T_ALERTAS[("Tabela alertas (Deduplicação por hash_id)")]
    end

    subgraph Sync["4. Sincronização & Exportação (repository.py)"]
        REPO["export_dashboard_json()"]
        PAYLOAD["dashboard_data.json<br/>(Payload estruturado)"]
    end

    subgraph Build["5. Compilação do Artefato"]
        BUILD["build_dashboard_html.py"]
        ASSETS["Logotipos Base64<br/>(Claro / Escuro)"]
        HTML["dashboard_velocidade.html<br/>(~5.9 MB - Autossuficiente)"]
    end

    subgraph Runtime["6. Execução no Cliente (Browser)"]
        ENGINE["Motor Reativo Vanilla JS"]
        UI["Design System Industrial<br/>(Tailwind + CSS Tokens)"]
        VIZ["Chart.js + Lucide Icons"]
        IO["PapaParse + SheetJS<br/>(Upload Dinâmico no Navegador)"]
    end

    XLSX --> READER
    CSV1 -.-> READER
    READER --> CLEAN --> ETL
    ETL --> ENG
    ENG --> T_VEICULOS
    ENG --> T_MOTORISTAS
    ENG --> T_LOTES
    ENG --> T_ALERTAS
    T_ALERTAS --> REPO
    T_VEICULOS --> REPO
    REPO --> PAYLOAD
    PAYLOAD --> BUILD
    ASSETS --> BUILD
    BUILD --> HTML
    HTML --> Runtime
    ENGINE --> UI
    ENGINE --> VIZ
    ENGINE --> IO
```

---

## 2. Componentes Técnicos do Sistema

### 2.1. Pipeline de Dados (`generate_data.py`)

O pipeline de dados em Python é responsável por processar e validar arquivos de telemetria brutos (exportações do sistema de rastreamento).

#### Principais Responsabilidades:
1. **Detecção Automática de Encoding**: Testa iterativamente `cp1252`, `latin1`, `utf-8-sig` e `utf-8`, prevenindo quebras em sistemas Windows/Linux.
2. **Normalização Numérica (`parse_num_clean`)**: Remove sufixos como `km/h`, `km/h/s`, `rpm`, `g`, `s`, troca vírgulas por pontos e converte para ponto flutuante.
3. **Conversão de Duração (`parse_sec`)**: Transforma strings no formato `HH:MM:SS` ou `MM:SS` em contagem inteira de segundos.
4. **Tratamento de Coordenadas Geográficas (`fix_coord`)**: Trata strings de latitude e longitude que perderam a pontuação decimal (ex: `-19902550` $\to$ `-19.902550`), padronizando para 6 casas decimais no padrão geodésico WGS84.
5. **Resolução de Datas Brasileiras (`resolve_dates_br`)**: Analisa componentes dia/mês/ano por inferência estatística, resolvendo ambiguidades entre formatos `DD/MM/YYYY` e `MM/DD/YYYY`.
6. **Sanitização de Caracteres e Nomes (`fix_text_encoding`)**: Corrige strings com problemas de codificação e unifica a nomenclatura de motoristas sem identificação ("Sem Identificação").
7. **Cálculo de Indicadores Derivados**:
   - `delta = velocidade - limiar` (km/h excedente)
   - `pct = (delta / limiar) * 100` (% de excesso)
   - Severidade: Classificada em `ALTO` ($\ge 20$ km/h acima), `MEDIO` ($\ge 10$ km/h acima) ou `BAIXO` ($< 10$ km/h acima).
8. **Agregação Metadados**:
   - Distribuição global de todos os tipos de telemetria (incluindo eventos não relacionados a velocidade: Fadiga, Distração, Parado Ligado, Banguela, etc.).
   - Mapeamento bidirecional Categoria $\leftrightarrow$ Placas.
   - Lista cronológica ordenada de datas.

### 2.2. Construtor da Aplicação (`build_dashboard_html.py`)

Script gerador de artefato final:
1. Lê o payload JSON estruturado (`data/dashboard_data.json`).
2. Lê as imagens de identidade visual (`frontend/assets/logo_casagrande.png` e `frontend/assets/logo_casagrande_dark.png`) e converte para strings `data:image/png;base64`.
3. Injeta o CSS compilado, estilos do Design System, bibliotecas CDN (Tailwind, Chart.js, PapaParse, SheetJS, Lucide) e templates HTML das 5 abas operacionais.
4. Produz o arquivo executável final `dashboard_velocidade.html`.

---

## 3. Stack Tecnológico

| Camada | Tecnologia | Justificativa de Engenharia |
| :--- | :--- | :--- |
| **Linguagem ETL** | Python 3.10+ | Robustez para processamento numérico, manipulação de strings e dataframes. |
| **Manipulação de Dados** | `pandas` | Leitura otimizada de arquivos CSV delimitados, vetorização e transformações. |
| **Serialização** | `json` (UTF-8) | Formato padrão para transporte leve e parse imediato pelo JavaScript do navegador. |
| **Estilização** | Tailwind CSS + CSS Variables | Design System responsivo com suporte nativo a temas Claro/Escuro sem flash de conteúdo. |
| **Visualização de Dados** | Chart.js 4.4 | Gráficos Canvas 2D de alta taxa de quadros (60 fps), responsivos e interativos. |
| **Ícones** | Lucide Icons | Conjunto moderno, limpo e consistente de ícones vetoriais em SVG. |
| **Parse CSV no Cliente** | PapaParse 5.4 | Processamento local de arquivos delimitados de até dezenas de megabytes no navegador. |
| **Parse Excel no Cliente** | SheetJS (xlsx 0.18.5) | Importação drag-and-drop de arquivos `.xlsx`, `.xls`, `.ods` sem necessidade de backend. |
| **Motor da Aplicação** | JavaScript Vanilla (ES6+) | Execução sem overhead de frameworks complexos, garantindo abertura instantânea. |

---

## 4. Fluxo Reativo da Aplicação no Cliente

O arquivo `dashboard_velocidade.html` opera como uma Single Page Application (SPA) reativa:

```mermaid
sequenceDiagram
    autonumber
    actor Usuario as Usuário / Gestor
    participant UI as Interface / Filtros
    participant State as Estado (filteredRecords)
    participant KPI as Calculador de KPIs
    participant Charts as Gerenciador Chart.js
    participant Tables as Renderizador de Tabelas

    Usuario->>UI: Altera Filtro (ex: Categoria = "CAVALO")
    UI->>State: Dispara onCategoryFilterChange() e applyFilters()
    State->>State: Atualiza dropdown de veículos (placas compatíveis)
    State->>State: Filtra allRecords com predicados ativos
    State->>KPI: updateKPIs(filteredRecords)
    KPI-->>UI: Atualiza Total, Vel. Máx, Média, Graves, Duração, Sem ID
    State->>Charts: updateCharts(filteredRecords)
    Charts-->>UI: Destrói/Atualiza Datasets dos Gráficos Canvas
    State->>Tables: renderTable(filteredRecords, page=1)
    Tables-->>UI: Desenha linhas com paginação e tooltips
    State->>Tables: updatePremiacaoView() (se aba ativa)
```

### 4.1. Estrutura de Estado Global
- `allRecords`: Array contendo todos os registros de excesso carregados no momento.
- `filteredRecords`: Subconjunto resultante da interseção dos 6 filtros operacionais e da barra de busca textual.
- `metaData`: Metadados globais (período, total da base, distribuição de telemetria, categorias, frotas).
- `currentPage`, `pageSize`, `sortColumn`, `sortDirection`: Estado de navegação e ordenação da Tabela 4.
- `premiacaoState`: Configurações de escopo (`TRUCKS` ou `ALL`), filtro de status (`ALL`, `APTO`, `INAPTO`) e limiar de velocidade dinâmico (`threshold = 80 km/h`).

---

## 5. Design System & Temas

O dashboard implementa um **Design System Industrial de Telemetria**, concebido para salas de controle (CCO), monitores industriais e notebooks de campo:
- **Tokens Semânticos**: Cores controladas por variáveis CSS (`--bg-page`, `--bg-card`, `--border-main`, `--brand-accent`, etc.).
- **Paleta Corporativa Casagrande**:
  - Verde Corporativo Primário: `#15803d` (Light) / `#22c55e` (Dark)
  - Superfícies escuras com baixo cansaço visual: `#0b0e11` e `#13181f`
  - Superfícies claras de alto contraste para relatórios: `#eef2f6` e `#ffffff`
- **Tipografia**:
  - Títulos e interface: `Plus Jakarta Sans`
  - Métricas, telemetria, placas e horas: `JetBrains Mono`

---

## 7. Arquitetura do Banco de Dados Relacional e Ingestão de Planilhas (v2.1)

A partir da versão 2.1, o sistema incorpora uma camada de persistência relacional com **SQLAlchemy 2.0**, eliminando a dependência de manipulação direta de CSVs estáticos e suportando ingestão robusta de planilhas Excel (`.xlsx`).

### 7.1. Esquema Relacional (Tabelas)

```mermaid
erDiagram
    VEICULOS ||--o{ ALERTAS : possui
    MOTORISTAS ||--o{ ALERTAS : registra
    LOTES_INGESTAO ||--o{ ALERTAS : carrega

    VEICULOS {
        int id PK
        string placa UK "Indexada"
        string prefixo
        string categoria "Indexada"
        string uo "Padrão CASAGRANDE"
        datetime created_at
        datetime updated_at
    }

    MOTORISTAS {
        int id PK
        string nome "Indexado"
        string cpf "Indexado"
        datetime created_at
        datetime updated_at
    }

    LOTES_INGESTAO {
        int id PK
        string nome_arquivo
        int tamanho_bytes
        string hash_arquivo "SHA-256"
        datetime data_ingestao
        int total_linhas_lidas
        int total_alertas_inseridos
        int total_alertas_atualizados
        int total_alertas_velocidade
        string status "SUCESSO / ERRO / PARCIAL"
        text mensagem_erro
        float tempo_execucao_segundos
    }

    ALERTAS {
        int id PK
        string hash_id UK "SHA-256 para Upsert"
        int veiculo_id FK
        int motorista_id FK
        int lote_id FK
        string placa "Indexada"
        string categoria "Indexada"
        string motorista "Indexado"
        string tipo "Indexado"
        string nivel "ALTO / MEDIO / BAIXO"
        float limiar
        float velocidade
        float delta
        float pct
        string duracao_str
        int duracao_segundos
        string logradouro
        string cidade
        string estado
        float latitude
        float longitude
        date data_evento "Indexada"
        string hora_evento
        datetime data_hora "Indexada"
        int hora_inteira "Indexada (0-23)"
        string status
        boolean is_velocidade "Indexado"
        datetime created_at
        datetime updated_at
    }
```

### 7.2. Mecanismo de Upsert Idempotente

Para prevenir duplicação de dados em caso de reimportação de planilhas ou importações incrementais sobrepostas, cada alerta recebe um hash SHA-256 exclusivo calculado a partir de sua assinatura natural:

$$\text{Hash} = \text{SHA256}(\text{Placa} \mid \text{Tipo} \mid \text{Data} \mid \text{Hora} \mid \text{Velocidade} \mid \text{Duração} \mid \text{Lat} \mid \text{Lng})$$

- **Modo `upsert` (Padrão):** Registros com `hash_id` idêntico são atualizados com os dados mais recentes; novos registros são inseridos.
- **Modo `clean_insert` / `replace`:** Limpa a tabela de alertas e reinsere todos os registros higienizados.
- **Auditoria Total:** Cada carga é vinculada a um registro na tabela `lotes_ingestao`, com contadores de linhas lidas, inserções, atualizações e tempo decorrido.

### 7.3. Comandos de Operação (CLI)

```powershell
# Ingestão de nova planilha Excel com modo upsert e exportação automática do dashboard JSON
python ingest.py Historico_Alertas.xlsx --mode upsert --export-json

# Ingestão com banco PostgreSQL personalizado
python ingest.py planilha_semanal.xlsx --db postgresql://usuario:senha@localhost:5432/telemetria

# Execução da suíte de testes unitários e de integração
pytest tests/ -v
```

