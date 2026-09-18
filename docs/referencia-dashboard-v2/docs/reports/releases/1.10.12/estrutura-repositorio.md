# validacao da estrutura do repositorio 1.10.12

## alteracoes

- removidos artefatos `dist/` do pacote fonte;
- removidas copias SQL redundantes da raiz;
- relatorios de validacao movidos para `docs/reports/`;
- relatorios de release separados por versao;
- documento de migracao movido para `docs/operations/`;
- mockups movidos de `src/` para `docs/reference/mockups/`;
- criado indice proprio para `supabase/` e `docs/reports/`;
- adicionada validacao automatica contra nova desorganizacao da raiz.

## regra final

A raiz deve conter apenas arquivos de configuracao e entrada do projeto. Codigo, banco, testes, documentacao e relatorios possuem diretorios proprios.

## validacao executada

```text
npm ci: aprovado, 242 pacotes
npm run build: aprovado
npm run validate: aprovado
vitest: 26 testes aprovados
playwright: 23 testes aprovados
npm audit: zero vulnerabilidades
```

O pacote final nao inclui `node_modules/`, `dist/`, `playwright-report/` ou `test-results/`.
