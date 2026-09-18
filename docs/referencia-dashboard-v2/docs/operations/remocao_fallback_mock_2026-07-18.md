# Remocao do fallback silencioso para mock

> **Documento historico.** Descreve a estrutura multipagina anterior a migracao
> para React (`src/js/`, `scripts/build.js`, `src/assets/css/styles.css`), que foi
> removida do repositorio. Vale como registro datado, nao como instrucao.
> Para o estado atual, ver `llm.md` e `docs/ai/`.

Data: 2026-07-18

## Problema

As paginas de negocio tinham conteudo estatico no HTML e, em algumas telas, o `catch` apenas registrava o erro no console. Quando a consulta ao Supabase falhava, valores, nomes, graficos ou paginacoes de exemplo podiam continuar visiveis e parecer dados reais.

## Correcao aplicada

Foi criado `src/js/shared/data-state.js` para padronizar os estados de dados:

- `prepararEstadoPagina`: remove valores estaticos antes da consulta e mostra carregamento;
- `finalizarEstadoPagina`: converte componentes sem fonte real em indisponiveis;
- `mostrarErroPagina`: substitui toda a area de dados por erro explicito.

As nove telas operacionais agora usam esse contrato:

- home;
- sugestao de compra;
- rupturas;
- produtos;
- budget;
- excesso;
- transferencias;
- recebimento;
- fornecedores.

O HTML inicial tambem foi limpo. Tabelas iniciam em carregamento, KPIs usam `--`, paginacoes nao exibem totais ficticios e rankings sem fonte nao exibem nomes de exemplo.

## Protecao contra regressao

O `npm run check` valida que todas as telas operacionais importam e utilizam os tres estados obrigatorios. Tambem rejeita alguns marcadores historicos de mock, como periodo fixo, totais de paginacao e contagens ficticias.

## Resultado esperado

- falha de rede ou RPC: erro explicito na tela;
- consulta valida sem registros: estado vazio real;
- campo nao existente no contrato: componente indisponivel;
- sucesso: apenas dados retornados pelo Supabase;
- nenhum fallback silencioso para HTML de exemplo.
