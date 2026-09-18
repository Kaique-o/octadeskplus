# plano de acao — redesign "planilhas operacionais" (schema novo + planilhas pro n8n)

status geral: **schema e planilhas concluidos em 2026-07-03** — falta criar os 6 fluxos de
ingestao no n8n (fora do alcance desta sessao, sem acesso ao n8n).

## pedido

"primeiro ve todos os card/grafico/tabela que tem desenvolvimento, segundo ve as informacoes
necessarias pra calcular cada um, elabore planilhas com estrutura onde vc conseguir chegar nos
graficos, remodele o banco pra essa estrutura de planilhas, me manda as planilhas que eu vou fazer
o endpoint no n8n" — escopo confirmado pelo Kai: **tudo** (principal + secundario), **uma planilha
por fonte de dado**, **historizado por data** (pra calcular tendencia sozinho), planilha com
**cabecalho + exemplo preenchido**.

## por que tabelas novas em vez de popular o schema `01`-`09`

o schema normalizado (`produtos`, `empresas`, `fornecedores`, `sugestoes_compra` etc.) depende de
FK resolvida — e essas tabelas continuam com 0 linhas porque a integracao completa ERP → n8n →
supabase pra elas nunca rodou. esperar essa sincronizacao bloquearia dado real por tempo
indefinido. decisao: 6 tabelas denormalizadas novas, sem FK, no grao que cada tela precisa —
quando o schema normalizado estiver populado, as `get_*` podem ser reapontadas de novo (mesmo
truque de `create or replace function` usado aqui).

## o que foi feito

### auditoria (concluido)

- [x] inventario completo dos 9 htmls internos: todo kpi/card/tabela/grafico principal e
      secundario, incluindo os que hoje so existem mockados no html
- [x] pra cada componente: qual dado bruto e necessario pra calcular, e de qual das 6 tabelas ele
      viria

### supabase (concluido)

- [x] 6 tabelas: `estoque_produto_diario`, `budget_mensal`, `transferencias_eventos`,
      `recebimentos_eventos`, `fornecedores_snapshot_diario`, `fornecedores_followups`
- [x] `estoque_produto_diario` e `fornecedores_snapshot_diario` historizadas por
      `data_referencia` (1 snapshot por dia, delete+insert do dia a cada ingest) — permite
      calcular "vs. periodo anterior" automaticamente
- [x] `transferencias_eventos`/`recebimentos_eventos`/`budget_mensal` com upsert por chave
      natural (evento, nao snapshot diario)
- [x] RLS: select pra `authenticated` (mesmo padrao de `produtos`/`fornecedores`)
- [x] 6 funcoes `ingest_*` (`security definer`, grant so `service_role`) — grava em
      `logs_integracao` (exceto `ingest_fornecedores_followups`, tabela curada sem log)
- [x] 13 funcoes `get_*` **existentes** reapontadas via `create or replace function` (mesmo
      contrato json, zero mudanca de frontend): `get_home_kpis`, `get_sugestao_compra`,
      `get_rupturas`, `get_excesso`, `get_produtos`, `get_budget`, `get_transferencias`,
      `get_recebimentos`, `get_fornecedores`, `get_resumo_fornecedor`, `get_ranking_marcas`,
      `get_rupturas_por_curva`, `get_excesso_por_categoria`
- [x] 19 funcoes `get_*` **novas** (secundarias, cobrem grafico/card que antes so existia
      mockado) — lista completa em `docs/architecture/supabase_arquitetura.md` §15.3
- [x] testado ponta a ponta no projeto live (`hldeqhkcnbywtorijhvl`): ingest de exemplo em cada
      uma das 6 tabelas → leitura via as `get_*` correspondentes confere → dados de teste
      removidos (tabelas ficam vazias ate o n8n rodar de verdade)
- [x] `supabase/sql/11_planilhas_operacionais.sql` criado espelhando as 4 migrations aplicadas

### planilhas (concluido)

- [x] `docs/data-contracts/estoque_produto_diario.xlsx`
- [x] `docs/data-contracts/budget_mensal.xlsx`
- [x] `docs/data-contracts/transferencias_eventos.xlsx`
- [x] `docs/data-contracts/recebimentos_eventos.xlsx`
- [x] `docs/data-contracts/fornecedores_snapshot_diario.xlsx`
- [x] `docs/data-contracts/fornecedores_followups.xlsx`

cada planilha tem 3 abas: `leia-me` (o que e, pra que serve), `dados` (cabecalho + exemplo
preenchido, exatamente as colunas da tabela) e `instrucoes` (campo a campo: tipo, obrigatorio?,
origem esperada no sankhya, observacao). 0 erros de formula (`scripts/recalc.py`).

### documentacao (concluido)

- [x] `docs/architecture/supabase_arquitetura.md` — nova secao 15 (schema, tabelas, funcoes, planilhas)
- [x] `docs/integration/guia_endpoints_n8n.md` — 5 linhas novas na tabela "fontes de dados existentes"
- [x] `docs/ai/backend.md` — secao "como os dados devem ser consumidos" atualizada
- [x] `README.md` — nova secao "planilhas operacionais"
- [x] este arquivo

## n8n (PENDENTE — manual, fora do alcance desta sessao)

6 fluxos novos, 1 por tabela, todos seguindo o **padrao A** de `docs/integration/guia_endpoints_n8n.md`
(Schedule Trigger → sankhya → code node → HTTP Request pro `ingest_*`):

| fluxo (sugerido)                                   | ingest                                                           | planilha-contrato                                                   |
| -------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| `Kaique - dashboard compras ingest estoque diario` | `ingest_estoque_produto_diario`                                  | `estoque_produto_diario.xlsx`                                       |
| `Kaique - dashboard compras ingest budget`         | `ingest_budget_mensal`                                           | `budget_mensal.xlsx`                                                |
| `Kaique - dashboard compras ingest transferencias` | `ingest_transferencias_eventos`                                  | `transferencias_eventos.xlsx`                                       |
| `Kaique - dashboard compras ingest recebimentos`   | `ingest_recebimentos_eventos`                                    | `recebimentos_eventos.xlsx`                                         |
| `Kaique - dashboard compras ingest fornecedores`   | `ingest_fornecedores_snapshot` + `ingest_fornecedores_followups` | `fornecedores_snapshot_diario.xlsx` + `fornecedores_followups.xlsx` |

passo a passo por fluxo (resumo — receita completa em `docs/integration/guia_endpoints_n8n.md`):

1. **Schedule Trigger** (ex.: 1x/dia de madrugada) — nada de webhook.
2. reusar o node de bearer sankhya ja existente no fluxo da matriz (`gerar_bearer_produtos`).
3. `DbExplorerSP.executeQuery` com sql validado no DbExplorer (colunas existem neste ambiente).
4. code node: mapear `responseBody.rows` pro formato de cada planilha (aba `dados`/`instrucoes`
   e o contrato exato — nomes de coluna, tipo, obrigatoriedade). `estoque_produto_diario` e
   `fornecedores_snapshot_diario` precisam de `data_referencia` (`AAAA-MM-DD`, hoje); os demais
   (eventos) usam a chave natural indicada na planilha pra upsert (`codigo_transferencia`,
   `numero_nota`, `periodo+centro_custo+categoria`).
5. **HTTP Request**:
   ```txt
   POST https://hldeqhkcnbywtorijhvl.supabase.co/rest/v1/rpc/ingest_<tabela>
   headers:
     apikey: <SERVICE_ROLE_KEY>
     Authorization: Bearer <SERVICE_ROLE_KEY>
     Content-Type: application/json
   body: { "p_payload": [...] }   (array; ingest de diario/snapshot aceita "p_data_referencia" opcional)
   ```
   `SERVICE_ROLE_KEY` so em credencial do n8n (Header Auth) — nunca no repositorio.
6. **Publish/ativar** o fluxo.
7. testar: `Execute workflow` manual, conferir `{ sucesso: true, processados: N }`, depois checar
   no Supabase (Table Editor) que a tabela recebeu linhas.
8. abrir a tela correspondente logado e conferir "Dados reais (Supabase) - atualizado em ...".

## pendencias

1. **6 fluxos n8n acima** — bloqueiam dado real em todas as telas ate serem feitos; ate la,
   fallback mockado (comportamento esperado, ja documentado no README).
2. quando `produtos`/`empresas`/`fornecedores` (schema `01`-`09`) forem sincronizados por completo:
   avaliar migrar as `get_*` de volta pro schema normalizado e aposentar as 6 tabelas novas —
   mesmo raciocinio ja registrado pra `radar_estoque_curva_status` em
   `docs/audits/plano_acao_2026-07-03.md`.
3. `supabase/sql/11_planilhas_operacionais.sql` tem o DDL/funcoes completos por escrito (nao e
   so referencia) — se o schema mudar no live depois desta sessao, rodar
   `supabase db dump --schema public` pra confirmar que o arquivo continua espelhando o banco.
