// Code node "Executar ações" (Run Once for All Items).
// Entrada: itens { j } vindos de octaplus.pegar_execucoes(). Saída: um item por execução para octaplus.concluir_execucao():
//   { execucao_id, status: sucesso | ignorado | erro | pendente, resultado, erro, codigo }
// "pendente" = tentar de novo com backoff (falha temporária). Regras de negócio já foram aplicadas no banco;
// aqui só se conversa com o Octadesk.

const get = (obj, caminho) => String(caminho || '').split('.').filter(Boolean).reduce((o, k) => (o == null ? undefined : o[k]), obj);

// '{{cliente.primeiro_nome}}' -> valor do evento
const render = (tpl, dados) => String(tpl ?? '').replace(/\{\{\s*([\w.\[\]-]+)\s*\}\}/g, (_, p) => {
  const v = get(dados, p.replace(/\[(\d+)\]/g, '.$1'));
  return v == null ? '' : String(v);
});

class Falha extends Error {
  constructor(status, codigo, mensagem, resultado) { super(mensagem); this.status = status; this.codigo = codigo; this.resultado = resultado; }
}

function publica(job) {
  const o = job.octadesk || {};
  if (!o.base_url || !o.api_key) throw new Falha('erro', 'integracao_incompleta', 'Octadesk sem URL ou chave de API');
  return (metodo, caminho, { qs, body } = {}) => this.helpers.httpRequest({
    method: metodo, url: o.base_url + caminho, qs, body, json: true, timeout: 20000,
    headers: { 'X-API-KEY': o.api_key, 'octa-agent-email': o.agente_email || '', accept: 'application/json' },
  });
}

// API privada do app (só transferência de fila). JWT renovado pelo fluxo de manutenção.
function privada(job) {
  const o = job.octadesk || {};
  if (!o.api_privada_ativa) throw new Falha('erro', 'api_privada_desligada', 'Transferência exige a API privada ativa na integração');
  if (!o.jwt) throw new Falha('pendente', 'jwt_ausente', 'Token da API privada ainda não gerado');
  return (metodo, caminho) => this.helpers.httpRequest({
    method: metodo, url: 'https://us-east1-001.prod.octadesk.services' + caminho, json: true, timeout: 20000,
    headers: {
      authorization: `Bearer ${o.jwt}`, appsubdomain: o.subdominio || '', culture: 'pt-BR',
      origin: 'https://app.octadesk.com', referer: 'https://app.octadesk.com/', 'content-length': '0',
    },
  });
}

const apenasDigitos = (tel) => String(tel || '').replace(/\D/g, '');

// Conversa em atendimento para o telefone (o Octadesk guarda o número sem o 55 em phoneContacts.number)
async function conversaAberta(api, telefone) {
  const d = apenasDigitos(telefone);
  for (const numero of [d.replace(/^55/, ''), d]) {
    const lista = await api('GET', '/chat', { qs: {
      'filters[0][property]': 'contact.phoneContacts.number', 'filters[0][operator]': 'eq', 'filters[0][value]': numero,
      'filters[1][property]': 'status', 'filters[1][operator]': 'eq', 'filters[1][value]': 'talking',
      page: 1, limit: 5,
    } });
    const itens = Array.isArray(lista) ? lista : lista?.items || [];
    if (itens.length) return itens[0];
  }
  return null;
}

const exigeConversa = (job) => {
  const id = job.evento.conversa_id;
  if (!id) throw new Falha('ignorado', 'sem_conversa', 'Nenhuma conversa ligada a este evento (use antes uma ação de template)');
  return id;
};

// ---------------------------------------------------------------- ações
const acoes = {
  async enviar_template(job) {
    const api = publica.call(this, job);
    const cfg = job.acao.config || {};
    const dados = job.evento.dados || {};
    const numeroOrigem = cfg.numero || job.numero_padrao;
    if (!numeroOrigem) throw new Falha('erro', 'sem_numero_origem', 'Escolha o número de envio na ação ou nas configurações');
    if (!cfg.template_id) throw new Falha('erro', 'sem_template', 'Ação sem template');

    const politica = cfg.conversa_aberta || 'nao_fazer_nada';
    if (politica !== 'enviar_mesmo_assim') {
      const aberta = await conversaAberta(api, job.evento.telefone);
      if (aberta) {
        if (politica === 'nota_interna') {
          await api('POST', `/chat/${aberta.id}/messages`, { body: {
            type: 'internal', channel: 'whatsapp',
            body: `[Octadesk Plus] A automação "${job.automacao.nome}" não enviou o template porque esta conversa já estava aberta.`,
          } });
        }
        throw new Falha('ignorado', 'conversa_aberta', 'Cliente já tem conversa em atendimento', { room_key: aberta.id, politica });
      }
    }

    const variaveis = Object.entries(cfg.variaveis || {}).map(([key, tpl]) => ({ key, value: render(tpl, dados) || '-' }));
    // nome e email no target viram as variáveis nome-contato e email-contato do template
    const r = await api('POST', '/chat/send-template', { body: {
      origin: { contact: { channel: 'whatsapp', code: numeroOrigem } },
      target: { contact: { channel: 'whatsapp', code: job.evento.telefone, name: get(dados, 'cliente.nome') || undefined,
                           email: get(dados, 'cliente.email') || undefined,
                           id: job.evento.octadesk_contact_id || undefined } },
      content: { templateMessage: { id: cfg.template_id, ...(variaveis.length ? { variables: variaveis } : {}) } },
      options: { automaticAssign: cfg.atribuir_automatico !== false },
    } });
    // o Octadesk devolve 2xx com o erro da Meta dentro do corpo
    if (r?.error || r?.errorCode) throw new Falha('erro', String(r.errorCode || 'erro_meta'), r.errorMessage || 'Envio recusado pela Meta');
    return {
      room_key: r?.result?.roomKey, message_key: r?.result?.messageKey,
      envio: { tipo: 'template', template_id: cfg.template_id, numero_origem: numeroOrigem },
    };
  },

  async enviar_mensagem(job) {
    const api = publica.call(this, job);
    const sala = exigeConversa(job);
    const chat = await api('GET', `/chat/${sala}`, { qs: { page: 1, limit: 1, property: 'time', direction: 'desc' } });
    if (chat?.windowExpiresAt && new Date(chat.windowExpiresAt) < new Date()) {
      throw new Falha('ignorado', 'janela_24h_fechada', 'Fora da janela de 24h do WhatsApp: só template pode ser enviado');
    }
    const texto = render(job.acao.config?.texto, job.evento.dados);
    const r = await api('POST', `/chat/${sala}/messages`, { body: { type: 'public', channel: 'whatsapp', body: texto } });
    return { message_key: r?.id, envio: { tipo: 'mensagem' } };
  },

  async nota_interna(job) {
    const api = publica.call(this, job);
    const sala = exigeConversa(job);
    const texto = render(job.acao.config?.texto, job.evento.dados);
    await api('POST', `/chat/${sala}/messages`, { body: { type: 'internal', channel: 'whatsapp', body: texto } });
    return { envio: { tipo: 'nota' } };
  },

  // POST /chat/{id}/tags substitui a lista: junta com as tags que a conversa já tem
  async aplicar_tags(job) {
    const api = publica.call(this, job);
    const sala = exigeConversa(job);
    const chat = await api('GET', `/chat/${sala}`, { qs: { page: 1, limit: 1, property: 'time', direction: 'desc' } });
    const porId = new Map((chat?.tags || []).map((t) => [t.id, { id: t.id, name: t.name }]));
    for (const t of job.acao.config?.tags || []) porId.set(t.id, { id: t.id, name: t.nome || t.name });
    await api('POST', `/chat/${sala}/tags`, { body: { tags: [...porId.values()] } });
    return { tags: [...porId.keys()] };
  },

  async campo_conversa(job) {
    const api = publica.call(this, job);
    const sala = exigeConversa(job);
    const c = job.acao.config || {};
    const valor = c.tipo === 'boolean' ? c.valor === true || c.valor === 'true' : render(c.valor, job.evento.dados);
    await api('PUT', `/chat/${sala}/custom-fields`, { body: { customFields: [{ id: c.campo_id, title: c.titulo, type: c.tipo || 'string', value: valor }] } });
    return { campo: c.campo_id };
  },

  async transferir_fila(job) {
    const sala = exigeConversa(job);
    if (!job.fila) throw new Falha('erro', 'sem_fila', 'Nenhuma fila definida (nem na ação, nem no mapa de filas)');
    const api = privada.call(this, job);
    await api('PUT', `/chat/rooms/${sala}/group/${job.fila}`);
    return { fila: job.fila };
  },
};

// ---------------------------------------------------------------- execução
const status = (e) => e.httpCode ?? e.response?.status ?? e.cause?.response?.status ?? e.statusCode;

const saida = [];
for (const item of $input.all()) {
  const job = item.json.j;
  const fim = (st, resultado, erro, codigo) => saida.push({ json: {
    execucao_id: job.execucao_id, status: st, resultado: resultado ?? null, erro: erro ?? null, codigo: codigo ?? null,
  } });
  try {
    const acao = acoes[job.acao.tipo];
    if (!acao) { fim('erro', null, `Ação desconhecida: ${job.acao.tipo}`, 'acao_desconhecida'); continue; }
    fim('sucesso', await acao.call(this, job));
  } catch (e) {
    if (e instanceof Falha) { fim(e.status, e.resultado, e.message, e.codigo); continue; }
    const http = Number(status(e)) || null;
    // 401 na API privada = token vencido: o fluxo de manutenção renova e a próxima tentativa passa
    if (http === 401 && job.acao.tipo === 'transferir_fila') { fim('pendente', { http }, 'Token da API privada expirado', 'jwt_expirado'); continue; }
    // 4xx (menos 408/429) é definitivo; o resto tenta de novo
    const definitivo = http && http >= 400 && http < 500 && http !== 408 && http !== 429;
    fim(definitivo ? 'erro' : 'pendente', { http }, String(e.description || e.message || e).slice(0, 500), http ? `http_${http}` : 'rede');
  }
}
return saida;
