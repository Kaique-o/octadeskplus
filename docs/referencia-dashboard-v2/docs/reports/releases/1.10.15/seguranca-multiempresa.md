# validacao de seguranca e multiempresa 1.10.15

## escopo aplicado

- restauracao do baseline de sistema e da migration funcional removida;
- restauracao das RPCs `list_usuarios_permissoes`,
  `save_permissoes_usuario` e `save_parametros_compras`;
- nova RPC administrativa `save_usuario_perfil`, com protecao do ultimo admin;
- catalogo e editor de empresas permitidas por usuario;
- `empresa_id` obrigatorio e chave estrangeira nas nove bases operacionais;
- RLS por modulo e empresa;
- leitura operacional somente pelas nove RPCs publicas;
- owner restrito `compras_rpc_owner`, sem login e sem bypass de RLS;
- conflitos de budget, transferencia, recebimento e fornecedor corrigidos para
  escopo empresarial;
- Skyler restrita a endpoint relativo same-origin;
- headers de seguranca do Cloudflare Pages;
- neutralizacao de formula injection na exportacao CSV;
- pacote de entrega sem `.git` e sem a pasta de dados `import_supabase`.

## comportamento de migracao

- usuarios existentes com perfil ativo preservam o acesso operacional e recebem
  vinculo com as empresas existentes quando nao havia empresa definida;
- usuarios novos entram com perfil leitura, todos os modulos desabilitados e sem
  empresa vinculada;
- administradores visualizam todas as empresas, mas nao recebem `SELECT` bruto;
- linhas sem empresa ou duplicidades incompatíveis abortam toda a migration para
  evitar estado parcial.

## comandos de aceite

```bash
npm ci
npm run check:security
npm run check
npm run test:db:fresh
```

## resultado desta aplicacao

- `node scripts/check-security.js`: aprovado;
- `node --check` em JavaScript, MJS e CJS: aprovado;
- `bash -n scripts/test-fresh-supabase.sh`: aprovado;
- `npm ci`: nao executado com sucesso no ambiente de auditoria porque o registry
  npm interno retornou 404 para `zod-3.25.76.tgz`;
- banco Supabase limpo: o script e o smoke test foram entregues, mas nao puderam
  ser executados neste ambiente por ausencia de Supabase CLI, Docker e `psql`.

O deploy de producao permanece condicionado a `npm run check` e
`npm run test:db:fresh` em uma maquina com as dependencias acima.
