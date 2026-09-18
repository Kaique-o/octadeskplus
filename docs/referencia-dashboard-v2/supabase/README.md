# supabase

## fonte executavel

`migrations/` e a unica fonte executavel do banco. Os arquivos sao aplicados em
ordem lexicografica pelo Supabase CLI e precisam reconstruir um projeto vazio
sem ajustes manuais no Studio.

A migration `20260729115100_seguranca_multiempresa_reconciliacao.sql` fecha o
modelo atual:

- reconcilia colunas e chaves usadas pelo frontend e pelas cargas;
- adiciona `empresa_id` obrigatorio nas tabelas operacionais;
- restringe as nove RPCs publicas por modulo e empresa;
- revoga `SELECT` direto de `authenticated` nas bases operacionais;
- executa as RPCs por `compras_rpc_owner`, papel sem login e sem bypass de RLS;
- mantem ingestao exclusiva do `service_role`;
- disponibiliza RPCs administrativas para perfil, permissoes, parametros e
  escopo de empresas.

## teste em banco vazio

Dependencias: Supabase CLI, Docker e `psql`.

```bash
npm run test:db:fresh
```

O comando executa `supabase db reset --local` e depois
`supabase/tests/05_smoke_seguranca_multiempresa.sql`. Nunca aponte esse script
para um banco remoto.

## aplicacao em ambiente existente

1. gere backup logico antes da migration;
2. confira duplicidades indicadas pelos indices empresariais;
3. aplique todas as migrations pendentes em ordem;
4. valide login, listagem de usuarios, salvamento de permissoes e os nove
   modulos com usuarios de empresas distintas;
5. mantenha `service_role` somente no n8n/backend.

A migration falha e reverte a transacao quando encontra linha operacional sem
empresa ou chave duplicada que impediria a criacao dos indices. Isso e
intencional: nenhuma correcao destrutiva ou deduplicacao automatica e feita.

## tests

`tests/` contem smoke tests SQL. O teste `05` e a validacao de aceite da camada
de autorizacao e multiempresa.

## sql

`sql/` e material historico de arquiteturas anteriores. Nao execute a pasta
inteira e nao use esses arquivos como fonte para um novo ambiente.
