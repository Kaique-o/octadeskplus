# validacao da tabela dinamica de sugestao de compra 1.10.14

## escopo

- exportacao CSV;
- configuracao persistente de colunas;
- tela cheia;
- agrupamento por marca familia e fornecedor;
- filtros rapidos de curva prioridade e fornecedor;
- selecao de linhas;
- rascunho de compra;
- contrato complementar da RPC `get_sugestao_compra`.

## comandos executados

```bash
npm ci
npm run build
npm run validate
npm run test
npm run test:e2e
```

## resultado

- build concluido;
- validacao estrutural concluida;
- 30 testes Vitest aprovados;
- 24 testes Playwright aprovados;
- os controles deixaram de ser elementos decorativos e possuem handlers testados.

## banco

A migration `supabase/migrations/20260719210000_sugestao_tabela_dinamica.sql` adiciona `familia` e `lead_time_dias`, atualiza a RPC e devolve `opcoes_tabela`.

A migration nao foi aplicada a um Supabase remoto durante esta validacao. Deve ser executada em homologacao antes do deploy produtivo.
