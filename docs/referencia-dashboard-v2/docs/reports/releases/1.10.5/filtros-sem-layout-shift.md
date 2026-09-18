# Validacao dos filtros sem layout shift — v1.10.5

## Causa corrigida

Os controles de filtro recebiam a classe `control-select` somente depois da inicializacao do JavaScript. Uma regra CSS aplicava `margin-left: auto` a todos os icones do controle quando essa classe aparecia, alterando a distribuicao horizontal depois do primeiro paint.

## Alteracoes

- `control-select`, `role` e `tabindex` agora fazem parte do HTML inicial dos 27 filtros seletivos.
- A regra de margem automatica foi removida dos icones.
- Somente o ultimo icone recebe a transicao de rotacao.
- O grid dos filtros possui `justify-self` e `align-self` estaticos.
- O validador bloqueia filtros que nao nascam no estado visual final.
- Foi adicionado teste Playwright que compara posicao e largura antes e depois da inicializacao do controlador.

## Criterio de aceite

A geometria dos quatro controles, seus icones e valores deve ser identica antes e depois de `dashboardServerFilters.configurar()`.
