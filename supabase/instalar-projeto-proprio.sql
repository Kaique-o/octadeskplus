-- Gerado por supabase/montar-instalacao.mjs; não editar à mão.
-- Instala o Octadesk Plus num Supabase próprio (sem o metrics).

-- agenda dos detectores, atribuição e limpeza
create extension if not exists pg_cron;

-- ===== base/base-projeto-proprio.sql =====
-- =====================================================================
-- Base para rodar o Octadesk Plus num Supabase próprio, sem o metrics.
-- Cria as tabelas e funções do metrics que o schema octaplus lê (vazias), com as mesmas colunas de
-- supabase/tests/stub-metrics.sql. Aplicar ANTES de supabase/migrations/*. No banco do metrics, não aplicar.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Usuários e permissões (o login é o Auth do próprio projeto)
-- ---------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('owner', 'superadmin', 'viewer');
exception when duplicate_object then null; end $$;

create table if not exists public.user_roles (id uuid primary key default gen_random_uuid(), user_id uuid not null, role public.app_role not null, profile_id uuid);
create table if not exists public.profiles (id uuid primary key, email text not null, full_name text);
create table if not exists public.access_profiles (id uuid primary key default gen_random_uuid(), name text not null unique);
create table if not exists public.access_profile_permissions (id uuid primary key default gen_random_uuid(), profile_id uuid not null, resource text not null, action text not null);

create or replace function public.has_role(_user_id uuid, _role public.app_role) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;
create or replace function public.has_permission(_user_id uuid, _resource text, _action text) returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(_user_id, 'owner') or public.has_role(_user_id, 'superadmin') or exists (
    select 1 from public.user_roles ur join public.access_profile_permissions p on p.profile_id = ur.profile_id
    where ur.user_id = _user_id and p.resource = _resource and p.action = _action) $$;

-- Usuário criado no Auth ganha perfil; o primeiro de todos vira dono, os demais entram sem acesso
-- (liberar depois com um perfil de acesso que tenha o recurso 'octaplus').
create or replace function public.ao_criar_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
    values (new.id, coalesce(new.email, ''), new.raw_user_meta_data ->> 'full_name')
    on conflict (id) do nothing;
  insert into public.user_roles (user_id, role)
    values (new.id, case when exists (select 1 from public.user_roles) then 'viewer' else 'owner' end::public.app_role);
  return new;
end $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users for each row execute function public.ao_criar_usuario();

-- ---------------------------------------------------------------------
-- Dados comerciais: vazios num projeto próprio; os detectores do metrics só não encontram nada.
-- Os gatilhos de conversa do Octadesk e o webhook externo funcionam normalmente.
-- ---------------------------------------------------------------------
create table if not exists public.salespeople (id uuid primary key default gen_random_uuid(), name text not null, octadesk_agent_id text);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(), name text not null, telefone text, octadesk_contact_id text,
  curva_cliente text, situacao_carteira text, tipo_entrega text, dt_ultima_compra date, faturamento_365_dias numeric,
  salesperson_id uuid, codigo_cliente integer);

create table if not exists public.client_octadesk_contacts (
  id uuid primary key default gen_random_uuid(), octadesk_contact_id text not null unique, client_id uuid,
  phone_country_code text, phone_number text, tipo_de_entrega text, updated_at timestamptz not null default now());

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(), client_id uuid, value numeric(12,2) not null, tipo_fiscal text not null,
  sale_date date not null default current_date, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), numero_unico integer, marca text, status text not null default 'ativa');

create table if not exists public.client_credits (
  id uuid primary key default gen_random_uuid(), client_id uuid, valor numeric, dtref timestamptz,
  created_at timestamptz not null default now());

create table if not exists public.client_behavior_alerts (
  id uuid primary key default gen_random_uuid(), client_id uuid not null, pattern text not null,
  severidade text not null default 'baixa', motivo text not null, dias_atraso integer, valor_risco numeric,
  gerado_em date not null default current_date, created_at timestamptz not null default now());

create table if not exists public.client_curve_history (
  id uuid primary key default gen_random_uuid(), client_id uuid not null, curva_de text, curva_para text,
  changed_at timestamptz not null default now());

create table if not exists public.skyler_analyses (
  id uuid primary key default gen_random_uuid(), conversation_octadesk_id text not null unique, conversation_number bigint,
  cliente_id text, cliente_nome text, cliente_telefone text, atendente_nome text, categoria_conversa text,
  etapa_comercial text, orcamento_enviado boolean, orcamento_enviado_em timestamptz,
  primeiro_pedido_orcamento_em timestamptz, ultimo_pedido_orcamento_em timestamptz, last_event text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(), octadesk_message_id text not null, conversation_octadesk_id text not null,
  time timestamptz, sent_by_type text);

-- Nada do public é lido direto pelo navegador: o octaplus lê por funções security definer.
alter table public.user_roles                 enable row level security;
alter table public.profiles                   enable row level security;
alter table public.access_profiles            enable row level security;
alter table public.access_profile_permissions enable row level security;
alter table public.salespeople                enable row level security;
alter table public.clients                    enable row level security;
alter table public.client_octadesk_contacts   enable row level security;
alter table public.sales                      enable row level security;
alter table public.client_credits             enable row level security;
alter table public.client_behavior_alerts     enable row level security;
alter table public.client_curve_history       enable row level security;
alter table public.skyler_analyses            enable row level security;
alter table public.messages                   enable row level security;

-- Meu perfil: cada um lê e renomeia só o próprio; o e-mail vem do Auth e não muda pelo navegador.
drop policy if exists proprio_ler on public.profiles;
create policy proprio_ler on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists proprio_renomear on public.profiles;
create policy proprio_renomear on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name) on public.profiles to authenticated;

revoke execute on function public.ao_criar_usuario() from public, anon, authenticated;

-- ===== migrations/20260918000001_octaplus_tabelas.sql =====
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

-- ===== migrations/20260918000002_octaplus_funcoes.sql =====
-- =====================================================================
-- Octadesk Plus — funções.
--   1. helpers (permissão, telefone, horário útil, condições)
--   2. contexto do cliente lido do metrics
--   3. registrar_evento: o funil único por onde todo evento passa
--   4. entradas: webhook externo e webhooks do Octadesk
--   5. detectores dos gatilhos do metrics
--   6. motor (chamado pelo n8n): pegar/concluir execuções, catálogos, token, atribuição
--   7. RPCs do painel e estatísticas
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Helpers
-- ---------------------------------------------------------------------

-- Permissões vêm do metrics: dono/superadmin sempre; perfis de acesso com recurso 'octaplus'.
create or replace function octaplus.pode(p_acao text) returns boolean
language sql stable security definer set search_path = public, octaplus as $$
  select auth.uid() is not null and public.has_permission(auth.uid(), 'octaplus', p_acao);
$$;

create or replace function octaplus.normalizar_telefone(bruto text) returns text
language plpgsql immutable as $$
declare d text := regexp_replace(coalesce(bruto, ''), '\D', '', 'g');
begin
  d := regexp_replace(d, '^0+', '');
  if length(d) in (10, 11) then d := '55' || d; end if;                            -- sem DDI
  if d !~ '^55' then return case when length(d) >= 8 then '+' || d end; end if;    -- internacional
  if length(d) = 12 and substr(d, 5, 1) ~ '[6-9]' then                              -- celular sem o nono dígito
    d := substr(d, 1, 4) || '9' || substr(d, 5);
  end if;
  if length(d) not in (12, 13) then return null; end if;
  return '+' || d;
end $$;

create or replace function octaplus.intervalo(p_valor integer, p_unidade octaplus.unidade_tempo) returns interval
language sql immutable as $$
  select make_interval(mins => coalesce(p_valor, 0) * case p_unidade when 'minutos' then 1 when 'horas' then 60 else 1440 end);
$$;

-- Próximo instante dentro do horário comercial (perDay 0..6, 0 = domingo, várias janelas por dia)
create or replace function octaplus.proximo_horario_util(p_em timestamptz) returns timestamptz
language plpgsql stable set search_path = octaplus as $$
declare c configuracao; local_ts timestamp; dia jsonb; w jsonb; ini time; fim time; i int;
begin
  select * into c from configuracao;
  if c.horario_comercial -> 'perDay' is null then return p_em; end if;
  local_ts := p_em at time zone c.fuso;
  for i in 0..14 loop
    dia := c.horario_comercial -> 'perDay' -> extract(dow from local_ts)::text;
    if coalesce((dia ->> 'enabled')::boolean, false) then
      for w in select value from jsonb_array_elements(coalesce(dia -> 'windows', '[]')) order by value ->> 'start' loop
        ini := (w ->> 'start')::time; fim := (w ->> 'end')::time;
        if local_ts::time < ini then return (local_ts::date + ini) at time zone c.fuso; end if;
        if local_ts::time < fim then return local_ts at time zone c.fuso; end if;
      end loop;
    end if;
    local_ts := (local_ts::date + 1)::timestamp;
  end loop;
  return p_em;
end $$;

-- condicoes: {ativas, modo: 'todas'|'qualquer', lista:[{campo:'cliente.curva', operador, valor}]}
create or replace function octaplus.atende_condicoes(p_condicoes jsonb, p_dados jsonb) returns boolean
language plpgsql immutable as $$
declare c jsonb; v text; ok boolean; acertos int := 0; total int := 0;
begin
  if not coalesce((p_condicoes ->> 'ativas')::boolean, false) then return true; end if;
  for c in select * from jsonb_array_elements(coalesce(p_condicoes -> 'lista', '[]')) loop
    continue when coalesce(c ->> 'campo', '') = '';
    total := total + 1;
    v := p_dados #>> string_to_array(c ->> 'campo', '.');
    ok := case c ->> 'operador'
      when 'igual'          then v = c ->> 'valor'
      when 'diferente'      then v is distinct from c ->> 'valor'
      when 'contem'         then v ilike '%' || (c ->> 'valor') || '%'
      when 'maior'          then v ~ '^-?\d+(\.\d+)?$' and v::numeric > (c ->> 'valor')::numeric
      when 'menor'          then v ~ '^-?\d+(\.\d+)?$' and v::numeric < (c ->> 'valor')::numeric
      when 'preenchido'     then coalesce(v, '') <> ''
      when 'vazio'          then coalesce(v, '') = ''
      when 'em'             then v = any (string_to_array(c ->> 'valor', ','))
      else v = c ->> 'valor' end;
    if coalesce(ok, false) then acertos := acertos + 1; end if;
  end loop;
  if total = 0 then return true; end if;
  return case when p_condicoes ->> 'modo' = 'qualquer' then acertos > 0 else acertos = total end;
end $$;

-- ---------------------------------------------------------------------
-- 2. Cliente (lido do metrics)
-- ---------------------------------------------------------------------

-- Liga um contato do Octadesk a um cliente do metrics. É a chave confiável entre as bases.
create or replace function octaplus.cliente_por_contato(p_contato text) returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select id from public.clients where octadesk_contact_id = p_contato limit 1),
    (select client_id from public.client_octadesk_contacts where octadesk_contact_id = p_contato and client_id is not null limit 1));
$$;

-- Último recurso: telefone (formatos misturados no metrics; compara já normalizado)
create or replace function octaplus.cliente_por_telefone(p_telefone text) returns uuid
language sql stable security definer set search_path = public, octaplus as $$
  select client_id from public.client_octadesk_contacts
  where client_id is not null
    and octaplus.normalizar_telefone(coalesce(phone_country_code, '') || coalesce(phone_number, '')) = p_telefone
  order by updated_at desc limit 1;
$$;

-- Tudo que uma mensagem pode citar do cliente. O telefone preferido é o do Octadesk.
create or replace function octaplus.contexto_cliente(p_cliente uuid) returns jsonb
language sql stable security definer set search_path = public, octaplus as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id',                   c.id,
    'nome',                 c.name,
    'primeiro_nome',        initcap(split_part(trim(c.name), ' ', 1)),
    'telefone',             coalesce(
                              octaplus.normalizar_telefone(coalesce(o.phone_country_code, '') || coalesce(o.phone_number, '')),
                              octaplus.normalizar_telefone(c.telefone)),
    'octadesk_contact_id',  coalesce(c.octadesk_contact_id, o.octadesk_contact_id),
    'curva',                c.curva_cliente,
    'situacao_carteira',    c.situacao_carteira,
    'tipo_entrega',         coalesce(o.tipo_de_entrega, c.tipo_entrega),
    'ultima_compra',        c.dt_ultima_compra,
    'dias_sem_compra',      (current_date - c.dt_ultima_compra),
    'faturamento_365_dias', c.faturamento_365_dias,
    'vendedor',             s.name,
    'codigo_cliente',       c.codigo_cliente))
  from public.clients c
  left join lateral (
    select * from public.client_octadesk_contacts x
    where x.client_id = c.id or x.octadesk_contact_id = c.octadesk_contact_id
    order by x.updated_at desc limit 1) o on true
  left join public.salespeople s on s.id = c.salesperson_id
  where c.id = p_cliente;
$$;

-- ---------------------------------------------------------------------
-- 3. Funil único de eventos
-- ---------------------------------------------------------------------
-- Resolve o contato, aplica as regras (telefone, não perturbe, condições, limite de contato),
-- deduplica e agenda uma execução por ação. Evento barrado é gravado como 'ignorado' com motivo,
-- para aparecer nas estatísticas e não ser reavaliado a cada rodada.
create or replace function octaplus.registrar_evento(
  p_automacao uuid, p_dedupe text, p_cliente uuid, p_contato text, p_conversa text,
  p_telefone text, p_nome text, p_dados jsonb
) returns jsonb
language plpgsql security definer set search_path = octaplus, public as $$
declare
  a automacoes; cfg configuracao; ctx jsonb := '{}'; tel text; contato text; dados jsonb;
  motivo text; eid uuid; t timestamptz; act automacao_acoes; n int := 0; manda_mensagem boolean;
begin
  select * into a from automacoes where id = p_automacao;
  if a.id is null or not a.ativa or a.arquivada_em is not null then
    return jsonb_build_object('ok', false, 'motivo', 'automacao_inativa');
  end if;
  select * into cfg from configuracao;

  if p_cliente is not null then ctx := coalesce(contexto_cliente(p_cliente), '{}'); end if;
  tel := coalesce(normalizar_telefone(p_telefone), ctx ->> 'telefone');
  contato := coalesce(p_contato, ctx ->> 'octadesk_contact_id');
  ctx := ctx || jsonb_strip_nulls(jsonb_build_object('telefone', tel, 'nome', coalesce(ctx ->> 'nome', p_nome)));
  if ctx ->> 'primeiro_nome' is null and ctx ->> 'nome' is not null then
    ctx := ctx || jsonb_build_object('primeiro_nome', initcap(split_part(trim(ctx ->> 'nome'), ' ', 1)));
  end if;
  dados := jsonb_build_object('cliente', ctx, 'evento', coalesce(p_dados, '{}'));

  select exists (select 1 from automacao_acoes where automacao_id = a.id and tipo in ('enviar_template', 'enviar_mensagem'))
    into manda_mensagem;

  motivo := case
    when not exists (select 1 from automacao_acoes where automacao_id = a.id) then 'sem_acoes'
    when manda_mensagem and tel is null then 'telefone_invalido'
    when exists (select 1 from nao_perturbe np where np.telefone = tel or (p_cliente is not null and np.client_id = p_cliente))
      then 'nao_perturbe'
    when not atende_condicoes(a.condicoes, dados) then 'condicoes'
    when manda_mensagem and cfg.limite_contato_horas > 0 and (
      exists (select 1 from envios e where e.telefone = tel and e.tipo <> 'nota'
                and e.enviado_em > now() - make_interval(hours => cfg.limite_contato_horas))
      or exists (select 1 from execucoes x join eventos ev on ev.id = x.evento_id
                 join automacao_acoes aa on aa.id = x.acao_id
                 where ev.telefone = tel and x.status in ('pendente', 'executando')
                   and aa.tipo in ('enviar_template', 'enviar_mensagem')))
      then 'limite_contato'
  end;

  insert into eventos (automacao_id, dedupe_key, client_id, octadesk_contact_id, conversa_id, telefone, nome, dados, situacao, motivo)
  values (a.id, p_dedupe, p_cliente, contato, p_conversa, tel, ctx ->> 'nome', dados,
          case when motivo is null then 'agendado' else 'ignorado' end, motivo)
  on conflict (automacao_id, dedupe_key) do nothing
  returning id into eid;

  if eid is null then return jsonb_build_object('ok', true, 'motivo', 'duplicado'); end if;
  if motivo is not null then return jsonb_build_object('ok', true, 'evento_id', eid, 'ignorado', motivo); end if;

  t := now() + intervalo(a.atraso_valor, a.atraso_unidade);
  for act in select * from automacao_acoes where automacao_id = a.id order by posicao loop
    t := t + intervalo(act.espera_valor, act.espera_unidade);
    insert into execucoes (automacao_id, acao_id, evento_id, agendado_para)
    values (a.id, act.id, eid,
            case when a.respeitar_horario and act.tipo in ('enviar_template', 'enviar_mensagem')
                 then proximo_horario_util(t) else t end);
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'evento_id', eid, 'execucoes', n);
end $$;

-- ---------------------------------------------------------------------
-- 4. Entradas
-- ---------------------------------------------------------------------

-- POST externo (sistemas próprios, campanhas do metrics). Mesmo contrato do Bridge da Favo:
-- segredo no header X-Bridge-Secret (o n8n repassa aqui) ou em ?secret=.
create or replace function octaplus.receber_webhook(p_automacao uuid, p_segredo text, p_payload jsonb, p_dedupe text default null)
returns jsonb language plpgsql security definer set search_path = octaplus, public as $$
declare a automacoes; bruto text; tel text; cliente uuid;
begin
  select * into a from automacoes where id = p_automacao and fonte = 'webhook';
  if a.id is null or a.segredo_webhook <> coalesce(p_segredo, '') then
    return jsonb_build_object('ok', false, 'motivo', 'nao_autorizado');
  end if;
  if a.payload_exemplo is null then update automacoes set payload_exemplo = p_payload where id = a.id; end if;

  bruto := coalesce(
    case when coalesce(a.campo_telefone, '') <> '' then p_payload #>> string_to_array(a.campo_telefone, '.') end,
    p_payload ->> 'phone', p_payload ->> 'telefone', p_payload #>> '{contact,phone}', p_payload #>> '{contact,phone_digits}');
  tel := normalizar_telefone(bruto);
  cliente := coalesce(
    cliente_por_contato(coalesce(p_payload ->> 'octadesk_contact_id', p_payload #>> '{contact,octadesk_contact_id}')),
    case when tel is not null then cliente_por_telefone(tel) end);

  return registrar_evento(a.id, coalesce(nullif(p_dedupe, ''), 'wh:' || gen_random_uuid()), cliente,
    null, null, bruto, coalesce(p_payload ->> 'name', p_payload ->> 'nome', p_payload #>> '{contact,name}'), p_payload);
end $$;

-- Webhooks de conversa do Octadesk: {domain:'chat', event, data:<chat completo>}.
-- Não são assinados; o segredo vem no caminho da URL cadastrada no Octadesk.
create or replace function octaplus.receber_octadesk(p_segredo text, p_evento text, p_dados jsonb)
returns jsonb language plpgsql security definer set search_path = octaplus, public as $$
declare
  alvo tipo_gatilho; a automacoes; contato text; tel text; cliente uuid; sala text; chave text;
  msg jsonb; total int := 0; conversa jsonb;
begin
  if (select segredo_webhook from integracao_octadesk) <> coalesce(p_segredo, '') then
    return jsonb_build_object('ok', false, 'motivo', 'nao_autorizado');
  end if;
  alvo := case p_evento
    when 'room.after-close'          then 'octa_conversa_encerrada'
    when 'room.after-set-agent'      then 'octa_conversa_atribuida'
    when 'room.after-insert-message' then 'octa_nova_mensagem'
  end;
  if alvo is null then return jsonb_build_object('ok', true, 'motivo', 'evento_nao_usado'); end if;

  sala    := p_dados ->> 'id';
  contato := p_dados #>> '{contact,id}';
  tel     := coalesce(p_dados #>> '{contact,phoneContacts,0,countryCode}', '') || coalesce(p_dados #>> '{contact,phoneContacts,0,number}', '');
  cliente := case when contato is not null then cliente_por_contato(contato) end;
  msg     := p_dados -> 'messages' -> -1;
  chave   := p_evento || ':' || sala || case when alvo = 'octa_nova_mensagem'
               then ':' || coalesce(msg ->> 'id', p_dados ->> 'lastMessageDate', '') else '' end;
  conversa := jsonb_strip_nulls(jsonb_build_object(
    'id', sala, 'numero', p_dados ->> 'number', 'status', p_dados ->> 'status',
    'agente', p_dados #>> '{agent,name}', 'agente_id', p_dados #>> '{agent,id}',
    'grupo', p_dados #>> '{group,name}', 'grupo_id', p_dados #>> '{group,id}',
    'origem', p_dados ->> 'origin', 'tags', p_dados -> 'tags',
    'ultima_mensagem', msg ->> 'body', 'ultima_mensagem_de', msg #>> '{sentBy,type}'));

  for a in select * from automacoes where fonte = 'octadesk' and gatilho = alvo and ativa and arquivada_em is null loop
    perform registrar_evento(a.id, chave, cliente, contato, sala, tel, p_dados #>> '{contact,name}',
                             jsonb_build_object('conversa', conversa));
    total := total + 1;
  end loop;
  return jsonb_build_object('ok', true, 'automacoes', total);
end $$;

-- ---------------------------------------------------------------------
-- 5. Detectores do metrics
-- ---------------------------------------------------------------------
-- Cada detector devolve candidatos que "venceram" entre p_desde e agora. p_desde já respeita a ativação
-- da automação, então ativar uma régua não dispara sobre o histórico inteiro.

create type octaplus.candidato as (
  dedupe text, client_id uuid, contato text, conversa text, telefone text, nome text, dados jsonb
);

create or replace function octaplus.candidatos(a octaplus.automacoes, p_desde timestamptz)
returns setof octaplus.candidato
language plpgsql stable security definer set search_path = public, octaplus as $$
declare p jsonb := a.parametros; dias int; horas int;
begin
  case a.gatilho

  -- Orçamento enviado (classificação da IA) e nenhuma venda depois, N dias após o envio
  when 'orcamento_sem_compra' then
    dias := coalesce((p ->> 'dias')::int, 1);
    return query
    select 'orc:' || s.conversation_octadesk_id, cl, s.cliente_id, s.conversation_octadesk_id, s.cliente_telefone, s.cliente_nome,
           jsonb_build_object('conversa', s.conversation_octadesk_id, 'numero_conversa', s.conversation_number,
                              'orcamento_enviado_em', s.orcamento_enviado_em, 'atendente', s.atendente_nome, 'etapa', s.etapa_comercial)
    from public.skyler_analyses s
    cross join lateral (select octaplus.cliente_por_contato(s.cliente_id) as cl) x
    where s.orcamento_enviado is true
      and s.orcamento_enviado_em + make_interval(days => dias) between p_desde and now()
      and (cl is not null or not coalesce((p ->> 'exigir_cliente')::boolean, true))
      and not exists (select 1 from public.sales v where v.client_id = cl and v.tipo_fiscal = 'Venda'
                        and v.status = 'ativa' and v.created_at >= s.orcamento_enviado_em);

  -- Pediu orçamento e não recebeu em N horas
  when 'pediu_orcamento' then
    horas := coalesce((p ->> 'horas')::int, 2);
    return query
    select 'pedorc:' || s.conversation_octadesk_id, octaplus.cliente_por_contato(s.cliente_id), s.cliente_id,
           s.conversation_octadesk_id, s.cliente_telefone, s.cliente_nome,
           jsonb_build_object('conversa', s.conversation_octadesk_id, 'pedido_em',
                              coalesce(s.ultimo_pedido_orcamento_em, s.primeiro_pedido_orcamento_em), 'atendente', s.atendente_nome)
    from public.skyler_analyses s
    where s.etapa_comercial = 'Cliente pediu orçamento' and s.orcamento_enviado is not true
      and coalesce(s.ultimo_pedido_orcamento_em, s.primeiro_pedido_orcamento_em, s.updated_at)
          + make_interval(hours => horas) between p_desde and now();

  -- Conversa encerrada e classificada pela IA numa das etapas escolhidas (ex.: pagamento feito)
  when 'conversa_classificada' then
    return query
    select 'class:' || s.conversation_octadesk_id || ':' || s.etapa_comercial, octaplus.cliente_por_contato(s.cliente_id),
           s.cliente_id, s.conversation_octadesk_id, s.cliente_telefone, s.cliente_nome,
           jsonb_build_object('conversa', s.conversation_octadesk_id, 'etapa', s.etapa_comercial,
                              'categoria', s.categoria_conversa, 'atendente', s.atendente_nome)
    from public.skyler_analyses s
    where s.last_event = 'closed' and s.updated_at between p_desde and now()
      and s.etapa_comercial = any (array(select jsonb_array_elements_text(coalesce(p -> 'etapas', '[]'))));

  -- Nota de venda nova (agrupa os itens por numero_unico)
  when 'venda_faturada' then
    return query
    select 'venda:' || v.numero_unico, v.client_id, null::text, null::text, null::text, null::text,
           jsonb_build_object('numero_unico', v.numero_unico, 'valor_total', sum(v.value), 'itens', count(*),
                              'data', min(v.sale_date), 'marcas', array_remove(array_agg(distinct v.marca), null))
    from public.sales v
    where v.created_at >= p_desde and v.sale_date >= (p_desde - interval '2 days')::date
      and v.tipo_fiscal = 'Venda' and v.status = 'ativa' and v.numero_unico is not null and v.client_id is not null
    group by v.numero_unico, v.client_id;

  -- Nota cancelada no Sankhya
  when 'venda_cancelada' then
    return query
    select 'canc:' || v.numero_unico, v.client_id, null::text, null::text, null::text, null::text,
           jsonb_build_object('numero_unico', v.numero_unico, 'valor_total', sum(v.value), 'data', min(v.sale_date))
    from public.sales v
    where v.status = 'cancelada' and v.updated_at >= p_desde and v.sale_date >= (p_desde - interval '30 days')::date
      and v.numero_unico is not null and v.client_id is not null
    group by v.numero_unico, v.client_id;

  -- Alerta de comportamento. Os alertas são refeitos todo dia: deduplica por cliente+padrão+semana.
  when 'alerta_comportamento' then
    return query
    select 'alerta:' || b.client_id || ':' || b.pattern || ':' || to_char(b.gerado_em, 'IYYY-IW'), b.client_id,
           null::text, null::text, null::text, null::text,
           jsonb_build_object('padrao', b.pattern, 'severidade', b.severidade, 'motivo', b.motivo,
                              'dias_atraso', b.dias_atraso, 'valor_risco', b.valor_risco)
    from public.client_behavior_alerts b
    where b.created_at between p_desde and now()
      and (jsonb_array_length(coalesce(p -> 'padroes', '[]')) = 0
           or b.pattern = any (array(select jsonb_array_elements_text(p -> 'padroes'))));

  -- Mudança de curva ABC (de/para opcionais)
  when 'mudanca_curva' then
    return query
    select 'curva:' || h.id, h.client_id, null::text, null::text, null::text, null::text,
           jsonb_build_object('curva_de', h.curva_de, 'curva_para', h.curva_para)
    from public.client_curve_history h
    where h.changed_at between p_desde and now()
      and (coalesce(p ->> 'curva_de', '') = '' or h.curva_de = p ->> 'curva_de')
      and (coalesce(p ->> 'curva_para', '') = '' or h.curva_para = p ->> 'curva_para');

  -- Crédito disponível para o cliente
  when 'credito_disponivel' then
    return query
    select 'cred:' || cr.client_id || ':' || coalesce(cr.dtref::date::text, cr.id::text), cr.client_id,
           null::text, null::text, null::text, null::text,
           jsonb_build_object('valor', cr.valor, 'referencia', cr.dtref)
    from public.client_credits cr
    where cr.client_id is not null and cr.created_at between p_desde and now()
      and coalesce(cr.valor, 0) > coalesce((p ->> 'valor_minimo')::numeric, 0);

  -- Sem compra há N dias: dispara uma vez quando o cliente cruza o limite
  when 'sem_compra' then
    dias := coalesce((p ->> 'dias')::int, 30);
    return query
    select 'semcompra:' || c.id || ':' || dias || ':' || c.dt_ultima_compra, c.id, null::text, null::text, null::text, null::text,
           jsonb_build_object('dias', dias, 'ultima_compra', c.dt_ultima_compra)
    from public.clients c
    where c.dt_ultima_compra = (now() at time zone 'America/Sao_Paulo')::date - dias
      and ((c.dt_ultima_compra + dias)::timestamp at time zone 'America/Sao_Paulo') >= p_desde;

  else
    return;
  end case;
end $$;

-- Rodada dos detectores (pg_cron a cada 5 min). Limite por automação para evitar rajada.
create or replace function octaplus.detectar_eventos(p_limite integer default 500) returns jsonb
language plpgsql security definer set search_path = octaplus, public as $$
declare a automacoes; c candidato; desde timestamptz; janela int; r jsonb; resumo jsonb := '{}'; n int;
begin
  select janela_deteccao_horas into janela from configuracao;
  for a in select * from automacoes where fonte = 'metrics' and ativa and arquivada_em is null loop
    desde := greatest(coalesce(a.ativa_desde, now()), now() - make_interval(hours => janela));
    n := 0;
    for c in
      select * from candidatos(a, desde) k
      where not exists (select 1 from eventos e where e.automacao_id = a.id and e.dedupe_key = k.dedupe)
      limit p_limite
    loop
      r := registrar_evento(a.id, c.dedupe, c.client_id, c.contato, c.conversa, c.telefone, c.nome, c.dados);
      n := n + 1;
    end loop;
    resumo := resumo || jsonb_build_object(a.nome, n);
  end loop;
  return resumo;
end $$;

-- ---------------------------------------------------------------------
-- 6. Motor (n8n)
-- ---------------------------------------------------------------------

-- Credenciais e estado da integração para os fluxos do n8n
create or replace function octaplus.credenciais_octadesk() returns jsonb
language sql stable security definer set search_path = octaplus as $$
  select to_jsonb(i) - 'segredo_webhook' || jsonb_build_object(
    'api_key',  (select valor from segredos where chave = 'octadesk_api_key'),
    'usuario',  (select valor from segredos where chave = 'octadesk_usuario'),
    'senha',    (select valor from segredos where chave = 'octadesk_senha'),
    'tenant',   (select valor from segredos where chave = 'octadesk_tenant'),
    'jwt',      (select valor from segredos where chave = 'octadesk_jwt'),
    'jwt_expira_em', (select expira_em from segredos where chave = 'octadesk_jwt'),
    'catalogo_vencido', i.sincronizado_em is null or i.sincronizado_em < now() - interval '1 hour'
                        or i.sincronizacao_pedida_em > coalesce(i.sincronizado_em, '-infinity'))
  from integracao_octadesk i;
$$;

create or replace function octaplus.gravar_jwt(p_token text, p_expira_em timestamptz) returns void
language sql security definer set search_path = octaplus as $$
  insert into segredos (chave, valor, expira_em) values ('octadesk_jwt', p_token, p_expira_em)
  on conflict (chave) do update set valor = excluded.valor, expira_em = excluded.expira_em, atualizado_em = now();
$$;

-- Resultado do /auth/check + catálogos. p = {ok, erro, numeros[], templates[], grupos[], tags[]}
create or replace function octaplus.gravar_catalogos(p jsonb) returns void
language plpgsql security definer set search_path = octaplus as $$
begin
  if not coalesce((p ->> 'ok')::boolean, false) then
    update integracao_octadesk set status = 'erro', ultimo_erro = left(p ->> 'erro', 500), validado_em = now();
    return;
  end if;

  insert into octa_numeros (id, nome, numero, ativo, sincronizado_em)
  select x ->> 'id', x ->> 'name', x ->> 'number', true, now() from jsonb_array_elements(coalesce(p -> 'numeros', '[]')) x
  on conflict (id) do update set nome = excluded.nome, numero = excluded.numero, ativo = true, sincronizado_em = now();
  update octa_numeros set ativo = false
  where id not in (select x ->> 'id' from jsonb_array_elements(coalesce(p -> 'numeros', '[]')) x);

  delete from octa_templates;
  insert into octa_templates (id, nome, status, categoria, habilitado, componentes, variaveis, corpo)
  select x ->> 'id', x ->> 'name', x ->> 'status', x ->> 'category', (x ->> 'enable')::boolean,
         coalesce(x -> 'components', '[]'),
         array(select distinct v ->> 'key' from jsonb_array_elements(coalesce(x -> 'components', '[]')) comp,
                    jsonb_array_elements(coalesce(comp -> 'variables', '[]')) v where v ->> 'key' is not null),
         (select comp ->> 'message' from jsonb_array_elements(coalesce(x -> 'components', '[]')) comp
          where upper(comp ->> 'type') = 'BODY' limit 1)
  from jsonb_array_elements(coalesce(p -> 'templates', '[]')) x;

  delete from octa_grupos;
  insert into octa_grupos (id, nome) select x ->> 'id', x ->> 'name' from jsonb_array_elements(coalesce(p -> 'grupos', '[]')) x;
  delete from octa_tags;
  insert into octa_tags (id, nome) select x ->> 'id', x ->> 'name' from jsonb_array_elements(coalesce(p -> 'tags', '[]')) x;

  update integracao_octadesk set status = 'conectado', ultimo_erro = null, validado_em = now(), sincronizado_em = now();
end $$;

-- Pega execuções vencidas com tudo que o executor precisa (lock com SKIP LOCKED)
create or replace function octaplus.pegar_execucoes(p_limite integer default 50) returns setof jsonb
language plpgsql security definer set search_path = octaplus as $$
declare cred jsonb := credenciais_octadesk(); cfg configuracao;
begin
  select * into cfg from configuracao;
  update execucoes set status = 'pendente', travado_em = null
  where status = 'executando' and travado_em < now() - interval '10 minutes';

  return query
  with vencidas as (
    select x.id from execucoes x where x.status = 'pendente' and x.agendado_para <= now()
    order by x.agendado_para limit p_limite for update skip locked
  ), marcadas as (
    update execucoes x set status = 'executando', travado_em = now(), tentativas = x.tentativas + 1
    from vencidas where x.id = vencidas.id returning x.*
  )
  select jsonb_build_object(
    'execucao_id', m.id, 'tentativas', m.tentativas,
    'automacao', jsonb_build_object('id', a.id, 'nome', a.nome),
    'acao', jsonb_build_object('id', ac.id, 'tipo', ac.tipo, 'posicao', ac.posicao, 'config', ac.config),
    'evento', jsonb_build_object('id', e.id, 'telefone', e.telefone, 'nome', e.nome, 'client_id', e.client_id,
                                 'octadesk_contact_id', e.octadesk_contact_id, 'conversa_id', e.conversa_id, 'dados', e.dados),
    'numero_padrao', cfg.numero_envio_padrao,
    'fila', case when ac.tipo = 'transferir_fila' then coalesce(
              nullif(ac.config ->> 'grupo_id', ''),
              (select f.grupo_id from mapa_filas f where upper(f.tipo_entrega) = upper(e.dados #>> '{cliente,tipo_entrega}')),
              (select f.grupo_id from mapa_filas f where f.tipo_entrega = '*')) end,
    'octadesk', cred)
  from marcadas m
  join automacoes a on a.id = m.automacao_id
  join automacao_acoes ac on ac.id = m.acao_id
  join eventos e on e.id = m.evento_id;
end $$;

-- Fecha a execução. 'pendente' = tentar de novo (5, 10, 15 min); depois de 3 tentativas vira 'erro'.
-- resultado.envio -> grava em envios; resultado.room_key -> vira a conversa do evento para as ações seguintes.
create or replace function octaplus.concluir_execucao(
  p_execucao uuid, p_status text, p_resultado jsonb default null, p_erro text default null, p_codigo text default null
) returns void language plpgsql security definer set search_path = octaplus as $$
declare x execucoes; ev eventos; st status_execucao := p_status::status_execucao;
begin
  select * into x from execucoes where id = p_execucao;
  if x.id is null then return; end if;

  if st = 'pendente' and x.tentativas < 3 then
    update execucoes set status = 'pendente', erro = p_erro, codigo_erro = p_codigo, travado_em = null,
                         agendado_para = now() + make_interval(mins => 5 * x.tentativas)
    where id = x.id;
    return;
  end if;
  if st = 'pendente' then st := 'erro'; end if;

  update execucoes set status = st, resultado = p_resultado, erro = p_erro, codigo_erro = p_codigo,
                       concluido_em = now(), travado_em = null
  where id = x.id;

  if st = 'sucesso' then
    select * into ev from eventos where id = x.evento_id;
    if p_resultado ->> 'room_key' is not null and ev.conversa_id is null then
      update eventos set conversa_id = p_resultado ->> 'room_key' where id = ev.id;
    end if;
    if p_resultado ? 'envio' then
      insert into envios (execucao_id, automacao_id, client_id, telefone, tipo, template_id, numero_origem, room_key, message_key)
      values (x.id, x.automacao_id, ev.client_id, ev.telefone, p_resultado #>> '{envio,tipo}', p_resultado #>> '{envio,template_id}',
              p_resultado #>> '{envio,numero_origem}', coalesce(p_resultado ->> 'room_key', ev.conversa_id), p_resultado ->> 'message_key');
    end if;
  end if;
end $$;

-- Atribuição (pg_cron de hora em hora): respondeu = mensagem do contato na conversa depois do envio;
-- comprou = primeira nota de venda do cliente até 7 dias depois.
create or replace function octaplus.atualizar_atribuicao() returns void
language plpgsql security definer set search_path = octaplus, public as $$
begin
  update envios e set respondeu_em = r.primeira
  from (select e2.id, min(m.time) primeira from envios e2
        join public.messages m on m.conversation_octadesk_id = e2.room_key and m.sent_by_type = 'contact' and m.time > e2.enviado_em
        where e2.respondeu_em is null and e2.room_key is not null and e2.enviado_em > now() - interval '14 days'
        group by e2.id) r
  where e.id = r.id;

  update envios e set comprou_em = v.primeira, valor_compra = v.valor
  from (select e2.id, min(s.created_at) primeira, sum(s.value) valor from envios e2
        join public.sales s on s.client_id = e2.client_id and s.tipo_fiscal = 'Venda' and s.status = 'ativa'
         and s.created_at > e2.enviado_em and s.created_at <= e2.enviado_em + interval '7 days'
        where e2.comprou_em is null and e2.client_id is not null and e2.enviado_em > now() - interval '8 days'
        group by e2.id) v
  where e.id = v.id;
end $$;

-- API pública POST /v1/format (via n8n): valida a chave br_live_*, registra e formata
create or replace function octaplus.api_formatar_telefone(p_segredo text, p_telefone text) returns jsonb
language plpgsql security definer set search_path = octaplus, extensions, public as $$
declare k chaves_api; formatado text;
begin
  select * into k from chaves_api where hash = encode(digest(coalesce(p_segredo, ''), 'sha256'), 'hex') and revogada_em is null;
  if k.id is null then return jsonb_build_object('ok', false, 'error', 'invalid_api_key'); end if;
  formatado := normalizar_telefone(p_telefone);
  update chaves_api set usado_em = now() where id = k.id;
  insert into chamadas_api (chave_id, endpoint, ok) values (k.id, '/v1/format', formatado is not null);
  return jsonb_build_object('ok', formatado is not null, 'input', p_telefone, 'e164', formatado,
                            'digits', regexp_replace(coalesce(formatado, ''), '\D', '', 'g'));
end $$;

-- Limpeza diária: ignorados somem em 30 dias, o resto em 180
create or replace function octaplus.limpar_historico() returns void
language sql security definer set search_path = octaplus as $$
  delete from eventos where situacao = 'ignorado' and recebido_em < now() - interval '30 days';
  delete from eventos where recebido_em < now() - interval '180 days';
$$;

-- ---------------------------------------------------------------------
-- 7. RPCs do painel
-- ---------------------------------------------------------------------

-- Salva automação + ações de forma atômica. p no formato do wizard (chaves iguais às colunas + acoes[]).
create or replace function octaplus.salvar_automacao(p jsonb) returns uuid
language plpgsql security definer set search_path = octaplus as $$
declare aid uuid := nullif(p ->> 'id', '')::uuid; x jsonb; i int := 0;
begin
  if not pode('editar') then raise exception 'sem_permissao'; end if;
  if aid is null then
    insert into automacoes (nome, fonte, gatilho, criado_por)
    values (p ->> 'nome', (p ->> 'fonte')::fonte_gatilho, (p ->> 'gatilho')::tipo_gatilho, auth.uid())
    returning id into aid;
  end if;

  update automacoes set
    nome              = coalesce(p ->> 'nome', nome),
    ativa             = coalesce((p ->> 'ativa')::boolean, ativa),
    fonte             = coalesce((p ->> 'fonte')::fonte_gatilho, fonte),
    gatilho           = coalesce((p ->> 'gatilho')::tipo_gatilho, gatilho),
    parametros        = coalesce(p -> 'parametros', parametros),
    condicoes         = coalesce(p -> 'condicoes', condicoes),
    respeitar_horario = coalesce((p ->> 'respeitar_horario')::boolean, respeitar_horario),
    atraso_valor      = coalesce((p ->> 'atraso_valor')::int, atraso_valor),
    atraso_unidade    = coalesce((p ->> 'atraso_unidade')::unidade_tempo, atraso_unidade),
    campo_telefone    = coalesce(p ->> 'campo_telefone', campo_telefone),
    atualizado_em     = now()
  where id = aid;

  if p ? 'acoes' then
    delete from automacao_acoes where automacao_id = aid;
    for x in select * from jsonb_array_elements(p -> 'acoes') loop
      insert into automacao_acoes (automacao_id, posicao, tipo, config, espera_valor, espera_unidade)
      values (aid, i, (x ->> 'tipo')::tipo_acao, coalesce(x -> 'config', '{}'),
              case when i = 0 then 0 else coalesce((x ->> 'espera_valor')::int, 0) end,
              coalesce(nullif(x ->> 'espera_unidade', ''), 'minutos')::unidade_tempo);
      i := i + 1;
    end loop;
  end if;
  return aid;
end $$;

create or replace function octaplus.duplicar_automacao(p_id uuid) returns uuid
language plpgsql security definer set search_path = octaplus as $$
declare nova uuid;
begin
  if not pode('editar') then raise exception 'sem_permissao'; end if;
  insert into automacoes (nome, ativa, fonte, gatilho, parametros, condicoes, respeitar_horario,
                          atraso_valor, atraso_unidade, campo_telefone, payload_exemplo, criado_por)
  select nome || ' (cópia)', false, fonte, gatilho, parametros, condicoes, respeitar_horario,
         atraso_valor, atraso_unidade, campo_telefone, payload_exemplo, auth.uid()
  from automacoes where id = p_id returning id into nova;
  insert into automacao_acoes (automacao_id, posicao, tipo, config, espera_valor, espera_unidade)
  select nova, posicao, tipo, config, espera_valor, espera_unidade from automacao_acoes where automacao_id = p_id;
  return nova;
end $$;

-- Grava a integração; segredos entram mas nunca voltam. Campo vazio = manter o atual.
-- p = {base_url, subdominio, agente_email, api_privada_ativa, api_key?, usuario?, senha?, tenant?}
create or replace function octaplus.salvar_integracao(p jsonb) returns void
language plpgsql security definer set search_path = octaplus as $$
declare k text;
begin
  if not pode('editar') then raise exception 'sem_permissao'; end if;
  update integracao_octadesk set
    base_url          = coalesce(nullif(rtrim(p ->> 'base_url', '/'), ''), base_url),
    subdominio        = coalesce(nullif(p ->> 'subdominio', ''), subdominio),
    agente_email      = coalesce(nullif(p ->> 'agente_email', ''), agente_email),
    api_privada_ativa = coalesce((p ->> 'api_privada_ativa')::boolean, api_privada_ativa),
    status = 'validando', ultimo_erro = null, sincronizacao_pedida_em = now();
  foreach k in array array['api_key', 'usuario', 'senha', 'tenant'] loop
    if coalesce(p ->> k, '') <> '' then
      insert into segredos (chave, valor) values ('octadesk_' || k, p ->> k)
      on conflict (chave) do update set valor = excluded.valor, atualizado_em = now();
      if k in ('usuario', 'senha', 'tenant') then delete from segredos where chave = 'octadesk_jwt'; end if;
    end if;
  end loop;
end $$;

create or replace function octaplus.pedir_sincronizacao() returns void
language plpgsql security definer set search_path = octaplus as $$
begin
  if not pode('editar') then raise exception 'sem_permissao'; end if;
  update integracao_octadesk set sincronizacao_pedida_em = now();
end $$;

-- Quais segredos estão preenchidos (sem revelar o valor), para o formulário mostrar "•••• salvo"
create or replace function octaplus.segredos_preenchidos() returns text[]
language sql stable security definer set search_path = octaplus as $$
  select case when pode('ver') then array(select chave from segredos where chave <> 'octadesk_jwt') else '{}' end;
$$;

create or replace function octaplus.criar_chave_api(p_nome text) returns jsonb
language plpgsql security definer set search_path = octaplus, extensions, public as $$
declare segredo text := 'br_live_' || encode(gen_random_bytes(24), 'hex'); kid uuid;
begin
  if not pode('editar') then raise exception 'sem_permissao'; end if;
  insert into chaves_api (nome, prefixo, hash, criado_por)
  values (p_nome, left(segredo, 12), encode(digest(segredo, 'sha256'), 'hex'), auth.uid()) returning id into kid;
  return jsonb_build_object('id', kid, 'segredo', segredo);   -- aparece uma vez só
end $$;

create or replace function octaplus.revogar_chave_api(p_id uuid) returns void
language plpgsql security definer set search_path = octaplus as $$
begin
  if not pode('editar') then raise exception 'sem_permissao'; end if;
  update chaves_api set revogada_em = now() where id = p_id;
end $$;

-- Estatísticas diárias com os contadores do app original + resultado dos envios
create or replace function octaplus.estatisticas_diarias(p_de date, p_ate date, p_automacao uuid default null)
returns table (
  dia date, gatilhos bigint, gatilhos_ignorados bigint, acoes bigint, acoes_sucesso bigint,
  acoes_sem_envio bigint, acoes_erro bigint, envios bigint, respostas bigint, compras bigint, valor_compras numeric
) language sql stable security definer set search_path = octaplus as $$
  with dias as (select generate_series(p_de, p_ate, interval '1 day')::date d),
  ev as (select (recebido_em at time zone 'America/Sao_Paulo')::date d, count(*) n, count(*) filter (where situacao = 'ignorado') ign
         from eventos where (p_automacao is null or automacao_id = p_automacao)
           and recebido_em >= p_de::timestamp at time zone 'America/Sao_Paulo'
         group by 1),
  ex as (select (concluido_em at time zone 'America/Sao_Paulo')::date d, count(*) n,
                count(*) filter (where status = 'sucesso') ok, count(*) filter (where status = 'ignorado') sem,
                count(*) filter (where status = 'erro') err
         from execucoes where concluido_em is not null and (p_automacao is null or automacao_id = p_automacao)
           and concluido_em >= p_de::timestamp at time zone 'America/Sao_Paulo'
         group by 1),
  en as (select (enviado_em at time zone 'America/Sao_Paulo')::date d, count(*) filter (where tipo <> 'nota') n,
                count(respondeu_em) resp, count(comprou_em) comp, coalesce(sum(valor_compra), 0) valor
         from envios where (p_automacao is null or automacao_id = p_automacao)
           and enviado_em >= p_de::timestamp at time zone 'America/Sao_Paulo'
         group by 1)
  select dias.d, coalesce(ev.n, 0), coalesce(ev.ign, 0), coalesce(ex.n, 0), coalesce(ex.ok, 0), coalesce(ex.sem, 0),
         coalesce(ex.err, 0), coalesce(en.n, 0), coalesce(en.resp, 0), coalesce(en.comp, 0), coalesce(en.valor, 0)
  from dias left join ev on ev.d = dias.d left join ex on ex.d = dias.d left join en on en.d = dias.d
  where pode('ver')
  order by dias.d;
$$;

-- Números por automação, para os cards da lista
create or replace function octaplus.resumo_automacoes()
returns table (automacao_id uuid, executadas bigint, erros bigint, sem_envio bigint, ultima_execucao timestamptz,
               envios bigint, respostas bigint, compras bigint)
language sql stable security definer set search_path = octaplus as $$
  select a.id,
    (select count(*) from execucoes x where x.automacao_id = a.id and x.status = 'sucesso'),
    (select count(*) from execucoes x where x.automacao_id = a.id and x.status = 'erro'),
    (select count(*) from execucoes x where x.automacao_id = a.id and x.status = 'ignorado')
      + (select count(*) from eventos e where e.automacao_id = a.id and e.situacao = 'ignorado'),
    (select max(x.concluido_em) from execucoes x where x.automacao_id = a.id),
    (select count(*) from envios v where v.automacao_id = a.id and v.tipo <> 'nota'),
    (select count(respondeu_em) from envios v where v.automacao_id = a.id),
    (select count(comprou_em) from envios v where v.automacao_id = a.id)
  from automacoes a where pode('ver');
$$;

-- ===== migrations/20260918000003_octaplus_acesso_e_agenda.sql =====
-- =====================================================================
-- Octadesk Plus — gatilhos de tabela, RLS, grants e agenda (pg_cron)
-- =====================================================================

-- Ao ativar uma automação, marca o momento: os detectores só olham o que vencer daqui para frente.
create or replace function octaplus.ao_salvar_automacao() returns trigger
language plpgsql as $$
begin
  if new.ativa and (tg_op = 'INSERT' or not old.ativa) then new.ativa_desde := now(); end if;
  if not new.ativa then new.ativa_desde := null; end if;
  new.atualizado_em := now();
  return new;
end $$;

create trigger automacoes_ativacao before insert or update on octaplus.automacoes
  for each row execute function octaplus.ao_salvar_automacao();

-- ---------------------------------------------------------------------
-- RLS: leitura com permissão 'ver', escrita com 'editar' (recurso 'octaplus' no metrics).
-- Dono e superadmin do metrics passam sempre (public.has_permission).
-- ---------------------------------------------------------------------
alter table octaplus.configuracao        enable row level security;
alter table octaplus.integracao_octadesk enable row level security;
alter table octaplus.segredos            enable row level security;   -- sem policy: invisível ao navegador
alter table octaplus.octa_numeros        enable row level security;
alter table octaplus.octa_templates      enable row level security;
alter table octaplus.octa_grupos         enable row level security;
alter table octaplus.octa_tags           enable row level security;
alter table octaplus.mapa_filas          enable row level security;
alter table octaplus.automacoes          enable row level security;
alter table octaplus.automacao_acoes     enable row level security;
alter table octaplus.eventos             enable row level security;
alter table octaplus.execucoes           enable row level security;
alter table octaplus.envios              enable row level security;
alter table octaplus.nao_perturbe        enable row level security;
alter table octaplus.chaves_api          enable row level security;
alter table octaplus.chamadas_api        enable row level security;

create policy ver on octaplus.configuracao        for select using (octaplus.pode('ver'));
create policy editar on octaplus.configuracao     for update using (octaplus.pode('editar'));
create policy ver on octaplus.integracao_octadesk for select using (octaplus.pode('ver'));
create policy ver on octaplus.octa_numeros        for select using (octaplus.pode('ver'));
create policy editar on octaplus.octa_numeros     for update using (octaplus.pode('editar'));   -- rótulo
create policy ver on octaplus.octa_templates      for select using (octaplus.pode('ver'));
create policy ver on octaplus.octa_grupos         for select using (octaplus.pode('ver'));
create policy ver on octaplus.octa_tags           for select using (octaplus.pode('ver'));
create policy ver on octaplus.mapa_filas          for select using (octaplus.pode('ver'));
create policy editar on octaplus.mapa_filas       for all using (octaplus.pode('editar')) with check (octaplus.pode('editar'));
create policy ver on octaplus.automacoes          for select using (octaplus.pode('ver'));
create policy editar on octaplus.automacoes       for update using (octaplus.pode('editar'));     -- ligar/arquivar
create policy ver on octaplus.automacao_acoes     for select using (octaplus.pode('ver'));
create policy ver on octaplus.eventos             for select using (octaplus.pode('ver'));
create policy ver on octaplus.execucoes           for select using (octaplus.pode('ver'));
create policy ver on octaplus.envios              for select using (octaplus.pode('ver'));
create policy ver on octaplus.nao_perturbe        for select using (octaplus.pode('ver'));
create policy editar on octaplus.nao_perturbe     for all using (octaplus.pode('editar')) with check (octaplus.pode('editar'));
create policy ver on octaplus.chaves_api          for select using (octaplus.pode('ver'));
create policy ver on octaplus.chamadas_api        for select using (octaplus.pode('ver'));

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------
grant select, insert, update, delete on all tables in schema octaplus to authenticated;
revoke all on octaplus.segredos from anon, authenticated;
grant usage on all sequences in schema octaplus to authenticated;

-- Painel
grant execute on function
  octaplus.salvar_automacao(jsonb), octaplus.duplicar_automacao(uuid), octaplus.salvar_integracao(jsonb),
  octaplus.pedir_sincronizacao(), octaplus.segredos_preenchidos(), octaplus.criar_chave_api(text),
  octaplus.revogar_chave_api(uuid), octaplus.estatisticas_diarias(date, date, uuid), octaplus.resumo_automacoes(),
  octaplus.pode(text)
to authenticated;

-- Motor: só o n8n (conexão Postgres) e o pg_cron chamam
revoke execute on function
  octaplus.registrar_evento(uuid, text, uuid, text, text, text, text, jsonb),
  octaplus.receber_webhook(uuid, text, jsonb, text), octaplus.receber_octadesk(text, text, jsonb),
  octaplus.candidatos(octaplus.automacoes, timestamptz), octaplus.detectar_eventos(integer),
  octaplus.credenciais_octadesk(), octaplus.gravar_jwt(text, timestamptz), octaplus.gravar_catalogos(jsonb),
  octaplus.pegar_execucoes(integer), octaplus.concluir_execucao(uuid, text, jsonb, text, text),
  octaplus.atualizar_atribuicao(), octaplus.api_formatar_telefone(text, text), octaplus.limpar_historico(),
  octaplus.contexto_cliente(uuid), octaplus.cliente_por_contato(text), octaplus.cliente_por_telefone(text)
from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Agenda (só onde o pg_cron existe — o metrics já usa)
-- ---------------------------------------------------------------------
do $agenda$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('octaplus-detectores', '*/5 * * * *', 'select octaplus.detectar_eventos()');
    perform cron.schedule('octaplus-atribuicao', '15 * * * *',  'select octaplus.atualizar_atribuicao()');
    perform cron.schedule('octaplus-limpeza',    '30 3 * * *',  'select octaplus.limpar_historico()');
  end if;
end $agenda$;

-- ===== migrations/20260921000001_octaplus_empresa_usuarios.sql =====
-- =====================================================================
-- Octadesk Plus — Configurações › Empresa e Usuários
--
-- Empresa: dados cadastrais ficam na própria linha de octaplus.configuracao (empresa única).
-- Usuários: lista de leitura dos usuários do metrics com o papel e o que podem no Octadesk Plus.
--   Convidar, remover e mudar permissão continua sendo no metrics — este schema não escreve em `public`.
-- =====================================================================

alter table octaplus.configuracao
  add column empresa_nome     text,
  add column empresa_cnpj     text check (empresa_cnpj is null or empresa_cnpj ~ '^\d{14}$'),
  add column empresa_telefone text,
  add column empresa_site     text;

-- security definer: o navegador não lê auth.users nem os perfis de acesso direto.
create or replace function octaplus.listar_usuarios()
returns table (id uuid, nome text, email text, papel text, perfil_acesso text, pode_ver boolean, pode_editar boolean)
language plpgsql stable security definer set search_path = public, octaplus as $$
begin
  if not octaplus.pode('ver') then return; end if;
  return query
    select p.id, p.full_name, p.email,
           (select ur.role::text from public.user_roles ur where ur.user_id = p.id
             order by case ur.role when 'owner' then 0 when 'superadmin' then 1 else 2 end limit 1),
           (select ap.name from public.user_roles ur join public.access_profiles ap on ap.id = ur.profile_id
             where ur.user_id = p.id limit 1),
           public.has_permission(p.id, 'octaplus', 'ver'),
           public.has_permission(p.id, 'octaplus', 'editar')
      from public.profiles p
     order by coalesce(p.full_name, p.email);
end $$;

revoke execute on function octaplus.listar_usuarios() from public, anon;
grant execute on function octaplus.listar_usuarios() to authenticated;

-- ===== migrations/20260923000001_octaplus_fecha_anon.sql =====
-- =====================================================================
-- Octadesk Plus — visitante sem login (anon) não executa nenhuma função do schema.
-- O Postgres dá execute a PUBLIC por padrão; o painel só funciona logado e as funções dele já têm grant
-- explícito para authenticated. Os utilitários que ainda dependiam de PUBLIC ganham grant próprio.
-- =====================================================================

revoke execute on all functions in schema octaplus from public, anon;
alter default privileges in schema octaplus revoke execute on functions from public, anon;

grant execute on function
  octaplus.atende_condicoes(jsonb, jsonb), octaplus.intervalo(integer, octaplus.unidade_tempo),
  octaplus.normalizar_telefone(text), octaplus.proximo_horario_util(timestamptz)
to authenticated;

-- ===== migrations/20260923000002_octaplus_primeiro_acesso.sql =====
-- =====================================================================
-- Octadesk Plus — primeiro acesso: a tela de login só oferece "Criar conta" enquanto não houver usuário.
-- Única função que o visitante sem login (anon) executa; responde só sim/não.
-- =====================================================================

create or replace function octaplus.primeiro_acesso() returns boolean
language sql stable security definer set search_path = octaplus, public as $$
  select not exists (select 1 from auth.users)
$$;

revoke execute on function octaplus.primeiro_acesso() from public;
grant execute on function octaplus.primeiro_acesso() to anon, authenticated;

-- ===== migrations/20260924000001_octaplus_multiempresa.sql =====
-- =====================================================================
-- Octadesk Plus — várias empresas no mesmo banco, isoladas por RLS.
--
-- Cada linha do schema carrega empresa_id. O painel manda o header `x-empresa` e o banco só mostra o que é
-- dessa empresa, e só para quem tem vínculo ativo com ela (octaplus.membros) ou é o dono da plataforma
-- (papel 'owner' em public.user_roles). O header escolhe o contexto; quem garante o acesso é o banco.
-- O motor (n8n e pg_cron) não usa header: toda função do motor recebe ou descobre a empresa.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Empresas e vínculos
-- ---------------------------------------------------------------------
create table octaplus.empresas (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null check (btrim(nome) <> ''),
  ativa     boolean not null default true,
  cnpj      text check (cnpj is null or cnpj ~ '^\d{14}$'),
  telefone  text,
  site      text,
  criada_em timestamptz not null default now()
);

create table octaplus.membros (
  empresa_id uuid not null references octaplus.empresas(id) on delete cascade,
  user_id    uuid not null,        -- auth.users.id
  nivel      text not null default 'ver' check (nivel in ('ver', 'editar')),
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now(),
  primary key (empresa_id, user_id)
);
create index on octaplus.membros (user_id);

-- A empresa que já existia (uma só) vira a primeira; os dados cadastrais saem de configuracao.
insert into octaplus.empresas (nome, cnpj, telefone, site)
select coalesce(nullif(btrim(empresa_nome), ''), 'Empresa principal'), empresa_cnpj, empresa_telefone, empresa_site
from octaplus.configuracao;

-- ---------------------------------------------------------------------
-- Empresa atual (header do painel) e permissões
-- ---------------------------------------------------------------------
create or replace function octaplus.empresa_atual() returns uuid
language plpgsql stable as $$
declare h text := current_setting('request.headers', true);
begin
  if coalesce(h, '') = '' then return null; end if;
  return nullif(h::json ->> 'x-empresa', '')::uuid;
exception when others then
  return null;   -- header malformado = sem empresa
end $$;

-- Dono da plataforma: vê e configura todas as empresas.
create or replace function octaplus.e_dono() returns boolean
language sql stable security definer set search_path = public, octaplus as $$
  select auth.uid() is not null and public.has_role(auth.uid(), 'owner');
$$;

-- 'ver' ou 'editar' numa empresa: dono sempre; os demais com vínculo ativo numa empresa ativa.
create or replace function octaplus.pode_na(p_empresa uuid, p_acao text) returns boolean
language sql stable security definer set search_path = public, octaplus as $$
  select auth.uid() is not null and p_empresa is not null and (
    octaplus.e_dono() or exists (
      select 1 from octaplus.membros m join octaplus.empresas e on e.id = m.empresa_id
      where m.empresa_id = p_empresa and m.user_id = auth.uid() and m.ativo and e.ativa
        and (p_acao = 'ver' or m.nivel = 'editar')));
$$;

-- Mesma assinatura de antes: agora vale para a empresa atual.
create or replace function octaplus.pode(p_acao text) returns boolean
language sql stable security definer set search_path = public, octaplus as $$
  select octaplus.pode_na(octaplus.empresa_atual(), p_acao);
$$;

-- ---------------------------------------------------------------------
-- empresa_id em todas as tabelas
-- ---------------------------------------------------------------------
do $$
declare t text; principal uuid := (select id from octaplus.empresas order by criada_em limit 1);
begin
  foreach t in array array['configuracao', 'integracao_octadesk', 'segredos', 'octa_numeros', 'octa_templates',
    'octa_grupos', 'octa_tags', 'mapa_filas', 'automacoes', 'automacao_acoes', 'eventos', 'execucoes', 'envios',
    'nao_perturbe', 'chaves_api', 'chamadas_api'] loop
    execute format('alter table octaplus.%I add column empresa_id uuid references octaplus.empresas(id) on delete cascade', t);
    execute format('update octaplus.%I set empresa_id = %L', t, principal);
    execute format('alter table octaplus.%I alter column empresa_id set not null, alter column empresa_id set default octaplus.empresa_atual()', t);
  end loop;
end $$;

-- configuracao e integracao_octadesk: uma linha por empresa
alter table octaplus.configuracao drop constraint configuracao_pkey, drop column id,
  drop column empresa_nome, drop column empresa_cnpj, drop column empresa_telefone, drop column empresa_site,
  add primary key (empresa_id);
alter table octaplus.integracao_octadesk drop constraint integracao_octadesk_pkey, drop column id,
  add primary key (empresa_id),
  add constraint integracao_octadesk_segredo_webhook_key unique (segredo_webhook);   -- identifica a empresa no webhook

alter table octaplus.segredos       drop constraint segredos_pkey,       add primary key (empresa_id, chave);
alter table octaplus.octa_numeros   drop constraint octa_numeros_pkey,   add primary key (empresa_id, id),
  drop constraint octa_numeros_numero_key, add unique (empresa_id, numero);
alter table octaplus.octa_templates drop constraint octa_templates_pkey, add primary key (empresa_id, id);
alter table octaplus.octa_grupos    drop constraint octa_grupos_pkey,    add primary key (empresa_id, id);
alter table octaplus.octa_tags      drop constraint octa_tags_pkey,      add primary key (empresa_id, id);
alter table octaplus.mapa_filas     drop constraint mapa_filas_pkey,     add primary key (empresa_id, tipo_entrega);
alter table octaplus.nao_perturbe
  drop constraint nao_perturbe_telefone_key, drop constraint nao_perturbe_client_id_key,
  add unique (empresa_id, telefone), add unique (empresa_id, client_id);

create index on octaplus.automacoes (empresa_id);
create index on octaplus.envios (empresa_id, telefone, enviado_em desc);
create index on octaplus.eventos (empresa_id, recebido_em desc);
create index on octaplus.execucoes (empresa_id, concluido_em desc);

-- ---------------------------------------------------------------------
-- RLS: só a empresa atual, e só com permissão nela
-- ---------------------------------------------------------------------
do $$
declare p record;
begin
  for p in select tablename, policyname from pg_policies where schemaname = 'octaplus' loop
    execute format('drop policy %I on octaplus.%I', p.policyname, p.tablename);
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array['configuracao', 'integracao_octadesk', 'octa_numeros', 'octa_templates', 'octa_grupos',
    'octa_tags', 'mapa_filas', 'automacoes', 'automacao_acoes', 'eventos', 'execucoes', 'envios', 'nao_perturbe',
    'chaves_api', 'chamadas_api'] loop
    execute format('create policy ver on octaplus.%I for select using (empresa_id = octaplus.empresa_atual() and octaplus.pode(''ver''))', t);
  end loop;
  -- escrita direta do painel (o resto passa por funções)
  foreach t in array array['configuracao', 'octa_numeros', 'automacoes'] loop
    execute format('create policy editar on octaplus.%I for update using (empresa_id = octaplus.empresa_atual() and octaplus.pode(''editar'')) with check (empresa_id = octaplus.empresa_atual())', t);
  end loop;
  foreach t in array array['mapa_filas', 'nao_perturbe'] loop
    execute format('create policy editar on octaplus.%I for all using (empresa_id = octaplus.empresa_atual() and octaplus.pode(''editar'')) with check (empresa_id = octaplus.empresa_atual() and octaplus.pode(''editar''))', t);
  end loop;
end $$;

alter table octaplus.empresas enable row level security;
alter table octaplus.membros  enable row level security;
create policy ver on octaplus.empresas for select using (octaplus.pode_na(id, 'ver'));
create policy ver on octaplus.membros  for select using (octaplus.e_dono() or user_id = auth.uid());
-- empresas e vínculos só mudam pelas funções da área Owner
grant select on octaplus.empresas, octaplus.membros to authenticated;
revoke insert, update, delete on octaplus.empresas, octaplus.membros from anon, authenticated;

revoke execute on function octaplus.empresa_atual(), octaplus.e_dono(), octaplus.pode_na(uuid, text) from public, anon;
grant execute on function octaplus.empresa_atual(), octaplus.e_dono(), octaplus.pode_na(uuid, text) to authenticated;

-- ===== migrations/20260924000002_octaplus_motor_multiempresa.sql =====
-- =====================================================================
-- Octadesk Plus — motor e RPCs do painel por empresa.
-- Motor: a empresa vem da automação, do segredo do webhook ou da chave de API — nunca do header.
-- Painel: a empresa é a atual (header x-empresa), já garantida pelo pode().
-- =====================================================================

-- Assinaturas que mudam: sai a versão de empresa única
drop function octaplus.proximo_horario_util(timestamptz);
drop function octaplus.credenciais_octadesk();
drop function octaplus.gravar_jwt(text, timestamptz);
drop function octaplus.gravar_catalogos(jsonb);

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function octaplus.proximo_horario_util(p_em timestamptz, p_empresa uuid) returns timestamptz
language plpgsql stable security definer set search_path = octaplus as $$
declare c configuracao; local_ts timestamp; dia jsonb; w jsonb; ini time; fim time; i int;
begin
  select * into c from configuracao where empresa_id = p_empresa;
  if c.horario_comercial -> 'perDay' is null then return p_em; end if;
  local_ts := p_em at time zone c.fuso;
  for i in 0..14 loop
    dia := c.horario_comercial -> 'perDay' -> extract(dow from local_ts)::text;
    if coalesce((dia ->> 'enabled')::boolean, false) then
      for w in select value from jsonb_array_elements(coalesce(dia -> 'windows', '[]')) order by value ->> 'start' loop
        ini := (w ->> 'start')::time; fim := (w ->> 'end')::time;
        if local_ts::time < ini then return (local_ts::date + ini) at time zone c.fuso; end if;
        if local_ts::time < fim then return local_ts at time zone c.fuso; end if;
      end loop;
    end if;
    local_ts := (local_ts::date + 1)::timestamp;
  end loop;
  return p_em;
end $$;

-- ---------------------------------------------------------------------
-- Funil único de eventos (regras dentro da empresa da automação)
-- ---------------------------------------------------------------------
create or replace function octaplus.registrar_evento(
  p_automacao uuid, p_dedupe text, p_cliente uuid, p_contato text, p_conversa text,
  p_telefone text, p_nome text, p_dados jsonb
) returns jsonb
language plpgsql security definer set search_path = octaplus, public as $$
declare
  a automacoes; cfg configuracao; ctx jsonb := '{}'; tel text; contato text; dados jsonb;
  motivo text; eid uuid; t timestamptz; act automacao_acoes; n int := 0; manda_mensagem boolean;
begin
  select * into a from automacoes where id = p_automacao;
  if a.id is null or not a.ativa or a.arquivada_em is not null then
    return jsonb_build_object('ok', false, 'motivo', 'automacao_inativa');
  end if;
  if not exists (select 1 from empresas where id = a.empresa_id and ativa) then
    return jsonb_build_object('ok', false, 'motivo', 'empresa_inativa');
  end if;
  select * into cfg from configuracao where empresa_id = a.empresa_id;

  if p_cliente is not null then ctx := coalesce(contexto_cliente(p_cliente), '{}'); end if;
  tel := coalesce(normalizar_telefone(p_telefone), ctx ->> 'telefone');
  contato := coalesce(p_contato, ctx ->> 'octadesk_contact_id');
  ctx := ctx || jsonb_strip_nulls(jsonb_build_object('telefone', tel, 'nome', coalesce(ctx ->> 'nome', p_nome)));
  if ctx ->> 'primeiro_nome' is null and ctx ->> 'nome' is not null then
    ctx := ctx || jsonb_build_object('primeiro_nome', initcap(split_part(trim(ctx ->> 'nome'), ' ', 1)));
  end if;
  dados := jsonb_build_object('cliente', ctx, 'evento', coalesce(p_dados, '{}'));

  select exists (select 1 from automacao_acoes where automacao_id = a.id and tipo in ('enviar_template', 'enviar_mensagem'))
    into manda_mensagem;

  motivo := case
    when not exists (select 1 from automacao_acoes where automacao_id = a.id) then 'sem_acoes'
    when manda_mensagem and tel is null then 'telefone_invalido'
    when exists (select 1 from nao_perturbe np where np.empresa_id = a.empresa_id
                   and (np.telefone = tel or (p_cliente is not null and np.client_id = p_cliente)))
      then 'nao_perturbe'
    when not atende_condicoes(a.condicoes, dados) then 'condicoes'
    when manda_mensagem and cfg.limite_contato_horas > 0 and (
      exists (select 1 from envios e where e.empresa_id = a.empresa_id and e.telefone = tel and e.tipo <> 'nota'
                and e.enviado_em > now() - make_interval(hours => cfg.limite_contato_horas))
      or exists (select 1 from execucoes x join eventos ev on ev.id = x.evento_id
                 join automacao_acoes aa on aa.id = x.acao_id
                 where x.empresa_id = a.empresa_id and ev.telefone = tel and x.status in ('pendente', 'executando')
                   and aa.tipo in ('enviar_template', 'enviar_mensagem')))
      then 'limite_contato'
  end;

  insert into eventos (empresa_id, automacao_id, dedupe_key, client_id, octadesk_contact_id, conversa_id, telefone, nome, dados, situacao, motivo)
  values (a.empresa_id, a.id, p_dedupe, p_cliente, contato, p_conversa, tel, ctx ->> 'nome', dados,
          case when motivo is null then 'agendado' else 'ignorado' end, motivo)
  on conflict (automacao_id, dedupe_key) do nothing
  returning id into eid;

  if eid is null then return jsonb_build_object('ok', true, 'motivo', 'duplicado'); end if;
  if motivo is not null then return jsonb_build_object('ok', true, 'evento_id', eid, 'ignorado', motivo); end if;

  t := now() + intervalo(a.atraso_valor, a.atraso_unidade);
  for act in select * from automacao_acoes where automacao_id = a.id order by posicao loop
    t := t + intervalo(act.espera_valor, act.espera_unidade);
    insert into execucoes (empresa_id, automacao_id, acao_id, evento_id, agendado_para)
    values (a.empresa_id, a.id, act.id, eid,
            case when a.respeitar_horario and act.tipo in ('enviar_template', 'enviar_mensagem')
                 then proximo_horario_util(t, a.empresa_id) else t end);
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'evento_id', eid, 'execucoes', n);
end $$;

-- ---------------------------------------------------------------------
-- Entradas
-- ---------------------------------------------------------------------

-- Webhooks de conversa do Octadesk: o segredo do caminho da URL identifica a empresa.
create or replace function octaplus.receber_octadesk(p_segredo text, p_evento text, p_dados jsonb)
returns jsonb language plpgsql security definer set search_path = octaplus, public as $$
declare
  emp uuid; alvo tipo_gatilho; a automacoes; contato text; tel text; cliente uuid; sala text; chave text;
  msg jsonb; total int := 0; conversa jsonb;
begin
  select empresa_id into emp from integracao_octadesk where segredo_webhook = coalesce(p_segredo, '');
  if emp is null then return jsonb_build_object('ok', false, 'motivo', 'nao_autorizado'); end if;
  alvo := case p_evento
    when 'room.after-close'          then 'octa_conversa_encerrada'
    when 'room.after-set-agent'      then 'octa_conversa_atribuida'
    when 'room.after-insert-message' then 'octa_nova_mensagem'
  end;
  if alvo is null then return jsonb_build_object('ok', true, 'motivo', 'evento_nao_usado'); end if;

  sala    := p_dados ->> 'id';
  contato := p_dados #>> '{contact,id}';
  tel     := coalesce(p_dados #>> '{contact,phoneContacts,0,countryCode}', '') || coalesce(p_dados #>> '{contact,phoneContacts,0,number}', '');
  cliente := case when contato is not null then cliente_por_contato(contato) end;
  msg     := p_dados -> 'messages' -> -1;
  chave   := p_evento || ':' || sala || case when alvo = 'octa_nova_mensagem'
               then ':' || coalesce(msg ->> 'id', p_dados ->> 'lastMessageDate', '') else '' end;
  conversa := jsonb_strip_nulls(jsonb_build_object(
    'id', sala, 'numero', p_dados ->> 'number', 'status', p_dados ->> 'status',
    'agente', p_dados #>> '{agent,name}', 'agente_id', p_dados #>> '{agent,id}',
    'grupo', p_dados #>> '{group,name}', 'grupo_id', p_dados #>> '{group,id}',
    'origem', p_dados ->> 'origin', 'tags', p_dados -> 'tags',
    'ultima_mensagem', msg ->> 'body', 'ultima_mensagem_de', msg #>> '{sentBy,type}'));

  for a in select * from automacoes where empresa_id = emp and fonte = 'octadesk' and gatilho = alvo
             and ativa and arquivada_em is null loop
    perform registrar_evento(a.id, chave, cliente, contato, sala, tel, p_dados #>> '{contact,name}',
                             jsonb_build_object('conversa', conversa));
    total := total + 1;
  end loop;
  return jsonb_build_object('ok', true, 'automacoes', total);
end $$;

-- Rodada dos detectores: janela de cada empresa, empresas inativas de fora.
create or replace function octaplus.detectar_eventos(p_limite integer default 500) returns jsonb
language plpgsql security definer set search_path = octaplus, public as $$
declare a automacoes; c candidato; desde timestamptz; janela int; r jsonb; resumo jsonb := '{}'; n int;
begin
  for a in select au.* from automacoes au join empresas e on e.id = au.empresa_id
           where au.fonte = 'metrics' and au.ativa and au.arquivada_em is null and e.ativa loop
    select janela_deteccao_horas into janela from configuracao where empresa_id = a.empresa_id;
    desde := greatest(coalesce(a.ativa_desde, now()), now() - make_interval(hours => coalesce(janela, 48)));
    n := 0;
    for c in
      select * from candidatos(a, desde) k
      where not exists (select 1 from eventos e where e.automacao_id = a.id and e.dedupe_key = k.dedupe)
      limit p_limite
    loop
      r := registrar_evento(a.id, c.dedupe, c.client_id, c.contato, c.conversa, c.telefone, c.nome, c.dados);
      n := n + 1;
    end loop;
    resumo := resumo || jsonb_build_object(a.nome, n);
  end loop;
  return resumo;
end $$;

-- ---------------------------------------------------------------------
-- Motor (n8n)
-- ---------------------------------------------------------------------

-- Credenciais e estado da integração de uma empresa
create or replace function octaplus.credenciais_octadesk(p_empresa uuid) returns jsonb
language sql stable security definer set search_path = octaplus as $$
  select to_jsonb(i) - 'segredo_webhook' || jsonb_build_object(
    'api_key',  (select valor from segredos s where s.empresa_id = i.empresa_id and chave = 'octadesk_api_key'),
    'usuario',  (select valor from segredos s where s.empresa_id = i.empresa_id and chave = 'octadesk_usuario'),
    'senha',    (select valor from segredos s where s.empresa_id = i.empresa_id and chave = 'octadesk_senha'),
    'tenant',   (select valor from segredos s where s.empresa_id = i.empresa_id and chave = 'octadesk_tenant'),
    'jwt',      (select valor from segredos s where s.empresa_id = i.empresa_id and chave = 'octadesk_jwt'),
    'jwt_expira_em', (select expira_em from segredos s where s.empresa_id = i.empresa_id and chave = 'octadesk_jwt'),
    'catalogo_vencido', i.sincronizado_em is null or i.sincronizado_em < now() - interval '1 hour'
                        or i.sincronizacao_pedida_em > coalesce(i.sincronizado_em, '-infinity'))
  from integracao_octadesk i where i.empresa_id = p_empresa;
$$;

-- Manutenção do n8n: uma linha por empresa ativa com integração preenchida
create or replace function octaplus.credenciais_octadesk() returns setof jsonb
language sql stable security definer set search_path = octaplus as $$
  select credenciais_octadesk(e.id) from empresas e join integracao_octadesk i on i.empresa_id = e.id
  where e.ativa and i.base_url is not null order by e.criada_em;
$$;

create or replace function octaplus.gravar_jwt(p_empresa uuid, p_token text, p_expira_em timestamptz) returns void
language sql security definer set search_path = octaplus as $$
  insert into segredos (empresa_id, chave, valor, expira_em) values (p_empresa, 'octadesk_jwt', p_token, p_expira_em)
  on conflict (empresa_id, chave) do update set valor = excluded.valor, expira_em = excluded.expira_em, atualizado_em = now();
$$;

-- Resultado do /auth/check + catálogos de uma empresa. p = {ok, erro, numeros[], templates[], grupos[], tags[]}
create or replace function octaplus.gravar_catalogos(p_empresa uuid, p jsonb) returns void
language plpgsql security definer set search_path = octaplus as $$
begin
  if not coalesce((p ->> 'ok')::boolean, false) then
    update integracao_octadesk set status = 'erro', ultimo_erro = left(p ->> 'erro', 500), validado_em = now()
    where empresa_id = p_empresa;
    return;
  end if;

  insert into octa_numeros (empresa_id, id, nome, numero, ativo, sincronizado_em)
  select p_empresa, x ->> 'id', x ->> 'name', x ->> 'number', true, now() from jsonb_array_elements(coalesce(p -> 'numeros', '[]')) x
  on conflict (empresa_id, id) do update set nome = excluded.nome, numero = excluded.numero, ativo = true, sincronizado_em = now();
  update octa_numeros set ativo = false
  where empresa_id = p_empresa and id not in (select x ->> 'id' from jsonb_array_elements(coalesce(p -> 'numeros', '[]')) x);

  delete from octa_templates where empresa_id = p_empresa;
  insert into octa_templates (empresa_id, id, nome, status, categoria, habilitado, componentes, variaveis, corpo)
  select p_empresa, x ->> 'id', x ->> 'name', x ->> 'status', x ->> 'category', (x ->> 'enable')::boolean,
         coalesce(x -> 'components', '[]'),
         array(select distinct v ->> 'key' from jsonb_array_elements(coalesce(x -> 'components', '[]')) comp,
                    jsonb_array_elements(coalesce(comp -> 'variables', '[]')) v where v ->> 'key' is not null),
         (select comp ->> 'message' from jsonb_array_elements(coalesce(x -> 'components', '[]')) comp
          where upper(comp ->> 'type') = 'BODY' limit 1)
  from jsonb_array_elements(coalesce(p -> 'templates', '[]')) x;

  delete from octa_grupos where empresa_id = p_empresa;
  insert into octa_grupos (empresa_id, id, nome)
  select p_empresa, x ->> 'id', x ->> 'name' from jsonb_array_elements(coalesce(p -> 'grupos', '[]')) x;
  delete from octa_tags where empresa_id = p_empresa;
  insert into octa_tags (empresa_id, id, nome)
  select p_empresa, x ->> 'id', x ->> 'name' from jsonb_array_elements(coalesce(p -> 'tags', '[]')) x;

  update integracao_octadesk set status = 'conectado', ultimo_erro = null, validado_em = now(), sincronizado_em = now()
  where empresa_id = p_empresa;
end $$;

-- Saída do Code node de manutenção, um item por empresa: {empresa_id, catalogo?, jwt?: {token, expira_em}}
create or replace function octaplus.gravar_manutencao(p jsonb) returns void
language plpgsql security definer set search_path = octaplus as $$
declare emp uuid := (p ->> 'empresa_id')::uuid;
begin
  if emp is null then return; end if;
  if p ? 'catalogo' then perform gravar_catalogos(emp, p -> 'catalogo'); end if;
  if p #>> '{jwt,token}' is not null then
    perform gravar_jwt(emp, p #>> '{jwt,token}', (p #>> '{jwt,expira_em}')::timestamptz);
  end if;
end $$;

-- Execuções vencidas com a configuração e as credenciais da empresa de cada uma
create or replace function octaplus.pegar_execucoes(p_limite integer default 50) returns setof jsonb
language plpgsql security definer set search_path = octaplus as $$
begin
  update execucoes set status = 'pendente', travado_em = null
  where status = 'executando' and travado_em < now() - interval '10 minutes';

  return query
  with vencidas as (
    select x.id from execucoes x join empresas emp on emp.id = x.empresa_id and emp.ativa
    where x.status = 'pendente' and x.agendado_para <= now()
    order by x.agendado_para limit p_limite for update of x skip locked
  ), marcadas as (
    update execucoes x set status = 'executando', travado_em = now(), tentativas = x.tentativas + 1
    from vencidas where x.id = vencidas.id returning x.*
  )
  select jsonb_build_object(
    'execucao_id', m.id, 'tentativas', m.tentativas, 'empresa_id', m.empresa_id,
    'automacao', jsonb_build_object('id', a.id, 'nome', a.nome),
    'acao', jsonb_build_object('id', ac.id, 'tipo', ac.tipo, 'posicao', ac.posicao, 'config', ac.config),
    'evento', jsonb_build_object('id', e.id, 'telefone', e.telefone, 'nome', e.nome, 'client_id', e.client_id,
                                 'octadesk_contact_id', e.octadesk_contact_id, 'conversa_id', e.conversa_id, 'dados', e.dados),
    'numero_padrao', cfg.numero_envio_padrao,
    'fila', case when ac.tipo = 'transferir_fila' then coalesce(
              nullif(ac.config ->> 'grupo_id', ''),
              (select f.grupo_id from mapa_filas f where f.empresa_id = m.empresa_id
                 and upper(f.tipo_entrega) = upper(e.dados #>> '{cliente,tipo_entrega}')),
              (select f.grupo_id from mapa_filas f where f.empresa_id = m.empresa_id and f.tipo_entrega = '*')) end,
    'octadesk', credenciais_octadesk(m.empresa_id))
  from marcadas m
  join automacoes a on a.id = m.automacao_id
  join automacao_acoes ac on ac.id = m.acao_id
  join eventos e on e.id = m.evento_id
  left join configuracao cfg on cfg.empresa_id = m.empresa_id;
end $$;

create or replace function octaplus.concluir_execucao(
  p_execucao uuid, p_status text, p_resultado jsonb default null, p_erro text default null, p_codigo text default null
) returns void language plpgsql security definer set search_path = octaplus as $$
declare x execucoes; ev eventos; st status_execucao := p_status::status_execucao;
begin
  select * into x from execucoes where id = p_execucao;
  if x.id is null then return; end if;

  if st = 'pendente' and x.tentativas < 3 then
    update execucoes set status = 'pendente', erro = p_erro, codigo_erro = p_codigo, travado_em = null,
                         agendado_para = now() + make_interval(mins => 5 * x.tentativas)
    where id = x.id;
    return;
  end if;
  if st = 'pendente' then st := 'erro'; end if;

  update execucoes set status = st, resultado = p_resultado, erro = p_erro, codigo_erro = p_codigo,
                       concluido_em = now(), travado_em = null
  where id = x.id;

  if st = 'sucesso' then
    select * into ev from eventos where id = x.evento_id;
    if p_resultado ->> 'room_key' is not null and ev.conversa_id is null then
      update eventos set conversa_id = p_resultado ->> 'room_key' where id = ev.id;
    end if;
    if p_resultado ? 'envio' then
      insert into envios (empresa_id, execucao_id, automacao_id, client_id, telefone, tipo, template_id, numero_origem, room_key, message_key)
      values (x.empresa_id, x.id, x.automacao_id, ev.client_id, ev.telefone, p_resultado #>> '{envio,tipo}', p_resultado #>> '{envio,template_id}',
              p_resultado #>> '{envio,numero_origem}', coalesce(p_resultado ->> 'room_key', ev.conversa_id), p_resultado ->> 'message_key');
    end if;
  end if;
end $$;

-- API pública: a chave diz a empresa
create or replace function octaplus.api_formatar_telefone(p_segredo text, p_telefone text) returns jsonb
language plpgsql security definer set search_path = octaplus, extensions, public as $$
declare k chaves_api; formatado text;
begin
  select c.* into k from chaves_api c join empresas e on e.id = c.empresa_id and e.ativa
  where c.hash = encode(digest(coalesce(p_segredo, ''), 'sha256'), 'hex') and c.revogada_em is null;
  if k.id is null then return jsonb_build_object('ok', false, 'error', 'invalid_api_key'); end if;
  formatado := normalizar_telefone(p_telefone);
  update chaves_api set usado_em = now() where id = k.id;
  insert into chamadas_api (empresa_id, chave_id, endpoint, ok) values (k.empresa_id, k.id, '/v1/format', formatado is not null);
  return jsonb_build_object('ok', formatado is not null, 'input', p_telefone, 'e164', formatado,
                            'digits', regexp_replace(coalesce(formatado, ''), '\D', '', 'g'));
end $$;

-- ---------------------------------------------------------------------
-- RPCs do painel (empresa atual)
-- ---------------------------------------------------------------------
create or replace function octaplus.salvar_automacao(p jsonb) returns uuid
language plpgsql security definer set search_path = octaplus as $$
declare aid uuid := nullif(p ->> 'id', '')::uuid; emp uuid := empresa_atual(); x jsonb; i int := 0;
begin
  if not pode('editar') then raise exception 'sem_permissao'; end if;
  if aid is null then
    insert into automacoes (empresa_id, nome, fonte, gatilho, criado_por)
    values (emp, p ->> 'nome', (p ->> 'fonte')::fonte_gatilho, (p ->> 'gatilho')::tipo_gatilho, auth.uid())
    returning id into aid;
  elsif not exists (select 1 from automacoes where id = aid and empresa_id = emp) then
    raise exception 'nao_encontrado';
  end if;

  update automacoes set
    nome              = coalesce(p ->> 'nome', nome),
    ativa             = coalesce((p ->> 'ativa')::boolean, ativa),
    fonte             = coalesce((p ->> 'fonte')::fonte_gatilho, fonte),
    gatilho           = coalesce((p ->> 'gatilho')::tipo_gatilho, gatilho),
    parametros        = coalesce(p -> 'parametros', parametros),
    condicoes         = coalesce(p -> 'condicoes', condicoes),
    respeitar_horario = coalesce((p ->> 'respeitar_horario')::boolean, respeitar_horario),
    atraso_valor      = coalesce((p ->> 'atraso_valor')::int, atraso_valor),
    atraso_unidade    = coalesce((p ->> 'atraso_unidade')::unidade_tempo, atraso_unidade),
    campo_telefone    = coalesce(p ->> 'campo_telefone', campo_telefone),
    atualizado_em     = now()
  where id = aid;

  if p ? 'acoes' then
    delete from automacao_acoes where automacao_id = aid;
    for x in select * from jsonb_array_elements(p -> 'acoes') loop
      insert into automacao_acoes (empresa_id, automacao_id, posicao, tipo, config, espera_valor, espera_unidade)
      values (emp, aid, i, (x ->> 'tipo')::tipo_acao, coalesce(x -> 'config', '{}'),
              case when i = 0 then 0 else coalesce((x ->> 'espera_valor')::int, 0) end,
              coalesce(nullif(x ->> 'espera_unidade', ''), 'minutos')::unidade_tempo);
      i := i + 1;
    end loop;
  end if;
  return aid;
end $$;

create or replace function octaplus.duplicar_automacao(p_id uuid) returns uuid
language plpgsql security definer set search_path = octaplus as $$
declare nova uuid; emp uuid := empresa_atual();
begin
  if not pode('editar') then raise exception 'sem_permissao'; end if;
  insert into automacoes (empresa_id, nome, ativa, fonte, gatilho, parametros, condicoes, respeitar_horario,
                          atraso_valor, atraso_unidade, campo_telefone, payload_exemplo, criado_por)
  select emp, nome || ' (cópia)', false, fonte, gatilho, parametros, condicoes, respeitar_horario,
         atraso_valor, atraso_unidade, campo_telefone, payload_exemplo, auth.uid()
  from automacoes where id = p_id and empresa_id = emp returning id into nova;
  if nova is null then raise exception 'nao_encontrado'; end if;
  insert into automacao_acoes (empresa_id, automacao_id, posicao, tipo, config, espera_valor, espera_unidade)
  select emp, nova, posicao, tipo, config, espera_valor, espera_unidade from automacao_acoes where automacao_id = p_id;
  return nova;
end $$;

-- p = {base_url, subdominio, agente_email, api_privada_ativa, api_key?, usuario?, senha?, tenant?}
create or replace function octaplus.salvar_integracao(p jsonb) returns void
language plpgsql security definer set search_path = octaplus as $$
declare k text; emp uuid := empresa_atual();
begin
  if not pode('editar') then raise exception 'sem_permissao'; end if;
  update integracao_octadesk set
    base_url          = coalesce(nullif(rtrim(p ->> 'base_url', '/'), ''), base_url),
    subdominio        = coalesce(nullif(p ->> 'subdominio', ''), subdominio),
    agente_email      = coalesce(nullif(p ->> 'agente_email', ''), agente_email),
    api_privada_ativa = coalesce((p ->> 'api_privada_ativa')::boolean, api_privada_ativa),
    status = 'validando', ultimo_erro = null, sincronizacao_pedida_em = now()
  where empresa_id = emp;
  foreach k in array array['api_key', 'usuario', 'senha', 'tenant'] loop
    if coalesce(p ->> k, '') <> '' then
      insert into segredos (empresa_id, chave, valor) values (emp, 'octadesk_' || k, p ->> k)
      on conflict (empresa_id, chave) do update set valor = excluded.valor, atualizado_em = now();
      if k in ('usuario', 'senha', 'tenant') then delete from segredos where empresa_id = emp and chave = 'octadesk_jwt'; end if;
    end if;
  end loop;
end $$;

create or replace function octaplus.pedir_sincronizacao() returns void
language plpgsql security definer set search_path = octaplus as $$
begin
  if not pode('editar') then raise exception 'sem_permissao'; end if;
  update integracao_octadesk set sincronizacao_pedida_em = now() where empresa_id = empresa_atual();
end $$;

create or replace function octaplus.segredos_preenchidos() returns text[]
language sql stable security definer set search_path = octaplus as $$
  select case when pode('ver')
    then array(select chave from segredos where empresa_id = empresa_atual() and chave <> 'octadesk_jwt') else '{}' end;
$$;

create or replace function octaplus.criar_chave_api(p_nome text) returns jsonb
language plpgsql security definer set search_path = octaplus, extensions, public as $$
declare segredo text := 'br_live_' || encode(gen_random_bytes(24), 'hex'); kid uuid;
begin
  if not pode('editar') then raise exception 'sem_permissao'; end if;
  insert into chaves_api (empresa_id, nome, prefixo, hash, criado_por)
  values (empresa_atual(), p_nome, left(segredo, 12), encode(digest(segredo, 'sha256'), 'hex'), auth.uid()) returning id into kid;
  return jsonb_build_object('id', kid, 'segredo', segredo);   -- aparece uma vez só
end $$;

create or replace function octaplus.revogar_chave_api(p_id uuid) returns void
language plpgsql security definer set search_path = octaplus as $$
begin
  if not pode('editar') then raise exception 'sem_permissao'; end if;
  update chaves_api set revogada_em = now() where id = p_id and empresa_id = empresa_atual();
end $$;

create or replace function octaplus.estatisticas_diarias(p_de date, p_ate date, p_automacao uuid default null)
returns table (
  dia date, gatilhos bigint, gatilhos_ignorados bigint, acoes bigint, acoes_sucesso bigint,
  acoes_sem_envio bigint, acoes_erro bigint, envios bigint, respostas bigint, compras bigint, valor_compras numeric
) language sql stable security definer set search_path = octaplus as $$
  with emp as (select empresa_atual() id),
  dias as (select generate_series(p_de, p_ate, interval '1 day')::date d),
  ev as (select (recebido_em at time zone 'America/Sao_Paulo')::date d, count(*) n, count(*) filter (where situacao = 'ignorado') ign
         from eventos where empresa_id = (select id from emp) and (p_automacao is null or automacao_id = p_automacao)
           and recebido_em >= p_de::timestamp at time zone 'America/Sao_Paulo'
         group by 1),
  ex as (select (concluido_em at time zone 'America/Sao_Paulo')::date d, count(*) n,
                count(*) filter (where status = 'sucesso') ok, count(*) filter (where status = 'ignorado') sem,
                count(*) filter (where status = 'erro') err
         from execucoes where empresa_id = (select id from emp) and concluido_em is not null
           and (p_automacao is null or automacao_id = p_automacao)
           and concluido_em >= p_de::timestamp at time zone 'America/Sao_Paulo'
         group by 1),
  en as (select (enviado_em at time zone 'America/Sao_Paulo')::date d, count(*) filter (where tipo <> 'nota') n,
                count(respondeu_em) resp, count(comprou_em) comp, coalesce(sum(valor_compra), 0) valor
         from envios where empresa_id = (select id from emp) and (p_automacao is null or automacao_id = p_automacao)
           and enviado_em >= p_de::timestamp at time zone 'America/Sao_Paulo'
         group by 1)
  select dias.d, coalesce(ev.n, 0), coalesce(ev.ign, 0), coalesce(ex.n, 0), coalesce(ex.ok, 0), coalesce(ex.sem, 0),
         coalesce(ex.err, 0), coalesce(en.n, 0), coalesce(en.resp, 0), coalesce(en.comp, 0), coalesce(en.valor, 0)
  from dias left join ev on ev.d = dias.d left join ex on ex.d = dias.d left join en on en.d = dias.d
  where pode('ver')
  order by dias.d;
$$;

create or replace function octaplus.resumo_automacoes()
returns table (automacao_id uuid, executadas bigint, erros bigint, sem_envio bigint, ultima_execucao timestamptz,
               envios bigint, respostas bigint, compras bigint)
language sql stable security definer set search_path = octaplus as $$
  select a.id,
    (select count(*) from execucoes x where x.automacao_id = a.id and x.status = 'sucesso'),
    (select count(*) from execucoes x where x.automacao_id = a.id and x.status = 'erro'),
    (select count(*) from execucoes x where x.automacao_id = a.id and x.status = 'ignorado')
      + (select count(*) from eventos e where e.automacao_id = a.id and e.situacao = 'ignorado'),
    (select max(x.concluido_em) from execucoes x where x.automacao_id = a.id),
    (select count(*) from envios v where v.automacao_id = a.id and v.tipo <> 'nota'),
    (select count(respondeu_em) from envios v where v.automacao_id = a.id),
    (select count(comprou_em) from envios v where v.automacao_id = a.id)
  from automacoes a where a.empresa_id = empresa_atual() and pode('ver');
$$;

-- ---------------------------------------------------------------------
-- Acesso
-- ---------------------------------------------------------------------
revoke execute on function
  octaplus.proximo_horario_util(timestamptz, uuid), octaplus.credenciais_octadesk(uuid), octaplus.credenciais_octadesk(),
  octaplus.gravar_jwt(uuid, text, timestamptz), octaplus.gravar_catalogos(uuid, jsonb), octaplus.gravar_manutencao(jsonb)
from public, anon, authenticated;

-- ===== migrations/20260924000003_octaplus_owner.sql =====
-- =====================================================================
-- Octadesk Plus — área Owner (Configurações › Owner) e listas de empresas/usuários.
-- Só o dono da plataforma cadastra, inativa e apaga empresas e gerencia os usuários de cada uma.
-- As contas são criadas direto no Auth do Supabase (auth.users + auth.identities), com e-mail já
-- confirmado: assim o painel não precisa da secret key nem de Edge Function.
-- =====================================================================

-- Empresas que o usuário logado pode abrir (dono: todas, inclusive inativas)
create or replace function octaplus.listar_empresas()
returns table (id uuid, nome text, ativa boolean, cnpj text, telefone text, site text, criada_em timestamptz, nivel text)
language sql stable security definer set search_path = octaplus, public as $$
  select e.id, e.nome, e.ativa, e.cnpj, e.telefone, e.site, e.criada_em, 'dono'
  from empresas e where e_dono()
  union all
  select e.id, e.nome, e.ativa, e.cnpj, e.telefone, e.site, e.criada_em, m.nivel
  from empresas e join membros m on m.empresa_id = e.id
  where not e_dono() and m.user_id = auth.uid() and m.ativo and e.ativa
  order by 2;
$$;

-- Cria (só o dono) ou atualiza a empresa. Quem edita a empresa muda os dados cadastrais; o nome, só o dono.
-- p = {id?, nome, cnpj?, telefone?, site?}
create or replace function octaplus.salvar_empresa(p jsonb) returns uuid
language plpgsql security definer set search_path = octaplus, extensions, public as $$
declare eid uuid := nullif(p ->> 'id', '')::uuid; v_cnpj text := nullif(regexp_replace(coalesce(p ->> 'cnpj', ''), '\D', '', 'g'), '');
begin
  if eid is null then
    if not e_dono() then raise exception 'sem_permissao'; end if;
    insert into empresas (nome, cnpj, telefone, site)
    values (btrim(p ->> 'nome'), v_cnpj, nullif(p ->> 'telefone', ''), nullif(p ->> 'site', ''))
    returning id into eid;
    insert into configuracao (empresa_id) values (eid);
    insert into integracao_octadesk (empresa_id) values (eid);
    return eid;
  end if;

  if not pode_na(eid, 'editar') then raise exception 'sem_permissao'; end if;
  update empresas set
    nome     = case when e_dono() and coalesce(btrim(p ->> 'nome'), '') <> '' then btrim(p ->> 'nome') else nome end,
    cnpj     = case when p ? 'cnpj' then v_cnpj else cnpj end,
    telefone = case when p ? 'telefone' then nullif(p ->> 'telefone', '') else telefone end,
    site     = case when p ? 'site' then nullif(p ->> 'site', '') else site end
  where id = eid;
  return eid;
end $$;

create or replace function octaplus.definir_empresa_ativa(p_empresa uuid, p_ativa boolean) returns void
language plpgsql security definer set search_path = octaplus as $$
begin
  if not e_dono() then raise exception 'sem_permissao'; end if;
  update empresas set ativa = p_ativa where id = p_empresa;
end $$;

-- Apaga a empresa e tudo dela (automações, eventos, envios, integração, vínculos). Exige digitar o nome.
create or replace function octaplus.apagar_empresa(p_empresa uuid, p_confirmacao text) returns void
language plpgsql security definer set search_path = octaplus as $$
begin
  if not e_dono() then raise exception 'sem_permissao'; end if;
  if not exists (select 1 from empresas where id = p_empresa and lower(btrim(nome)) = lower(btrim(coalesce(p_confirmacao, '')))) then
    raise exception 'confirmacao_invalida';
  end if;
  delete from empresas where id = p_empresa;
end $$;

-- Usuários de uma empresa (área Owner)
create or replace function octaplus.listar_membros(p_empresa uuid)
returns table (user_id uuid, nome text, email text, nivel text, ativo boolean, criado_em timestamptz, ultimo_acesso timestamptz)
language plpgsql stable security definer set search_path = octaplus, public as $$
begin
  if not e_dono() then return; end if;
  return query
    select m.user_id, p.full_name, coalesce(p.email, u.email)::text, m.nivel, m.ativo, m.criado_em, u.last_sign_in_at
    from membros m
    left join public.profiles p on p.id = m.user_id
    left join auth.users u on u.id = m.user_id
    where m.empresa_id = p_empresa
    order by coalesce(p.full_name, p.email, u.email);
end $$;

-- Usuários da empresa atual (aba Usuários, só leitura para quem tem acesso)
drop function octaplus.listar_usuarios();
create function octaplus.listar_usuarios()
returns table (id uuid, nome text, email text, nivel text, ativo boolean)
language plpgsql stable security definer set search_path = octaplus, public as $$
begin
  if not pode('ver') then return; end if;
  return query
    select m.user_id, p.full_name, coalesce(p.email, u.email)::text, m.nivel, m.ativo
    from membros m
    left join public.profiles p on p.id = m.user_id
    left join auth.users u on u.id = m.user_id
    where m.empresa_id = empresa_atual()
    order by coalesce(p.full_name, p.email, u.email);
end $$;

-- Cria a conta (ou reaproveita a que já existe com o e-mail) e dá acesso à empresa.
create or replace function octaplus.criar_usuario(p_empresa uuid, p_email text, p_nome text, p_senha text, p_nivel text default 'ver')
returns uuid
language plpgsql security definer set search_path = octaplus, extensions, public as $$
declare uid uuid; mail text := lower(btrim(coalesce(p_email, '')));
begin
  if not e_dono() then raise exception 'sem_permissao'; end if;
  if mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'email_invalido'; end if;
  if p_nivel not in ('ver', 'editar') then raise exception 'nivel_invalido'; end if;
  if not exists (select 1 from empresas where id = p_empresa) then raise exception 'nao_encontrado'; end if;

  select id into uid from auth.users where lower(email) = mail;
  if uid is not null and public.has_role(uid, 'owner') then raise exception 'usuario_e_dono'; end if;

  if uid is null then
    if length(coalesce(p_senha, '')) < 8 then raise exception 'senha_curta'; end if;
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', mail,
            crypt(p_senha, gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', nullif(btrim(p_nome), '')),
            now(), now(), '', '', '', '');
    insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (uid::text, uid, jsonb_build_object('sub', uid::text, 'email', mail, 'email_verified', true),
            'email', now(), now(), now());
  end if;

  -- perfil (o gatilho da base já cria; num banco sem ele, cria aqui)
  insert into public.profiles (id, email, full_name) values (uid, mail, nullif(btrim(p_nome), ''))
  on conflict (id) do update set full_name = coalesce(public.profiles.full_name, excluded.full_name);

  insert into membros (empresa_id, user_id, nivel, ativo) values (p_empresa, uid, p_nivel, true)
  on conflict (empresa_id, user_id) do update set nivel = excluded.nivel, ativo = true;
  return uid;
end $$;

create or replace function octaplus.definir_nivel(p_empresa uuid, p_usuario uuid, p_nivel text) returns void
language plpgsql security definer set search_path = octaplus as $$
begin
  if not e_dono() then raise exception 'sem_permissao'; end if;
  if p_nivel not in ('ver', 'editar') then raise exception 'nivel_invalido'; end if;
  update membros set nivel = p_nivel where empresa_id = p_empresa and user_id = p_usuario;
end $$;

create or replace function octaplus.definir_membro_ativo(p_empresa uuid, p_usuario uuid, p_ativo boolean) returns void
language plpgsql security definer set search_path = octaplus as $$
begin
  if not e_dono() then raise exception 'sem_permissao'; end if;
  update membros set ativo = p_ativo where empresa_id = p_empresa and user_id = p_usuario;
end $$;

-- Nova senha definida pelo dono (a pessoa troca depois em Meu perfil)
create or replace function octaplus.redefinir_senha(p_usuario uuid, p_senha text) returns void
language plpgsql security definer set search_path = octaplus, extensions, public as $$
begin
  if not e_dono() then raise exception 'sem_permissao'; end if;
  if length(coalesce(p_senha, '')) < 8 then raise exception 'senha_curta'; end if;
  if public.has_role(p_usuario, 'owner') then raise exception 'usuario_e_dono'; end if;
  if not exists (select 1 from membros where user_id = p_usuario) then raise exception 'nao_encontrado'; end if;
  update auth.users set encrypted_password = crypt(p_senha, gen_salt('bf')), updated_at = now() where id = p_usuario;
end $$;

-- ---------------------------------------------------------------------
-- Acesso
-- ---------------------------------------------------------------------
revoke execute on function
  octaplus.listar_empresas(), octaplus.salvar_empresa(jsonb), octaplus.definir_empresa_ativa(uuid, boolean),
  octaplus.apagar_empresa(uuid, text), octaplus.listar_membros(uuid), octaplus.listar_usuarios(),
  octaplus.criar_usuario(uuid, text, text, text, text), octaplus.definir_nivel(uuid, uuid, text),
  octaplus.definir_membro_ativo(uuid, uuid, boolean), octaplus.redefinir_senha(uuid, text)
from public, anon;
grant execute on function
  octaplus.listar_empresas(), octaplus.salvar_empresa(jsonb), octaplus.definir_empresa_ativa(uuid, boolean),
  octaplus.apagar_empresa(uuid, text), octaplus.listar_membros(uuid), octaplus.listar_usuarios(),
  octaplus.criar_usuario(uuid, text, text, text, text), octaplus.definir_nivel(uuid, uuid, text),
  octaplus.definir_membro_ativo(uuid, uuid, boolean), octaplus.redefinir_senha(uuid, text)
to authenticated;

-- ===== migrations/20260924000004_octaplus_owner_usuarios.sql =====
-- =====================================================================
-- Octadesk Plus — área Owner: editar e apagar usuário de uma empresa.
-- Apagar tira o acesso àquela empresa; a conta continua (pode estar em outras empresas ou voltar depois).
-- =====================================================================

-- Nome (vale para todas as empresas da pessoa) e nível nesta empresa
create or replace function octaplus.editar_membro(p_empresa uuid, p_usuario uuid, p_nome text, p_nivel text) returns void
language plpgsql security definer set search_path = octaplus, public as $$
begin
  if not e_dono() then raise exception 'sem_permissao'; end if;
  if public.has_role(p_usuario, 'owner') then raise exception 'usuario_e_dono'; end if;
  if p_nivel not in ('ver', 'editar') then raise exception 'nivel_invalido'; end if;
  update membros set nivel = p_nivel where empresa_id = p_empresa and user_id = p_usuario;
  if not found then raise exception 'nao_encontrado'; end if;
  update public.profiles set full_name = nullif(btrim(p_nome), '') where id = p_usuario;
end $$;

create or replace function octaplus.remover_membro(p_empresa uuid, p_usuario uuid) returns void
language plpgsql security definer set search_path = octaplus, public as $$
begin
  if not e_dono() then raise exception 'sem_permissao'; end if;
  delete from membros where empresa_id = p_empresa and user_id = p_usuario;
  if not found then raise exception 'nao_encontrado'; end if;
end $$;

revoke execute on function octaplus.editar_membro(uuid, uuid, text, text), octaplus.remover_membro(uuid, uuid) from public, anon;
grant execute on function octaplus.editar_membro(uuid, uuid, text, text), octaplus.remover_membro(uuid, uuid) to authenticated;

-- ===== migrations/20260924000005_octaplus_perfis.sql =====
-- =====================================================================
-- Octadesk Plus — perfis de acesso por empresa, com permissão por área.
--
-- Áreas: automacoes · integracoes · empresa · usuarios · api · nao_perturbe
-- Cada área: 'nenhum' | 'ver' | 'editar'. O usuário tem um perfil em cada empresa (membros.perfil_id).
-- Quem tem "usuarios: editar" gerencia usuários e perfis da própria empresa; o dono da plataforma, de todas.
-- =====================================================================

create table octaplus.perfis (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null default octaplus.empresa_atual() references octaplus.empresas(id) on delete cascade,
  nome        text not null check (btrim(nome) <> ''),
  permissoes  jsonb not null default '{}'::jsonb,
  criado_em   timestamptz not null default now(),
  unique (empresa_id, nome)
);

create or replace function octaplus.areas() returns text[]
language sql immutable as $$ select array['automacoes', 'integracoes', 'empresa', 'usuarios', 'api', 'nao_perturbe'] $$;

-- Perfis que toda empresa ganha ao nascer. "Edita" e "Só vê" são os níveis de antes.
create or replace function octaplus.criar_perfis_padrao(p_empresa uuid) returns void
language sql security definer set search_path = octaplus as $$
  insert into perfis (empresa_id, nome, permissoes) values
    (p_empresa, 'Administrador', (select jsonb_object_agg(a, 'editar') from unnest(areas()) a)),
    (p_empresa, 'Edita', (select jsonb_object_agg(a, case when a = 'usuarios' then 'ver' else 'editar' end) from unnest(areas()) a)),
    (p_empresa, 'Só vê', (select jsonb_object_agg(a, 'ver') from unnest(areas()) a))
  on conflict (empresa_id, nome) do nothing;
$$;

select octaplus.criar_perfis_padrao(id) from octaplus.empresas;

alter table octaplus.membros add column perfil_id uuid references octaplus.perfis(id);
update octaplus.membros m set perfil_id = p.id from octaplus.perfis p
where p.empresa_id = m.empresa_id and p.nome = case m.nivel when 'editar' then 'Edita' else 'Só vê' end;
alter table octaplus.membros alter column perfil_id set not null;

-- ---------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------

-- O que o usuário logado pode numa área de uma empresa: dono = editar em tudo.
create or replace function octaplus.permissao(p_empresa uuid, p_area text) returns text
language sql stable security definer set search_path = public, octaplus as $$
  select case
    when auth.uid() is null or p_empresa is null then 'nenhum'
    when octaplus.e_dono() then 'editar'
    else coalesce((
      select coalesce(pf.permissoes ->> p_area, 'nenhum')
      from octaplus.membros m
      join octaplus.empresas e on e.id = m.empresa_id and e.ativa
      join octaplus.perfis pf on pf.id = m.perfil_id
      where m.empresa_id = p_empresa and m.user_id = auth.uid() and m.ativo), 'nenhum')
  end;
$$;

create or replace function octaplus.pode_area(p_empresa uuid, p_area text, p_acao text) returns boolean
language sql stable security definer set search_path = octaplus as $$
  select case octaplus.permissao(p_empresa, p_area) when 'editar' then true when 'ver' then p_acao = 'ver' else false end;
$$;

-- Vínculo com a empresa (qualquer perfil). 'editar' deixou de ter sentido fora de uma área.
create or replace function octaplus.pode_na(p_empresa uuid, p_acao text) returns boolean
language sql stable security definer set search_path = public, octaplus as $$
  select auth.uid() is not null and p_empresa is not null and p_acao = 'ver' and (
    octaplus.e_dono() or exists (
      select 1 from octaplus.membros m join octaplus.empresas e on e.id = m.empresa_id
      where m.empresa_id = p_empresa and m.user_id = auth.uid() and m.ativo and e.ativa));
$$;

alter table octaplus.membros drop column nivel;

-- Área na empresa atual (o que as policies usam)
create or replace function octaplus.pode_aqui(p_area text, p_acao text) returns boolean
language sql stable as $$ select octaplus.pode_area(octaplus.empresa_atual(), p_area, p_acao) $$;

-- ---------------------------------------------------------------------
-- RLS por área
-- ---------------------------------------------------------------------
do $$
declare p record;
begin
  for p in select tablename, policyname from pg_policies where schemaname = 'octaplus' and tablename not in ('empresas') loop
    execute format('drop policy %I on octaplus.%I', p.policyname, p.tablename);
  end loop;
end $$;

do $$
declare t text; ver text;
begin
  -- leitura: tabela -> condição
  for t, ver in values
    ('automacoes', 'octaplus.pode_aqui(''automacoes'', ''ver'')'),
    ('automacao_acoes', 'octaplus.pode_aqui(''automacoes'', ''ver'')'),
    ('eventos', 'octaplus.pode_aqui(''automacoes'', ''ver'')'),
    ('execucoes', 'octaplus.pode_aqui(''automacoes'', ''ver'')'),
    ('envios', 'octaplus.pode_aqui(''automacoes'', ''ver'')'),
    ('integracao_octadesk', '(octaplus.pode_aqui(''integracoes'', ''ver'') or octaplus.pode_aqui(''automacoes'', ''ver''))'),
    ('configuracao', 'octaplus.pode(''ver'')'),
    ('octa_numeros', 'octaplus.pode(''ver'')'),
    ('octa_templates', 'octaplus.pode(''ver'')'),
    ('octa_grupos', 'octaplus.pode(''ver'')'),
    ('octa_tags', 'octaplus.pode(''ver'')'),
    ('mapa_filas', 'octaplus.pode(''ver'')'),
    ('perfis', 'octaplus.pode(''ver'')'),
    ('nao_perturbe', 'octaplus.pode_aqui(''nao_perturbe'', ''ver'')'),
    ('chaves_api', 'octaplus.pode_aqui(''api'', ''ver'')'),
    ('chamadas_api', 'octaplus.pode_aqui(''api'', ''ver'')')
  loop
    execute format('create policy ver on octaplus.%I for select using (empresa_id = octaplus.empresa_atual() and %s)', t, ver);
  end loop;
end $$;

-- escrita direta do painel (o resto passa por funções)
create policy editar on octaplus.automacoes for update
  using (empresa_id = octaplus.empresa_atual() and octaplus.pode_aqui('automacoes', 'editar')) with check (empresa_id = octaplus.empresa_atual());
create policy editar on octaplus.configuracao for update
  using (empresa_id = octaplus.empresa_atual() and (octaplus.pode_aqui('integracoes', 'editar') or octaplus.pode_aqui('empresa', 'editar')))
  with check (empresa_id = octaplus.empresa_atual());
create policy editar on octaplus.octa_numeros for update
  using (empresa_id = octaplus.empresa_atual() and octaplus.pode_aqui('integracoes', 'editar')) with check (empresa_id = octaplus.empresa_atual());
create policy editar on octaplus.mapa_filas for all
  using (empresa_id = octaplus.empresa_atual() and octaplus.pode_aqui('integracoes', 'editar'))
  with check (empresa_id = octaplus.empresa_atual() and octaplus.pode_aqui('integracoes', 'editar'));
create policy editar on octaplus.nao_perturbe for all
  using (empresa_id = octaplus.empresa_atual() and octaplus.pode_aqui('nao_perturbe', 'editar'))
  with check (empresa_id = octaplus.empresa_atual() and octaplus.pode_aqui('nao_perturbe', 'editar'));

create policy ver on octaplus.membros for select
  using (octaplus.e_dono() or user_id = auth.uid() or octaplus.pode_area(empresa_id, 'usuarios', 'ver'));

alter table octaplus.perfis enable row level security;
grant select on octaplus.perfis to authenticated;
revoke insert, update, delete on octaplus.perfis from anon, authenticated;

-- ---------------------------------------------------------------------
-- RPCs do painel: permissão da área certa
-- ---------------------------------------------------------------------
create or replace function octaplus.salvar_automacao(p jsonb) returns uuid
language plpgsql security definer set search_path = octaplus as $$
declare aid uuid := nullif(p ->> 'id', '')::uuid; emp uuid := empresa_atual(); x jsonb; i int := 0;
begin
  if not pode_area(emp, 'automacoes', 'editar') then raise exception 'sem_permissao'; end if;
  if aid is null then
    insert into automacoes (empresa_id, nome, fonte, gatilho, criado_por)
    values (emp, p ->> 'nome', (p ->> 'fonte')::fonte_gatilho, (p ->> 'gatilho')::tipo_gatilho, auth.uid())
    returning id into aid;
  elsif not exists (select 1 from automacoes where id = aid and empresa_id = emp) then
    raise exception 'nao_encontrado';
  end if;

  update automacoes set
    nome              = coalesce(p ->> 'nome', nome),
    ativa             = coalesce((p ->> 'ativa')::boolean, ativa),
    fonte             = coalesce((p ->> 'fonte')::fonte_gatilho, fonte),
    gatilho           = coalesce((p ->> 'gatilho')::tipo_gatilho, gatilho),
    parametros        = coalesce(p -> 'parametros', parametros),
    condicoes         = coalesce(p -> 'condicoes', condicoes),
    respeitar_horario = coalesce((p ->> 'respeitar_horario')::boolean, respeitar_horario),
    atraso_valor      = coalesce((p ->> 'atraso_valor')::int, atraso_valor),
    atraso_unidade    = coalesce((p ->> 'atraso_unidade')::unidade_tempo, atraso_unidade),
    campo_telefone    = coalesce(p ->> 'campo_telefone', campo_telefone),
    atualizado_em     = now()
  where id = aid;

  if p ? 'acoes' then
    delete from automacao_acoes where automacao_id = aid;
    for x in select * from jsonb_array_elements(p -> 'acoes') loop
      insert into automacao_acoes (empresa_id, automacao_id, posicao, tipo, config, espera_valor, espera_unidade)
      values (emp, aid, i, (x ->> 'tipo')::tipo_acao, coalesce(x -> 'config', '{}'),
              case when i = 0 then 0 else coalesce((x ->> 'espera_valor')::int, 0) end,
              coalesce(nullif(x ->> 'espera_unidade', ''), 'minutos')::unidade_tempo);
      i := i + 1;
    end loop;
  end if;
  return aid;
end $$;

create or replace function octaplus.duplicar_automacao(p_id uuid) returns uuid
language plpgsql security definer set search_path = octaplus as $$
declare nova uuid; emp uuid := empresa_atual();
begin
  if not pode_area(emp, 'automacoes', 'editar') then raise exception 'sem_permissao'; end if;
  insert into automacoes (empresa_id, nome, ativa, fonte, gatilho, parametros, condicoes, respeitar_horario,
                          atraso_valor, atraso_unidade, campo_telefone, payload_exemplo, criado_por)
  select emp, nome || ' (cópia)', false, fonte, gatilho, parametros, condicoes, respeitar_horario,
         atraso_valor, atraso_unidade, campo_telefone, payload_exemplo, auth.uid()
  from automacoes where id = p_id and empresa_id = emp returning id into nova;
  if nova is null then raise exception 'nao_encontrado'; end if;
  insert into automacao_acoes (empresa_id, automacao_id, posicao, tipo, config, espera_valor, espera_unidade)
  select emp, nova, posicao, tipo, config, espera_valor, espera_unidade from automacao_acoes where automacao_id = p_id;
  return nova;
end $$;

create or replace function octaplus.salvar_integracao(p jsonb) returns void
language plpgsql security definer set search_path = octaplus as $$
declare k text; emp uuid := empresa_atual();
begin
  if not pode_area(emp, 'integracoes', 'editar') then raise exception 'sem_permissao'; end if;
  update integracao_octadesk set
    base_url          = coalesce(nullif(rtrim(p ->> 'base_url', '/'), ''), base_url),
    subdominio        = coalesce(nullif(p ->> 'subdominio', ''), subdominio),
    agente_email      = coalesce(nullif(p ->> 'agente_email', ''), agente_email),
    api_privada_ativa = coalesce((p ->> 'api_privada_ativa')::boolean, api_privada_ativa),
    status = 'validando', ultimo_erro = null, sincronizacao_pedida_em = now()
  where empresa_id = emp;
  foreach k in array array['api_key', 'usuario', 'senha', 'tenant'] loop
    if coalesce(p ->> k, '') <> '' then
      insert into segredos (empresa_id, chave, valor) values (emp, 'octadesk_' || k, p ->> k)
      on conflict (empresa_id, chave) do update set valor = excluded.valor, atualizado_em = now();
      if k in ('usuario', 'senha', 'tenant') then delete from segredos where empresa_id = emp and chave = 'octadesk_jwt'; end if;
    end if;
  end loop;
end $$;

create or replace function octaplus.pedir_sincronizacao() returns void
language plpgsql security definer set search_path = octaplus as $$
begin
  if not pode_aqui('integracoes', 'editar') then raise exception 'sem_permissao'; end if;
  update integracao_octadesk set sincronizacao_pedida_em = now() where empresa_id = empresa_atual();
end $$;

create or replace function octaplus.segredos_preenchidos() returns text[]
language sql stable security definer set search_path = octaplus as $$
  select case when pode_aqui('integracoes', 'ver')
    then array(select chave from segredos where empresa_id = empresa_atual() and chave <> 'octadesk_jwt') else '{}' end;
$$;

create or replace function octaplus.criar_chave_api(p_nome text) returns jsonb
language plpgsql security definer set search_path = octaplus, extensions, public as $$
declare segredo text := 'br_live_' || encode(gen_random_bytes(24), 'hex'); kid uuid;
begin
  if not pode_aqui('api', 'editar') then raise exception 'sem_permissao'; end if;
  insert into chaves_api (empresa_id, nome, prefixo, hash, criado_por)
  values (empresa_atual(), p_nome, left(segredo, 12), encode(digest(segredo, 'sha256'), 'hex'), auth.uid()) returning id into kid;
  return jsonb_build_object('id', kid, 'segredo', segredo);
end $$;

create or replace function octaplus.revogar_chave_api(p_id uuid) returns void
language plpgsql security definer set search_path = octaplus as $$
begin
  if not pode_aqui('api', 'editar') then raise exception 'sem_permissao'; end if;
  update chaves_api set revogada_em = now() where id = p_id and empresa_id = empresa_atual();
end $$;

create or replace function octaplus.estatisticas_diarias(p_de date, p_ate date, p_automacao uuid default null)
returns table (
  dia date, gatilhos bigint, gatilhos_ignorados bigint, acoes bigint, acoes_sucesso bigint,
  acoes_sem_envio bigint, acoes_erro bigint, envios bigint, respostas bigint, compras bigint, valor_compras numeric
) language sql stable security definer set search_path = octaplus as $$
  with emp as (select empresa_atual() id),
  dias as (select generate_series(p_de, p_ate, interval '1 day')::date d),
  ev as (select (recebido_em at time zone 'America/Sao_Paulo')::date d, count(*) n, count(*) filter (where situacao = 'ignorado') ign
         from eventos where empresa_id = (select id from emp) and (p_automacao is null or automacao_id = p_automacao)
           and recebido_em >= p_de::timestamp at time zone 'America/Sao_Paulo'
         group by 1),
  ex as (select (concluido_em at time zone 'America/Sao_Paulo')::date d, count(*) n,
                count(*) filter (where status = 'sucesso') ok, count(*) filter (where status = 'ignorado') sem,
                count(*) filter (where status = 'erro') err
         from execucoes where empresa_id = (select id from emp) and concluido_em is not null
           and (p_automacao is null or automacao_id = p_automacao)
           and concluido_em >= p_de::timestamp at time zone 'America/Sao_Paulo'
         group by 1),
  en as (select (enviado_em at time zone 'America/Sao_Paulo')::date d, count(*) filter (where tipo <> 'nota') n,
                count(respondeu_em) resp, count(comprou_em) comp, coalesce(sum(valor_compra), 0) valor
         from envios where empresa_id = (select id from emp) and (p_automacao is null or automacao_id = p_automacao)
           and enviado_em >= p_de::timestamp at time zone 'America/Sao_Paulo'
         group by 1)
  select dias.d, coalesce(ev.n, 0), coalesce(ev.ign, 0), coalesce(ex.n, 0), coalesce(ex.ok, 0), coalesce(ex.sem, 0),
         coalesce(ex.err, 0), coalesce(en.n, 0), coalesce(en.resp, 0), coalesce(en.comp, 0), coalesce(en.valor, 0)
  from dias left join ev on ev.d = dias.d left join ex on ex.d = dias.d left join en on en.d = dias.d
  where pode_aqui('automacoes', 'ver')
  order by dias.d;
$$;

create or replace function octaplus.resumo_automacoes()
returns table (automacao_id uuid, executadas bigint, erros bigint, sem_envio bigint, ultima_execucao timestamptz,
               envios bigint, respostas bigint, compras bigint)
language sql stable security definer set search_path = octaplus as $$
  select a.id,
    (select count(*) from execucoes x where x.automacao_id = a.id and x.status = 'sucesso'),
    (select count(*) from execucoes x where x.automacao_id = a.id and x.status = 'erro'),
    (select count(*) from execucoes x where x.automacao_id = a.id and x.status = 'ignorado')
      + (select count(*) from eventos e where e.automacao_id = a.id and e.situacao = 'ignorado'),
    (select max(x.concluido_em) from execucoes x where x.automacao_id = a.id),
    (select count(*) from envios v where v.automacao_id = a.id and v.tipo <> 'nota'),
    (select count(respondeu_em) from envios v where v.automacao_id = a.id),
    (select count(comprou_em) from envios v where v.automacao_id = a.id)
  from automacoes a where a.empresa_id = empresa_atual() and pode_aqui('automacoes', 'ver');
$$;

-- ---------------------------------------------------------------------
-- Empresas (listar com as permissões; criar já com os perfis padrão)
-- ---------------------------------------------------------------------
drop function octaplus.listar_empresas();
create function octaplus.listar_empresas()
returns table (id uuid, nome text, ativa boolean, cnpj text, telefone text, site text, criada_em timestamptz,
               perfil text, permissoes jsonb)
language sql stable security definer set search_path = octaplus, public as $$
  select e.id, e.nome, e.ativa, e.cnpj, e.telefone, e.site, e.criada_em, 'Dono',
         (select jsonb_object_agg(a, 'editar') from unnest(areas()) a)
  from empresas e where e_dono()
  union all
  select e.id, e.nome, e.ativa, e.cnpj, e.telefone, e.site, e.criada_em, pf.nome, pf.permissoes
  from empresas e join membros m on m.empresa_id = e.id join perfis pf on pf.id = m.perfil_id
  where not e_dono() and m.user_id = auth.uid() and m.ativo and e.ativa
  order by 2;
$$;

create or replace function octaplus.salvar_empresa(p jsonb) returns uuid
language plpgsql security definer set search_path = octaplus, extensions, public as $$
declare eid uuid := nullif(p ->> 'id', '')::uuid; v_cnpj text := nullif(regexp_replace(coalesce(p ->> 'cnpj', ''), '\D', '', 'g'), '');
begin
  if eid is null then
    if not e_dono() then raise exception 'sem_permissao'; end if;
    insert into empresas (nome, cnpj, telefone, site)
    values (btrim(p ->> 'nome'), v_cnpj, nullif(p ->> 'telefone', ''), nullif(p ->> 'site', ''))
    returning id into eid;
    insert into configuracao (empresa_id) values (eid);
    insert into integracao_octadesk (empresa_id) values (eid);
    perform criar_perfis_padrao(eid);
    return eid;
  end if;

  if not pode_area(eid, 'empresa', 'editar') then raise exception 'sem_permissao'; end if;
  update empresas set
    nome     = case when e_dono() and coalesce(btrim(p ->> 'nome'), '') <> '' then btrim(p ->> 'nome') else nome end,
    cnpj     = case when p ? 'cnpj' then v_cnpj else cnpj end,
    telefone = case when p ? 'telefone' then nullif(p ->> 'telefone', '') else telefone end,
    site     = case when p ? 'site' then nullif(p ->> 'site', '') else site end
  where id = eid;
  return eid;
end $$;

-- ---------------------------------------------------------------------
-- Usuários da empresa: dono ou quem tem "usuarios: editar" nela
-- ---------------------------------------------------------------------
drop function octaplus.listar_membros(uuid);
drop function octaplus.listar_usuarios();
drop function octaplus.criar_usuario(uuid, text, text, text, text);
drop function octaplus.definir_nivel(uuid, uuid, text);
drop function octaplus.editar_membro(uuid, uuid, text, text);
drop function octaplus.redefinir_senha(uuid, text);

create or replace function octaplus.gerencia_usuarios(p_empresa uuid) returns boolean
language sql stable as $$ select octaplus.pode_area(p_empresa, 'usuarios', 'editar') $$;

-- Quem pode mexer nesta pessoa: nunca o dono da plataforma nem a si mesmo (para não se trancar para fora).
create or replace function octaplus.conferir_alvo(p_empresa uuid, p_usuario uuid) returns void
language plpgsql stable security definer set search_path = octaplus, public as $$
begin
  if not gerencia_usuarios(p_empresa) then raise exception 'sem_permissao'; end if;
  if public.has_role(p_usuario, 'owner') then raise exception 'usuario_e_dono'; end if;
  if p_usuario = auth.uid() then raise exception 'voce_mesmo'; end if;
  if not exists (select 1 from membros where empresa_id = p_empresa and user_id = p_usuario) then raise exception 'nao_encontrado'; end if;
end $$;

create function octaplus.listar_membros(p_empresa uuid)
returns table (user_id uuid, nome text, email text, perfil_id uuid, perfil text, ativo boolean, criado_em timestamptz,
               ultimo_acesso timestamptz, outras_empresas integer)
language plpgsql stable security definer set search_path = octaplus, public as $$
begin
  if not pode_area(p_empresa, 'usuarios', 'ver') then return; end if;
  return query
    select m.user_id, p.full_name, coalesce(p.email, u.email)::text, m.perfil_id, pf.nome, m.ativo, m.criado_em, u.last_sign_in_at,
           (select count(*)::int from membros o where o.user_id = m.user_id and o.empresa_id <> m.empresa_id)
    from membros m
    join perfis pf on pf.id = m.perfil_id
    left join public.profiles p on p.id = m.user_id
    left join auth.users u on u.id = m.user_id
    where m.empresa_id = p_empresa
    order by coalesce(p.full_name, p.email, u.email);
end $$;

-- Aba Usuários da empresa atual
create function octaplus.listar_usuarios()
returns table (user_id uuid, nome text, email text, perfil_id uuid, perfil text, ativo boolean, criado_em timestamptz,
               ultimo_acesso timestamptz, outras_empresas integer)
language sql stable security definer set search_path = octaplus as $$
  select * from octaplus.listar_membros(octaplus.empresa_atual());
$$;

create function octaplus.criar_usuario(p_empresa uuid, p_email text, p_nome text, p_senha text, p_perfil uuid)
returns uuid
language plpgsql security definer set search_path = octaplus, extensions, public as $$
declare uid uuid; mail text := lower(btrim(coalesce(p_email, '')));
begin
  if not gerencia_usuarios(p_empresa) then raise exception 'sem_permissao'; end if;
  if mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'email_invalido'; end if;
  if not exists (select 1 from perfis where id = p_perfil and empresa_id = p_empresa) then raise exception 'perfil_invalido'; end if;

  select id into uid from auth.users where lower(email) = mail;
  if uid is not null and public.has_role(uid, 'owner') then raise exception 'usuario_e_dono'; end if;

  if uid is null then
    if length(coalesce(p_senha, '')) < 8 then raise exception 'senha_curta'; end if;
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', mail,
            crypt(p_senha, gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', nullif(btrim(p_nome), '')),
            now(), now(), '', '', '', '');
    insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (uid::text, uid, jsonb_build_object('sub', uid::text, 'email', mail, 'email_verified', true),
            'email', now(), now(), now());
  end if;

  insert into public.profiles (id, email, full_name) values (uid, mail, nullif(btrim(p_nome), ''))
  on conflict (id) do update set full_name = coalesce(public.profiles.full_name, excluded.full_name);

  insert into membros (empresa_id, user_id, perfil_id, ativo) values (p_empresa, uid, p_perfil, true)
  on conflict (empresa_id, user_id) do update set perfil_id = excluded.perfil_id, ativo = true;
  return uid;
end $$;

create function octaplus.editar_membro(p_empresa uuid, p_usuario uuid, p_nome text, p_perfil uuid) returns void
language plpgsql security definer set search_path = octaplus, public as $$
begin
  perform conferir_alvo(p_empresa, p_usuario);
  if not exists (select 1 from perfis where id = p_perfil and empresa_id = p_empresa) then raise exception 'perfil_invalido'; end if;
  update membros set perfil_id = p_perfil where empresa_id = p_empresa and user_id = p_usuario;
  update public.profiles set full_name = nullif(btrim(p_nome), '') where id = p_usuario;
end $$;

create or replace function octaplus.definir_membro_ativo(p_empresa uuid, p_usuario uuid, p_ativo boolean) returns void
language plpgsql security definer set search_path = octaplus as $$
begin
  perform conferir_alvo(p_empresa, p_usuario);
  update membros set ativo = p_ativo where empresa_id = p_empresa and user_id = p_usuario;
end $$;

create or replace function octaplus.remover_membro(p_empresa uuid, p_usuario uuid) returns void
language plpgsql security definer set search_path = octaplus as $$
begin
  perform conferir_alvo(p_empresa, p_usuario);
  delete from membros where empresa_id = p_empresa and user_id = p_usuario;
end $$;

-- A senha vale em todas as empresas da pessoa: fora o dono, só troca de quem está apenas nesta empresa.
create function octaplus.redefinir_senha(p_empresa uuid, p_usuario uuid, p_senha text) returns void
language plpgsql security definer set search_path = octaplus, extensions, public as $$
begin
  perform conferir_alvo(p_empresa, p_usuario);
  if length(coalesce(p_senha, '')) < 8 then raise exception 'senha_curta'; end if;
  if not e_dono() and exists (select 1 from membros where user_id = p_usuario and empresa_id <> p_empresa) then
    raise exception 'usuario_em_outras_empresas';
  end if;
  update auth.users set encrypted_password = crypt(p_senha, gen_salt('bf')), updated_at = now() where id = p_usuario;
end $$;

-- ---------------------------------------------------------------------
-- Perfis de acesso
-- ---------------------------------------------------------------------
create or replace function octaplus.listar_perfis(p_empresa uuid)
returns table (id uuid, nome text, permissoes jsonb, usuarios integer)
language sql stable security definer set search_path = octaplus as $$
  select pf.id, pf.nome, pf.permissoes, (select count(*)::int from membros m where m.perfil_id = pf.id)
  from perfis pf where pf.empresa_id = p_empresa and pode_na(p_empresa, 'ver')
  order by pf.nome;
$$;

-- p = {id?, nome, permissoes: {area: 'nenhum'|'ver'|'editar'}}
create or replace function octaplus.salvar_perfil(p_empresa uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = octaplus as $$
declare pid uuid := nullif(p ->> 'id', '')::uuid; perms jsonb;
begin
  if not gerencia_usuarios(p_empresa) then raise exception 'sem_permissao'; end if;
  if coalesce(btrim(p ->> 'nome'), '') = '' then raise exception 'perfil_sem_nome'; end if;
  select jsonb_object_agg(a, coalesce(p -> 'permissoes' ->> a, 'nenhum')) into perms from unnest(areas()) a;
  if exists (select 1 from jsonb_each_text(perms) where value not in ('nenhum', 'ver', 'editar')) then
    raise exception 'permissao_invalida';
  end if;
  if pid is null then
    insert into perfis (empresa_id, nome, permissoes) values (p_empresa, btrim(p ->> 'nome'), perms) returning id into pid;
  else
    update perfis set nome = btrim(p ->> 'nome'), permissoes = perms where id = pid and empresa_id = p_empresa;
    if not found then raise exception 'nao_encontrado'; end if;
  end if;
  return pid;
exception when unique_violation then
  raise exception 'perfil_repetido';
end $$;

create or replace function octaplus.apagar_perfil(p_empresa uuid, p_perfil uuid) returns void
language plpgsql security definer set search_path = octaplus as $$
begin
  if not gerencia_usuarios(p_empresa) then raise exception 'sem_permissao'; end if;
  if exists (select 1 from membros where perfil_id = p_perfil) then raise exception 'perfil_em_uso'; end if;
  delete from perfis where id = p_perfil and empresa_id = p_empresa;
  if not found then raise exception 'nao_encontrado'; end if;
end $$;

-- ---------------------------------------------------------------------
-- Acesso
-- ---------------------------------------------------------------------
revoke execute on function
  octaplus.areas(), octaplus.criar_perfis_padrao(uuid), octaplus.permissao(uuid, text), octaplus.pode_area(uuid, text, text),
  octaplus.pode_aqui(text, text), octaplus.gerencia_usuarios(uuid), octaplus.conferir_alvo(uuid, uuid),
  octaplus.listar_empresas(), octaplus.listar_membros(uuid), octaplus.listar_usuarios(),
  octaplus.criar_usuario(uuid, text, text, text, uuid), octaplus.editar_membro(uuid, uuid, text, uuid),
  octaplus.redefinir_senha(uuid, uuid, text), octaplus.listar_perfis(uuid), octaplus.salvar_perfil(uuid, jsonb),
  octaplus.apagar_perfil(uuid, uuid)
from public, anon;
revoke execute on function octaplus.criar_perfis_padrao(uuid), octaplus.conferir_alvo(uuid, uuid) from authenticated;
grant execute on function
  octaplus.areas(), octaplus.permissao(uuid, text), octaplus.pode_area(uuid, text, text), octaplus.pode_aqui(text, text),
  octaplus.gerencia_usuarios(uuid), octaplus.listar_empresas(), octaplus.listar_membros(uuid), octaplus.listar_usuarios(),
  octaplus.criar_usuario(uuid, text, text, text, uuid), octaplus.editar_membro(uuid, uuid, text, uuid),
  octaplus.redefinir_senha(uuid, uuid, text), octaplus.listar_perfis(uuid), octaplus.salvar_perfil(uuid, jsonb),
  octaplus.apagar_perfil(uuid, uuid)
to authenticated;

-- ===== migrations/20260924000006_octaplus_empresa_fuso.sql =====
-- =====================================================================
-- Octadesk Plus — salvar_empresa grava também o fuso (octaplus.configuracao), na criação e na edição.
-- Assim a nova empresa já nasce com os mesmos dados da tela Configurações › Empresa.
-- p = {id?, nome, cnpj?, telefone?, site?, fuso?}
-- =====================================================================

create or replace function octaplus.salvar_empresa(p jsonb) returns uuid
language plpgsql security definer set search_path = octaplus, extensions, public as $$
declare
  eid uuid := nullif(p ->> 'id', '')::uuid;
  v_cnpj text := nullif(regexp_replace(coalesce(p ->> 'cnpj', ''), '\D', '', 'g'), '');
  v_fuso text := nullif(btrim(coalesce(p ->> 'fuso', '')), '');
begin
  if v_fuso is not null and not exists (select 1 from pg_timezone_names where name = v_fuso) then
    raise exception 'fuso_invalido';
  end if;

  if eid is null then
    if not e_dono() then raise exception 'sem_permissao'; end if;
    insert into empresas (nome, cnpj, telefone, site)
    values (btrim(p ->> 'nome'), v_cnpj, nullif(btrim(p ->> 'telefone'), ''), nullif(btrim(p ->> 'site'), ''))
    returning id into eid;
    insert into configuracao (empresa_id, fuso) values (eid, coalesce(v_fuso, 'America/Sao_Paulo'));
    insert into integracao_octadesk (empresa_id) values (eid);
    perform criar_perfis_padrao(eid);
    return eid;
  end if;

  if not pode_area(eid, 'empresa', 'editar') then raise exception 'sem_permissao'; end if;
  update empresas set
    nome     = case when e_dono() and coalesce(btrim(p ->> 'nome'), '') <> '' then btrim(p ->> 'nome') else nome end,
    cnpj     = case when p ? 'cnpj' then v_cnpj else cnpj end,
    telefone = case when p ? 'telefone' then nullif(btrim(p ->> 'telefone'), '') else telefone end,
    site     = case when p ? 'site' then nullif(btrim(p ->> 'site'), '') else site end
  where id = eid;
  if v_fuso is not null then
    update configuracao set fuso = v_fuso, atualizado_em = now() where empresa_id = eid;
  end if;
  return eid;
end $$;

-- A lista de empresas traz o fuso: o Owner edita empresas que não estão abertas (sem header).
drop function octaplus.listar_empresas();
create function octaplus.listar_empresas()
returns table (id uuid, nome text, ativa boolean, cnpj text, telefone text, site text, fuso text, criada_em timestamptz,
               perfil text, permissoes jsonb)
language sql stable security definer set search_path = octaplus, public as $$
  select e.id, e.nome, e.ativa, e.cnpj, e.telefone, e.site, c.fuso, e.criada_em, 'Dono',
         (select jsonb_object_agg(a, 'editar') from unnest(areas()) a)
  from empresas e left join configuracao c on c.empresa_id = e.id where e_dono()
  union all
  select e.id, e.nome, e.ativa, e.cnpj, e.telefone, e.site, c.fuso, e.criada_em, pf.nome, pf.permissoes
  from empresas e join membros m on m.empresa_id = e.id join perfis pf on pf.id = m.perfil_id
  left join configuracao c on c.empresa_id = e.id
  where not e_dono() and m.user_id = auth.uid() and m.ativo and e.ativa
  order by 2;
$$;
revoke execute on function octaplus.listar_empresas() from public, anon;
grant execute on function octaplus.listar_empresas() to authenticated;

-- ===== migrations/20260924000007_octaplus_empresa_logo.sql =====
-- =====================================================================
-- Octadesk Plus — foto (logo) da empresa, guardada como data URL em base64.
-- O painel reduz a imagem a 256px antes de enviar; o banco só aceita imagem e até ~300 KB.
-- salvar_empresa: p.logo = data URL grava, '' remove, ausente mantém.
-- =====================================================================

alter table octaplus.empresas add column logo text;

create or replace function octaplus.salvar_empresa(p jsonb) returns uuid
language plpgsql security definer set search_path = octaplus, extensions, public as $$
declare
  eid uuid := nullif(p ->> 'id', '')::uuid;
  v_cnpj text := nullif(regexp_replace(coalesce(p ->> 'cnpj', ''), '\D', '', 'g'), '');
  v_fuso text := nullif(btrim(coalesce(p ->> 'fuso', '')), '');
  v_logo text := nullif(btrim(coalesce(p ->> 'logo', '')), '');
begin
  if v_fuso is not null and not exists (select 1 from pg_timezone_names where name = v_fuso) then
    raise exception 'fuso_invalido';
  end if;
  if v_logo is not null and (v_logo !~ '^data:image/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$' or length(v_logo) > 400000) then
    raise exception 'logo_invalido';
  end if;

  if eid is null then
    if not e_dono() then raise exception 'sem_permissao'; end if;
    insert into empresas (nome, cnpj, telefone, site, logo)
    values (btrim(p ->> 'nome'), v_cnpj, nullif(btrim(p ->> 'telefone'), ''), nullif(btrim(p ->> 'site'), ''), v_logo)
    returning id into eid;
    insert into configuracao (empresa_id, fuso) values (eid, coalesce(v_fuso, 'America/Sao_Paulo'));
    insert into integracao_octadesk (empresa_id) values (eid);
    perform criar_perfis_padrao(eid);
    return eid;
  end if;

  if not pode_area(eid, 'empresa', 'editar') then raise exception 'sem_permissao'; end if;
  update empresas set
    nome     = case when e_dono() and coalesce(btrim(p ->> 'nome'), '') <> '' then btrim(p ->> 'nome') else nome end,
    cnpj     = case when p ? 'cnpj' then v_cnpj else cnpj end,
    telefone = case when p ? 'telefone' then nullif(btrim(p ->> 'telefone'), '') else telefone end,
    site     = case when p ? 'site' then nullif(btrim(p ->> 'site'), '') else site end,
    logo     = case when p ? 'logo' then v_logo else logo end
  where id = eid;
  if v_fuso is not null then
    update configuracao set fuso = v_fuso, atualizado_em = now() where empresa_id = eid;
  end if;
  return eid;
end $$;

drop function octaplus.listar_empresas();
create function octaplus.listar_empresas()
returns table (id uuid, nome text, ativa boolean, cnpj text, telefone text, site text, fuso text, logo text, criada_em timestamptz,
               perfil text, permissoes jsonb)
language sql stable security definer set search_path = octaplus, public as $$
  select e.id, e.nome, e.ativa, e.cnpj, e.telefone, e.site, c.fuso, e.logo, e.criada_em, 'Dono',
         (select jsonb_object_agg(a, 'editar') from unnest(areas()) a)
  from empresas e left join configuracao c on c.empresa_id = e.id where e_dono()
  union all
  select e.id, e.nome, e.ativa, e.cnpj, e.telefone, e.site, c.fuso, e.logo, e.criada_em, pf.nome, pf.permissoes
  from empresas e join membros m on m.empresa_id = e.id join perfis pf on pf.id = m.perfil_id
  left join configuracao c on c.empresa_id = e.id
  where not e_dono() and m.user_id = auth.uid() and m.ativo and e.ativa
  order by 2;
$$;
revoke execute on function octaplus.listar_empresas() from public, anon;
grant execute on function octaplus.listar_empresas() to authenticated;

-- ===== migrations/20260924000008_octaplus_foto_usuario.sql =====
-- =====================================================================
-- Octadesk Plus — foto do próprio perfil (Meu perfil e card do usuário no menu).
-- Fica no schema octaplus (public.profiles é do metrics e não é escrito por aqui).
-- Mesmo formato do logo da empresa: data URL de imagem em base64, reduzida no navegador.
-- =====================================================================

create table octaplus.fotos_usuario (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  foto          text not null,
  atualizado_em timestamptz not null default now()
);

alter table octaplus.fotos_usuario enable row level security;
create policy propria on octaplus.fotos_usuario for select using (user_id = auth.uid());
grant select on octaplus.fotos_usuario to authenticated;
revoke insert, update, delete on octaplus.fotos_usuario from anon, authenticated;

-- p_foto = data URL grava; '' ou null remove
create or replace function octaplus.salvar_minha_foto(p_foto text) returns void
language plpgsql security definer set search_path = octaplus as $$
declare v text := nullif(btrim(coalesce(p_foto, '')), '');
begin
  if auth.uid() is null then raise exception 'sem_permissao'; end if;
  if v is null then
    delete from fotos_usuario where user_id = auth.uid();
    return;
  end if;
  if v !~ '^data:image/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$' or length(v) > 400000 then
    raise exception 'foto_invalida';
  end if;
  insert into fotos_usuario (user_id, foto) values (auth.uid(), v)
  on conflict (user_id) do update set foto = excluded.foto, atualizado_em = now();
end $$;

revoke execute on function octaplus.salvar_minha_foto(text) from public, anon;
grant execute on function octaplus.salvar_minha_foto(text) to authenticated;

-- ===== migrations/20260924000009_octaplus_master.sql =====
-- =====================================================================
-- Octadesk Plus — perfil Master: administrador fixo de cada empresa.
--
-- Perfis padrão viram Master (fixo: não edita nem exclui), Editor e Observador.
-- Toda empresa nasce com um usuário Master e nunca fica sem nenhum ativo: o último Master não pode
-- ser rebaixado, inativado nem excluído.
-- listar_empresas passa a dizer o tipo do cargo (owner | master | comum) para a placa do Meu perfil.
-- =====================================================================

alter table octaplus.perfis add column fixo boolean not null default false;

update octaplus.perfis set nome = 'Master', fixo = true,
  permissoes = (select jsonb_object_agg(a, 'editar') from unnest(octaplus.areas()) a)
where nome = 'Administrador';
update octaplus.perfis set nome = 'Editor' where nome = 'Edita';
update octaplus.perfis set nome = 'Observador' where nome = 'Só vê';
insert into octaplus.perfis (empresa_id, nome, permissoes, fixo)
select e.id, 'Master', (select jsonb_object_agg(a, 'editar') from unnest(octaplus.areas()) a), true
from octaplus.empresas e
where not exists (select 1 from octaplus.perfis p where p.empresa_id = e.id and p.fixo);

create or replace function octaplus.criar_perfis_padrao(p_empresa uuid) returns void
language sql security definer set search_path = octaplus as $$
  insert into perfis (empresa_id, nome, permissoes, fixo) values
    (p_empresa, 'Master', (select jsonb_object_agg(a, 'editar') from unnest(areas()) a), true),
    (p_empresa, 'Editor', (select jsonb_object_agg(a, case when a = 'usuarios' then 'ver' else 'editar' end) from unnest(areas()) a), false),
    (p_empresa, 'Observador', (select jsonb_object_agg(a, 'ver') from unnest(areas()) a), false)
  on conflict (empresa_id, nome) do nothing;
$$;

create or replace function octaplus.perfil_master(p_empresa uuid) returns uuid
language sql stable security definer set search_path = octaplus as $$
  select id from perfis where empresa_id = p_empresa and fixo limit 1;
$$;

-- A empresa não pode ficar sem nenhum Master ativo.
create or replace function octaplus.conferir_ultimo_master(p_empresa uuid, p_usuario uuid) returns void
language plpgsql stable security definer set search_path = octaplus as $$
begin
  if exists (select 1 from membros m join perfis pf on pf.id = m.perfil_id
             where m.empresa_id = p_empresa and m.user_id = p_usuario and m.ativo and pf.fixo)
     and not exists (select 1 from membros m join perfis pf on pf.id = m.perfil_id
                     where m.empresa_id = p_empresa and m.user_id <> p_usuario and m.ativo and pf.fixo) then
    raise exception 'ultimo_master';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Perfis: o fixo não muda
-- ---------------------------------------------------------------------
create or replace function octaplus.salvar_perfil(p_empresa uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = octaplus as $$
declare pid uuid := nullif(p ->> 'id', '')::uuid; perms jsonb;
begin
  if not gerencia_usuarios(p_empresa) then raise exception 'sem_permissao'; end if;
  if pid is not null and exists (select 1 from perfis where id = pid and fixo) then raise exception 'perfil_fixo'; end if;
  if coalesce(btrim(p ->> 'nome'), '') = '' then raise exception 'perfil_sem_nome'; end if;
  select jsonb_object_agg(a, coalesce(p -> 'permissoes' ->> a, 'nenhum')) into perms from unnest(areas()) a;
  if exists (select 1 from jsonb_each_text(perms) where value not in ('nenhum', 'ver', 'editar')) then
    raise exception 'permissao_invalida';
  end if;
  if pid is null then
    insert into perfis (empresa_id, nome, permissoes) values (p_empresa, btrim(p ->> 'nome'), perms) returning id into pid;
  else
    update perfis set nome = btrim(p ->> 'nome'), permissoes = perms where id = pid and empresa_id = p_empresa;
    if not found then raise exception 'nao_encontrado'; end if;
  end if;
  return pid;
exception when unique_violation then
  raise exception 'perfil_repetido';
end $$;

create or replace function octaplus.apagar_perfil(p_empresa uuid, p_perfil uuid) returns void
language plpgsql security definer set search_path = octaplus as $$
begin
  if not gerencia_usuarios(p_empresa) then raise exception 'sem_permissao'; end if;
  if exists (select 1 from perfis where id = p_perfil and fixo) then raise exception 'perfil_fixo'; end if;
  if exists (select 1 from membros where perfil_id = p_perfil) then raise exception 'perfil_em_uso'; end if;
  delete from perfis where id = p_perfil and empresa_id = p_empresa;
  if not found then raise exception 'nao_encontrado'; end if;
end $$;

drop function octaplus.listar_perfis(uuid);
create function octaplus.listar_perfis(p_empresa uuid)
returns table (id uuid, nome text, permissoes jsonb, fixo boolean, usuarios integer)
language sql stable security definer set search_path = octaplus as $$
  select pf.id, pf.nome, pf.permissoes, pf.fixo, (select count(*)::int from membros m where m.perfil_id = pf.id)
  from perfis pf where pf.empresa_id = p_empresa and pode_na(p_empresa, 'ver')
  order by pf.fixo desc, pf.nome;
$$;

-- ---------------------------------------------------------------------
-- Usuários: o último Master fica
-- ---------------------------------------------------------------------
create or replace function octaplus.editar_membro(p_empresa uuid, p_usuario uuid, p_nome text, p_perfil uuid) returns void
language plpgsql security definer set search_path = octaplus, public as $$
begin
  perform conferir_alvo(p_empresa, p_usuario);
  if not exists (select 1 from perfis where id = p_perfil and empresa_id = p_empresa) then raise exception 'perfil_invalido'; end if;
  if p_perfil <> perfil_master(p_empresa) then perform conferir_ultimo_master(p_empresa, p_usuario); end if;
  update membros set perfil_id = p_perfil where empresa_id = p_empresa and user_id = p_usuario;
  update public.profiles set full_name = nullif(btrim(p_nome), '') where id = p_usuario;
end $$;

create or replace function octaplus.definir_membro_ativo(p_empresa uuid, p_usuario uuid, p_ativo boolean) returns void
language plpgsql security definer set search_path = octaplus as $$
begin
  perform conferir_alvo(p_empresa, p_usuario);
  if not p_ativo then perform conferir_ultimo_master(p_empresa, p_usuario); end if;
  update membros set ativo = p_ativo where empresa_id = p_empresa and user_id = p_usuario;
end $$;

create or replace function octaplus.remover_membro(p_empresa uuid, p_usuario uuid) returns void
language plpgsql security definer set search_path = octaplus as $$
begin
  perform conferir_alvo(p_empresa, p_usuario);
  perform conferir_ultimo_master(p_empresa, p_usuario);
  delete from membros where empresa_id = p_empresa and user_id = p_usuario;
end $$;

drop function octaplus.listar_usuarios();
drop function octaplus.listar_membros(uuid);

create function octaplus.listar_membros(p_empresa uuid)
returns table (user_id uuid, nome text, email text, perfil_id uuid, perfil text, master boolean, ativo boolean, criado_em timestamptz,
               ultimo_acesso timestamptz, outras_empresas integer)
language plpgsql stable security definer set search_path = octaplus, public as $$
begin
  if not pode_area(p_empresa, 'usuarios', 'ver') then return; end if;
  return query
    select m.user_id, p.full_name, coalesce(p.email, u.email)::text, m.perfil_id, pf.nome, pf.fixo, m.ativo, m.criado_em, u.last_sign_in_at,
           (select count(*)::int from membros o where o.user_id = m.user_id and o.empresa_id <> m.empresa_id)
    from membros m
    join perfis pf on pf.id = m.perfil_id
    left join public.profiles p on p.id = m.user_id
    left join auth.users u on u.id = m.user_id
    where m.empresa_id = p_empresa
    order by pf.fixo desc, coalesce(p.full_name, p.email, u.email);
end $$;

create function octaplus.listar_usuarios()
returns table (user_id uuid, nome text, email text, perfil_id uuid, perfil text, master boolean, ativo boolean, criado_em timestamptz,
               ultimo_acesso timestamptz, outras_empresas integer)
language sql stable security definer set search_path = octaplus as $$
  select * from octaplus.listar_membros(octaplus.empresa_atual());
$$;

-- ---------------------------------------------------------------------
-- Empresas: nascem com o Master; a lista diz o tipo do cargo
-- p = {id?, nome, cnpj?, telefone?, site?, fuso?, logo?, master?: {nome?, email, senha}}  (master obrigatório ao criar)
-- ---------------------------------------------------------------------
create or replace function octaplus.salvar_empresa(p jsonb) returns uuid
language plpgsql security definer set search_path = octaplus, extensions, public as $$
declare
  eid uuid := nullif(p ->> 'id', '')::uuid;
  v_cnpj text := nullif(regexp_replace(coalesce(p ->> 'cnpj', ''), '\D', '', 'g'), '');
  v_fuso text := nullif(btrim(coalesce(p ->> 'fuso', '')), '');
  v_logo text := nullif(btrim(coalesce(p ->> 'logo', '')), '');
begin
  if v_fuso is not null and not exists (select 1 from pg_timezone_names where name = v_fuso) then
    raise exception 'fuso_invalido';
  end if;
  if v_logo is not null and (v_logo !~ '^data:image/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$' or length(v_logo) > 400000) then
    raise exception 'logo_invalido';
  end if;

  if eid is null then
    if not e_dono() then raise exception 'sem_permissao'; end if;
    if coalesce(btrim(p #>> '{master,email}'), '') = '' then raise exception 'master_obrigatorio'; end if;
    insert into empresas (nome, cnpj, telefone, site, logo)
    values (btrim(p ->> 'nome'), v_cnpj, nullif(btrim(p ->> 'telefone'), ''), nullif(btrim(p ->> 'site'), ''), v_logo)
    returning id into eid;
    insert into configuracao (empresa_id, fuso) values (eid, coalesce(v_fuso, 'America/Sao_Paulo'));
    insert into integracao_octadesk (empresa_id) values (eid);
    perform criar_perfis_padrao(eid);
    perform criar_usuario(eid, p #>> '{master,email}', p #>> '{master,nome}', p #>> '{master,senha}', perfil_master(eid));
    return eid;
  end if;

  if not pode_area(eid, 'empresa', 'editar') then raise exception 'sem_permissao'; end if;
  update empresas set
    nome     = case when e_dono() and coalesce(btrim(p ->> 'nome'), '') <> '' then btrim(p ->> 'nome') else nome end,
    cnpj     = case when p ? 'cnpj' then v_cnpj else cnpj end,
    telefone = case when p ? 'telefone' then nullif(btrim(p ->> 'telefone'), '') else telefone end,
    site     = case when p ? 'site' then nullif(btrim(p ->> 'site'), '') else site end,
    logo     = case when p ? 'logo' then v_logo else logo end
  where id = eid;
  if v_fuso is not null then
    update configuracao set fuso = v_fuso, atualizado_em = now() where empresa_id = eid;
  end if;
  return eid;
end $$;

drop function octaplus.listar_empresas();
create function octaplus.listar_empresas()
returns table (id uuid, nome text, ativa boolean, cnpj text, telefone text, site text, fuso text, logo text, criada_em timestamptz,
               perfil text, perfil_tipo text, permissoes jsonb)
language sql stable security definer set search_path = octaplus, public as $$
  select e.id, e.nome, e.ativa, e.cnpj, e.telefone, e.site, c.fuso, e.logo, e.criada_em, 'Owner', 'owner',
         (select jsonb_object_agg(a, 'editar') from unnest(areas()) a)
  from empresas e left join configuracao c on c.empresa_id = e.id where e_dono()
  union all
  select e.id, e.nome, e.ativa, e.cnpj, e.telefone, e.site, c.fuso, e.logo, e.criada_em, pf.nome,
         case when pf.fixo then 'master' else 'comum' end, pf.permissoes
  from empresas e join membros m on m.empresa_id = e.id join perfis pf on pf.id = m.perfil_id
  left join configuracao c on c.empresa_id = e.id
  where not e_dono() and m.user_id = auth.uid() and m.ativo and e.ativa
  order by 2;
$$;

-- ---------------------------------------------------------------------
-- Acesso
-- ---------------------------------------------------------------------
revoke execute on function octaplus.perfil_master(uuid), octaplus.conferir_ultimo_master(uuid, uuid) from public, anon, authenticated;
revoke execute on function octaplus.listar_perfis(uuid), octaplus.listar_membros(uuid), octaplus.listar_usuarios(), octaplus.listar_empresas()
  from public, anon;
grant execute on function octaplus.listar_perfis(uuid), octaplus.listar_membros(uuid), octaplus.listar_usuarios(), octaplus.listar_empresas()
  to authenticated;
