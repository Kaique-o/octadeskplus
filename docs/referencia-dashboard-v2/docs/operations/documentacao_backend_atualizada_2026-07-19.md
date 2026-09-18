# Atualização da documentação de backend — 19/07/2026

## Motivo

A documentação ainda misturava três arquiteturas diferentes:

- schema original dos SQL `01` a `09`;
- desenho de planilhas operacionais de 03/07;
- schema simplificado e RPCs reconstruídas depois do reset de 18/07.

Também havia afirmações incompatíveis com o código atual, incluindo leitura direta de tabelas, fallback para mock e uso de estruturas removidas.

## Arquivos atualizados

- `docs/ai/backend.md`;
- `docs/architecture/supabase_arquitetura.md`;
- `docs/integration/guia_endpoints_n8n.md`;
- `docs/data-contracts/README.md`;
- `docs/README.md`;
- `README.md`;
- `llm.md`.

## Decisões documentadas

- `supabase/migrations/` é a fonte de deploy do banco;
- as nove telas usam uma RPC principal cada;
- filtros, período, paginação e ordenação são executados no servidor;
- respostas leves não recalculam métricas e opções;
- mock não é fallback;
- ingestões existentes são exclusivas do `service_role`;
- as quatro tabelas principais ainda não possuem RPC oficial de ingestão;
- `empresa_nome` ainda não representa isolamento de segurança;
- arquivos SQL antigos e planilhas anteriores permanecem apenas como histórico.

## Validação

A alteração é exclusivamente documental. Nenhuma migration ou mudança de frontend foi adicionada.
