# 🧭 ROADMAP DE EXECUÇÃO E CONTINUIDADE - DASHBOARD VELOCIDADES CSG
> **Documento Vivo de Controle:** Este arquivo deve ser lido no início de cada nova sessão de desenvolvimento para garantir continuidade imediata sem dependência de histórico de chat.
> **Última Atualização:** 30/10/2026 • 22:50  
> **Status Geral do Projeto:** 🟢 FASES 1 A 4 HOMOLOGADAS • SUÍTE DE TESTES AUTOMATIZADOS PASSANDO (11/11 TESTES) • FASE 5 EM FINALIZAÇÃO (PREPARAÇÃO GIT & DEPLOY EM NUVEM) • SERVIDOR ATIVO EM `http://localhost:3000`

---

## 📌 1. Visão Geral e Decisões Arquiteturais Congeladas

O projeto é uma plataforma corporativa para a **Casagrande Locações e Transportes (Unidade Operacional CSG)** para monitoramento de telemetria veicular e apuração do **Programa de Premiação de Direção Segura: Motorista x Caminhão (Teto estrito de 80 km/h)**.

### Decisões Batidas pelo Usuário:
1. **Arquitetura (Opção A):** 
   * Frontend Web moderno (Next.js 15 + React 19 + Tailwind CSS v4 + TypeScript) comunicando **diretamente com o Supabase** via `@supabase/supabase-js`.
   * **Zero necessidade de servidor Python rodando 24/7 na nuvem** (elimina custos e manutenção de VPS/FastAPI em nuvem).
   * Scripts Python são usados apenas localmente para suporte, migrações e automações pesadas se necessário.
2. **Banco de Dados & Nuvem:** 
   * **Supabase (PostgreSQL)** hospedado na região `sa-east-1 (São Paulo)`.
   * Row Level Security (RLS) habilitado.
3. **Autenticação e Permissões (Opção B):** 
   * Supabase Auth com login formal (E-mail/Senha) conectado em [`LoginScreen.tsx`](file:///frontend/GOOGLE_AI_DASHBOARD_ATUALIZADO/components/screens/LoginScreen.tsx).
   * Perfis: `admin` (pode enviar novas planilhas e gerenciar) e `visualizador` (apenas visualiza métricas e auditorias).
4. **Interface Visual (6 Telas Corporativas):** 
   * Resumo Geral e Horários, Rankings Frota e Condutores, Central de Ocorrências, Premiação e Compliance, Auditoria sem Identificação e Painel Admin de Parâmetros.
5. **Motor de Ingestão de Dados:** 
   * Ingestão via **Upload de Planilhas (`.xlsx` / `.csv`)** client-side com SheetJS (`xlsx`) em [`UploadSpreadsheetModal.tsx`](file:///frontend/GOOGLE_AI_DASHBOARD_ATUALIZADO/components/UploadSpreadsheetModal.tsx).
   * Trava anti-duplicação obrigatória via hash único (`hash_dedup`) e gravação automática na trilha de auditoria (`historico_uploads`).

---

## 📊 2. Quadro de Controle de Fases e Progresso

| Fase | Descrição | Status | Detalhes |
| :---: | :--- | :---: | :--- |
| **FASE 1** | **Infraestrutura & Banco de Dados (Supabase)** | ✅ **CONCLUÍDA** | Banco criado no Supabase (SP), RLS ativo, 17.614 eventos migrados, views de premiação criadas. |
| **FASE 2** | **Motor de Ingestão no Frontend (Upload + Deduplicação)** | ✅ **CONCLUÍDA** | Modal com SheetJS, parsing de `.xlsx`/`.csv`, deduplicação por hash SHA-256 e gravação no histórico de auditoria. |
| **FASE 3** | **Integração das Telas do AI Studio & Tailwind** | ✅ **CONCLUÍDA** | Next.js 15 + React 19 + Tailwind v4 compilando com 0 erros, temas Dark/Light homologados, 6 telas integradas. |
| **FASE 4** | **Autenticação & Controle de Acesso (RLS)** | ✅ **CONCLUÍDA** | Tela de Login integrada ao `supabase.auth` com fallback corporativo CCO homologado e controle por perfis. |
| **FASE 5** | **Deploy em Produção & Testes Finais** | 🟡 **EM FINALIZAÇÃO** | Suíte de 11 testes unitários passando (100%). Filtro de Competência Operacional (26 a 25) ativo. Trilha de auditoria sincronizada. Servidor local ativo em `http://localhost:3000`. Repositório Git e variáveis de ambiente preparados para publicação Vercel. |

---

## 🗄️ 3. Raio-X do Banco de Dados no Supabase (Atual)

* **URL do Projeto:** `https://rmtacyjdumcwmasksvqz.supabase.co`
* **Credenciais:** Armazenadas no arquivo local [`.env`](file:///.env) e [`.env.local`](file:///frontend/GOOGLE_AI_DASHBOARD_ATUALIZADO/.env.local)
* **Tabelas e Visões em Produção:**
  * `public.eventos_telemetria`: **17.614 registros** ingeridos com precisão decimal corrigida (`NUMERIC(10,2)`). Teste de upload client-side homologado com deduplicação.
  * `public.veiculos`: **36 veículos** com placas, prefixos e categorias mapeadas.
  * `public.motoristas`: **21 condutores** identificados.
  * `public.historico_uploads`: Tabela de auditoria para registrar quem subiu cada planilha.
  * `public.perfis_usuarios`: Mapeamento de perfis (`admin` vs `visualizador`).
  * `public.vw_apuracao_premiacao`: Visão SQL automática que calcula elegibilidade do SESMT em tempo real.

---

## 🚀 4. Guia Passo a Passo para Conclusão e Deploy (Fase 5)

Para publicar o projeto e homologar em produção:

### 🎯 Passo 1: Inicialização do Repositório Git (Local)
1. Executar `git init` na raiz do projeto.
2. Confirmar se `.gitignore` protege arquivos sensíveis (`.env*`, `telemetria.db`, `.next/`, `node_modules/`).
3. Criar o commit inicial: `git add .` e `git commit -m "feat: release candidate v2.0 - csg speed telemetry dashboard"`.

### 🎯 Passo 2: Publicação na Nuvem (Vercel)
1. Conectar o repositório no [Vercel](https://vercel.com):
   * **Root Directory:** `frontend/GOOGLE_AI_DASHBOARD_ATUALIZADO`
   * **Framework Preset:** `Next.js`
2. Adicionar as seguintes variáveis de ambiente na Vercel:
   * `NEXT_PUBLIC_SUPABASE_URL` = `https://rmtacyjdumcwmasksvqz.supabase.co`
   * `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_EpVfAIR5fdX3J3Jo3bUY8Q_1gwerDPe`
3. Clicar em **Deploy** (a Vercel gerará automaticamente um link HTTPS seguro com CDN global).

### 🎯 Passo 3: Homologação Final (UAT)
1. Acessar o domínio gerado na Vercel.
2. Validar o login CCO.
3. Simular o upload de uma planilha de fechamento mensal.
4. Concluir a entrega com a gerência do SESMT / Operações Casagrande.


---

## 💬 5. Como Iniciar um Novo Chat sem Perder o Contexto

Sempre que a janela de contexto estiver pesada ou você abrir um novo chat, basta copiar e colar a mensagem abaixo:

```text
Olá! Estou desenvolvendo o Dashboard de Velocidades CSG. 
Por favor, leia atentamente o arquivo ROADMAP_EXECUCAO.md na raiz do projeto. 
Ele contém o status completo de onde paramos, as decisões arquiteturais e as instruções exatas da etapa atual. 
Vamos continuar a partir do próximo passo indicado nele.
```

---
*Este arquivo deve ser atualizado ao final de cada entrega relevante.*
