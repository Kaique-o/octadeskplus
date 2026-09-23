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
