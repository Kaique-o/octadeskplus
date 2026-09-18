// Gera os JSONs importáveis em n8n/fluxos/ a partir do código em n8n/codigo/.
// Uso: node n8n/montar-fluxos.js   (rode de novo sempre que editar um .js de codigo/)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const code = (f) => fs.readFileSync(path.join(__dirname, 'codigo', f), 'utf8');
const id = () => crypto.randomUUID();
const PG = { postgres: { id: 'SUPABASE_PG', name: 'Supabase Postgres' } };
const SETTINGS = { executionOrder: 'v1', timezone: 'America/Sao_Paulo', saveDataSuccessExecution: 'none', saveDataErrorExecution: 'all' };

const webhook = (name, pos, pathName, method = 'POST', extra = {}) => ({
  id: id(), name, type: 'n8n-nodes-base.webhook', typeVersion: 2, position: pos, webhookId: id(),
  parameters: { httpMethod: method, path: pathName, responseMode: 'responseNode', options: { allowedOrigins: '*' }, ...extra },
});
const codeNode = (name, pos, js) => ({
  id: id(), name, type: 'n8n-nodes-base.code', typeVersion: 2, position: pos, parameters: { jsCode: js },
});
// queryReplacement: UMA expressão que resolve para array (evita quebrar JSON com vírgulas)
const pg = (name, pos, query, replacement, extra = {}) => ({
  id: id(), name, type: 'n8n-nodes-base.postgres', typeVersion: 2.5, position: pos, credentials: PG,
  parameters: { operation: 'executeQuery', query, options: replacement ? { queryReplacement: `={{ ${replacement} }}` } : {} },
  ...extra,
});
const respond = (name, pos, body, codeExpr = '200') => ({
  id: id(), name, type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: pos,
  parameters: { respondWith: 'json', responseBody: `={{ JSON.stringify(${body}) }}`, options: { responseCode: `={{ ${codeExpr} }}` } },
});
const schedule = (name, pos, rule) => ({
  id: id(), name, type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2, position: pos, parameters: { rule: { interval: [rule] } },
});
const ifTrue = (name, pos, expr) => ({
  id: id(), name, type: 'n8n-nodes-base.if', typeVersion: 2, position: pos,
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 1 },
      conditions: [{ id: id(), leftValue: `={{ ${expr} }}`, rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }],
      combinator: 'and',
    },
    options: {},
  },
});
// links: [["A","B"], ["IF","C",1]] -> saída 0 (ou índice dado) de A para B
const connect = (links) => {
  const c = {};
  for (const [from, to, out = 0] of links) {
    c[from] ??= { main: [] };
    while (c[from].main.length <= out) c[from].main.push([]);
    c[from].main[out].push({ node: to, type: 'main', index: 0 });
  }
  return c;
};
const flow = (name, nodes, links) => ({ name, nodes, connections: connect(links), settings: SETTINGS, active: false });

// ---------------------------------------------------------------------------------------------
const PREPARAR_ENTRADA = `// Webhook externo (sistemas próprios e campanhas do metrics). Mesmo contrato do Bridge da Favo:
// segredo no header X-Bridge-Secret ou em ?secret=; id de deduplicação opcional.
const r = $input.first().json;
const body = r.body || {};
return [{ json: {
  automacao_id: r.params.automacaoId,
  segredo: r.headers['x-bridge-secret'] || r.query.secret || '',
  payload: body,
  dedupe: r.headers['x-bridge-event-id'] || body.event_id || body.dedupe_key || null,
} }];
`;

const flows = {
  'octaplus-entrada': flow('Octadesk Plus | Entrada (webhooks)', [
    webhook('Webhook externo', [0, 0], 'octaplus/in/:automacaoId'),
    codeNode('Preparar evento', [240, 0], PREPARAR_ENTRADA),
    pg('Registrar evento externo', [480, 0], 'select octaplus.receber_webhook($1::uuid, $2, $3::jsonb, $4) as r',
      '[$json.automacao_id, $json.segredo, JSON.stringify($json.payload), $json.dedupe]'),
    respond('Responder externo', [720, 0], '$json.r', "$json.r.motivo === 'nao_autorizado' ? 401 : 200"),

    // Octadesk: {domain, event, data}. Não assina a chamada; o segredo vai no caminho da URL.
    webhook('Webhook do Octadesk', [0, 240], 'octaplus/octadesk/:segredo'),
    pg('Registrar evento do Octadesk', [480, 240], 'select octaplus.receber_octadesk($1, $2, $3::jsonb) as r',
      "[$json.params.segredo, $json.body.event || '', JSON.stringify($json.body.data || {})]"),
    respond('Responder Octadesk', [720, 240], '$json.r', "$json.r.ok === false ? 401 : 200"),
  ], [
    ['Webhook externo', 'Preparar evento'], ['Preparar evento', 'Registrar evento externo'], ['Registrar evento externo', 'Responder externo'],
    ['Webhook do Octadesk', 'Registrar evento do Octadesk'], ['Registrar evento do Octadesk', 'Responder Octadesk'],
  ]),

  'octaplus-executor': flow('Octadesk Plus | Executor (a cada minuto)', [
    schedule('A cada minuto', [0, 0], { field: 'minutes', minutesInterval: 1 }),
    pg('Pegar execuções vencidas', [240, 0], 'select octaplus.pegar_execucoes(50) as j'),
    codeNode('Executar ações', [480, 0], code('executor.js')),
    pg('Concluir execução', [720, 0], 'select octaplus.concluir_execucao($1::uuid, $2, $3::jsonb, $4, $5)',
      '[$json.execucao_id, $json.status, JSON.stringify($json.resultado), $json.erro, $json.codigo]'),
  ], [['A cada minuto', 'Pegar execuções vencidas'], ['Pegar execuções vencidas', 'Executar ações'], ['Executar ações', 'Concluir execução']]),

  'octaplus-manutencao': flow('Octadesk Plus | Validação, catálogos e token (a cada minuto)', [
    schedule('A cada minuto', [0, 0], { field: 'minutes', minutesInterval: 1 }),
    pg('Ler integração', [240, 0], 'select octaplus.credenciais_octadesk() as c'),
    codeNode('Validar, sincronizar e renovar token', [480, 0], code('manutencao.js')),
    pg('Gravar catálogos', [720, 0], 'select octaplus.gravar_catalogos(x) from (select $1::jsonb as x) s where x is not null',
      '[$json.catalogo ? JSON.stringify($json.catalogo) : null]', { alwaysOutputData: true }),
    pg('Gravar token', [960, 0], 'select octaplus.gravar_jwt(t, e) from (select $1::text as t, $2::timestamptz as e) s where t is not null',
      "[$('Validar, sincronizar e renovar token').first().json.jwt?.token ?? null, $('Validar, sincronizar e renovar token').first().json.jwt?.expira_em ?? null]",
      { alwaysOutputData: true }),
  ], [['A cada minuto', 'Ler integração'], ['Ler integração', 'Validar, sincronizar e renovar token'],
      ['Validar, sincronizar e renovar token', 'Gravar catálogos'], ['Gravar catálogos', 'Gravar token']]),

  'octaplus-api-publica': flow('Octadesk Plus | API pública /v1/format', [
    webhook('Webhook', [0, 0], 'octaplus/v1/format'),
    pg('Validar chave e formatar', [240, 0], 'select octaplus.api_formatar_telefone($1, $2) as r',
      "[String($json.headers.authorization || '').replace(/^Bearer\\s+/i, ''), String($json.body.phone ?? '')]"),
    respond('Responder', [480, 0], '$json.r', "$json.r.error === 'invalid_api_key' ? 401 : ($json.r.ok ? 200 : 422)"),
  ], [['Webhook', 'Validar chave e formatar'], ['Validar chave e formatar', 'Responder']]),
};

const outDir = path.join(__dirname, 'fluxos');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
for (const [file, wf] of Object.entries(flows)) {
  fs.writeFileSync(path.join(outDir, `${file}.json`), JSON.stringify(wf, null, 2));
  console.log('gerado', `fluxos/${file}.json`);
}
