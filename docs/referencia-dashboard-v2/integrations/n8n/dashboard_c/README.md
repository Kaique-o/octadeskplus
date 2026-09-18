# integracao n8n dashboard c

os 14 workflows executam uma vez por hora em minutos diferentes e gravam no supabase

o frontend nao chama webhook do n8n

## protecao de concorrencia

configure no container ou servico do n8n

```env
N8N_CONCURRENCY_PRODUCTION_LIMIT=1
EXECUTIONS_DATA_SAVE_ON_SUCCESS=none
EXECUTIONS_DATA_PRUNE=true
EXECUTIONS_DATA_MAX_AGE=168
GENERIC_TIMEZONE=America/Sao_Paulo
```

com o limite 1 o n8n coloca execucoes sobrepostas na fila em vez de rodar consultas sankhya simultaneamente

os minutos sao 01 05 09 13 17 21 25 29 33 37 41 45 49 e 53

## variaveis obrigatorias

```text
SANKHYA_X_TOKEN
SANKHYA_CLIENT_ID
SANKHYA_CLIENT_SECRET
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

service role fica somente no n8n e nunca no frontend

## implantacao

1 aplique todas as migrations do supabase
2 configure as variaveis do n8n
3 configure o limite global de concorrencia 1
4 importe os 14 jsons
5 execute manualmente um por vez
6 confira logs_integracao no supabase
7 ative os fluxos depois da homologacao

## limite operacional

os 14 workflows precisam terminar em menos de 60 minutos somados para manter uma carga completa por hora
se a soma passar de 60 minutos o limite global 1 vai criar fila e a carga seguinte atrasara
