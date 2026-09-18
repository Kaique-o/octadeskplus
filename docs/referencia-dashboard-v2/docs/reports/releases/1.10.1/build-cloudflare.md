# Validação do build Cloudflare — versão 1.10.1

## Falha recebida

O deploy encerrou durante `npm clean-install`, antes da execução de `npm run build`.

Erro identificado:

```text
ETIMEDOUT ao baixar tslib-2.8.1.tgz
host: packages.applied-caas-gateway1.internal.api.openai.org
```

## Causa raiz

O `package-lock.json` continha 296 URLs `resolved` apontando para um registry privado do ambiente em que o lockfile havia sido gerado. A Cloudflare Pages tentou acessar esse host privado e não conseguiu estabelecer conexão.

Não foi uma falha do JavaScript, do esbuild ou das variáveis do Supabase.

## Correções aplicadas

- substituição das 296 URLs privadas por `https://registry.npmjs.org/`;
- criação de `.npmrc` com registry público explícito;
- inclusão de retries de rede compatíveis com CI;
- criação de validação que bloqueia registries privados, locais ou diferentes do npm público;
- atualização da versão para `1.10.1`;
- documentação do procedimento de deploy.

## Validação executada

Instalação limpa equivalente à etapa da Cloudflare:

```bash
npm ci --offline --progress=false
```

Resultado: 242 pacotes instalados com sucesso.

Pipeline completo:

```bash
npm run check
```

Resultados:

- build: aprovado;
- validação estrutural: aprovada;
- Vitest: 4 arquivos e 7 testes aprovados;
- Playwright: 11 testes aprovados;
- referências a registry privado no lockfile: zero;
- referências ao registry público no lockfile: 296.

## Configuração da Cloudflare Pages

```text
Install command: npm ci
Build command: npm run build
Output directory: dist
Node version: 22
```

Variáveis mínimas:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
APP_URL=https://compras.gruposkytech.com
SKYLER_API_URL
SKYLER_TIMEOUT_MS
```
