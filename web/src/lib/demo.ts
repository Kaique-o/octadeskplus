/**
 * MODO DEMONSTRAÇÃO (VITE_DEMO=1)
 * Substitui o Supabase por dados em memória com o mesmo formato do schema `octaplus`.
 * Não tem login: a sessão já vem pronta. Nada aqui é usado quando VITE_DEMO está desligado.
 */
export const DEMO = String(import.meta.env.VITE_DEMO ?? '') === '1';

const hoje = new Date();
const dia = (d: number) => new Date(hoje.getTime() - d * 86400000);
const iso = (d: Date) => d.toISOString();
const uid = () => crypto.randomUUID();
const USER = 'c0000000-0000-4000-8000-0000000000a1';

export const demoSession = {
  session: { user: { id: USER, email: 'kaique@exemplo.com' } },
  profile: { id: USER, email: 'kaique@exemplo.com', full_name: 'Kaique Demo' },
  podeVer: true,
  podeEditar: true,
};

type Row = Record<string, unknown>;

// ---------------------------------------------------------------- configuração e integração
const configuracao: Row = {
  id: true, fuso: 'America/Sao_Paulo', empresa_nome: 'Grupo Skytech', empresa_cnpj: '12345678000190',
  empresa_telefone: '(11) 94960-2880', empresa_site: 'https://gruposkytech.com', numero_envio_padrao: '+5511949602880', emails_alerta: ['comercial@exemplo.com'],
  limite_contato_horas: 24, janela_deteccao_horas: 48,
  horario_comercial: { perDay: {
    0: { enabled: false, windows: [{ start: '09:00', end: '18:00' }] },
    1: { enabled: true, windows: [{ start: '08:00', end: '12:00' }, { start: '13:00', end: '17:00' }] },
    2: { enabled: true, windows: [{ start: '08:00', end: '17:00' }] },
    3: { enabled: true, windows: [{ start: '08:00', end: '18:00' }] },
    4: { enabled: true, windows: [{ start: '08:00', end: '17:00' }] },
    5: { enabled: true, windows: [{ start: '08:00', end: '17:00' }] },
    6: { enabled: true, windows: [{ start: '08:00', end: '12:00' }] },
  } },
};

const integracao: Row = {
  id: true, base_url: 'https://o000000-000.api001.octadesk.services', subdominio: 'o000000-000', agente_email: 'bot@exemplo.com',
  api_privada_ativa: true, status: 'conectado', ultimo_erro: null, validado_em: iso(dia(0)), sincronizado_em: iso(dia(0)),
  sincronizacao_pedida_em: null, segredo_webhook: 'demo8f3a91c2e4b7d6a5f1e0c9b8a7d6e5f4',
};

const numeros: Row[] = [
  { id: 'n1', nome: 'Skytech Oficial', numero: '+5511949602880', rotulo: 'Triagem', ativo: true },
  { id: 'n2', nome: 'Ônibus', numero: '+5511953885624', rotulo: 'Ônibus', ativo: true },
];
const templates: Row[] = [
  { id: 't-orc', nome: 'orcamento_de_ontem', status: 'approved', categoria: 'MARKETING', variaveis: ['nome'],
    corpo: 'Oi {{nome}}! Vi que ontem te mandamos um orçamento. Posso ajudar a fechar hoje?' },
  { id: 't-obr', nome: 'obrigado_pela_compra', status: 'approved', categoria: 'UTILITY', variaveis: ['nome', 'pedido'],
    corpo: 'Obrigado pela compra, {{nome}}! Seu pedido {{pedido}} já está em separação.' },
  { id: 't-sau', nome: 'saudade', status: 'approved', categoria: 'MARKETING', variaveis: ['nome'],
    corpo: 'Oi {{nome}}, faz um tempinho que você não compra com a gente. Temos novidades!' },
];
const grupos: Row[] = [
  { id: 'g-mb', nome: '2 - Atendimento Motoboy' }, { id: 'g-sedex', nome: '3 - Atendimento Sedex' },
  { id: 'g-onibus', nome: '4 - Atendimento Ônibus' }, { id: 'g-troca', nome: '5 - Atendimento Troca' }, { id: 'g-tri', nome: 'Triagem' },
];
const tags: Row[] = [{ id: 'tg1', nome: 'IA' }, { id: 'tg2', nome: 'Recompra' }, { id: 'tg3', nome: 'Chamar no 2880' }];
const mapaFilas: Row[] = [
  { tipo_entrega: 'MB', grupo_id: 'g-mb', rotulo: 'Motoboy' }, { tipo_entrega: 'SEDEX', grupo_id: 'g-sedex', rotulo: 'Sedex' },
  { tipo_entrega: 'ÔNIBUS', grupo_id: 'g-onibus', rotulo: 'Ônibus' }, { tipo_entrega: '*', grupo_id: 'g-tri', rotulo: 'Triagem (padrão)' },
];

// ---------------------------------------------------------------- automações
const acaoTemplate = (template_id: string, variaveis: Record<string, string>, conversa_aberta = 'nao_fazer_nada') =>
  ({ id: uid(), posicao: 0, tipo: 'enviar_template', espera_valor: 0, espera_unidade: 'minutos',
     config: { numero: '+5511949602880', template_id, variaveis, conversa_aberta } });

const automacoes: Row[] = [
  { id: 'a1000000-0000-4000-8000-000000000001', nome: 'Orçamentos de ontem que não fecharam', ativa: true, arquivada_em: null,
    fonte: 'metrics', gatilho: 'orcamento_sem_compra', parametros: { dias: 1 }, condicoes: {}, respeitar_horario: true,
    atraso_valor: 0, atraso_unidade: 'minutos', segredo_webhook: 'demo1', payload_exemplo: null, atualizado_em: iso(dia(0)),
    automacao_acoes: [acaoTemplate('t-orc', { nome: '{{cliente.primeiro_nome}}' })] },
  { id: 'a1000000-0000-4000-8000-000000000002', nome: 'Obrigado pela compra + fila da entrega', ativa: true, arquivada_em: null,
    fonte: 'metrics', gatilho: 'venda_faturada', parametros: {},
    condicoes: { ativas: true, modo: 'todas', lista: [{ campo: 'evento.valor_total', operador: 'maior', valor: '300' }] },
    respeitar_horario: true, atraso_valor: 10, atraso_unidade: 'minutos', segredo_webhook: 'demo2', payload_exemplo: null, atualizado_em: iso(dia(1)),
    automacao_acoes: [
      acaoTemplate('t-obr', { nome: '{{cliente.primeiro_nome}}', pedido: '{{evento.numero_unico}}' }, 'nota_interna'),
      { id: uid(), posicao: 1, tipo: 'transferir_fila', espera_valor: 1, espera_unidade: 'minutos', config: { usar_mapa_filas: true } },
    ] },
  { id: 'a1000000-0000-4000-8000-000000000003', nome: 'Cliente A parou de comprar', ativa: false, arquivada_em: null,
    fonte: 'metrics', gatilho: 'alerta_comportamento', parametros: { padroes: ['cadencia_rompida', 'parada_repentina'] },
    condicoes: { ativas: true, modo: 'todas', lista: [{ campo: 'cliente.curva', operador: 'igual', valor: 'A' }] },
    respeitar_horario: true, atraso_valor: 0, atraso_unidade: 'minutos', segredo_webhook: 'demo3', payload_exemplo: null, atualizado_em: iso(dia(3)),
    automacao_acoes: [acaoTemplate('t-sau', { nome: '{{cliente.primeiro_nome}}' })] },
  { id: 'a1000000-0000-4000-8000-000000000004', nome: 'Campanhas do metrics', ativa: true, arquivada_em: null,
    fonte: 'webhook', gatilho: 'webhook_externo', parametros: {}, condicoes: {}, respeitar_horario: false,
    atraso_valor: 0, atraso_unidade: 'minutos', campo_telefone: 'contact.phone_digits', segredo_webhook: 'demo4c1b2a39f8e7d6c5b4a3',
    payload_exemplo: { contact: { name: 'Ana', phone_digits: '5511999990000' }, campaign: { id: 'c1', name: 'Black Friday' } },
    atualizado_em: iso(dia(5)), automacao_acoes: [acaoTemplate('t-sau', { nome: '{{evento.contact.name}}' }, 'enviar_mesmo_assim')] },
];

// ---------------------------------------------------------------- histórico de 14 dias
const eventos: Row[] = [];
const execucoes: Row[] = [];
const envios: Row[] = [];
let semente = 7;
const rnd = () => ((semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648);
const motivosEvento = ['limite_contato', 'condicoes', 'telefone_invalido', 'nao_perturbe'];
for (let d = 13; d >= 0; d--) {
  for (const [i, a] of automacoes.entries()) {
    if (!a.ativa) continue;
    const qtd = [16, 9, 0, 5][i] + Math.floor(rnd() * 6);
    for (let n = 0; n < qtd; n++) {
      const quando = new Date(dia(d)); quando.setHours(9 + (n % 8), (n * 7) % 60, 0, 0);
      const ignorado = rnd() > 0.85;
      const ev = { id: uid(), automacao_id: a.id, recebido_em: iso(quando), situacao: ignorado ? 'ignorado' : 'agendado',
        motivo: ignorado ? motivosEvento[Math.floor(rnd() * motivosEvento.length)] : null };
      eventos.push(ev);
      if (ignorado) continue;
      const sorte = rnd();
      const status = sorte > 0.95 ? 'erro' : sorte > 0.86 ? 'ignorado' : 'sucesso';
      const acao = (a.automacao_acoes as Row[])[0];
      const concluido = new Date(quando.getTime() + 45000);
      execucoes.push({ id: uid(), automacao_id: a.id, evento_id: ev.id, status, agendado_para: iso(quando), concluido_em: iso(concluido),
        criado_em: iso(quando), erro: status === 'erro' ? 'Message undeliverable' : status === 'ignorado' ? 'Cliente já tem conversa em atendimento' : null,
        codigo_erro: status === 'erro' ? '131026' : status === 'ignorado' ? 'conversa_aberta' : null,
        automacoes: { nome: a.nome }, automacao_acoes: { tipo: acao.tipo } });
      if (status === 'sucesso') {
        const respondeu = rnd() > 0.45; const comprou = respondeu && rnd() > 0.55;
        envios.push({ id: uid(), automacao_id: a.id, tipo: 'template', enviado_em: iso(concluido),
          respondeu_em: respondeu ? iso(new Date(concluido.getTime() + 3600e3)) : null,
          comprou_em: comprou ? iso(new Date(concluido.getTime() + 86400e3)) : null,
          valor_compra: comprou ? Math.round(150 + rnd() * 900) : null });
      }
    }
  }
}

const chavesApi: Row[] = [
  { id: uid(), nome: 'Integração site', prefixo: 'br_live_9f2a', usado_em: iso(dia(0)), revogada_em: null, criado_em: iso(dia(30)) },
  { id: uid(), nome: 'Teste antigo', prefixo: 'br_live_1c77', usado_em: null, revogada_em: iso(dia(5)), criado_em: iso(dia(60)) },
];
const naoPerturbe: Row[] = [
  { id: uid(), telefone: '+5511912345678', client_id: null, motivo: 'Pediu para não receber', criado_em: iso(dia(2)) },
];

const tabelas: Record<string, Row[]> = {
  configuracao: [configuracao], integracao_octadesk: [integracao], octa_numeros: numeros, octa_templates: templates,
  octa_grupos: grupos, octa_tags: tags, mapa_filas: mapaFilas, automacoes, eventos, execucoes, envios,
  chaves_api: chavesApi, nao_perturbe: naoPerturbe, profiles: [demoSession.profile as Row],
};

// ---------------------------------------------------------------- "PostgREST" em memória
const cmp = (row: Row, col: string, val: unknown) => String(row[col] ?? '') === String(val);

class Query implements PromiseLike<{ data: unknown; error: null }> {
  private rows: Row[];
  private single = false;
  private patch: Row | null = null;
  constructor(private table: string) { this.rows = [...(tabelas[table] ?? [])]; }

  select() { return this; }
  insert(v: Row | Row[]) { (tabelas[this.table] ??= []).push(...(Array.isArray(v) ? v : [v]).map((r) => ({ id: uid(), criado_em: iso(new Date()), ...r }))); return this; }
  upsert(v: Row | Row[], opts?: { onConflict?: string }) {
    const chave = opts?.onConflict ?? 'id';
    for (const r of Array.isArray(v) ? v : [v]) {
      const alvo = (tabelas[this.table] ??= []);
      const existente = alvo.find((x) => x[chave] === r[chave]);
      if (existente) Object.assign(existente, r); else alvo.push(r);
    }
    return this;
  }
  update(v: Row) { this.patch = v; return this; }
  delete() { this.patch = { __delete: true }; return this; }
  eq(col: string, val: unknown) { this.rows = this.rows.filter((r) => cmp(r, col, val)); return this; }
  is(col: string, val: unknown) { this.rows = this.rows.filter((r) => (val === null ? r[col] == null : r[col] === val)); return this; }
  not(col: string, _op: string, val: unknown) { this.rows = this.rows.filter((r) => (val === null ? r[col] != null : !cmp(r, col, val))); return this; }
  gte(col: string, val: string) { this.rows = this.rows.filter((r) => String(r[col]) >= val); return this; }
  lte(col: string, val: string) { this.rows = this.rows.filter((r) => String(r[col]) <= val); return this; }
  order(col: string, opts?: { ascending?: boolean }) {
    const dir = opts?.ascending === false ? -1 : 1;
    this.rows.sort((a, b) => (String(a[col] ?? '') > String(b[col] ?? '') ? dir : -dir));
    return this;
  }
  limit(n: number) { this.rows = this.rows.slice(0, n); return this; }
  maybeSingle() { this.single = true; return this; }

  then<R>(resolve: (v: { data: unknown; error: null }) => R) {
    if (this.patch) {
      const alvo = tabelas[this.table] ?? [];
      for (const r of this.rows) {
        if (this.patch.__delete) alvo.splice(alvo.indexOf(r), 1);
        else Object.assign(r, this.patch);
      }
    }
    return Promise.resolve(resolve({ data: this.single ? this.rows[0] ?? null : this.rows, error: null }));
  }
}

const noDia = (valor: unknown, chave: string) => String(valor ?? '').slice(0, 10) === chave;

const rpcs: Record<string, (args: Record<string, unknown>) => unknown> = {
  pode: () => true,
  listar_usuarios: () => [
    { id: USER, nome: 'Kaique Demo', email: 'kaique@exemplo.com', papel: 'owner', perfil_acesso: null, pode_ver: true, pode_editar: true },
    { id: uid(), nome: 'Cristal Vendas', email: 'cristal@exemplo.com', papel: 'viewer', perfil_acesso: 'Comercial', pode_ver: true, pode_editar: true },
    { id: uid(), nome: 'Bruno Expedição', email: 'bruno@exemplo.com', papel: 'viewer', perfil_acesso: 'Expedição', pode_ver: true, pode_editar: false },
    { id: uid(), nome: null, email: 'financeiro@exemplo.com', papel: 'viewer', perfil_acesso: 'Financeiro', pode_ver: false, pode_editar: false },
  ],
  segredos_preenchidos: () => ['octadesk_api_key', 'octadesk_usuario', 'octadesk_senha', 'octadesk_tenant'],
  pedir_sincronizacao: () => { integracao.sincronizacao_pedida_em = iso(new Date()); integracao.sincronizado_em = iso(new Date()); return null; },
  salvar_integracao: ({ p }) => {
    const x = (p ?? {}) as Row;
    for (const k of ['base_url', 'subdominio', 'agente_email', 'api_privada_ativa']) if (x[k] !== undefined && x[k] !== '') integracao[k] = x[k];
    integracao.status = 'conectado'; integracao.validado_em = iso(new Date());
    return null;
  },
  resumo_automacoes: () => automacoes.map((a) => {
    const minhas = execucoes.filter((x) => x.automacao_id === a.id);
    const meusEnvios = envios.filter((e) => e.automacao_id === a.id);
    return {
      automacao_id: a.id,
      executadas: minhas.filter((x) => x.status === 'sucesso').length,
      erros: minhas.filter((x) => x.status === 'erro').length,
      sem_envio: minhas.filter((x) => x.status === 'ignorado').length + eventos.filter((e) => e.automacao_id === a.id && e.situacao === 'ignorado').length,
      ultima_execucao: minhas.at(-1)?.concluido_em ?? null,
      envios: meusEnvios.length,
      respostas: meusEnvios.filter((e) => e.respondeu_em).length,
      compras: meusEnvios.filter((e) => e.comprou_em).length,
    };
  }),
  estatisticas_diarias: ({ p_de, p_ate, p_automacao }) => {
    const dias: Row[] = [];
    for (let d = new Date(String(p_de)); d <= new Date(String(p_ate)); d = new Date(d.getTime() + 86400000)) {
      const k = d.toISOString().slice(0, 10);
      const filtro = (r: Row) => !p_automacao || r.automacao_id === p_automacao;
      const ev = eventos.filter((e) => filtro(e) && noDia(e.recebido_em, k));
      const ex = execucoes.filter((e) => filtro(e) && noDia(e.concluido_em, k));
      const en = envios.filter((e) => filtro(e) && noDia(e.enviado_em, k));
      dias.push({ dia: k, gatilhos: ev.length, gatilhos_ignorados: ev.filter((e) => e.situacao === 'ignorado').length,
        acoes: ex.length, acoes_sucesso: ex.filter((e) => e.status === 'sucesso').length,
        acoes_sem_envio: ex.filter((e) => e.status === 'ignorado').length, acoes_erro: ex.filter((e) => e.status === 'erro').length,
        envios: en.length, respostas: en.filter((e) => e.respondeu_em).length, compras: en.filter((e) => e.comprou_em).length,
        valor_compras: en.reduce((s, e) => s + Number(e.valor_compra ?? 0), 0) });
    }
    return dias;
  },
  salvar_automacao: ({ p }) => {
    const dados = p as Row;
    const acoes = ((dados.acoes as Row[]) ?? []).map((a, i) => ({ ...a, id: uid(), posicao: i }));
    const { acoes: _ignora, ...resto } = dados;
    void _ignora;
    const existente = automacoes.find((a) => a.id === dados.id);
    if (existente) { Object.assign(existente, resto, { automacao_acoes: acoes, atualizado_em: iso(new Date()) }); return existente.id; }
    const nova = { condicoes: {}, parametros: {}, ...resto, id: uid(), arquivada_em: null, segredo_webhook: 'demo' + uid().replace(/-/g, ''),
      payload_exemplo: null, atualizado_em: iso(new Date()), automacao_acoes: acoes };
    automacoes.unshift(nova);
    return nova.id;
  },
  duplicar_automacao: ({ p_id }) => {
    const src = automacoes.find((a) => a.id === p_id)!;
    const nova = { ...src, id: uid(), nome: `${src.nome} (cópia)`, ativa: false, atualizado_em: iso(new Date()) };
    automacoes.unshift(nova);
    return nova.id;
  },
  criar_chave_api: ({ p_nome }) => {
    const segredo = 'br_live_' + uid().replace(/-/g, '') + uid().replace(/-/g, '').slice(0, 16);
    chavesApi.unshift({ id: uid(), nome: String(p_nome), prefixo: segredo.slice(0, 12), usado_em: null, revogada_em: null, criado_em: iso(new Date()) });
    return { id: uid(), segredo };
  },
  revogar_chave_api: ({ p_id }) => { const k = chavesApi.find((x) => x.id === p_id); if (k) k.revogada_em = iso(new Date()); return null; },
};

const clienteDemo = {
  from: (table: string) => new Query(table),
  rpc: async (name: string, args: Record<string, unknown> = {}) => ({ data: rpcs[name] ? rpcs[name](args) : null, error: null }),
  auth: {
    getSession: async () => ({ data: { session: demoSession.session } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signOut: async () => { alert('Modo demonstração: não há login para sair.'); return { error: null }; },
    signInWithPassword: async () => ({ data: { session: demoSession.session }, error: null }),
    updateUser: async () => ({ error: null }),
    resetPasswordForEmail: async () => ({ error: null }),
    signUp: async () => ({ data: { session: demoSession.session }, error: null }),
  },
};

export const demoClient = { ...clienteDemo, schema: () => clienteDemo };
