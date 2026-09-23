// Várias empresas no mesmo banco: isolamento por RLS, área Owner e motor por empresa.
// Uso: npm run db:test (roda junto com testar.mjs)
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const db = new PGlite({ extensions: { pgcrypto } });

let falhas = 0;
const q = async (sql, params) => (await db.query(sql, params)).rows;
const um = async (sql, params) => (await q(sql, params))[0];
const teste = (nome, ok, detalhe = '') => {
  console.log(`${ok ? 'ok    ' : 'FALHOU'} ${nome}${!ok && detalhe ? `\n       ${detalhe}` : ''}`);
  if (!ok) falhas++;
};
const como = async (uid, empresa = null) => {
  const h = empresa ? JSON.stringify({ 'x-empresa': empresa }) : '';
  await db.exec(`reset role; select set_config('teste.uid', '${uid ?? ''}', false), set_config('request.headers', '${h}', false);`);
  if (uid) await db.exec('set role authenticated');
};
const motor = () => como(null);
const falha = async (sql, params) => { try { await q(sql, params); return ''; } catch (e) { return e.message; } };

await db.exec(fs.readFileSync(path.join(aqui, 'stub-metrics.sql'), 'utf8'));
const pasta = path.join(aqui, '..', 'migrations');
for (const f of fs.readdirSync(pasta).sort()) await db.exec(fs.readFileSync(path.join(pasta, f), 'utf8'));

const dono = (await um(`insert into auth.users (email) values ('olivera@x.com') returning id`)).id;
await q(`insert into public.user_roles (user_id, role) values ($1, 'owner')`, [dono]);
const A = (await um('select id from octaplus.empresas')).id;

// ---------------------------------------------------------------- área Owner
await como(dono);
const B = (await um(`select octaplus.salvar_empresa('{"nome":"Skyline"}') id`)).id;
await motor();
teste('owner: cria empresa já com configuração e integração', (await um(`select
  (select count(*) from octaplus.configuracao where empresa_id = $1)::int c,
  (select count(*) from octaplus.integracao_octadesk where empresa_id = $1)::int i`, [B])).c === 1);
// criar e editar com os dados cadastrais e o fuso
await como(dono);
const C = (await um(`select octaplus.salvar_empresa($1) id`, [{ nome: 'Sky Norte', cnpj: '12.345.678/0001-90', telefone: '(92) 3333-4444', site: 'https://norte.com', fuso: 'America/Manaus' }])).id;
await motor();
let dadosC = await um(`select e.cnpj, e.telefone, e.site, c.fuso from octaplus.empresas e join octaplus.configuracao c on c.empresa_id = e.id where e.id = $1`, [C]);
teste('owner: nova empresa já nasce com CNPJ, telefone, site e fuso', dadosC.cnpj === '12345678000190' && dadosC.telefone === '(92) 3333-4444'
  && dadosC.site === 'https://norte.com' && dadosC.fuso === 'America/Manaus', JSON.stringify(dadosC));
await como(dono);
await q(`select octaplus.salvar_empresa($1)`, [{ id: C, fuso: 'America/Sao_Paulo' }]);
await motor();
dadosC = await um(`select e.cnpj, c.fuso from octaplus.empresas e join octaplus.configuracao c on c.empresa_id = e.id where e.id = $1`, [C]);
teste('empresa: editar só o fuso mantém o resto', dadosC.fuso === 'America/Sao_Paulo' && dadosC.cnpj === '12345678000190', JSON.stringify(dadosC));
await como(dono);
teste('lista de empresas traz o fuso', (await q('select fuso from octaplus.listar_empresas() where id = $1', [C]))[0]?.fuso === 'America/Sao_Paulo');
teste('empresa: fuso inválido é recusado', (await falha(`select octaplus.salvar_empresa($1)`, [{ id: C, fuso: 'Lua/Base' }])).includes('fuso_invalido'));
await q(`select octaplus.apagar_empresa($1, 'Sky Norte')`, [C]);
await motor();

// perfis padrão de cada empresa
const perfil = async (emp, nome) => (await um('select id from octaplus.perfis where empresa_id = $1 and nome = $2', [emp, nome])).id;
const [ADMIN_A, EDITA_A, SOVE_A, EDITA_B, SOVE_B] = [await perfil(A, 'Administrador'), await perfil(A, 'Edita'), await perfil(A, 'Só vê'), await perfil(B, 'Edita'), await perfil(B, 'Só vê')];
teste('perfis: toda empresa nasce com Administrador, Edita e Só vê', Boolean(ADMIN_A && EDITA_A && SOVE_A && EDITA_B && SOVE_B));

await como(dono);
const uA = (await um(`select octaplus.criar_usuario($1, 'ana@x.com', 'Ana', 'senha-da-ana', $2) id`, [A, EDITA_A])).id;
const uB = (await um(`select octaplus.criar_usuario($1, 'bia@x.com', 'Bia', 'senha-da-bia', $2) id`, [B, SOVE_B])).id;
await motor();
const conta = await um(`select u.email_confirmed_at is not null conf, u.encrypted_password = crypt('senha-da-ana', u.encrypted_password) senha,
  (select count(*) from auth.identities i where i.user_id = u.id and i.provider = 'email')::int ident from auth.users u where id = $1`, [uA]);
teste('owner: conta criada com e-mail confirmado, senha e identidade', conta.conf && conta.senha && conta.ident === 1, JSON.stringify(conta));
await como(dono);
teste('owner: mesmo e-mail reaproveita a conta', (await um(`select octaplus.criar_usuario($1, 'ANA@x.com', null, null, $2) id`, [B, SOVE_B])).id === uA);
await q(`select octaplus.definir_membro_ativo($1, $2, false)`, [B, uA]);
teste('owner: dono não vira membro', (await falha(`select octaplus.criar_usuario($1, 'OLIVERA@x.com', null, 'qualquer-1', $2)`, [A, SOVE_A])).includes('usuario_e_dono'));
teste('owner: senha curta recusada', (await falha(`select octaplus.criar_usuario($1, 'c@x.com', null, '123', $2)`, [A, SOVE_A])).includes('senha_curta'));
teste('perfil de outra empresa é recusado', (await falha(`select octaplus.criar_usuario($1, 'c@x.com', null, 'senha-longa-1', $2)`, [A, SOVE_B])).includes('perfil_invalido'));
await q(`select octaplus.redefinir_senha($1, $2, 'nova-senha-ana')`, [A, uA]);
await motor();
teste('owner: redefine a senha (mesmo de quem está em outras empresas)', (await um(`select encrypted_password = crypt('nova-senha-ana', encrypted_password) ok from auth.users where id = $1`, [uA])).ok);
await como(dono);
teste('owner: não redefine a senha do dono', (await falha(`select octaplus.redefinir_senha($1, $2, 'outra-senha-1')`, [A, dono])).includes('usuario_e_dono'));
teste('owner: lista as duas empresas', (await q('select * from octaplus.listar_empresas()')).length === 2);
teste('owner: lista os membros de uma empresa', (await q('select * from octaplus.listar_membros($1)', [B])).length === 2);

// editar e apagar usuário (na empresa)
await q(`select octaplus.editar_membro($1, $2, 'Bia Souza', $3)`, [B, uB, EDITA_B]);
const bia = (await q('select * from octaplus.listar_membros($1)', [B])).find((m) => m.user_id === uB);
teste('owner: edita nome e perfil do usuário', bia.nome === 'Bia Souza' && bia.perfil === 'Edita', JSON.stringify(bia));
await q(`select octaplus.editar_membro($1, $2, 'Bia', $3)`, [B, uB, SOVE_B]);
teste('owner: não edita o dono', (await falha(`select octaplus.editar_membro($1, $2, 'x', $3)`, [B, dono, SOVE_B])).includes('usuario_e_dono'));
const extra = (await um(`select octaplus.criar_usuario($1, 'saiu@x.com', 'Saiu', 'senha-longa-1', $2) id`, [B, EDITA_B])).id;
await q(`select octaplus.remover_membro($1, $2)`, [B, extra]);
teste('owner: apagar tira o usuário da empresa', !(await q('select * from octaplus.listar_membros($1)', [B])).some((m) => m.user_id === extra));
await como(extra, B);
teste('usuário apagado perde o acesso', (await um(`select octaplus.pode('ver') p`)).p === false);
await como(dono);

// uA tem "Edita" em A: usuários só ver
for (const [nome, sql, params] of [
  ['editar usuário', `select octaplus.editar_membro($1, $2, 'x', $3)`, [B, uB, EDITA_B]],
  ['apagar usuário', `select octaplus.remover_membro($1, $2)`, [B, uB]],
  ['criar empresa', `select octaplus.salvar_empresa('{"nome":"X"}')`],
  ['criar usuário', `select octaplus.criar_usuario($1, 'z@x.com', null, 'senha-longa-1', $2)`, [A, SOVE_A]],
  ['inativar empresa', `select octaplus.definir_empresa_ativa($1, false)`, [A]],
  ['apagar empresa', `select octaplus.apagar_empresa($1, 'Skyline')`, [B]],
  ['redefinir senha', `select octaplus.redefinir_senha($1, $2, 'senha-longa-1')`, [B, uB]],
  ['criar perfil', `select octaplus.salvar_perfil($1, '{"nome":"X"}')`, [A]],
]) {
  await como(uA, A);
  teste(`sem "usuários: edita" não pode ${nome}`, (await falha(sql, params)).includes('sem_permissao'));
}
await como(uA, A);
teste('perfil Edita: vê os usuários da empresa', (await q('select * from octaplus.listar_membros($1)', [A])).length === 1);
teste('perfil Edita: não vê usuários de outra empresa', (await q('select * from octaplus.listar_membros($1)', [B])).length === 0);
const minhas = await q('select id, perfil, permissoes from octaplus.listar_empresas()');
teste('não-owner: só vê as empresas em que tem vínculo ativo, com o perfil', minhas.length === 1 && minhas[0].id === A && minhas[0].perfil === 'Edita'
  && minhas[0].permissoes.usuarios === 'ver' && minhas[0].permissoes.automacoes === 'editar', JSON.stringify(minhas));

// ---------------------------------------------------------------- gestão delegada e perfis
await como(dono);
const gerente = (await um(`select octaplus.criar_usuario($1, 'gerente@x.com', 'Gê', 'senha-gerente-1', $2) id`, [A, ADMIN_A])).id;
await como(gerente, A);
const novo = (await um(`select octaplus.criar_usuario($1, 'novo@x.com', 'Novo', 'senha-novo-12', $2) id`, [A, SOVE_A])).id;
teste('delegado: quem tem "usuários: edita" cria usuário na própria empresa', Boolean(novo));
teste('delegado: redefine senha de quem só está na empresa dele', (await falha(`select octaplus.redefinir_senha($1, $2, 'trocada-12345')`, [A, novo])) === '');
teste('delegado: não redefine senha de quem também está em outra empresa', (await falha(`select octaplus.redefinir_senha($1, $2, 'trocada-12345')`, [A, uA])).includes('usuario_em_outras_empresas'));
teste('delegado: não mexe em si mesmo', (await falha(`select octaplus.remover_membro($1, $2)`, [A, gerente])).includes('voce_mesmo'));
teste('delegado: não cria usuário em outra empresa', (await falha(`select octaplus.criar_usuario($1, 'x9@x.com', null, 'senha-longa-1', $2)`, [B, SOVE_B])).includes('sem_permissao'));

const EXPED = (await um(`select octaplus.salvar_perfil($1, $2) id`, [A, { nome: 'Expedição', permissoes: { nao_perturbe: 'editar', automacoes: 'ver' } }])).id;
const exped = (await q('select * from octaplus.listar_perfis($1)', [A])).find((p) => p.id === EXPED);
teste('perfil: áreas não marcadas ficam sem acesso', exped.permissoes.integracoes === 'nenhum' && exped.permissoes.api === 'nenhum' && exped.permissoes.nao_perturbe === 'editar');
teste('perfil: permissão inválida é recusada', (await falha(`select octaplus.salvar_perfil($1, $2)`, [A, { nome: 'Y', permissoes: { api: 'tudo' } }])).includes('permissao_invalida'));
teste('perfil: nome repetido é recusado', (await falha(`select octaplus.salvar_perfil($1, $2)`, [A, { nome: 'Expedição' }])).includes('perfil_repetido'));
await q(`select octaplus.editar_membro($1, $2, 'Novo', $3)`, [A, novo, EXPED]);
teste('perfil: em uso não pode ser apagado', (await falha(`select octaplus.apagar_perfil($1, $2)`, [A, EXPED])).includes('perfil_em_uso'));
const livre = (await um(`select octaplus.salvar_perfil($1, '{"nome":"Temporário"}') id`, [A])).id;
await q(`select octaplus.apagar_perfil($1, $2)`, [A, livre]);
teste('perfil: sem usuários pode ser apagado', !(await q('select * from octaplus.listar_perfis($1)', [A])).some((p) => p.id === livre));

await como(novo, A);
const pode = async (area, acao) => (await um(`select octaplus.pode_aqui($1, $2) p`, [area, acao])).p;
teste('área: Expedição vê automações mas não edita', (await pode('automacoes', 'ver')) && !(await pode('automacoes', 'editar')));
teste('área: Expedição edita o não perturbe', await pode('nao_perturbe', 'editar'));
teste('área: Expedição não vê integrações nem API', !(await pode('integracoes', 'ver')) && !(await pode('api', 'ver')));
teste('área: sem API não lê chaves', (await q('select * from octaplus.chaves_api')).length === 0);
teste('área: sem editar automações não salva', (await falha(`select octaplus.salvar_automacao($1)`, [{ nome: 'x', fonte: 'webhook', gatilho: 'webhook_externo' }])).includes('sem_permissao'));
teste('área: sem editar integrações não salva a integração', (await falha(`select octaplus.salvar_integracao('{}')`)).includes('sem_permissao'));
await q(`insert into octaplus.nao_perturbe (telefone) values ('+5511911110000')`);
teste('área: grava no não perturbe', (await q('select * from octaplus.nao_perturbe')).length === 1);
await q(`delete from octaplus.nao_perturbe`);
await como(dono);

// ---------------------------------------------------------------- isolamento
const acao = [{ tipo: 'enviar_template', config: { template_id: 't1' } }];
await como(uA, A);
const autA = (await um(`select octaplus.salvar_automacao($1) id`, [{ nome: 'Régua A', ativa: true, fonte: 'webhook', gatilho: 'webhook_externo', respeitar_horario: false, acoes: acao }])).id;
await como(dono, B);
const autB = (await um(`select octaplus.salvar_automacao($1) id`, [{ nome: 'Régua B', ativa: true, fonte: 'webhook', gatilho: 'webhook_externo', respeitar_horario: false, acoes: acao }])).id;
const autOctaB = (await um(`select octaplus.salvar_automacao($1) id`, [{ nome: 'Encerrada B', ativa: true, fonte: 'octadesk', gatilho: 'octa_conversa_encerrada', respeitar_horario: false, acoes: [{ tipo: 'nota_interna', config: { texto: 'x' } }] }])).id;

await como(uA, A);
teste('isolamento: empresa A só vê a própria automação', JSON.stringify((await q('select id from octaplus.automacoes')).map((a) => a.id)) === JSON.stringify([autA]));
await como(uA, B);
teste('isolamento: header da B sem vínculo ativo não mostra nada', (await q('select * from octaplus.automacoes')).length === 0
  && (await q('select * from octaplus.configuracao')).length === 0 && (await q('select * from octaplus.integracao_octadesk')).length === 0);
teste('isolamento: header da B sem vínculo não salva', (await falha(`select octaplus.salvar_automacao($1)`, [{ nome: 'x', fonte: 'webhook', gatilho: 'webhook_externo' }])).includes('sem_permissao'));
teste('isolamento: não grava direto em outra empresa', (await falha(`insert into octaplus.nao_perturbe (empresa_id, telefone) values ($1, '+5511900000000')`, [B])) !== '');
await como(uA, A);
teste('isolamento: não grava linha com empresa_id de outra empresa', (await falha(`insert into octaplus.nao_perturbe (empresa_id, telefone) values ($1, '+5511900000000')`, [B])) !== '');
teste('isolamento: não altera automação de outra empresa pelo id', (await falha(`select octaplus.salvar_automacao($1)`, [{ id: autB, nome: 'invadida' }])).includes('nao_encontrado'));
teste('isolamento: não duplica automação de outra empresa', (await falha(`select octaplus.duplicar_automacao($1)`, [autB])).includes('nao_encontrado'));
await q(`update octaplus.automacoes set nome = 'invadida' where id = $1`, [autB]);
await motor();
teste('isolamento: update direto em outra empresa não pega', (await um(`select nome from octaplus.automacoes where id = $1`, [autB])).nome === 'Régua B');

await como(uB, B);
teste('nível ver: vê a empresa B', (await q('select * from octaplus.automacoes')).length === 2);
teste('nível ver: não edita', (await falha(`select octaplus.salvar_automacao($1)`, [{ nome: 'x', fonte: 'webhook', gatilho: 'webhook_externo' }])).includes('sem_permissao'));
await q(`update octaplus.automacoes set ativa = false where id = $1`, [autB]);
await motor();
teste('nível ver: update direto não pega', (await um(`select ativa from octaplus.automacoes where id = $1`, [autB])).ativa === true);

await como(dono);
await q(`select octaplus.definir_membro_ativo($1, $2, false)`, [A, uA]);
await como(uA, A);
teste('membro inativo: perde o acesso', (await um(`select octaplus.pode('ver') p`)).p === false && (await q('select * from octaplus.listar_empresas()')).length === 0);
await como(dono);
await q(`select octaplus.definir_membro_ativo($1, $2, true)`, [A, uA]);

// ---------------------------------------------------------------- motor por empresa
await como(uA, A);
await q(`select octaplus.salvar_integracao($1)`, [{ base_url: 'https://a.octadesk.services', agente_email: 'a@x', api_key: 'chave-A' }]);
await q(`insert into octaplus.nao_perturbe (telefone) values ('+5511955554444')`);
await como(dono, B);
await q(`select octaplus.salvar_integracao($1)`, [{ base_url: 'https://b.octadesk.services', agente_email: 'b@x', api_key: 'chave-B' }]);
await motor();
const creds = (await q('select octaplus.credenciais_octadesk() c')).map((r) => r.c);
teste('motor: uma credencial por empresa ativa', creds.length === 2 && new Set(creds.map((c) => c.api_key)).size === 2);
await q(`select octaplus.gravar_manutencao($1)`, [{ empresa_id: B, catalogo: { ok: true, numeros: [{ id: 'n1', name: 'B', number: '+551130000000' }], templates: [], grupos: [], tags: [] }, jwt: { token: 'jwt-B', expira_em: new Date(Date.now() + 3600e3).toISOString() } }]);
teste('motor: catálogo gravado só na empresa certa', (await um(`select string_agg(empresa_id::text, ',') e from octaplus.octa_numeros`)).e === B);
teste('motor: JWT gravado só na empresa certa', (await um(`select octaplus.credenciais_octadesk($1) c`, [B])).c.jwt === 'jwt-B' && !(await um(`select octaplus.credenciais_octadesk($1) c`, [A])).c.jwt);

const segA = (await um(`select segredo_webhook s from octaplus.automacoes where id = $1`, [autA])).s;
const segB = (await um(`select segredo_webhook s from octaplus.automacoes where id = $1`, [autB])).s;
const payload = { phone: '11955554444', name: 'Davi' };
const rA = (await um(`select octaplus.receber_webhook($1, $2, $3, 'd1') r`, [autA, segA, payload])).r;
const rB = (await um(`select octaplus.receber_webhook($1, $2, $3, 'd1') r`, [autB, segB, payload])).r;
teste('não perturbe vale só na empresa que cadastrou', rA.ignorado === 'nao_perturbe' && rB.execucoes === 1, JSON.stringify([rA, rB]));

let jobs = (await q('select octaplus.pegar_execucoes(10) j')).map((r) => r.j);
teste('motor: job leva a credencial da própria empresa', jobs.length === 1 && jobs[0].empresa_id === B && jobs[0].octadesk.api_key === 'chave-B', JSON.stringify(jobs.map((j) => j.octadesk?.api_key)));
await q(`select octaplus.concluir_execucao($1, 'sucesso', $2)`, [jobs[0].execucao_id, { envio: { tipo: 'template' } }]);
teste('motor: envio gravado na empresa da execução', (await um(`select empresa_id from octaplus.envios`)).empresa_id === B);

await como(uA, A);
await q(`delete from octaplus.nao_perturbe`);
await motor();
const rA2 = (await um(`select octaplus.receber_webhook($1, $2, $3, 'd2') r`, [autA, segA, payload])).r;
teste('limite de contato vale só dentro da empresa', rA2.execucoes === 1, JSON.stringify(rA2));

const segOctaB = (await um(`select segredo_webhook s from octaplus.integracao_octadesk where empresa_id = $1`, [B])).s;
const chat = { id: 'room-1', contact: { id: 'c1', name: 'Eva', phoneContacts: [{ countryCode: '55', number: '11911112222' }] } };
teste('Octadesk: segredo desconhecido é recusado', (await um(`select octaplus.receber_octadesk('nada', 'room.after-close', $1) r`, [chat])).r.ok === false);
const rO = (await um(`select octaplus.receber_octadesk($1, 'room.after-close', $2) r`, [segOctaB, chat])).r;
teste('Octadesk: o segredo escolhe a empresa e só as automações dela', rO.automacoes === 1
  && (await um(`select count(*)::int n from octaplus.eventos where automacao_id = $1`, [autOctaB])).n === 1, JSON.stringify(rO));

await como(dono);
await q(`select octaplus.definir_empresa_ativa($1, false)`, [B]);
await motor();
teste('empresa inativa: não recebe evento', (await um(`select octaplus.receber_webhook($1, $2, $3, 'd3') r`, [autB, segB, payload])).r.motivo === 'empresa_inativa');
await q(`update octaplus.execucoes set agendado_para = now() - interval '1 minute' where status = 'pendente'`);
jobs = (await q('select octaplus.pegar_execucoes(10) j')).map((r) => r.j);
teste('empresa inativa: execuções ficam paradas', jobs.every((j) => j.empresa_id !== B) && jobs.length >= 1, JSON.stringify(jobs.map((j) => j.empresa_id)));
teste('empresa inativa: fora da manutenção', (await q('select octaplus.credenciais_octadesk() c')).length === 1);
await como(uB, B);
teste('empresa inativa: membros perdem o acesso', (await um(`select octaplus.pode('ver') p`)).p === false);
await como(dono, B);
teste('empresa inativa: owner continua vendo', (await q('select * from octaplus.automacoes')).length === 2);

// ---------------------------------------------------------------- apagar
await como(dono);
teste('apagar: nome errado é recusado', (await falha(`select octaplus.apagar_empresa($1, 'outra')`, [B])).includes('confirmacao_invalida'));
await q(`select octaplus.apagar_empresa($1, ' skyline ')`, [B]);
await motor();
const sobra = await um(`select (select count(*) from octaplus.automacoes where empresa_id = $1)::int a,
  (select count(*) from octaplus.membros where empresa_id = $1)::int m, (select count(*) from octaplus.envios where empresa_id = $1)::int e,
  (select count(*) from octaplus.automacoes)::int total`, [B]);
teste('apagar: leva tudo da empresa e só dela', sobra.a === 0 && sobra.m === 0 && sobra.e === 0 && sobra.total === 1, JSON.stringify(sobra));

console.log(falhas ? `\n${falhas} teste(s) falharam` : '\ntodos os testes de empresas passaram');
process.exit(falhas ? 1 : 0);
