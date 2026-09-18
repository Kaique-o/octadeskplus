# Correcao do schema e das RPCs

## Problema corrigido

O reset do banco realizado em 18/07/2026 manteve quatro bases reais:

- `produtos`;
- `radar_estoque`;
- `rupturas`;
- `sugestoes_compra`.

As tabelas operacionais de budget, transferencias, recebimentos e fornecedores foram removidas, mas as RPCs antigas continuaram referenciando essas tabelas ou a base `estoque_produto_diario`. Isso provocava erros `42P01 relation does not exist`.

## Migration

Arquivo principal:

```text
supabase/migrations/20260718220000_schema_atual_e_rpcs.sql
```

Uma copia numerada tambem esta disponivel em:

```text
supabase/sql/13_schema_atual_e_rpcs.sql
```

A migration e nao destrutiva:

- nao executa `drop table`;
- nao executa `truncate`;
- nao apaga as quatro bases reais;
- adiciona somente colunas ausentes;
- recria as tabelas operacionais quando nao existirem;
- substitui as RPCs quebradas por funcoes apontadas para o schema atual;
- restringe RPCs de ingestao ao `service_role`;
- permite leitura somente para usuarios autenticados.

## Como aplicar

No Supabase SQL Editor, execute somente o arquivo:

```text
supabase/migrations/20260718220000_schema_atual_e_rpcs.sql
```

Nao execute novamente os arquivos `01` a `12` sobre o banco atual. Eles representam arquiteturas anteriores e podem recriar objetos obsoletos.

Depois execute:

```text
supabase/tests/01_smoke_schema_rpcs.sql
```

O smoke test valida a existencia das tabelas e RPCs principais e chama cada funcao com uma consulta pequena.

## Bases que precisam de ingestao

A migration recria as estruturas, mas nao inventa dados historicos. Os fluxos n8n devem alimentar:

| Tela           | Tabela                         | RPC de ingestao                                            |
| -------------- | ------------------------------ | ---------------------------------------------------------- |
| Budget         | `budget_mensal`                | `ingest_budget` ou `ingest_budget_mensal`                  |
| Transferencias | `transferencias_eventos`       | `ingest_transferencias` ou `ingest_transferencias_eventos` |
| Recebimentos   | `recebimentos_eventos`         | `ingest_recebimentos` ou `ingest_recebimentos_eventos`     |
| Fornecedores   | `fornecedores_snapshot_diario` | `ingest_fornecedores` ou `ingest_fornecedores_snapshot`    |
| Follow-ups     | `fornecedores_followups`       | `ingest_fornecedores_followups`                            |

Enquanto essas tabelas estiverem vazias, o frontend mostra um estado vazio real. Ele nao mantem mais dados mockados como se fossem dados do banco.

## Contratos minimos de payload

### Budget

```json
[
  {
    "periodo": "2026-07-01",
    "empresa_nome": "Todas",
    "centro_custo": "Compras",
    "categoria": "Smartphones",
    "valor_orcado": 100000,
    "valor_comprado": 85000,
    "cmv": 70000,
    "valor_projetado_mes": 95000
  }
]
```

### Transferencias

```json
[
  {
    "codigo_transferencia": "TRF-0001",
    "sku": "SKU-001",
    "descricao_produto": "Produto",
    "loja_origem_nome": "Matriz",
    "loja_destino_nome": "Loja 01",
    "quantidade": 10,
    "estoque_origem": 50,
    "estoque_destino": 0,
    "prioridade": "alta",
    "status": "solicitada",
    "data_solicitacao": "2026-07-18T10:00:00-03:00"
  }
]
```

### Recebimentos

```json
[
  {
    "numero_nota": "12345",
    "numero_pedido": "PED-001",
    "fornecedor_nome": "Fornecedor",
    "previsao_recebimento": "2026-07-20",
    "quantidade_itens": 100,
    "volumes": 5,
    "valor_recebido": 50000,
    "divergencias": 0,
    "status": "aguardando"
  }
]
```

### Fornecedores

```json
[
  {
    "data_referencia": "2026-07-18",
    "nome": "Fornecedor",
    "categoria": "Smartphones",
    "score": 92,
    "qtd_pedidos": 20,
    "valor_comprado": 250000,
    "prazo_medio_dias": 5.2,
    "atraso_medio_dias": 0.4,
    "qtd_divergencias": 1,
    "ativo": true
  }
]
```

## Mudancas no frontend

As telas abaixo deixaram de usar mock silencioso quando a RPC falha ou retorna zero registros:

- Budget;
- Excesso;
- Transferencias;
- Recebimentos;
- Fornecedores.

Agora existem tres estados distintos:

1. dados reais carregados;
2. Supabase conectado, mas tabela vazia;
3. erro real de consulta.
