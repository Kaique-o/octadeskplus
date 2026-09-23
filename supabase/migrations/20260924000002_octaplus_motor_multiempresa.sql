-- =====================================================================
-- Octadesk Plus — motor e RPCs do painel por empresa.
-- Motor: a empresa vem da automação, do segredo do webhook ou da chave de API — nunca do header.
-- Painel: a empresa é a atual (header x-empresa), já garantida pelo pode().
-- =====================================================================

-- Assinaturas que mudam: sai a versão de empresa única
drop function octaplus.proximo_horario_util(timestamptz);
drop function octaplus.credenciais_octadesk();
drop function octaplus.gravar_jwt(text, timestamptz);
drop function octaplus.gravar_catalogos(jsonb);

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function octaplus.proximo_horario_util(p_em timestamptz, p_empresa uuid) returns timestamptz
language plpgsql stable security definer set search_path = octaplus as $$
declare c configuracao; local_ts timestamp; dia jsonb; w jsonb; ini time; fim time; i int;
begin
  select * into c from configuracao where empresa_id = p_empresa;
  if c.horario_comercial -> 'perDay' is null then return p_em; end if;
  local_ts := p_em at time zone c.fuso;
  for i in 0..14 loop
    dia := c.horario_comercial -> 'perDay' -> extract(dow from local_ts)::text;
    if coalesce((dia ->> 'enabled')::boolean, false) then
      for w in select value from jsonb_array_elements(coalesce(dia -> 'windows', '[]')) order by value ->> 'start' loop
        ini := (w ->> 'start')::time; fim := (w ->> 'end')::time;
        if local_ts::time < ini then return (local_ts::date + ini) at time zone c.fuso; end if;
        if local_ts::time < fim then return local_ts at time zone c.fuso; end if;
      end loop;
    end if;
    local_ts := (local_ts::date + 1)::timestamp;
  end loop;
  return p_em;
end $$;

-- ---------------------------------------------------------------------
-- Funil único de eventos (regras dentro da empresa da automação)
-- ---------------------------------------------------------------------
create or replace function octaplus.registrar_evento(
  p_automacao uuid, p_dedupe text, p_cliente uuid, p_contato text, p_conversa text,
  p_telefone text, p_nome text, p_dados jsonb
) returns jsonb
language plpgsql security definer set search_path = octaplus, public as $$
declare
  a automacoes; cfg configuracao; ctx jsonb := '{}'; tel text; contato text; dados jsonb;
  motivo text; eid uuid; t timestamptz; act automacao_acoes; n int := 0; manda_mensagem boolean;
begin
  select * into a from automacoes where id = p_automacao;
  if a.id is null or not a.ativa or a.arquivada_em is not null then
    return jsonb_build_object('ok', false, 'motivo', 'automacao_inativa');
  end if;
  if not exists (select 1 from empresas where id = a.empresa_id and ativa) then
    return jsonb_build_object('ok', false, 'motivo', 'empresa_inativa');
  end if;
  select * into cfg from configuracao where empresa_id = a.empresa_id;

  if p_cliente is not null then ctx := coalesce(contexto_cliente(p_cliente), '{}'); end if;
  tel := coalesce(normalizar_telefone(p_telefone), ctx ->> 'telefone');
  contato := coalesce(p_contato, ctx ->> 'octadesk_contact_id');
  ctx := ctx || jsonb_strip_nulls(jsonb_build_object('telefone', tel, 'nome', coalesce(ctx ->> 'nome', p_nome)));
  if ctx ->> 'primeiro_nome' is null and ctx ->> 'nome' is not null then
    ctx := ctx || jsonb_build_object('primeiro_nome', initcap(split_part(trim(ctx ->> 'nome'), ' ', 1)));
  end if;
  dados := jsonb_build_object('cliente', ctx, 'evento', coalesce(p_dados, '{}'));

  select exists (select 1 from automacao_acoes where automacao_id = a.id and tipo in ('enviar_template', 'enviar_mensagem'))
    into manda_mensagem;

  motivo := case
    when not exists (select 1 from automacao_acoes where automacao_id = a.id) then 'sem_acoes'
    when manda_mensagem and tel is null then 'telefone_invalido'
    when exists (select 1 from nao_perturbe np where np.empresa_id = a.empresa_id
                   and (np.telefone = tel or (p_cliente is not null and np.client_id = p_cliente)))
      then 'nao_perturbe'
    when not atende_condicoes(a.condicoes, dados) then 'condicoes'
    when manda_mensagem and cfg.limite_contato_horas > 0 and (
      exists (select 1 from envios e where e.empresa_id = a.empresa_id and e.telefone = tel and e.tipo <> 'nota'
                and e.enviado_em > now() - make_interval(hours => cfg.limite_contato_horas))
      or exists (select 1 from execucoes x join eventos ev on ev.id = x.evento_id
                 join automacao_acoes aa on aa.id = x.acao_id
                 where x.empresa_id = a.empresa_id and ev.telefone = tel and x.status in ('pendente', 'executando')
                   and aa.tipo in ('enviar_template', 'enviar_mensagem')))
      then 'limite_contato'
  end;

  insert into eventos (empresa_id, automacao_id, dedupe_key, client_id, octadesk_contact_id, conversa_id, telefone, nome, dados, situacao, motivo)
  values (a.empresa_id, a.id, p_dedupe, p_cliente, contato, p_conversa, tel, ctx ->> 'nome', dados,
          case when motivo is null then 'agendado' else 'ignorado' end, motivo)
  on conflict (automacao_id, dedupe_key) do nothing
  returning id into eid;

  if eid is null then return jsonb_build_object('ok', true, 'motivo', 'duplicado'); end if;
  if motivo is not null then return jsonb_build_object('ok', true, 'evento_id', eid, 'ignorado', motivo); end if;

  t := now() + intervalo(a.atraso_valor, a.atraso_unidade);
  for act in select * from automacao_acoes where automacao_id = a.id order by posicao loop
    t := t + intervalo(act.espera_valor, act.espera_unidade);
    insert into execucoes (empresa_id, automacao_id, acao_id, evento_id, agendado_para)
    values (a.empresa_id, a.id, act.id, eid,
            case when a.respeitar_horario and act.tipo in ('enviar_template', 'enviar_mensagem')
                 then proximo_horario_util(t, a.empresa_id) else t end);
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'evento_id', eid, 'execucoes', n);
end $$;

-- ---------------------------------------------------------------------
-- Entradas
-- ---------------------------------------------------------------------

-- Webhooks de conversa do Octadesk: o segredo do caminho da URL identifica a empresa.
create or replace function octaplus.receber_octadesk(p_segredo text, p_evento text, p_dados jsonb)
returns jsonb language plpgsql security definer set search_path = octaplus, public as $$
declare
  emp uuid; alvo tipo_gatilho; a automacoes; contato text; tel text; cliente uuid; sala text; chave text;
  msg jsonb; total int := 0; conversa jsonb;
begin
  select empresa_id into emp from integracao_octadesk where segredo_webhook = coalesce(p_segredo, '');
  if emp is null then return jsonb_build_object('ok', false, 'motivo', 'nao_autorizado'); end if;
  alvo := case p_evento
    when 'room.after-close'          then 'octa_conversa_encerrada'
    when 'room.after-set-agent'      then 'octa_conversa_atribuida'
    when 'room.after-insert-message' then 'octa_nova_mensagem'
  end;
  if alvo is null then return jsonb_build_object('ok', true, 'motivo', 'evento_nao_usado'); end if;

  sala    := p_dados ->> 'id';
  contato := p_dados #>> '{contact,id}';
  tel     := coalesce(p_dados #>> '{contact,phoneContacts,0,countryCode}', '') || coalesce(p_dados #>> '{contact,phoneContacts,0,number}', '');
  cliente := case when contato is not null then cliente_por_contato(contato) end;
  msg     := p_dados -> 'messages' -> -1;
  chave   := p_evento || ':' || sala || case when alvo = 'octa_nova_mensagem'
               then ':' || coalesce(msg ->> 'id', p_dados ->> 'lastMessageDate', '') else '' end;
  conversa := jsonb_strip_nulls(jsonb_build_object(
    'id', sala, 'numero', p_dados ->> 'number', 'status', p_dados ->> 'status',
    'agente', p_dados #>> '{agent,name}', 'agente_id', p_dados #>> '{agent,id}',
    'grupo', p_dados #>> '{group,name}', 'grupo_id', p_dados #>> '{group,id}',
    'origem', p_dados ->> 'origin', 'tags', p_dados -> 'tags',
    'ultima_mensagem', msg ->> 'body', 'ultima_mensagem_de', msg #>> '{sentBy,type}'));

  for a in select * from automacoes where empresa_id = emp and fonte = 'octadesk' and gatilho = alvo
             and ativa and arquivada_em is null loop
    perform registrar_evento(a.id, chave, cliente, contato, sala, tel, p_dados #>> '{contact,name}',
                             jsonb_build_object('conversa', conversa));
    total := total + 1;
  end loop;
  return jsonb_build_object('ok', true, 'automacoes', total);
end $$;

-- Rodada dos detectores: janela de cada empresa, empresas inativas de fora.
create or replace function octaplus.detectar_eventos(p_limite integer default 500) returns jsonb
language plpgsql security definer set search_path = octaplus, public as $$
declare a automacoes; c candidato; desde timestamptz; janela int; r jsonb; resumo jsonb := '{}'; n int;
begin
  for a in select au.* from automacoes au join empresas e on e.id = au.empresa_id
           where au.fonte = 'metrics' and au.ativa and au.arquivada_em is null and e.ativa loop
    select janela_deteccao_horas into janela from configuracao where empresa_id = a.empresa_id;
    desde := greatest(coalesce(a.ativa_desde, now()), now() - make_interval(hours => coalesce(janela, 48)));
    n := 0;
    for c in
      select * from candidatos(a, desde) k
      where not exists (select 1 from eventos e where e.automacao_id = a.id and e.dedupe_key = k.dedupe)
      limit p_limite
    loop
      r := registrar_evento(a.id, c.dedupe, c.client_id, c.contato, c.conversa, c.telefone, c.nome, c.dados);
      n := n + 1;
    end loop;
    resumo := resumo || jsonb_build_object(a.nome, n);
  end loop;
  return resumo;
end $$;

-- ---------------------------------------------------------------------
-- Motor (n8n)
-- ---------------------------------------------------------------------

-- Credenciais e estado da integração de uma empresa
create or replace function octaplus.credenciais_octadesk(p_empresa uuid) returns jsonb
language sql stable security definer set search_path = octaplus as $$
  select to_jsonb(i) - 'segredo_webhook' || jsonb_build_object(
    'api_key',  (select valor from segredos s where s.empresa_id = i.empresa_id and chave = 'octadesk_api_key'),
    'usuario',  (select valor from segredos s where s.empresa_id = i.empresa_id and chave = 'octadesk_usuario'),
    'senha',    (select valor from segredos s where s.empresa_id = i.empresa_id and chave = 'octadesk_senha'),
    'tenant',   (select valor from segredos s where s.empresa_id = i.empresa_id and chave = 'octadesk_tenant'),
    'jwt',      (select valor from segredos s where s.empresa_id = i.empresa_id and chave = 'octadesk_jwt'),
    'jwt_expira_em', (select expira_em from segredos s where s.empresa_id = i.empresa_id and chave = 'octadesk_jwt'),
    'catalogo_vencido', i.sincronizado_em is null or i.sincronizado_em < now() - interval '1 hour'
                        or i.sincronizacao_pedida_em > coalesce(i.sincronizado_em, '-infinity'))
  from integracao_octadesk i where i.empresa_id = p_empresa;
$$;

-- Manutenção do n8n: uma linha por empresa ativa com integração preenchida
create or replace function octaplus.credenciais_octadesk() returns setof jsonb
language sql stable security definer set search_path = octaplus as $$
  select credenciais_octadesk(e.id) from empresas e join integracao_octadesk i on i.empresa_id = e.id
  where e.ativa and i.base_url is not null order by e.criada_em;
$$;

create or replace function octaplus.gravar_jwt(p_empresa uuid, p_token text, p_expira_em timestamptz) returns void
language sql security definer set search_path = octaplus as $$
  insert into segredos (empresa_id, chave, valor, expira_em) values (p_empresa, 'octadesk_jwt', p_token, p_expira_em)
  on conflict (empresa_id, chave) do update set valor = excluded.valor, expira_em = excluded.expira_em, atualizado_em = now();
$$;

-- Resultado do /auth/check + catálogos de uma empresa. p = {ok, erro, numeros[], templates[], grupos[], tags[]}
create or replace function octaplus.gravar_catalogos(p_empresa uuid, p jsonb) returns void
language plpgsql security definer set search_path = octaplus as $$
begin
  if not coalesce((p ->> 'ok')::boolean, false) then
    update integracao_octadesk set status = 'erro', ultimo_erro = left(p ->> 'erro', 500), validado_em = now()
    where empresa_id = p_empresa;
    return;
  end if;

  insert into octa_numeros (empresa_id, id, nome, numero, ativo, sincronizado_em)
  select p_empresa, x ->> 'id', x ->> 'name', x ->> 'number', true, now() from jsonb_array_elements(coalesce(p -> 'numeros', '[]')) x
  on conflict (empresa_id, id) do update set nome = excluded.nome, numero = excluded.numero, ativo = true, sincronizado_em = now();
  update octa_numeros set ativo = false
  where empresa_id = p_empresa and id not in (select x ->> 'id' from jsonb_array_elements(coalesce(p -> 'numeros', '[]')) x);

  delete from octa_templates where empresa_id = p_empresa;
  insert into octa_templates (empresa_id, id, nome, status, categoria, habilitado, componentes, variaveis, corpo)
  select p_empresa, x ->> 'id', x ->> 'name', x ->> 'status', x ->> 'category', (x ->> 'enable')::boolean,
         coalesce(x -> 'components', '[]'),
         array(select distinct v ->> 'key' from jsonb_array_elements(coalesce(x -> 'components', '[]')) comp,
                    jsonb_array_elements(coalesce(comp -> 'variables', '[]')) v where v ->> 'key' is not null),
         (select comp ->> 'message' from jsonb_array_elements(coalesce(x -> 'components', '[]')) comp
          where upper(comp ->> 'type') = 'BODY' limit 1)
  from jsonb_array_elements(coalesce(p -> 'templates', '[]')) x;

  delete from octa_grupos where empresa_id = p_empresa;
  insert into octa_grupos (empresa_id, id, nome)
  select p_empresa, x ->> 'id', x ->> 'name' from jsonb_array_elements(coalesce(p -> 'grupos', '[]')) x;
  delete from octa_tags where empresa_id = p_empresa;
  insert into octa_tags (empresa_id, id, nome)
  select p_empresa, x ->> 'id', x ->> 'name' from jsonb_array_elements(coalesce(p -> 'tags', '[]')) x;

  update integracao_octadesk set status = 'conectado', ultimo_erro = null, validado_em = now(), sincronizado_em = now()
  where empresa_id = p_empresa;
end $$;

-- Saída do Code node de manutenção, um item por empresa: {empresa_id, catalogo?, jwt?: {token, expira_em}}
create or replace function octaplus.gravar_manutencao(p jsonb) returns void
language plpgsql security definer set search_path = octaplus as $$
declare emp uuid := (p ->> 'empresa_id')::uuid;
begin
  if emp is null then return; end if;
  if p ? 'catalogo' then perform gravar_catalogos(emp, p -> 'catalogo'); end if;
  if p #>> '{jwt,token}' is not null then
    perform gravar_jwt(emp, p #>> '{jwt,token}', (p #>> '{jwt,expira_em}')::timestamptz);
  end if;
end $$;

-- Execuções vencidas com a configuração e as credenciais da empresa de cada uma
create or replace function octaplus.pegar_execucoes(p_limite integer default 50) returns setof jsonb
language plpgsql security definer set search_path = octaplus as $$
begin
  update execucoes set status = 'pendente', travado_em = null
  where status = 'executando' and travado_em < now() - interval '10 minutes';

  return query
  with vencidas as (
    select x.id from execucoes x join empresas emp on emp.id = x.empresa_id and emp.ativa
    where x.status = 'pendente' and x.agendado_para <= now()
    order by x.agendado_para limit p_limite for update of x skip locked
  ), marcadas as (
    update execucoes x set status = 'executando', travado_em = now(), tentativas = x.tentativas + 1
    from vencidas where x.id = vencidas.id returning x.*
  )
  select jsonb_build_object(
    'execucao_id', m.id, 'tentativas', m.tentativas, 'empresa_id', m.empresa_id,
    'automacao', jsonb_build_object('id', a.id, 'nome', a.nome),
    'acao', jsonb_build_object('id', ac.id, 'tipo', ac.tipo, 'posicao', ac.posicao, 'config', ac.config),
    'evento', jsonb_build_object('id', e.id, 'telefone', e.telefone, 'nome', e.nome, 'client_id', e.client_id,
                                 'octadesk_contact_id', e.octadesk_contact_id, 'conversa_id', e.conversa_id, 'dados', e.dados),
    'numero_padrao', cfg.numero_envio_padrao,
    'fila', case when ac.tipo = 'transferir_fila' then coalesce(
              nullif(ac.config ->> 'grupo_id', ''),
              (select f.grupo_id from mapa_filas f where f.empresa_id = m.empresa_id
                 and upper(f.tipo_entrega) = upper(e.dados #>> '{cliente,tipo_entrega}')),
              (select f.grupo_id from mapa_filas f where f.empresa_id = m.empresa_id and f.tipo_entrega = '*')) end,
    'octadesk', credenciais_octadesk(m.empresa_id))
  from marcadas m
  join automacoes a on a.id = m.automacao_id
  join automacao_acoes ac on ac.id = m.acao_id
  join eventos e on e.id = m.evento_id
  left join configuracao cfg on cfg.empresa_id = m.empresa_id;
end $$;

create or replace function octaplus.concluir_execucao(
  p_execucao uuid, p_status text, p_resultado jsonb default null, p_erro text default null, p_codigo text default null
) returns void language plpgsql security definer set search_path = octaplus as $$
declare x execucoes; ev eventos; st status_execucao := p_status::status_execucao;
begin
  select * into x from execucoes where id = p_execucao;
  if x.id is null then return; end if;

  if st = 'pendente' and x.tentativas < 3 then
    update execucoes set status = 'pendente', erro = p_erro, codigo_erro = p_codigo, travado_em = null,
                         agendado_para = now() + make_interval(mins => 5 * x.tentativas)
    where id = x.id;
    return;
  end if;
  if st = 'pendente' then st := 'erro'; end if;

  update execucoes set status = st, resultado = p_resultado, erro = p_erro, codigo_erro = p_codigo,
                       concluido_em = now(), travado_em = null
  where id = x.id;

  if st = 'sucesso' then
    select * into ev from eventos where id = x.evento_id;
    if p_resultado ->> 'room_key' is not null and ev.conversa_id is null then
      update eventos set conversa_id = p_resultado ->> 'room_key' where id = ev.id;
    end if;
    if p_resultado ? 'envio' then
      insert into envios (empresa_id, execucao_id, automacao_id, client_id, telefone, tipo, template_id, numero_origem, room_key, message_key)
      values (x.empresa_id, x.id, x.automacao_id, ev.client_id, ev.telefone, p_resultado #>> '{envio,tipo}', p_resultado #>> '{envio,template_id}',
              p_resultado #>> '{envio,numero_origem}', coalesce(p_resultado ->> 'room_key', ev.conversa_id), p_resultado ->> 'message_key');
    end if;
  end if;
end $$;

-- API pública: a chave diz a empresa
create or replace function octaplus.api_formatar_telefone(p_segredo text, p_telefone text) returns jsonb
language plpgsql security definer set search_path = octaplus, extensions, public as $$
declare k chaves_api; formatado text;
begin
  select c.* into k from chaves_api c join empresas e on e.id = c.empresa_id and e.ativa
  where c.hash = encode(digest(coalesce(p_segredo, ''), 'sha256'), 'hex') and c.revogada_em is null;
  if k.id is null then return jsonb_build_object('ok', false, 'error', 'invalid_api_key'); end if;
  formatado := normalizar_telefone(p_telefone);
  update chaves_api set usado_em = now() where id = k.id;
  insert into chamadas_api (empresa_id, chave_id, endpoint, ok) values (k.empresa_id, k.id, '/v1/format', formatado is not null);
  return jsonb_build_object('ok', formatado is not null, 'input', p_telefone, 'e164', formatado,
                            'digits', regexp_replace(coalesce(formatado, ''), '\D', '', 'g'));
end $$;

-- ---------------------------------------------------------------------
-- RPCs do painel (empresa atual)
-- ---------------------------------------------------------------------
create or replace function octaplus.salvar_automacao(p jsonb) returns uuid
language plpgsql security definer set search_path = octaplus as $$
declare aid uuid := nullif(p ->> 'id', '')::uuid; emp uuid := empresa_atual(); x jsonb; i int := 0;
begin
  if not pode('editar') then raise exception 'sem_permissao'; end if;
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
  if not pode('editar') then raise exception 'sem_permissao'; end if;
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

-- p = {base_url, subdominio, agente_email, api_privada_ativa, api_key?, usuario?, senha?, tenant?}
create or replace function octaplus.salvar_integracao(p jsonb) returns void
language plpgsql security definer set search_path = octaplus as $$
declare k text; emp uuid := empresa_atual();
begin
  if not pode('editar') then raise exception 'sem_permissao'; end if;
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
  if not pode('editar') then raise exception 'sem_permissao'; end if;
  update integracao_octadesk set sincronizacao_pedida_em = now() where empresa_id = empresa_atual();
end $$;

create or replace function octaplus.segredos_preenchidos() returns text[]
language sql stable security definer set search_path = octaplus as $$
  select case when pode('ver')
    then array(select chave from segredos where empresa_id = empresa_atual() and chave <> 'octadesk_jwt') else '{}' end;
$$;

create or replace function octaplus.criar_chave_api(p_nome text) returns jsonb
language plpgsql security definer set search_path = octaplus, extensions, public as $$
declare segredo text := 'br_live_' || encode(gen_random_bytes(24), 'hex'); kid uuid;
begin
  if not pode('editar') then raise exception 'sem_permissao'; end if;
  insert into chaves_api (empresa_id, nome, prefixo, hash, criado_por)
  values (empresa_atual(), p_nome, left(segredo, 12), encode(digest(segredo, 'sha256'), 'hex'), auth.uid()) returning id into kid;
  return jsonb_build_object('id', kid, 'segredo', segredo);   -- aparece uma vez só
end $$;

create or replace function octaplus.revogar_chave_api(p_id uuid) returns void
language plpgsql security definer set search_path = octaplus as $$
begin
  if not pode('editar') then raise exception 'sem_permissao'; end if;
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
  where pode('ver')
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
  from automacoes a where a.empresa_id = empresa_atual() and pode('ver');
$$;

-- ---------------------------------------------------------------------
-- Acesso
-- ---------------------------------------------------------------------
revoke execute on function
  octaplus.proximo_horario_util(timestamptz, uuid), octaplus.credenciais_octadesk(uuid), octaplus.credenciais_octadesk(),
  octaplus.gravar_jwt(uuid, text, timestamptz), octaplus.gravar_catalogos(uuid, jsonb), octaplus.gravar_manutencao(jsonb)
from public, anon, authenticated;
