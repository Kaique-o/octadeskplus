# Octadesk Plus

Motor de réguas de WhatsApp em cima do **metrics** (o CRM da Skytech), enviando pelo **Octadesk**.
Um evento do metrics (venda, orçamento sem compra, alerta de comportamento, curva, crédito…), do Octadesk
(conversa encerrada/atribuída/nova mensagem) ou de um webhook dispara ações: template de WhatsApp, mensagem,
nota interna, tags, campo da conversa e transferência de fila.

- Plano e decisões: **[PLANO.md](PLANO.md)** · Padrões para quem for mexer: **[CLAUDE.md](CLAUDE.md)**

## Estrutura
```
web/                    Painel (Vite + React + Tailwind); login e usuários são os do metrics
supabase/
  migrations/           schema `octaplus` — tabelas, funções (regras, detectores, fila), RLS e pg_cron
  tests/                testes do schema em Postgres embarcado, com um stub das tabelas do metrics
n8n/
  codigo/               JS dos Code nodes (executor e manutenção) — edite aqui
  fluxos/               JSONs importáveis, gerados por montar-fluxos.js
  tests/                testes dos Code nodes com o Octadesk simulado
docs/                   documentação de referência
```

## Como funciona
```
metrics (public.*) ──SQL──▶ detectores (pg_cron, 5 min) ─┐
Octadesk webhooks ──▶ n8n Entrada ──▶ receber_octadesk() ├─▶ registrar_evento() ─▶ execucoes (fila)
POST externo / campanhas ──▶ n8n Entrada ──▶ receber_webhook() ┘        │
                                                                      ▼
                                   n8n Executor (1 min) ─▶ Octadesk (API pública + privada) ─▶ envios
```
Regras (horário comercial, condições, não perturbe, limite de contato, deduplicação, retentativa) ficam no
Postgres. O n8n só conversa com o Octadesk.

## Rodar
```bash
npm install                   # dependências dos testes (PGlite)
npm test                      # testes do banco + dos Code nodes
npm --prefix web install
npm run web:dev               # painel em http://localhost:5173
```
`web/.env.local` com `VITE_DEMO=1` abre o painel direto, com dados em memória. Para usar de verdade, tire o
`VITE_DEMO` e preencha `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (do Supabase do metrics) e
`VITE_N8N_WEBHOOK_URL`.

## Publicar o painel (Cloudflare Pages)
No painel da Cloudflare: **Workers & Pages › Create › Pages › Connect to Git** e escolha este repositório.

| Campo | Valor |
|---|---|
| Framework preset | Vite (ou None) |
| Root directory | `web` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Variáveis de ambiente | `VITE_DEMO` = `1` para a demonstração; para usar de verdade, no lugar dela: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_N8N_WEBHOOK_URL` |

As variáveis `VITE_*` entram **no build** (o Vite grava no JavaScript): mudou uma, é preciso refazer o deploy.
A versão do Node vem de `web/.node-version`. Rotas como `/app/automacoes` funcionam porque, sem `404.html`,
o Pages devolve o `index.html` e o React Router assume.

## Subir o backend
1. **Banco** — no Supabase do metrics, aplicar `supabase/migrations/*` em ordem e **expor o schema `octaplus`**
   no PostgREST (Settings › API › Exposed schemas; self-hosted: `PGRST_DB_SCHEMAS`).
   **Supabase próprio (sem o metrics):** `npm run db:instalacao` gera `supabase/instalar-projeto-proprio.sql`
   (pg_cron + `supabase/base/base-projeto-proprio.sql` + migrations); colar no SQL Editor de um projeto vazio.
   A base cria vazias as tabelas do metrics que o octaplus lê. Enquanto não houver usuário, a tela de login abre em
   **Primeiro acesso** (cria a conta dona); os seguintes entram sem acesso. Em Authentication › URL Configuration,
   pôr a URL do painel em Site URL e em Redirect URLs (links de confirmação e de redefinir senha); depois do
   primeiro acesso, desligar "Allow new users to sign up" (Add user/Invite no painel do Supabase continuam). Os gatilhos de conversa e o webhook externo funcionam; os detectores
   de vendas/créditos/curvas não acham nada até essas tabelas terem dados.
2. **Permissões** — dono/superadmin do metrics já entram. Para outros perfis de acesso, adicionar o recurso
   `octaplus` com as ações `ver` e/ou `editar`.
3. **n8n** — credencial Postgres "Supabase Postgres" apontando para o banco do metrics, depois:
   ```bash
   npm run n8n:build
   N8N_URL=... N8N_API_KEY=... npm run n8n:import
   ```
   Ativar os quatro fluxos.
4. **Octadesk** — no painel, Configurações › Integrações: URL da API, e-mail do agente e chave. Em até um minuto
   a integração valida e sincroniza números, templates, filas e tags. Para eventos de conversa, cadastrar no
   Octadesk a URL mostrada na mesma tela.

## Fluxos n8n
| Fluxo | Gatilho | Função |
|---|---|---|
| Entrada (webhooks) | `POST /webhook/octaplus/in/:id` e `POST /webhook/octaplus/octadesk/:segredo` | registra eventos externos e do Octadesk |
| Executor | a cada minuto | executa as ações vencidas no Octadesk e fecha cada execução |
| Validação, catálogos e token | a cada minuto (só age quando precisa) | valida a chave, sincroniza catálogos, renova o JWT da API privada |
| API pública /v1/format | `POST /webhook/octaplus/v1/format` | normaliza telefone com chave `br_live_*` |
