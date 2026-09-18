-- Stub mínimo do metrics + Supabase para testar o schema octaplus fora do banco real.
-- Só as colunas que o octaplus lê, com os mesmos nomes e tipos de metrics/supabase/schema/schema_completo.sql.

create role anon; create role authenticated; create role service_role;

create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('teste.uid', true), '')::uuid $$;

create type public.app_role as enum ('owner', 'superadmin', 'viewer');
create table public.user_roles (id uuid primary key default gen_random_uuid(), user_id uuid not null, role app_role not null, profile_id uuid);
create table public.access_profile_permissions (id uuid primary key default gen_random_uuid(), profile_id uuid not null, resource text not null, action text not null);

create function public.has_role(_user_id uuid, _role app_role) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;
create function public.has_permission(_user_id uuid, _resource text, _action text) returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(_user_id, 'owner') or public.has_role(_user_id, 'superadmin') or exists (
    select 1 from public.user_roles ur join public.access_profile_permissions p on p.profile_id = ur.profile_id
    where ur.user_id = _user_id and p.resource = _resource and p.action = _action) $$;

create table public.salespeople (id uuid primary key default gen_random_uuid(), name text not null, octadesk_agent_id text);

create table public.clients (
  id uuid primary key default gen_random_uuid(), name text not null, telefone text, octadesk_contact_id text,
  curva_cliente text, situacao_carteira text, tipo_entrega text, dt_ultima_compra date, faturamento_365_dias numeric,
  salesperson_id uuid, codigo_cliente integer);

create table public.client_octadesk_contacts (
  id uuid primary key default gen_random_uuid(), octadesk_contact_id text not null unique, client_id uuid,
  phone_country_code text, phone_number text, tipo_de_entrega text, updated_at timestamptz not null default now());

create table public.sales (
  id uuid primary key default gen_random_uuid(), client_id uuid, value numeric(12,2) not null, tipo_fiscal text not null,
  sale_date date not null default current_date, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), numero_unico integer, marca text, status text not null default 'ativa');

create table public.client_credits (
  id uuid primary key default gen_random_uuid(), client_id uuid, valor numeric, dtref timestamptz,
  created_at timestamptz not null default now());

create table public.client_behavior_alerts (
  id uuid primary key default gen_random_uuid(), client_id uuid not null, pattern text not null,
  severidade text not null default 'baixa', motivo text not null, dias_atraso integer, valor_risco numeric,
  gerado_em date not null default current_date, created_at timestamptz not null default now());

create table public.client_curve_history (
  id uuid primary key default gen_random_uuid(), client_id uuid not null, curva_de text, curva_para text,
  changed_at timestamptz not null default now());

create table public.skyler_analyses (
  id uuid primary key default gen_random_uuid(), conversation_octadesk_id text not null unique, conversation_number bigint,
  cliente_id text, cliente_nome text, cliente_telefone text, atendente_nome text, categoria_conversa text,
  etapa_comercial text, orcamento_enviado boolean, orcamento_enviado_em timestamptz,
  primeiro_pedido_orcamento_em timestamptz, ultimo_pedido_orcamento_em timestamptz, last_event text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table public.messages (
  id uuid primary key default gen_random_uuid(), octadesk_message_id text not null, conversation_octadesk_id text not null,
  time timestamptz, sent_by_type text);
