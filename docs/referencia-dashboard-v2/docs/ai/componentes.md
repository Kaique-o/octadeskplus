# llm.componentes.md — componentes do dashboard compras

componentes reutilizaveis vivem em `src/components/`; estilo vem do tema daisyUI `compras` (`src/app/index.css`) + classes Tailwind direto no jsx. reutilizar componente existente antes de criar um novo.

## AppShell (sidebar/drawer)

- arquivo: `src/app/AppShell.jsx`; usado por toda rota dentro de `<ProtectedRoute>` (`src/app/ProtectedRoute.jsx`).
- estrutura: `drawer` do daisyUI — sidebar fixa em desktop (`lg:drawer-open`, breakpoint `lg` = 1024px), colapsa para drawer com overlay abaixo disso.
- menu (`NAV`): lista fixa de `{ chave, to, icone, label }`; renderiza somente os itens em que `podeVerModulo(chave)` (`usePermissions`) e verdadeiro. ordem fixa: Home, Sugestao de Compra, Budget, Transferencias, Excesso, Rupturas, Produtos, Recebimento, Fornecedores.
- rodape da sidebar: link fixo para Configuracoes (fora do `NAV`/`CATALOGO`, sempre visivel a usuario logado) + dropdown de usuario (iniciais calculadas de `profile.nome`, opcao Sair chama `logout()` do `AuthProvider`).
- a `<Skyler />` e montada aqui, fora do drawer, presente em toda tela protegida.
- proibido: item de menu sem `chave` correspondente em `CATALOGO` (`PermissionsProvider.jsx`) e em `App.jsx`; sidebar duplicada por pagina — e um unico componente compartilhado, alterar aqui afeta todas as telas.

## cards kpi

- componente: `src/shared/ui/KpiCard.jsx`, dentro de um `<div class="stats ...">` (daisyUI).
- props: `icon` (componente `lucide-react`), `label`, `value`, `note`, `tone` (`primary error warning success info secondary`), `loading`.
- `loading` mostra `skeleton` no lugar do valor; o tamanho da fonte do valor encolhe conforme o texto cresce (`tamanhoValor`), para nao estourar o card com moeda/milhares.
- proibido: kpi sem `icon`; mais de 6 kpis por linha de `stats`.

## filtros

- componente: `src/shared/ui/FilterBar.jsx`; usa `select`/`input` do daisyUI (`select-bordered`, `input-bordered`, tamanho `sm`).
- campos: busca (texto livre, debounced) + `macrogrupo`, `curva`, `marca` (`select` com as opcoes vindas da RPC).
- estado, debounce e paginacao ficam no hook `src/shared/hooks/useServerFilters.js`, consumido pela pagina: `estado`, `searchDraft`, `setCampo`, `setSearch`, `setPagina`, `toQuery()`.
- proibido: filtrar lista no cliente — busca e os tres selects sao resolvidos pela RPC (`filtro_dimensoes_compras`); a pagina so envia o filtro e mostra o que a RPC devolve.

## tabelas

- usar `table table-sm` (daisyUI) dentro de `card`/`card-body`; nao existe componente de tabela generico — cada pagina monta a sua com as colunas da RPC correspondente.
- paginacao: `src/shared/ui/Pagination.jsx` (`join`/`btn-sm` do daisyUI), recebe `pagina`, `porPagina`, `totalCount`, `onPagina`.
- status em `badge` (`badge-error`, `badge-warning`, ...), nunca texto solto colorido manualmente.

## graficos (chart.js via react-chartjs-2)

- `src/shared/ui/BarChart.jsx`: barras horizontais (ranking, pendencias, categorias); rotulo fixo no fim da barra via `chartjs-plugin-datalabels`, sem tooltip.
- `src/shared/ui/LineChart.jsx`: evolucao/tendencia; `series` = `[{ label, data, color }]`; eixo X sem texto (mesma decisao do design original).
- `src/shared/ui/DonutChart.jsx`: `data` = `[{ label, value, color }]` + `centerLabel` (texto multi-linha com `\n`) no centro; clique numa fatia ou item da legenda chama `onClickLabel` (usado para filtrar a tabela da mesma tela).
- todos usam `src/shared/lib/theme-color.js` (`corTema('--nome-da-variavel')`) para ler a cor do tema daisyUI ativo, porque o `<canvas>` do chart.js nao resolve `var(--x)` como o DOM resolve.
- regra dura: cor da fatia/linha do grafico = cor do `dot` da legenda no mesmo card.

## Skyler

- componente: `src/plataforma/skyler/Skyler.jsx`, montado uma vez no `AppShell` (presente em toda tela protegida).
- estado (aberto, conversa, mensagens) persiste em `sessionStorage` (`compras.skyler.estado.v1`) entre navegacoes da sessao.
- envia para `SKYLER_API_URL` (validado para ficar na mesma origem — nunca URL absoluta/externa) a mensagem, o id da conversa e o token de sessao no header `Authorization`.

## login

- pagina: `src/app/paginas/Login.jsx`; card unico centralizado (`grid place-items-center`), sem o painel lateral decorativo da versao legada.
- formulario controlado (estado local), erro generico ("E-mail ou senha invalidos"), "lembrar e-mail" salvo em `localStorage`.
- usuario ja autenticado que acessa `/login` e redirecionado para `/` (`<Navigate>`); pos-login usa `useNavigate`.

## estados de dados

cada pagina controla seu proprio estado (`useState` local), seguindo este contrato:

- `loading`: consulta em andamento (ex.: `Home.jsx` usa `status === 'loading'` para acionar o `skeleton` dos kpis);
- `success`: dados reais renderizados;
- `empty`: consulta concluida sem registros (decidido por `total_count`, ou pelo total agregado de `kpis` quando a RPC nao devolve `total_count`);
- `error`: falha explicita — mostrar `alert alert-error` (daisyUI) e permitir repetir a mesma consulta;
- componente sem fonte no contrato atual simplesmente nao renderiza (controlado por `podeVerGrafico`), nunca com mock ou loading eterno.

fluxo tipico (`src/modulos/compras/paginas/Home.jsx` é a referência):

```jsx
useEffect(() => {
  let ativo = true;
  setStatus('loading');

  dataAccess.dashboard
    .home(filtros.toQuery())
    .then((retorno) => {
      if (!ativo) return;
      setDados(retorno);
      setStatus(Number(retorno.total_count || 0) === 0 ? 'empty' : 'success');
    })
    .catch(() => {
      if (ativo) setStatus('error');
    });

  return () => {
    ativo = false;
  };
}, [filtros.estado]);
```

regras:

- nao criar spinner independente com timeout proprio por componente;
- estado vazio deve considerar o total real da consulta, nao apenas o tamanho da pagina;
- todo texto de estado de erro deve orientar o usuario a tentar novamente.

## permissoes por grafico

- cada bloco visual de uma pagina fica atras de `podeVerGrafico('<chave-do-modulo>', '<chave-do-grafico>')` (`usePermissions`, de `PermissionsProvider.jsx`);
- as chaves de grafico de cada modulo estao centralizadas no `CATALOGO` de `PermissionsProvider.jsx` — renomear ou remover um grafico exige ajustar o catalogo, a pagina e a tabela `permissoes_acesso` no Supabase juntos.

## permissoes e usuarios

A aba "Acesso" de `Configuracoes.jsx` e servida por `src/app/paginas/PermissoesUsuarios.jsx`, visivel so para admin. Ela edita perfil, modulos e graficos por usuario, gravando na tabela `permissoes_acesso` pelas RPCs do dominio `permissions` de `data-access.js`.
