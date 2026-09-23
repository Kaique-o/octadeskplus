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
