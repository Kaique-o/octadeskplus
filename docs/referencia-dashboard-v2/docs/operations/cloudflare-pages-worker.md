# Cloudflare Pages Functions

O frontend chama somente o endpoint de mesma origem `/api/skyler/chat`.

A Function valida o token do usuario no Supabase antes de chamar o backend privado da Skyler. O bearer do Supabase nunca e encaminhado ao backend externo.

## Arquivos

- `functions/api/skyler/chat.js`
- `functions/api/health.js`
- `src/_routes.json`
- `wrangler.toml`
- `.dev.vars.example`

## Secrets e variaveis do projeto Pages

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SKYLER_UPSTREAM_URL`
- `SKYLER_API_TOKEN`
- `SKYLER_API_HEADER`
- `SKYLER_TIMEOUT_MS`

`SKYLER_API_TOKEN` deve ser configurado como secret e nunca pode aparecer no build ou no Git.

## Validacao

```bash
npm run check:cloudflare
npm run build
npx wrangler pages dev dist
```

## Health check de deploy

`GET /api/health` retorna a versao do projeto, branch e commit informados pelo Cloudflare Pages. O valor precisa coincidir com `package.json`.
