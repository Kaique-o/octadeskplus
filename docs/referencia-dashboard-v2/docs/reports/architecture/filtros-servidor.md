# Validacao - filtros no servidor

## Implementado

- busca textual com debounce de 350 ms;
- filtros de selecao alimentados pelas opcoes retornadas pelas RPCs;
- periodo com data inicial e final;
- ordenacao por cabecalho com whitelist no PostgreSQL;
- paginacao por 15, 25, 50 ou 100 registros;
- `total_count` calculado antes do `limit/offset`;
- KPIs e agregados calculados sobre todo o resultado filtrado, nao somente sobre a pagina;
- home e oito telas operacionais migradas de consultas diretas para RPCs;
- nenhuma linha e escondida ou filtrada no DOM.

## Validacoes executadas

- `npm run check`;
- sintaxe de todos os arquivos JavaScript com `node --check`;
- parser PostgreSQL em `supabase/migrations/20260718230000_filtros_paginacao_servidor.sql`;
- parser PostgreSQL em `supabase/tests/02_smoke_filtros_servidor.sql`;
- verificacao automatica de ausencia de `.from()` nas paginas filtraveis;
- verificacao automatica de ausencia do filtro client-side antigo.

## Limitacao conhecida

O historico anterior das tabelas de snapshot nao existe. A migration adiciona `data_referencia` e atribui a data da aplicacao aos registros atuais. O periodo funciona imediatamente para eventos e dados ja datados. Para estoque, sugestao, ruptura e produtos, o historico passa a existir conforme as proximas cargas preservarem snapshots por `data_referencia`.
