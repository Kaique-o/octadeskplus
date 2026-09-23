-- =====================================================================
-- Octadesk Plus — foto do próprio perfil (Meu perfil e card do usuário no menu).
-- Fica no schema octaplus (public.profiles é do metrics e não é escrito por aqui).
-- Mesmo formato do logo da empresa: data URL de imagem em base64, reduzida no navegador.
-- =====================================================================

create table octaplus.fotos_usuario (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  foto          text not null,
  atualizado_em timestamptz not null default now()
);

alter table octaplus.fotos_usuario enable row level security;
create policy propria on octaplus.fotos_usuario for select using (user_id = auth.uid());
grant select on octaplus.fotos_usuario to authenticated;
revoke insert, update, delete on octaplus.fotos_usuario from anon, authenticated;

-- p_foto = data URL grava; '' ou null remove
create or replace function octaplus.salvar_minha_foto(p_foto text) returns void
language plpgsql security definer set search_path = octaplus as $$
declare v text := nullif(btrim(coalesce(p_foto, '')), '');
begin
  if auth.uid() is null then raise exception 'sem_permissao'; end if;
  if v is null then
    delete from fotos_usuario where user_id = auth.uid();
    return;
  end if;
  if v !~ '^data:image/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$' or length(v) > 400000 then
    raise exception 'foto_invalida';
  end if;
  insert into fotos_usuario (user_id, foto) values (auth.uid(), v)
  on conflict (user_id) do update set foto = excluded.foto, atualizado_em = now();
end $$;

revoke execute on function octaplus.salvar_minha_foto(text) from public, anon;
grant execute on function octaplus.salvar_minha_foto(text) to authenticated;
