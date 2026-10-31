# Arquitetura Primária Web com Exportação Executável Offline

Adotamos a aplicação cliente-servidor (FastAPI + banco relacional SQLite) como a plataforma primária e fonte da verdade para o processamento de dados e cálculo de indicadores de telemetria, mantendo a capacidade de gerar e exportar relatórios executivos em HTML autônomo offline-first para atendimento à diretoria e operações remotas.

## Contexto
O projeto continha uma duplicidade estrutural: um arquivo monólito HTML autônomo de 4.600 linhas com processamento em memória no navegador via SheetJS/PapaParse, coexistindo com um backend completo em FastAPI e banco SQLite. Essa dualidade gerava risco de divergência no cálculo de métricas de telemetria e sobrecarga no navegador em bases volumosas.

## Decisão
1. **Fonte da Verdade**: Toda a lógica de limpeza de planilhas, regras de negócio e cálculo de conformidade da Premiação de Direção Segura é centralizada no pipeline Python/FastAPI.
2. **Plataforma Primária**: Aplicação Web conectada à API RESTful, com autenticação, filtros paginados e banco de dados relacional para uso diário da equipe técnica, SESMT e supervisão.
3. **Versão Offline Preservada**: Um processo de build/exportação automatizado gera o artefato HTML executável de arquivo único (incorporando dados e assets em Base64) sob demanda para distribuição externa ou diretoria.

## Consequências
- A lógica de negócio é unificada em um único ponto, eliminando discrepâncias entre o que é processado no backend e o que era calculado via scripts JS no frontend.
- O frontend pode ser modularizado e testado de forma desacoplada sem perder a compatibilidade com a entrega em arquivo único.
