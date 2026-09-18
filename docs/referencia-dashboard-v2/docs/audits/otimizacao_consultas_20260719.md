# Otimizacao de consultas e payloads — 2026-07-19

## Problema

As RPCs recalculavam KPIs, graficos e opcoes de filtros em toda troca de pagina ou ordenacao. Algumas respostas convertiam a linha interna inteira para JSON, incluindo campos usados apenas nos calculos. Joins de tabelas historicas tambem poderiam multiplicar linhas conforme novos snapshots fossem acumulados.

## Correcao

- `incluir_metricas=false` em paginacao e ordenacao;
- `incluir_opcoes=true` somente na primeira carga da tela;
- itens serializados com `jsonb_build_object`, somente com campos consumidos;
- remocao de `to_jsonb(linha)` nas RPCs ativas;
- remocao de `SELECT *` na migration de leitura ativa;
- busca do snapshot relacionado mais recente com `LATERAL ... LIMIT 1`;
- indices compostos por empresa, SKU e data de referencia;
- contagem total independente da pagina atual;
- validacao automatica contra retorno de `.select('*')`.

## Contrato da RPC

Consulta completa:

```json
{
  "pagina": 1,
  "por_pagina": 25,
  "incluir_metricas": true,
  "incluir_opcoes": true
}
```

Consulta leve de paginacao ou ordenacao:

```json
{
  "pagina": 2,
  "por_pagina": 25,
  "incluir_metricas": false,
  "incluir_opcoes": false
}
```

Na consulta leve a RPC retorna somente `itens`, `total_count`, `pagina` e `por_pagina`.
