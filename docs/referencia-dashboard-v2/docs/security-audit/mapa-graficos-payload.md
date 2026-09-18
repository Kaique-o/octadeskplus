# Mapa: chaves de gráfico → payload das RPCs

Referência do achado nº 5 da auditoria. Liga cada chave do `CATALOGO`
(`src/shared/context/PermissionsProvider.jsx`) ao caminho que ela controla na resposta da RPC.

**Este documento é descritivo; a fonte executável é a tabela `permissoes_graficos_mapa`**, semeada em
`supabase/migrations/20260829120000_permissoes_por_grafico_no_servidor.sql`. As tabelas abaixo foram
geradas a partir daquele SQL — não edite aqui esperando mudar o comportamento.

`npm run check:security` compara o `CATALOGO` com o mapa e falha se aparecer chave nova sem entrada
correspondente, então a deriva entre os dois não passa despercebida.

## Por que existem três baldes

As chaves do `CATALOGO` são de interface (`kpi-orcado`, `resumo-mensal`) e as do payload são de dado
(`kpis.valor_orcado`, `itens`). O mapeamento não é 1:1, e cada formato pede um tratamento:

| Balde | O que é                                                                        | Como o servidor recorta    |
| ----- | ------------------------------------------------------------------------------ | -------------------------- |
| **A** | KPI dentro do objeto `kpis`                                                    | remove o campo de `kpis`   |
| **B** | bloco servido por RPC própria de widget                                        | a própria RPC devolve `[]` |
| **C** | bloco montado a partir de uma chave de raiz (`itens`, `matriz`, `categorias`…) | remove a chave de raiz     |

O balde C tem a única regra não óbvia: **um caminho só é removido quando nenhum gráfico permitido o
consome.** Em `budget`, `resumo-mensal` e `cmv-x-comprado` leem o mesmo `itens` — sem essa regra,
desmarcar a tabela apagaria o gráfico junto. As linhas marcadas com **C — compartilhado** são as que
dependem disso; estão cobertas por `supabase/tests/09_smoke_rpcs_widgets_e_graficos.sql`.

## Chaves sem consumo

Duas chaves existem no `CATALOGO` e nenhuma tela usa: `home/kpi-transferencias-pendentes` e
`home/risco-estoque-semana`. Não há caminho de payload a recortar enquanto nenhum bloco as ler. Elas
estão declaradas em `CHAVES_SEM_CONSUMO`, em `scripts/check-security.js` — se um dia forem ligadas na
tela, o validador exige que entrem no mapa junto.

Total: 81 chaves mapeadas + 2 sem consumo = 83, o tamanho do `CATALOGO`.

## Mapeamento por módulo

### `home`

| Chave do CATALOGO      | Onde vive no payload    | Balde |
| ---------------------- | ----------------------- | ----- |
| `kpi-skus-monitorados` | `kpis.skus_monitorados` | A     |
| `kpi-rupturas`         | `kpis.rupturas`         | A     |
| `kpi-excesso`          | `kpis.excesso`          | A     |
| `kpi-cobertura-media`  | `kpis.cobertura_media`  | A     |
| `kpi-comprado-mes`     | `kpis.comprado_mes`     | A     |
| `matriz-curva-status`  | `matriz`                | C     |
| `distribuicao-status`  | `distribuicao_status`   | C     |
| `itens-criticos`       | `itens`                 | C     |

### `sugestao-compra`

| Chave do CATALOGO             | Onde vive no payload              | Balde |
| ----------------------------- | --------------------------------- | ----- |
| `kpi-itens-sugeridos`         | `kpis.itens_sugeridos`            | A     |
| `kpi-valor-estimado`          | `kpis.valor_estimado`             | A     |
| `kpi-compra-urgente`          | `kpis.compra_urgente`             | A     |
| `kpi-cobertura-pos-compra`    | `kpis.cobertura_pos_compra_media` | A     |
| `kpi-fornecedores-envolvidos` | `kpis.fornecedores_envolvidos`    | A     |
| `tabela-sugestao`             | `itens`                           | C     |
| `resumo-fornecedor`           | `fornecedores_resumo`             | C     |
| `distribuicao-prioridade`     | `distribuicao_prioridade`         | C     |
| `cobertura-pos-compra`        | `cobertura_serie`                 | C     |

### `budget`

| Chave do CATALOGO      | Onde vive no payload           | Balde                 |
| ---------------------- | ------------------------------ | --------------------- |
| `kpi-orcado`           | `kpis.valor_orcado`            | A                     |
| `kpi-comprado`         | `kpis.valor_comprado`          | A                     |
| `kpi-cmv`              | `kpis.cmv`                     | A                     |
| `kpi-desvio`           | `kpis.desvio`                  | A                     |
| `kpi-aderencia-budget` | `kpis.percentual_aderencia`    | A                     |
| `kpi-projetado-mes`    | `kpis.valor_projetado_mes`     | A                     |
| `resumo-mensal`        | `itens`                        | **C — compartilhado** |
| `cmv-x-comprado`       | `itens`                        | **C — compartilhado** |
| `budget-categoria`     | RPC `get_budget_por_categoria` | B                     |

### `transferencias`

| Chave do CATALOGO             | Onde vive no payload                | Balde |
| ----------------------------- | ----------------------------------- | ----- |
| `kpi-solicitacoes-abertas`    | `kpis.solicitacoes_abertas`         | A     |
| `kpi-em-transito`             | `kpis.em_transito`                  | A     |
| `kpi-transferencias-urgentes` | `kpis.urgentes`                     | A     |
| `kpi-valor-estimado`          | `kpis.valor_estimado`               | A     |
| `kpi-tempo-medio`             | `kpis.tempo_medio_dias`             | A     |
| `tabela-transferencias`       | `itens`                             | C     |
| `lojas-maior-necessidade`     | RPC `get_transferencias_por_loja`   | B     |
| `transferencias-status`       | RPC `get_transferencias_por_status` | B     |

### `excesso`

| Chave do CATALOGO                | Onde vive no payload              | Balde                 |
| -------------------------------- | --------------------------------- | --------------------- |
| `kpi-itens-excesso`              | `kpis.itens_em_excesso`           | A                     |
| `kpi-valor-parado`               | `kpis.valor_parado`               | A                     |
| `kpi-cobertura-media`            | `kpis.cobertura_media_dias`       | A                     |
| `kpi-excesso-curva-a`            | `kpis.valor_excesso_curva_a`      | A                     |
| `kpi-oportunidade-transferencia` | `kpis.oportunidade_transferencia` | A                     |
| `top-categorias-excesso`         | `categorias`                      | C                     |
| `itens-excesso`                  | `itens`                           | **C — compartilhado** |
| `maior-valor-parado`             | `itens`                           | **C — compartilhado** |
| `cobertura-dias-faixa`           | RPC `get_excesso_cobertura_faixa` | B                     |

### `rupturas`

| Chave do CATALOGO         | Onde vive no payload        | Balde |
| ------------------------- | --------------------------- | ----- |
| `kpi-itens-ruptura`       | `kpis.itens_em_ruptura`     | A     |
| `kpi-curva-a-ruptura`     | `kpis.curva_a_em_ruptura`   | A     |
| `kpi-perda-estimada`      | `kpis.perda_estimada`       | A     |
| `kpi-lead-time-medio`     | `kpis.lead_time_medio_dias` | A     |
| `kpi-rupturas-resolvidas` | `kpis.rupturas_resolvidas`  | A     |
| `itens-ruptura`           | `itens`                     | C     |
| `evolucao-rupturas`       | `evolucao`                  | C     |
| `fornecedores-impactados` | `fornecedores_impactados`   | C     |

### `produtos`

| Chave do CATALOGO         | Onde vive no payload       | Balde |
| ------------------------- | -------------------------- | ----- |
| `kpi-produtos-ativos`     | `kpis.produtos_ativos`     | A     |
| `kpi-cadastro-incompleto` | `kpis.cadastro_incompleto` | A     |
| `kpi-curva-a`             | `kpis.curva_a`             | A     |
| `kpi-ativos-compra`       | `kpis.ativos_compra`       | A     |
| `kpi-valor-medio`         | `kpis.valor_medio`         | A     |
| `kpi-fornecedores-padrao` | `kpis.fornecedores_padrao` | A     |
| `cadastro-produtos`       | `itens`                    | C     |
| `pendencias-cadastro`     | `pendencias`               | C     |
| `distribuicao-qualidade`  | `qualidades`               | C     |
| `marcas-mais-skus`        | `marcas`                   | C     |

### `recebimento`

| Chave do CATALOGO            | Onde vive no payload                 | Balde |
| ---------------------------- | ------------------------------------ | ----- |
| `kpi-aguardando-recebimento` | `kpis.aguardando_recebimento`        | A     |
| `kpi-notas-recebidas`        | `kpis.notas_recebidas`               | A     |
| `kpi-divergencias`           | `kpis.divergencias`                  | A     |
| `kpi-valor-recebido`         | `kpis.valor_recebido`                | A     |
| `kpi-tempo-medio`            | `kpis.tempo_medio_dias`              | A     |
| `kpi-recebimento-mes`        | `kpis.recebimento_no_mes`            | A     |
| `controle-recebimento`       | `itens`                              | C     |
| `agenda-recebimentos`        | RPC `get_recebimentos_agenda`        | B     |
| `recebimentos-status`        | RPC `get_recebimentos_por_status`    | B     |
| `valor-recebido-dia`         | RPC `get_recebimentos_valor_por_dia` | B     |

### `fornecedores`

| Chave do CATALOGO          | Onde vive no payload                            | Balde |
| -------------------------- | ----------------------------------------------- | ----- |
| `kpi-fornecedores-ativos`  | `kpis.fornecedores_ativos`                      | A     |
| `kpi-valor-comprado`       | `kpis.valor_comprado`                           | A     |
| `kpi-prazo-medio`          | `kpis.prazo_medio_dias`                         | A     |
| `kpi-atraso-medio`         | `kpis.atraso_medio_dias`                        | A     |
| `kpi-score-medio`          | `kpis.score_medio`                              | A     |
| `kpi-divergencias`         | `kpis.divergencias`                             | A     |
| `performance-fornecedores` | `itens`                                         | C     |
| `ranking-valor-comprado`   | RPC `get_fornecedores_ranking_valor`            | B     |
| `distribuicao-performance` | RPC `get_fornecedores_distribuicao_performance` | B     |
| `followups-prioritarios`   | RPC `get_fornecedores_followups`                | B     |
