// Testa os Code nodes do n8n com o Octadesk simulado. Uso: npm run n8n:test (na pasta octadeskplus)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const codigo = (f) => fs.readFileSync(path.join(aqui, '..', 'codigo', f), 'utf8');
const Async = Object.getPrototypeOf(async function () {}).constructor;

let falhas = 0;
const teste = (nome, ok, detalhe = '') => {
  console.log(`${ok ? 'ok    ' : 'FALHOU'} ${nome}${!ok && detalhe ? `\n       ${detalhe}` : ''}`);
  if (!ok) falhas++;
};

// Octadesk falso: rotas -> resposta (função ou valor). Guarda as chamadas para conferir.
function octadesk(rotas) {
  const chamadas = [];
  const httpRequest = async (o) => {
    const rota = `${o.method} ${o.url.replace(/^https:\/\/[^/]+/, '')}`;
    chamadas.push({ rota, ...o });
    for (const [padrao, resp] of Object.entries(rotas)) {
      if (new RegExp(`^${padrao}$`).test(rota)) {
        const r = typeof resp === 'function' ? resp(o) : resp;
        if (r instanceof Error) throw r;
        return r;
      }
    }
    return {};
  };
  return { helpers: { httpRequest }, chamadas };
}
const erroHttp = (codigo) => Object.assign(new Error(`HTTP ${codigo}`), { httpCode: String(codigo) });

async function executar(jobs, rotas) {
  const ctx = octadesk(rotas);
  const saida = await new Async('$input', '$', codigo('executor.js')).call(ctx, { all: () => jobs.map((j) => ({ json: { j } })) }, null);
  return { saida: saida.map((s) => s.json), chamadas: ctx.chamadas };
}

const base = {
  automacao: { id: 'a1', nome: 'Orçamentos de ontem' },
  numero_padrao: '+5511949602880',
  octadesk: { base_url: 'https://o1.api001.octadesk.services', api_key: 'k', agente_email: 'bot@x', subdominio: 'o1', api_privada_ativa: true, jwt: 'tok' },
  evento: { telefone: '+5511977776666', octadesk_contact_id: 'oct-ana', conversa_id: null,
            dados: { cliente: { nome: 'Ana Maria', primeiro_nome: 'Ana' }, evento: { valor_total: 200 } } },
};
const job = (acao, extra = {}) => ({ ...base, execucao_id: Math.random().toString(36).slice(2), ...extra, acao,
  evento: { ...base.evento, ...(extra.evento || {}) } });
const template = (config = {}) => ({ tipo: 'enviar_template', config: { template_id: 't1', variaveis: { nome: '{{cliente.primeiro_nome}}' }, ...config } });

// ---------------------------------------------------------------- template
let r = await executar([job(template())], {
  'GET /chat': [],
  'POST /chat/send-template': { result: { roomKey: 'room-1', messageKey: 'msg-1' } },
});
const envio = r.chamadas.find((c) => c.rota === 'POST /chat/send-template');
teste('template: sucesso com roomKey e registro do envio', r.saida[0].status === 'sucesso' && r.saida[0].resultado.room_key === 'room-1' && r.saida[0].resultado.envio.tipo === 'template');
teste('template: variáveis no formato [{key, value}] renderizadas', JSON.stringify(envio.body.content.templateMessage.variables) === '[{"key":"nome","value":"Ana"}]');
teste('template: número padrão como origem e telefone E.164 no destino', envio.body.origin.contact.code === '+5511949602880' && envio.body.target.contact.code === '+5511977776666');
teste('template: headers X-API-KEY e octa-agent-email', envio.headers['X-API-KEY'] === 'k' && envio.headers['octa-agent-email'] === 'bot@x');
teste('template: busca conversa aberta sem o 55 primeiro', r.chamadas[0].qs['filters[0][value]'] === '11977776666');

r = await executar([job(template())], { 'GET /chat': [{ id: 'room-aberta' }] });
teste('conversa aberta + "não fazer nada": ignorado sem enviar', r.saida[0].status === 'ignorado' && r.saida[0].codigo === 'conversa_aberta'
  && !r.chamadas.some((c) => c.rota.includes('send-template')));

r = await executar([job(template({ conversa_aberta: 'nota_interna' }))], { 'GET /chat': [{ id: 'room-aberta' }] });
const nota = r.chamadas.find((c) => c.rota === 'POST /chat/room-aberta/messages');
teste('conversa aberta + nota interna: posta nota e não envia', r.saida[0].status === 'ignorado' && nota?.body.type === 'internal'
  && !r.chamadas.some((c) => c.rota.includes('send-template')));

r = await executar([job(template({ conversa_aberta: 'enviar_mesmo_assim' }))], {
  'POST /chat/send-template': { result: { roomKey: 'r2' } } });
teste('"enviar mesmo assim": nem consulta a conversa', r.saida[0].status === 'sucesso' && !r.chamadas.some((c) => c.rota === 'GET /chat'));

r = await executar([job(template())], { 'GET /chat': [], 'POST /chat/send-template': { error: true, errorCode: '131026', errorMessage: 'Message undeliverable' } });
teste('erro da Meta no corpo 2xx vira erro definitivo com o código', r.saida[0].status === 'erro' && r.saida[0].codigo === '131026');

r = await executar([job(template({}), { numero_padrao: null })], { 'GET /chat': [] });
teste('sem número de origem: erro claro', r.saida[0].codigo === 'sem_numero_origem');

for (const [http, esperado] of [[500, 'pendente'], [429, 'pendente'], [400, 'erro']]) {
  r = await executar([job(template())], { 'GET /chat': [], 'POST /chat/send-template': erroHttp(http) });
  teste(`HTTP ${http} no envio -> ${esperado}`, r.saida[0].status === esperado && r.saida[0].codigo === `http_${http}`);
}

// ---------------------------------------------------------------- ações na conversa
r = await executar([job({ tipo: 'nota_interna', config: { texto: 'Pedido de {{cliente.nome}}' } })], {});
teste('nota sem conversa ligada: ignorado', r.saida[0].status === 'ignorado' && r.saida[0].codigo === 'sem_conversa');

r = await executar([job({ tipo: 'nota_interna', config: { texto: 'Pedido de {{cliente.nome}}' } }, { evento: { conversa_id: 'room-1' } })], {});
const n2 = r.chamadas.find((c) => c.rota === 'POST /chat/room-1/messages');
teste('nota interna renderizada na conversa do evento', r.saida[0].status === 'sucesso' && n2.body.body === 'Pedido de Ana Maria' && n2.body.type === 'internal');

r = await executar([job({ tipo: 'enviar_mensagem', config: { texto: 'Oi' } }, { evento: { conversa_id: 'room-1' } })], {
  'GET /chat/room-1': { windowExpiresAt: new Date(Date.now() - 60000).toISOString() } });
teste('mensagem fora da janela de 24h: ignorado sem enviar', r.saida[0].codigo === 'janela_24h_fechada' && !r.chamadas.some((c) => c.method === 'POST'));

r = await executar([job({ tipo: 'aplicar_tags', config: { tags: [{ id: 't2', nome: 'Recompra' }] } }, { evento: { conversa_id: 'room-1' } })], {
  'GET /chat/room-1': { tags: [{ id: 't1', name: 'IA' }] } });
const tags = r.chamadas.find((c) => c.rota === 'POST /chat/room-1/tags')?.body.tags.map((t) => t.id);
teste('tags: soma às que a conversa já tem (a API substitui a lista)', JSON.stringify(tags) === '["t1","t2"]');

// ---------------------------------------------------------------- transferência (API privada)
r = await executar([job({ tipo: 'transferir_fila', config: {} }, { fila: 'g-sedex', evento: { conversa_id: 'room-1' } })], {});
const tr = r.chamadas[0];
teste('transferir: API privada com Bearer e appsubdomain', r.saida[0].status === 'sucesso' && tr.url.endsWith('/chat/rooms/room-1/group/g-sedex')
  && tr.headers.authorization === 'Bearer tok' && tr.headers.appsubdomain === 'o1');

r = await executar([job({ tipo: 'transferir_fila', config: {} }, { fila: 'g', evento: { conversa_id: 'room-1' } })], { 'PUT /chat/rooms/.*': erroHttp(401) });
teste('transferir com token vencido: pendente para o fluxo renovar', r.saida[0].status === 'pendente' && r.saida[0].codigo === 'jwt_expirado');

r = await executar([job({ tipo: 'transferir_fila', config: {} }, { fila: 'g', evento: { conversa_id: 'room-1' },
  octadesk: { ...base.octadesk, api_privada_ativa: false } })], {});
teste('transferir com API privada desligada: erro definitivo', r.saida[0].status === 'erro' && r.saida[0].codigo === 'api_privada_desligada');

// ---------------------------------------------------------------- manutenção
async function manutencao(c, rotas) {
  const ctx = octadesk(rotas);
  const saida = await new Async('$input', '$', codigo('manutencao.js')).call(ctx, { first: () => ({ json: { c } }) }, null);
  return { saida: saida.map((s) => s.json), chamadas: ctx.chamadas };
}
const cred = { base_url: 'https://o1.api001.octadesk.services', api_key: 'k', agente_email: 'bot@x', status: 'conectado', catalogo_vencido: false,
  api_privada_ativa: false, jwt: 'tok', jwt_expira_em: new Date(Date.now() + 5 * 3600e3).toISOString() };

let m = await manutencao(cred, {});
teste('manutenção sem nada a fazer: não chama ninguém', m.saida.length === 0 && m.chamadas.length === 0);

const jwt = `x.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 7200 })).toString('base64url')}.y`;
m = await manutencao({ ...cred, status: 'validando', api_privada_ativa: true, usuario: 'u', senha: 's', tenant: 't', jwt: null }, {
  'GET /auth/check': true,
  'GET /chat/numbers': [{ id: 'n1', name: 'Oficial', number: '+5511949602880' }],
  'GET /chat/templates-message': [{ id: 't1', name: 'orcamento', status: 'approved', components: [] }],
  'GET /tickets/groups': [{ id: 'g1', name: 'Triagem' }],
  'GET /tickets/tags': [],
  'POST /nucleus-auth/auth': { jwtoken: jwt },
});
teste('manutenção: catálogos completos', m.saida[0].catalogo.ok && m.saida[0].catalogo.numeros.length === 1 && m.saida[0].catalogo.templates.length === 1);
teste('manutenção: só templates aprovados', m.chamadas.find((c) => c.rota === 'GET /chat/templates-message').qs['filters[0][value]'] === 'approved');
teste('manutenção: novo JWT com a validade do claim exp', m.saida[0].jwt.token === jwt && Math.abs(new Date(m.saida[0].jwt.expira_em) - (Date.now() + 7200e3)) < 5000);

m = await manutencao({ ...cred, status: 'validando' }, { 'GET /auth/check': erroHttp(401) });
teste('manutenção: chave recusada vira erro na integração', m.saida[0].catalogo.ok === false && m.saida[0].catalogo.erro.includes('401'));

console.log(falhas ? `\n${falhas} teste(s) falharam` : '\ntodos os testes passaram');
process.exit(falhas ? 1 : 0);
