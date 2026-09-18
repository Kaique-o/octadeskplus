# log de aplicacao das migrations - 2026-07-30

projeto supabase: `dashboard-compras` (`hldeqhkcnbywtorijhvl`), PostgreSQL 17.6.1.141
aplicado via MCP oficial do Supabase (`apply_migration`), na ordem lexicografica do pacote 1.10.17,
parando no primeiro erro.

| #   | arquivo do pacote                                         | versao registrada no ledger             | resultado                       |
| --- | --------------------------------------------------------- | --------------------------------------- | ------------------------------- |
| 1   | `20260719130000_normalizar_fn_auth_perfil_texto.sql`      | `normalizar_fn_auth_perfil_texto`       | ok                              |
| 2   | `20260719140000_schema_sistema_base.sql`                  | `schema_sistema_base`                   | ok                              |
| 3   | `20260719150000_configuracoes_funcionais.sql`             | ja constava aplicada (`20260719143122`) | pulada conforme ORDEM_APLICACAO |
| 4   | `20260719190000_home_5_itens_padrao.sql`                  | `home_5_itens_padrao`                   | ok                              |
| 5   | `20260719210000_sugestao_tabela_dinamica.sql`             | `sugestao_tabela_dinamica`              | ok                              |
| 6   | `20260729115100_seguranca_multiempresa_reconciliacao.sql` | aplicada em 5 partes (ver abaixo)       | ok                              |
| 7   | `20260730022000_integracao_horaria_n8n.sql`               | pendente                                | -                               |

## por que a migration 6 foi dividida

O arquivo tem 2506 linhas e o transporte MCP nao aceita um unico payload desse tamanho.
Foi dividida em partes sequenciais **sem pular nenhum comando** e sem reordenar efeitos:

1. `seguranca_multiempresa_reconciliacao_parte1_estrutura` — linhas 19-958 (colunas, backfill de empresas,
   `empresa_id not null`, FKs, triggers, indices unicos por empresa, RPCs de ingestao, `usuarios_empresas`,
   autorizacao por modulo, `save_usuario_perfil`, `list_escopos_empresa_permissoes`, role `compras_rpc_owner`,
   matriz de policies fail-closed)
2. `seguranca_multiempresa_reconciliacao_parte2_rpcs_a` — linhas 963-1653 (`get_home_dashboard`,
   `get_sugestao_compra`, `get_rupturas`, `get_excesso`)
3. `seguranca_multiempresa_reconciliacao_parte3_rpcs_b` — linhas 1655-2229 (`get_produtos`, `get_budget`,
   `get_transferencias`, `get_recebimentos`)
4. `seguranca_multiempresa_reconciliacao_parte4_fornecedores` — linhas 2231-2404 (`get_fornecedores`)
5. `seguranca_multiempresa_reconciliacao_parte5_grants_owner` — linhas 2409-2504 (grants, troca de owner,
   revogacoes e hardening final)

## dois bloqueios reais encontrados e como foram resolvidos

### 1. `must be able to SET ROLE "compras_rpc_owner"`

O papel de conexao do MCP (`postgres`) era membro de `compras_rpc_owner`, mas sem a opcao `SET`
(comportamento padrao do PostgreSQL 16+ para o criador do role). Sem ela, `ALTER FUNCTION ... OWNER TO`
falha.

Correcao aplicada antes da parte 5:

```sql
grant compras_rpc_owner to postgres with set true;
```

### 2. `permission denied for schema public`

`ALTER FUNCTION ... OWNER TO compras_rpc_owner` exige que o **novo dono** tenha `CREATE` no schema.
A migration concede apenas `USAGE` a esse role, e no PostgreSQL 15+ o schema `public` nao concede mais
`CREATE` a `PUBLIC`. O ACL observado confirmou isso:

```text
{pg_database_owner=UC/pg_database_owner,=U/pg_database_owner,postgres=U/...,anon=U/...,
 authenticated=U/...,service_role=U/...,compras_rpc_owner=U/...}
```

Correcao aplicada **dentro** da parte 5, mantendo o estado final identico ao previsto:

```sql
grant create on schema public to compras_rpc_owner;
-- ... os 9 ALTER FUNCTION ... OWNER TO ...
revoke create on schema public from compras_rpc_owner;
```

> Este e um defeito do pacote 1.10.17 em PostgreSQL 15+: a migration original falharia tambem em um banco
> limpo. Recomenda-se corrigir o arquivo-fonte com esse par grant/revoke.

## verificacao apos as migrations 1-6

| item                    | antes                           | depois                       |
| ----------------------- | ------------------------------- | ---------------------------- |
| `fn_auth_perfil()`      | retorna `perfil_usuario` (enum) | retorna **`text`**           |
| `empresas`              | inexistente                     | 1 registro (`Todas`)         |
| `usuarios_empresas`     | inexistente                     | 2 vinculos                   |
| `usuarios_perfis`       | 3                               | **3** (preservados)          |
| `auth.users`            | 3                               | **3** (preservados)          |
| `permissoes_acesso`     | 2                               | 3                            |
| `produtos`              | 10219                           | **10219**                    |
| `radar_estoque`         | 10086                           | **10086**                    |
| `sugestoes_compra`      | 10086                           | **10086**                    |
| `rupturas`              | 12365                           | **12365**                    |
| `recebimentos_eventos`  | 4213                            | **4213**                     |
| linhas sem `empresa_id` | -                               | **0**                        |
| policies em `public`    | 18                              | 18 (matriz nova fail-closed) |

nenhuma linha foi apagada e a RLS permaneceu habilitada em todas as tabelas.
