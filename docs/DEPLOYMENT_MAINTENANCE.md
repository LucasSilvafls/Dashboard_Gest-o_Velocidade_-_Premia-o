# ⚙️ Guia de Implantação, Atualização e Manutenção

> **Projeto:** Painel de Controle de Velocidade e Telemetria de Frota  
> **Empresa:** Casagrande Locações e Transportes  
> **Público:** Desenvolvedores, Engenheiros de Dados e Administradores de TI  

---

## 1. Pré-Requisitos de Ambiente

Para executar os scripts de ETL e compilação do dashboard, certifique-se de que o ambiente possui:

- **Python 3.10 ou superior** instalado no sistema.
- **Gerenciador de pacotes `pip`**.
- Pacote **`pandas`** instalado:
  ```bash
  pip install pandas
  ```
- Nenhum banco de dados ou servidor web é necessário.

---

## 2. Estrutura de Arquivos do Projeto

```
Dashboard Velocidades CSG/
├── README.md                      # Sumário executivo e guia geral do projeto
├── GLOSSARY.md                    # Glossário de termos e regras de negócio
├── pytest.ini                     # Configuração da suíte de testes
├── .gitignore                     # Filtro de arquivos temporários
├── server.py                      # Inicializador da API RESTful (uvicorn backend.main:app)
├── ingest.py                      # Ponto de entrada CLI para ingestão de planilhas
├── build_dashboard_html.py        # Compilador rápido do HTML autossuficiente
├── dashboard_template.html        # Template desacoplado com injeção limpa
├── dashboard_velocidade.html      # ARTEFATO FINAL: Aplicação SPA pronta para uso offline
├── telemetria.db                  # Banco de dados relacional SQLite oficial
│
├── backend/                       # Camada de API RESTful (FastAPI, JWT, RBAC)
├── data/                          # Repositório de dados operacionais
│   ├── Historico_Alertas.xlsx     # Planilha Excel oficial da telemetria
│   ├── Historico_Alertas.csv      # Base em formato CSV para exportações
│   └── dashboard_data.json        # Payload estruturado JSON sincronizado
├── database/                      # Modelos ORM e repositório de consultas
├── frontend/                      # Arquitetura modular do Dashboard SPA
│   ├── assets/                    # Logotipos da Casagrande (claro e escuro)
│   ├── components/                # Abas e modais HTML desacoplados
│   ├── css/                       # Design System e tokens de estilização
│   ├── js/                        # Módulos JS de gráficos, filtros e auditoria
│   └── index.html                 # Master template
├── ingestion/                     # Pipeline ETL robusto com upsert idempotente
├── scripts/                       # Ferramentas auxiliares e migrações
│   └── generate_data.py           # Gerador direto de JSON a partir de CSV
├── tests/                         # Suíte com 78 testes automatizados
├── uploads/                       # Diretório protegido para recepção de uploads
└── docs/                          # Documentações técnicas e manuais de operação
```

---

## 3. Procedimento de Atualização Periódica dos Dados

Sempre que a equipe de telemetria emitir uma nova exportação semanal ou mensal:

### Método Recomendado: Via CLI de Ingestão Integrada
Coloque a nova planilha na pasta `data/` (ex: `data/Historico_Alertas.xlsx`) e execute:
```powershell
python ingest.py data/Historico_Alertas.xlsx --mode upsert --export-json
```

### Método Alternativo: Via Script Standalone
Se desejar gerar o payload JSON diretamente a partir de um arquivo CSV bruto sem acionar o banco relacional:
```powershell
python scripts/generate_data.py
```
*Ou especificando o nome do arquivo diretamente:*
```powershell
python scripts/generate_data.py data/Telemetria_Novembro.csv
```

**Saída esperada no terminal:**
```
Building Controle_Velocidade_CSG dataset with vehicle category support...
Loaded 16067 total alerts from Historico_Alertas.csv
Extracted 9051 speed excess alerts.
Dataset generated: 9051 speed records across 35 vehicles, 7 categories, 21 drivers.
Categories and plate count:
  CAVALO: 4725 speed alerts, 9 vehicles
  CAÇAMBA: 1264 speed alerts, 9 vehicles
  COMBOIO: 412 speed alerts, 2 vehicles
  LEVE: 1980 speed alerts, 10 vehicles
  MUNK: 89 speed alerts, 1 vehicles
  ONIBUS: 56 speed alerts, 1 vehicles
  PIPA: 525 speed alerts, 4 vehicles
dashboard_data.json created successfully!
```

### Passo 3: Compilar o Novo Dashboard HTML
Execute o construtor do artefato final:
```powershell
python build_dashboard_html.py
```

**Saída esperada:**
```
Building Controle_Velocidade_CSG HTML (Speed Dashboard with Vehicle Category & Plate Cascading)...
dashboard_velocidade.html generated successfully!
```

O arquivo `dashboard_velocidade.html` estará atualizado com os novos dados embutidos.

---

## 4. Atualização Dinâmica Direta no Navegador (Sem Scripts)

Para analistas de frota que não utilizam o terminal Python:
1. Abra o arquivo `dashboard_velocidade.html` existente.
2. Clique no botão **`Carregar Base`** no topo direito.
3. Arraste a nova planilha (`.csv`, `.xlsx`, `.ods`).
4. O navegador processará a nova base em memória RAM e recalculará o painel imediatamente.

---

## 5. Estratégias de Distribuição e Hospedagem

O dashboard pode ser distribuído de três formas:

### Opção A: Distribuição Local / Offline (Sem Internet)
- Basta enviar o arquivo `dashboard_velocidade.html` por e-mail, pen drive ou Teams.
- O destinatário só precisa dar duplo clique no arquivo para abrir.

### Opção B: Servidor de Rede Interna (Intranet / Pasta Compartilhada)
- Coloque o arquivo `dashboard_velocidade.html` em uma pasta de rede compartilhada da Casagrande (ex: `\\servidor\frotas\dashboard_velocidade.html`).
- Todos os usuários com permissão de leitura poderão abri-lo simultaneamente.

### Opção C: Hospedagem Estática na Web (Nuvem Corporativa)
Como o projeto é estático (apenas HTML, CSS e JS):
- Pode ser publicado no **GitHub Pages**, **AWS S3 com CloudFront**, **Cloudflare Pages** ou **Firebase Hosting** com custo praticamente zero e acesso protegido por VPN/SSO corporativo.

---

## 6. Resolução de Problemas (Troubleshooting)

### Problema 1: Acentos aparecem corrompidos na importação
- **Causa:** O sistema de telemetria exportou em ANSI/Windows-1252, mas o leitor esperava UTF-8.
- **Solução:** O script `generate_data.py` já testa automaticamente `cp1252`, `latin1` e `utf-8`. Se você estiver importando via navegador, salve a planilha como **CSV UTF-8** no Excel antes de carregar.

### Problema 2: Novos veículos ou categorias não aparecem
- **Causa:** O arquivo CSV bruto não possui a coluna `CATEGORIA` preenchida para aquelas linhas.
- **Solução:** O script categoriza automaticamente registros sem categoria como `"Não Classificado"`. Para classificá-los, preencha a coluna `CATEGORIA` no CSV antes de rodar o `generate_data.py`.

### Problema 3: Substituição do Logotipo
- Se a logomarca da Casagrande for alterada, substitua os arquivos em `frontend/assets/logo_casagrande.png` e `frontend/assets/logo_casagrande_dark.png` e execute novamente `python build_dashboard_html.py`.
