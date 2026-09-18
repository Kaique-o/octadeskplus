# validacao da margem de seguranca das tabelas 1.10.13

## escopo

- afastar tabelas das bordas laterais dos cards;
- alinhar paginacao ao mesmo recuo;
- preservar rolagem horizontal em tabelas largas;
- manter area util no mobile.

## implementacao

- margem lateral de 16 px em desktop e tablet;
- margem lateral de 10 px em telas com ate 760 px;
- contorno e raio interno no container rolavel;
- paginacao alinhada ao mesmo gutter;
- cabecalho da tabela sem borda superior duplicada.

## validacao executada

```bash
npm ci
npm run build
npm run validate
npm run test
npm run test:e2e
npm audit --audit-level=low
```

## resultado

- build aprovado;
- validacao estatica aprovada;
- 26 testes Vitest aprovados;
- 24 testes Playwright aprovados;
- teste geometrico confirmou pelo menos 15 px dos dois lados da tabela e da paginacao;
- zero vulnerabilidades conhecidas no npm audit.
