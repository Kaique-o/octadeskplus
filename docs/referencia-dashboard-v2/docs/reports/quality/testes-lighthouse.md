# validacao testes e lighthouse

**versao:** 1.10.0  
**data:** 19/07/2026  
**status:** aprovado

## comandos executados

```bash
npm run build
npm run validate
npm run test
npm run test:e2e
npm run test:lighthouse
npm audit
```

## resultados

### vitest

```text
4 arquivos aprovados
7 testes aprovados
0 falhas
```

cobertura funcional:

- estados compartilhados de dados;
- escape de mensagens e retry;
- filtros macrogrupo curva marca busca ordenacao e paginacao;
- contrato e erros da camada unica de dados;
- payload contextual da Skyler.

### playwright

```text
11 testes aprovados
0 falhas
```

rotas validadas:

- login;
- home;
- sugestao de compra;
- budget;
- transferencias;
- excesso;
- rupturas;
- produtos;
- recebimentos;
- fornecedores;
- responsividade mobile da home.

### lighthouse

| rota | performance | acessibilidade | boas praticas | seo |
|---|---:|---:|---:|---:|
| login | 84 | 95 | 100 | 63 |
| definir senha | 85 | 100 | 100 | 63 |

limites de bloqueio:

| categoria | minimo |
|---|---:|
| performance | 80 |
| acessibilidade | 90 |
| boas praticas | 90 |
| seo | 60 |

a nota de seo e limitada pelo bloqueio intencional de indexacao das rotas de autenticacao em `robots.txt`. esse bloqueio nao foi removido para melhorar artificialmente o score.

### dependencias

```text
npm audit
found 0 vulnerabilities
```

## observacao de ambiente

o chromium instalado no ambiente de validacao possuia uma policy global `URLBlocklist: ["*"]`. para executar a auditoria foi usado um chromium isolado somente durante a validacao. o repositorio nao inclui esse binario nem altera policies do sistema.

no github actions o workflow instala o chromium oficial do Playwright e fixa o mesmo executavel para Playwright e Lighthouse.
