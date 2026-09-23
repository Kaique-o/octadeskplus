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
