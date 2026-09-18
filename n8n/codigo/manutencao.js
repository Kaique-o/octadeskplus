// Code node "Validar, sincronizar e renovar token" (Run Once for All Items).
// Entrada: { c } = octaplus.credenciais_octadesk(). Roda a cada minuto, mas só trabalha quando precisa:
//   - integração em "validando", catálogo com mais de 1h ou sincronização pedida pelo painel -> catálogos
//   - API privada ligada e token ausente ou vencendo em até 30 min -> novo JWT
// Saída: [] quando não há nada a fazer, ou um item { catalogo?, jwt? } para os nodes Postgres seguintes.

const c = $input.first().json.c || {};
const saida = {};

const publica = (caminho, qs) => this.helpers.httpRequest({
  method: 'GET', url: c.base_url + caminho, qs, json: true, timeout: 20000,
  headers: { 'X-API-KEY': c.api_key, 'octa-agent-email': c.agente_email || '', accept: 'application/json' },
});

// páginas de 100 até acabar (o Octadesk devolve array; X-Total-Pages não chega no httpRequest simples)
async function todas(caminho, qs = {}) {
  const itens = [];
  for (let page = 1; page <= 50; page++) {
    const r = await publica(caminho, { ...qs, page, limit: 100 });
    const lote = Array.isArray(r) ? r : r?.items || r?.data || [];
    itens.push(...lote);
    if (lote.length < 100) break;
  }
  return itens;
}

if (c.base_url && c.api_key && (c.status === 'validando' || c.catalogo_vencido)) {
  try {
    const valida = await publica('/auth/check');
    if (valida === false) throw new Error('Chave de API recusada pelo Octadesk (/auth/check)');
    const [numeros, templates, grupos, tags] = await Promise.all([
      publica('/chat/numbers'),
      todas('/chat/templates-message', { 'filters[0][property]': 'status', 'filters[0][operator]': 'eq', 'filters[0][value]': 'approved' }),
      publica('/tickets/groups'),
      publica('/tickets/tags'),
    ]);
    saida.catalogo = { ok: true, numeros: numeros || [], templates, grupos: grupos || [], tags: tags || [] };
  } catch (e) {
    saida.catalogo = { ok: false, erro: String(e.description || e.message || e).slice(0, 400) };
  }
}

// JWT da API privada (a mesma autenticação do app web, usada só para transferir de fila)
const expiraEm = c.jwt_expira_em ? new Date(c.jwt_expira_em) : null;
const precisaToken = c.api_privada_ativa && c.usuario && c.senha && c.tenant
  && (!c.jwt || !expiraEm || expiraEm.getTime() - Date.now() < 30 * 60 * 1000);
if (precisaToken) {
  try {
    const r = await this.helpers.httpRequest({
      method: 'POST', url: 'https://southamerica-east1-001.pantheon.octadesk.services/nucleus-auth/auth', json: true, timeout: 20000,
      headers: { 'content-type': 'application/json;charset=UTF-8' },
      body: { userName: c.usuario, password: c.senha, tenantId: c.tenant },
    });
    const token = r?.jwtoken;
    if (!token) throw new Error('Resposta sem jwtoken');
    // validade vem no próprio JWT (claim exp); sem ela, assume 12h e renova antes
    let exp = null;
    try { exp = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).exp; } catch { /* token opaco */ }
    saida.jwt = { token, expira_em: new Date(exp ? exp * 1000 : Date.now() + 12 * 3600 * 1000).toISOString() };
  } catch (e) {
    saida.jwt_erro = String(e.description || e.message || e).slice(0, 300);
  }
}

return Object.keys(saida).length ? [{ json: saida }] : [];
