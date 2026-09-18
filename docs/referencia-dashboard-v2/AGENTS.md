# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Projeto

Dashboard de compras/estoque. SPA React + Vite, dados no Supabase (só RPCs), deploy na Cloudflare Pages (com Pages Functions em `functions/`).

**`llm.md` é o documento canônico deste repositório.** Onde este arquivo, o `README.md` ou qualquer doc divergirem dele, vale o `llm.md` e o código.

### Idioma

Português do Brasil **com acentuação correta** em todo texto que o usuário lê (rótulos, títulos, mensagens, placeholders, cabeçalhos de tabela, tours) e em comentários e documentação.

Continua em ASCII sem acento o que é chave técnica: rotas, nomes de arquivo, identificadores JS, `chave` do `CATALOGO` e dos gráficos (mapeiam a tabela `permissoes_acesso` no Supabase), campos de `ordenar_por`, chaves de `localStorage`/`sessionStorage` e cabeçalhos do CSV. `npm run validate` falha se uma `chave` do `CATALOGO` sair do ASCII minúsculo.

## Stack

Sem versão fixada aqui — ver `package.json`; este arquivo não acompanha bump de dependência.

- **Frontend**: React + Vite, React Router, Tailwind v4 + daisyUI, Chart.js (via `react-chartjs-2`), `lucide-react`, `driver.js` (tour guiado).
- **Backend**: Supabase (Postgres + RPCs + RLS), sem ORM — todo acesso é função SQL/PLpgSQL.
- **Deploy**: Cloudflare Pages (build estático) + Pages Functions (`functions/`, o proxy do Skyler).
- **Ingestão**: n8n (14 fluxos horários, gravam via RPC `service_role`).
- **Testes/qualidade**: Vitest (unit/integration), Playwright (e2e), MSW (mock só em dev, nunca fallback), Lighthouse, Prettier, Semgrep (CI).
- **Build antigo** (não usar pra tela nova, ver árvore legada): esbuild via `scripts/build.js`.

## Comandos

```bash
npm run dev                 # vite dev server (porta 5173); precisa de .env.local com VITE_*
npm run build               # vite build -> dist/ (nunca editar dist/)
npm run check               # gate completo: check:security + check:integration + build + validate + test
npm test                    # vitest run (unit + integration + src/**/*.test.jsx)
npx vitest run tests/integration/skyler.test.js          # um arquivo
npx vitest run -t "nome do teste"                        # um teste
npm run test:e2e            # playwright (tests/e2e/ está vazio hoje)
npm run test:db:fresh       # recria Supabase local via Docker e roda os smokes SQL (destrutivo, só local)
npm run format              # prettier
```

Validadores individuais (cada um sai com código 1 e bloqueia o merge):

- `npm run check:security` — contratos de RLS/multiempresa, RPCs com guarda, Skyler sem host externo, CSV injection.
- `npm run check:architecture` — nenhuma URL de n8n/webhook em `src/`, as 9 RPCs `get_*` presentes em `data-access.js`, contratos da migration de ingestão.
- `npm run check:n8n` / `npm run check:cloudflare` / `npm run test:worker`.
- `npm run validate` — valida caminhos de HTML/imports (cobre também a árvore legada).

CI (`.github/workflows/quality.yml`) roda `npm run check:ci` no Node 22 com Chromium do Playwright.

## Arquitetura

### App React (fonte de verdade das telas)

`index.html` da **raiz** → `src/main.jsx` → `src/App.jsx`. É o único HTML processado pelo build.

- `src/App.jsx` — rotas. Todas as telas de negócio ficam dentro de `<ProtectedRoute>`.
- `src/pages/*.jsx` — uma tela por arquivo (Home, Produtos, SugestaoCompra, Budget, Transferencias, Excesso, Rupturas, Recebimento, Fornecedores, Configuracoes, Perfil, Login).
- `src/components/layout/AppShell.jsx` — sidebar/drawer + `NAV`; `ProtectedRoute.jsx`; `SyncStatusButton.jsx`.
- `src/components/ui/` — `KpiCard`, `FilterBar`, `Pagination`, `SortableTh` (cabeçalhos ordenados no servidor), `DiasCompraFilter` (horizonte de compra), `DrilldownModal` e `DrilldownChips`, gráficos Chart.js (`BarChart`, `DonutChart`, `LineChart`).
- `src/components/settings/PermissoesUsuarios.jsx` — aba "Acesso" de Configurações, só para admin.
- `src/context/AuthProvider.jsx` (sessão/perfil) e `PermissionsProvider.jsx` (módulos e gráficos por usuário).
- `src/hooks/` — `useServerFilters` (filtro + paginação server-side), `useDrilldown`, `useSkylerContext`, `useSyncStatus`.
- `src/tours/` — `tour.js` (`criarTour` + `useTourAutomatico`, abre uma vez por `chave` no localStorage) e um arquivo de steps por tela.

**Contrato de três pontas:** ao adicionar/renomear uma tela, os três precisam bater — a rota em `App.jsx`, o `to` em `NAV` (`AppShell.jsx`) e a `chave` em `CATALOGO` (`PermissionsProvider.jsx`). Cada entrada de `graficos` no `CATALOGO` (`{chave, label, tipo}`) corresponde a uma chamada `podeVerGrafico('<modulo>', '<grafico>')` dentro da página, aos mesmos nomes na tabela `permissoes_acesso` do Supabase, e é o que o editor de permissões lista.

**Filtros, ordenação e paginação** são todos server-side, via `useServerFilters` → `toQuery()` → RPC. Nada é filtrado ou ordenado no cliente. Colunas ordenáveis usam `SortableHeadCells` com uma lista `COLUNAS` no topo da página, onde `chave` é o campo aceito em `ordenar_por` pela RPC — coluna sem `chave` vira `<th>` comum.

**Drill-down** (`useDrilldown`): todo valor agregado na tela é um recorte navegável — 1 clique aplica o recorte como filtro server-side da página inteira, 2 cliques abrem a lista paginada daquele recorte (`DrilldownModal`, mesma RPC com `incluir_metricas: false`, então o total do modal é o número que foi clicado). Clicar de novo no mesmo alvo desfaz o filtro. Recorte sem controle próprio na `FilterBar` (`status_estoque` na Home, `qualidade` em Produtos) precisa de um `DrilldownChips` — senão fica invisível e o usuário não tem como desfazer.

**Sugestão de Compra** carrega a lista inteira (`por_pagina: 5000`, o mesmo teto do clamp da RPC e da exportação), sem `Pagination`. A coluna Sugestão é editável: o valor digitado fica por SKU em `compras.sugestao.quantidades.v1` e vence o da RPC na linha, nos totais, no CSV e no rascunho de compra, até ser desfeito.

### Camada única de acesso a dados

Todo tráfego remoto passa por `src/data/data-access.js`, exposto como `dataAccess.{dashboard,auth,users,permissions,parameters}`. Falhas viram `DataAccessError` (`operation`, `code`, `status`, `details`, `hint`).

Proibido em páginas/componentes/contexts/hooks: importar `src/lib/supabase-client.js`, ou chamar `.rpc()`, `.from()`, `supabase.auth`. Operação nova entra na camada e é consumida por método semântico.

As 9 telas operacionais leem RPCs paginadas `get_*` (`get_home_dashboard`, `get_sugestao_compra`, `get_rupturas`, `get_excesso`, `get_produtos`, `get_budget`, `get_transferencias`, `get_recebimentos`, `get_fornecedores`) — o frontend não tem `SELECT` bruto nas tabelas. Mock nunca é fallback de consulta (MSW só no dev, via `VITE_USE_MSW`).

O módulo faz cache em memória de sessão/perfil/permissões e lê a sessão persistida do localStorage antes de revalidar em background — o lock interno do SDK Supabase trava a UI se você esperar por `getSession()`.

### Estados de consulta

Cada página controla `loading | success | empty | error` com `useState`/`useEffect`. Toda consulta passa por loading e termina explicitamente. Estado vazio decide por `total_count` (ou total agregado de `kpis` quando a RPC não devolve `total_count`). Erro tem que permitir repetir a mesma consulta com os mesmos filtros. Componente sem fonte no contrato simplesmente não renderiza — nunca mock, nunca loading eterno.

### Backend Supabase

Fonte executável: `supabase/migrations/`, aplicada inteira e em ordem lexicográfica. `supabase/sql/` é histórico — não executar. Smoke tests em `supabase/tests/` (05 = segurança multiempresa, 06 = ETL horário, 07 = compatibilidade de perfil legado).

A migration de segurança revoga leitura direta das tabelas, exige módulo nas 9 RPCs públicas e aplica escopo de empresas. Usuário novo entra sem módulo e sem empresa. Admin tem visibilidade global mas continua sem `SELECT` bruto.

Em caso de divergência, a ordem de verdade é: `supabase/migrations/` → `supabase/tests/` → `docs/ai/backend.md` → `docs/architecture/supabase_arquitetura.md` → `src/data/data-access.js` e `src/pages/*.jsx` → arquivos históricos.

Não usar `estoque_produto_diario`, `radar_estoque_curva_status` nem views `vw_*` como dependência nova. `empresa_nome` é filtro funcional, não isolamento por empresa.

### Skyler (chat) e Cloudflare Functions

`src/components/skyler/Skyler.jsx` chama `VITE_SKYLER_API_URL` (rota **relativa**, padrão `/api/skyler/chat`). O proxy é `functions/api/skyler/chat.js`: valida same-origin, valida o Bearer do Supabase em `/auth/v1/user`, limita payload a 64 KB, e só então repassa para `SKYLER_UPSTREAM_URL` com os headers de `.dev.vars`. Nenhum segredo de IA no frontend, e o token de sessão nunca sai para origem externa — os validadores bloqueiam URL absoluta.

### Ingestão n8n

14 fluxos em `integrations/n8n/dashboard_c/workflows/` rodam de hora em hora e gravam pela RPC `ingest_dashboard_dataset` (só `service_role`). O frontend nunca consulta o n8n. No servidor n8n, `N8N_CONCURRENCY_PRODUCTION_LIMIT=1` é obrigatório.

### Árvore legada (pré-React) — removida

A versão multipágina anterior (`src/js/`, `src/assets/`, os `*.html` internos, `scripts/build.js` e `scripts/inline-icons.js`) foi removida do repositório: tudo já estava portado para o app React e nada daquilo entrava no build. `npm run validate` falha se algum desses caminhos reaparecer.

O histórico continua acessível pelo git. Documentos anteriores a essa remoção estão marcados como históricos no topo do próprio arquivo.

## Padrões do projeto

1. **Facade de acesso a dados** — `data-access.js` é o único ponto de I/O remoto; nada mais chama `.rpc()`/`.from()`/`supabase.auth` direto.
2. **Backend só por RPC** — zero `SELECT` bruto liberado pro frontend; contrato é a assinatura da função Postgres, não a tabela.
3. **`security definer` como bypass controlado de RLS** — RPC pública roda com privilégio do owner (não do caller), porque a tabela por baixo tem leitura revogada de propósito.
4. **Guarda de módulo centralizada** — `fn_exigir_acesso_modulo` é chamada no topo de cada RPC operacional; um ponto único de autorização, não um `if` por página.
5. **Trigger de sincronização de dimensão** — `fn_sincronizar_empresa_operacional` preenche `empresa_id`/`empresa_nome` sozinho; o INSERT não precisa (e não deve) resolver isso.
6. **Contrato de três pontas** — rota (`App.jsx`) + item de nav (`AppShell.jsx`) + chave no `CATALOGO` (`PermissionsProvider.jsx`) têm que nascer e morrer juntos.
7. **Filtro/ordenação/paginação 100% server-side** — `useServerFilters` → `toQuery()` → RPC; nunca filtra ou ordena array no cliente.
8. **Máquina de estados de consulta explícita** — `loading | success | empty | error` por página, nunca loading eterno, nunca mock como substituto de dado real.
9. **PK sintética + chave de negócio separada** — `id uuid` como chave primária, e um índice único composto (`empresa_id, data_referencia, sku`) como árbitro do `ON CONFLICT` do ingest. PK em coluna de negócio quebra upsert entre datas diferentes (ver `corrige_pk_natural_*`).
10. **"Foto" mais recente como fonte de verdade** — as RPCs de tela leem `max(data_referencia)` por empresa; não é histórico acumulado, é o snapshot atual.
11. **Cache otimista de sessão** — lê perfil/permissões do `localStorage` antes de revalidar em background; nunca espera o lock do SDK Supabase pra pintar a UI.
12. **Fail closed em permissão** — usuário novo entra sem módulo e sem empresa; admin tem bypass explícito (não implícito); nunca libera por omissão.
13. **Proxy de borda para serviço externo** — a Cloudflare Function do Skyler valida same-origin e Bearer antes de repassar; segredo de IA nunca chega ao browser.
14. **Migration é aditiva, nunca editada depois de aplicada** — correção vira migration nova (ver as três de regrant/security definer desta sessão); reescrever uma já rodada em produção não reexecuta nada.

## Estilo e UI

Tailwind v4 + daisyUI, tema `compras` definido em `src/index.css` (único lugar de CSS). Usar classes utilitárias/daisyUI direto no JSX — sem `<style>`, sem arquivo CSS novo. Tokens fora do daisyUI (`--color-orange`, `--color-purple`, `--color-teal`, `--color-critical`) vivem no `:root` do mesmo arquivo e são lidos por `src/lib/theme-color.js` para o canvas dos gráficos. Ícones: `lucide-react`, importados no componente que usa.

Nada por CDN — dependências de runtime entram por npm e são empacotadas pelo Vite.

## Env

Frontend (`.env.local`, prefixo `VITE_`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SKYLER_API_URL`, `VITE_USE_MSW`, `VITE_PROFILE_TIMEOUT_MS`, `VITE_SESSION_TIMEOUT_MS`, `VITE_PERMISSIONS_TIMEOUT_MS` (lidos em `data-access.js`). Sem o prefixo `VITE_` o Vite não expõe pro browser e o código cai no default hardcoded, silenciosamente — por isso os três timeouts existem em dobro no `.env`/`.env.example`: a versão sem prefixo é pro build antigo (`scripts/build.js`, `process.env`), a com `VITE_` é pro app React. Só a chave anon chega ao browser; `service_role` jamais.

Worker (`.dev.vars`, e vars da Cloudflare): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SKYLER_UPSTREAM_URL`, `SKYLER_API_TOKEN`, `SKYLER_API_HEADER`, `SKYLER_TIMEOUT_MS`.

`APP_URL` — domínio canônico de produção, sem prefixo `VITE_` (não é lido pelo React/Vite). Consumido por `scripts/build.js` (injeta `window.__ENV__.APP_URL` pra árvore legada) e `scripts/check-cloudflare-deploy.mjs` (smoke pós-deploy); `scripts/validate.js` confere que `.env.example` tem a URL de produção certa.

Cloudflare Pages: build `npm run build`, output `dist`, Node 22. O `.npmrc` fixa o registry público — lockfile com registry privado quebra o build.

## Problemas recorrentes

1. **RPC de gráfico secundário "some" sem erro** — a limpeza de "helpers antigos não usados pelo frontend" pode revogar `EXECUTE` de uma RPC que na verdade ainda é chamada por `data-access.js`. Sintoma: tabela/gráfico fica vazio, sem alerta de erro. Antes de revogar qualquer RPC, `grep` o nome dela em `src/data/data-access.js`.
2. **`EXECUTE` liberado não basta pra RPC `security invoker`** — essas funções leem tabela com a permissão do _caller_, e `authenticated` não tem (e não deve ter) `SELECT` direto nas tabelas operacionais. Sintoma: `permission denied for table X`, só aparece testando como usuário real — testar como `service_role`/superuser esconde o bug. Ou a RPC é `security definer` (padrão das RPCs de tela), ou ela nunca vai funcionar pra `authenticated`.
3. **`VITE_USE_MSW=true` mascara dado real do Supabase** — em dev, MSW intercepta as RPCs de dashboard com fixtures fixas (`mocks/handlers.js`); algumas têm `itens: []`. Se a tela está vazia em dev mas o dado existe no banco, confira essa flag antes de suspeitar do backend.
4. **Vite não recarrega `.env` sozinho** — mudou variável, precisa parar e subir `npm run dev` de novo; hot reload não pega isso.
5. **Prettier normaliza aspas de seletor CSS pra aspas simples** — qualquer check literal de string (tipo em `scripts/validate.js`) que exija aspas duplas nunca bate depois de um `npm run format`. Checks desse tipo devem aceitar as duas formas.
6. **Node 25+ liga Web Storage global por padrão** — conflita com o `localStorage` do jsdom e quebra teste (`window.localStorage` vira `undefined`). Só acontece em Node ≥25 local; CI fixa Node 22, então não reproduz lá. Ver guard em `vite.config.mjs`.
7. **Docker no Git Bash (Windows) reescreve o path do `-v`** — `docker run -v "$PWD:/src" ...` monta vazio por conversão de path da MSYS. Usar `MSYS_NO_PATHCONV=1` na frente do comando.
8. **Não setar `empresa_id`/`empresa_nome` manualmente ao inserir** — o trigger `fn_sincronizar_empresa_operacional` preenche os dois sozinho a partir de um (ou cria a empresa se o nome não existir). Setar os dois "na mão" e errar o par é um jeito fácil de violar a FK.
9. **PK em coluna de negócio quebra `ON CONFLICT` entre datas** — se uma tabela de ingestão tem `sku`/`numero_nota` como PK (em vez de `id uuid`), o segundo INSERT do mesmo SKU numa data diferente estoura na PK antes do índice único composto decidir o upsert. Ver `supabase/migrations/*_corrige_pk_natural_*.sql`.
10. **RPC de tela só lê a "foto" mais recente** — inserir um snapshot novo (nova `data_referencia`) sem atualizar as linhas relacionadas na mesma data faz um subconjunto desaparecer da leitura atual (ex.: fornecedor antigo cai fora do ranking porque ficou numa data anterior à do resto do lote).
11. **`npm run validate` também cobre a árvore legada** — path quebrado ou seletor CSS ausente em `src/js`/`styles.css` derruba o build mesmo numa mudança 100% dentro do app React.
12. **`.npmrc` fixa registry público** — lockfile gerado com registry privado configurado localmente quebra o build da Cloudflare Pages; sintoma só aparece no deploy, não local.

## Feature nova (TDD)

Ciclo padrão pra qualquer feature — tela, RPC, método de `data-access.js`, Cloudflare Function: **red → green → refactor**.

1. **Red** — escreve o teste que falha primeiro. Frontend/camada de dados: Vitest em `tests/unit/` ou `tests/integration/`, seguindo a convenção dos arquivos existentes (mocka `supabase-client`, nunca bate em rede real). RPC/backend nova: smoke test em `supabase/tests/` que simula o **usuário autenticado real** (`set local role authenticated` + `set_config('request.jwt.claims', ...)`) — nunca só como superuser/service_role, isso esconde bug de grant e de `security invoker` (ver "Problemas recorrentes" #2). Confirma que o teste falha pelo motivo certo — a feature ainda não existe, não erro de sintaxe/import.
2. **Green** — o mínimo de código pra passar. Não aproveita pra resolver outro problema no caminho.
3. **Refactor** — com o teste verde, limpa sem trocar comportamento; roda o teste de novo depois de cada ajuste.

Contrato que não pode quebrar, por tipo:

- **Tela nova**: contrato de três pontas (ver "Arquitetura"), estados `loading | success | empty | error`, filtro/ordenação/paginação 100% server-side.
- **RPC nova**: chama `fn_exigir_acesso_modulo('<modulo>')` no topo; é `security definer` se lê qualquer tabela sem `SELECT` liberado pra `authenticated` (ou seja, quase sempre); `grant execute ... to authenticated` explícito; nunca edita migration já aplicada.
- **Método de `data-access.js` novo**: nunca `.rpc()`/`.from()`/`supabase.auth` fora desse arquivo; erro remoto vira `DataAccessError`.

Não fazer: escrever código antes do teste que prova que a feature não existe; declarar "pronto" só porque buildou (build passar não prova lógica nem segurança); testar RPC nova só como superuser/service_role; mockar RPC nova no MSW com formato diferente do que ela realmente devolve.

## Checklist pós-implementação

- Rodar `npm run check` (ou o validador específico da área tocada) antes de commitar — não só o `npm test`.
- Mudou RPC/grant/RLS? Simular a sessão do usuário autenticado real (`set local role authenticated` + `set_config('request.jwt.claims', ...)`), não só testar como superuser/service_role — isso esconde bug de grant e de `security invoker`.
- Mudou schema/permissão? Migration nova, nunca editar uma já aplicada. Depois de `db push`, confirmar `grant`/`security definer` com uma query direta, não só "a migration rodou sem erro".
- Mudou tela/módulo? Bate o contrato de três pontas (rota, `NAV`, `CATALOGO`) e roda `npm run validate`.
- Mudou `.env`/`.env.example`? Reiniciar `npm run dev` e confirmar que tudo que o frontend lê tem prefixo `VITE_`.
- Tocou em CSS ou HTML legado? `npm run format` antes do `npm run validate`, pra não cair no mismatch de aspas.
- Antes do PR: `npm run check:ci` completo local — não só a parte que você mudou, pra não empurrar quebra de vizinho pro CI.

## Documentação

`llm.md` é o documento canônico e o índice de leitura obrigatória antes de mexer em layout/arquitetura/integração: `docs/ai/{design-system,componentes,boas-praticas,backend,diagramas}.md`, mais a auditoria mais recente em `docs/audits/`.

`docs/README.md` indexa o restante por assunto. Relatórios de release ficam em `docs/reports/releases/<versão>/` — `npm run validate` bloqueia `RELATORIO_*.md` na raiz.
