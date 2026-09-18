# operacao do etl horario

## contrato

- cada workflow inicia uma vez por hora
- os minutos sao exclusivos
- o limite global de producao deve ser 1
- o n8n grava no supabase usando service role
- o frontend nunca consulta o n8n

## configuracao obrigatoria

aplique as variaveis do arquivo `.env.example` no processo real do n8n

para docker compose use `docker-compose.override.yml.example` como referencia

apos reiniciar o n8n confirme no log de inicializacao que o limite de concorrencia foi carregado

## homologacao

1. importe os 14 workflows desativados
2. configure as variaveis sankhya e supabase
3. execute manualmente um workflow por vez
4. confira `public.logs_integracao`
5. confira a tabela canonica ou `public.integracao_snapshots`
6. meca a duracao
7. ative somente os fluxos aprovados

## alerta de fila

se a soma das duracoes ultrapassar 60 minutos a carga seguinte ficara na fila
isso protege a maquina mas deixa os dados atrasados
acompanhe `duracao_ms` e o horario da ultima execucao em `public.logs_integracao`
