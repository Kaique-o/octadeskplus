// Testes do schema octaplus num Postgres embarcado (PGlite), com um stub do metrics.
// Uso: npm run db:test   (na pasta octadeskplus)
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
process.on('uncaughtException', (e) => {
  console.error(`
ERRO INESPERADO: ${e.message}${e.query ? `
  consulta: ${e.query.slice(0, 300)}` : ''}`);
  process.exit(1);
});
const migrations = path.join(aqui, '..', 'migrations');
const db = new PGlite({ extensions: { pgcrypto } });

let falhas = 0;
const q = async (sql, params) => (await db.query(sql, params)).rows;
const um = async (sql, params) => (await q(sql, params))[0];
const teste = (nome, ok, detalhe = '') => {
  console.log(`${ok ? 'ok    ' : 'FALHOU'} ${nome}${!ok && detalhe ? `\n       ${detalhe}` : ''}`);
  if (!ok) falhas++;
};
const comoUsuario = async (uid) => {
  await db.exec(`reset role; select set_config('teste.uid', '${uid ?? ''}', false);`);
  if (uid) await db.exec('set role authenticated');
};
const comoMotor = () => db.exec(`reset role; select set_config('teste.uid', '', false);`);

// ---------------------------------------------------------------- estrutura
await db.exec(fs.readFileSync(path.join(aqui, 'stub-metrics.sql'), 'utf8'));
for (const f of fs.readdirSync(migrations).sort()) {
  try { await db.exec(fs.readFileSync(path.join(migrations, f), 'utf8')); teste(`migration ${f}`, true); }
  catch (e) { teste(`migration ${f}`, false, e.message); process.exit(1); }
}

// usuários: dono (owner no metrics) e alguém sem permissão
const dono = (await um(`insert into auth.users (email) values ('dono@x') returning id`)).id;
const semAcesso = (await um(`insert into auth.users (email) values ('visitante@x') returning id`)).id;
await q(`insert into public.user_roles (user_id, role) values ($1, 'owner'), ($2, 'viewer')`, [dono, semAcesso]);

// dados do metrics
const vendedor = (await um(`insert into public.salespeople (name) values ('Cristal') returning id`)).id;
const cli = (await um(`insert into public.clients (name, telefone, octadesk_contact_id, curva_cliente, tipo_entrega, salesperson_id, dt_ultima_compra)
  values ('ANA MARIA SOUZA', '11988887777', 'oct-ana', 'A', 'SEDEX', $1, current_date - 30) returning id`, [vendedor])).id;
await q(`insert into public.client_octadesk_contacts (octadesk_contact_id, client_id, phone_country_code, phone_number, tipo_de_entrega)
  values ('oct-ana', $1, '55', '11977776666', 'SEDEX')`, [cli]);
const cliB = (await um(`insert into public.clients (name, telefone, curva_cliente) values ('Bruno Lima', '21 3333-4444', 'C') returning id`)).id;

// ---------------------------------------------------------------- permissões
await comoUsuario(semAcesso);
teste('sem permissão: pode(ver) é falso', (await um(`select octaplus.pode('ver') p`)).p === false);
let erro = '';
try { await q(`select octaplus.salvar_automacao('{"nome":"x","fonte":"metrics","gatilho":"venda_faturada"}')`); } catch (e) { erro = e.message; }
teste('sem permissão: salvar_automacao recusa', erro.includes('sem_permissao'), erro);
teste('sem permissão: não vê a configuração', (await q('select * from octaplus.configuracao')).length === 0);

await comoUsuario(dono);
teste('dono do metrics: pode(editar)', (await um(`select octaplus.pode('editar') p`)).p === true);
erro = '';
try { await q('select * from octaplus.segredos'); } catch (e) { erro = e.message; }
teste('segredos são invisíveis ao navegador', erro.includes('permission denied'), erro);

// ---------------------------------------------------------------- integração e catálogos
await q(`select octaplus.salvar_integracao($1)`, [{ base_url: 'https://o1.api001.octadesk.services/', subdominio: 'o1',
  agente_email: 'bot@x', api_privada_ativa: true, api_key: 'chave-73', usuario: 'u@x', senha: 's', tenant: 't' }]);
teste('segredos_preenchidos lista o que foi salvo', (await um('select octaplus.segredos_preenchidos() s')).s.length === 4);
await comoMotor();
let cred = (await um('select octaplus.credenciais_octadesk() c')).c;
teste('credenciais para o n8n: chave, barra final removida, catálogo vencido',
  cred.api_key === 'chave-73' && cred.base_url === 'https://o1.api001.octadesk.services' && cred.status === 'validando' && cred.catalogo_vencido === true);
await q(`select octaplus.gravar_catalogos($1)`, [{ ok: true,
  numeros: [{ id: 'n1', name: 'Oficial', number: '+5511949602880' }],
  templates: [{ id: 't1', name: 'orcamento_de_ontem', status: 'approved', category: 'MARKETING', enable: true,
    components: [{ type: 'BODY', message: 'Oi {{nome}}, e o orçamento?', variables: [{ key: 'nome' }] }] }],
  grupos: [{ id: 'g-sedex', name: '3 - Atendimento Sedex' }, { id: 'g-tri', name: 'Triagem' }], tags: [{ id: 'tg', name: 'IA' }] }]);
const tpl = await um(`select variaveis, corpo from octaplus.octa_templates where id = 't1'`);
teste('catálogo: template com variáveis e corpo', tpl.variaveis[0] === 'nome' && tpl.corpo.startsWith('Oi'));
teste('catálogo: integração vira conectada', (await um('select status from octaplus.integracao_octadesk')).status === 'conectado');
await q(`insert into octaplus.mapa_filas values ('SEDEX', 'g-sedex', 'Sedex'), ('*', 'g-tri', 'Triagem')`);
await q(`update octaplus.configuracao set numero_envio_padrao = '+5511949602880',
  horario_comercial = '{"perDay":{"0":{"enabled":true,"windows":[{"start":"00:00","end":"23:59"}]},"1":{"enabled":true,"windows":[{"start":"00:00","end":"23:59"}]},"2":{"enabled":true,"windows":[{"start":"00:00","end":"23:59"}]},"3":{"enabled":true,"windows":[{"start":"00:00","end":"23:59"}]},"4":{"enabled":true,"windows":[{"start":"00:00","end":"23:59"}]},"5":{"enabled":true,"windows":[{"start":"00:00","end":"23:59"}]},"6":{"enabled":true,"windows":[{"start":"00:00","end":"23:59"}]}}}'`);

// ---------------------------------------------------------------- automações
await comoUsuario(dono);
const acaoTemplate = { tipo: 'enviar_template', config: { template_id: 't1', variaveis: { nome: '{{cliente.primeiro_nome}}' }, conversa_aberta: 'nao_fazer_nada' } };
const nova = async (a) => (await um(`select octaplus.salvar_automacao($1) id`, [a])).id;

const autVenda = await nova({ nome: 'Obrigado pela compra', ativa: true, fonte: 'metrics', gatilho: 'venda_faturada', respeitar_horario: false,
  acoes: [acaoTemplate, { tipo: 'transferir_fila', config: { usar_mapa_filas: true }, espera_valor: 5, espera_unidade: 'minutos' }] });
teste('automação ativa ganha ativa_desde', (await um(`select ativa_desde is not null d from octaplus.automacoes where id = $1`, [autVenda])).d);
erro = '';
try { await q(`select octaplus.salvar_automacao($1)`, [{ nome: 'x', fonte: 'metrics', gatilho: 'webhook_externo' }]); } catch (e) { erro = e.message; }
teste('fonte e gatilho precisam combinar', erro.includes('fonte_combina_com_gatilho'), erro);

// venda antes da ativação não dispara; depois dispara uma vez só
await comoMotor();
await q(`insert into public.sales (client_id, value, tipo_fiscal, numero_unico, marca, created_at)
  values ($1, 100, 'Venda', 1, 'X', now() - interval '1 hour')`, [cli]);
await q(`insert into public.sales (client_id, value, tipo_fiscal, numero_unico, marca) values ($1, 150, 'Venda', 2, 'Y'), ($1, 50, 'Venda', 2, 'Z')`, [cli]);
await q(`select octaplus.detectar_eventos()`);
await q(`select octaplus.detectar_eventos()`);
let evs = await q(`select * from octaplus.eventos where automacao_id = $1`, [autVenda]);
teste('venda: só a nota posterior à ativação, sem duplicar', evs.length === 1 && evs[0].dedupe_key === 'venda:2', JSON.stringify(evs.map((e) => e.dedupe_key)));
const ev = evs[0];
teste('venda: soma os itens da nota', Number(ev.dados.evento.valor_total) === 200 && ev.dados.evento.itens === 2);
teste('contexto: telefone do Octadesk tem preferência', ev.telefone === '+5511977776666', ev.telefone);
teste('contexto: primeiro nome, curva e vendedor', ev.dados.cliente.primeiro_nome === 'Ana' && ev.dados.cliente.curva === 'A' && ev.dados.cliente.vendedor === 'Cristal');
teste('venda: duas execuções agendadas', (await um(`select count(*)::int n from octaplus.execucoes where evento_id = $1`, [ev.id])).n === 2);

// ---------------------------------------------------------------- motor
let jobs = (await q(`select octaplus.pegar_execucoes(10) j`)).map((r) => r.j);
teste('pegar_execucoes: só a ação vencida (a segunda espera 5 min)', jobs.length === 1 && jobs[0].acao.tipo === 'enviar_template');
teste('pegar_execucoes: leva credenciais e número padrão', jobs[0].octadesk.api_key === 'chave-73' && jobs[0].numero_padrao === '+5511949602880');
await q(`select octaplus.concluir_execucao($1, 'sucesso', $2)`, [jobs[0].execucao_id,
  { room_key: 'room-1', message_key: 'm-1', envio: { tipo: 'template', template_id: 't1', numero_origem: '+5511949602880' } }]);
teste('concluir: grava o envio', (await um(`select count(*)::int n from octaplus.envios where room_key = 'room-1'`)).n === 1);
teste('concluir: room_key vira a conversa do evento', (await um(`select conversa_id from octaplus.eventos where id = $1`, [ev.id])).conversa_id === 'room-1');
await q(`update octaplus.execucoes set agendado_para = now() where evento_id = $1 and status = 'pendente'`, [ev.id]);
jobs = (await q(`select octaplus.pegar_execucoes(10) j`)).map((r) => r.j);
teste('transferir_fila: fila resolvida pelo tipo de entrega (SEDEX)', jobs[0]?.fila === 'g-sedex', JSON.stringify(jobs[0]?.fila));
await q(`select octaplus.concluir_execucao($1, 'pendente', null, 'jwt expirado', 'jwt_expirado')`, [jobs[0].execucao_id]);
const re = await um(`select status, agendado_para > now() futuro, codigo_erro from octaplus.execucoes where id = $1`, [jobs[0].execucao_id]);
teste('concluir pendente: reagenda com backoff', re.status === 'pendente' && re.futuro && re.codigo_erro === 'jwt_expirado');

// ---------------------------------------------------------------- regras do funil
await comoUsuario(dono);
const autCurva = await nova({ nome: 'Subiu para A', ativa: true, fonte: 'metrics', gatilho: 'mudanca_curva',
  parametros: { curva_para: 'A' }, respeitar_horario: false, acoes: [acaoTemplate] });
await comoMotor();
await q(`insert into public.client_curve_history (client_id, curva_de, curva_para) values ($1, 'B', 'A'), ($2, 'B', 'C')`, [cli, cliB]);
await q(`select octaplus.detectar_eventos()`);
evs = await q(`select * from octaplus.eventos where automacao_id = $1`, [autCurva]);
teste('curva: filtra pelo parâmetro curva_para', evs.length === 1);
teste('limite de contato: mesmo telefone já recebeu nas últimas 24h', evs[0].situacao === 'ignorado' && evs[0].motivo === 'limite_contato', `${evs[0]?.situacao} ${evs[0]?.motivo}`);

await comoUsuario(dono);
const autAlerta = await nova({ nome: 'Cadência rompida', ativa: true, fonte: 'metrics', gatilho: 'alerta_comportamento',
  parametros: { padroes: ['cadencia_rompida'] }, condicoes: { ativas: true, modo: 'todas', lista: [{ campo: 'cliente.curva', operador: 'igual', valor: 'C' }] },
  respeitar_horario: false, acoes: [acaoTemplate] });
await comoMotor();
await q(`insert into public.client_behavior_alerts (client_id, pattern, motivo, gerado_em) values
  ($1, 'cadencia_rompida', 'x', current_date), ($1, 'cadencia_rompida', 'x', current_date - 1), ($2, 'cadencia_rompida', 'x', current_date), ($2, 'aceleracao', 'x', current_date)`, [cliB, cli]);
await q(`select octaplus.detectar_eventos()`);
evs = await q(`select * from octaplus.eventos where automacao_id = $1 order by situacao`, [autAlerta]);
const porSemana = new Set(evs.filter((e) => e.client_id === cliB).map((e) => e.dedupe_key)).size;
teste('alerta: só o padrão escolhido', evs.every((e) => e.dados.evento.padrao === 'cadencia_rompida'));
teste('alerta: condição curva = C barra o cliente A', evs.some((e) => e.client_id === cli && e.motivo === 'condicoes'));
teste('alerta: cliente C agendado', evs.some((e) => e.client_id === cliB && e.situacao === 'agendado'));
teste('alerta: telefone fixo normalizado', evs.find((e) => e.client_id === cliB)?.telefone === '+552133334444');
teste('alerta: alertas do mesmo padrão na mesma semana viram um evento', porSemana >= 1 && porSemana <= 2);

await comoUsuario(dono);
const autSemCompra = await nova({ nome: '30 dias sem compra', ativa: true, fonte: 'metrics', gatilho: 'sem_compra',
  parametros: { dias: 30 }, respeitar_horario: false, acoes: [acaoTemplate] });
await q(`insert into octaplus.nao_perturbe (client_id, motivo) values ($1, 'pediu para sair')`, [cli]);
await comoMotor();
await q(`update octaplus.automacoes set ativa_desde = now() - interval '2 days' where id = $1`, [autSemCompra]);
await q(`select octaplus.detectar_eventos()`);
const sc = await um(`select situacao, motivo from octaplus.eventos where automacao_id = $1`, [autSemCompra]);
teste('sem_compra: detecta e respeita o não perturbe', sc?.situacao === 'ignorado' && sc?.motivo === 'nao_perturbe', JSON.stringify(sc));

// orçamento enviado ontem, sem compra depois
await comoUsuario(dono);
const autOrc = await nova({ nome: 'Orçamentos de ontem que não fecharam', ativa: true, fonte: 'metrics', gatilho: 'orcamento_sem_compra',
  parametros: { dias: 1 }, respeitar_horario: false, acoes: [acaoTemplate] });
await comoMotor();
await q(`update octaplus.automacoes set ativa_desde = now() - interval '2 days' where id = $1`, [autOrc]);
await q(`delete from octaplus.nao_perturbe`);
await db.exec(`delete from octaplus.envios; delete from octaplus.execucoes;`);
const cliC = (await um(`insert into public.clients (name, octadesk_contact_id) values ('Carla Dias', 'oct-carla') returning id`)).id;
await q(`insert into public.client_octadesk_contacts (octadesk_contact_id, client_id, phone_country_code, phone_number) values ('oct-carla', $1, '55', '31999990000')`, [cliC]);
await q(`insert into public.skyler_analyses (conversation_octadesk_id, cliente_id, cliente_nome, orcamento_enviado, orcamento_enviado_em) values
  ('conv-sem-compra', 'oct-carla', 'Carla', true, now() - interval '26 hours'),
  ('conv-comprou',    'oct-ana',   'Ana',   true, now() - interval '26 hours'),
  ('conv-anonimo',    'oct-desconhecido', 'X', true, now() - interval '26 hours')`);
await q(`insert into public.sales (client_id, value, tipo_fiscal, numero_unico, created_at) values ($1, 10, 'Venda', 9, now() - interval '20 hours')`, [cli]);
await q(`select octaplus.detectar_eventos()`);
evs = await q(`select dedupe_key, situacao from octaplus.eventos where automacao_id = $1`, [autOrc]);
teste('orçamento: só quem não comprou e é cliente conhecido', evs.length === 1 && evs[0].dedupe_key === 'orc:conv-sem-compra', JSON.stringify(evs));

// ---------------------------------------------------------------- entradas
await comoUsuario(dono);
const autWh = await nova({ nome: 'Campanha do metrics', ativa: true, fonte: 'webhook', gatilho: 'webhook_externo',
  campo_telefone: 'contact.phone_digits', respeitar_horario: false, acoes: [acaoTemplate] });
await comoMotor();
const segredo = (await um(`select segredo_webhook s from octaplus.automacoes where id = $1`, [autWh])).s;
teste('webhook: segredo errado é recusado', (await um(`select octaplus.receber_webhook($1, 'errado', '{}') r`, [autWh])).r.motivo === 'nao_autorizado');
const wh = (await um(`select octaplus.receber_webhook($1, $2, $3, 'camp-1') r`, [autWh, segredo, { contact: { phone_digits: '5511955554444', name: 'Davi' } }])).r;
const evWh = await um(`select * from octaplus.eventos where automacao_id = $1`, [autWh]);
teste('webhook: telefone pelo campo configurado e nome do payload', wh.ok && evWh.telefone === '+5511955554444' && evWh.nome === 'Davi', JSON.stringify(wh));
teste('webhook: guarda o primeiro payload como exemplo', (await um(`select payload_exemplo is not null p from octaplus.automacoes where id = $1`, [autWh])).p);
teste('webhook: dedupe informado evita duplicar', (await um(`select octaplus.receber_webhook($1, $2, '{}', 'camp-1') r`, [autWh, segredo])).r.motivo === 'duplicado');

await comoUsuario(dono);
const autOcta = await nova({ nome: 'Pesquisa pós-atendimento', ativa: true, fonte: 'octadesk', gatilho: 'octa_conversa_encerrada',
  respeitar_horario: false, acoes: [{ tipo: 'nota_interna', config: { texto: 'Conversa encerrada' } }] });
await comoMotor();
const segOcta = (await um(`select segredo_webhook s from octaplus.integracao_octadesk`)).s;
const chat = { id: 'room-9', number: 77, status: 'closed', contact: { id: 'oct-carla', name: 'Carla', phoneContacts: [{ countryCode: '55', number: '31999990000' }] },
  agent: { name: 'Cristal' }, messages: [{ id: 'm9', body: 'obrigada!', sentBy: { type: 'contact' } }] };
teste('Octadesk: segredo errado é recusado', (await um(`select octaplus.receber_octadesk('x', 'room.after-close', $1) r`, [chat])).r.ok === false);
await q(`select octaplus.receber_octadesk($1, 'room.after-close', $2)`, [segOcta, chat]);
const evO = await um(`select * from octaplus.eventos where automacao_id = $1`, [autOcta]);
teste('Octadesk: evento ligado ao cliente e à conversa', evO?.client_id === cliC && evO?.conversa_id === 'room-9' && evO?.dados.evento.conversa.agente === 'Cristal');

// ---------------------------------------------------------------- atribuição e estatísticas
const env = await um(`insert into octaplus.envios (automacao_id, client_id, telefone, tipo, room_key, enviado_em)
  values ($1, $2, '+5531999990000', 'template', 'room-at', now() - interval '3 hours') returning id`, [autOrc, cliC]);
await q(`insert into public.messages (octadesk_message_id, conversation_octadesk_id, time, sent_by_type) values ('r1', 'room-at', now() - interval '2 hours', 'contact')`);
await q(`insert into public.sales (client_id, value, tipo_fiscal, numero_unico, created_at) values ($1, 300, 'Venda', 50, now() - interval '1 hour')`, [cliC]);
await q(`select octaplus.atualizar_atribuicao()`);
const at = await um(`select respondeu_em is not null r, comprou_em is not null c, valor_compra::numeric v from octaplus.envios where id = $1`, [env.id]);
teste('atribuição: respondeu e comprou depois do envio', at.r && at.c && Number(at.v) === 300, JSON.stringify(at));

await comoUsuario(dono);
const est = await q(`select * from octaplus.estatisticas_diarias(current_date, current_date)`);
teste('estatísticas do dia contam gatilhos, ignorados e compras', Number(est[0].gatilhos) > 5 && Number(est[0].gatilhos_ignorados) >= 3 && Number(est[0].compras) === 1, JSON.stringify(est[0]));
teste('resumo por automação', (await q(`select * from octaplus.resumo_automacoes()`)).length === 7);
await comoUsuario(semAcesso);
teste('sem permissão: estatísticas vazias', (await q(`select * from octaplus.estatisticas_diarias(current_date, current_date)`)).length === 0);

// ---------------------------------------------------------------- API pública e telefone
await comoUsuario(dono);
const chave = (await um(`select octaplus.criar_chave_api('site') k`)).k;
await comoMotor();
const f = (await um(`select octaplus.api_formatar_telefone($1, '(11) 98888-7777') r`, [chave.segredo])).r;
teste('API /v1/format', f.ok && f.e164 === '+5511988887777');
const tel = await um(`select octaplus.normalizar_telefone('11 8888-7777') a, octaplus.normalizar_telefone('5521 3333-4444') b, octaplus.normalizar_telefone('123') c`);
teste('telefone: nono dígito, fixo e inválido', tel.a === '+5511988887777' && tel.b === '+552133334444' && tel.c === null);

// ---------------------------------------------------------------- empresa e usuários
await comoMotor();
const vendas = (await um(`insert into public.access_profiles (name) values ('Vendas') returning id`)).id;
const vendedora = (await um(`insert into auth.users (email) values ('vendas@x') returning id`)).id;
await q(`insert into public.access_profile_permissions (profile_id, resource, action) values ($1, 'octaplus', 'ver')`, [vendas]);
await q(`insert into public.user_roles (user_id, role, profile_id) values ($1, 'viewer', $2)`, [vendedora, vendas]);
await q(`insert into public.profiles (id, email, full_name) values ($1, 'dono@x', 'Dono'), ($2, 'visitante@x', null), ($3, 'vendas@x', 'Carla')`, [dono, semAcesso, vendedora]);
await comoUsuario(dono);
await q(`update octaplus.configuracao set empresa_nome = 'Skytech', empresa_cnpj = '12345678000190' where id`);
teste('empresa: dados gravados na configuração', (await um(`select empresa_nome n from octaplus.configuracao`)).n === 'Skytech');
erro = '';
try { await q(`update octaplus.configuracao set empresa_cnpj = '123' where id`); } catch (e) { erro = e.message; }
teste('empresa: CNPJ precisa ter 14 dígitos', erro.includes('check'), erro);
const us = await q(`select * from octaplus.listar_usuarios()`);
const carla = us.find((u) => u.email === 'vendas@x');
teste('usuários: lista os do metrics com papel e perfil', us.length === 3 && us.find((u) => u.email === 'dono@x').papel === 'owner'
  && carla.perfil_acesso === 'Vendas' && carla.pode_ver && !carla.pode_editar, JSON.stringify(us));
await comoUsuario(semAcesso);
teste('usuários: sem permissão não vê ninguém', (await q(`select * from octaplus.listar_usuarios()`)).length === 0);

console.log(falhas ? `\n${falhas} teste(s) falharam` : '\ntodos os testes passaram');
process.exit(falhas ? 1 : 0);
