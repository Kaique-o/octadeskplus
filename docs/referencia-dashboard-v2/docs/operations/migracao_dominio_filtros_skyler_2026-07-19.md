# migracao dominio filtros globais e skyler

> **Documento historico - o dominio mudou.** Este plano aponta para
> `compras.gruposkytech.com`, da organizacao. O projeto passou a ser tocado no
> repositorio pessoal (`github.com/Kaique-o/dashboard-v2`) e publica em
> `https://dashboard-v2-b2x.pages.dev`. Nao seguir as instrucoes de dominio
> daqui; o valor vigente esta no `.env.example` e e conferido por
> `scripts/validate.js`. A parte de filtros globais e Skyler continua valida.

## dominio

valor canonico:

```text
https://compras.gruposkytech.com
```

variavel obrigatoria em producao:

```text
APP_URL=https://compras.gruposkytech.com
```

checklist externo:

- adicionar o dominio customizado ao projeto Cloudflare Pages;
- confirmar DNS e TLS;
- autorizar `https://compras.gruposkytech.com/definir-senha.html` no Supabase Auth;
- testar login logout convite e recuperacao de senha no dominio novo;
- redirecionar o endereco antigo depois da homologacao.

## filtros globais

ordem visual padrao:

1. macrogrupo;
2. curva;
3. marca;
4. busca.

as opcoes sao retornadas por `public.get_filtros_compras_opcoes()` e o filtro e aplicado por `public.filtro_dimensoes_compras(...)` dentro das nove RPCs.

aplicar:

```text
supabase/migrations/20260719120000_dominio_filtros_globais_skyler.sql
```

validar:

```text
supabase/tests/04_smoke_filtros_globais.sql
```

## skyler

configuracao publica:

```text
SKYLER_API_URL=/api/skyler/chat
SKYLER_TIMEOUT_MS=30000
```

contrato de requisicao:

```json
{
  "mensagem": "quais itens estao criticos",
  "conversa_id": null,
  "pagina": {
    "titulo": "Home | Compras",
    "caminho": "/index.html",
    "url": "https://compras.gruposkytech.com/index.html"
  },
  "contexto": {
    "filtros": {
      "macrogrupo": "SMARTPHONES",
      "curva": "A",
      "marca": "SAMSUNG"
    }
  }
}
```

resposta aceita:

```json
{
  "conversa_id": "uuid-ou-id-do-backend",
  "mensagem": "resposta da skyler"
}
```

campos alternativos aceitos para a resposta: `resposta`, `reply` ou `content`.

nenhum token secreto do provedor de ia pode entrar no `window.__ENV__`.
