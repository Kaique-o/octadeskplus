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
