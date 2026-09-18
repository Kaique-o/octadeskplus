# ordem de aplicacao 1.10.17

## supabase

execute na ordem lexicografica e pare no primeiro erro

1. `20260719130000_normalizar_fn_auth_perfil_texto.sql`
2. `20260719140000_schema_sistema_base.sql`
3. `20260719150000_configuracoes_funcionais.sql` somente se ainda nao constar aplicada
4. `20260719190000_home_5_itens_padrao.sql`
5. `20260719210000_sugestao_tabela_dinamica.sql`
6. `20260729115100_seguranca_multiempresa_reconciliacao.sql`
7. `20260730022000_integracao_horaria_n8n.sql`

nao desative rls e nao use o editor do studio como substituto de migration

## n8n

1. aplique `N8N_CONCURRENCY_PRODUCTION_LIMIT=1`
2. reinicie o servico
3. importe os 14 workflows
4. mantenha todos desativados
5. execute manualmente e valide o supabase
6. ative apos homologacao

## cloudflare

1. configure as variaveis do pages
2. publique a branch
3. consulte `/api/health`
4. confirme `version=1.10.17`, branch e commit
