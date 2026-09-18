# Resumo técnico atual — Dashboard de Compras

> Atualizado em 19/07/2026. Para detalhes executáveis do backend, consulte `docs/ai/backend.md` e `supabase/migrations/`.

## 1. Visão geral

Dashboard de compras com frontend estático, autenticação Supabase, consultas paginadas por RPC e deploy na Cloudflare Pages.

```text
Cloudflare Pages
  -> frontend em dist/
  -> Supabase Auth
  -> RPCs get_* autenticadas
  -> PostgreSQL com RLS

Sankhya / fontes operacionais
  -> n8n
  -> RPCs ingest_* ou REST com service_role
  -> tabelas do Supabase
```

## 2. Frontend

Código-fonte em `src/`, gerado para `dist/` por `npm run build`.

- HTML, CSS e JavaScript sem framework de UI;
- Lucide, Supabase JS e fonte Inter empacotados localmente;
- nove telas operacionais com busca, filtros, período, ordenação e paginação no servidor;
- estados de loading, sucesso, vazio, erro e indisponibilidade em `src/js/shared/data-state.js`;
- nenhuma tela usa mock como fallback de consulta;
- nenhuma tela operacional usa `.select('*')` ou leitura direta de tabela.

## 3. Backend

### Migrations ativas

```text
supabase/migrations/20260718220000_schema_atual_e_rpcs.sql
supabase/migrations/20260718230000_filtros_paginacao_servidor.sql
supabase/migrations/20260719000000_otimizar_consultas_payloads.sql
```

### Tabelas principais

```text
produtos
radar_estoque
rupturas
sugestoes_compra
budget_mensal
transferencias_eventos
recebimentos_eventos
fornecedores_snapshot_diario
fornecedores_followups
```

### RPCs usadas pelo frontend

```text
get_home_dashboard
get_sugestao_compra
get_rupturas
get_excesso
get_produtos
get_budget
get_transferencias
get_recebimentos
get_fornecedores
```

As RPCs recebem `filtros jsonb` e retornam `itens`, `total_count`, `pagina` e `por_pagina`. KPIs, gráficos e opções de filtro são opcionais para evitar recálculo em paginação e ordenação.

## 4. Integração

As bases operacionais possuem RPCs de ingestão restritas ao `service_role`:

```text
ingest_budget_mensal
ingest_transferencias_eventos
ingest_recebimentos_eventos
ingest_fornecedores_snapshot
ingest_fornecedores_followups
```

As quatro tabelas principais ainda não possuem RPC de ingestão oficial. Essa pendência está documentada em `docs/integration/guia_endpoints_n8n.md`.

## 5. Segurança

- somente `SUPABASE_URL` e `SUPABASE_ANON_KEY` chegam ao frontend;
- leitura das tabelas exige usuário autenticado;
- ingestão exige `service_role`;
- `empresa_nome` é filtro funcional e ainda não é isolamento multiempresa;
- o projeto precisa de RLS baseada em empresa antes de atender organizações isoladas entre si.

## 6. Build e validação

```bash
npm ci
npm run check
```

O `check` executa build e valida HTML, imports, estados, filtros de servidor, payloads enxutos, dependências locais e registro de ícones.

Smoke tests do banco:

```text
supabase/tests/01_smoke_schema_rpcs.sql
supabase/tests/02_smoke_filtros_servidor.sql
supabase/tests/03_smoke_consultas_enxutas.sql
```

## 7. Documentação obrigatória

1. `llm.md`;
2. `docs/ai/backend.md`;
3. `docs/architecture/supabase_arquitetura.md`;
4. `docs/integration/guia_endpoints_n8n.md`;
5. auditoria ou operação mais recente em `docs/audits/` e `docs/operations/`.

Arquivos anteriores a 18/07/2026 podem descrever arquiteturas removidas e devem ser tratados como histórico.
