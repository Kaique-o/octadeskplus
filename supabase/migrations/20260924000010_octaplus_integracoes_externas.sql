-- =====================================================================
-- Octadesk Plus — integrações externas por empresa (Configurações › Integrações).
--
-- Por enquanto só o metrics: URL do Supabase dele + chave de acesso. A chave vai para octaplus.segredos
-- ('metrics_chave') e nunca volta para o navegador. A conexão nasce 'pendente'; a leitura dos dados do
-- metrics (clientes, vendas) para os gatilhos ainda não usa esta integração.
-- Trello, Salesforce, HubSpot etc. aparecem no painel como "em breve" e são recusados aqui.
-- =====================================================================

create table octaplus.integracoes_externas (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null default octaplus.empresa_atual() references octaplus.empresas(id) on delete cascade,
  tipo        text not null check (tipo in ('metrics')),
  config      jsonb not null default '{}'::jsonb,       -- sem segredo (ex.: {url})
  status      text not null default 'pendente' check (status in ('pendente', 'conectado', 'erro')),
  ultimo_erro text,
  criado_por  uuid,
  criada_em   timestamptz not null default now(),
  atualizada_em timestamptz not null default now(),
  unique (empresa_id, tipo)
);

alter table octaplus.integracoes_externas enable row level security;
create policy ver on octaplus.integracoes_externas for select
  using (empresa_id = octaplus.empresa_atual() and octaplus.pode_aqui('integracoes', 'ver'));
grant select on octaplus.integracoes_externas to authenticated;
revoke insert, update, delete on octaplus.integracoes_externas from anon, authenticated;

-- p = {tipo, url, chave?}  (chave vazia = manter a salva)
create or replace function octaplus.salvar_integracao_externa(p jsonb) returns uuid
language plpgsql security definer set search_path = octaplus as $$
declare emp uuid := empresa_atual(); v_url text := rtrim(btrim(coalesce(p ->> 'url', '')), '/'); iid uuid;
begin
  if not pode_aqui('integracoes', 'editar') then raise exception 'sem_permissao'; end if;
  if coalesce(p ->> 'tipo', '') <> 'metrics' then raise exception 'integracao_indisponivel'; end if;
  if v_url !~ '^https://[^\s/]+\.[^\s/]+' then raise exception 'url_invalida'; end if;
  if coalesce(p ->> 'chave', '') = '' and not exists (select 1 from segredos where empresa_id = emp and chave = 'metrics_chave') then
    raise exception 'chave_obrigatoria';
  end if;

  insert into integracoes_externas (empresa_id, tipo, config, status, criado_por)
  values (emp, 'metrics', jsonb_build_object('url', v_url), 'pendente', auth.uid())
  on conflict (empresa_id, tipo) do update set config = excluded.config, status = 'pendente', ultimo_erro = null, atualizada_em = now()
  returning id into iid;

  if coalesce(p ->> 'chave', '') <> '' then
    insert into segredos (empresa_id, chave, valor) values (emp, 'metrics_chave', p ->> 'chave')
    on conflict (empresa_id, chave) do update set valor = excluded.valor, atualizado_em = now();
  end if;
  return iid;
end $$;

create or replace function octaplus.remover_integracao_externa(p_id uuid) returns void
language plpgsql security definer set search_path = octaplus as $$
declare t text;
begin
  if not pode_aqui('integracoes', 'editar') then raise exception 'sem_permissao'; end if;
  delete from integracoes_externas where id = p_id and empresa_id = empresa_atual() returning tipo into t;
  if t is null then raise exception 'nao_encontrado'; end if;
  delete from segredos where empresa_id = empresa_atual() and chave = t || '_chave';
end $$;

revoke execute on function octaplus.salvar_integracao_externa(jsonb), octaplus.remover_integracao_externa(uuid) from public, anon;
grant execute on function octaplus.salvar_integracao_externa(jsonb), octaplus.remover_integracao_externa(uuid) to authenticated;
