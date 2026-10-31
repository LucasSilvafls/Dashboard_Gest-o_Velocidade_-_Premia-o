# Modularização do Frontend e Carregamento Sob Demanda

Adotamos a decomposição do monólito HTML/JS/CSS em uma arquitetura modular de componentes dentro do diretório `frontend/`, implementando carregamento assíncrono paginado no modo Web e preservando um pipeline de build para geração do artefato autônomo de arquivo único.

## Contexto
O frontend original concentrava mais de 4.600 linhas em um único arquivo de template (`dashboard_template.html`), misturando regras de autenticação, montagem de gráficos Chart.js, paginação de tabelas, simulação de premiação e renderização DOM, além de injetar um payload estático de 7.3 MB (`dashboard_data.json`) na inicialização. Isso dificultava a manutenção, aumentava a latência de carregamento da página e impedia testes modulares de interface.

## Decisão
1. **Estrutura Modular**: O código de apresentação é particionado em `frontend/` com:
   - Componentes HTML estruturais divididos por aba (`overview`, `critical_points`, `rankings`, `occurrences`, `premiacao`, `unidentified_audit`, `admin`).
   - Módulos JavaScript com responsabilidades únicas (`api.js`, `auth.js`, `charts.js`, `filters.js`, `premiacao.js`, `audit.js`, `users.js`).
   - Folhas de estilo segregadas por design tokens industriais e classes utilitárias.
2. **Carregamento Otimizado**: No modo Web conectado, o cliente consome os endpoints assíncronos (`/api/dashboard/summary`, `/api/dashboard/alerts`, `/api/dashboard/rankings`) com paginação e ordenação no servidor, reduzindo o tempo de carregamento inicial.
3. **Compilador Unificado**: Um script de build em Python (`build_dashboard_html.py`) compila os módulos em `dashboard_velocidade.html`, garantindo compatibilidade estrita com a suíte de testes existente e suporte à distribuição offline.

## Consequências
- A base de código do frontend torna-se manutenível e extensível, com arquivos focados e de tamanho reduzido.
- A aplicação Web ganha velocidade de carregamento (de segundos para milissegundos na primeira visualização).
- Mantém-se 100% de retrocompatibilidade com os endpoints que servem a aplicação e os 75 testes automatizados.
