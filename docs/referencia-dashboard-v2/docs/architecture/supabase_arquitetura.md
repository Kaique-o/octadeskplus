# Arquitetura atual do backend Supabase

> Atualizado em 19/07/2026. Este documento substitui a arquitetura baseada em `estoque_produto_diario`, `radar_estoque_curva_status` e views `vw_*` removidas no reset de 18/07/2026.

## 1. Diagrama lógico

```text
Sankhya / outras fontes
          |
          v
         n8n
          |
          | service_role
          v
+-------------------------------+
| Supabase PostgreSQL           |
|                               |
| snapshots principais          |
| - produtos                    |
| - radar_estoque               |
| - rupturas                    |
| - sugestoes_compra            |
|                               |
| bases operacionais            |
| - budget_mensal               |
| - transferencias_eventos      |
| - recebimentos_eventos        |
| - fornecedores_snapshot_diario|
| - fornecedores_followups      |
|                               |
| RPCs get_* / ingest_*         |
| RLS + Auth                    |
+-------------------------------+
          ^
          | anon key + JWT
          |
Cloudflare Pages / navegador
```

## 2. Responsabilidade de cada camada

### Sankhya

Origem de cadastro, estoque, compra, venda, recebimento e transferência. As regras pesadas de negócio podem continuar no SQL do ERP enquanto não forem formalmente migradas.

### n8n

Orquestra extração, transformação, validação, divisão em lotes e envio ao Supabase. Deve usar `service_role` apenas nas credenciais internas do fluxo.

### Supabase

Mantém snapshots e eventos, executa filtros, paginação, agregações, RLS e autenticação. É a única fonte lida pelo frontend.

### Frontend

Envia filtros pela camada `src/js/data/data-access.js`, renderiza o retorno e controla estados de consulta. Não importa o cliente Supabase nas telas, não agrega bases completas e não aplica filtros sobre linhas já renderizadas.

## 3. Modelo de dados

### 3.1 `produtos`

Campos consumidos ou garantidos pelas migrations:

```text
empresa_nome
data_referencia
sku
produto
marca
modelo_comercial
tecnologia_skytech
cores
qualidade
qualidade_fornecedor
descricao_fornecedor
categoria
data_alteracao
```

### 3.2 `radar_estoque`

```text
empresa_nome
data_referencia
sku
descricao
curva_status
estoque_principal
status_estoque_principal
necessidade_5_dias
necessidade_10_dias
necessidade_20_dias
necessidade_90_dias
```

### 3.3 `rupturas`

```text
empresa_nome
data_referencia
sku
dias_ruptura_30d
estoque_hoje
```

### 3.4 `sugestoes_compra`

```text
empresa_nome
data_referencia
sku
produto
curva
categoria
saldo_principal
comprado
dias_cobertura_principal
sugestao_total
ultimo_fornecedor
ultimo_custo_medio
valor_sugestao_total
status_estoque_principal
```

### 3.5 `budget_mensal`

```text
id
periodo
empresa_nome
centro_custo
categoria
valor_orcado
valor_comprado
cmv
valor_projetado_mes
atualizado_em
```

### 3.6 `transferencias_eventos`

```text
id
empresa_nome
codigo_transferencia
sku
descricao_produto
marca
categoria
custo_medio
loja_origem_nome
loja_destino_nome
quantidade
estoque_origem
estoque_destino
prioridade
status
responsavel
data_solicitacao
data_recebimento
atualizado_em
```

### 3.7 `recebimentos_eventos`

```text
id
empresa_nome
numero_nota
numero_pedido
fornecedor_nome
local_nome
previsao_recebimento
data_recebimento
quantidade_itens
volumes
valor_recebido
percentual_conferencia
divergencias
status
responsavel
atualizado_em
```

### 3.8 `fornecedores_snapshot_diario`

```text
id
empresa_nome
data_referencia
nome
categoria
cnpj
score
responsavel
qtd_pedidos
valor_comprado
prazo_medio_dias
atraso_medio_dias
variacao_custo_pct
qtd_divergencias
ativo
atualizado_em
```

### 3.9 `fornecedores_followups`

```text
id
ordem
nome_fornecedor
issue
proximo_passo
prazo
atualizado_em
```

## 4. Estratégia temporal

`produtos`, `radar_estoque`, `rupturas`, `sugestoes_compra` e `fornecedores_snapshot_diario` são tratados como snapshots.

Regras atuais:

- o filtro de período limita quais snapshots podem ser escolhidos;
- a RPC usa o snapshot mais recente por empresa dentro desse período;
- tabelas relacionadas são associadas pelo mesmo `sku` e `empresa_nome`;
- quando as datas não coincidem, é escolhido o registro relacionado mais recente com `data_referencia <= data principal`;
- registros anteriores não devem ser apagados se o histórico for necessário.

A migration atribuiu `current_date` aos registros antigos quando adicionou `data_referencia`. Portanto, não existe histórico retroativo anterior à aplicação dessa migration.

## 5. Contrato de leitura

As telas usam uma RPC principal por contexto. O payload é um JSONB com busca, período, filtros, paginação e ordenação.

```javascript
import { dataAccess } from '../data/data-access.js';

const retorno = await dataAccess.dashboard.produtos({
  pagina: 1,
  por_pagina: 25,
  search: 'galaxy',
  empresa_nome: 'Empresa 3',
  marca: 'SAMSUNG',
  ordenar_por: 'data_atualizacao',
  ordem: 'desc',
  incluir_metricas: true,
  incluir_opcoes: true
});
```

A página seguinte deve usar:

```json
{
  "pagina": 2,
  "por_pagina": 25,
  "incluir_metricas": false,
  "incluir_opcoes": false
}
```

## 6. Camada de acesso no frontend

`src/js/data/data-access.js` e a unica fachada autorizada a usar `supabase-client.js`. Ela expõe os dominios `dashboard`, `auth`, `users`, `permissions` e `parameters`, clona filtros antes das RPCs e converte falhas do SDK em `DataAccessError`.

O validador bloqueia imports do cliente e chamadas `.rpc()`, `.from()` ou `supabase.auth` fora dessa camada.

## 7. Performance

O desenho atual evita:

- `.select('*')` no frontend;
- carga integral de milhares de linhas;
- filtro client-side sobre o DOM;
- recálculo de KPIs em toda paginação;
- serialização de linha interna completa;
- multiplicação de registros por joins de snapshots.

Índices principais cobrem empresa, SKU, período, status e datas de evento. Mudanças de filtro frequentes devem ser avaliadas com `EXPLAIN (ANALYZE, BUFFERS)` antes de criar novos índices.

## 8. Segurança e multiempresa

RLS está habilitada e a leitura exige usuário autenticado. Entretanto, a policy atual não restringe cada usuário à própria empresa.

Situação atual:

```text
empresa_nome = dimensão de filtro
empresa_nome != isolamento de segurança
```

Para isolamento multiempresa real será necessário:

1. definir uma chave de empresa estável, preferencialmente `empresa_id`;
2. associar usuário e empresa em `usuarios_perfis` ou tabela própria;
3. substituir a policy genérica por uma policy baseada nessa associação;
4. impedir que o cliente informe empresa arbitrária;
5. validar a empresa também nas RPCs `SECURITY INVOKER`.

## 9. Migrations e legado

### Ativas

```text
20260718220000_schema_atual_e_rpcs.sql
20260718230000_filtros_paginacao_servidor.sql
20260719000000_otimizar_consultas_payloads.sql
```

### Legado

```text
supabase/sql/01_schema_tabelas.sql
...
supabase/sql/12_permissoes_acesso.sql
```

O diretório `supabase/sql/` mantém histórico e a cópia `13_schema_atual_e_rpcs.sql`, mas o deploy do banco atual deve ser guiado por `supabase/migrations/`.

## 10. Riscos ainda abertos

- falta chave única formal para upsert dos quatro snapshots principais;
- falta RPC de ingestão específica para os quatro snapshots principais;
- RLS não isola empresas;
- tabelas de eventos usam chaves globais (`codigo_transferencia` e `numero_nota`), que podem colidir entre empresas;
- `fornecedores_followups` é substituído integralmente em cada ingestão;
- não existe observabilidade persistida de cada execução do n8n;
- parte das RPCs secundárias históricas continua no banco por compatibilidade, mas o frontend usa somente as nove principais.

Não esconder esses riscos em fallback de mock ou documentação antiga.
