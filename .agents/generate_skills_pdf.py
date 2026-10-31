import os
import subprocess
import sys

output_html = os.path.abspath("Guia_de_Skills_CSG.html")
output_pdf = os.path.abspath("Guia_de_Skills_CSG.pdf")

sections = [
    {
        "title": "1. Design & Desenvolvimento Frontend",
        "icon": "🎨",
        "color": "#3b82f6",
        "skills": [
            {
                "name": "uiux-designer",
                "tag": "Design System & UI",
                "desc": "Guia e catálogo completo de UI/UX com mais de 50 estilos visuais, 97 paletas harmoniosas e 57 combinações tipográficas. Excelente para estruturar interfaces profissionais em React, Next.js, Dashboards e aplicações analíticas.",
                "when": "Ao criar ou reestilizar telas, escolher paletas de cores, definir fontes e garantir consistência visual no Dashboard."
            },
            {
                "name": "design-taste-frontend",
                "tag": "Anti-Slop Art Direction",
                "desc": "Direção de arte premium (tasteskill v2) baseada no estudo de 247 sites premiados pelo Awwwards e One Page Love. Elimina o visual genérico e padronizado gerado por IAs, inspecionando a página em navegador real e refinando a estética iterativamente.",
                "when": "Quando um layout parecer genérico, amador ou com 'cara de template de IA', ou ao desenhar landing pages e telas de alto impacto."
            },
            {
                "name": "frontend-expert",
                "tag": "React / TypeScript",
                "desc": "Especialista em React e TypeScript moderno. Implementa padrões de alta performance como React Suspense, useSuspenseQuery, lazy loading, TanStack Router, estilização com MUI v7 e otimização de renderização.",
                "when": "Ao programar componentes complexos, gerenciar dados assíncronos ou resolver gargalos de performance no frontend."
            },
            {
                "name": "prototype",
                "tag": "Prototipagem Rápida",
                "desc": "Constrói protótipos descartáveis e funcionais em poucos minutos para responder perguntas de arquitetura, fluxo de usuário ou viabilidade de interface sem comprometer a base de código principal.",
                "when": "Para testar rapidamente uma ideia de tela, validar um modelo de estado ou experimentar uma nova biblioteca."
            }
        ]
    },
    {
        "title": "2. Planejamento, Entrevistas & Especificação",
        "icon": "📋",
        "color": "#8b5cf6",
        "skills": [
            {
                "name": "grill-me",
                "tag": "Validação de Plano",
                "desc": "Entrevista incisiva e sem rodeios para estressar e amadurecer um plano, design técnico ou ideia antes de qualquer linha de código ser escrita. Identifica furos conceituais e cenários de borda.",
                "when": "Antes de iniciar uma grande refatoração ou funcionalidade, para garantir que todas as premissas estão corretas."
            },
            {
                "name": "grill-with-docs",
                "tag": "Planejamento com ADRs",
                "desc": "Conduz o interrogatório desafiador do grill-me enquanto documenta simultaneamente as decisões tomadas em registros de decisão de arquitetura (ADRs) e no glossário de termos.",
                "when": "Para planejar sistemas críticos onde o registro formal das decisões arquiteturais e do domínio precisa ficar documentado."
            },
            {
                "name": "grilling",
                "tag": "Teste de Estresse",
                "desc": "Desafia agressivamente o usuário ou plano proposto contra premissas falhas, trade-offs não avaliados e complexidade acidental.",
                "when": "Sempre que você quiser que suas ideias sejam colocadas à prova sob a ótica mais crítica possível."
            },
            {
                "name": "loop-me",
                "tag": "Design de Workflows",
                "desc": "Processo de entrevista voltado para mapear detalhadamente os fluxos de trabalho (workflows) e interações que precisam ser construídos no repositório.",
                "when": "Para desenhar processos de ponta a ponta e garantir clareza nas etapas operacionais antes da codificação."
            },
            {
                "name": "to-spec",
                "tag": "Geração de Spec",
                "desc": "Transforma o conteúdo de uma sessão ou conversa em uma especificação técnica formal completa, pronta para publicação no gerenciador de tarefas do projeto.",
                "when": "Após discutir uma funcionalidade e precisar convertê-la em uma especificação detalhada de produto/engenharia."
            },
            {
                "name": "to-tickets",
                "tag": "Decomposição em Tarefas",
                "desc": "Quebra uma especificação ou plano complexo em pequenos tickets operacionais (*tracer bullets*), explicitando dependências bloqueantes entre cada um.",
                "when": "Para transformar uma especificação técnica em um backlog acionável e ordenado para implementação."
            },
            {
                "name": "to-questionnaire",
                "tag": "Resolução de Incertezas",
                "desc": "Converte decisões pendentes ou perguntas em aberto que você não consegue responder no momento em um questionário estruturado para outros participantes da equipe.",
                "when": "Ao encontrar bloqueios de negócio ou decisões que dependem de outros desenvolvedores ou gestores."
            },
            {
                "name": "wayfinder",
                "tag": "Mapeamento de Épicos",
                "desc": "Mapeia projetos gigantescos que excedem uma única sessão de agente em um grafo de decisões e tickets rastreáveis, destravando um por um até o destino final.",
                "when": "Para grandes empreitadas de engenharia, migrações completas ou módulos inteiros."
            }
        ]
    },
    {
        "title": "3. Arquitetura & Modelagem de Domínio",
        "icon": "🏛️",
        "color": "#0ea5e9",
        "skills": [
            {
                "name": "codebase-design",
                "tag": "Deep Modules",
                "desc": "Princípios e vocabulário formal de design de software para criar 'módulos profundos' (*deep modules*): interfaces públicas enxutas com implementações robustas e bem encapsuladas.",
                "when": "Ao desenhar interfaces públicas de módulos, definir fronteiras de pacotes e tornar o código altamente testável."
            },
            {
                "name": "domain-modeling",
                "tag": "Linguagem Ubíqua",
                "desc": "Constrói e preserva a precisão do modelo de domínio no projeto, mantendo os arquivos GLOSSARY.md e ADRs perfeitamente alinhados à terminologia do negócio.",
                "when": "Ao introduzir novos conceitos de domínio ou evitar discrepâncias de nomenclatura entre o código e as regras de negócio."
            },
            {
                "name": "improve-codebase-architecture",
                "tag": "Auditoria de Arquitetura",
                "desc": "Analisa minuciosamente a base de código em busca de oportunidades de encapsulamento, exibe um relatório visual interativo em HTML e permite aprofundar nas prioridades escolhidas.",
                "when": "Para fazer um raio-x arquitetural da aplicação e planejar melhorias estruturais de médio prazo."
            },
            {
                "name": "setup-ts-deep-modules",
                "tag": "Governança de Imports",
                "desc": "Configura o dependency-cruiser no repositório TypeScript para assegurar que cada módulo oculte seus detalhes internos e seja acessado exclusivamente por seus arquivos de entrada (index).",
                "when": "Para impedir acoplamentos indevidos e importações circulares em projetos TypeScript."
            }
        ]
    },
    {
        "title": "4. Implementação, Testes & Depuração",
        "icon": "⚡",
        "color": "#10b981",
        "skills": [
            {
                "name": "implement",
                "tag": "Execução de Tarefas",
                "desc": "Executa a codificação passo a passo baseando-se em uma especificação aprovada ou em um conjunto de tickets, garantindo aderência rigorosa ao escopo delimitado.",
                "when": "Para codificar funcionalidades definidas com precisão e sem inventar escopo adicional."
            },
            {
                "name": "implement-spec",
                "tag": "Execução de Spec",
                "desc": "Implementação automática e estruturada dos artefatos gerados especificamente pelas skills /to-spec e /to-tickets.",
                "when": "Imediatamente após rodar a geração de specs e tickets para iniciar a entrega de código."
            },
            {
                "name": "tdd",
                "tag": "Test-Driven Development",
                "desc": "Desenvolvimento guiado por testes seguindo com rigor a disciplina Red-Green-Refactor. Garante testes unitários e de integração confiáveis desde o primeiro minuto.",
                "when": "Ao criar lógicas de cálculo, transformações de dados ou algoritmos onde a corretude é primordial."
            },
            {
                "name": "diagnosing-bugs",
                "tag": "Depuração Sistemática",
                "desc": "Metodologia estruturada para isolamento de defeitos difíceis, reprodução mínima, análise de hipóteses e eliminação definitiva de regressões e falhas de runtime.",
                "when": "Sempre que um erro inesperado, exceção silenciosa ou gargalo de lentidão for identificado."
            },
            {
                "name": "migrate-to-shoehorn",
                "tag": "Segurança de Tipos em Testes",
                "desc": "Migra asserções de tipo inseguras ('as Type') em arquivos de teste para a biblioteca utilitária @total-typescript/shoehorn, mantendo os dados parciais com checagem segura do TypeScript.",
                "when": "Para limpar mocks frágeis em testes e elevar a confiabilidade da suíte de testes TypeScript."
            },
            {
                "name": "scaffold-exercises",
                "tag": "Criação de Exercícios",
                "desc": "Gera estruturas completas para exercícios práticos com seções, problemas, soluções automatizadas e notas explicativas com conformidade de lint.",
                "when": "Para criar material de treino, tutoriais internos ou desafios técnicos no projeto."
            }
        ]
    },
    {
        "title": "5. Revisão de Código, Git & Workflows de Equipe",
        "icon": "🔍",
        "color": "#f59e0b",
        "skills": [
            {
                "name": "code-review",
                "tag": "Revisão Dual",
                "desc": "Revisa as alterações de uma branch ou commit disparando duas análises especializadas em paralelo: 'Standards' (padrões de engenharia e estilo do repo) e 'Spec' (fidelidade aos requisitos solicitados).",
                "when": "Antes de abrir um PR ou antes de mesclar alterações críticas para garantir alta qualidade."
            },
            {
                "name": "pr",
                "tag": "Documentação de PR",
                "desc": "Gera corpos de Pull Requests profissionais, com sumário executivo das mudanças, motivações, checklist de validação e impactos.",
                "when": "Ao finalizar uma funcionalidade e preparar o Pull Request para submissão no GitHub/GitLab."
            },
            {
                "name": "git-guardrails-claude-code",
                "tag": "Segurança no Git",
                "desc": "Configura proteções e hooks para barrar comandos destrutivos no Git (como push forçado, git reset --hard ou deleção acidental de branches).",
                "when": "Para proteger repositórios importantes contra comandos destrutivos executados por agentes autônomos ou acidentalmente."
            },
            {
                "name": "setup-pre-commit",
                "tag": "Automação Pré-Commit",
                "desc": "Configura e padroniza hooks com Husky e lint-staged (Prettier, ESLint, checagem de tipos tsc e execução dos testes pertinentes aos arquivos alterados).",
                "when": "Para garantir que nenhum commit quebre o build ou fuja das regras de formatação do time."
            },
            {
                "name": "triage",
                "tag": "Triagem de Demandas",
                "desc": "Conduz issues e PRs externos através de uma máquina de estados: categorização, verificação técnica, validação de bugs e elaboração de briefs prontos para execução por agentes.",
                "when": "Para organizar filas de issues, chamados de usuários ou contribuições externas de forma padronizada."
            },
            {
                "name": "retro",
                "tag": "Retrospectiva de Sessão",
                "desc": "Facilita uma retrospectiva técnica e operacional ao final de uma sessão de programação, avaliando o que funcionou, lições aprendidas e próximos passos.",
                "when": "Ao concluir marcos relevantes ou após sessões intensas de pareamento."
            }
        ]
    },
    {
        "title": "6. Orquestração, Handoff & Navegação de Agentes",
        "icon": "🤖",
        "color": "#ec4899",
        "skills": [
            {
                "name": "ask-matt",
                "tag": "Roteador de Skills",
                "desc": "Funciona como um guia inteligente sobre o repositório, indicando exatamente qual skill ou fluxo de trabalho é mais adequado para o desafio que você tem em mãos.",
                "when": "Quando estiver em dúvida sobre qual comando, skill ou abordagem adotar a seguir."
            },
            {
                "name": "chief-of-staff",
                "tag": "Coordenação de Subagentes",
                "desc": "Atua como coordenador de longo prazo para metas complexas em uma única sessão, orquestrando subagentes especialistas e garantindo alinhamento de escopo.",
                "when": "Para tarefas multidisciplinares de longa duração que exigem múltiplos papéis."
            },
            {
                "name": "claude-handoff",
                "tag": "Transição em Background",
                "desc": "Passa o trabalho e contexto da conversa atual para um novo agente em segundo plano, que assume a continuidade imediatamente sem perda de foco.",
                "when": "Para delegar execuções assíncronas longas ou passar o bastão para outra instância de agente."
            },
            {
                "name": "handoff",
                "tag": "Resumo de Transição",
                "desc": "Sintetiza e compacta o estado da conversa e do código em um documento conciso de transição, pronto para ser lido e continuado por qualquer outro agente posteriormente.",
                "when": "Ao terminar seu turno de trabalho ou antes de reiniciar o contexto da IA."
            },
            {
                "name": "wait-what",
                "tag": "Recalibragem de Resposta",
                "desc": "Interrompe a linha atual quando uma explicação ou proposta do agente não fez sentido, instruindo-o a repensar a abordagem e reexplicar sob outro ângulo.",
                "when": "Quando o assistente fornecer uma resposta confusa, prolixa ou desalinhada com a realidade do projeto."
            },
            {
                "name": "wizard",
                "tag": "Assistente Interativo",
                "desc": "Gera scripts interativos de terminal em bash para guiar o desenvolvedor passo a passo em tarefas manuais sensíveis que apenas humanos podem fazer (configurar chaves secretas, infra, etc.).",
                "when": "Para provisionar serviços na nuvem, lidar com autenticações manuais ou migrações delicadas de banco."
            },
            {
                "name": "research",
                "tag": "Pesquisa Aprofundada",
                "desc": "Investiga perguntas técnicas contra fontes primárias de alta confiabilidade (documentações oficiais, especificações) e registra os achados em Markdown no repositório.",
                "when": "Para pesquisar APIs desconhecidas, comparar soluções técnicas ou embasar decisões de design."
            },
            {
                "name": "teach",
                "tag": "Ensino Contextualizado",
                "desc": "Ensina novas técnicas, conceitos de engenharia ou detalhes de bibliotecas de forma pedagógica e adaptada ao código específico do seu projeto.",
                "when": "Quando quiser entender a fundo um padrão arquitetural, biblioteca ou conceito moderno de programação."
            },
            {
                "name": "setup-matt-pocock-skills",
                "tag": "Setup de Ecossistema",
                "desc": "Prepara a infraestrutura básica do repositório para o ecossistema de engenharia: configura diretórios de documentação, templates e convenções de labels.",
                "when": "Executado na inicialização do repositório para habilitar todas as demais skills de engenharia."
            }
        ]
    },
    {
        "title": "7. Escrita & Documentação Técnica",
        "icon": "✍️",
        "color": "#14b8a6",
        "skills": [
            {
                "name": "writing-for-agents",
                "tag": "Instruções para IAs",
                "desc": "Diretrizes especializadas para redigir ou aprimorar arquivos de instruções consumidos por agentes de inteligência artificial (como AGENTS.md, CLAUDE.md ou novas skills).",
                "when": "Ao criar ou customizar novas skills ou regras comportamentais para o assistente."
            },
            {
                "name": "writing-fragments",
                "tag": "Fase Exploratória",
                "desc": "Fase 1 do fluxo de redação: extrai e agrupa fragmentos brutos, insights dispersos e notas sem preocupação imediata com formatação ou ordem final.",
                "when": "No início do processo de escrita técnica, reunindo ideias e referências soltas."
            },
            {
                "name": "writing-beats",
                "tag": "Fase de Estruturação",
                "desc": "Fase 2 do fluxo de redação: organiza os fragmentos em uma sequência lógica de 'batidas narrativas' (beats), assegurando que cada conceito seja definido antes de ser utilizado.",
                "when": "Para estruturar artigos, documentações de produtos ou tutoriais técnicos com progressão lógica impecável."
            },
            {
                "name": "writing-shape",
                "tag": "Fase de Redação Final",
                "desc": "Fase 3 do fluxo de redação: transforma a estrutura de batidas no artigo final completo, escrevendo parágrafo por parágrafo com coesão e clareza.",
                "when": "Para polir e finalizar artigos, manuais e guias oficiais para publicação."
            }
        ]
    },
    {
        "title": "8. Skills de Plataforma & Ferramentas Globais",
        "icon": "🌐",
        "color": "#6366f1",
        "skills": [
            {
                "name": "chrome-devtools & a11y-debugging",
                "tag": "DevTools & Acessibilidade",
                "desc": "Conexão direta com o navegador via MCP: inspeção de DOM, análise de rede, depuração de erros em tempo real e auditoria de acessibilidade (WCAG, contrastes e ARIA).",
                "when": "Para depurar visualmente a aplicação e validar acessibilidade em testes com o navegador real."
            },
            {
                "name": "modern-web-guidance",
                "tag": "Web Standards",
                "desc": "Repositório de melhores práticas modernas para HTML, CSS e JavaScript: View Transitions, Container Queries, seletores :has, otimização de renderização e APIs Web recentes.",
                "when": "Sempre que estiver construindo componentes de frontend para evitar práticas legadas ou obsoletas."
            },
            {
                "name": "debug-optimize-lcp & memory-leak",
                "tag": "Performance & Core Web Vitals",
                "desc": "Diagnóstico de Core Web Vitals (Largest Contentful Paint) e detecção de vazamentos de memória (heap snapshots) em aplicações JavaScript.",
                "when": "Para resolver páginas lentas, melhorar métricas de carregamento ou investigar travamentos de memória."
            },
            {
                "name": "firebase-* (Firestore, Rules, Hosting)",
                "tag": "Serviços de Nuvem",
                "desc": "Conjunto de automações para ecossistema Firebase: modelagem de coleções Firestore, autoria de regras de segurança rigorosas (firestore.rules) e deploy em Hosting.",
                "when": "Ao integrar ou manter bancos de dados em nuvem, regras de segurança e deploys estáticos."
            }
        ]
    }
]

html = f'''<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Catálogo Completo de Skills - Dashboard Velocidades CSG</title>
<style>
  @page {{
    size: A4;
    margin: 16mm 14mm 16mm 14mm;
  }}
  @media print {{
    body {{
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }}
    .avoid-break {{
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }}
    .page-break {{
      page-break-before: always !important;
    }}
  }}

  * {{
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }}

  body {{
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: #1e293b;
    background-color: #ffffff;
    line-height: 1.45;
    font-size: 11.5px;
  }}

  .header-card {{
    background: linear-gradient(135deg, #090d16 0%, #1e293b 100%);
    color: #ffffff;
    padding: 22px 24px;
    border-radius: 12px;
    margin-bottom: 20px;
    border: 1px solid #334155;
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  }}

  .badge-banner {{
    display: inline-block;
    padding: 3px 10px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    border-radius: 20px;
    background-color: rgba(59, 130, 246, 0.25);
    color: #93c5fd;
    border: 1px solid rgba(59, 130, 246, 0.4);
    margin-bottom: 8px;
  }}

  h1 {{
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.4px;
    color: #f8fafc;
    margin-bottom: 4px;
  }}

  .subtitle {{
    font-size: 12px;
    color: #94a3b8;
    margin-bottom: 14px;
  }}

  .meta-grid {{
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    padding-top: 12px;
    border-top: 1px solid #334155;
  }}

  .meta-item {{
    font-size: 10px;
    color: #94a3b8;
  }}
  .meta-item strong {{
    display: block;
    font-size: 12px;
    color: #f1f5f9;
    margin-top: 1px;
  }}

  .category-container {{
    margin-bottom: 18px;
  }}

  .category-title {{
    font-size: 14px;
    font-weight: 700;
    color: #0f172a;
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    padding-bottom: 5px;
    border-bottom: 2px solid #e2e8f0;
  }}

  .category-icon {{
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    color: white;
    font-size: 12px;
    font-weight: bold;
  }}

  .skills-grid {{
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }}

  .skill-card {{
    background-color: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 7px;
    padding: 10px 14px;
    break-inside: avoid;
    page-break-inside: avoid;
    border-left: 4px solid #cbd5e1;
  }}

  .skill-header {{
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }}

  .skill-name {{
    font-size: 13px;
    font-weight: 700;
    color: #1e3a8a;
    font-family: 'Consolas', 'Menlo', 'Monaco', monospace;
  }}

  .skill-tag {{
    font-size: 9.5px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 4px;
    background: #e0f2fe;
    color: #0369a1;
    border: 1px solid #bae6fd;
  }}

  .skill-desc {{
    color: #334155;
    font-size: 11.5px;
    line-height: 1.4;
  }}

  .skill-when {{
    margin-top: 5px;
    padding-top: 5px;
    border-top: 1px dashed #cbd5e1;
    font-size: 10.5px;
    color: #64748b;
  }}
  .skill-when strong {{
    color: #334155;
  }}

  .footer-box {{
    margin-top: 20px;
    padding: 12px 16px;
    border-radius: 8px;
    background-color: #f8fafc;
    border: 1px solid #cbd5e1;
    border-left: 4px solid #3b82f6;
    font-size: 11px;
    color: #475569;
    break-inside: avoid;
    page-break-inside: avoid;
  }}
  .footer-box h4 {{
    color: #0f172a;
    font-size: 12px;
    margin-bottom: 4px;
  }}
</style>
</head>
<body>

  <div class="header-card">
    <div class="badge-banner">Referência Técnica Permanente</div>
    <h1>Catálogo de Skills & Engenharia</h1>
    <div class="subtitle">Dashboard Velocidades CSG &bull; Conjunto de Ferramentas, Agentes e Metodologias</div>
    <div class="meta-grid">
      <div class="meta-item">PROJETO<strong>Dashboard CSG</strong></div>
      <div class="meta-item">SKILLS LOCAIS<strong>41 Especializadas</strong></div>
      <div class="meta-item">DIRETÓRIO<strong>.agents/skills/</strong></div>
      <div class="meta-item">DATA DE GERAÇÃO<strong>Outubro / 2026</strong></div>
    </div>
  </div>
'''

for section in sections:
    html += f'''
  <div class="category-container avoid-break">
    <div class="category-title">
      <span class="category-icon" style="background-color: {section['color']};">{section['icon']}</span>
      <span>{section['title']}</span>
    </div>
    <div class="skills-grid">
'''
    for skill in section['skills']:
        html += f'''
      <div class="skill-card" style="border-left-color: {section['color']};">
        <div class="skill-header">
          <span class="skill-name">{skill['name']}</span>
          <span class="skill-tag">{skill['tag']}</span>
        </div>
        <div class="skill-desc">{skill['desc']}</div>
        <div class="skill-when"><strong>Quando usar:</strong> {skill['when']}</div>
      </div>
'''
    html += '''
    </div>
  </div>
'''

html += '''
  <div class="footer-box avoid-break">
    <h4>💡 Dica de Uso com seu Assistente</h4>
    <p>Para ativar qualquer uma das habilidades acima durante a conversa, basta mencioná-la nominalmente (por exemplo: <em>"use a skill design-taste-frontend para melhorar esta página"</em> ou <em>"execute o code-review na minha branch"</em>). O assistente lerá as regras especializadas correspondentes e seguirá o fluxo rigorosamente.</p>
  </div>

</body>
</html>
'''

with open(output_html, "w", encoding="utf-8") as f:
    f.write(html)

print("HTML salvo em:", output_html)

# Converte para PDF com Microsoft Edge
edge_cmd = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "--headless",
    "--disable-gpu",
    "--no-pdf-header-footer",
    f"--print-to-pdf={output_pdf}",
    f"file:///{output_html.replace(os.sep, '/')}"
]

print("Gerando PDF com Edge...")
res = subprocess.run(edge_cmd, capture_output=True, text=True)
if res.returncode == 0 and os.path.exists(output_pdf):
    size_kb = os.path.getsize(output_pdf) / 1024
    print(f"Sucesso! PDF gerado em: {output_pdf} ({size_kb:.1f} KB)")
else:
    print("Erro na geração do PDF:", res.stderr)
