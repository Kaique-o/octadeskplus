# validacao implementacao 1.9.0

## implementado

- dominio canonico configuravel por `APP_URL` com alvo documentado `https://compras.gruposkytech.com`;
- redirect de recuperacao de senha preparado para usar o dominio canonico;
- aliases `/home` e `/dashboard` preparados em `_redirects`;
- filtros de todas as nove telas padronizados em `macrogrupo`, `curva`, `marca` e busca;
- migration com dimensoes globais, helper de filtro, opcoes e nove RPCs atualizadas;
- funcoes de ingestao operacionais preparadas para receber `macrogrupo`, `curva` e `marca`;
- Skyler adicionada em todas as sidebars com launcher, sparkles, painel, mensagens, atalhos e contrato HTTP;
- contexto da pagina, filtros ativos, conversa e token Supabase preparados para o endpoint da Skyler;
- layout principal, sidebar, filtros, KPIs, cards, tabelas, grids e responsividade reorganizados com CSS Grid;
- validador atualizado para bloquear retorno dos filtros antigos e ausencia do contrato novo.

## validacoes executadas

```text
npm run check: OK
npm audit --omit=dev: 0 vulnerabilidades
migration PostgreSQL: 80 statements parseados com pglast
smoke test SQL: 3 statements parseados com pglast
9 telas: macrogrupo + curva + marca + busca confirmados
```

## aplicacao obrigatoria no ambiente

1. configurar na Cloudflare Pages:

```text
APP_URL=https://compras.gruposkytech.com
SKYLER_API_URL=/api/skyler/chat
SKYLER_TIMEOUT_MS=30000
```

2. aplicar no Supabase:

```text
supabase/migrations/20260719120000_dominio_filtros_globais_skyler.sql
```

3. executar:

```text
supabase/tests/04_smoke_filtros_globais.sql
```

4. adicionar no Supabase Auth:

```text
https://compras.gruposkytech.com/definir-senha.html
```

5. publicar o backend da Skyler em `/api/skyler/chat` ou alterar `SKYLER_API_URL`.

## limitacoes desta validacao

- a migration nao foi aplicada em um Supabase real porque o ambiente e as credenciais nao estavam disponiveis;
- DNS TLS e dominio customizado dependem da configuracao externa da Cloudflare;
- o chat abre e possui contrato completo mas nao gera respostas ate o endpoint da Skyler ser publicado.
