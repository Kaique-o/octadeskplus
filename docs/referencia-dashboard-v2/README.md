# dashboard compras

SPA React + Vite com autenticação e dados no Supabase (somente RPCs) e deploy pela Cloudflare Pages.

> As regras de contribuição estão em [`llm.md`](llm.md), o documento canônico do
> repositório. Onde este README divergir dele ou do código, valem o `llm.md` e o
> código.

## estrutura

```text
.
├── index.html                     # unica entrada processada pelo build
├── src/
│   ├── main.jsx                   # monta <App/> em #root
│   ├── App.jsx                    # rotas (react-router-dom)
│   ├── index.css                  # tailwind v4 + tema daisyUI "compras"
│   ├── pages/                     # uma tela por arquivo, mapeada em App.jsx
│   ├── components/
│   │   ├── layout/                # AppShell, ProtectedRoute, SyncStatusButton
│   │   ├── settings/              # PermissoesUsuarios (aba "Acesso")
│   │   ├── skyler/                # widget de chat
│   │   └── ui/                    # KpiCard FilterBar Pagination graficos
│   ├── context/                   # AuthProvider e PermissionsProvider
│   ├── hooks/                     # useServerFilters useDrilldown useSyncStatus
│   ├── tours/                     # criarTour + um arquivo de steps por tela
│   ├── data/data-access.js        # camada unica de acesso ao Supabase
│   └── lib/                       # supabase-client.js e theme-color.js
├── public/                        # _headers _redirects _routes.json robots.txt
├── functions/api/                 # Pages Functions (proxy da Skyler, health)
├── scripts/                       # validadores, lighthouse e tooling de ops
├── tests/                         # integracao e e2e (unitarios ficam junto do codigo)
├── vite.config.mjs                # build + config do vitest (jsdom)
├── playwright.config.cjs
├── .github/workflows/quality.yml  # pipeline de qualidade
├── dist/                          # gerada no build e ignorada pelo git
├── supabase/
│   ├── migrations/                # fonte executavel, aplicada inteira e em ordem
│   ├── sql/                       # historico, NAO executar
│   └── tests/                     # smoke tests do schema e das rpcs
├── docs/                          # ver docs/README.md
├── llm.md                         # documento canonico
└── CLAUDE.md
```

A árvore multipágina anterior (`src/js/`, `src/assets/`, os `*.html` internos e
`scripts/build.js`) foi removida na migração para React. `npm run validate` falha
se qualquer um desses caminhos reaparecer.

## desenvolvimento local

```bash
npm ci
npm run dev
```

O Vite sobe em `http://localhost:5173`. É necessário um `.env.local` com as
variáveis `VITE_*` (ver `.env.example`):

```bash
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
```

Só a chave anon chega ao browser. `service_role` jamais.

`npm run dev` não serve `functions/api/*`. Para exercitar a Skyler ponta a ponta
localmente:

```bash
npm run build && npx wrangler pages dev dist
```

## build

```bash
npm run build
```

`vite build` gera `dist/` — nunca editar essa pasta à mão. O build empacota tudo
por npm: nada é carregado por CDN. `public/` é copiado inteiro para a saída, e é
por isso que `_headers`, `_redirects`, `_routes.json` e `robots.txt` vivem lá.

Para rodar o gate completo antes de abrir PR:

```bash
npm run check
```

Ele encadeia, e bloqueia a entrega se qualquer etapa falhar:

- `check:security` — contratos de RLS/multiempresa, RPCs com guarda, Skyler sem
  host externo, proteção contra CSV injection;
- `check:integration` — `check:n8n`, `check:architecture` e `check:cloudflare`
  (mais o smoke do worker);
- `build`;
- `validate` — estrutura do app React, estados de consulta, filtros no servidor,
  camada única de dados e o contrato de três pontas;
- `test` — Vitest com jsdom.

Comandos isolados:

```bash
npm run check:security
npm run check:architecture
npm run check:cloudflare
npm run test:integration
npm run test:e2e
npm run test:lighthouse
npm run test:db:fresh
```

`test:db:fresh` é destrutivo somente no stack Supabase local. Inicia o Docker,
recria o banco do zero, aplica todas as migrations e executa o smoke test de RLS,
autorização por módulo, isolamento por empresa e RPCs administrativas.

`test:lighthouse` audita as rotas públicas `/` e `/login` servindo `dist/` com
fallback para o `index.html`, como o `_redirects` faz em produção. Os relatórios
ficam em `playwright-report/` e `reports/lighthouse/`.

## dependências empacotadas

- `react`, `react-dom`, `react-router-dom`: base da SPA;
- `lucide-react`: ícones, importados no componente que usa;
- `@supabase/supabase-js`: cliente, consumido só por `src/shared/data/data-access.js`;
- `@fontsource-variable/inter`: fonte local em WOFF2;
- `chart.js` + `react-chartjs-2` + `chartjs-plugin-datalabels`: gráficos;
- `driver.js`: tours guiados.

Não adicione scripts, CSS, fontes ou bibliotecas por CDN. `npm run validate`
falha se encontrar uma.

## cloudflare pages

- install command: `npm ci` ou padrao automatico da plataforma;
- build command: `npm run build`;
- output directory: `dist`;
- node: `22` ou superior;
- variavel recomendada na cloudflare: `NODE_VERSION=22`.
- o arquivo `.npmrc` fixa `https://registry.npmjs.org/` como registry publico;
- o `package-lock.json` nao pode conter URLs de registries privados ou locais.

validacao rapida antes do push:

```bash
npm config get registry
npm ci
npm run check
```

o primeiro comando deve retornar `https://registry.npmjs.org/`. o validador bloqueia o projeto se um registry privado voltar a aparecer no lockfile.

Configure nos ambientes de producao e preview:

- build do frontend (prefixo `VITE_`, embutidas no bundle): `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`, `VITE_SKYLER_API_URL`, `VITE_SKYLER_TIMEOUT_MS`,
  `VITE_PROFILE_TIMEOUT_MS=2500`;
- Pages Function (nunca chegam ao browser): `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
  `SKYLER_UPSTREAM_URL`, `SKYLER_API_TOKEN`, `SKYLER_API_HEADER`,
  `SKYLER_TIMEOUT_MS`.

`VITE_SKYLER_API_URL` deve ser uma rota relativa no mesmo dominio, por exemplo
`/api/skyler/chat`. `resolverEndpointSeguro` em
`src/plataforma/skyler/Skyler.jsx` rejeita qualquer origem diferente da
aplicacao **antes** de pedir o token da sessao, entao o Bearer do Supabase nunca
sai para um host externo. `npm run check:security` e `npm run check:cloudflare`
falham se essa guarda for removida.

## regras importantes

- edite somente arquivos de `src/`; nunca edite `dist/`;
- nao coloque outro clone ou backup dentro do repositorio;
- service role nao pode aparecer no frontend;
- leia `llm.md` antes de alterar layout arquitetura ou integracoes;
- aplique sempre a pasta `supabase/migrations/` completa e em ordem lexicografica;
- nao execute `supabase/sql/` em ambientes atuais pois a pasta e apenas historica;
- antes de producao valide um banco limpo com `npm run test:db:fresh`;
- depois do deploy execute tambem os smoke tests SQL apropriados ao ambiente;
- budget transferencias recebimentos e fornecedores precisam ser alimentados pelos fluxos n8n.

## integracao horaria n8n

os 14 fluxos em `integrations/n8n/dashboard_c/workflows/` executam uma vez por hora em minutos exclusivos e gravam no supabase pela rpc `ingest_dashboard_dataset`. o frontend nunca consulta o n8n.

no servidor n8n e obrigatorio aplicar `N8N_CONCURRENCY_PRODUCTION_LIMIT=1`; use `integrations/n8n/docker-compose.override.yml.example` como referencia.

## backend atual

A fonte executavel do banco e `supabase/migrations/`, aplicada nesta ordem:

```text
20260718220000_schema_atual_e_rpcs.sql
20260718230000_filtros_paginacao_servidor.sql
20260719000000_otimizar_consultas_payloads.sql
20260719120000_dominio_filtros_globais_skyler.sql
20260719130000_normalizar_fn_auth_perfil_texto.sql
20260719140000_schema_sistema_base.sql
20260719150000_configuracoes_funcionais.sql
20260719190000_home_5_itens_padrao.sql
20260719210000_sugestao_tabela_dinamica.sql
20260729115100_seguranca_multiempresa_reconciliacao.sql
20260730022000_integracao_horaria_n8n.sql
```

A migration final revoga leitura direta das tabelas operacionais, exige modulo
nas nove RPCs publicas e aplica o escopo de empresas definido na aba de acesso.
Usuarios novos entram sem modulo e sem empresa por padrao. Administradores
possuem visibilidade global, mas continuam sem `SELECT` bruto nas tabelas.

As nove telas operacionais usam RPCs paginadas `get_*` pela fachada `src/shared/data/data-access.js`. Nenhuma tela, componente ou configuração importa o cliente Supabase diretamente, e mock não é fallback de consulta.

Documentação obrigatória:

- `docs/ai/backend.md`;
- `docs/architecture/supabase_arquitetura.md`;
- `docs/integration/guia_endpoints_n8n.md`.

Depois das migrations, execute os smoke tests em `supabase/tests/`; o teste `05` valida a camada de seguranca multiempresa, o `06` valida o ETL horario e o `07` valida a compatibilidade do perfil legado.

## estados de dados

Cada página React controla seu próprio estado de consulta (`loading`, `success`, `empty`, `error`) com `useState`/`useEffect`. O estado vazio depende de `total_count` — ou do total agregado de `kpis`, quando a RPC não devolve `total_count`. Erros de RPC permanecem explícitos e permitem repetir a mesma consulta com os mesmos filtros.

## camada unica de acesso aos dados

Todo acesso remoto do frontend passa por `src/shared/data/data-access.js`.

A camada expõe domínios semânticos:

```text
dataAccess.dashboard    RPCs das nove telas operacionais
dataAccess.auth         sessão login logout recuperação e senha
dataAccess.users        perfis lista administrativa e alterações
dataAccess.permissions  leitura e gravação de permissões
dataAccess.parameters   parâmetros globais de compras e estoque
```

Regras obrigatórias:

- não importar `src/shared/data/supabase-client.js` fora de `src/shared/data/data-access.js`;
- não chamar `.rpc()`, `.from()` ou `supabase.auth` em páginas, settings ou shared;
- novas operações devem ser adicionadas à camada e consumidas por método semântico;
- falhas remotas chegam como `DataAccessError`, com `operation`, `code`, `status`, `details` e `hint`;
- `npm run check` bloqueia acesso direto ao Supabase fora da camada.

## Repositorio e dominio

O repositorio canonico e o **pessoal**: `github.com/Kaique-o/dashboard-v2`. Tocar
o projeto dentro da organizacao `gruposkytech` nao avancou, e e o repositorio
pessoal que publica hoje.

A Cloudflare Pages esta ligada a ele por git integration: todo push na `main`
publica em `https://dashboard-v2-b2x.pages.dev`. Nao ha workflow de deploy no
repositorio - quem publica e a propria Cloudflare.

`APP_URL` e usado nos redirects de recuperacao de senha.

Pendencias externas ao repositorio:

- manter `https://dashboard-v2-b2x.pages.dev` nas Redirect URLs do Supabase Auth;
- se um dominio proprio for vinculado depois, trocar `APP_URL` no `.env.example`,
  o contrato em `scripts/validate.js` e as Redirect URLs do Supabase juntos.

## filtros globais

as nove telas operacionais usam o mesmo contrato de filtro:

```json
{
  "macrogrupo": "SMARTPHONES",
  "curva": "A",
  "marca": "SAMSUNG",
  "search": "galaxy",
  "pagina": 1,
  "por_pagina": 25
}
```

a migration `20260719120000_dominio_filtros_globais_skyler.sql` adiciona as dimensoes nas bases operacionais, atualiza as nove RPCs e adapta as funcoes de ingestao. cargas novas devem enviar `macrogrupo`, `curva` e `marca` sempre que a informacao existir.

## sugestao de compra - tabela dinamica

A tabela de sugestao de compra possui controles funcionais para:

- exportar CSV dos itens selecionados ou de todo o resultado filtrado;
- configurar e persistir colunas visiveis;
- abrir e fechar a tabela em tela cheia;
- agrupar a pagina por marca familia ou fornecedor;
- filtrar rapidamente por curva prioridade e fornecedor;
- selecionar linhas;
- criar rascunhos locais de solicitacao pelo botao Comprar.

Aplique `supabase/migrations/20260719210000_sugestao_tabela_dinamica.sql` para a RPC devolver marca familia lead time e as opcoes completas dos filtros rapidos. Sem a migration os filtros rapidos ficam limitados aos itens retornados pela versao antiga da RPC.

## skyler

a Skyler e carregada por `src/plataforma/skyler/Skyler.jsx` em todas as telas que possuem sidebar. o frontend envia para `SKYLER_API_URL`:

- mensagem do usuario;
- id da conversa;
- pagina atual;
- filtros ativos;
- token de sessao Supabase no header `Authorization`, quando disponivel.

o endpoint padrao e `/api/skyler/chat` e precisa permanecer no mesmo dominio.
nenhum segredo da IA deve ser publicado no frontend; a conexao com o provedor
deve ficar em um Worker, Edge Function ou backend equivalente. O navegador nao
envia o token para URL absoluta ou origem externa.

## home - itens mais criticos

A home inicia a tabela **Itens mais criticos** com cinco registros. Aplique `supabase/migrations/20260719190000_home_5_itens_padrao.sql` no banco existente.
