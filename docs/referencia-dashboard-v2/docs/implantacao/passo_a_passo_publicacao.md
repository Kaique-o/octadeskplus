# Passo a passo para publicar

Estado em 2026-07-30. Faça na ordem. Cada etapa tem como conferir se deu certo.

| sistema    | situação                                                                       |
| ---------- | ------------------------------------------------------------------------------ |
| Supabase   | pronto, nada a fazer                                                           |
| n8n        | 14 fluxos criados e inativos; faltam credenciais e teste                       |
| Cloudflare | nada publicado ainda                                                           |
| git        | branch `feat/integracao-n8n-supabase-zero`, commit `178c5dd`, versão `1.10.18` |

---

## Etapa 1 — n8n: cadastrar as 5 variáveis

`https://automacao.skylinemobile.com.br` -> **Settings -> Variables**

```text
SANKHYA_X_TOKEN              (seu token Sankhya)
SANKHYA_CLIENT_ID            (seu client id)
SANKHYA_CLIENT_SECRET        (seu client secret)
SUPABASE_URL                 https://hldeqhkcnbywtorijhvl.supabase.co
SUPABASE_SERVICE_ROLE_KEY    Supabase -> Project Settings -> API -> service_role
```

O `service_role` só pode existir aqui. Nunca no frontend, nunca no git.

**Conferir**: rode o workflow `Kaique - Dashboard Compras - DIAGNOSTICO VARIAVEIS`
(`ivmImKwQvK9Cbccw`). Ele mostra só os nomes, nunca os valores. Tem que sair
`"total_variaveis": 5` e todas as 5 com `"definida": true`.

---

## Etapa 2 — n8n: liberar acesso MCP nos 14 fluxos

Ao importar pela API, o n8n desligou o flag de MCP. Em cada card de workflow (ou em
Workflow settings), ligue **Available in MCP**.

Sem isso eu não consigo executar nem testar os fluxos por aqui — o n8n responde
`Workflow is not available in MCP`.

---

## Etapa 3 — n8n: concorrência 1 no serviço

No host onde o n8n roda:

```bash
docker compose exec n8n printenv N8N_CONCURRENCY_PRODUCTION_LIMIT
```

Precisa responder `1`. Se não responder, aplique o override e reinicie:

```yaml
services:
  n8n:
    environment:
      GENERIC_TIMEZONE: America/Sao_Paulo
      TZ: America/Sao_Paulo
      N8N_CONCURRENCY_PRODUCTION_LIMIT: '1'
      EXECUTIONS_DATA_SAVE_ON_SUCCESS: none
      EXECUTIONS_DATA_SAVE_ON_ERROR: all
      EXECUTIONS_DATA_PRUNE: 'true'
      EXECUTIONS_DATA_MAX_AGE: '168'
    restart: unless-stopped
```

Enquanto isso não estiver confirmado, o não-paralelismo depende só do espaçamento de
4 minutos entre os crons.

---

## Etapa 4 — n8n: apagar o fluxo legado

`lShhy6dU0KbJQqqx` — `Kaique - Dashboard Compras - TRANSFERENCIAS EVENTOS` (maiúsculas).

É a versão antiga, com **webhook público**, proibida pelas regras. O correto é o
`Om34WCpxJPrMPyut` (`Transferencias Eventos`, com schedule `37 * * * *`). Confira e apague
o antigo.

---

## Etapa 5 — testar e ativar (eu faço, depois das etapas 1 e 2)

Para cada um dos 14: executar manual, medir duração, conferir `logs_integracao` no
Supabase, repetir com o mesmo `execucao_id` para provar idempotência, e só então ativar.

Query de conferência:

```sql
select endpoint, status, registros_recebidos, registros_processados,
       registros_com_erro, duracao_ms, execucao_id, data_execucao
from public.logs_integracao
order by data_execucao desc
limit 30;
```

Hoje essa tabela tem **0 linhas**.

---

## Etapa 6 — Cloudflare Pages: variáveis do projeto

Painel Cloudflare -> Workers & Pages -> projeto `dashboard-compras` -> Settings ->
Environment variables.

Variáveis normais:

```text
SUPABASE_URL          https://hldeqhkcnbywtorijhvl.supabase.co
SUPABASE_ANON_KEY     Supabase -> Project Settings -> API -> anon / publishable
SKYLER_UPSTREAM_URL   endpoint privado da Skyler
SKYLER_API_HEADER     nome do header de auth do upstream
SKYLER_TIMEOUT_MS     30000
```

Secret (marque como **Encrypt**):

```text
SKYLER_API_TOKEN
```

`SUPABASE_URL` e `SUPABASE_ANON_KEY` precisam existir **no build**, senão o
`dist/js/core/config.js` sai vazio e o front não conecta. O build avisa:
`[build] aviso: SUPABASE_URL ou SUPABASE_ANON_KEY nao definidas`.

A anon key é pública por natureza e pode ficar no bundle. O service role **não**.

---

## Etapa 7 — Cloudflare Pages: publicar

Hoje `https://dashboard-compras.pages.dev/api/health` devolve **HTML**, não JSON: as
Functions nunca foram publicadas. E o push da branch **não** gerou preview, o que indica
que o projeto Pages não está conectado ao GitHub.

Escolha um caminho:

**A) Conectar ao Git (recomendado)** — Pages -> Settings -> Builds & deployments ->
Connect to Git, repositório `Kaique-o/dashboard-compras`. Configure:

```text
Build command:        npm run build
Build output:         dist
Root directory:       /
```

Cada push na branch gera preview; o merge na `main` gera produção.

**B) Publicar direto pela CLI**, sem conectar Git:

```bash
npm ci
npm run build
npx wrangler pages deploy dist --project-name=dashboard-compras --branch=feat/integracao-n8n-supabase-zero
```

Pede login no Cloudflare na primeira vez.

---

## Etapa 8 — confirmar o deploy pelo endpoint

```bash
curl -s https://<url-do-deploy>/api/health
```

Tem que voltar JSON assim:

```json
{
  "ok": true,
  "app": "dashboard-compras",
  "version": "1.10.18",
  "architecture": "frontend-supabase-n8n-etl",
  "cloudflare_function": true,
  "branch": "feat/integracao-n8n-supabase-zero",
  "commit": "178c5dd..."
}
```

Ou pelo script do projeto:

```bash
APP_URL=https://<url-do-deploy> npm run check:cloudflare:deployed
```

Se voltar HTML, as Functions não subiram — não considere publicado.

---

## Etapa 9 — liberar os usuários no dashboard

A migration de segurança é **fail-closed**: usuário novo nasce sem acesso a nenhum
módulo e sem empresa. Hoje existem 3 usuários e 1 empresa (`Todas`).

Entre como admin em **Configuração -> Permissões** e, para cada usuário, marque os
módulos e as empresas. Sem isso a pessoa loga e não vê dado nenhum — e isso é o
comportamento correto, não um bug.

---

## Etapa 10 — merge

Só depois que o health responder certo e os 14 fluxos estiverem ativos e gravando:

```bash
gh pr create --base main --head feat/integracao-n8n-supabase-zero \
  --title "feat: integracao horaria n8n -> supabase -> cloudflare 1.10.18"
```

Sem merge automático e sem force push.

---

## Resumo do que depende de você

1. cadastrar as 5 variáveis no n8n
2. ligar **Available in MCP** nos 14 fluxos
3. confirmar `N8N_CONCURRENCY_PRODUCTION_LIMIT=1` no container
4. apagar o fluxo legado `lShhy6dU0KbJQqqx`
5. configurar as variáveis do Pages e publicar
6. liberar módulos e empresas dos usuários

Feitos 1 e 2, eu assumo o teste dos 14, a ativação e a verificação do health.
