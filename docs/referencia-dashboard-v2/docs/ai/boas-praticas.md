# boas praticas do dashboard compras

## fonte de verdade

- o codigo editavel fica em `src/`;
- `dist/` e um artefato gerado por `npm run build` (`vite build`) e nunca deve ser editado;
- nao manter clones backups ou pastas duplicadas dentro do repositorio;
- sql executavel fica exclusivamente em `supabase/migrations/`, aplicado inteiro e em ordem lexicografica. `supabase/sql/` e historico e **nao deve ser executado**;
- documentacao fica em `docs/`, separada por assunto;
- a unica entrada processada pelo build e o `index.html` da **raiz** do repositorio — nao criar HTML dentro de `src/`;
- a arvore pre-React (`src/js/`, `src/assets/`, os `*.html` internos, `scripts/build.js`) foi removida do repositorio. `npm run validate` falha se algum desses caminhos reaparecer.

## organizacao de pastas

```text
src/
├── main.jsx                      # entrypoint do vite (monta <App/> em #root)
├── App.jsx                       # rotas (react-router-dom)
├── index.css                     # tailwind + tema daisyUI "compras"
├── pages/                        # uma tela por arquivo, mapeada em App.jsx
├── components/
│   ├── layout/                   # AppShell (sidebar/drawer) e ProtectedRoute
│   ├── skyler/                   # widget de chat
│   └── ui/                       # KpiCard FilterBar Pagination graficos
├── context/                      # AuthProvider e PermissionsProvider
├── hooks/                        # useServerFilters (estado de filtro/paginacao)
├── data/data-access.js           # unica camada autorizada a chamar Auth tabelas e RPCs do Supabase
├── tours/                        # criarTour + um arquivo de steps por tela
└── lib/
    ├── supabase-client.js        # instancia tecnica do SDK, uso exclusivo de data-access.js
    └── theme-color.js            # le variavel css computada do tema, usada pelos graficos (canvas)
```

### responsabilidades do javascript

- `src/shared/data/data-access.js`: unica camada autorizada a chamar Auth tabelas e RPCs do Supabase;
- `src/shared/data/supabase-client.js`: instancia tecnica do SDK, importada somente por `data-access.js`;
- `src/shared/context/`: `AuthProvider` (sessao/perfil) e `PermissionsProvider` (catalogo de modulos e graficos por usuario);
- `src/shared/hooks/`: logica reutilizada por varias telas, como o estado de filtros/paginacao (`useServerFilters`);
- `src/shared/ui/`: componentes de interface reutilizados entre telas (kpi, filtro, paginacao, graficos);
- `src/modulos/compras/paginas/`: regra exclusiva de cada tela de negocio, uma por rota em `App.jsx`.

nao colocar regra exclusiva de pagina em `components/`/`hooks/` nem duplicar utilitarios em varios arquivos. nenhuma tela deve conhecer nome de tabela ou RPC: adicione a operacao em `src/shared/data/data-access.js` e consuma o metodo semantico.

## rotas e navegacao

- rotas ficam em `src/app/App.jsx`; toda tela nova (fora `/login`) entra dentro de `<ProtectedRoute>`;
- o menu lateral (`src/app/AppShell.jsx`) tem uma lista `NAV` com `chave`, `to` e `icone` — a `chave` precisa existir tambem no `CATALOGO` de `src/shared/context/PermissionsProvider.jsx` para o item aparecer no menu de quem tem permissao;
- `/configuracoes` e a unica rota protegida que nao entra em `NAV`/`CATALOGO`: fica visivel a qualquer usuario logado.

## css e componentes

- design system em `src/app/index.css` (tema daisyUI `compras` + tokens extras em `:root`); nao criar `styles.css` novo nem `<style>` em componente;
- usar classes utilitarias Tailwind e componentes daisyUI (`card`, `btn`, `stat`, `table`, `badge`, `drawer`...) direto no jsx; reutilizar componente existente em `src/shared/ui/` antes de criar variante nova;
- sidebar, filtros, kpis, tabelas, badges e estados devem manter o mesmo contrato visual entre telas;
- alteracao no `AppShell.jsx` (sidebar/navegacao) e global — afeta todas as telas protegidas de uma vez, nao precisa replicar manualmente.

## nomenclatura

- componentes React em PascalCase (`KpiCard.jsx`); hooks em camelCase com prefixo `use` (`useServerFilters.js`);
- demais javascript em kebab-case quando tiver mais de uma palavra (`data-access.js`, `theme-color.js`);
- classes css/tailwind em kebab-case (padrao das proprias bibliotecas);
- ids somente para integracao com javascript;
- sql e campos novos em snake_case quando o banco permitir;
- documentos datados em `docs/audits/`.

## seguranca

- somente `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` podem chegar ao frontend;
- service role nunca pode aparecer em `src/`, `dist/`, logs ou documentacao com valor real;
- `.env`/`.env.local` permanecem fora do git (`.env.example` documenta as chaves esperadas);
- toda escrita do frontend depende de rls e validacao no banco;
- apenas `src/shared/data/data-access.js` pode importar `src/shared/data/supabase-client.js`;
- chamadas `.rpc()`, `.from()` e `supabase.auth` fora da camada de dados sao proibidas.

## build e deploy

```bash
npm run build
```

resultado esperado:

- `dist/` recriada do zero pelo `vite build`, a partir do `index.html` da raiz e de `src/app/main.jsx`;
- bundle React com divisao de chunks e css do Tailwind/daisyUI compilado;
- variaveis `VITE_*` injetadas em tempo de build (`import.meta.env`).

cloudflare pages:

- build command: `npm run build`;
- output directory: `dist`;
- node 22 ou superior;
- variavel recomendada: `NODE_VERSION=22`.

## dependencias do navegador

- instalar bibliotecas pelo npm e manter `package-lock.json` versionado;
- nao carregar Lucide, Supabase, Google Fonts ou outras bibliotecas por CDN;
- icones usam `lucide-react`, importados diretamente no componente que precisa deles;
- fonte Inter local via `@fontsource-variable/inter`, importada em `src/app/main.jsx`;
- graficos usam `chart.js`/`react-chartjs-2`/`chartjs-plugin-datalabels`;
- executar `npm audit` ao alterar dependencias;
- em dev, `VITE_USE_MSW=true` liga o MSW (`mocks/handlers.js`) para mockar as RPCs de dashboard sem depender de dado real no Supabase — login/auth continuam batendo no Supabase real.

## checklist antes de finalizar

1. nenhum arquivo de `dist/` foi editado manualmente;
2. todos os imports locais existem;
3. rota nova registrada em `App.jsx`, `NAV` (`AppShell.jsx`) e `CATALOGO` (`PermissionsProvider.jsx`) com a mesma `chave`;
4. `npm run build` conclui sem erro;
5. `npm run test`/`npm run test:unit` passam;
6. configuracao real (`.env`, chaves) nao foi versionada;
7. readme e documentacao foram atualizados quando a estrutura mudou;
8. nenhuma segunda copia do projeto foi criada dentro do repositorio;
9. nenhuma tela acessa Supabase diretamente;
10. operacoes novas foram adicionadas a `data-access.js` com erro padronizado (`DataAccessError`).
