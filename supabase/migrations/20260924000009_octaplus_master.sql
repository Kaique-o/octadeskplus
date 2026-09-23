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
