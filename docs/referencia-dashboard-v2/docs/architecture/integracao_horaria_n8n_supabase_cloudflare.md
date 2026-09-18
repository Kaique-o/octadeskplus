# Arquitetura horaria do Dashboard de Compras

## Fluxo de dados

```text
Sankhya
  -> n8n Schedule Trigger
  -> DbExplorerSP.executeQuery
  -> normalizacao
  -> Supabase RPC ingest_dashboard_dataset
  -> tabelas canonicas e snapshots
  -> RPCs get_* autenticadas
  -> frontend
```

O frontend nao chama o n8n. O n8n nao responde consultas do usuario. Ele atua apenas como ETL horario e usa a service role somente no ambiente protegido do n8n.

## Serializacao

Os 14 workflows iniciam nos minutos:

```text
01 05 09 13 17 21 25 29 33 37 41 45 49 53
```

O ambiente do n8n deve possuir:

```env
N8N_CONCURRENCY_PRODUCTION_LIMIT=1
GENERIC_TIMEZONE=America/Sao_Paulo
EXECUTIONS_DATA_SAVE_ON_SUCCESS=none
EXECUTIONS_DATA_PRUNE=true
EXECUTIONS_DATA_MAX_AGE=168
```

O limite de concorrencia igual a 1 e obrigatorio. Os minutos diferentes reduzem disputa, mas nao substituem o limite global quando uma consulta demora alem do proximo horario.

## Persistencia

Datasets canonicos:

- `produtos`
- `radar_estoque`
- `sugestoes_compra`
- `estoque_produto_diario`
- `rupturas`, derivada do estoque diario
- `transferencias_eventos`
- `recebimentos_eventos`
- `budget_mensal`
- `fornecedores_snapshot_diario`
- `fornecedores_followups`

Consultas antigas exclusivamente diagnosticas usam `integracao_snapshots`, com retencao de sete dias.

Todas as execucoes passam por `ingest_dashboard_dataset` e registram resultado em `logs_integracao`.

## Cloudflare

O Cloudflare Pages publica os arquivos de `dist` e a pasta raiz `functions`.

As Pages Functions atuais sao:

```text
POST /api/skyler/chat
GET /api/health
```

Ela valida a sessao no Supabase, nao encaminha o bearer do usuario para o backend externo e nao participa da carga do dashboard.
