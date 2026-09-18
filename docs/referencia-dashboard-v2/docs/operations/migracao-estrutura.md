# migracao da estrutura de pastas

> **Documento historico.** Descreve a estrutura multipagina anterior a migracao
> para React (`src/js/`, `scripts/build.js`, `src/assets/css/styles.css`), que foi
> removida do repositorio. Vale como registro datado, nao como instrucao.
> Para o estado atual, ver `llm.md` e `docs/ai/`.

## objetivo

eliminar a duplicidade de projeto e separar codigo fonte, artefato de deploy, documentacao e banco sem alterar a regra de negocio existente.

## origem considerada

foi usada como fonte de verdade a pasta `clone git/`, por ser o checkout versionado e sincronizado. a copia solta existente no zip nao foi carregada para o novo repositorio.

## principais mudancas

- arquivos do site movidos para `src/`;
- javascript separado por responsabilidade;
- build movido para `scripts/build.js`;
- deploy gerado em `dist/`;
- documentacao agrupada por assunto;
- pasta incorreta `skill.md/` substituida por `docs/ai/`;
- imports e referencias dos html atualizados;
- `dist/` e clones internos adicionados ao `.gitignore`.

## configuracao cloudflare pages

- build command: `npm run build`
- build output directory: `dist`
- variaveis: `SUPABASE_URL` e `SUPABASE_ANON_KEY`

## limite desta entrega

esta migracao reorganiza a estrutura e valida caminhos e sintaxe. ela nao corrige as rpcs quebradas, filtros client-side, mocks silenciosos ou gargalos de consulta ja identificados.
