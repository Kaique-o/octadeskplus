-- =====================================================================
-- Octadesk Plus — gatilhos de tabela, RLS, grants e agenda (pg_cron)
-- =====================================================================

-- Ao ativar uma automação, marca o momento: os detectores só olham o que vencer daqui para frente.
create or replace function octaplus.ao_salvar_automacao() returns trigger
language plpgsql as $$
begin
  if new.ativa and (tg_op = 'INSERT' or not old.ativa) then new.ativa_desde := now(); end if;
  if not new.ativa then new.ativa_desde := null; end if;
  new.atualizado_em := now();
  return new;
end $$;

create trigger automacoes_ativacao before insert or update on octaplus.automacoes
  for each row execute function octaplus.ao_salvar_automacao();

-- ---------------------------------------------------------------------
-- RLS: leitura com permissão 'ver', escrita com 'editar' (recurso 'octaplus' no metrics).
-- Dono e superadmin do metrics passam sempre (public.has_permission).
-- ---------------------------------------------------------------------
alter table octaplus.configuracao        enable row level security;
alter table octaplus.integracao_octadesk enable row level security;
alter table octaplus.segredos            enable row level security;   -- sem policy: invisível ao navegador
alter table octaplus.octa_numeros        enable row level security;
alter table octaplus.octa_templates      enable row level security;
alter table octaplus.octa_grupos         enable row level security;
alter table octaplus.octa_tags           enable row level security;
alter table octaplus.mapa_filas          enable row level security;
alter table octaplus.automacoes          enable row level security;
alter table octaplus.automacao_acoes     enable row level security;
alter table octaplus.eventos             enable row level security;
alter table octaplus.execucoes           enable row level security;
alter table octaplus.envios              enable row level security;
alter table octaplus.nao_perturbe        enable row level security;
alter table octaplus.chaves_api          enable row level security;
alter table octaplus.chamadas_api        enable row level security;

create policy ver on octaplus.configuracao        for select using (octaplus.pode('ver'));
create policy editar on octaplus.configuracao     for update using (octaplus.pode('editar'));
create policy ver on octaplus.integracao_octadesk for select using (octaplus.pode('ver'));
create policy ver on octaplus.octa_numeros        for select using (octaplus.pode('ver'));
create policy editar on octaplus.octa_numeros     for update using (octaplus.pode('editar'));   -- rótulo
create policy ver on octaplus.octa_templates      for select using (octaplus.pode('ver'));
create policy ver on octaplus.octa_grupos         for select using (octaplus.pode('ver'));
create policy ver on octaplus.octa_tags           for select using (octaplus.pode('ver'));
create policy ver on octaplus.mapa_filas          for select using (octaplus.pode('ver'));
create policy editar on octaplus.mapa_filas       for all using (octaplus.pode('editar')) with check (octaplus.pode('editar'));
create policy ver on octaplus.automacoes          for select using (octaplus.pode('ver'));
create policy editar on octaplus.automacoes       for update using (octaplus.pode('editar'));     -- ligar/arquivar
create policy ver on octaplus.automacao_acoes     for select using (octaplus.pode('ver'));
create policy ver on octaplus.eventos             for select using (octaplus.pode('ver'));
create policy ver on octaplus.execucoes           for select using (octaplus.pode('ver'));
create policy ver on octaplus.envios              for select using (octaplus.pode('ver'));
create policy ver on octaplus.nao_perturbe        for select using (octaplus.pode('ver'));
create policy editar on octaplus.nao_perturbe     for all using (octaplus.pode('editar')) with check (octaplus.pode('editar'));
create policy ver on octaplus.chaves_api          for select using (octaplus.pode('ver'));
create policy ver on octaplus.chamadas_api        for select using (octaplus.pode('ver'));

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------
grant select, insert, update, delete on all tables in schema octaplus to authenticated;
revoke all on octaplus.segredos from anon, authenticated;
grant usage on all sequences in schema octaplus to authenticated;

-- Painel
grant execute on function
  octaplus.salvar_automacao(jsonb), octaplus.duplicar_automacao(uuid), octaplus.salvar_integracao(jsonb),
  octaplus.pedir_sincronizacao(), octaplus.segredos_preenchidos(), octaplus.criar_chave_api(text),
  octaplus.revogar_chave_api(uuid), octaplus.estatisticas_diarias(date, date, uuid), octaplus.resumo_automacoes(),
  octaplus.pode(text)
to authenticated;

-- Motor: só o n8n (conexão Postgres) e o pg_cron chamam
revoke execute on function
  octaplus.registrar_evento(uuid, text, uuid, text, text, text, text, jsonb),
  octaplus.receber_webhook(uuid, text, jsonb, text), octaplus.receber_octadesk(text, text, jsonb),
  octaplus.candidatos(octaplus.automacoes, timestamptz), octaplus.detectar_eventos(integer),
  octaplus.credenciais_octadesk(), octaplus.gravar_jwt(text, timestamptz), octaplus.gravar_catalogos(jsonb),
  octaplus.pegar_execucoes(integer), octaplus.concluir_execucao(uuid, text, jsonb, text, text),
  octaplus.atualizar_atribuicao(), octaplus.api_formatar_telefone(text, text), octaplus.limpar_historico(),
  octaplus.contexto_cliente(uuid), octaplus.cliente_por_contato(text), octaplus.cliente_por_telefone(text)
from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Agenda (só onde o pg_cron existe — o metrics já usa)
-- ---------------------------------------------------------------------
do $agenda$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('octaplus-detectores', '*/5 * * * *', 'select octaplus.detectar_eventos()');
    perform cron.schedule('octaplus-atribuicao', '15 * * * *',  'select octaplus.atualizar_atribuicao()');
    perform cron.schedule('octaplus-limpeza',    '30 3 * * *',  'select octaplus.limpar_historico()');
  end if;
end $agenda$;
