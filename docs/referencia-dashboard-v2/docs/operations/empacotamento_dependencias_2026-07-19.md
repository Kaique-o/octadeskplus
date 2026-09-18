# Empacotamento das dependencias do frontend — 2026-07-19

> **Documento historico.** Descreve a estrutura multipagina anterior a migracao
> para React (`src/js/`, `scripts/build.js`, `src/assets/css/styles.css`), que foi
> removida do repositorio. Vale como registro datado, nao como instrucao.
> Para o estado atual, ver `llm.md` e `docs/ai/`.

## problema anterior

O navegador carregava o Lucide pelo `unpkg`, o SDK do Supabase pelo `jsDelivr` e a fonte Inter pelo Google Fonts. A primeira renderizacao dependia de DNS, disponibilidade e cache de tres servicos externos. Os elementos `data-lucide` permaneciam sem SVG ate o download e a execucao da biblioteca.

## solucao aplicada

- criado `src/js/core/icons.js` com somente os icones efetivamente usados;
- `src/js/core/app.js` passou a importar e inicializar o registro local;
- renderizacoes dinamicas chamam `refreshIcons()` diretamente;
- `src/js/core/supabase-client.js` importa `@supabase/supabase-js` pelo npm;
- a fonte Inter usa um unico arquivo latino variavel WOFF2;
- `scripts/build.js` usa esbuild com tree shaking e divisao de chunks;
- scripts classicos continuam em formato IIFE;
- scripts modulares sao emitidos em ESM;
- links de Google Fonts e script do unpkg foram removidos de todas as paginas;
- o validador falha se uma dependencia externa de runtime voltar ao HTML.

## contrato atual

```text
src + node_modules
       |
       v
npm run build
       |
       +-- dist/js/core e dist/js/pages
       +-- dist/js/chunks
       +-- dist/assets/css/styles.css
       +-- dist/assets/fonts/*.woff2
```

`src/` nao e uma pasta publicavel diretamente. O artefato publico e exclusivamente `dist/`.

## dependencias

- `lucide` — runtime empacotado e tree-shaken;
- `@supabase/supabase-js` — runtime empacotado;
- `@fontsource-variable/inter` — fonte local;
- `esbuild` — dependencia de desenvolvimento.

## validacoes realizadas

- instalacao limpa com `npm ci`;
- `npm run check` concluido;
- `npm audit` sem vulnerabilidades conhecidas;
- 13 paginas HTML servidas com status 200;
- chunks CSS e fonte local servidos com status 200;
- teste de DOM confirmou a substituicao de elementos `data-lucide` por SVG;
- nenhuma referencia a unpkg jsDelivr Google Fonts ou Google Static permaneceu em `src/` ou `dist/`.
