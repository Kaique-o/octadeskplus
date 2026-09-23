# Plano — Octadesk Plus: banco e backend com o metrics como CRM

## Contexto

O Octadesk Plus (`clones/octadeskplus/`, antes `clones/metrics/bridge/`) tem front pronto em modo demonstração, um schema genérico
(Pipedrive/webhook → Octadesk) e fluxos n8n. A decisão agora é que **o CRM é o metrics** — o clone do Ponto B
Metrics, que já é o CRM da Skytech (clientes do Sankhya, vendas, créditos, curvas ABC, alertas de
comportamento, conversas do Octadesk e a análise de IA delas). O Octadesk Plus deixa de ser um produto genérico
e vira **o motor de réguas de WhatsApp em cima dos dados do metrics, enviando pelo Octadesk** — substituindo o
Bridge da Favo, que hoje recebe as campanhas do metrics por webhook.

**Decisões tomadas:** banco no Supabase (instância a confirmar — ver Pendências); **uma empresa só** (usuários
e permissões vêm do metrics); **Pipedrive removido**; **transferir para fila entra como ação opcional** via API
privada do Octadesk.

## O que os estudos mostraram

**metrics** — 71 tabelas. As que importam: `clients` (80 mil; telefone, curva, dias sem compra, vendedor,
`octadesk_contact_id`), `client_octadesk_contacts` (telefone em `55` + número), `sales` (837 mil itens; `status`
ativa/cancelada/excluida, `numero_unico`), `client_credits`, `client_behavior_alerts` (padrões como
`primeira_recompra_risco`, `cadencia_rompida`, `desaceleracao`), `client_curve_history`, `conversations` e
`messages` (Octadesk), `skyler_analyses` (IA: `orcamento_enviado`, `etapa_comercial`), `campaigns` (já
disparam para um webhook com header `X-Bridge-Secret`). Auth: `profiles`, `user_roles`, `has_permission()`.
- **Não existe tabela de orçamento** — só a classificação da IA em `skyler_analyses`.
- **Nenhuma tabela publica eventos**; as rotinas (curvas, alertas, stats) são recalculadas por cron.
- **Telefones em formatos misturados**; chave confiável entre bases: `clients.octadesk_contact_id`.

**Octadesk** — documentação oficial em developers.octadesk.com cruzada com os fluxos n8n em produção:

| Precisa | Como (API pública, `X-API-KEY` + `octa-agent-email`) |
|---|---|
| Validar chave | `GET /auth/check` |
| Números de envio | `GET /chat/numbers` → `[{id,name,number}]` |
| Templates e variáveis | `GET /chat/templates-message?filters…status eq approved` → `components[].variables[].key` |
| Enviar template (abre conversa) | `POST /chat/send-template` com `content.templateMessage.{id, variables:[{key,value}]}`; devolve `{messageKey, roomKey}` ou `error/errorCode` da Meta |
| Mensagem / nota interna | `POST /chat/{id}/messages` com `type` public/internal (public só dentro da janela de 24h — `windowExpiresAt`) |
| Conversa aberta do contato | `GET /chat?filters…contact.phoneContacts.number eq …&status eq talking` |
| Tags / campos da conversa | `POST /chat/{id}/tags`, `PUT /chat/{id}/custom-fields` |
| Contatos | `GET|POST|PATCH /contacts` (busca por `phoneContacts.number`) |
| Filas / tags (catálogo) | `GET /tickets/groups`, `GET /tickets/tags` |
| **Transferir para fila** | **Só API privada**: `PUT us-east1-001.prod…/chat/rooms/{id}/group/{groupId}` com JWT de `nucleus-auth/auth` (usuário + senha + tenantId) |
| Eventos de conversa | Webhooks **não documentados publicamente**, mas em uso: `room.after-close`, `room.after-set-agent`, `room.after-insert-message`, envelope `{domain, event, data:<chat>}`, **sem autenticação** |

Não documentado: rate limit, fechar conversa, lista de agentes. Os JSONs do n8n do metrics têm **segredos em
texto puro** (login Octadesk, X-API-KEY, Sankhya, Ploomes) — tratar antes de tudo.

## Arquitetura

```
metrics (Supabase)                         octaplus (schema novo, mesmo banco)
 clients, sales, alerts, curves,  ──SQL──▶  detectores (pg_cron, 5 min) ──▶ eventos ──▶ execucoes (fila)
 credits, skyler_analyses                                                          │
                                                                                   ▼
Octadesk webhooks ──▶ n8n "Entrada" ──▶ registrar_evento()          n8n "Executor" (1 min) ──▶ Octadesk
metrics campanhas / sistemas externos (X-Bridge-Secret) ──▶ n8n "Entrada"          API pública + privada
```

- **Regra de ouro mantida:** detecção de evento, condições, horário comercial, deduplicação, limites e fila
  ficam no Postgres; o n8n só faz I/O com o Octadesk.
- **Leitura do metrics é só leitura.** O schema `octaplus` nunca escreve nas tabelas do metrics; lê por views
  e funções `security definer`.
- **Substitui o Bridge da Favo sem mexer no metrics:** a Entrada aceita o mesmo contrato (`X-Bridge-Secret`);
  trocar a `webhook_url` das campanhas do metrics é a migração.

## Banco — schema `octaplus`

Substitui as duas migrations anteriores do projeto (ainda não aplicadas em lugar nenhum). Reaproveita a lógica já
testada: `normalize_phone_br`, `next_business_slot` (formato `perDay`), `match_conditions`, o trio
`ingest/claim/finish`, retentativa e `SKIP LOCKED` (migration `20260917000002_rls_e_funcoes.sql`, hoje no histórico do git do metrics).

| Tabela | Para quê |
|---|---|
| `configuracao` (1 linha) | horário comercial `perDay`, fuso, número de envio padrão, e-mails de alerta, **limite de contato** (ex.: máx. 1 mensagem por cliente a cada 24h entre todas as automações) |
| `integracao_octadesk` (1 linha) + `segredos` | base URL, subdomínio, `octa-agent-email`, status/último teste. Em `segredos` (sem policy de leitura): API key, login da API privada (usuário, senha, tenantId) e o JWT atual com validade |
| `octa_numeros`, `octa_templates`, `octa_grupos`, `octa_tags` | **catálogos sincronizados** do Octadesk; `octa_numeros` guarda o rótulo editável ("Triagem"); `octa_templates` guarda `variables` por componente |
| `mapa_filas` | `tipo_de_entrega` do contato → fila (Motoboy, Sedex, Ônibus, Retirada, Triagem) — hoje fixo no código do n8n |
| `automacoes` | nome, ativa, **fonte** (`metrics` \| `octadesk` \| `webhook`), **tipo de gatilho**, parâmetros (ex.: dias, padrão de alerta, curva de/para), condições, horário comercial, atraso |
| `automacao_acoes` | ordem, espera, tipo (`enviar_template`, `enviar_mensagem`, `nota_interna`, `aplicar_tags`, `campo_conversa`, `transferir_fila`), config (número, template, **variáveis mapeadas para campos do cliente**, política de conversa aberta) |
| `eventos` | automação, `client_id` (metrics), `octadesk_contact_id`, telefone normalizado, payload, `dedupe_key` único por automação |
| `execucoes` | a fila (igual ao `jobs` atual) + código de erro da Meta/Octadesk |
| `envios` | cada mensagem enviada: `roomKey`, `messageKey`, cliente, template — base para medir **resposta e venda depois do envio** (mesmo modelo de atribuição das campanhas do metrics) |
| `nao_perturbe` | telefones/clientes que não recebem nada (opt-out) |
| `cursores` | marca d'água de cada detector (último `sales.id`, último alerta lido…) |
| `chaves_api`, `chamadas_api` | a aba API (`/v1/format`), como hoje |

**Gatilhos do metrics (detectores SQL, MVP):**

| Gatilho | De onde vem | `dedupe_key` |
|---|---|---|
| Orçamento enviado sem compra em N dias | `skyler_analyses.orcamento_enviado` + ausência de `sales` ativa depois | `orc:{conversa}` |
| Pediu orçamento e não recebeu | `skyler_analyses.etapa_comercial = 'Cliente pediu orçamento'` | `pedorc:{conversa}` |
| Conversa encerrada com etapa X | `skyler_analyses` (ex.: pagamento → agradecimento) | `enc:{conversa}` |
| Venda faturada | novo `sales.numero_unico` ativo | `venda:{numero_unico}` |
| Venda cancelada | `sales.status` → `cancelada` | `canc:{numero_unico}` |
| Alerta de comportamento (padrão escolhido) | `client_behavior_alerts` | `alerta:{cliente}:{padrão}:{semana}` — os alertas são refeitos todo dia |
| Mudou de curva (de/para) | `client_curve_history` | `curva:{id}` |
| Crédito disponível | `client_credits` | `cred:{cliente}:{dtref}` |
| Sem compra há N dias | `clients.dt_ultima_compra` | `semcompra:{cliente}:{N}:{mês}` |

Mais: **webhook externo** (como hoje) e **eventos do Octadesk** (conversa encerrada, atribuída, nova mensagem).

**Telefone e contato:** função `resolver_contato(client_id)` — prefere `client_octadesk_contacts` (55 +
número) e `octadesk_contact_id`; cai para `clients.telefone` normalizado. Sem telefone válido = evento
descartado com motivo, visível nas estatísticas.

**Permissões:** RLS do `octaplus` usa o `has_permission()` do metrics com recursos novos (`octaplus.automacoes`,
`octaplus.integracao`); dono/superadmin do metrics veem tudo.

## Backend — n8n

| Fluxo | O que faz |
|---|---|
| **Entrada** | webhook externo (`X-Bridge-Secret` ou `?secret=`) **e** webhooks do Octadesk (segredo no caminho da URL, já que o Octadesk não assina) → `registrar_evento()` |
| **Executor** (1 min) | `claim_due_jobs` → ações no Octadesk → `finish_job`. `send-template` com `variables:[{key,value}]`; checa conversa aberta e janela de 24h; mensagem pública só dentro da janela; mapeia `errorCode` da Meta (sem crédito, número inválido) para erro definitivo |
| **Token Octadesk** | mantém o JWT da API privada em `octaplus.segredos` (não mais em Data Table do n8n); renova ao falhar |
| **Catálogos** (1 h + botão "Sincronizar") | números, templates aprovados, filas e tags → tabelas `octa_*`; o front passa a ler do banco, não do n8n em tempo real |
| **API pública `/v1/format`** | como hoje |

Sai: aniversários (o metrics não tem data de nascimento), Pipedrive, busca ao vivo de pipelines/campos.
Detectores rodam por **pg_cron** no próprio banco (`octaplus.detectar_eventos()` a cada 5 min).

## Front (o que muda)

- Configurações › Integrações: só o card do Octadesk (API key, e-mail do agente, login da API privada opcional,
  botão sincronizar) + números com rótulo, templates e mapa de filas; horário comercial continua.
- Wizard: fontes **metrics**, **Octadesk** e **webhook externo**; variáveis do template ligadas a campos do
  cliente (nome, curva, último pedido, vendedor…); ações novas (tags, campo, transferir fila).
- Empresa e Membros: somem as telas próprias — usuários vêm do metrics (Membros vira lista de leitura).
- Home: estatísticas passam a mostrar também **respostas e vendas depois do envio** (tabela `envios`).

## Fases

1. **Segurança** — rotacionar os segredos expostos nos JSONs do n8n do metrics (login e API key do Octadesk,
   Sankhya, Ploomes, chaves do metrics).
2. **Banco** — migrations do schema `octaplus` + stub das tabelas do metrics para testes; detectores do MVP.
3. **Octadesk** — catálogos, executor com variáveis, nota, tags, campo, transferência com JWT.
4. **Front** — Integrações, wizard e Membros como acima; modo demonstração atualizado.
5. **Piloto** — recriar "Orçamentos de ontem que não fecharam" (hoje no Bridge da Favo) e rodar em paralelo com
   envio para um número de teste; comparar contagens com a telemetria da Favo; depois apontar as campanhas do
   metrics para o Octadesk Plus e desligar o Bridge.

## Verificação

- **SQL (PGlite):** migrations do zero + stub das tabelas do metrics; cada detector gera o evento certo e não
  duplica na segunda rodada; limite de contato por cliente; `nao_perturbe`; horário comercial; RLS por permissão.
- **Executor (HTTP simulado):** template com variáveis, conversa aberta (3 políticas), fora da janela de 24h,
  erro Meta definitivo × 5xx/429 retentável, JWT expirado → renova e repete a transferência.
- **Octadesk real (leitura):** `GET /auth/check`, `/chat/numbers`, `/chat/templates-message`, `/tickets/groups`.
- **Envio real controlado:** um template para número interno de teste; conferir `roomKey` na tabela `envios`.
- **Ponta a ponta:** detector → evento → execução → mensagem no Octadesk → estatística na home.

## Status (18/09/2026)

| Fase | Situação | Onde |
|---|---|---|
| 1. Segurança | **Pendente — depende de você**: rotacionar os segredos expostos nos JSONs do n8n do metrics | `metrics/n8n/ativos|inativos` |
| 2. Banco | Pronto e testado (46 testes em Postgres embarcado com stub do metrics) | `supabase/migrations`, `supabase/tests` |
| 3. Octadesk | Pronto e testado (25 testes com o Octadesk simulado) | `n8n/codigo`, `n8n/fluxos`, `n8n/tests` |
| 4. Front | Ligado ao Supabase próprio (`gsndcxdjwblsukxjzwhi`) desde 23/09/2026; falta o primeiro login | `web/src` |
| 5. Piloto | Pendente — precisa do Supabase e de um número de teste | — |

Desvios em relação ao desenho: os detectores usam **janela de tempo + deduplicação** em vez da tabela
`cursores` (mais simples e já cobre o caso); o gatilho de etapa da IA chama-se `conversa_classificada`
para não confundir com `octa_conversa_encerrada`; Empresa e Usuários voltaram como abas de Configurações (21/09/2026): Empresa grava em `configuracao`,
Usuários lista os do metrics só para leitura (`listar_usuarios`); a aba **Não perturbe** continua; o
botão "Sincronizar" e a validação vão ao n8n **pelo banco** (`pedir_sincronizacao`), sem o navegador chamar
o n8n direto.

Multiempresa (24/09/2026): as empresas estão no banco (`octaplus.empresas`) e cada linha do schema tem `empresa_id`,
com RLS pela empresa do header `x-empresa` + vínculo em `octaplus.membros` (`ver`/`editar`). O dono da plataforma
gerencia empresas e usuários em Configurações › Owner; contas são criadas pelo banco no Auth. O motor é por empresa:
o segredo do webhook do Octadesk escolhe a empresa, cada job leva as credenciais da própria empresa e a manutenção do
n8n roda uma empresa por item. Empresa inativa não recebe eventos nem executa. O módulo adm e o código Konami saíram.
Os detectores do metrics continuam lendo `public.*` compartilhado (hoje vazio no Supabase próprio).

A análise original do Bridge da Favo (rotas, calibragem com a conta real) está em
[docs/analise-bridge-favo.md](docs/analise-bridge-favo.md).

## Pendências (dependem de você)

- **Integração com o metrics (Configurações › Integrações)**: grava URL + chave por empresa (chave em `segredos`,
  `metrics_chave`) e fica "pendente". Falta o motor usar essa conexão para ler clientes/vendas do metrics nos
  detectores (hoje eles leem o `public.*` local). Trello, Salesforce, HubSpot etc. só aparecem como "Em breve".

- **Supabase** (23/09/2026): projeto próprio `gsndcxdjwblsukxjzwhi`, **sem o metrics**. Instalado com
  `supabase/instalar-projeto-proprio.sql` (base com as tabelas do metrics vazias + migrations + pg_cron) e schema
  `octaplus` exposto no PostgREST. Detectores de vendas/créditos/curvas ficam sem dados até alguém alimentar essas
  tabelas (ou ligar o metrics por `postgres_fdw`); gatilhos de conversa e webhook externo funcionam.
- Criar o primeiro usuário em Authentication (vira dono) e rotacionar a senha do banco e a secret key que
  passaram pelo chat.
- Número de teste para os envios do piloto e o usuário do Octadesk para `octa-agent-email`.
- Quem cadastra no Octadesk a URL dos webhooks de conversa (é configuração da conta; não há API pública).
