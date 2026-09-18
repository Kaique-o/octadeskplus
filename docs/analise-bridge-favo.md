# Plano: clone do Bridge com Supabase + n8n

Análise feita em 17/09/2026 sobre `favosolutions.com` (site) e `bridge.favosolutions.com` (app).

## 1. O que é a plataforma original

**Produto:** SaaS que liga CRM → WhatsApp. Um evento no CRM (negócio criado/movido, contato criado, aniversário, card mudou de coluna, POST externo) dispara uma sequência de ações (enviar template no WhatsApp, sincronizar contato, criar negócio/card), respeitando horário comercial, conversa já aberta e créditos do plano.

| Peça | Original | Como identifiquei |
|---|---|---|
| Site | Vite + React + Tailwind/shadcn (âmbar `#EE9A2A`, Inter) | assets `/assets/index-*.js/css` |
| App | **Expo (React Native Web)** + React Navigation, Stripe.js | bundle `/_expo/static/js/web/...` |
| API | REST próprio em `https://api.favosolutions.com` (JWT access/refresh) | `extra.apiUrl` no manifesto Expo |
| Integrações | Pipedrive, HubSpot, Zoho, Trello (gatilho/escrita) · Octadesk, YCloud (WhatsApp) | rotas `/channels/*`, `/integrations/*` |

> No clone ficaram só **Pipedrive** (gatilho) e **Octadesk** (WhatsApp), mais o webhook externo — HubSpot, Zoho, Trello e YCloud foram descartados a pedido.

**Menu do app:** Configurações (integrações + horário comercial) · API Bridge · Automações · Estatísticas · Conta (+ Assinatura, Base de conhecimento).

## 2. Arquitetura do clone

```
Navegador (web/ – React)
  ├── Supabase Auth ............ login, cadastro, reset de senha
  ├── PostgREST + RLS .......... CRUD de automações, integrações (sem segredos), stats
  ├── RPCs (SQL) ............... create_company, save_integration, save_automation, create_api_key...
  └── n8n  /webhook/bridge/canais  → valida credenciais, lista templates/telefones/pipelines, registra webhooks

CRMs / sistemas externos
  └── n8n  /webhook/bridge/in/:automationId?secret=...  → ingest_event()  → cria jobs agendados

n8n (a cada minuto)
  └── claim_due_jobs() → chama Octadesk / Pipedrive → finish_job() (debita crédito)

n8n (09h diário) → aniversariantes no CRM → ingest_event()
n8n  /webhook/bridge/v1/format → api_format_phone() (API pública com chave br_live_*)
```

**Decisões:**
- **Regras de negócio no Postgres** (horário comercial, filtros, deduplicação, fila, créditos). O n8n só faz I/O. Assim a lógica é testável e não fica espalhada em nodes.
- **Segredos das integrações** em `integration_secrets`, tabela sem policy de leitura: o navegador grava via RPC e nunca lê. Só o n8n (conexão Postgres) lê.
- **Fila com `FOR UPDATE SKIP LOCKED`**: execuções sobrepostas do cron não pegam o mesmo job; job travado há mais de 10 min volta para a fila; erro 5xx/429 tenta de novo 3× com backoff.

## 3. Mapa: rotas da API original → implementação

| Original (`api.favosolutions.com`) | Clone |
|---|---|
| `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`, `/accounts/create`, `/accounts/verify-email` | Supabase Auth (`signInWithPassword`, `signUp`, `resetPasswordForEmail`, `updateUser`) |
| `/users/me`, `/companies/me`, `/companies/my`, `/companies/select`, `/companies` | tabelas `profiles`, `companies` + RPCs `create_company`, `select_company` |
| `/companies/me/invites/*`, `/companies/invites/preview`, `/companies/invites/accept`, `/companies/me/members/:id` | `company_invites` + RPCs `preview_invite`, `accept_invite` |
| `/settings` (horário comercial) | `company_settings` |
| `/channels/check/:provider`, `/channels/:provider/phones|templates|pipelines`, `/channels/crm-field-catalog` | fluxo n8n **API de canais** (`check`, `phones`, `templates`, `pipelines`, `fields`, `register_webhook`) |
| `/integrations/:provider/authorize|disconnect` | RPC `save_integration` / `disconnect_integration` (OAuth: fase 3) |
| `/automations` (CRUD), `/:id/enabled`, `/:id/duplicate`, `/archived`, `/external-draft`, `/:id/payload-capture/start` | tabela `automations` + RPCs `save_automation`, `duplicate_automation`; payload capturado em `ingest_event` |
| `/automations/telemetry/daily|audit` | RPC `telemetry_daily` + tabela `jobs` |
| `/bridge-api/keys*`, `/v1/format`, `/bridge-api/telemetry/*` | `api_keys` + RPCs `create_api_key`, `revoke_api_key`; fluxo n8n **API pública /v1/format** |

Modelo de automação preservado do original: `audience` (pipedrive/external), `triggerType`, `stageIds`, `conditions` (all/any), `actionType`, `openChatPolicy` (`do_nothing` / `send_internal_note` / `send_template_anyway`), `templateVariables`, `delayValue/delayUnit`, horário comercial.


## 3.1 Calibragem com a conta real (17/09/2026)

Com o app logado (conta Skytech), conferi os formatos reais da API e ajustei o clone:

| O que vi na conta real | Ajuste no clone |
|---|---|
| Horário comercial é **granular**: `perDay` de 0 (domingo) a 6, cada dia com `enabled` e **lista de janelas** (ex.: seg 08–12 e 13–17, sáb 08–12) | `company_settings.business_hours` passou a usar esse mesmo formato; `next_business_slot` percorre as janelas do dia; editor no front permite vários intervalos por dia |
| Telemetria separa **gatilho** de **ação**: `triggerRuns/Successes/Errors`, `actionRuns/Successes/Errors` e `actionNoMessageSent` | `telemetry_daily` devolve os mesmos contadores; nova RPC `automation_stats` alimenta os cards |
| Lista de automações mostra card com resumo do gatilho + tabela de ações (OCORRE / DESTINO / AÇÃO / TELEFONE / TEMPLATE / CONVERSA) e contadores por automação | Tela de Automações reescrita nesse formato |
| Telefones do Octadesk são uma **lista rotulada** por empresa (`{ label, number, isActive }`, ex.: "Skytech Triagem +5511949602880"), não uma consulta ao Octadesk | `integrations.config.phones` virou lista de `{ number, label }`, com editor próprio na tela de Configurações |
| Templates vêm como `{ id, name, status: "approved", variables: [] }` — o `templateId` é o id interno do Octadesk (ex.: `6aac14ea44e2650e594d8cf3`) | Formato já compatível com o handler `templates` do fluxo de canais |
| Webhook externo: `/webhooks/external/{companyId}/{automationId}` + `webhookSecret`, com estados `awaitingPayloadExample`, `payloadCaptureActive`, `activatedAt` | Clone usa `/webhook/bridge/in/{automationId}?secret=`; a captura de payload já existe (estados detalhados ficam como melhoria) |
| Campo de telefone do evento externo vem como caminho no payload (ex.: `contact.phone_digits`) | Igual ao `trigger.phoneField` do clone |
| Uso real: as 7 automações da conta são **evento externo → Octadesk**, com `openChatPolicy` variando | Confirma a prioridade: webhook externo + Octadesk é o caminho principal |

## 4. O que já está pronto nesta pasta

| Parte | Arquivos | Verificação |
|---|---|---|
| Banco | `supabase/migrations/*.sql` (15 tabelas, RLS, 27 funções) | aplicado em Postgres embarcado (PGlite) com testes de horário comercial (inclusive dia com almoço e sábado só de manhã), filtros, dedupe, fila, retentativa, créditos, telemetria, API de telefone e isolamento RLS entre empresas |
| Motor | `n8n/fluxos/*.json` (5 fluxos) gerados de `n8n/codigo/*.js` | sintaxe dos Code nodes validada; executor testado com HTTP simulado (envio, conversa aberta, sem crédito, telefone inválido, 500/429 → retentativa, 400 → erro) |
| Demonstração | `web/src/lib/demo.ts` + `VITE_DEMO=1` | painel navegável sem backend (login desativado), usado para revisar as telas |
| Front | `web/` — login/cadastro/reset/convite, Configurações, API Bridge, Automações (wizard), Estatísticas, Conta | `tsc` sem erros, `vite build` ok, rotas e proteção de login conferidas no navegador |

## 5. Passo a passo para subir (ambiente de teste kaiqueoli.com)

1. **Banco** — no Supabase de teste, rode as migrations em ordem (SQL Editor ou `supabase db push`).
   Em *Authentication → URL Configuration* adicione a URL do front em *Redirect URLs* (`/redefinir-senha`, `/empresa`).
2. **n8n**
   - Crie a credencial **Postgres** chamada `Supabase Postgres` (host do banco, usuário `postgres`, SSL conforme seu self-hosted).
   - `npm run n8n:build` e depois `N8N_URL=... N8N_API_KEY=... npm run n8n:import`.
   - No fluxo **API de canais**, node *Autenticar usuário*: preencha `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`.
   - Selecione a credencial nos nodes Postgres e **ative** os 5 fluxos.
3. **Front** — `cp web/.env.example web/.env.local`, preencha e rode `npm --prefix web run dev`.
   Deploy: `npm --prefix web run build` e publique `web/dist` (Cloudflare Pages/Worker, igual ao projeto metrics — SPA com fallback para `index.html`).
4. **Teste ponta a ponta**
   1. Criar conta → empresa.
   2. Conectar Octadesk (subdomínio + chave + números) → deve ficar *Conectado*.
   3. Nova automação → *Evento externo* → Gerar URL → `curl` com `{"name":"Teste","phone":"11999999999"}`.
   4. Ação: enviar template pelo Octadesk → ativar → mandar o `curl` de novo → em até 1 min aparece em Estatísticas.

## 6. Fases seguintes (o que falta para igualar o original)

| Fase | Item | Como |
|---|---|---|
| 2 | **Validar endpoints Octadesk** marcados com `VALIDAR` (filtro de conversa aberta, rota de templates, nota interna) | testar na conta Octadesk real e ajustar `n8n/codigo/*.js` → `npm run n8n:build` |
| 2 | E-mail de convite | fluxo n8n com trigger em `company_invites` (ou Supabase Database Webhook) enviando o link `/convite/:token` |
| 2 | Alertas de erro por e-mail (`company_settings.alert_emails`) | fluxo n8n horário lendo `jobs` com `status = 'error'` |
| 2 | `crm_update_contact` no Pipedrive | estender `executor.js` |
| 3 | Escala | n8n em *queue mode* com workers; particionar `jobs`/`events` por mês; job de limpeza de `events` > 90 dias |

## 7. Cuidados

- **Marca e conteúdo:** o front reproduz a estrutura e o visual, mas com marca própria (`BRAND` em `web/src/lib/constants.ts`, hoje "Elo"). Não copie o nome, logo e depoimentos da Favo — os depoimentos do original foram deixados de fora de propósito. Coloque depoimentos reais dos seus clientes.
- **Segredos:** nada de chave no front além da publishable. O `webhook_secret` de cada automação é visível para membros da empresa (é o que eles colam no CRM); troque-o regenerando a automação se vazar.
- **LGPD:** `events.payload` guarda dados pessoais vindos do CRM — defina retenção (fase 3) e mencione na política de privacidade.
