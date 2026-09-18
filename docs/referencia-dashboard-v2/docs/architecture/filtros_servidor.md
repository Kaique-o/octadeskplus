# Filtros e paginacao no servidor

> **Documento historico.** Descreve a estrutura multipagina anterior a migracao
> para React (`src/js/`, `scripts/build.js`, `src/assets/css/styles.css`), que foi
> removida do repositorio. Vale como registro datado, nao como instrucao.
> Para o estado atual, ver `llm.md` e `docs/ai/`.

## Fluxo

1. `src/js/shared/filtros.js` mantem o estado da interface.
2. Busca, macrogrupo, curva, marca, pagina e ordenacao sao enviados no objeto `filtros` da RPC.
3. A RPC aplica os criterios no PostgreSQL antes de paginar.
4. O retorno contem `itens`, `total_count`, `pagina`, `por_pagina`, `kpis` e `opcoes`.
5. O navegador renderiza somente a pagina recebida. Nao existe filtro de linhas no DOM.

## Campos padrao do payload

```json
{
  "pagina": 1,
  "por_pagina": 25,
  "search": "iphone",
  "macrogrupo": "SMARTPHONES",
  "curva": "A",
  "marca": "SAMSUNG",
  "ordenar_por": "custo_total",
  "ordem": "desc"
}
```

O contrato visual atual usa somente `macrogrupo`, `curva` e `marca` como filtros globais. Filtros antigos continuam aceitos pelas migrations anteriores apenas para compatibilidade de chamadas legadas, mas nao aparecem no frontend.

## Seguranca

`ordenar_por` nunca e concatenado em SQL dinamico. Cada RPC valida a coluna contra uma whitelist e ordena com expressoes `case`. `por_pagina` e limitado a 100.

## Dimensoes e snapshots

As bases continuam preservando `data_referencia` para snapshots. A migration global adiciona `macrogrupo`, `curva` e `marca` nas bases operacionais e usa fallback de categoria ou dimensoes relacionadas quando o dado ainda nao foi enviado. Novas cargas devem preencher as tres dimensoes sempre que existirem na origem.

## Aplicacao

Execute no Supabase:

1. `supabase/migrations/20260718220000_schema_atual_e_rpcs.sql`, caso a correcao anterior ainda nao tenha sido aplicada;
2. `supabase/migrations/20260718230000_filtros_paginacao_servidor.sql`;
3. `supabase/migrations/20260719120000_dominio_filtros_globais_skyler.sql`;
4. `supabase/tests/04_smoke_filtros_globais.sql`.
