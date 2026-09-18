# Guia atual de integração n8n → Supabase

> Atualizado em 19/07/2026 para o schema ativo. Este guia substitui os fluxos baseados em `estoque_produto_diario`, `radar_estoque_curva_status` e views removidas.

## 1. Credenciais

No n8n, usar credencial HTTP Header Auth com:

```text
apikey: <SUPABASE_SERVICE_ROLE_KEY>
Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
Content-Type: application/json
Prefer: return=representation
```

Base URL:

```text
https://<project-ref>.supabase.co
```

A `service_role` deve existir somente no n8n ou em backend protegido. Nunca enviar essa chave ao frontend.

## 2. Endpoints de ingestão por RPC

Formato:

```text
POST /rest/v1/rpc/<nome_da_funcao>
```

### Budget

```text
POST /rest/v1/rpc/ingest_budget_mensal
```

Alias compatível:

```text
POST /rest/v1/rpc/ingest_budget
```

Body:

```json
{
  "p_payload": [
    {
      "periodo": "2026-07-01",
      "empresa_nome": "Empresa 3",
      "centro_custo": "Compras",
      "categoria": "Smartphones",
      "valor_orcado": 100000,
      "valor_comprado": 85000,
      "cmv": 70000,
      "valor_projetado_mes": 95000
    }
  ]
}
```

Upsert por:

```text
periodo + empresa_nome + centro_custo + categoria
```

### Transferências

```text
POST /rest/v1/rpc/ingest_transferencias_eventos
```

Alias:

```text
POST /rest/v1/rpc/ingest_transferencias
```

Body:

```json
{
  "p_payload": [
    {
      "empresa_nome": "Empresa 3",
      "codigo_transferencia": "TRF-0001",
      "sku": "SKU-001",
      "descricao_produto": "Produto",
      "marca": "SAMSUNG",
      "categoria": "Smartphones",
      "custo_medio": 1500,
      "loja_origem_nome": "Matriz",
      "loja_destino_nome": "Loja 01",
      "quantidade": 10,
      "estoque_origem": 50,
      "estoque_destino": 0,
      "prioridade": "Alta",
      "status": "Solicitada",
      "responsavel": "Compras",
      "data_solicitacao": "2026-07-19T10:00:00-03:00",
      "data_recebimento": null
    }
  ]
}
```

Upsert por `codigo_transferencia`.

Risco atual: a chave é global. Se empresas distintas puderem repetir o código, alterar a constraint para `empresa_nome + codigo_transferencia` antes de integrar.

### Recebimentos

```text
POST /rest/v1/rpc/ingest_recebimentos_eventos
```

Alias:

```text
POST /rest/v1/rpc/ingest_recebimentos
```

Body:

```json
{
  "p_payload": [
    {
      "empresa_nome": "Empresa 3",
      "numero_nota": "12345",
      "numero_pedido": "PED-001",
      "fornecedor_nome": "Fornecedor",
      "local_nome": "Matriz",
      "previsao_recebimento": "2026-07-20",
      "data_recebimento": null,
      "quantidade_itens": 100,
      "volumes": 5,
      "valor_recebido": 50000,
      "percentual_conferencia": 0,
      "divergencias": 0,
      "status": "Aguardando",
      "responsavel": "Recebimento"
    }
  ]
}
```

Upsert por `numero_nota`.

Risco atual: a chave é global e não inclui empresa, série ou fornecedor.

### Snapshot de fornecedores

```text
POST /rest/v1/rpc/ingest_fornecedores_snapshot
```

Body:

```json
{
  "p_payload": [
    {
      "data_referencia": "2026-07-19",
      "empresa_nome": "Empresa 3",
      "nome": "Fornecedor",
      "categoria": "Smartphones",
      "cnpj": "00000000000100",
      "score": 92,
      "responsavel": "Comprador A",
      "qtd_pedidos": 20,
      "valor_comprado": 250000,
      "prazo_medio_dias": 5.2,
      "atraso_medio_dias": 0.4,
      "variacao_custo_pct": 1.5,
      "qtd_divergencias": 1,
      "ativo": true
    }
  ],
  "p_data_referencia": "2026-07-19"
}
```

Upsert por:

```text
data_referencia + empresa_nome + nome
```

Alias `ingest_fornecedores` usa `current_date` e não permite informar `p_data_referencia`. Preferir a função completa.

### Follow-ups de fornecedores

```text
POST /rest/v1/rpc/ingest_fornecedores_followups
```

Body:

```json
{
  "p_payload": [
    {
      "ordem": 1,
      "nome_fornecedor": "Fornecedor",
      "issue": "Pedido em atraso",
      "proximo_passo": "Cobrar nova previsão",
      "prazo": "2026-07-21"
    }
  ]
}
```

A função apaga todos os follow-ups existentes antes de inserir o novo payload. O fluxo deve sempre enviar a lista completa.

## 3. Snapshots principais

As tabelas abaixo ainda não possuem RPC de ingestão no repositório atual:

```text
produtos
radar_estoque
rupturas
sugestoes_compra
```

O n8n pode usar a API REST de tabelas com `service_role`, mas o upsert depende de uma chave única ainda não formalizada.

Até essa chave ser criada, a opção segura é:

1. inserir um lote com `empresa_nome` e `data_referencia` explícitos;
2. não apagar snapshots anteriores;
3. validar duplicidade de `empresa_nome + sku + data_referencia` no n8n;
4. interromper a execução se houver duplicatas;
5. registrar quantidade extraída, enviada e persistida.

Não usar `delete all + insert` para snapshots históricos.

## 4. Padrão recomendado de fluxo

```text
Schedule Trigger
  -> Consulta Sankhya
  -> Normalize Fields
  -> Validate Required Fields
  -> Detect Duplicates
  -> Split in Batches
  -> HTTP Request Supabase
  -> Validate Response
  -> Log Execution
  -> Alert on Failure
```

## 5. Validações mínimas por lote

- chave de negócio presente;
- `empresa_nome` presente;
- datas no formato ISO;
- números enviados como number, não texto formatado;
- nenhum `NaN`, `Infinity`, `R$` ou separador de milhar;
- contagem persistida igual à contagem enviada;
- resposta com `ok=true` e `processados` igual ao tamanho do lote;
- repetição do mesmo lote não cria duplicata nas tabelas com upsert.

## 6. Leitura e teste

O n8n não precisa chamar RPCs `get_*` para alimentar o sistema. Essas funções são destinadas ao frontend autenticado.

Para validar depois da carga, usar uma conta de teste autenticada ou executar os smoke tests no SQL Editor:

```text
supabase/tests/01_smoke_schema_rpcs.sql
supabase/tests/02_smoke_filtros_servidor.sql
supabase/tests/03_smoke_consultas_enxutas.sql
```

## 7. Tratamento de erro

Não continuar o fluxo quando:

- Supabase responder fora de 2xx;
- `ok` for diferente de `true`;
- `processados` divergir do lote;
- uma chave obrigatória estiver vazia;
- houver duplicidade na chave de negócio;
- ocorrer erro de conversão de data ou número.

Registrar no log:

```text
workflow
execution_id
entidade
empresa_nome
data_referencia
inicio
fim
linhas_extraidas
linhas_enviadas
linhas_processadas
status
erro
```

O schema atual ainda não possui uma tabela oficial de logs de integração. O log deve permanecer no n8n até essa estrutura ser adicionada.
