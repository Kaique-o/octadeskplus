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
