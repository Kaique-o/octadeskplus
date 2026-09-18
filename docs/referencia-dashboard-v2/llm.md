# Instruções para IA e devs

Este é o documento canônico do repositório. Quando qualquer outro arquivo
divergir dele — inclusive `README.md` e `CLAUDE.md` — vale o que está aqui e o
que está no código.

Antes de editar o projeto, leia nesta ordem:

1. `docs/ai/design-system.md`
2. `docs/ai/componentes.md`
3. `docs/ai/boas-praticas.md`
4. `docs/ai/backend.md`
5. `docs/ai/diagramas.md`
6. auditoria e plano de ação mais recentes em `docs/audits/`

## Regras estruturais

- código-fonte do site fica exclusivamente em `src/`;
- o app React (Vite) é a fonte de verdade das telas: `src/app/App.jsx` define as
  rotas, `src/modulos/compras/paginas/*.jsx` são as telas, `src/components/` os componentes
  reutilizáveis;
- a única entrada processada pelo build é o `index.html` da **raiz** do
  repositório — não criar HTML dentro de `src/`;
- `dist/` é gerada por `npm run build` (`vite build`) e nunca deve ser editada
  manualmente;
- CSS centralizado em `src/app/index.css` (Tailwind v4 + tema daisyUI `compras`);
  usar classes utilitárias/daisyUI direto no JSX, sem `<style>` e sem arquivo
  CSS novo;
- JavaScript separado em `src/data` (acesso ao Supabase), `src/lib` (clientes
  técnicos), `src/context` (auth e permissões), `src/hooks`, `src/components` e
  `src/tours`;
- SQL versionado em `supabase/migrations/`, aplicado inteiro e em ordem
  lexicográfica. `supabase/sql/` é histórico e **não deve ser executado**;
- documentação organizada por assunto em `docs/`;
- relatórios de release ficam em `docs/reports/releases/<versão>/`, nunca na
  raiz do repositório;
- não criar clones ou backups dentro do repositório;
- somente `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (chave anon) podem
  chegar ao frontend; `service_role` jamais;
- dependências de runtime devem ser instaladas pelo npm e empacotadas pelo
  Vite. Nada por CDN — nem Lucide, nem Supabase, nem fontes;
- ícones usam `lucide-react`, importados direto no componente que precisa deles;
- todo acesso ao Supabase deve passar por `src/shared/data/data-access.js`;
- páginas, componentes, contexts e hooks não podem importar
  `src/shared/data/supabase-client.js` nem chamar `.rpc()`, `.from()` ou `supabase.auth`
  diretamente.

## Idioma e acentuação

Português do Brasil, **com acentuação correta**, em:

- todo texto que o usuário lê: rótulos de menu, títulos, mensagens de erro e de
  sucesso, placeholders, cabeçalhos de tabela e textos dos tours;
- comentários de código e documentação.

Continua em **ASCII sem acento**, porque são chaves técnicas e mudá-las quebra o
sistema:

- rotas (`/sugestao-compra`), nomes de arquivo e identificadores JavaScript;
- `chave` do `CATALOGO` e de cada gráfico em `PermissionsProvider.jsx` — esses
  nomes são gravados na tabela `permissoes_acesso` do Supabase;
- campos aceitos pelas RPCs (`ordenar_por`, nomes de filtro) e a lista `COLUNAS`
  das páginas;
- chaves de `localStorage` e `sessionStorage`
  (ex.: `compras.sugestao.quantidades.v1`);
- cabeçalhos do CSV exportado.

O validador `npm run validate` falha se alguma `chave` do `CATALOGO` sair do
ASCII minúsculo.

## Contrato de três pontas

Ao adicionar ou renomear uma tela, três pontos precisam bater:

1. a rota em `src/app/App.jsx`;
2. o `to` do `NAV` em `src/app/AppShell.jsx`;
3. a `chave` do `CATALOGO` em `src/shared/context/PermissionsProvider.jsx`.

Cada entrada de `graficos` no `CATALOGO` (`{chave, label, tipo}`) corresponde a
uma chamada `podeVerGrafico('<modulo>', '<grafico>')` dentro da página e aos
mesmos nomes na tabela `permissoes_acesso`. Uma tela que entra pela metade fica
invisível no menu ou sem permissão. `npm run validate` verifica as três pontas.

## Estados de consulta

- cada página React controla seu próprio estado (`loading`, `success`, `empty`,
  `error`) com `useState`/`useEffect` — o padrão está em
  `docs/ai/componentes.md`;
- toda consulta deve passar por loading e terminar explicitamente em success,
  empty ou error;
- usar `total_count` (ou o total agregado de `kpis`, quando a RPC não devolve
  `total_count`) para decidir o estado vazio;
- erro deve permitir repetir a mesma consulta com os mesmos filtros;
- componente sem fonte no contrato atual simplesmente não renderiza — nunca com
  mock nem com loading eterno.

## Filtros, ordenação e paginação

Tudo é resolvido no servidor, via `useServerFilters` → `toQuery()` → RPC. Nada é
filtrado nem ordenado no cliente. Colunas ordenáveis usam `SortableHeadCells`
com uma lista `COLUNAS` no topo da página, onde `chave` é o campo aceito em
`ordenar_por` pela RPC — coluna sem `chave` vira `<th>` comum.

## Fonte de verdade do backend

Quando houver divergência, usar esta ordem:

1. `supabase/migrations/`;
2. `supabase/tests/`;
3. `docs/ai/backend.md`;
4. `docs/architecture/supabase_arquitetura.md`;
5. código atual em `src/shared/data/data-access.js` e `src/modulos/compras/paginas/*.jsx`;
6. arquivos históricos em `supabase/sql/`, `docs/audits/` e planilhas.

Não usar `estoque_produto_diario`, `radar_estoque_curva_status` ou views `vw_*`
como dependência nova. Não afirmar que `empresa_nome` isola dados por empresa:
hoje ele é apenas filtro funcional.

## Antes de finalizar

Rodar `npm run check`, que encadeia `check:security`, `check:integration`
(n8n + arquitetura + Cloudflare), `build`, `validate` e `test`. Cada validador
sai com código 1 e bloqueia o merge.
