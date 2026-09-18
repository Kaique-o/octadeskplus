# testes automatizados e lighthouse

## objetivo

a versao 1.10.0 adiciona uma esteira de qualidade executavel localmente e no github actions. o pipeline nao depende de supabase real para validar o frontend e nao adiciona bypass de autenticacao ao bundle de producao.

## comandos

```bash
npm ci
npm run check
npm run check:ci
```

`npm run check` executa nesta ordem:

1. `npm run build`;
2. `npm run validate`;
3. `npm run test`;
4. `npm run test:e2e`;

`npm run check:ci` executa as quatro etapas acima e acrescenta `npm run test:lighthouse`.

## cobertura implementada

### vitest e jsdom

- estados loading sucesso vazio erro e retry;
- escape de mensagens antes da insercao no html;
- filtros globais macrogrupo curva marca busca ordenacao e paginacao;
- payload das rpcs e limpeza de campos `undefined`;
- padronizacao de erros da camada de dados;
- payload da skyler com pagina filtros conversa e bearer token.

### playwright

- carregamento e interacoes basicas do login;
- ausencia de erro javascript nas rotas testadas;
- presenca dos filtros globais nas nove telas;
- ausencia de sobreposicao entre sidebar e conteudo;
- ausencia de overflow horizontal em desktop e mobile;
- abertura do painel da skyler em todas as telas.

os scripts de autenticacao permissao e consulta das paginas internas sao neutralizados pela interceptacao de rede do Playwright. essa neutralizacao existe somente no processo de teste e nao altera `src/` nem `dist/`.

### lighthouse

rotas auditadas:

- `/login.html`;
- `/definir-senha.html`.

limites que bloqueiam o pipeline:

| categoria      | minimo |
| -------------- | -----: |
| performance    |     80 |
| acessibilidade |     90 |
| boas praticas  |     90 |
| seo            |     60 |

o score de seo das rotas de autenticacao e limitado pelo bloqueio intencional de indexacao em `robots.txt`. esse bloqueio e uma regra de seguranca e nao deve ser removido apenas para elevar a nota.

relatorios:

```text
reports/lighthouse/login.html
reports/lighthouse/login.json
reports/lighthouse/definir-senha.html
reports/lighthouse/definir-senha.json
reports/lighthouse/summary.json
```

## ci

`.github/workflows/quality.yml` executa o pipeline em pull requests e pushes para `main` ou `master`. os relatorios do Playwright e Lighthouse sao enviados como artefatos mesmo quando uma etapa falha.

## regra de manutencao

- nao usar `test.only`, `describe.only`, `test.skip` ou equivalentes;
- toda nova tela operacional deve entrar em `tests/e2e/dashboard.spec.js`;
- todo novo filtro deve possuir teste de payload;
- reducao de limite do Lighthouse exige justificativa documentada;
- falha de teste nao deve ser escondida com retry indiscriminado ou remocao da assercao.
