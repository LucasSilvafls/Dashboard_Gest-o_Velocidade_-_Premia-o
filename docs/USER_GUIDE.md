# 📘 Manual de Operação e Guia do Usuário

> **Projeto:** Painel de Controle de Velocidade e Telemetria de Frota  
> **Empresa:** Casagrande Locações e Transportes  
> **Público-Alvo:** Gestores de Frota, Supervisores de Operação, Analistas de Telemetria e Técnicos de Segurança do Trabalho (SESMT)  
> **Arquivo Executável:** `dashboard_velocidade.html`  

---

## 1. Como Abrir o Dashboard

O painel foi construído no formato **aplicativo autônomo em arquivo único (`.html`)**:
1. Navegue até a pasta do projeto.
2. Dê um **duplo clique** sobre o arquivo [dashboard_velocidade.html](file:///c:/Users/Administrador/Documents/01 - PROJETOS/Dashboard Velocidades CSG/dashboard_velocidade.html).
3. O painel abrirá instantaneamente em seu navegador padrão (**Google Chrome, Microsoft Edge, Mozilla Firefox, Safari ou Opera**).
4. **Não é necessário instalar nenhum programa, servidor web ou banco de dados.** O painel funciona plenamente mesmo sem conexão com a internet.

---

## 2. Visão Geral da Interface

```
+----------------------------------------------------------------------------------------------------+
|  [LOGO CASAGRANDE]   [Período: 26/09 a 25/10]   [Frota: 35]   [Excessos: 9.051]  [Carregar] [Exportar] [Tema] |
+----------------------------------------------------------------------------------------------------+
|  [1. Resumo Geral]  [2. Ocorrências Graves]  [3. Ranking Frota]  [4. Lista Completa]  [5. Premiação]       |
+----------------------------------------------------------------------------------------------------+
|  FILTROS OPERACIONAIS: [Dia] [Tipo Veículo] [Tipo Excesso] [Placa] [Gravidade] [Motorista Identificado]   |
+----------------------------------------------------------------------------------------------------+
|  6 CARDS DE KPI: [Total Excessos] [Maior Vel] [Média Excesso] [Ocorrências Graves] [Tempo] [Sem ID]       |
+----------------------------------------------------------------------------------------------------+
|  CONTEÚDO DA ABA ATIVA (Gráficos Interativos, Análises Estatísticas, Mapas e Tabelas Dinâmicas)    |
+----------------------------------------------------------------------------------------------------+
```

---

## 3. Cabeçalho Superior e Ações Globais

No topo da página, a barra de controle fixa oferece:
- **Logomarca Dinâmica Casagrande**: Ajusta-se automaticamente com versão para fundo escuro ou fundo claro.
- **Badges de Telemetria da Base**:
  - `Período`: Intervalo de datas abrangido pelas ocorrências.
  - `Frota`: Quantidade de placas distintas identificadas.
  - `Excessos de Velocidade`: Proporção de eventos de velocidade em relação ao total de alertas do arquivo carregado.
- **Botão `Carregar Base`**: Abre a janela para carregar uma nova planilha sem sair do navegador.
- **Botão `Exportar CSV`**: Baixa instantaneamente um arquivo `.csv` contendo exatamente as ocorrências filtradas na tela.
- **Botão `Alternar Tema`**: Alterna entre **Tema Escuro** (recomendado para centrais de monitoramento e redução de fadiga visual) e **Tema Claro** (ideal para impressão de relatórios e ambientes muito iluminados). O sistema salva a sua escolha no navegador.

---

## 4. Barra de Filtros Operacionais com Cascata Inteligente

A barra de filtros permite refinar as 9.051 ocorrências da base. Cada alteração recalcula os 6 KPIs, todos os gráficos e as tabelas em tempo real:

1. **1. Qual o dia?**: Permite isolar um único dia de operação ou visualizar "Todos os dias".
2. **2. Qual o tipo de veículo?**: Filtra pela categoria funcional (`CAVALO`, `CAÇAMBA`, `COMBOIO`, `LEVE`, `MUNK`, `ONIBUS`, `PIPA`).
3. **3. Qual o tipo de excesso de velocidade?**:
   - `Acima do limite da empresa/frota (90 km/h)`: Infrações parametrizadas pelo teto corporativo Casagrande.
   - `Acima da placa da rodovia/via`: Infrações detectadas pelo mapa de velocidade da rodovia (ex: via de 40, 60 ou 80 km/h).
4. **4. Qual o veículo (Placa)?** *(Filtro Dinâmico em Cascata)*:
   - Ao selecionar uma categoria no Filtro 2, o Filtro 4 lista **apenas as placas daquela categoria**, simplificando a localização.
5. **5. Qual a gravidade?**: Filtra por `Gravidade Alta / Crítica` ($\ge 20$ km/h acima), `Média / Alerta` ou `Baixa / Leve`.
6. **6. O motorista se identificou?**:
   - `Sim, bateu o crachá/chaveiro`: Somente infrações com autoria confirmada via iButton.
   - `Não bateu o crachá (Sem ID)`: Infrações anônimas para cobrança e auditoria operacional.
- **Botão `Limpar Filtros`**: Restaura todos os filtros para o padrão original com um único clique.
- **Contador Dinâmico**: Exibe instantaneamente: `EXIBINDO: X DE Y OCORRÊNCIAS`.

---

## 5. Indicadores Executivos (KPI Cards)

Os 6 cartões no topo sintetizam o diagnóstico de segurança da frota:

| Card | O que mede | Significado Operacional |
| :--- | :--- | :--- |
| **Total de Excessos** | Volume total de vezes que o limite foi superado | Mede o volume de desvios comportamentais e o peso relativo no total de alertas. |
| **Maior Velocidade Atingida** | Pico absoluto de velocidade registrado no filtro | Destaca a infração mais perigosa, apontando a placa e a rodovia correspondente. |
| **Média Acima do Permitido** | Velocidade média excedente além da placa/limite | Indica se os excessos são marginais ($+5$ km/h) ou abusivos ($+20$ km/h). |
| **Ocorrências Graves** | Excessos na faixa crítica ($\ge 20$ km/h acima) | Ocorrências com risco iminente de acidente grave, tombamento ou colisão. |
| **Tempo Total Correndo** | Soma de todas as durações dos excessos | Quanto tempo acumulado os veículos rodaram fora dos padrões de segurança. |
| **Sem Condutor Identificado** | Ocorrências sem identificação por chaveiro iButton | Mede o nível de disciplina no uso do crachá eletrônico antes da partida. |

---

## 6. Navegação pelas 5 Abas do Painel

### Aba 1: Resumo Geral e Horários
- **Evolução Diária de Infrações**: Gráfico de linha mostrando picos de infração ao longo do mês.
- **Concentração por Hora do Dia**: Gráfico de barras das 0h às 23h. Identifica os turnos com maior incidência (ex: trocas de turno matutinas ou retornos ao final da tarde).
- **Cartões de Turno**: Segmentação rápida entre Manhã (06h às 12h), Tarde (12h às 18h), Noite (18h às 00h) e Madrugada (00h às 06h).

### Aba 2: Ocorrências Mais Graves e Pontos de Atenção
- **Pareto de Gravidade**: Distribuição entre Baixo, Médio e Alto.
- **Distribuição de Faixas de Excesso**: Quantidade de ocorrências de 1 a 10 km/h, 11 a 20 km/h, 21 a 30 km/h e acima de 30 km/h acima do limite.
- **Ocorrências de Longa Duração (> 10 minutos contínuos)**: Filtro especial de auditoria para identificar condutores que ignoraram os avisos sonoros da cabine por longos trechos.
- **Trechos Viários Críticos**: Ranking das rodovias com maior índice de excessos (ex: MS-436, MS-112, MS-320).

### Aba 3: Ranking de Veículos e Motoristas
- **Top 10 Veículos Mais Infratores**: Gráfico horizontal mostrando as placas mais reincidentes.
- **Top 10 Condutores com Mais Desvios**: Gráfico horizontal com os motoristas identificados que mais cometeram infrações.
- **Tabela Comparativa por Categoria**: Quadro com o total de alertas, placas envolvidas e gravidade média por tipo de veículo (Cavalos, Caçambas, Leves, etc.).

### Aba 4: Lista Completa de Ocorrências
- **Tabela Operacional**: Lista detalhada registro a registro com colunas de Data/Hora, Placa, Categoria, Motorista, Local, Limite, Velocidade, Delta, Duração e Gravidade.
- **Busca Rápida**: Campo de pesquisa instantânea para digitar placa, nome do motorista, CPF ou rodovia.
- **Ordenação por Colunas**: Clique no cabeçalho de qualquer coluna para ordenar de forma crescente ou decrescente.
- **Paginação**: Selecione 25, 50, 100 ou Todas as linhas por página.
- **Modal de Detalhes da Ocorrência**: Ao clicar no botão **"Ver Detalhes"** de qualquer linha:
  - Abre uma janela completa com todos os dados da telemetria.
  - Fornece link direto **"Abrir no Google Maps"**, permitindo ver a localização exata por satélite ou Street View do ponto da infração.

### Aba 5: Premiação Motorista x Caminhão
Módulo exclusivo de governança do **Programa de Bonificação de Direção Segura da Casagrande**:
- **Regra Oficial**: O motorista é considerado **Apto** apenas se **não ultrapassar 80 km/h** em nenhuma condução de caminhões pesados.
- **Seletor de Escopo**:
  - `Apenas Caminhões / Pesados` *(Padrão)*: Avalia apenas as categorias de transporte de carga e pesados (Cavalo, Caçamba, Comboio, Pipa, Munk).
  - `Toda a Frota (Todos)`: Inclui veículos leves no cálculo.
- **Filtro de Status**: Exibe `Todos`, apenas os `🏆 Aptos (≤ 80 km/h)` ou apenas os `❌ Inaptos (> 80 km/h)`.
- **Simulador de Teto**: Permite alternar entre o teto oficial de **80 km/h** e simulações com **85 km/h** ou **90 km/h** para estudos de sensibilidade pelo RH e diretoria.
- **Tabela de Apuração**: Lista cada condutor com sua maior velocidade registrada, quantidade de violações, caminhões conduzidos e status final.
- **Dossiê Completo de Auditoria**: Ao clicar em **"Ver Dossiê"** na linha de um motorista:
  - Abre um relatório individual completo.
  - Exibe o histórico de todas as viagens e excessos ordenados do mais veloz para o menor.
  - Possui o botão **"Imprimir Dossiê"** (`Ctrl + P`) formatado especificamente para anexar ao processo de pagamento de bonificação ou termo de advertência.

---

## 7. Como Carregar uma Nova Base de Dados (Upload)

Quando o gestor receber uma nova exportação semanal ou mensal de telemetria:

1. No cabeçalho superior do dashboard, clique no botão **`Carregar Base`**.
2. A janela de upload será exibida:
   - Arraste o arquivo para a área demarcada **OU** clique sobre ela para selecionar o arquivo no computador.
3. **Formatos Suportados:**
   - `.csv`, `.tsv`, `.txt` (delimitados por ponto-e-vírgula, vírgula ou tabulação).
   - `.xlsx`, `.xls`, `.xlsm`, `.xlsb`, `.ods` (planilhas do Microsoft Excel e LibreOffice).
   - `.json` (arquivos gerados pelo script `generate_data.py`).
4. O sistema processará o arquivo diretamente no navegador em poucos segundos.
5. Os KPIs, gráficos, tabelas e módulos de premiação serão atualizados imediatamente com os novos dados.

---

## 8. Dicas e Boas Práticas Operacionais

> [!TIP]
> **Reuniões Semanais de DDS (Diálogo Diário de Segurança):**
> Utilize a **Aba 2 (Pontos de Atenção)** e a **Aba 3 (Ranking)** projetadas em tela para apresentar à equipe as curvas de melhoria e as rodovias que exigem maior cautela.

> [!IMPORTANT]
> **Auditoria de Motoristas Sem Identificação:**
> Na barra de filtros, selecione `6. O motorista se identificou? -> Não bateu o crachá`. Analise os veículos reincidentes e solicite aos encarregados de frente de obra a verificação dos chaveiros iButton e leitores dos tacógrafos.

> [!NOTE]
> **Fechamento Mensal da Premiação:**
> Acesse a **Aba 5**, verifique o escopo `Apenas Caminhões / Pesados` com teto em `80 km/h`. Clique em **"Exportar Relatório Premiação (CSV)"** para enviar a listagem oficial consolidada ao departamento de Recursos Humanos.
