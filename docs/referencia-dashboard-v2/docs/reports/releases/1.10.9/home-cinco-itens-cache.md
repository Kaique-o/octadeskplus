# Validacao da home com cinco itens — v1.10.9

## problema confirmado

A versao anterior ja declarava `por_pagina: 5` no codigo-fonte, mas os arquivos JavaScript de entrada mantinham nomes fixos e podiam permanecer em cache por ate uma hora. Por isso o navegador podia continuar executando uma versao antiga da home depois do deploy.

## correcoes

- A home usa a constante `HOME_CRITICAL_DEFAULT_PAGE_SIZE = 5`.
- A primeira RPC recebe `pagina: 1` e `por_pagina: 5`.
- A tabela limita a renderizacao ao tamanho atualmente selecionado.
- Caso uma RPC antiga devolva mais linhas ou informe `por_pagina: 15`, a primeira tela ainda renderiza somente cinco linhas e mantem a paginacao em cinco.
- A RPC `get_home_dashboard` passa a usar cinco como valor padrao quando `por_pagina` nao for informado.
- Foi criada a migration `20260719190000_home_5_itens_padrao.sql`.
- Foi criado o instalador manual `supabase/migrations/20260719190000_home_5_itens_padrao.sql`.
- O build adiciona `?v=1.10.9` aos arquivos JavaScript e CSS de entrada, eliminando a reutilizacao do bundle antigo apos o deploy.

## validacoes executadas

- `npm ci`: aprovado, 242 pacotes instalados.
- `npm run build`: aprovado.
- `npm run validate`: aprovado.
- Vitest: 21 testes aprovados.
- Playwright: 19 testes aprovados.
- Teste de resposta incompatível: RPC simulada devolveu 12 linhas e `por_pagina: 15`; a home renderizou exatamente cinco linhas.
- `npm audit --omit=dev`: zero vulnerabilidades.
- `dist/index.html` referencia `home.js`, `filtros.js` e `styles.css` com `?v=1.10.9`.

## deploy

1. Publique a pasta `dist` gerada por esta versao.
2. Aplique `supabase/migrations/20260719190000_home_5_itens_padrao.sql` no Supabase para alinhar o padrao da RPC.
3. Nao reutilize a pasta `dist` de uma versao anterior.
