# correcao do pacote 1.10.17

data 2026-07-30

## corrigido

- migration `20260719130000_normalizar_fn_auth_perfil_texto.sql` incluida
- conversao de `usuarios_perfis.perfil` agora remove o default enum antes de converter e restaura o default texto depois
- validador de seguranca bloqueia a entrega se a migration de compatibilidade sumir
- smoke test `07_smoke_compatibilidade_perfil.sql` criado
- preflight somente leitura `00_preflight_producao.sql` criado
- 14 workflows horarios mantidos com minutos exclusivos
- exemplo de docker compose fixa concorrencia global do n8n em 1
- variaveis obrigatorias do n8n documentadas sem valores secretos
- frontend validado sem acesso ao n8n
- worker cloudflare alinhado com a versao 1.10.17
- verificador de deploy `/api/health` adicionado

## nao executado neste ambiente

- aplicacao das migrations no supabase remoto
- importacao dos workflows no n8n remoto
- reinicio do container n8n com a variavel de concorrencia
- deploy cloudflare real
- reset local do supabase por ausencia de docker supabase cli e psql
- build completo por indisponibilidade das dependencias npm neste ambiente
