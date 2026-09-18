# Handoff: criar os workflows restantes no n8n

Pacote gerado em 2026-07-30. Leia inteiro antes de agir.

Você vai terminar a implantação do ETL **Sankhya -> n8n -> Supabase** do projeto `dashboard-compras`.
O banco já está pronto e validado. O que falta é o n8n e o deploy do Cloudflare.

---

## 1. Arquitetura (não invente outra)

```text
sankhya
  -> n8n executa os fluxos de hora em hora
  -> n8n grava no supabase via RPC ingest_dashboard_dataset
  -> frontend consulta somente o supabase
  -> cloudflare publica o frontend e as functions
```

O frontend **nunca** chama o n8n. O n8n é só ETL. O service role do Supabase existe **só** dentro do n8n.

---

## 2. Regras que não podem ser quebradas

- todo workflow começa com `Kaique - `
- nenhum workflow expõe credencial em texto — só `$vars.NOME`
- nenhum workflow de ETL pode ter webhook
- nenhum minuto de cron pode repetir (os fluxos nunca rodam juntos)
- **não ative nenhum workflow antes do teste individual passar**
- não apague dados existentes
- não desabilite RLS no Supabase
- não use force push
- não invente resultado de teste — se não rodou, diga que não rodou

---

## 3. Estado atual (verificado, não presumido)

### Supabase — pronto

- projeto: `dashboard-compras`, ref `hldeqhkcnbywtorijhvl`, região `sa-east-1`, PostgreSQL 17
- as 7 migrations do pacote 1.10.17 estão aplicadas
- `ingest_dashboard_dataset` existe e foi testada: idempotente, isola empresas, bloqueia usuário comum
- `logs_integracao` existe e está com **0 linhas** — nenhum dado chegou do n8n ainda
- dados operacionais preservados: produtos 10219, radar 10086, sugestões 10086, rupturas 12365

Não precisa mexer no banco. Se mexer, pare e explique por quê.

### n8n — parcial

Instância: `https://automacao.skylinemobile.com.br`

Já criados (todos **inativos**, corretos, aguardando credencial):

| #   | id                 | nome                                                | cron         |
| --- | ------------------ | --------------------------------------------------- | ------------ |
| 06  | `GAFBuWm2vhfQQuKJ` | Kaique - Dashboard Compras - Cadastro de Parceiros  | `21 * * * *` |
| 10  | `Om34WCpxJPrMPyut` | Kaique - Dashboard Compras - Transferencias Eventos | `37 * * * *` |
| 12  | `R841usvZT1xw0hS9` | Kaique - Dashboard Compras - Budget Mensal          | `45 * * * *` |

Auxiliar, pode apagar quando terminar:

| id                 | nome                                               | para quê                                       |
| ------------------ | -------------------------------------------------- | ---------------------------------------------- |
| `ivmImKwQvK9Cbccw` | Kaique - Dashboard Compras - DIAGNOSTICO VARIAVEIS | lista só os NOMES das variáveis, nunca valores |

**Lixo a remover depois de conferir**: `lShhy6dU0KbJQqqx` — `Kaique - Dashboard Compras - TRANSFERENCIAS EVENTOS`.
É uma versão antiga com **webhook público**, proibida pelas regras. Não é o fluxo do pacote (o correto é o
`Om34WCpxJPrMPyut`, com schedule). Confirme e apague manualmente.

**Faltam 11 workflows**: 01, 02, 03, 04, 05, 07, 08, 09, 11, 13, 14.

### Cloudflare — bloqueado

- é **Pages**, não Workers (a conta tem 0 Workers)
- `https://dashboard-compras.pages.dev/api/health` devolve HTML, não JSON: as Functions não estão publicadas
- o push da branch **não** gerou preview
- versão esperada no health depois do deploy: **1.10.18**

---

## 4. O BLOQUEIO PRINCIPAL — leia antes de tentar testar

A instância do n8n tem **zero variáveis cadastradas**. Provado por execução real (workflow
`ivmImKwQvK9Cbccw`, execução `58491`, status success):

```json
{ "total_variaveis": 0, "nomes_existentes": [] }
```

Consequência: qualquer fluxo falha em ~150 ms com `401 invalid_client` no `authenticate` do Sankhya,
porque `client_id` e `client_secret` saem vazios do corpo da requisição.

**Estas 5 variáveis precisam ser cadastradas pelo dono da instância** (Settings -> Variables), e você
**não** deve pedir, receber, colar ou registrar os valores em lugar nenhum:

```text
SANKHYA_X_TOKEN
SANKHYA_CLIENT_ID
SANKHYA_CLIENT_SECRET
SUPABASE_URL                 -> https://hldeqhkcnbywtorijhvl.supabase.co
SUPABASE_SERVICE_ROLE_KEY    -> service role do projeto dashboard-compras
```

Enquanto isso não existir: **crie os fluxos, mas não teste e não ative**. Diga claramente que está
bloqueado. Não invente números de "registros recebidos".

---

## 5. Sua tarefa

### 5.1 Criar os 11 workflows que faltam

**Jeito certo — use o importador deste pacote.** Ele sobe os JSONs byte-exatos, sem transcrição manual:

```bash
cd <pasta deste pacote>
node scripts/import-n8n-workflows.mjs --dry-run

N8N_URL=https://automacao.skylinemobile.com.br \
N8N_API_KEY=<chave gerada em Settings -> n8n API> \
node scripts/import-n8n-workflows.mjs
```

O script:

- lê `./workflows/*.json` (os 14 estão aqui)
- valida nome, ausência de webhook, cron horário, minutos exclusivos, uso das 5 variáveis e a RPC
- cria por nome, ou atualiza quem já existe — **idempotente**, pode rodar várias vezes
- desativa antes de atualizar, se estiver ativo
- **nunca ativa nada**
- lê a chave do ambiente e nunca imprime

Os 3 já criados serão reconhecidos pelo nome e atualizados, sem duplicar.

**Alternativa sem chave de API**: importar os JSONs pela UI do n8n (Workflows -> Import from File).
Mesmo resultado.

**Não recrie os fluxos digitando o SQL à mão.** Os 14 somam ~271 mil caracteres de SQL Oracle; o
`09_estoque-produto-diario` sozinho tem 65 mil. Transcrever isso à mão é onde nasce erro silencioso —
um `AND` trocado não estoura, só devolve número errado no dashboard.

### 5.2 Depois que as variáveis existirem

Para cada um dos 14, nesta ordem:

1. execute manualmente (modo manual)
2. confira o resultado da execução: duração, status, erro
3. confira no Supabase o que realmente foi gravado:

```sql
select endpoint, status, registros_recebidos, registros_processados,
       registros_com_erro, duracao_ms, execucao_id, data_execucao
from public.logs_integracao
order by data_execucao desc
limit 20;
```

4. rode **duas vezes** com o mesmo `execucao_id` e confirme que `logs_integracao` continua com 1 linha
   para aquele par `(endpoint, execucao_id)` — é o teste de idempotência
5. só então ative

Registre para cada workflow: id, nome, horário, duração real, registros recebidos, registros gravados,
erros, status final. Sem números inventados.

### 5.3 Concorrência

Confirme **no serviço**, não no arquivo de exemplo:

```bash
docker compose exec n8n printenv N8N_CONCURRENCY_PRODUCTION_LIMIT
```

Precisa retornar `1`. Enquanto não retornar, o não-paralelismo depende só do espaçamento de 4 minutos
entre os crons. As demais variáveis de ambiente esperadas:

```env
GENERIC_TIMEZONE=America/Sao_Paulo
TZ=America/Sao_Paulo
N8N_CONCURRENCY_PRODUCTION_LIMIT=1
EXECUTIONS_DATA_SAVE_ON_SUCCESS=none
EXECUTIONS_DATA_SAVE_ON_ERROR=all
EXECUTIONS_DATA_PRUNE=true
EXECUTIONS_DATA_MAX_AGE=168
```

### 5.4 Cloudflare

Configure as variáveis do projeto Pages, publique a branch e confirme:

```bash
curl -s https://<url-do-deploy>/api/health
```

Tem que voltar JSON com `version` = **1.10.18**, mais `branch` e `commit`. Não considere publicado só
porque os arquivos existem no git — confirme pelo endpoint.

Secrets do Pages (só os nomes): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SKYLER_UPSTREAM_URL`,
`SKYLER_API_TOKEN`, `SKYLER_API_HEADER`, `SKYLER_TIMEOUT_MS`.

---

## 6. Os 14 fluxos e seus minutos

| #   | arquivo                              | dataset gravado        | minuto | situação    |
| --- | ------------------------------------ | ---------------------- | ------ | ----------- |
| 01  | 01_v7-analise-geral-20d-frontal.json | raw_v7_analise_geral   | 01     | falta criar |
| 02  | 02_erro-cadastros.json               | raw_erro_cadastros     | 05     | falta criar |
| 03  | 03_produtos-comprados.json           | raw_produtos_comprados | 09     | falta criar |
| 04  | 04_radar-estoque.json                | radar_estoque          | 13     | falta criar |
| 05  | 05_sugestao-compra.json              | sugestoes_compra       | 17     | falta criar |
| 06  | 06_cadastro-parceiros.json           | raw_cadastro_parceiros | 21     | **criado**  |
| 07  | 07_estoque-analitico.json            | raw_estoque_analitico  | 25     | falta criar |
| 08  | 08_cadastro-produtos.json            | produtos               | 29     | falta criar |
| 09  | 09_estoque-produto-diario.json       | estoque_produto_diario | 33     | falta criar |
| 10  | 10_transferencias-eventos.json       | transferencias_eventos | 37     | **criado**  |
| 11  | 11_recebimentos-eventos.json         | recebimentos_eventos   | 41     | falta criar |
| 12  | 12_budget-mensal.json                | budget_mensal          | 45     | **criado**  |
| 13  | 13_fornecedores-snapshot-diario.json | fornecedores_snapshot  | 49     | falta criar |
| 14  | 14_fornecedores-followups.json       | fornecedores_followups | 53     | falta criar |

Datasets `raw_*` caem em `integracao_snapshots` (retenção de 7 dias). Os demais vão para as tabelas
canônicas.

---

## 7. Anatomia de cada workflow (para conferência)

```text
scheduleTrigger (cron "MM * * * *")
  -> httpRequest  POST https://api.sankhya.com.br/authenticate
                  header X-Token = {{ $vars.SANKHYA_X_TOKEN }}
                  form: grant_type, client_id, client_secret (via $vars)
  -> httpRequest  POST https://api.sankhya.com.br/gateway/v1/mge/service.sbr
                  serviceName = DbExplorerSP.executeQuery
  -> code         normaliza colunas, datas BR e seriais Excel; devolve
                  { dataset, data_referencia, total, data }
  -> httpRequest  POST {{ $vars.SUPABASE_URL }}/rest/v1/rpc/ingest_dashboard_dataset
                  body: { p_dataset, p_payload, p_execucao_id: String($execution.id),
                          p_data_referencia }
```

`p_execucao_id` é o que garante idempotência: a mesma execução reprocessada atualiza o log em vez de
duplicar. Não remova.

Settings de cada workflow: `timezone: America/Sao_Paulo`, `executionTimeout: 600`,
`saveDataSuccessExecution: none`, `saveDataErrorExecution: all`.

---

## 8. Como saber que terminou

Só considere concluído quando **todos** forem verdade:

- os 14 fluxos existem, com nome `Kaique - `, sem webhook, minutos exclusivos
- cada um foi executado e testado individualmente, com números reais registrados
- `logs_integracao` no Supabase mostra linhas com `status = 'sucesso'`
- os 14 estão ativos
- `N8N_CONCURRENCY_PRODUCTION_LIMIT=1` confirmado dentro do container
- o workflow legado com webhook foi removido
- `/api/health` responde JSON com `version = 1.10.18`, branch e commit

Se algum item não for verdade, diga qual e por quê. Entregar parcial com relatório honesto vale mais do
que dizer que acabou.

---

## 9. Conteúdo deste pacote

```text
LEIA-ME.md                        este arquivo
workflows/*.json                  os 14 workflows, byte-exatos do pacote 1.10.17
scripts/import-n8n-workflows.mjs  importador idempotente (não ativa nada)
n8n.env.example                   nomes das variáveis, sem valores
```

Requer Node.js 18+ (usa `fetch` nativo).
