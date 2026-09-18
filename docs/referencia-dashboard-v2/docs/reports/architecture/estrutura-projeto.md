# validacao da reestruturacao

## escopo

validacao executada depois da migracao da estrutura de pastas sem alteracao intencional das regras de negocio das telas.

## resultados

- `npm run check`: aprovado;
- build de `src/` para `dist/`: aprovado;
- sintaxe dos arquivos javascript: aprovada;
- imports relativos entre modulos: aprovados;
- referencias locais de html para css javascript e paginas: aprovadas;
- smoke test http das 13 paginas e dos principais assets: resposta `200`;
- nenhuma chave real do supabase incluida;
- nenhuma pasta `.git`, `clone git` ou segunda copia do projeto incluida no pacote final.

## observacoes

- o build sem variaveis gera `dist/js/core/config.js` vazio e emite aviso controlado;
- em producao a cloudflare deve fornecer `SUPABASE_URL` e `SUPABASE_ANON_KEY`;
- esta entrega nao corrige filtros consultas rpcs mocks ou performance funcional.
