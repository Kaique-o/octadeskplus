# Backend e dados — Dashboard Compras

> **Fonte de verdade em 19/07/2026:** este documento, as migrations em `supabase/migrations/` e os smoke tests em `supabase/tests/`.
>
> Os arquivos `supabase/sql/01_schema_tabelas.sql` a `supabase/sql/12_permissoes_acesso.sql`, planilhas antigas e planos datados antes de 18/07/2026 são **históricos**. Não devem ser reaplicados no banco atual.

## 1. Visão geral

O frontend é estático e publicado na Cloudflare Pages. O backend ativo é o Supabase:

- PostgreSQL para armazenamento e agregação;
- Auth para sessão do usuário;
- RLS para restringir leitura;
- RPCs PostgreSQL para leitura paginada, filtros, KPIs e gráficos;
- REST/RPC com `service_role` para ingestão pelo n8n;
- frontend usando apenas `SUPABASE_URL` e `SUPABASE_ANON_KEY`.

O navegador não deve consultar tabelas de negócio diretamente. As nove telas operacionais (React, `src/modulos/compras/paginas/*.jsx`) consomem as RPCs principais `get_*` exclusivamente pela fachada `src/shared/data/data-access.js`.

## 2. Ordem obrigatória das migrations

`supabase/migrations/` é aplicada **inteira e em ordem lexicográfica** — é isso que o nome com timestamp garante. Não existe subconjunto a escolher: hoje são **35 arquivos**, de `20260718220000_schema_atual_e_rpcs.sql` a `20260814190000_reconcilia_ordenacao_sugestao_compra.sql`.

> O timestamp **não tem underscore separando data e hora**. Documentos antigos citam nomes como `20260718220000_...`, que não existem no disco.

As migrations são incrementais. Os marcos principais:

| migration                                                 | o que estabelece                                                    |
| --------------------------------------------------------- | ------------------------------------------------------------------- |
| `20260718220000_schema_atual_e_rpcs.sql`                  | preserva as bases reais e recria as estruturas operacionais         |
| `20260718230000_filtros_paginacao_servidor.sql`           | dimensão de empresa, período, paginação e filtros                   |
| `20260719000000_otimizar_consultas_payloads.sql`          | substitui as nove RPCs principais por respostas enxutas             |
| `20260719120000_dominio_filtros_globais_skyler.sql`       | padroniza `macrogrupo`, `curva` e `marca` nas nove telas            |
| `20260729115100_seguranca_multiempresa_reconciliacao.sql` | revoga leitura direta das tabelas, exige módulo e escopo de empresa |
| `20260730022000_integracao_horaria_n8n.sql`               | `ingest_dashboard_dataset` e as tabelas de ingestão                 |

Depois executar os smoke tests de `supabase/tests/`, também em ordem:

```text
00_preflight_producao.sql
01_smoke_schema_rpcs.sql
02_smoke_filtros_servidor.sql
03_smoke_consultas_enxutas.sql
04_smoke_filtros_globais.sql
05_smoke_seguranca_multiempresa.sql      # segurança multiempresa
06_smoke_integracao_horaria.sql          # ETL horário
07_smoke_compatibilidade_perfil.sql      # compatibilidade de perfil legado
08_smoke_integracao_paginada.sql
```

`npm run test:db:fresh` recria o Supabase local via Docker e roda esses smokes (destrutivo, só local).

## 3. Tabelas ativas

### Snapshots principais

| Tabela             | Grão                                                  | Uso                                           |
| ------------------ | ----------------------------------------------------- | --------------------------------------------- |
| `produtos`         | produto por `empresa_nome`, `sku` e `data_referencia` | cadastro e enriquecimento da tela de produtos |
| `radar_estoque`    | estoque calculado por empresa, SKU e data             | home e excesso                                |
| `rupturas`         | ruptura por empresa, SKU e data                       | tela de rupturas                              |
| `sugestoes_compra` | sugestão por empresa, SKU e data                      | sugestão de compra e enriquecimentos          |

Campos comuns adicionados às quatro tabelas:

```text
empresa_nome text not null default 'Todas'
data_referencia date not null default current_date
```

As RPCs selecionam o snapshot mais recente dentro do período filtrado para cada empresa. Joins entre snapshots usam o registro relacionado mais recente com data menor ou igual à referência principal.

### Bases operacionais

| Tabela                         | Chave de atualização                                | Uso                                           |
| ------------------------------ | --------------------------------------------------- | --------------------------------------------- |
| `budget_mensal`                | `periodo + empresa_nome + centro_custo + categoria` | orçamento e realizado                         |
| `transferencias_eventos`       | `codigo_transferencia`                              | solicitações e recebimentos de transferências |
| `recebimentos_eventos`         | `numero_nota`                                       | agenda e conferência de recebimentos          |
| `fornecedores_snapshot_diario` | `data_referencia + empresa_nome + nome`             | desempenho diário de fornecedores             |
| `fornecedores_followups`       | carga substitutiva                                  | pendências e próximos passos                  |

## 4. RPCs principais de leitura

| Tela               | RPC                   |
| ------------------ | --------------------- |
| Home               | `get_home_dashboard`  |
| Sugestão de compra | `get_sugestao_compra` |
| Rupturas           | `get_rupturas`        |
| Excesso            | `get_excesso`         |
| Produtos           | `get_produtos`        |
| Budget             | `get_budget`          |
| Transferências     | `get_transferencias`  |
| Recebimentos       | `get_recebimentos`    |
| Fornecedores       | `get_fornecedores`    |

Todas recebem um único parâmetro:

```sql
filtros jsonb default '{}'::jsonb
```

### Parâmetros compartilhados

```json
{
  "pagina": 1,
  "por_pagina": 25,
  "search": "iphone",
  "macrogrupo": "SMARTPHONES",
  "curva": "A",
  "marca": "SAMSUNG",
  "ordenar_por": "custo_total",
  "ordem": "desc",
  "incluir_metricas": true,
  "incluir_opcoes": true
}
```

Regras:

- `por_pagina` é limitado entre 1 e 100;
- `search` e o alias legado `busca` são aceitos;
- `ordem` aceita `asc`; qualquer outro valor vira `desc`;
- `ordenar_por` é validado por whitelist dentro de cada RPC;
- primeira carga: `incluir_metricas=true` e `incluir_opcoes=true`;
- paginação e ordenação: `incluir_metricas=false` e `incluir_opcoes=false`.

### Resposta mínima comum

```json
{
  "itens": [],
  "total_count": 0,
  "pagina": 1,
  "por_pagina": 25
}
```

Quando solicitados, podem ser adicionados `kpis`, `opcoes` e blocos específicos da tela. A resposta é montada campo a campo com `jsonb_build_object`; não retornar linha inteira, `SELECT *` ou `to_jsonb(linha)` nas RPCs principais.

## 5. Filtros e ordenação por RPC

Todas as nove RPCs aplicam os filtros globais abaixo por meio de `public.filtro_dimensoes_compras(...)`:

- `macrogrupo`;
- `curva`;
- `marca`.

As opções dos três selects são retornadas por `public.get_filtros_compras_opcoes()` quando `incluir_opcoes=true`.

| RPC                   | Ordenação permitida                                                                                                                                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_home_dashboard`  | `descricao`, `curva_status`, `estoque_principal`, `status_estoque_principal`, `necessidade_90_dias`                                                                                                               |
| `get_sugestao_compra` | `sku`, `descricao_produto`, `curva`, `saldo_atual`, `comprado`, `cobertura_dias`, `sugestao_compra_qtd`, `fornecedor_nome`, `custo_unitario`, `custo_total`, `prioridade`                                         |
| `get_rupturas`        | `sku`, `descricao_produto`, `curva`, `saldo_atual`, `dias_em_ruptura`, `fornecedor_nome`, `impacto_estimado_perda`, `prioridade`                                                                                  |
| `get_excesso`         | `sku`, `descricao_produto`, `categoria`, `curva`, `saldo_atual`, `cobertura_dias`, `valor_em_estoque`, `prioridade`                                                                                               |
| `get_produtos`        | `sku`, `descricao_produto`, `marca`, `modelo_comercial`, `cor`, `qualidade`, `fornecedor_padrao_nome`, `saldo_total_rede`, `custo_medio`, `status_estoque`, `data_atualizacao`                                    |
| `get_budget`          | `periodo`, `valor_orcado`, `valor_comprado`, `cmv`, `desvio`, `percentual_aderencia`                                                                                                                              |
| `get_transferencias`  | `codigo_transferencia`, `loja_origem_nome`, `loja_destino_nome`, `sku`, `descricao_produto`, `quantidade`, `estoque_origem`, `estoque_destino`, `prioridade`, `status`, `data_solicitacao`, `responsavel`         |
| `get_recebimentos`    | `numero_nota`, `numero_pedido`, `fornecedor_nome`, `previsao_recebimento`, `data_recebimento`, `quantidade_itens`, `volumes`, `valor_recebido`, `percentual_conferencia`, `divergencias`, `status`, `responsavel` |
| `get_fornecedores`    | `nome`, `categoria`, `qtd_pedidos`, `valor_comprado`, `prazo_medio_dias`, `atraso_medio_dias`, `variacao_custo_pct`, `score`, `status`, `responsavel`                                                             |

## 6. Blocos adicionais das respostas

| RPC                   | Blocos opcionais quando `incluir_metricas=true`                                       |
| --------------------- | ------------------------------------------------------------------------------------- |
| `get_home_dashboard`  | `kpis`, `matriz`, `distribuicao_status`                                               |
| `get_sugestao_compra` | `kpis`, `resumo`, `distribuicao_prioridade`, `fornecedores_resumo`, `cobertura_serie` |
| `get_rupturas`        | `kpis`, `fornecedores_impactados`, `evolucao`                                         |
| `get_excesso`         | `kpis`, `categorias`                                                                  |
| `get_produtos`        | `kpis`, `pendencias`, `qualidades`, `marcas`                                          |
| demais                | `kpis`                                                                                |

`opcoes` só deve ser retornado quando `incluir_opcoes=true`.

## 7. Ingestão

### RPCs disponíveis

| RPC principal                   | Alias legado            |
| ------------------------------- | ----------------------- |
| `ingest_budget_mensal`          | `ingest_budget`         |
| `ingest_transferencias_eventos` | `ingest_transferencias` |
| `ingest_recebimentos_eventos`   | `ingest_recebimentos`   |
| `ingest_fornecedores_snapshot`  | `ingest_fornecedores`   |
| `ingest_fornecedores_followups` | —                       |

Todas aceitam objeto único ou array JSON. A resposta padrão é:

```json
{
  "ok": true,
  "processados": 10
}
```

`ingest_fornecedores_snapshot` também pode receber `p_data_referencia` e retorna essa data.

### Quatro snapshots principais

O repositório atual não contém RPCs `ingest_*` para `produtos`, `radar_estoque`, `rupturas` e `sugestoes_compra`.

A carga dessas tabelas deve ser feita pelo n8n usando `service_role` e upsert direto pela API REST, ou por uma migration futura que crie RPCs específicas. Não chamar essas tabelas com a chave `anon`.

Antes de automatizar upsert dos snapshots principais, criar e validar chaves únicas coerentes com o grão `empresa_nome + sku + data_referencia`. Hoje existem índices de leitura, mas o contrato de conflito para essas quatro tabelas ainda precisa ser formalizado.

## 8. Segurança

- RPCs `get_*`: `SECURITY INVOKER`, executáveis somente por `authenticated`;
- RPCs `ingest_*`: `SECURITY DEFINER`, executáveis somente por `service_role`;
- RLS habilitada nas nove tabelas;
- usuários autenticados possuem apenas leitura das tabelas de negócio;
- `service_role` possui escrita para integrações;
- nunca colocar `service_role` em `.env` público, Cloudflare Pages, HTML ou JavaScript;
- o frontend usa somente a chave `anon` com sessão autenticada.

A policy atual de leitura verifica `auth.uid() is not null`. Ela não aplica isolamento real por empresa. `empresa_nome` é filtro funcional, não barreira de segurança. Caso o projeto precise de isolamento multiempresa, criar vínculo entre usuário e empresa e aplicar essa regra na RLS e nas RPCs.

## 9. Camada única de acesso no frontend

O único arquivo autorizado a importar `src/shared/data/supabase-client.js` é:

```text
src/shared/data/data-access.js
```

`src/shared/data/data-access.js` é o único módulo autorizado a importar `src/shared/data/supabase-client.js`. Páginas, componentes, contexts e hooks consomem métodos semânticos — `npm run check:architecture` falha se algum deles chamar `.rpc()`, `.from()` ou `supabase.auth` direto.

Domínios públicos:

| Domínio                  | Responsabilidade                                       |
| ------------------------ | ------------------------------------------------------ |
| `dataAccess.dashboard`   | nove RPCs paginadas das telas operacionais             |
| `dataAccess.auth`        | sessão, login, logout, recuperação e senha             |
| `dataAccess.users`       | perfis, listagem administrativa e atualização de papel |
| `dataAccess.permissions` | leitura e gravação de `permissoes_acesso`              |
| `dataAccess.parameters`  | leitura e atualização de `parametros_compras`          |

A camada transforma falhas do SDK em `DataAccessError` e registra a operação que falhou. Páginas e componentes não devem conhecer nomes de tabela, formato bruto do SDK ou códigos específicos do PostgREST.

Operações novas devem ser implementadas primeiro nessa camada e depois consumidas pela UI.

## 10. Estados do frontend

Cada tela React controla seu próprio estado de consulta (`useState`/`useEffect` local, ver `docs/ai/componentes.md`), seguindo este contrato:

- `loading`: consulta em andamento;
- `success`: resposta válida com registros;
- `empty`: `total_count = 0` (ou total agregado de `kpis` quando a RPC não devolve `total_count`);
- `error`: falha de RPC/rede, com repetição da mesma consulta;
- componente sem fonte real simplesmente não renderiza (controlado por `podeVerGrafico`).

Mock não é fallback de consulta em produção — o MSW (`mocks/handlers.js`) só liga em dev local com `VITE_USE_MSW=true`. Erro e ausência de dados devem permanecer explícitos.

## 11. Regras para alterações futuras

Antes de alterar backend:

1. confirmar a migration ativa mais recente;
2. verificar o JavaScript da tela e os campos realmente consumidos;
3. manter o contrato comum de paginação;
4. adicionar filtros no SQL e no frontend no mesmo commit;
5. adicionar a coluna à whitelist de ordenação quando necessário;
6. não retornar campos não utilizados;
7. atualizar este documento e o guia do n8n;
8. adicionar ou alterar a operacao correspondente em `data-access.js`;
9. executar `npm run check` e os três smoke tests;
10. testar a migration em ambiente separado antes de produção.
