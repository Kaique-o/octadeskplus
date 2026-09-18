# plano de acao — matriz curva x status: n8n grava supabase, front le supabase

> **Documento historico.** Descreve a estrutura multipagina anterior a migracao
> para React (`src/js/`, `scripts/build.js`, `src/assets/css/styles.css`), que foi
> removida do repositorio. Vale como registro datado, nao como instrucao.
> Para o estado atual, ver `llm.md` e `docs/ai/`.

status geral: **parcialmente concluido em 2026-07-03** — falta 1 etapa manual no n8n (fora do
alcance desta sessao, sem acesso ao n8n).

## pedido

"faz o endpoint que esta mostrando na matriz atualizar a propria tabela dentro do supabase e o
frontend consulta o supabase" — tirar a matriz curva x status da home do modo "n8n direto pro
navegador" (padrao B) e passar a gravar supabase + ler supabase.

## decisao tecnica registrada

duas rotas possiveis, apresentadas ao Kai:

1. **tabela dedicada (escolhida)**: criar tabela no grao que o n8n ja envia hoje (curva, status,
   contagem de skus). rapido, funciona sem depender de outra coisa.
2. **pipeline completo via `sugestoes_compra`**: reusar `ingest_sugestoes_compra` e
   `get_matriz_curva_status` (ja prontos). exige trocar o sql do n8n para 1 linha por produto e
   ter `produtos`/`empresas` sincronizados antes (hoje: 0 linhas) — projeto maior.

Kai escolheu a **opcao 1** em 2026-07-03. quando a ingestao completa de `sugestoes_compra` estiver
rodando, migrar a leitura da home para `get_matriz_curva_status` e aposentar a tabela nova.

## supabase (concluido)

- [x] tabela `public.radar_estoque_curva_status` (data_referencia + curva_status +
      status_estoque_principal + quantidade_skus + atualizado_em; unique por dia+curva+status)
- [x] RLS: `select` para `authenticated` (mesmo padrao de `produtos`/`fornecedores` — sem
      `empresa_id`, porque o payload do n8n nao quebra por empresa)
- [x] `ingest_radar_estoque_curva_status(p_payload jsonb, p_data_referencia date default current_date)`
      — `security definer`, grant so para `service_role`. substitui todas as linhas do dia a cada
      chamada (payload sempre representa o estado inteiro, nao um delta) e grava resumo em
      `logs_integracao`
- [x] `get_radar_estoque_curva_status(filtros jsonb)` — `security invoker`, grant para
      `authenticated`. devolve `{success, updated_at, data_referencia, data:[...]}` (mesmo formato
      que o n8n devolvia direto, pra nao precisar reescrever `agregarMatriz`/`renderizarMatriz`)
- [x] testado ponta a ponta no projeto live (`hldeqhkcnbywtorijhvl`): ingest com 2 linhas de
      exemplo → leitura via `get_radar_estoque_curva_status` retornou os dados certos → dados de
      teste removidos (tabela fica vazia ate o n8n rodar de verdade)
- [x] arquivo `supabase/sql/10_radar_estoque_curva_status.sql` criado espelhando a migration aplicada

## frontend (concluido)

- [x] `src/js/pages/home.js`: `fetch_home_stock_radar()` trocou `fetch(webhook n8n)` por
      `supabase.rpc('get_radar_estoque_curva_status', { filtros: {} })`
- [x] removido `DASHBOARD_ENDPOINTS` (nao existe mais url de n8n hardcoded em `home.js`)
- [x] `index.html`: script de `home.js` virou `type="module"` (precisa pra importar
      `supabase-client.js`, mesmo padrao de `auth.js`)
- [x] nota do card atualizada: sucesso mostra "Dados reais (Supabase) - atualizado em ...", falha
      mostra "Dados de exemplo (sem dados no supabase no momento)"
- [x] fallback mantido: sem sessao/erro/sem linhas, a matriz mockada do html continua aparecendo

## documentacao (concluido)

- [x] `README.md` — secao "integracao n8n (home - radar curva x status)" reescrita
- [x] `docs/ai/backend.md` — secao "integracao n8n (home radar)" reescrita
- [x] `docs/architecture/supabase_arquitetura.md` — nova tabela/rpc nas secoes 6, 7, 13.1 e 14
- [x] `docs/integration/guia_endpoints_n8n.md` — linha da matriz na tabela "fontes de dados existentes" atualizada
- [x] este arquivo

## n8n (PENDENTE — manual, fora do alcance desta sessao)

nao tenho acesso ao n8n nesta sessao (sem mcp/ferramenta conectada). o fluxo
`Kaique - dashboard compras home radar estoque` continua, hoje, so respondendo webhook — **ele
ainda nao grava nada no supabase**. ate isso ser feito manualmente, a home vai mostrar a matriz
mockada (fallback), porque `radar_estoque_curva_status` esta vazia.

passo a passo pra fazer no n8n:

1. abrir o fluxo `Kaique - dashboard compras home radar estoque`.
2. **trocar o trigger**: de "Webhook GET" para "Schedule Trigger" (ex.: a cada 1h ou 1x/dia,
   seguindo o padrao A do `docs/integration/guia_endpoints_n8n.md`). isso desliga o endpoint publico
   `home-radar-estoque` (o frontend nao chama mais ele de qualquer forma).
   - alternativa mais conservadora: manter o webhook por enquanto (nao quebra nada), so adicionar
     os nodes 3-4 abaixo antes do "Respond to Webhook" existente. dá pra migrar pro Schedule Trigger
     depois, com calma.
3. manter os nodes de bearer sankhya + `DbExplorerSP.executeQuery` como estao (sql inalterado,
   `docs/integration/sql_radar_curva_estoque_efetivo_n8n.sql`).
4. no code node que normaliza `rows`, gerar o payload no formato do ingest:
   ```js
   const linhas = /* rows normalizadas, como ja e feito hoje */;
   return [{ json: { p_payload: linhas.map(r => ({
     curva_status: r.curva_status,
     status_estoque_principal: r.status_estoque_principal,
     quantidade_skus: r.quantidade_skus
   })) } }];
   ```
5. adicionar um node **HTTP Request** (substitui ou fica antes do "Respond to Webhook"):
   ```txt
   POST https://hldeqhkcnbywtorijhvl.supabase.co/rest/v1/rpc/ingest_radar_estoque_curva_status
   headers:
     apikey: <SERVICE_ROLE_KEY>
     Authorization: Bearer <SERVICE_ROLE_KEY>
     Content-Type: application/json
   body: { "p_payload": [...] }   (o json do code node do passo 4)
   ```
   `SERVICE_ROLE_KEY` deve estar so em credencial do n8n (Header Auth) — nunca no repositorio.
6. **Publish/ativar** o fluxo (rascunho salvo nao roda agendamento).
7. testar: rodar o fluxo manualmente uma vez (Execute workflow), conferir resposta
   `{ sucesso: true, processados: N }`, depois checar no Supabase (Table Editor ou SQL) que
   `radar_estoque_curva_status` tem linhas com `data_referencia = hoje`.
8. abrir a home logado e conferir que o card mostra "Dados reais (Supabase) - atualizado em ...".

## pendencias

1. **etapa n8n acima** — bloqueia dado real na home ate ser feita; ate la, fallback mockado.
2. filtro `AD_MACROGRUPO2` (herdado, ver `docs/integration/plano_acao_integracao_n8n_home.md`) continua
   pendente, nao afetado por esta mudanca.
3. quando a ingestao completa de `sugestoes_compra` (produto a produto) estiver rodando: migrar
   `src/js/pages/home.js` para `get_matriz_curva_status` e aposentar `radar_estoque_curva_status` /
   `ingest_radar_estoque_curva_status` / `get_radar_estoque_curva_status`.
