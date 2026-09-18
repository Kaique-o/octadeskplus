# relatorio de correcoes 1.10.17

data 2026-07-30

## escopo corrigido

### supabase

- adicionada `20260719130000_normalizar_fn_auth_perfil_texto.sql`
- a migration detecta o retorno legado enum de `fn_auth_perfil`
- remove apenas as policies dependentes conhecidas
- recria a funcao retornando `text`
- restaura policies seguras de usuario parametros e preferencias
- em banco limpo a migration nao cria objetos fora de ordem
- a conversao de `usuarios_perfis.perfil` agora remove o default enum antes da mudanca de tipo e restaura o default texto
- mantida a migration de ETL horario com tabelas canonicas snapshots logs idempotencia RLS e derivacao de rupturas
- adicionados preflight somente leitura e smoke test da compatibilidade

### n8n

- 14 workflows com Schedule Trigger
- cada workflow executa uma vez por hora
- minutos exclusivos 01 05 09 13 17 21 25 29 33 37 41 45 49 53
- nenhum webhook ou proxy para o frontend
- todos gravam na RPC `ingest_dashboard_dataset`
- exemplo de Docker Compose com `N8N_CONCURRENCY_PRODUCTION_LIMIT=1`
- variaveis obrigatorias documentadas sem segredos
- workflows permanecem desativados para homologacao

### frontend

- nenhuma URL ou rota de n8n encontrada em `src`
- as nove telas usam somente RPCs do Supabase pela camada unica de dados
- service role nao e utilizada no frontend

### cloudflare

- Pages Functions versionadas junto do projeto
- `/api/health` atualizado para `1.10.17`
- script `check:cloudflare:deployed` compara o deploy real com a versao do projeto
- Skyler valida a sessao no Supabase e usa segredo separado no Worker

## validacoes executadas

- `node scripts/check-security.js`
- `node scripts/validate-n8n-dashboard-c.mjs`
- `node scripts/validate-data-architecture.mjs`
- `node scripts/validate-cloudflare.mjs`
- `node scripts/test-cloudflare-worker.mjs`
- `node --check` em JavaScript MJS e CJS
- validacao de 33 arquivos JSON
- validacao estrutural de 19 arquivos SQL
- verificacao de ausencia das credenciais expostas no fluxo de exemplo

## resultados

- 11 migrations exigidas pelo validador
- 14 workflows horarios
- 14 minutos exclusivos
- concorrencia global 1 exigida nos exemplos de runtime
- frontend sem n8n
- 9 RPCs publicas Supabase confirmadas
- worker smoke aprovado
- nenhum segredo conhecido encontrado

## nao executado neste ambiente

- migrations no Supabase remoto
- reset real de Supabase local
- importacao e ativacao no n8n remoto
- aplicacao da variavel de concorrencia no container real
- deploy Cloudflare real
- build Vitest Playwright e Lighthouse

`npm ci` foi tentado e bloqueado pelo registry do ambiente com 404 para `zod@3.25.76`.

## ordem operacional

consulte `docs/implantacao/ORDEM_APLICACAO_1.10.17.md`
