# Validacao da integracao horaria

Data: 2026-07-30
Versao: 1.10.17

## Resultado executivo

| Contrato                          | Resultado no codigo                                      |
| --------------------------------- | -------------------------------------------------------- |
| 14 fluxos uma vez por hora        | aprovado                                                 |
| horarios desencontrados           | aprovado                                                 |
| concorrencia global n8n igual a 1 | configuracao documentada e validada                      |
| gravacao no Supabase              | aprovado no contrato estatico                            |
| frontend sem acesso ao n8n        | aprovado                                                 |
| frontend usando RPCs Supabase     | aprovado                                                 |
| Pages Function versionada         | aprovada                                                 |
| Worker implantado no dominio      | nao verificavel neste ambiente                           |
| Supabase zerado com migrations    | testes 05 06 e 07 criados, nao executados neste ambiente |
| build e testes npm                | nao executados por falha do registry do ambiente         |

## N8N

Todos os workflows:

- iniciam com `Kaique - `;
- possuem um unico Schedule Trigger;
- nao possuem Webhook ou Respond to Webhook;
- autenticam no Sankhya;
- executam `DbExplorerSP.executeQuery`;
- gravam em `ingest_dashboard_dataset`;
- entram desativados para homologacao;
- possuem timeout de 600 segundos;
- usam variaveis e nao credenciais literais.

A configuracao `N8N_CONCURRENCY_PRODUCTION_LIMIT=1` e obrigatoria no processo/container do n8n. Sem ela os minutos diferentes nao impedem sobreposicao quando uma consulta ultrapassa o intervalo seguinte.

## Supabase

A migration `20260719130000_normalizar_fn_auth_perfil_texto.sql` corrige a divergencia de retorno enum para text sem apagar dados e restaura as policies seguras. A migration `20260730022000_integracao_horaria_n8n.sql` adiciona:

- `estoque_produto_diario`;
- `integracao_snapshots`;
- reconciliacao de `logs_integracao`;
- RPCs de ingestao faltantes;
- dispatcher `ingest_dashboard_dataset`;
- idempotencia por execution ID;
- RLS da tabela nova;
- correcao multiempresa dos follow-ups.

Os testes `06_smoke_integracao_horaria.sql` e `07_smoke_compatibilidade_perfil.sql` validam:

- ingestao do estoque diario;
- derivacao de rupturas;
- repeticao sem duplicidade;
- separacao dos follow-ups por empresa;
- persistencia dos snapshots diagnosticos;
- bloqueio da ingestao para `authenticated`.

## Frontend

A varredura de `src` nao encontrou URL ou rota de webhook n8n.

As nove telas consultam as RPCs Supabase pela camada unica `src/js/data/data-access.js`.

## Cloudflare

O projeto passou a versionar:

- `functions/api/skyler/chat.js`;
- `functions/api/health.js`;
- `src/_routes.json`;
- `wrangler.toml`;
- `.dev.vars.example`.

A Function valida o bearer no Supabase e usa um token separado para o upstream da Skyler.

A verificacao do dominio `compras.gruposkytech.com` falhou por ausencia de resolucao DNS no ambiente de auditoria. Portanto o codigo esta alinhado ao projeto, mas a implantacao real da Function nao foi confirmada.

## Limitacoes e riscos remanescentes

1. As 14 consultas precisam terminar em menos de 60 minutos somadas para manter a cadencia horaria. Caso contrario a fila cresce, embora a maquina permaneça protegida contra concorrencia.
2. Produtos, radar, sugestoes, estoque diario e fornecedores ainda usam `Todas` quando a query Sankhya nao entrega empresa. Isso persiste os dados, mas nao oferece granularidade real por empresa nesses datasets.
3. `budget_mensal.valor_orcado` permanece zero ate existir uma fonte oficial de orcamento no Sankhya.
4. Build, Vitest, Playwright e Lighthouse dependem de `npm ci`. O registry imposto pelo ambiente retornou 404 para `zod@3.25.76`.
5. O reset real do Supabase depende de Docker, Supabase CLI e psql, indisponiveis no ambiente atual.

## Acao de seguranca obrigatoria

O fluxo de exemplo utilizado como referencia continha credenciais Sankhya literais. Elas nao foram copiadas para o projeto, mas devem ser revogadas e recriadas antes da implantacao dos novos workflows. A simples remocao do JSON nao invalida uma credencial que ja foi exposta.
