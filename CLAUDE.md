# Briefing do projeto (para IA e devs)

Documento canônico deste repositório. Onde outro arquivo divergir daqui ou do código, vale este e o código.
Plano, decisões e status das fases: [PLANO.md](PLANO.md).

## Projeto

**Octadesk Plus** é o motor de réguas de WhatsApp da Skytech em cima do **metrics** (o CRM: clientes do
Sankhya, vendas, créditos, curvas ABC, alertas de comportamento, conversas do Octadesk e a classificação de IA
delas), enviando pelo **Octadesk**. Nasceu como clone do Bridge da Favo e substitui esse serviço.

- Uma empresa só. **Login, usuários e permissões são os do metrics** — não existe cadastro próprio. Num Supabase
  próprio (`supabase/base/`), a base recria essas tabelas vazias e a tela de login oferece **Primeiro acesso**
  só enquanto `octaplus.primeiro_acesso()` (única função liberada para `anon`) for verdadeira.
- Gatilhos: detectores sobre as tabelas do metrics, webhooks de conversa do Octadesk e webhook externo
  (inclusive as campanhas do metrics, que usam o mesmo contrato `X-Bridge-Secret` do Bridge).
- Sem site institucional, planos ou cobrança. Pipedrive, HubSpot, Zoho, Trello e YCloud foram descartados de
  propósito — não reintroduzir sem pedido explícito.

### Idioma

Tudo em português do Brasil: interface, mensagens de erro, comentários, nomes de tabelas/colunas/funções do
domínio (`automacoes`, `registrar_evento`, `horario_comercial`) e documentação. Inglês só onde o ecossistema
impõe ou o nome já existe no metrics (`clients`, `sales`, `has_permission`).

## Stack

| Camada | O que é |
|---|---|
| Front | Vite + React 19 + TypeScript + Tailwind v4 + react-router 7 + lucide-react |
| Banco | Supabase do metrics; tudo do Octadesk Plus no schema **`octaplus`**, com RLS e pg_cron |
| Motor | n8n: entrada de webhooks, executor por minuto, validação/catálogos/token, API pública |

## Comandos

```bash
npm test                      # testes do banco (PGlite) + dos Code nodes do n8n
npm run db:test               # só o banco
npm run n8n:test              # só os Code nodes
npm run n8n:build             # regera n8n/fluxos/*.json a partir de n8n/codigo/*.js
npm run web:dev               # painel em http://localhost:5173
npm --prefix web run build    # tsc -b + vite build
```

## Arquitetura

```
web/src/
  app/        telas do painel + sidebar (Sidebar, SidebarFooter, nav.ts, sidebar.css)
  auth/       entrar e redefinir senha (usuários do metrics)
  components/ ui.tsx, LogoOctadesk.tsx
  lib/        supabase.ts (cliente no schema octaplus), session.tsx, types.ts, constants.ts, demo.ts
supabase/migrations/   schema octaplus: tabelas, funções, RLS, pg_cron — em ordem lexicográfica
supabase/tests/        stub das tabelas do metrics + testes em PGlite
n8n/codigo/            JS dos Code nodes (fonte de verdade)
n8n/fluxos/            JSONs gerados; nunca editar à mão
n8n/tests/             Code nodes rodando contra um Octadesk simulado
```

**Regra de ouro do motor:** a lógica de negócio mora no Postgres. O n8n só faz entrada e saída.

Caminho de um evento: detector (`candidatos` → `detectar_eventos`, pg_cron a cada 5 min) **ou**
`receber_octadesk` / `receber_webhook` → **`registrar_evento`** (contexto do cliente, telefone, não perturbe,
condições, limite de contato, deduplicação, agenda uma execução por ação) → `pegar_execucoes` a cada minuto →
`executor.js` fala com o Octadesk → `concluir_execucao` (grava `envios`) → `atualizar_atribuicao` de hora em
hora (respondeu / comprou).

## Padrões do projeto

1. **O metrics é só leitura.** O schema `octaplus` lê `public.*` por funções `security definer` e nunca
   escreve lá. Colunas do metrics que o octaplus usa estão espelhadas em `supabase/tests/stub-metrics.sql`;
   se o metrics mudar, o stub muda junto.
2. **Ligar uma régua não dispara sobre o histórico.** `automacoes.ativa_desde` é gravado na ativação e os
   detectores só olham o que venceu depois disso (e dentro de `janela_deteccao_horas`).
3. **Todo evento passa por `registrar_evento`.** Evento barrado é gravado como `ignorado` com motivo — aparece
   nas estatísticas e não é reavaliado. Não criar atalhos que agendem execução sem passar por ele.
4. **Segredo nunca volta para o navegador** — `octaplus.segredos` tem RLS sem policy; o front grava por
   `salvar_integracao` e só o n8n lê, via `credenciais_octadesk()`.
5. **Funções do motor têm `revoke execute ... from public, anon, authenticated`** no fim da migration 3.
   Função nova do motor entra nessa lista; função do painel checa `octaplus.pode('editar')` no topo.
6. **Permissão é a do metrics**: `octaplus.pode(acao)` = `public.has_permission(auth.uid(), 'octaplus', acao)`,
   ações `ver` e `editar`. Dono e superadmin passam sempre.
7. **O navegador não chama o n8n.** Validar integração e sincronizar catálogo são pedidos pelo banco
   (`salvar_integracao`, `pedir_sincronizacao`); o fluxo de manutenção atende no próximo minuto.
8. **Fila com `FOR UPDATE SKIP LOCKED`**; execução travada há 10 min volta; `pendente` retenta com backoff
   (5/10/15 min) e vira `erro` na 3ª tentativa; 4xx é definitivo, 5xx/429/rede retentam; erro da Meta vem no
   corpo 2xx do `send-template` e é definitivo.
9. **Horário comercial no formato do app original** — `perDay["0".."6"]` (0 = domingo) com lista de janelas.
10. **Editar Code node é editar `n8n/codigo/*.js`** e rodar `npm run n8n:build`.
11. **Menu vem de `web/src/app/nav.ts`**: principal só **Automações**; a **home** (banner + estatísticas) é pelo
    logo; **Configurações** (rodapé) tem as abas Integrações · Empresa · Usuários · API · Não perturbe
    (Usuários é só leitura, via `listar_usuarios()`); **Meu perfil** no card do
    usuário. Rota nova nasce com verbete em `AJUDA`.
12. **Modo demonstração isolado** — `VITE_DEMO=1` troca o cliente Supabase por memória (`lib/demo.ts`), com o
    mesmo formato das tabelas `octaplus`. Nenhuma tela tem `if (DEMO)`.

## Octadesk — o que usar

- **API pública** (`{base_url}`, headers `X-API-KEY` + `octa-agent-email`): `/auth/check`, `/chat/numbers`,
  `/chat/templates-message`, `/chat/send-template` (variáveis em `[{key, value}]`), `/chat` com filtros,
  `/chat/{id}/messages` (`type` public/internal), `/chat/{id}/tags` (substitui a lista), `/chat/{id}/custom-fields`,
  `/tickets/groups`, `/tickets/tags`. Referência: developers.octadesk.com.
- **API privada** (só transferência de fila): `PUT us-east1-001.prod.octadesk.services/chat/rooms/{id}/group/{g}`
  com JWT de `nucleus-auth/auth`. Pode mudar sem aviso; por isso é opcional na integração.
- **Webhooks de conversa** não são documentados publicamente nem assinados; usamos `room.after-close`,
  `room.after-set-agent` e `room.after-insert-message`, com o segredo no caminho da URL.

## Marca

O painel se chama **Octadesk Plus**, com o logo oficial em SVG (`web/src/components/LogoOctadesk.tsx`,
extraído de octadesk.com, traços em `currentColor`) seguido de um "+" e a paleta azul deles. Nome e logo são
marca de terceiro: para uso interno, tudo bem; oferecido a clientes, o caminho é nome próprio com menção de
compatibilidade ou autorização por escrito. Trocar a marca é editar `BRAND` em `lib/constants.ts`, os tokens
do `@theme` e o `--primary` da sidebar.

## Estilo e UI

Tailwind v4, tokens no `@theme` de `web/src/index.css` — azul `#1366c9`, azul escuro `#29354d`, fundo
`#f3f8fe`, Poppins nos títulos; nomes neutros (`brand`, `brand-soft`, `brand-hover`). Utilitários `btn-primary`,
`btn-ghost`, `input`, `label`, `card`, `chip` são `@utility` ali.

A sidebar é a exceção: CSS puro em `web/src/app/sidebar.css`, sob o escopo `.painel`, com derivados por
`color-mix`. Especificação: [docs/referencia-dashboard-v2/prompt-sidebar.md](docs/referencia-dashboard-v2/prompt-sidebar.md).

Ícones: `lucide-react`, 20px/`strokeWidth 1.8` no menu. Nada por CDN.

## Env

`web/.env.local` (não versionado): `VITE_DEMO`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (do
Supabase do metrics), `VITE_N8N_WEBHOOK_URL`. Só chave publishable/anon chega ao navegador. O PostgREST precisa
expor o schema `octaplus`.

## Feature nova

Ciclo: prova que falha → implementação mínima → limpeza com a prova ainda passando.

- **SQL**: teste em `supabase/tests/testar.mjs` (PGlite + stub do metrics). Cobrir o caminho feliz **e** as
  negativas: fora da janela, condição não atendida, duplicado, não perturbe, limite de contato, usuário sem
  permissão (RLS devolve zero linha / RPC recusa). Coluna nova do metrics lida pelo octaplus entra no stub.
- **Code node**: teste em `n8n/tests/testar-codigo.mjs`, com o Octadesk simulado por rota.
- **Tela**: `npm --prefix web run build` e abrir no navegador em modo demonstração.

Não declarar pronto porque compilou.

## Checklist pós-implementação

- `npm test` e `npm --prefix web run build` limpos.
- Mexeu em `n8n/codigo/`? `npm run n8n:build`.
- Função nova do motor? Na lista de `revoke execute`. Função do painel? Checa `pode()` e tem `grant`.
- Tela nova? Rota + `nav.ts`/abas + verbete em `AJUDA`.
- Removeu um conceito? Varrer front, SQL, Code nodes, fluxos gerados, demo e docs pelo nome.
- Mudou comportamento? Atualizar `PLANO.md` (status) ou `README.md`.

## Problemas recorrentes

1. **`$$` some em `String.replace`** — `$$` no replacement vira `$`; o erro aparece como
   `syntax error at or near "declare"`. Use função de substituição ou a ferramenta de edição.
2. **Escape em string JS dentro do gerador de fluxos** — `"\s"` vira `s`; em expressões n8n escritas dentro de
   string no `montar-fluxos.js`, use `\\s`. Os testes do n8n não pegam isso: confira a expressão gerada.
3. **`pgcrypto` no Supabase fica no schema `extensions`** — função com `search_path` restrito que usa
   `digest`/`gen_random_bytes` precisa de `search_path = octaplus, extensions, public`.
4. **`.nav-item:hover` usa o shorthand `background`** — item com imagem de fundo repete `background-image`.
5. **Painel de preview**: navegar direto para uma rota recarrega na raiz; use `history.pushState` + `popstate`.

## Documentação

- [PLANO.md](PLANO.md) — desenho, decisões, status e pendências.
- [README.md](README.md) — como rodar, subir e o que cada fluxo faz.
- [docs/analise-bridge-favo.md](docs/analise-bridge-favo.md) — análise do Bridge original e calibragem com a conta real.
- [docs/referencia-dashboard-v2/](docs/referencia-dashboard-v2/) — referência de outro projeto (visual, sidebar,
  convenções); o resto dela é de outro domínio.
