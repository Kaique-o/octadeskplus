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
