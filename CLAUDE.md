# Briefing do projeto (para IA e devs)

Documento canônico deste repositório: contexto completo, padrões e estado atual. Onde outro arquivo divergir
daqui ou do código, vale este e o código. Plano e histórico de decisões: [PLANO.md](PLANO.md).

> **Para uma sessão nova de IA:** leia este arquivo inteiro antes de mexer em qualquer coisa. Ele basta para
> entender o projeto sem precisar ler `PLANO.md`, `README.md` ou o código. Última revisão: 14/10/2026.

---

## 1. O que é o projeto

**Octadesk Plus** é o motor de réguas (automações) de WhatsApp da **Skytech Solutions**, construído em cima do
**metrics** (o CRM da casa) e enviando pelo **Octadesk**.

Um evento acontece — venda faturada, orçamento enviado sem compra, alerta de comportamento, mudança de curva
ABC, crédito disponível, conversa do Octadesk encerrada, ou um POST externo — e o sistema executa uma sequência
de ações: enviar template de WhatsApp, mandar mensagem na conversa, deixar nota interna, aplicar tags,
preencher campo da conversa, transferir para uma fila.

**Origem:** nasceu como clone do **Bridge da Favo Solutions** (micro-SaaS de disparos contratado, em uso até o
fim do contrato) e existe para **substituí-lo**. A migração é trocar a `webhook_url` das campanhas do metrics
para apontar aqui — a Entrada aceita o mesmo contrato (`X-Bridge-Secret`) do Bridge, então nada muda no metrics.

**Pasta anterior do repositório:** `clones/metrics/bridge/`, depois `clones/octadeskplus/`, hoje
`Desktop/claude/octadeskplus/`. Remoto: `https://github.com/Kaique-o/octadeskplus.git` (branch `main`).

### O que o projeto NÃO é

- Não tem site institucional, planos, cobrança ou cadastro público.
- **Pipedrive, HubSpot, Zoho, Trello, Salesforce e YCloud foram descartados de propósito.** Aparecem no
  catálogo de Integrações apenas como "Indisponível". Não reintroduzir sem pedido explícito.
- Não tem aniversários como gatilho (o metrics não guarda data de nascimento).
- O módulo "adm" e o código Konami existiram e **foram removidos** (24/09/2026).

### Multiempresa

**Várias empresas no mesmo banco**, isoladas por RLS (`octaplus.empresas`; toda tabela tem `empresa_id`).

- O **dono da plataforma** (papel `owner` em `public.user_roles`) vê todas e, em **Configurações › Owner**, cria,
  inativa e apaga empresas e gerencia os usuários de cada uma (`octaplus.membros`: perfil, ativo).
- Toda empresa nasce com um usuário **Master** (administrador dela, perfil fixo, sempre sobra pelo menos um).
- As contas são criadas pelo banco direto no Auth (`octaplus.criar_usuario`), **sem cadastro público**.
- Empresa **inativa** pausa tudo: não recebe eventos, não envia, e os usuários dela perdem o acesso.
- A tela de login oferece **Primeiro acesso** (a conta vira dono da plataforma) só enquanto
  `octaplus.primeiro_acesso()` — **única função liberada para `anon`** — for verdadeira.

### Idioma

Tudo em **português do Brasil**: interface, mensagens de erro, comentários, nomes de tabelas/colunas/funções do
domínio (`automacoes`, `registrar_evento`, `horario_comercial`) e documentação. Inglês só onde o ecossistema
impõe ou o nome já existe no metrics (`clients`, `sales`, `has_permission`).

---

## 2. Stack e comandos

| Camada | O que é |
|---|---|
| Front | Vite 7 + React 19 + TypeScript 5.9 + Tailwind v4 + react-router 7 + lucide-react + simple-icons |
| Banco | Supabase (Postgres); tudo do Octadesk Plus no schema **`octaplus`**, com RLS e pg_cron |
| Motor | n8n: entrada de webhooks, executor por minuto, validação/catálogos/token, API pública |
| Testes | PGlite (`@electric-sql/pglite`) para o banco; Octadesk simulado para os Code nodes |
| Deploy do painel | Cloudflare Pages (root `web`, build `npm run build`, saída `dist`, Node 22) |

```bash
npm install                   # dependências dos testes (PGlite)
npm --prefix web install      # dependências do painel
npm test                      # testes do banco (PGlite) + dos Code nodes do n8n
npm run db:test               # só o banco (testar.mjs + testar-empresas.mjs + testar-base.mjs)
npm run n8n:test              # só os Code nodes
npm run n8n:build             # regera n8n/fluxos/*.json a partir de n8n/codigo/*.js
npm run n8n:import            # N8N_URL=... N8N_API_KEY=... importa os fluxos via API
npm run db:instalacao         # gera supabase/instalar-projeto-proprio.sql
npm run web:dev               # painel em http://localhost:5173
npm --prefix web run build    # tsc -b + vite build
```

`.claude/launch.json` tem dois alvos de preview: **`web`** (5173) e **`web-demo`** (5174, com `VITE_DEMO=1`).

---

## 3. Estrutura de arquivos

```
web/src/
  App.tsx, main.tsx, index.css
  app/        telas do painel + sidebar
              AppLayout, Home, Stats, Automations, AutomationWizard,
              SettingsTabs, Integrations (Octadesk), IntegracoesExternas, Empresa, FormEmpresa,
              LogoEmpresa, Usuarios, GestaoUsuarios, ApiKeys, NaoPerturbe, Owner, Profile,
              Sidebar, SidebarFooter, nav.ts, sidebar.css
  auth/       AuthShell, Login, ResetPassword, EscolherEmpresa
  components/ ui.tsx, LogoOctadesk.tsx, FotoEditavel.tsx, PlacaCargo.tsx
  lib/        supabase.ts (cliente no schema octaplus + header x-empresa), session.tsx, empresas.tsx,
              types.ts, constants.ts, permissao.ts, demo.ts, csv.ts, formato.ts, imagem.ts, saude.ts
supabase/
  migrations/              schema octaplus — aplicar em ordem lexicográfica
  base/                    base-projeto-proprio.sql (tabelas do metrics, vazias)
  instalar-projeto-proprio.sql   gerado por montar-instalacao.mjs
  tests/                   stub-metrics.sql + testar.mjs, testar-empresas.mjs, testar-base.mjs
n8n/
  codigo/                  executor.js, manutencao.js — FONTE DE VERDADE
  fluxos/                  4 JSONs gerados; nunca editar à mão
  tests/                   testar-codigo.mjs (Octadesk simulado por rota)
  montar-fluxos.js, importar-via-api.js
docs/                      analise-bridge-favo.md + referencia-dashboard-v2/ (outro projeto, só referência)
```

**Regra de ouro do motor:** a lógica de negócio mora no Postgres. O n8n só faz entrada e saída.

---

## 4. Caminho de um evento

```
metrics (public.*) ──SQL──▶ candidatos() → detectar_eventos()  [pg_cron, 5 min] ─┐
Octadesk webhooks ──▶ n8n Entrada ──▶ receber_octadesk()                         ├─▶ registrar_evento()
POST externo / campanhas (X-Bridge-Secret) ──▶ n8n Entrada ──▶ receber_webhook() ─┘          │
                                                                                            ▼
                                                                                      execucoes (fila)
                                                                                            │
                        pegar_execucoes() [1 min] ──▶ executor.js ──▶ Octadesk ──▶ concluir_execucao()
                                                                                            │
                                                                                            ▼
                                                                                      envios (histórico)
                                                                                            │
                                          atualizar_atribuicao() [1 h] ──▶ respondeu? comprou em 7 dias?
```

`registrar_evento` faz, em ordem: contexto do cliente → telefone → não perturbe → condições → limite de
contato → deduplicação → agenda uma execução por ação da automação.

---

## 5. Mapa do banco (schema `octaplus`)

### Tabelas

| Tabela | Para quê |
|---|---|
| `empresas` | as empresas da plataforma (nome, ativa, fuso, logo, endereço de cobrança) |
| `membros` | vínculo usuário × empresa: perfil, ativo |
| `perfis` | perfil de acesso com `nenhum`/`ver`/`editar` por área |
| `fotos_usuario` | foto do próprio perfil (base64) |
| `configuracao` | por empresa: horário comercial `perDay`, fuso, número padrão, e-mails de alerta, limite de contato |
| `integracao_octadesk` | base URL, subdomínio, `octa-agent-email`, status e último teste |
| `segredos` | **RLS sem policy**: API key, login da API privada, JWT atual, chave do metrics |
| `integracoes_externas` | sistemas externos ligados à empresa (hoje: metrics) |
| `octa_numeros`, `octa_templates`, `octa_grupos`, `octa_tags` | catálogos sincronizados do Octadesk |
| `mapa_filas` | `tipo_de_entrega` do contato → fila (Motoboy, Sedex, Ônibus, Retirada, Triagem) |
| `automacoes` | nome, ativa, `ativa_desde`, fonte, gatilho, parâmetros, condições, horário, atraso |
| `automacao_acoes` | ordem, espera, tipo, config (número, template, variáveis, política de conversa) |
| `eventos` | automação, `client_id`, `octadesk_contact_id`, telefone, payload, `dedupe_key` único |
| `execucoes` | a fila; status, tentativas, código de erro da Meta/Octadesk |
| `envios` | cada mensagem enviada: `roomKey`, `messageKey`, cliente, template — base da atribuição |
| `nao_perturbe` | telefones/clientes que não recebem nada (opt-out) |
| `chaves_api`, `chamadas_api` | a aba API (`/v1/format`) |

### Funções

**Motor** (só o n8n/pg_cron; têm `revoke execute ... from public, anon, authenticated`):
`candidatos`, `detectar_eventos`, `registrar_evento`, `receber_octadesk`, `receber_webhook`,
`pegar_execucoes`, `concluir_execucao`, `atualizar_atribuicao`, `credenciais_octadesk`, `gravar_catalogos`,
`gravar_jwt`, `gravar_manutencao`, `api_formatar_telefone`, `conferir_alvo`, `limpar_historico`.

**Auxiliares de domínio:** `normalizar_telefone`, `normalizar_endereco`, `proximo_horario_util`, `intervalo`,
`atende_condicoes`, `contexto_cliente`, `cliente_por_contato`, `cliente_por_telefone`.

**Painel** (checam `octaplus.pode(...)` / `pode_aqui(...)` no topo e têm `grant`):
`salvar_automacao`, `ao_salvar_automacao`, `duplicar_automacao`, `resumo_automacoes`, `estatisticas_diarias`,
`salvar_integracao`, `pedir_sincronizacao`, `segredos_preenchidos`, `salvar_integracao_externa`,
`remover_integracao_externa`, `salvar_empresa`, `listar_empresas`, `apagar_empresa`, `definir_empresa_ativa`,
`criar_usuario`, `editar_membro`, `remover_membro`, `definir_membro_ativo`, `definir_nivel`, `redefinir_senha`,
`listar_membros`, `listar_usuarios`, `salvar_perfil`, `apagar_perfil`, `listar_perfis`, `criar_perfis_padrao`,
`perfil_master`, `conferir_ultimo_master`, `salvar_minha_foto`, `criar_chave_api`, `revogar_chave_api`.

**Permissão:** `areas`, `pode`, `pode_aqui`, `pode_area`, `pode_na`, `permissao`, `e_dono`,
`gerencia_usuarios`, `empresa_atual`, `primeiro_acesso` (a única para `anon`).

### Migrations (ordem lexicográfica, 17 arquivos)

`20260918000001_octaplus_tabelas` · `..02_funcoes` · `..03_acesso_e_agenda` ·
`20260921000001_empresa_usuarios` · `20260923000001_fecha_anon` · `..02_primeiro_acesso` ·
`20260924000001_multiempresa` · `..02_motor_multiempresa` · `..03_owner` · `..04_owner_usuarios` ·
`..05_perfis` · `..06_empresa_fuso` · `..07_empresa_logo` · `..08_foto_usuario` · `..09_master` ·
`..10_integracoes_externas` · `..11_endereco_cobranca`.

---

## 6. Gatilhos (catálogo em `web/src/lib/constants.ts`)

### Fonte `metrics` (detectores SQL, pg_cron a cada 5 min)

| Gatilho | De onde vem | `dedupe_key` |
|---|---|---|
| `orcamento_sem_compra` | `skyler_analyses.orcamento_enviado` sem `sales` ativa depois (N dias) | `orc:{conversa}` |
| `pediu_orcamento` | `skyler_analyses.etapa_comercial = 'Cliente pediu orçamento'` (N horas) | `pedorc:{conversa}` |
| `conversa_classificada` | `skyler_analyses`, etapa escolhida | `enc:{conversa}` |
| `venda_faturada` | novo `sales.numero_unico` ativo | `venda:{numero_unico}` |
| `venda_cancelada` | `sales.status` → `cancelada` | `canc:{numero_unico}` |
| `alerta_comportamento` | `client_behavior_alerts` (padrão escolhido) | `alerta:{cliente}:{padrão}:{semana}` |
| `mudanca_curva` | `client_curve_history` (de/para) | `curva:{id}` |
| `credito_disponivel` | `client_credits` (valor mínimo) | `cred:{cliente}:{dtref}` |
| `sem_compra` | `clients.dt_ultima_compra` (N dias) | `semcompra:{cliente}:{N}:{mês}` |

### Fonte `octadesk` (webhooks de conversa)

`octa_conversa_encerrada` (`room.after-close`), `octa_conversa_atribuida` (`room.after-set-agent`),
`octa_nova_mensagem` (`room.after-insert-message`).

### Fonte `webhook`

`webhook_externo`: POST com o segredo da automação — o mesmo contrato do Bridge (`X-Bridge-Secret` ou `?secret=`).

### Ações (`automacao_acoes.tipo`)

`enviar_template` (abre a conversa) · `enviar_mensagem` · `nota_interna` · `aplicar_tags` ·
`campo_conversa` · `transferir_fila` (**só API privada**, opcional).

Políticas de conversa aberta: `nao_fazer_nada`, `nota_interna`, `enviar_mesmo_assim`.

---

## 7. Octadesk — o que usar

- **API pública** (`{base_url}`, headers `X-API-KEY` + `octa-agent-email`): `/auth/check`, `/chat/numbers`,
  `/chat/templates-message` (filtrar `status eq approved`), `/chat/send-template` (variáveis em
  `[{key, value}]`; devolve `{messageKey, roomKey}` ou `error/errorCode` da Meta), `/chat` com filtros
  (`contact.phoneContacts.number`, `status eq talking`), `/chat/{id}/messages` (`type` public/internal —
  public só dentro da janela de 24h, `windowExpiresAt`), `/chat/{id}/tags` (substitui a lista),
  `/chat/{id}/custom-fields`, `/contacts`, `/tickets/groups`, `/tickets/tags`.
  Referência: developers.octadesk.com.
- **API privada** (só transferência de fila): `PUT us-east1-001.prod.octadesk.services/chat/rooms/{id}/group/{g}`
  com JWT de `nucleus-auth/auth` (usuário + senha + tenantId). Pode mudar sem aviso; por isso é **opcional**
  na integração.
- **Webhooks de conversa** não são documentados publicamente nem assinados; envelope
  `{domain, event, data:<chat>}`. O segredo vai **no caminho da URL**. Cadastrar a URL é configuração da conta
  no Octadesk — não há API pública para isso.
- Não documentado: rate limit, fechar conversa, lista de agentes.

### O que os estudos mostraram sobre o metrics

71 tabelas. As que importam: `clients` (80 mil; telefone, curva, dias sem compra, vendedor,
`octadesk_contact_id`), `client_octadesk_contacts` (telefone em `55` + número), `sales` (837 mil itens;
`status` ativa/cancelada/excluida, `numero_unico`), `client_credits`, `client_behavior_alerts`,
`client_curve_history`, `conversations`, `messages`, `skyler_analyses` (IA: `orcamento_enviado`,
`etapa_comercial`), `campaigns` (já disparam para webhook com `X-Bridge-Secret`). Auth: `profiles`,
`user_roles`, `has_permission()`.

- **Não existe tabela de orçamento** — só a classificação da IA em `skyler_analyses`.
- **Nenhuma tabela publica eventos**; as rotinas são recalculadas por cron.
- **Telefones em formatos misturados**; chave confiável entre bases: `clients.octadesk_contact_id`.
- `resolver_contato`: prefere `client_octadesk_contacts` (55 + número) e `octadesk_contact_id`; cai para
  `clients.telefone` normalizado. Sem telefone válido = evento descartado com motivo, visível nas estatísticas.

---

## 8. Padrões do projeto (regras duras)

1. **O metrics é só leitura.** O schema `octaplus` lê `public.*` por funções `security definer` e nunca
   escreve lá. Colunas do metrics que o octaplus usa estão espelhadas em `supabase/tests/stub-metrics.sql`;
   se o metrics mudar, o stub muda junto.
2. **Ligar uma régua não dispara sobre o histórico.** `automacoes.ativa_desde` é gravado na ativação e os
   detectores só olham o que venceu depois disso (e dentro de `janela_deteccao_horas`).
3. **Todo evento passa por `registrar_evento`.** Evento barrado é gravado como `ignorado` com motivo — aparece
   nas estatísticas e não é reavaliado. Não criar atalhos que agendem execução sem passar por ele.
4. **Segredo nunca volta para o navegador** — `octaplus.segredos` tem RLS sem policy; o front grava por
   `salvar_integracao` / `salvar_integracao_externa` e só o n8n lê, via `credenciais_octadesk()`.
5. **Funções do motor têm `revoke execute ... from public, anon, authenticated`** no fim da migration 3.
   Função nova do motor entra nessa lista; função do painel checa `octaplus.pode('editar')` no topo.
6. **Permissão é por empresa e por área.** O painel manda o header `x-empresa` (`lib/supabase.ts`);
   `empresa_atual()` lê o header. Cada membro tem um perfil (`octaplus.perfis`) com `nenhum`/`ver`/`editar`
   por área (`areas()`: automacoes, integracoes, empresa, usuarios, api, nao_perturbe); `pode_aqui(area, acao)`
   na empresa atual, dono sempre. Quem tem `usuarios: editar` gerencia usuários e perfis da própria empresa.
   No front: `usePode(area)`. Policy padrão:
   `empresa_id = empresa_atual() and pode_aqui('<area>', 'ver')`. **Tabela nova do octaplus nasce com
   `empresa_id ... default octaplus.empresa_atual()` e essa policy.** O motor nunca usa o header: recebe ou
   descobre a empresa (automação, segredo do webhook do Octadesk, chave de API) e filtra por ela.
7. **O navegador não chama o n8n.** Validar integração e sincronizar catálogo são pedidos pelo banco
   (`salvar_integracao`, `pedir_sincronizacao`); o fluxo de manutenção atende no próximo minuto.
8. **Fila com `FOR UPDATE SKIP LOCKED`**; execução travada há 10 min volta; `pendente` retenta com backoff
   (5/10/15 min) e vira `erro` na 3ª tentativa; 4xx é definitivo, 5xx/429/rede retentam; erro da Meta vem no
   corpo 2xx do `send-template` e é definitivo.
9. **Horário comercial no formato do app original** — `perDay["0".."6"]` (0 = domingo) com lista de janelas.
10. **Editar Code node é editar `n8n/codigo/*.js`** e rodar `npm run n8n:build`.
11. **Menu vem de `web/src/app/nav.ts`**: principal só **Automações** (sem ícone, mantendo o espaço do ícone
    para o texto alinhar); a **home** (banner + estatísticas) é pelo logo; **Configurações** (rodapé) tem as abas
    Octadesk · Integrações · Empresa · Usuários · API · Não perturbe · **Owner** (Owner só para o dono);
    **Meu perfil** no card do usuário. **Rota nova nasce com verbete em `AJUDA`** (mesmo arquivo) — rota sem
    verbete deixa o botão "Ajuda" desabilitado, nunca escondido.
12. **Modo demonstração isolado** — só em `npm run web:dev` (build publicado ignora e sempre exige login):
    `VITE_DEMO=1` troca o cliente Supabase por memória (`lib/demo.ts`), com o mesmo formato das tabelas
    `octaplus`. **Nenhuma tela tem `if (DEMO)`.**

---

## 9. Marca, estilo e UI

O painel se chama **Octadesk Plus**, com o logo oficial em SVG (`web/src/components/LogoOctadesk.tsx`,
extraído de octadesk.com, traços em `currentColor`) seguido de um "+" e a paleta azul deles. Nome e logo são
marca de terceiro: para uso interno, tudo bem; oferecido a clientes, o caminho é nome próprio com menção de
compatibilidade ou autorização por escrito. Trocar a marca é editar `BRAND` em `lib/constants.ts`
(`name: 'Octadesk Plus'`, `empresa: 'Skytech Solutions'`), os tokens do `@theme` e o `--primary` da sidebar.

Tailwind v4, tokens no `@theme` de `web/src/index.css` — azul `#1366c9`, azul escuro `#29354d`, fundo
`#f3f8fe`, Poppins nos títulos; nomes neutros (`brand`, `brand-soft`, `brand-hover`). Utilitários `btn-primary`,
`btn-ghost`, `input`, `label`, `card`, `chip` são `@utility` ali.

A sidebar é a exceção: CSS puro em `web/src/app/sidebar.css`, sob o escopo `.painel`, com derivados por
`color-mix`. Especificação: [docs/referencia-dashboard-v2/prompt-sidebar.md](docs/referencia-dashboard-v2/prompt-sidebar.md).

Ícones: `lucide-react`, 20px/`strokeWidth 1.8` no menu; logos de marca por `simple-icons`. **Nada por CDN.**

---

## 10. Env e publicação

`web/.env.local` (**não versionado**):

| Variável | Para quê |
|---|---|
| `VITE_DEMO` | `1` abre o painel em memória — só vale em `web:dev` |
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | chave publishable/anon (só ela chega ao navegador) |
| `VITE_N8N_WEBHOOK_URL` | base dos webhooks do n8n |

O PostgREST precisa **expor o schema `octaplus`** (Settings › API › Exposed schemas; self-hosted:
`PGRST_DB_SCHEMAS`).

**Cloudflare Pages:** Workers & Pages › Create › Pages › Connect to Git. Root directory `web`, build
`npm run build`, saída `dist`, variáveis `VITE_*` (as `VITE_*` entram **no build** — mudou uma, refaz o deploy).
Node vem de `web/.node-version` (22). Rotas como `/app/automacoes` funcionam porque, sem `404.html`, o Pages
devolve o `index.html` e o React Router assume.

**Supabase próprio, sem o metrics:** `npm run db:instalacao` gera `supabase/instalar-projeto-proprio.sql`
(pg_cron + `supabase/base/base-projeto-proprio.sql` + migrations) para colar no SQL Editor de um projeto vazio.
A base cria **vazias** as tabelas do metrics que o octaplus lê. Em Authentication › URL Configuration, pôr a URL
do painel em Site URL e em Redirect URLs; depois do primeiro acesso, desligar "Allow new users to sign up".

**n8n:** credencial Postgres "Supabase Postgres" apontando para o banco, depois `npm run n8n:build` e
`N8N_URL=... N8N_API_KEY=... npm run n8n:import`; ativar os quatro fluxos.

### Fluxos n8n

| Fluxo | Gatilho | Função |
|---|---|---|
| Entrada | `POST /webhook/octaplus/in/:id` e `POST /webhook/octaplus/octadesk/:segredo` | registra eventos externos e do Octadesk |
| Executor | a cada minuto | executa as ações vencidas no Octadesk e fecha cada execução |
| Validação, catálogos e token | a cada minuto (só age quando precisa) | valida a chave, sincroniza catálogos, renova o JWT da API privada |
| API pública `/v1/format` | `POST /webhook/octaplus/v1/format` | normaliza telefone com chave `br_live_*` |

---

## 11. Estado atual

| Fase | Situação |
|---|---|
| 1. Segurança | **Pendente, depende de você**: rotacionar os segredos expostos em texto puro nos JSONs do n8n do metrics (login e API key do Octadesk, Sankhya, Ploomes, chaves do metrics) |
| 2. Banco | Pronto e testado (46 testes em Postgres embarcado com stub do metrics) |
| 3. Octadesk | Pronto e testado (25 testes com o Octadesk simulado) |
| 4. Front | Ligado a um Supabase próprio (`gsndcxdjwblsukxjzwhi`) desde 23/09/2026; multiempresa, perfis, Owner, fotos, integrações externas e endereço de cobrança feitos |
| 5. Piloto | Pendente — precisa do Supabase com dados e de um número de teste |

### Desvios em relação ao desenho original

- Os detectores usam **janela de tempo + deduplicação** em vez da tabela `cursores` (mais simples, cobre o caso).
- O gatilho de etapa da IA chama-se **`conversa_classificada`**, para não confundir com `octa_conversa_encerrada`.
- **Empresa e Usuários voltaram** como abas de Configurações (21/09/2026): Empresa grava em `configuracao`;
  Usuários lista por `listar_usuarios()`.
- O botão "Sincronizar" e a validação vão ao n8n **pelo banco** (`pedir_sincronizacao`).
- Os detectores do metrics continuam lendo `public.*` compartilhado (hoje **vazio** no Supabase próprio).

### Pendências (dependem de você)

- **Rotacionar os segredos** da fase 1, a senha do banco e a secret key que passaram pelo chat.
- **Integração com o metrics** (Configurações › Integrações): já grava URL + chave por empresa (chave em
  `segredos`, `metrics_chave`) e fica "pendente". **Falta o motor usar essa conexão** para ler clientes/vendas
  nos detectores — hoje eles leem o `public.*` local. Alternativa: ligar o metrics por `postgres_fdw`.
- **Alimentar as tabelas do metrics** no Supabase próprio: sem dados, os detectores de vendas/créditos/curvas
  não acham nada. Gatilhos de conversa e webhook externo funcionam.
- **Número de teste** para os envios do piloto e o usuário do Octadesk para `octa-agent-email`.
- **Cadastrar no Octadesk** a URL dos webhooks de conversa (configuração da conta, não tem API).
- **Piloto:** recriar "Orçamentos de ontem que não fecharam" (hoje no Bridge), rodar em paralelo com envio para
  número de teste, comparar contagens com a telemetria da Favo, depois apontar as campanhas do metrics para cá
  e desligar o Bridge.

---

## 12. Como trabalhar neste repositório

### Feature nova

Ciclo: **prova que falha → implementação mínima → limpeza com a prova ainda passando.**

- **SQL**: teste em `supabase/tests/testar.mjs` (PGlite + stub do metrics). Cobrir o caminho feliz **e** as
  negativas: fora da janela, condição não atendida, duplicado, não perturbe, limite de contato, usuário sem
  permissão (RLS devolve zero linha / RPC recusa). Coluna nova do metrics lida pelo octaplus entra no stub.
- **Code node**: teste em `n8n/tests/testar-codigo.mjs`, com o Octadesk simulado por rota.
- **Tela**: `npm --prefix web run build` e abrir no navegador em modo demonstração.

**Não declarar pronto porque compilou.**

### Checklist pós-implementação

- `npm test` e `npm --prefix web run build` limpos.
- Mexeu em `n8n/codigo/`? `npm run n8n:build`.
- Função nova do motor? Na lista de `revoke execute`. Função do painel? Checa `pode()` e tem `grant`.
- Tela nova? Rota + `nav.ts`/abas + verbete em `AJUDA`.
- Removeu um conceito? Varrer front, SQL, Code nodes, fluxos gerados, demo e docs pelo nome.
- Mudou comportamento? Atualizar `PLANO.md` (status) ou `README.md`.

### Problemas recorrentes (já custaram tempo)

1. **`$$` some em `String.replace`** — `$$` no replacement vira `$`; o erro aparece como
   `syntax error at or near "declare"`. Use função de substituição ou a ferramenta de edição.
2. **Escape em string JS dentro do gerador de fluxos** — `"\s"` vira `s`; em expressões n8n escritas dentro de
   string no `montar-fluxos.js`, use `\\s`. Os testes do n8n não pegam isso: confira a expressão gerada.
3. **`pgcrypto` no Supabase fica no schema `extensions`** — função com `search_path` restrito que usa
   `digest`/`gen_random_bytes` precisa de `search_path = octaplus, extensions, public`.
4. **`.nav-item:hover` usa o shorthand `background`** — item com imagem de fundo repete `background-image`.
5. **Painel de preview**: navegar direto para uma rota recarrega na raiz; use `history.pushState` + `popstate`.

---

## 13. Documentação

- [PLANO.md](PLANO.md) — desenho, decisões, status e pendências (histórico mais detalhado).
- [README.md](README.md) — como rodar, subir e o que cada fluxo faz.
- [docs/analise-bridge-favo.md](docs/analise-bridge-favo.md) — análise do Bridge original e calibragem com a
  conta real.
- [docs/referencia-dashboard-v2/](docs/referencia-dashboard-v2/) — referência de **outro** projeto (visual,
  sidebar, convenções). Serve: `docs/ai/design-system.md`, `docs/ai/componentes.md`, `docs/ai/boas-praticas.md`,
  `prompt-sidebar.md`. O resto é do domínio de compras/estoque daquele projeto — não é regra daqui.
