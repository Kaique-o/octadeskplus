# instrucoes de atualizacao

> **Documento historico.** Descreve a estrutura multipagina anterior a migracao
> para React (`src/js/`, `scripts/build.js`, `src/assets/css/styles.css`), que foi
> removida do repositorio. Vale como registro datado, nao como instrucao.
> Para o estado atual, ver `llm.md` e `docs/ai/`.

## regra principal

edite somente `src/`. a pasta `dist/` e recriada pelo build e nao e fonte de verdade.

## criar uma tela interna

1. criar `src/modulos/compras/paginas/<tela>.html` em kebab-case;
2. criar `src/js/pages/<tela>.js` quando houver logica exclusiva;
3. carregar o css por `../assets/css/styles.css`;
4. carregar scripts compartilhados por `../js/core/` e `../js/shared/`;
5. carregar o modulo da tela por `../js/pages/<tela>.js`;
6. usar `<body data-auth="required">`;
7. adicionar a navegacao nas paginas com sidebar;
8. incluir o modulo no catalogo de `src/js/shared/permissoes.js` quando aplicavel.

ordem minima recomendada no final da pagina:

```html
<script src="https://unpkg.com/lucide@1.23.0/dist/umd/lucide.min.js"></script>
<script src="../js/core/loading.js"></script>
<script src="../js/core/app.js"></script>
<script src="../js/shared/filtros.js"></script>
<script src="../js/core/config.js"></script>
<script type="module" src="../js/pages/<tela>.js"></script>
<script type="module" src="../js/core/auth.js"></script>
<script type="module" src="../js/shared/permissoes.js"></script>
```

remova scripts que a pagina realmente nao utiliza mas preserve a ordem relativa dos dependentes.

## alterar layout global

- editar `src/assets/css/styles.css`;
- conferir todas as paginas com sidebar;
- reutilizar os componentes descritos em `docs/ai/componentes.md`;
- registrar mudancas de regra visual em `docs/ai/design-system.md`.

## alterar autenticacao

arquivos envolvidos:

- `src/login.html`;
- `src/definir-senha.html`;
- `src/js/core/auth.js`;
- `src/js/settings/definir-senha.js`;
- `src/js/core/supabase-client.js`.

nao mover as paginas publicas para `src/modulos/compras/paginas/`. redirects dependem da raiz publica e o prefixo `RAIZ` depende de `/pages/` na url.

## alterar configuracao do supabase

- o template versionado e `src/js/core/config.js` e deve permanecer vazio;
- as variaveis reais ficam na cloudflare pages;
- o build gera `dist/js/core/config.js`;
- nunca usar ou versionar service role no frontend.

## validar antes de publicar

```bash
npm ci
npm run check:security
npm run check
npm run test:db:fresh
```

O ultimo comando exige Supabase CLI, Docker e `psql` e recria somente o banco
local. Ele deve passar antes de publicar uma alteracao de schema, RLS ou RPC.

confirmar tambem:

- nenhum 404 de css js ou html;
- console sem erro de import;
- login logout e redirects funcionando;
- pagina abre pela url final da cloudflare;
- `dist/` nao foi commitada;
- documentacao e auditoria atualizadas quando necessario.

## cloudflare pages

- build command: `npm run build`;
- output directory: `dist`;
- variaveis: `SUPABASE_URL` e `SUPABASE_ANON_KEY`;
- node 22 ou superior.
