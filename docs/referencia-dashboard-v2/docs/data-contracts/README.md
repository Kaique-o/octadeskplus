# Contratos de dados

## Estado atual

As planilhas desta pasta foram criadas para uma arquitetura anterior e devem ser tratadas como referência de campos, não como fonte automática do schema atual.

| Arquivo                             | Situação                                                                          |
| ----------------------------------- | --------------------------------------------------------------------------------- |
| `budget_mensal.xlsx`                | compatível conceitualmente com `budget_mensal`; validar `empresa_nome`            |
| `transferencias_eventos.xlsx`       | compatível conceitualmente; validar chave `codigo_transferencia` e `empresa_nome` |
| `recebimentos_eventos.xlsx`         | compatível conceitualmente; validar `empresa_nome` e unicidade da nota            |
| `fornecedores_snapshot_diario.xlsx` | compatível conceitualmente; incluir `empresa_nome`                                |
| `fornecedores_followups.xlsx`       | carga substitutiva; o payload deve conter a lista completa                        |
| `estoque_produto_diario.xlsx`       | legado; a tabela `estoque_produto_diario` não faz parte do schema ativo           |

A definição executável está em `supabase/migrations/`. O contrato HTTP atual está em `docs/integration/guia_endpoints_n8n.md`.
