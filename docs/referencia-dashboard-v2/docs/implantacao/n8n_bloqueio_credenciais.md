# n8n - bloqueio real encontrado em 2026-07-30

## resumo

A implantacao dos 14 workflows horarios **nao pode ser concluida e muito menos ativada** porque a
instancia do n8n nao possui as variaveis de ambiente do Sankhya configuradas. Isso foi comprovado com
uma execucao real, nao por inspecao de arquivo.

## evidencia

Execucao manual do unico workflow do dashboard existente na instancia:

- workflow: `lShhy6dU0KbJQqqx` — `Kaique - Dashboard Compras - TRANSFERENCIAS EVENTOS`
- execucao: `58445`, modo `manual`
- inicio: `2026-07-30T09:20:42.248Z`
- fim: `2026-07-30T09:20:42.423Z`
- duracao: **175 ms**
- status final: **erro**
- registros recebidos: **0**
- registros gravados no Supabase: **0**

No do erro: `gerar_bearer_transferencias_eventos` (HTTP Request para `https://api.sankhya.com.br/authenticate`)

```text
401 - {"error":"invalid_client","error_description":"Invalid client or Invalid client credentials"}
```

O corpo efetivamente enviado pelo n8n foi:

```text
form: { "grant_type": "client_credentials" }
```

`client_id` e `client_secret` **nao aparecem no corpo**. As expressoes `{{ $vars.SANKHYA_CLIENT_ID }}` e
`{{ $vars.SANKHYA_CLIENT_SECRET }}` resolveram para vazio, ou seja, as variaveis **nao existem** nesta
instancia do n8n. O mesmo vale para `SANKHYA_X_TOKEN`.

## segundo problema encontrado na mesma execucao

O workflow `lShhy6dU0KbJQqqx` que esta hoje na instancia **nao corresponde ao arquivo do pacote 1.10.17**.
O trigger real e:

```text
receber_transferencias_eventos  ->  n8n-nodes-base.webhook
```

Ou seja, e uma versao antiga com **webhook publico**, exatamente o que as regras proibem para os fluxos de
ETL. O arquivo do pacote (`integrations/n8n/dashboard_c/workflows/10_transferencias-eventos.json`) usa
`scheduleTrigger` com cron `37 * * * *` e nao possui webhook. Esse workflow precisa ser substituido.

## prova definitiva: a instancia tem ZERO variaveis

Criei um workflow de diagnostico que lista apenas os **nomes** das variaveis, nunca os valores:

- workflow: `ivmImKwQvK9Cbccw` — `Kaique - Dashboard Compras - DIAGNOSTICO VARIAVEIS`
- execucao: `58491`, status **success**

Resultado:

```json
{
  "total_variaveis": 0,
  "nomes_existentes": [],
  "esperadas": {
    "SANKHYA_X_TOKEN": { "definida": false, "tamanho": 0 },
    "SANKHYA_CLIENT_ID": { "definida": false, "tamanho": 0 },
    "SANKHYA_CLIENT_SECRET": { "definida": false, "tamanho": 0 },
    "SUPABASE_URL": { "definida": false, "tamanho": 0 },
    "SUPABASE_SERVICE_ROLE_KEY": { "definida": false, "tamanho": 0 }
  }
}
```

Ou seja: nao e nome errado nem valor errado. **Nenhuma variavel existe na instancia.**

Esse workflow de diagnostico pode ser apagado depois de resolvido.

## o que isso impede

Sem as variaveis, nenhum dos 14 fluxos consegue autenticar no Sankhya. Portanto e impossivel, hoje:

- executar o teste individual exigido por workflow;
- registrar registros recebidos e registros gravados com numeros reais;
- ativar qualquer fluxo (a regra exige teste aprovado antes da ativacao).

Ativar os 14 fluxos neste estado agendaria 14 execucoes falhas por hora contra a producao.

## workflows criados via MCP

| id                 | nome                                               | nos | schedule     | situacao                     |
| ------------------ | -------------------------------------------------- | --- | ------------ | ---------------------------- |
| `ivmImKwQvK9Cbccw` | Kaique - Dashboard Compras - DIAGNOSTICO VARIAVEIS | 2   | manual       | temporario, pode ser apagado |
| `GAFBuWm2vhfQQuKJ` | Kaique - Dashboard Compras - Cadastro de Parceiros | 5   | `21 * * * *` | **inativo**, cadeia validada |

O `GAFBuWm2vhfQQuKJ` foi executado (execucao `58500`): falhou em **157 ms** no mesmo ponto de
autenticacao, confirmando que a cadeia schedule -> auth -> DbExplorerSP -> normalizacao -> ingest esta
corretamente ligada e que o unico impedimento e a credencial.

## os outros 13: use o importador

Transcrever os 14 workflows pelo MCP exigiria passar cerca de **271 mil caracteres de SQL** pelo contexto do
modelo, com risco real de erro de transcricao. O caminho correto e o importador incluido no repositorio, que
sobe os JSONs **byte-exatos**:

```bash
N8N_URL=https://automacao.skylinemobile.com.br N8N_API_KEY=<sua-chave> node scripts/import-n8n-workflows.mjs
```

O script:

- valida offline com `--dry-run` (ja testado: 14 workflows, 14 minutos exclusivos);
- e idempotente — cria por nome ou atualiza quem ja existe, entao pode rodar quantas vezes quiser;
- desativa antes de atualizar um workflow que estiver ativo;
- recusa qualquer workflow com webhook, sem schedule horario ou fora do padrao `Kaique - `;
- **nunca ativa nada**;
- le a chave do ambiente e nunca a imprime.

Rodando o script, o workflow `lShhy6dU0KbJQqqx` (versao antiga com webhook) nao e reaproveitado: o nome do
arquivo do pacote e `Kaique - Dashboard Compras - Transferencias Eventos`, diferente do
`... - TRANSFERENCIAS EVENTOS` que esta na instancia. Apague o antigo manualmente apos conferir.

## o que precisa ser feito por quem tem os segredos

Estas variaveis devem ser cadastradas **pelo proprio dono da instancia**, na area de Variables do n8n
(ou nas variaveis de ambiente do servico). Os valores nunca devem ser colados em arquivo do repositorio
nem em chat:

- `SANKHYA_X_TOKEN`
- `SANKHYA_CLIENT_ID`
- `SANKHYA_CLIENT_SECRET`
- `SUPABASE_URL` — `https://hldeqhkcnbywtorijhvl.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` — service role do projeto `dashboard-compras`

O `SUPABASE_SERVICE_ROLE_KEY` deve existir **somente** no ambiente protegido do n8n. Ele nao aparece em
nenhum arquivo do repositorio e nao deve aparecer.

## configuracao de ambiente que tambem nao pode ser aplicada daqui

As variaveis abaixo sao do processo do n8n e nao sao expostas nem alteraveis pelo MCP. Nao ha Docker nesta
maquina, entao **nao foi possivel aplicar nem confirmar** que estao ativas no container/servico:

```env
GENERIC_TIMEZONE=America/Sao_Paulo
N8N_CONCURRENCY_PRODUCTION_LIMIT=1
EXECUTIONS_DATA_SAVE_ON_SUCCESS=none
EXECUTIONS_DATA_PRUNE=true
EXECUTIONS_DATA_MAX_AGE=168
```

O repositorio ja traz o modelo pronto em `integrations/n8n/docker-compose.override.yml.example` e
`integrations/n8n/.env.example`, e o validador `scripts/validate-n8n-dashboard-c.mjs` confirma o conteudo
desses arquivos. Mas **arquivo de exemplo nao e prova de aplicacao no servico** — a confirmacao precisa ser
feita no host do n8n, por exemplo:

```bash
docker compose exec n8n printenv N8N_CONCURRENCY_PRODUCTION_LIMIT
```

Enquanto `N8N_CONCURRENCY_PRODUCTION_LIMIT=1` nao for confirmado no servico, a regra de "nenhum workflow
executa junto com outro" esta garantida apenas pelo espacamento de 4 minutos entre os crons, e nao pelo
limite de concorrencia.
