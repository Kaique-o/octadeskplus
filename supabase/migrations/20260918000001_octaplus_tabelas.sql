-- =====================================================================
-- Octadesk Plus — schema `octaplus`, dentro do mesmo banco do metrics.
--
-- O metrics é o CRM (clientes, vendas, créditos, curvas, alertas, conversas).
-- Este schema só LÊ as tabelas de `public` e nunca escreve nelas.
-- Empresa única: usuários e permissões vêm do metrics (`public.has_permission`).
--
-- PostgREST precisa expor o schema: em Supabase gerenciado, Settings > API >
-- Exposed schemas; em self-hosted, PGRST_DB_SCHEMAS=public,storage,graphql_public,octaplus.
-- =====================================================================

create extension if not exists pgcrypto;
create schema if not exists octaplus;
grant usage on schema octaplus to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type octaplus.fonte_gatilho as enum ('metrics', 'octadesk', 'webhook');

create type octaplus.tipo_gatilho as enum (
  -- metrics (detectores SQL)
  'orcamento_sem_compra', 'pediu_orcamento', 'conversa_classificada', 'venda_faturada', 'venda_cancelada',
  'alerta_comportamento', 'mudanca_curva', 'credito_disponivel', 'sem_compra',
  -- Octadesk (webhooks de conversa)
  'octa_conversa_encerrada', 'octa_conversa_atribuida', 'octa_nova_mensagem',
  -- qualquer sistema (POST externo, inclusive as campanhas do metrics)
  'webhook_externo'
);

create type octaplus.tipo_acao as enum (
  'enviar_template', 'enviar_mensagem', 'nota_interna', 'aplicar_tags', 'campo_conversa', 'transferir_fila'
);

create type octaplus.unidade_tempo as enum ('minutos', 'horas', 'dias');
create type octaplus.status_execucao as enum ('pendente', 'executando', 'sucesso', 'ignorado', 'erro');

-- ---------------------------------------------------------------------
-- Configuração geral (uma linha só)
-- ---------------------------------------------------------------------
create table octaplus.configuracao (
  id                   boolean primary key default true check (id),
  fuso                 text not null default 'America/Sao_Paulo',
  -- mesmo formato do app original: perDay["0".."6"] (0 = domingo) com lista de janelas
  horario_comercial    jsonb not null default '{"perDay":{
    "0":{"enabled":false,"windows":[{"start":"09:00","end":"18:00"}]},
    "1":{"enabled":true,"windows":[{"start":"08:00","end":"18:00"}]},
    "2":{"enabled":true,"windows":[{"start":"08:00","end":"18:00"}]},
    "3":{"enabled":true,"windows":[{"start":"08:00","end":"18:00"}]},
    "4":{"enabled":true,"windows":[{"start":"08:00","end":"18:00"}]},
    "5":{"enabled":true,"windows":[{"start":"08:00","end":"18:00"}]},
    "6":{"enabled":false,"windows":[{"start":"08:00","end":"12:00"}]}}}'::jsonb,
  numero_envio_padrao  text,                               -- número do Octadesk usado quando a ação não escolhe
  emails_alerta        text[] not null default '{}',
  -- no máximo 1 mensagem por cliente dentro desta janela, somando todas as automações (0 desliga)
  limite_contato_horas integer not null default 24 check (limite_contato_horas >= 0),
  -- detectores só olham o que venceu nesta janela para trás (e nunca antes da ativação)
  janela_deteccao_horas integer not null default 48 check (janela_deteccao_horas between 1 and 720),
  atualizado_em        timestamptz not null default now()
);
insert into octaplus.configuracao default values;

-- ---------------------------------------------------------------------
-- Integração com o Octadesk (uma linha) + segredos (sem leitura pelo navegador)
-- ---------------------------------------------------------------------
create table octaplus.integracao_octadesk (
  id                      boolean primary key default true check (id),
  base_url                text,          -- ex.: https://o131180-252.api001.octadesk.services
  subdominio              text,          -- ex.: o131180-252 (header appsubdomain da API privada)
  agente_email            text,          -- header octa-agent-email (obrigatório na API pública)
  api_privada_ativa       boolean not null default false,   -- libera a ação "transferir para fila"
  status                  text not null default 'nao_configurado'
                          check (status in ('nao_configurado', 'validando', 'conectado', 'erro')),
  ultimo_erro             text,
  validado_em             timestamptz,
  sincronizacao_pedida_em timestamptz,   -- botão "Sincronizar" do front; o n8n atende no próximo minuto
  sincronizado_em         timestamptz,
  -- os webhooks do Octadesk não são assinados: o segredo vai no caminho da URL cadastrada lá
  segredo_webhook         text not null default encode(gen_random_bytes(24), 'hex')
);
insert into octaplus.integracao_octadesk default values;

-- chaves: octadesk_api_key | octadesk_usuario | octadesk_senha | octadesk_tenant | octadesk_jwt
create table octaplus.segredos (
  chave         text primary key,
  valor         text not null,
  expira_em     timestamptz,
  atualizado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Catálogos sincronizados do Octadesk (o front lê daqui, não do Octadesk)
-- ---------------------------------------------------------------------
create table octaplus.octa_numeros (
  id              text primary key,
  nome            text,
  numero          text not null unique,     -- formato internacional, como o /chat/numbers devolve
  rotulo          text,                     -- editável no painel ("Triagem")
  ativo           boolean not null default true,
  sincronizado_em timestamptz not null default now()
);

create table octaplus.octa_templates (
  id              text primary key,
  nome            text not null,
  status          text,                     -- pending | approved | rejected
  categoria       text,
  habilitado      boolean,
  componentes     jsonb not null default '[]'::jsonb,
  variaveis       text[] not null default '{}',   -- chaves aceitas em send-template variables[].key
  corpo           text,                            -- texto do componente BODY, para pré-visualização
  sincronizado_em timestamptz not null default now()
);

create table octaplus.octa_grupos (
  id              text primary key,
  nome            text not null,
  sincronizado_em timestamptz not null default now()
);

create table octaplus.octa_tags (
  id              text primary key,
  nome            text not null,
  sincronizado_em timestamptz not null default now()
);

-- tipo_de_entrega do contato -> fila. '*' é o destino quando o tipo não bate com nenhuma linha.
create table octaplus.mapa_filas (
  tipo_entrega text primary key,
  grupo_id     text,        -- id de octa_grupos (sem FK: o catálogo é recarregado a cada sincronização)
  rotulo       text
);

-- ---------------------------------------------------------------------
-- Automações
-- ---------------------------------------------------------------------
create table octaplus.automacoes (
  id                 uuid primary key default gen_random_uuid(),
  nome               text not null,
  ativa              boolean not null default false,
  ativa_desde        timestamptz,       -- detectores ignoram o que venceu antes disto (sem disparo em massa no histórico)
  arquivada_em       timestamptz,
  fonte              octaplus.fonte_gatilho not null,
  gatilho            octaplus.tipo_gatilho not null,
  -- dias, horas, padroes[], curva_de, curva_para, etapas[] ... (depende do gatilho)
  parametros         jsonb not null default '{}'::jsonb,
  -- {ativas: bool, modo: 'todas'|'qualquer', lista: [{campo, operador, valor}]} sobre os dados do evento
  condicoes          jsonb not null default '{}'::jsonb,
  respeitar_horario  boolean not null default true,
  atraso_valor       integer not null default 0 check (atraso_valor >= 0),
  atraso_unidade     octaplus.unidade_tempo not null default 'minutos',
  campo_telefone     text,              -- webhook externo: caminho do telefone no payload (ex.: contact.phone)
  segredo_webhook    text not null default encode(gen_random_bytes(24), 'hex'),
  payload_exemplo    jsonb,             -- primeiro POST recebido, para montar campos e variáveis
  criado_por         uuid,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),
  constraint fonte_combina_com_gatilho check (
    case fonte
      when 'webhook'  then gatilho = 'webhook_externo'
      when 'octadesk' then gatilho::text like 'octa\_%'
      else gatilho <> 'webhook_externo' and gatilho::text not like 'octa\_%'
    end)
);
create index on octaplus.automacoes (fonte, gatilho) where ativa and arquivada_em is null;

create table octaplus.automacao_acoes (
  id             uuid primary key default gen_random_uuid(),
  automacao_id   uuid not null references octaplus.automacoes(id) on delete cascade,
  posicao        integer not null,
  tipo           octaplus.tipo_acao not null,
  -- enviar_template: {numero, template_id, variaveis:{chave:'{{cliente.primeiro_nome}}'}, conversa_aberta, atribuir_automatico}
  -- enviar_mensagem | nota_interna: {texto}
  -- aplicar_tags: {tags:[{id,nome}]}
  -- campo_conversa: {campo_id, titulo, tipo, valor}
  -- transferir_fila: {grupo_id} ou {usar_mapa_filas: true}
  config         jsonb not null default '{}'::jsonb,
  espera_valor   integer not null default 0 check (espera_valor >= 0),   -- depois da ação anterior
  espera_unidade octaplus.unidade_tempo not null default 'minutos',
  unique (automacao_id, posicao)
);

-- ---------------------------------------------------------------------
-- Execução: evento -> execuções (uma por ação) -> envios
-- ---------------------------------------------------------------------
create table octaplus.eventos (
  id                  uuid primary key default gen_random_uuid(),
  automacao_id        uuid not null references octaplus.automacoes(id) on delete cascade,
  dedupe_key          text not null,
  client_id           uuid,          -- public.clients.id (sem FK: o metrics é outro domínio)
  octadesk_contact_id text,
  conversa_id         text,          -- roomKey, quando o evento nasceu numa conversa
  telefone            text,          -- E.164 resolvido
  nome                text,
  dados               jsonb not null default '{}'::jsonb,   -- contexto para condições e variáveis
  situacao            text not null default 'agendado' check (situacao in ('agendado', 'ignorado')),
  motivo              text,          -- por que foi ignorado
  recebido_em         timestamptz not null default now(),
  unique (automacao_id, dedupe_key)
);
create index on octaplus.eventos (recebido_em desc);
create index on octaplus.eventos (automacao_id, recebido_em desc);

create table octaplus.execucoes (
  id            uuid primary key default gen_random_uuid(),
  automacao_id  uuid not null references octaplus.automacoes(id) on delete cascade,
  acao_id       uuid not null references octaplus.automacao_acoes(id) on delete cascade,
  evento_id     uuid not null references octaplus.eventos(id) on delete cascade,
  agendado_para timestamptz not null,
  status        octaplus.status_execucao not null default 'pendente',
  tentativas    integer not null default 0,
  travado_em    timestamptz,
  resultado     jsonb,
  erro          text,
  codigo_erro   text,              -- errorCode do Octadesk/Meta, ou motivo interno (conversa_aberta...)
  concluido_em  timestamptz,
  criado_em     timestamptz not null default now()
);
create index execucoes_vencidas_idx on octaplus.execucoes (agendado_para) where status = 'pendente';
create index on octaplus.execucoes (automacao_id, concluido_em desc);

-- cada mensagem que saiu de fato: base do limite de contato e da atribuição (respondeu / comprou)
create table octaplus.envios (
  id            uuid primary key default gen_random_uuid(),
  execucao_id   uuid references octaplus.execucoes(id) on delete set null,
  automacao_id  uuid references octaplus.automacoes(id) on delete set null,
  client_id     uuid,
  telefone      text,
  tipo          text not null check (tipo in ('template', 'mensagem', 'nota')),
  template_id   text,
  numero_origem text,
  room_key      text,
  message_key   text,
  enviado_em    timestamptz not null default now(),
  respondeu_em  timestamptz,
  comprou_em    timestamptz,
  valor_compra  numeric
);
create index on octaplus.envios (telefone, enviado_em desc);
create index on octaplus.envios (client_id, enviado_em desc);

-- quem não recebe nada, de nenhuma automação
create table octaplus.nao_perturbe (
  id        uuid primary key default gen_random_uuid(),
  telefone  text unique,     -- E.164
  client_id uuid unique,
  motivo    text,
  criado_por uuid,
  criado_em timestamptz not null default now(),
  check (telefone is not null or client_id is not null)
);

-- ---------------------------------------------------------------------
-- API pública (aba "API"): chaves br_live_* e registro de chamadas
-- ---------------------------------------------------------------------
create table octaplus.chaves_api (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  prefixo      text not null,
  hash         text not null unique,    -- sha256 do segredo; o segredo em si nunca é guardado
  usado_em     timestamptz,
  revogada_em  timestamptz,
  criado_por   uuid,
  criado_em    timestamptz not null default now()
);

create table octaplus.chamadas_api (
  id        bigint generated always as identity primary key,
  chave_id  uuid references octaplus.chaves_api(id) on delete set null,
  endpoint  text not null,
  ok        boolean not null,
  criado_em timestamptz not null default now()
);
