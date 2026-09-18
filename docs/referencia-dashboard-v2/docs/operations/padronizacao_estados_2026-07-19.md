# padronizacao de loading erro vazio e sucesso

> **Documento historico.** Descreve a estrutura multipagina anterior a migracao
> para React (`src/js/`, `scripts/build.js`, `src/assets/css/styles.css`), que foi
> removida do repositorio. Vale como registro datado, nao como instrucao.
> Para o estado atual, ver `llm.md` e `docs/ai/`.

## escopo

padronizacao aplicada nas nove telas operacionais do dashboard:

- home;
- sugestao de compra;
- budget;
- transferencias;
- excesso;
- rupturas;
- produtos;
- recebimentos;
- fornecedores.

## alteracoes

- removido `src/js/core/loading.js`;
- removidos os overlays por card e o timeout fixo de seis segundos;
- centralizado o ciclo de estado em `src/js/shared/data-state.js`;
- incluido indicador no header com estado e horario da atualizacao;
- incluido `aria-busy` no conteudo principal;
- incluida regiao `aria-live` para leitores de tela;
- estado de erro ganhou acao de nova tentativa usando os mesmos filtros;
- estado vazio passou a usar `total_count` das rpcs;
- componentes parciais sem dados usam o mesmo bloco visual;
- consultas leves afetam somente tabela e paginacao;
- validacao automatica impede o retorno do spinner legado.

## contrato visual

| estado      | comportamento                                           |
| ----------- | ------------------------------------------------------- |
| loading     | barra de progresso superior e indicador azul            |
| success     | indicador verde com horario da atualizacao              |
| empty       | indicador amarelo e mensagem sem resultado              |
| error       | indicador vermelho e botao de nova tentativa            |
| unavailable | componente preservado com mensagem de indisponibilidade |

## validacao

executar:

```bash
npm ci
npm run check
```

nenhuma migration do supabase e necessaria para esta alteracao.
