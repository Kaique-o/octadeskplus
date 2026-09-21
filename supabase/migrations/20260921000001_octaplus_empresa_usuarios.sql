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
