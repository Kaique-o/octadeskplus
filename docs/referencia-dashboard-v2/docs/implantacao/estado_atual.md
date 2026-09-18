# estado atual antes da implantacao

data da coleta: 2026-07-30 (America/Sao_Paulo)
coletado somente com leitura, sem alterar producao

## base valida

- pacote base: `Compras_corrigido_integracao_1.10.17.zip`
- caminho: `C:\Users\Kaiqu\Downloads\Trabaalho\Compras_corrigido_integracao_1.10.17.zip`
- 220 arquivos no pacote
- comparacao sha256 arquivo por arquivo contra a working tree: **0 diferencas**
- conclusao: a working tree do repositorio e identica ao pacote base

## repositorio

- repositorio: `https://github.com/Kaique-o/dashboard-compras.git`
- branch atual: `feat/integracao-n8n-supabase-zero` (ja existe tambem em `origin`)
- branch principal: `main`
- ultimo commit local: `a1fa85f docs: documenta implantacao e operacao`
- working tree: 86 entradas alteradas/nao rastreadas (conteudo do pacote 1.10.17 ainda nao commitado)
- versao em `package.json`: **1.10.17** (identica ao pacote base)

## ambiente local

- Node.js **nao estava instalado** na maquina; instalado `nodejs-lts 24.18.1` via scoop para permitir a suite de testes
- Docker nao disponivel nesta maquina (portanto o n8n nao roda localmente aqui)

## supabase

- projeto: `dashboard-compras`
- ref: `hldeqhkcnbywtorijhvl`
- regiao: `sa-east-1`
- status: `ACTIVE_HEALTHY`
- postgres: 17.6.1.141

### migrations aplicadas (ledger `supabase_migrations`)

| version        | name                                       |
| -------------- | ------------------------------------------ |
| 20260703155714 | radar_estoque_curva_status                 |
| 20260703155741 | fix_ingest_radar_estoque_curva_status_logs |
| 20260703190744 | planilhas_operacionais_tabelas             |
| 20260703190834 | planilhas_operacionais_ingest              |
| 20260703191004 | planilhas_operacionais_get_principais      |
| 20260703191104 | planilhas_operacionais_get_secundarios     |
| 20260717011934 | permissoes_acesso                          |
| 20260718115843 | reset_tabelas_dashboard_bases_reais        |
| 20260719141509 | schema_atual_e_rpcs                        |
| 20260719141854 | filtros_paginacao_servidor                 |
| 20260719142558 | otimizar_consultas_payloads                |
| 20260719143018 | dominio_filtros_globais_skyler             |
| 20260719143122 | configuracoes_funcionais                   |
| 20260721171503 | criar_staging_e_controle_importacoes       |

### migrations do pacote 1.10.17 ainda pendentes

1. `20260719130000_normalizar_fn_auth_perfil_texto.sql`
2. `20260719140000_schema_sistema_base.sql`
3. `20260719190000_home_5_itens_padrao.sql`
4. `20260719210000_sugestao_tabela_dinamica.sql`
5. `20260729115100_seguranca_multiempresa_reconciliacao.sql`
6. `20260730022000_integracao_horaria_n8n.sql`

observacao: o pedido citava `20260730_010000_integracao_horaria_dashboard.sql`. Esse arquivo **nao existe** no pacote base 1.10.17. O equivalente presente e usado e
`20260730022000_integracao_horaria_n8n.sql` (mesma finalidade: tabelas canonicas, RPCs de ingestao, dispatcher e logs).
`20260719150000_configuracoes_funcionais.sql` ja consta aplicada no ledger e por isso nao e reaplicada.

### preflight somente leitura

- `public.fn_auth_perfil()` retorna **`perfil_usuario`** (enum) — ainda precisa ser convertida para `text`
- `public.usuarios_perfis.perfil`: `USER-DEFINED` / `public.perfil_usuario`, default `'leitura'::perfil_usuario`
- schema `sistema`: **ausente**
- tabela `empresas`: **ausente**
- tabela `usuarios_empresas`: **ausente**
- usuarios em `auth.users`: **3**
- tabelas em `public`: 18, todas com RLS habilitada

### contagens exatas antes das migrations (linha de base para provar preservacao)

| tabela                         | linhas           |
| ------------------------------ | ---------------- |
| budget_mensal                  | 0                |
| controle_importacoes           | 4                |
| fornecedores_followups         | 0                |
| fornecedores_snapshot_diario   | 65               |
| parametros_compras             | 8                |
| permissoes_acesso              | 2                |
| produtos                       | 10219            |
| radar_estoque                  | 10086            |
| recebimentos_eventos           | 4213             |
| rupturas                       | 12365            |
| sugestoes_compra               | 10086            |
| transferencias_eventos         | 0                |
| usuarios_perfis                | 3                |
| staging_import_produtos        | 10219 (estimado) |
| staging_import_radar           | 10086 (estimado) |
| staging_import_recebimentos    | 4213 (estimado)  |
| staging_import_sugestao_compra | 10086 (estimado) |

## n8n

- instancia acessada via MCP oficial do n8n (projeto pessoal `ti sky <ti@gruposkytech.com>`)
- total de workflows na instancia: **21**
- dos 14 fluxos horarios do dashboard, apenas **1** existe hoje:
  - `lShhy6dU0KbJQqqx` — `Kaique - Dashboard Compras - TRANSFERENCIAS EVENTOS` — inativo, `triggerCount=0` (criado em tentativa anterior e nunca testado)

### workflows conflitantes / duplicados identificados

| id               | nome                                          | ativo     | observacao                                                                                  |
| ---------------- | --------------------------------------------- | --------- | ------------------------------------------------------------------------------------------- |
| BvW0ppANQc9TMqc6 | Kaique - dashboard compras home radar estoque | **ativo** | fluxo legado com webhook publico consumido pelo frontend antigo; conflita com o ETL horario |
| 0YIpH2QlS4Ia8kcG | Kaique - site compra skyline                  | **ativo** | 2 triggers, fluxo legado do site                                                            |
| xQYGfki6idTmBqu4 | Kaique - consulta teste                       | inativo   | rascunho                                                                                    |
| rnmtmXkJwj98NdIX | My workflow 4                                 | inativo   | rascunho                                                                                    |
| SClXNfiMgZt6q9km | My workflow                                   | inativo   | rascunho                                                                                    |

os demais 14 workflows da instancia pertencem a outros projetos (Skyline, parceiro, Sankhya) e nao fazem parte deste escopo.

### credenciais existentes na instancia (somente nomes)

- `Postgres LOGSMART`
- `Postgres N8N`
- `OpenAI account`
- `Header Auth account`
- `Supabase Compras (Postgres)`

### limitacoes de acesso constatadas

- workflows legados nao expostos ao MCP nao podem ser lidos (`Workflow is not available in MCP`)
- as variaveis de ambiente do servico n8n (`N8N_CONCURRENCY_PRODUCTION_LIMIT` etc.) nao sao expostas nem alteraveis pelo MCP e nao ha Docker nesta maquina

## cloudflare

- `workers_list` da conta: **0 Workers** — a publicacao e via Cloudflare **Pages**, nao Workers
- projeto publicado: `https://dashboard-compras.pages.dev` (frontend responde)
- consulta a `https://dashboard-compras.pages.dev/api/health`:
  - **nao retorna JSON**; devolve o HTML do dashboard
  - conclusao: as Pages Functions **nao estao implantadas** no deploy atual; o deploy corrente e anterior ao pacote 1.10.17
- arquivos do pacote 1.10.17 ainda nao publicados: `functions/api/health.js`, `functions/api/skyler/chat.js`, `src/_routes.json`, `wrangler.toml`

## frontend

- busca por `webhook`, `webhook-test`, urls do n8n e dominio de automacao em `src/`: **nenhuma chamada encontrada**
- unica mencao a n8n em `src/modulos/compras/paginas/configuracao.html` e texto informativo de UI, sem requisicao
- unica url de webhook do repositorio esta em `docs/integration/plano_acao_integracao_n8n_home.md` (documentacao historica)
- `src/js/core/config.js` publica apenas `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `APP_URL`, `SKYLER_API_URL` — sem service role
