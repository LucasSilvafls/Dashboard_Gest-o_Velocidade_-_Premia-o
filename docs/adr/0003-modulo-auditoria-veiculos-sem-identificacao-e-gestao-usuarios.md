# Módulo de Auditoria de Veículos Sem Identificação e Gestão de Usuários

Instituímos a segregação operacional das ocorrências de telemetria sem identificação de condutor (iButton) em uma aba analítica dedicada de auditoria para a supervisão de frota, e a integração visual do gerenciamento de usuários com controle de acesso (RBAC) no painel administrativo.

## Contexto
Durante a operação rodoviária da Casagrande, veículos operam ocasionalmente sem o acoplamento do chaveiro eletrônico iButton. No modelo anterior, esses desvios eram apenas descartados da apuração da premiação com uma nota de rodapé, sem fornecer aos encarregados operacionais ferramentas analíticas para identificar placas reincidentes, frentes de obra críticas e horários de evasão do crachá. Além disso, a gestão de usuários do sistema dependia de chamadas manuais de API ou comandos de terminal no banco de dados.

## Decisão
1. **Aba 6 - Auditoria de Veículos Sem Identificação**: Criar um módulo analítico exclusivo para fiscalização de condução anônima, apresentando volume de desvios, ranking de placas mais reincidentes, picos de velocidade sem identificação, mapa de horários/turnos críticos e exportação de dossiê para responsabilização dos encarregados de frente.
2. **Aba 7 - Gestão de Usuários (RBAC)**: Integrar a interface administrativa diretamente aos endpoints `/auth/users` para listagem de contas ativas e formulário de cadastro de novos usuários com papéis estritos (`admin` e `viewer`).
3. **Reatividade Instantânea pós-Upload**: Eliminar a necessidade de recarregamento manual da página (F5) após a ingestão de novas planilhas, disparando um evento global de sincronização reativa que atualiza os gráficos e tabelas em tempo real.

## Consequências
- A gerência de operações e o SESMT ganham visibilidade imediata sobre o cumprimento do procedimento de identificação por iButton.
- A governança de segurança do trabalho se fortalece, cobrando responsabilidades pontuais sem macular o mérito dos motoristas elegíveis na premiação.
- A administração de acessos da plataforma passa a ser 100% autossuficiente via interface gráfica.
