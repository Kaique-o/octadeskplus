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
