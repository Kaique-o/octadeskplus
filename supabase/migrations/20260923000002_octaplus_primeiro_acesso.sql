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
