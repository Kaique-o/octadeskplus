# n8n Community: por que saímos de `$vars` para Credentials

## O problema

O pacote 1.10.17 monta os 14 workflows usando `{{ $vars.SANKHYA_CLIENT_ID }}` e afins.
**`Variables` é recurso Enterprise do n8n.** Na instância usada (Community), `$vars`
existe mas resolve sempre vazio — por isso o `authenticate` do Sankhya devolvia
`401 invalid_client` com o corpo saindo só com `grant_type`.

Provado por execução real, workflow `ivmImKwQvK9Cbccw`:

- execução `58877`: `{"total_variaveis": 0, "nomes_existentes": []}`

A alternativa óbvia seria `$env`, lendo do `.env` do container. Também não serve —
execução `58908`, sondando nomes que certamente existem (`PATH`, `HOME`, `N8N_PORT`):

```text
access to env vars denied
```

A instância roda com `N8N_BLOCK_ENV_ACCESS_IN_NODE` ativo.

## A solução

**Credentials.** Funcionam em qualquer edição, ficam criptografadas no banco do n8n e
**não aparecem no JSON do workflow** — ou seja, atendem melhor a regra de "nenhum
workflow pode expor credenciais" do que `$vars` atendia.

A migração foi feita por script (`scripts/migrar-workflows-para-credentials.mjs`),
mecanicamente, nó a nó. O script aborta se o SQL de qualquer query mudar um byte.

| nó                  | antes                                                                      | depois                                                                                            |
| ------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `gerar_bearer_*`    | header `X-Token` + body `client_id`/`client_secret` via `$vars`            | `httpCustomAuth` → credencial `Sankhya Auth (Custom)`; body só com `grant_type`                   |
| `consultar_*`       | header `X-Token` via `$vars`                                               | `httpHeaderAuth` → credencial `Sankhya X-Token (Header)`; Bearer continua vindo do nó anterior    |
| `gravar_supabase_*` | URL via `$vars.SUPABASE_URL`, headers `apikey`/`Authorization` via `$vars` | URL fixa (não é segredo) + `httpCustomAuth` → credencial `Supabase Compras Service Role (Custom)` |

`SUPABASE_URL` deixou de ser variável: é URL pública do projeto e agora está fixa como
`https://hldeqhkcnbywtorijhvl.supabase.co/rest/v1/rpc/ingest_dashboard_dataset`.

## As 3 credenciais que você precisa criar

No n8n: **Credentials → Add credential**. Os valores só existem aqui.

### 1. `Sankhya Auth (Custom)` — tipo **Custom Auth**

```json
{
  "headers": { "X-Token": "SEU_X_TOKEN" },
  "body": { "client_id": "SEU_CLIENT_ID", "client_secret": "SEU_CLIENT_SECRET" }
}
```

### 2. `Sankhya X-Token (Header)` — tipo **Header Auth**

```text
Name:  X-Token
Value: SEU_X_TOKEN
```

### 3. `Supabase Compras Service Role (Custom)` — tipo **Custom Auth**

```json
{
  "headers": {
    "apikey": "SERVICE_ROLE_KEY",
    "Authorization": "Bearer SERVICE_ROLE_KEY"
  }
}
```

O `service_role` sai de Supabase → Project Settings → API. Ele só pode existir aqui
dentro — nunca no frontend, nunca no git.

Os nomes precisam bater exatamente com os da tabela acima, senão o vínculo não fecha.

## Depois de criar

Os JSONs referenciam as credenciais **pelo nome**, mas o n8n vincula por **id**. Assim
que as 3 existirem, me avise: eu leio os ids pelo MCP (`list_credentials` devolve id e
nome, nunca o segredo), injeto nos 14 JSONs e reimporto. Aí o vínculo fica fechado sem
você precisar abrir 14 workflows na mão.

Alternativa manual: abrir cada workflow e escolher a credencial nos 3 nós HTTP.

## Validação

`scripts/validate-n8n-dashboard-c.mjs` foi atualizado e agora **reprova** qualquer
workflow que ainda use `$vars.` ou `$env.`, e exige que os 3 nós HTTP tenham
`authentication: genericCredentialType` com o tipo e a credencial corretos.
