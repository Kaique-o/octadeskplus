# relatorio de aplicacao 1.10.15

## resultado

as correcoes solicitadas foram aplicadas no codigo fonte e consolidadas na
versao `1.10.15`

## itens aplicados

| item                             | status                  | implementacao                                                                                             |
| -------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------- |
| restaurar migration removida     | aplicado                | restaurada `20260719150000_configuracoes_funcionais.sql` e criado baseline anterior para bootstrap limpo |
| restaurar rpcs                   | aplicado                | `list_usuarios_permissoes`, `save_permissoes_usuario`, `save_parametros_compras` e `save_usuario_perfil`  |
| autorizacao obrigatoria no banco | aplicado                | nove rpcs operacionais exigem modulo e tabelas nao possuem mais select direto para usuarios               |
| isolamento por empresa           | aplicado                | `empresa_id`, tabela `usuarios_empresas`, rls e editor de empresas na aba acesso                          |
| reconciliar schema               | aplicado                | colunas reais, fks, indices, chaves multiempresa e validacoes de duplicidade                              |
| proteger token skyler            | aplicado                | endpoint obrigatoriamente relativo e same origin antes da leitura do token                                |
| headers de seguranca             | aplicado                | csp, hsts, nosniff, frame deny, referrer e permissions policy                                             |
| corrigir csv                     | aplicado                | neutralizacao de celulas iniciadas por `=`, `+`, `-` ou `@`                                               |
| remover git e dados              | aplicado no pacote      | `.git` e `import_supabase` nao entram no zip de entrega                                                   |
| teste de banco vazio             | infraestrutura entregue | script local e smoke sql prontos; execucao real requer supabase cli docker e psql                         |

## arquitetura de autorizacao

- `authenticated` nao recebe `select` nas tabelas operacionais
- o frontend chama somente as nove rpcs `get_*`
- as rpcs executam como `compras_rpc_owner`
- `compras_rpc_owner` nao possui login heranca ou bypass de rls
- cada rpc valida o modulo solicitado
- cada policy valida `empresa_id` contra `usuarios_empresas`
- administradores possuem visibilidade global sem acesso bruto pelas tabelas
- usuarios novos entram sem modulo e sem empresa
- views e helpers legados conhecidos perdem grants publicos

## validacoes executadas neste ambiente

- `node scripts/check-security.js`: aprovado
- sintaxe de todos os arquivos js mjs e cjs com `node --check`: aprovada
- sintaxe shell de `scripts/test-fresh-supabase.sh`: aprovada
- estrutura de aspas dollar quotes e parenteses dos sqls: aprovada
- `git diff --check`: aprovado
- integridade do zip: aprovada
- varredura de segredos de alta confianca: aprovada
- ausencia de `.git` e `import_supabase` no pacote: aprovada

## limitacoes de execucao

`npm ci` nao concluiu neste ambiente porque o proxy de registry npm retornou
404 para o pacote `zod@3.25.76` portanto vitest playwright build e lighthouse
nao foram executados aqui

o teste de supabase vazio tambem nao foi executado aqui porque o ambiente nao
possui supabase cli docker nem psql o comando de aceite entregue e

```bash
npm run test:db:fresh
```

esse comando inicia o supabase local recria o banco aplica todas as migrations
e executa `supabase/tests/05_smoke_seguranca_multiempresa.sql`

## bloqueio de producao

antes do deploy execute em uma maquina com acesso ao npm e docker

```bash
npm ci
npm run check
npm run test:db:fresh
npm run check:ci
```

faca backup do banco antes da migration final ela aborta de forma transacional
se encontrar linha sem empresa ou duplicidade incompatível com as novas chaves
