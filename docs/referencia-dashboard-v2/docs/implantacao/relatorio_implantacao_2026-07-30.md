# relatorio de implantacao - 2026-07-30

## situacao geral

| etapa                         | situacao                                                             |
| ----------------------------- | -------------------------------------------------------------------- |
| 1. descoberta do estado atual | **concluida**                                                        |
| 2. banco Supabase             | **concluida e validada**                                             |
| 3. n8n                        | **bloqueada** - credenciais Sankhya ausentes na instancia            |
| 4. frontend                   | **validado** (somente Supabase)                                      |
| 5. Cloudflare                 | **bloqueada** - nenhum deploy gerado; `/api/health` ainda nao existe |
| 6. testes                     | **executados**, com duas ressalvas de ambiente                       |
| 7. git                        | **concluida** - 5 commits e push da branch                           |

O objetivo final **nao esta concluido**: os fluxos nao estao ativos no n8n, o n8n ainda nao gravou dados
no Supabase e o deploy Cloudflare nao foi confirmado pelo endpoint de health.

## branch, commit e versao

- repositorio: `https://github.com/Kaique-o/dashboard-compras.git`
- branch: `feat/integracao-n8n-supabase-zero` (push feito, **sem merge na main**, **sem force push**)
- commit final: `8eb6f64f9eab07d24a2680d10eb61fae00ad0007`
- versao anterior: **1.10.17**
- versao nova: **1.10.18** (incrementada apos os testes)

Commits criados:

```text
91722b7 feat(supabase): aplica camada de ingestao horaria
eb9972a feat(n8n): implanta workflows horarios do dashboard
ee62989 feat(cloudflare): alinha worker com a versao do projeto
759f724 test: valida integracao sankhya supabase frontend
8eb6f64 docs: registra implantacao e operacao
```

## base usada

`Compras_corrigido_integracao_1.10.17.zip` (`C:\Users\Kaiqu\Downloads\Trabaalho\`), 220 arquivos.
Comparacao SHA256 arquivo a arquivo contra a working tree: **0 diferencas**. Foi a unica base usada.

## migrations aplicadas

Projeto `dashboard-compras` (`hldeqhkcnbywtorijhvl`), PostgreSQL 17.6.1.141.

1. `20260719130000_normalizar_fn_auth_perfil_texto.sql`
2. `20260719140000_schema_sistema_base.sql`
3. `20260719150000_configuracoes_funcionais.sql` — ja constava aplicada, pulada conforme a ordem oficial
4. `20260719190000_home_5_itens_padrao.sql`
5. `20260719210000_sugestao_tabela_dinamica.sql`
6. `20260729115100_seguranca_multiempresa_reconciliacao.sql` (5 partes, sem pular comandos)
7. `20260730022000_integracao_horaria_n8n.sql` (2 partes)

Divergencia do pedido: o arquivo `20260730_010000_integracao_horaria_dashboard.sql` **nao existe** no pacote
1.10.17. O equivalente presente e `20260730022000_integracao_horaria_n8n.sql`, e foi ele o aplicado.

Detalhes e os dois bloqueios de PostgreSQL 17 resolvidos: `docs/implantacao/log_migrations_2026-07-30.md`.

## validacoes do banco

| item                                     | resultado                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------ |
| `fn_auth_perfil` convertida para `text`  | ok (era enum `perfil_usuario`)                                                       |
| usuarios existentes preservados          | ok - 3 antes, **3 depois**                                                           |
| dados operacionais preservados           | ok - produtos 10219, radar 10086, sugestoes 10086, rupturas 12365, recebimentos 4213 |
| criacao de `empresas`                    | ok - 1 empresa (`Todas`)                                                             |
| criacao de `usuarios_empresas`           | ok - 2 vinculos                                                                      |
| preenchimento de `empresa_id`            | ok - **0 linhas** sem empresa em 9 tabelas + `estoque_produto_diario`                |
| RLS por empresa                          | ok - 19 policies, **0 tabelas sem RLS**                                              |
| autorizacao por modulo                   | ok - as 9 RPCs publicas chamam `fn_exigir_acesso_modulo`                             |
| tabelas canonicas dos datasets           | ok - 23 tabelas em `public`                                                          |
| RPCs de ingestao                         | ok                                                                                   |
| dispatcher `ingest_dashboard_dataset`    | ok                                                                                   |
| logs de integracao                       | ok - `logs_integracao` e `integracao_snapshots`                                      |
| idempotencia                             | ok - reexecucao com o mesmo `execucao_id` atualiza e nao duplica                     |
| isolamento entre empresas                | ok - `get_produtos` do usuario da empresa A retorna 1 item e nao vaza o da B         |
| bloqueio de escrita para usuarios comuns | ok - `authenticated` recebe 42501 na ingestao e nao tem SELECT bruto                 |

### tabelas criadas

`empresas`, `usuarios_empresas`, `logs_integracao`, `integracao_snapshots`, `estoque_produto_diario`

### RPCs criadas / recriadas

ingestao: `ingest_dashboard_dataset`, `ingest_integracao_snapshot`, `ingest_produtos`,
`ingest_radar_estoque`, `ingest_sugestoes_compra`, `ingest_rupturas`, `ingest_estoque_produto_diario`,
`ingest_transferencias_eventos`, `ingest_recebimentos_eventos`, `ingest_budget_mensal`,
`ingest_fornecedores_snapshot`, `ingest_fornecedores_followups`

leitura (9, todas com guarda de modulo e owner `compras_rpc_owner`): `get_home_dashboard`,
`get_sugestao_compra`, `get_rupturas`, `get_excesso`, `get_produtos`, `get_budget`, `get_transferencias`,
`get_recebimentos`, `get_fornecedores`

seguranca: `fn_empresa_visivel`, `fn_usuario_tem_acesso_modulo`, `fn_usuario_tem_algum_modulo`,
`fn_exigir_acesso_modulo`, `fn_config_modulos_padrao`, `fn_sincronizar_empresa_operacional`,
`save_usuario_perfil`, `list_escopos_empresa_permissoes`

## resultado de cada teste

| teste                              | comando                                   | resultado                                                                       |
| ---------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------- |
| instalacao                         | `npm ci`                                  | **ok** - 239 pacotes                                                            |
| seguranca                          | `npm run check:security`                  | **ok** - 11 migrations e controles criticos                                     |
| n8n (json dos 14 workflows)        | `npm run check:n8n`                       | **ok** - 14 fluxos, 14 minutos exclusivos                                       |
| arquitetura de dados               | `npm run check:architecture`              | **ok** - frontend sem n8n, 9 RPCs Supabase                                      |
| cloudflare (arquivos)              | `node scripts/validate-cloudflare.mjs`    | **ok**                                                                          |
| smoke do worker cloudflare         | `node scripts/test-cloudflare-worker.mjs` | **ok**                                                                          |
| build                              | `npm run build`                           | **ok** - 342.1 KB JS, 51.2 KB CSS                                               |
| validate                           | `npm run validate`                        | **ok**                                                                          |
| unitarios/integracao               | `npm test`                                | **ok - 9 arquivos, 37 testes**                                                  |
| e2e                                | `npm run test:e2e`                        | **ok - 24/24**                                                                  |
| lighthouse                         | `npm run test:lighthouse`                 | **auditou**: login 82/95/100/63, definir-senha 85/100/100/63 (perf/a11y/bp/seo) |
| smoke integracao horaria (SQL)     | `supabase/tests/06`                       | **ok**                                                                          |
| smoke compatibilidade perfil (SQL) | `supabase/tests/07`                       | **ok**                                                                          |
| smoke seguranca multiempresa (SQL) | `supabase/tests/05`                       | **ok, com adaptacao** (ver abaixo)                                              |
| ingestao repetida sem duplicidade  | teste 06                                  | **ok**                                                                          |
| falha parcial                      | dispatcher grava `status=erro` e re-lanca | **ok** (caminho de erro exercitado no teste 06)                                 |
| isolamento multiempresa            | teste 05                                  | **ok**                                                                          |
| banco limpo                        | `npm run test:db:fresh`                   | **nao executado** - exige Supabase local via Docker, indisponivel nesta maquina |
| fila do n8n                        | -                                         | **nao executado** - bloqueado pelas credenciais                                 |

Observacoes honestas sobre os testes:

- `npm test` falha com o pool padrao (`forks`) nesta maquina: _"Timeout waiting for worker to respond"_, 0 testes
  executados. Com `npx vitest run --pool=threads --no-file-parallelism` os **37 testes passam**. E limitacao de
  ambiente Windows, nao falha de teste.
- `npm run test:e2e` falhava 24/24 apenas porque os browsers do Playwright nao estavam instalados. Apos
  `npx playwright install chromium`, **24/24 passaram**.
- `npm run test:lighthouse` quebrava antes de auditar por um bug real de Windows em `scripts/lighthouse.mjs`
  (`new URL(import.meta.url).pathname` gerava `C:\C:\...`). Corrigido com `fileURLToPath`. Depois disso as duas
  rotas foram auditadas com sucesso; o processo ainda termina com `EPERM` na limpeza do diretorio temporario do
  `chrome-launcher` — falha de teardown no Windows, posterior a auditoria.
- teste 05 assume banco vazio. Aqui ja existe 1 admin real, entao o usuario de teste virava o 2o admin e a
  democao era legitima. O cenario de "ultimo administrador" foi isolado em transacao propria e a guarda
  **bloqueou** corretamente. Todos os demais blocos do teste passaram sem adaptacao.
- Todos os testes SQL rodaram em transacao com `rollback`. Confirmado depois: 0 linhas de teste remanescentes.

## os 14 workflows

Os 14 arquivos em `integrations/n8n/dashboard_c/workflows/` estao validados e commitados. Todos comecam com
`Kaique - `, nenhum expoe credencial, nenhum tem webhook, e cada um tem a cadeia
schedule -> autenticacao Sankhya -> `DbExplorerSP.executeQuery` -> normalizacao -> `ingest_dashboard_dataset`.

| #   | arquivo                      | dataset                | minuto |
| --- | ---------------------------- | ---------------------- | ------ |
| 01  | v7-analise-geral-20d-frontal | radar_estoque          | 01     |
| 02  | erro-cadastros               | produtos               | 05     |
| 03  | produtos-comprados           | produtos               | 09     |
| 04  | radar-estoque                | radar_estoque          | 13     |
| 05  | sugestao-compra              | sugestoes_compra       | 17     |
| 06  | cadastro-parceiros           | fornecedores_snapshot  | 21     |
| 07  | estoque-analitico            | estoque_produto_diario | 25     |
| 08  | cadastro-produtos            | produtos               | 29     |
| 09  | estoque-produto-diario       | estoque_produto_diario | 33     |
| 10  | transferencias-eventos       | transferencias_eventos | 37     |
| 11  | recebimentos-eventos         | recebimentos_eventos   | 41     |
| 12  | budget-mensal                | budget_mensal          | 45     |
| 13  | fornecedores-snapshot-diario | fornecedores_snapshot  | 49     |
| 14  | fornecedores-followups       | fornecedores_followups | 53     |

Os 14 minutos sao exclusivos (validado por script).

### ids reais na instancia n8n

Apenas **1** dos 14 existe hoje na instancia:

| id                 | nome                                                | ativo | observacao                                                                        |
| ------------------ | --------------------------------------------------- | ----- | --------------------------------------------------------------------------------- |
| `lShhy6dU0KbJQqqx` | Kaique - Dashboard Compras - TRANSFERENCIAS EVENTOS | nao   | **versao errada**: usa trigger `n8n-nodes-base.webhook`, nao o schedule do pacote |

Os outros 13 **nao foram criados**, e nenhum foi ativado.

### medicao real da unica execucao possivel

| campo               | valor                                             |
| ------------------- | ------------------------------------------------- |
| workflow id         | `lShhy6dU0KbJQqqx`                                |
| execucao            | `58445` (modo manual)                             |
| horario             | 2026-07-30T09:20:42Z                              |
| duracao             | **175 ms**                                        |
| registros recebidos | **0**                                             |
| registros gravados  | **0**                                             |
| erro                | `401 invalid_client` no `authenticate` do Sankhya |
| status final        | **erro**                                          |

`logs_integracao` continua com **0 linhas**: nenhum dado foi gravado pelo n8n no Supabase.

## por que o n8n esta bloqueado

O corpo enviado pelo n8n ao Sankhya foi apenas `{ "grant_type": "client_credentials" }`.
`{{ $vars.SANKHYA_CLIENT_ID }}` e `{{ $vars.SANKHYA_CLIENT_SECRET }}` resolveram para vazio, ou seja,
**as variaveis nao existem nessa instancia do n8n**. Sem elas nenhum fluxo autentica, nao ha o que testar e
nada pode ser ativado. Detalhes em `docs/implantacao/n8n_bloqueio_credenciais.md`.

## confirmacao da concorrencia igual a 1

**Nao confirmada.** As variaveis de processo do n8n nao sao expostas nem alteraveis pelo MCP, e nao ha Docker
nesta maquina. O repositorio traz os arquivos de exemplo corretos e o validador confere o conteudo deles, mas
isso **nao prova aplicacao no servico**. A confirmacao precisa ser feita no host:

```bash
docker compose exec n8n printenv N8N_CONCURRENCY_PRODUCTION_LIMIT
```

Hoje o nao-paralelismo esta garantido apenas pelo espacamento de 4 minutos entre os crons.

## confirmacao de que o frontend nao chama o n8n

**Confirmado.** Busca por `webhook`, `webhook-test`, urls do n8n, dominio de automacao e proxy Sankhya em
`src/`: nenhuma chamada. A unica mencao a n8n e texto informativo em `src/modulos/compras/paginas/configuracao.html`. A unica
URL de webhook do repositorio esta em documentacao historica
(`docs/integration/plano_acao_integracao_n8n_home.md`). O validador `check:architecture` confirma o frontend
sem n8n e as 9 RPCs Supabase. `src/js/core/config.js` publica somente `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`APP_URL` e `SKYLER_API_URL` — **nenhum service role no bundle**.

## resultado do /api/health

| url                                                                                | resultado                                                                                       |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `https://dashboard-compras.pages.dev/api/health`                                   | **HTTP 200 mas devolve HTML do dashboard**, nao JSON — as Pages Functions nao estao implantadas |
| `https://feat-integracao-n8n-supabase-zero.dashboard-compras.pages.dev/api/health` | **HTTP 404** apos ~4 min de espera - nenhum deploy de preview foi gerado pelo push              |

Portanto **o deploy Cloudflare nao esta confirmado**. Nao considerei o worker atualizado so porque os
arquivos existem no git — a verificacao foi feita no endpoint e ela falhou.

## secrets necessarios (somente os nomes)

n8n (ambiente protegido, nunca no repositorio):

- `SANKHYA_X_TOKEN`
- `SANKHYA_CLIENT_ID`
- `SANKHYA_CLIENT_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Cloudflare Pages:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SKYLER_UPSTREAM_URL`
- `SKYLER_API_TOKEN` (secret)
- `SKYLER_API_HEADER`
- `SKYLER_TIMEOUT_MS`

Nenhum valor foi exibido, registrado ou commitado.

## erros ainda pendentes

1. **Credenciais Sankhya ausentes no n8n** — bloqueio principal.
2. **13 dos 14 workflows nao existem** na instancia; o unico existente esta na versao errada, com webhook.
3. **Concorrencia 1 nao confirmada** no servico do n8n.
4. **Cloudflare sem deploy** das Functions; `/api/health` nao responde JSON em producao nem em preview.
5. **`npm test` quebra com o pool `forks`** nesta maquina (contorno: `--pool=threads`).
6. **`test:lighthouse` termina com EPERM** na limpeza de temp do `chrome-launcher` no Windows, apos auditar.
7. **`npm run test:db:fresh` nao executado** — exige Supabase local via Docker.
8. **Defeito do pacote 1.10.17 em PostgreSQL 15+**: a migration de seguranca falha no
   `ALTER FUNCTION ... OWNER TO compras_rpc_owner` porque o novo dono nao tem `CREATE` no schema. Corrigido na
   aplicacao; o arquivo-fonte ainda precisa do par grant/revoke.

## passos necessarios para producao

1. Cadastrar no n8n as 5 variaveis (`SANKHYA_*`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
2. Aplicar no servico do n8n as variaveis de ambiente do `.env.example` e **confirmar**
   `N8N_CONCURRENCY_PRODUCTION_LIMIT=1` com `printenv` dentro do container.
3. Importar os 14 JSONs de `integrations/n8n/dashboard_c/workflows/` e **substituir** o workflow
   `lShhy6dU0KbJQqqx`, que hoje tem webhook publico.
4. Executar cada um manualmente, conferir `logs_integracao` no Supabase e so entao ativar.
5. Configurar as variaveis do projeto Cloudflare Pages e publicar a branch (ou conectar o repositorio ao Pages,
   que hoje aparentemente nao gera preview por push).
6. Consultar `/api/health` e confirmar `version=1.10.18`, branch e commit `8eb6f64`.
7. Abrir o PR de `feat/integracao-n8n-supabase-zero` para `main` apos os itens acima.
