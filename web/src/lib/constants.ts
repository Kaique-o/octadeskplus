import type { Fonte, Gatilho, Operador, PoliticaConversa, TipoAcao } from './types';

/** Nome/marca exibido no painel. */
export const BRAND = {
  name: 'Octadesk Plus',
  empresa: 'Skytech Solutions',
};

export const FONTES: { value: Fonte; label: string; descricao: string }[] = [
  { value: 'metrics', label: 'Metrics (CRM)', descricao: 'Vendas, orçamentos, curvas, créditos e alertas de comportamento' },
  { value: 'octadesk', label: 'Conversas do Octadesk', descricao: 'Conversa encerrada, atribuída ou nova mensagem' },
  { value: 'webhook', label: 'Evento externo (webhook)', descricao: 'Qualquer sistema via POST — inclusive as campanhas do metrics' },
];

/** Parâmetro de um gatilho, desenhado no wizard. */
export interface Parametro {
  chave: string;
  label: string;
  tipo: 'numero' | 'texto' | 'lista';
  padrao?: number | string | string[];
  opcoes?: { value: string; label: string }[];
  ajuda?: string;
}

const CURVAS = ['A', 'B', 'C', 'D', 'E'].map((c) => ({ value: c, label: `Curva ${c}` }));

/** Padrões de client_behavior_alerts do metrics */
export const PADROES_ALERTA = [
  'primeira_recompra_risco', 'cadencia_diaria_rompida', 'cadencia_semanal_rompida', 'cadencia_rompida',
  'parada_repentina', 'ritual_dia_semana', 'queda_ticket', 'encolhimento_cesta', 'abandono_marca',
  'desaceleracao', 'mudanca_canal', 'aceleracao',
].map((p) => ({ value: p, label: p.replace(/_/g, ' ') }));

/** Etapas comerciais que a IA do metrics atribui às conversas encerradas (skyler_analyses) */
export const ETAPAS_COMERCIAIS = [
  'Orçamento foi enviado', 'Cliente realizou o pagamento', 'Cliente pediu orçamento', 'Falta produto',
  'Cliente não descreveu produto', 'Reabertura', 'Troca/Devolução', 'Acompanhamento de pedido', 'Contato ativo', 'Outros',
].map((e) => ({ value: e, label: e }));

export const GATILHOS: Record<Gatilho, { fonte: Fonte; label: string; descricao: string; parametros: Parametro[]; campos: string[] }> = {
  orcamento_sem_compra: { fonte: 'metrics', label: 'Orçamento enviado sem compra',
    descricao: 'A IA marcou que o orçamento foi enviado e o cliente não comprou até N dias depois.',
    parametros: [{ chave: 'dias', label: 'Dias depois do envio', tipo: 'numero', padrao: 1 }],
    campos: ['evento.orcamento_enviado_em', 'evento.atendente', 'evento.numero_conversa'] },
  pediu_orcamento: { fonte: 'metrics', label: 'Pediu orçamento e não recebeu',
    descricao: 'O cliente pediu orçamento e nenhum foi enviado em N horas.',
    parametros: [{ chave: 'horas', label: 'Horas sem resposta', tipo: 'numero', padrao: 2 }],
    campos: ['evento.pedido_em', 'evento.atendente'] },
  conversa_classificada: { fonte: 'metrics', label: 'Conversa encerrada com etapa',
    descricao: 'Conversa encerrada e classificada pela IA numa das etapas escolhidas.',
    parametros: [{ chave: 'etapas', label: 'Etapas', tipo: 'lista', opcoes: ETAPAS_COMERCIAIS }],
    campos: ['evento.etapa', 'evento.categoria', 'evento.atendente'] },
  venda_faturada: { fonte: 'metrics', label: 'Venda faturada',
    descricao: 'Nova nota de venda no Sankhya (itens somados por nota).', parametros: [],
    campos: ['evento.numero_unico', 'evento.valor_total', 'evento.itens', 'evento.data'] },
  venda_cancelada: { fonte: 'metrics', label: 'Venda cancelada',
    descricao: 'Nota cancelada no Sankhya.', parametros: [],
    campos: ['evento.numero_unico', 'evento.valor_total', 'evento.data'] },
  alerta_comportamento: { fonte: 'metrics', label: 'Alerta de comportamento',
    descricao: 'Alertas de "Quem chamar agora" do metrics. No máximo um por cliente e padrão por semana.',
    parametros: [{ chave: 'padroes', label: 'Padrões (vazio = todos)', tipo: 'lista', opcoes: PADROES_ALERTA }],
    campos: ['evento.padrao', 'evento.severidade', 'evento.motivo', 'evento.dias_atraso', 'evento.valor_risco'] },
  mudanca_curva: { fonte: 'metrics', label: 'Mudança de curva',
    descricao: 'Cliente mudou de curva ABC.',
    parametros: [
      { chave: 'curva_de', label: 'De (opcional)', tipo: 'texto', opcoes: CURVAS },
      { chave: 'curva_para', label: 'Para (opcional)', tipo: 'texto', opcoes: CURVAS },
    ],
    campos: ['evento.curva_de', 'evento.curva_para'] },
  credito_disponivel: { fonte: 'metrics', label: 'Crédito disponível',
    descricao: 'Novo crédito lançado para o cliente.',
    parametros: [{ chave: 'valor_minimo', label: 'Valor mínimo (R$)', tipo: 'numero', padrao: 0 }],
    campos: ['evento.valor', 'evento.referencia'] },
  sem_compra: { fonte: 'metrics', label: 'Sem compra há N dias',
    descricao: 'Dispara uma vez quando o cliente completa N dias desde a última compra.',
    parametros: [{ chave: 'dias', label: 'Dias sem comprar', tipo: 'numero', padrao: 30 }],
    campos: ['evento.dias', 'evento.ultima_compra'] },
  octa_conversa_encerrada: { fonte: 'octadesk', label: 'Conversa encerrada', descricao: 'Evento room.after-close do Octadesk.',
    parametros: [], campos: ['evento.conversa.numero', 'evento.conversa.agente', 'evento.conversa.grupo'] },
  octa_conversa_atribuida: { fonte: 'octadesk', label: 'Conversa atribuída a um agente', descricao: 'Evento room.after-set-agent do Octadesk.',
    parametros: [], campos: ['evento.conversa.numero', 'evento.conversa.agente', 'evento.conversa.grupo'] },
  octa_nova_mensagem: { fonte: 'octadesk', label: 'Nova mensagem na conversa', descricao: 'Evento room.after-insert-message do Octadesk.',
    parametros: [], campos: ['evento.conversa.ultima_mensagem', 'evento.conversa.ultima_mensagem_de', 'evento.conversa.agente'] },
  webhook_externo: { fonte: 'webhook', label: 'Recebimento de payload', descricao: 'POST com o segredo da automação.',
    parametros: [], campos: [] },
};

/** Campos do cliente disponíveis para condições e variáveis (octaplus.contexto_cliente) */
export const CAMPOS_CLIENTE = [
  { key: 'cliente.primeiro_nome', label: 'Primeiro nome' },
  { key: 'cliente.nome', label: 'Nome completo' },
  { key: 'cliente.curva', label: 'Curva' },
  { key: 'cliente.situacao_carteira', label: 'Situação da carteira' },
  { key: 'cliente.dias_sem_compra', label: 'Dias sem compra' },
  { key: 'cliente.ultima_compra', label: 'Data da última compra' },
  { key: 'cliente.faturamento_365_dias', label: 'Faturamento 365 dias' },
  { key: 'cliente.vendedor', label: 'Vendedor' },
  { key: 'cliente.tipo_entrega', label: 'Tipo de entrega' },
  { key: 'cliente.telefone', label: 'Telefone' },
];

export const OPERADORES: { value: Operador; label: string; semValor?: boolean }[] = [
  { value: 'igual', label: 'é igual a' }, { value: 'diferente', label: 'é diferente de' },
  { value: 'contem', label: 'contém' }, { value: 'maior', label: 'maior que' }, { value: 'menor', label: 'menor que' },
  { value: 'em', label: 'é um de (separe por vírgula)' },
  { value: 'preenchido', label: 'está preenchido', semValor: true }, { value: 'vazio', label: 'está vazio', semValor: true },
];

export const ACOES: Record<TipoAcao, { label: string; precisaConversa?: boolean; privada?: boolean }> = {
  enviar_template: { label: 'Enviar template de WhatsApp' },
  enviar_mensagem: { label: 'Enviar mensagem na conversa', precisaConversa: true },
  nota_interna: { label: 'Nota interna na conversa', precisaConversa: true },
  aplicar_tags: { label: 'Aplicar tags na conversa', precisaConversa: true },
  campo_conversa: { label: 'Preencher campo da conversa', precisaConversa: true },
  transferir_fila: { label: 'Transferir para fila', precisaConversa: true, privada: true },
};

export const POLITICAS_CONVERSA: { value: PoliticaConversa; label: string; short: string }[] = [
  { value: 'nao_fazer_nada', label: 'Não fazer nada', short: 'Não faz nada' },
  { value: 'nota_interna', label: 'Deixar uma nota interna explicando por que não enviou', short: 'Nota interna' },
  { value: 'enviar_mesmo_assim', label: 'Enviar o template mesmo assim', short: 'Envia mesmo assim' },
];

export const UNIDADES = [
  { value: 'minutos', label: 'minuto(s)' },
  { value: 'horas', label: 'hora(s)' },
  { value: 'dias', label: 'dia(s)' },
] as const;

// chave = dia da semana com 0 = domingo (mesmo formato do app original)
export const WEEKDAYS = [
  { key: '0', label: 'Domingo' }, { key: '1', label: 'Segunda' }, { key: '2', label: 'Terça' }, { key: '3', label: 'Quarta' },
  { key: '4', label: 'Quinta' }, { key: '5', label: 'Sexta' }, { key: '6', label: 'Sábado' },
];

/** Motivos de evento ignorado / execução sem envio, em português */
export const MOTIVOS: Record<string, string> = {
  telefone_invalido: 'Telefone inválido', nao_perturbe: 'Não perturbe', condicoes: 'Fora das condições',
  limite_contato: 'Limite de contato', sem_acoes: 'Sem ações', conversa_aberta: 'Conversa aberta',
  janela_24h_fechada: 'Fora da janela de 24h', sem_conversa: 'Sem conversa', jwt_expirado: 'Token expirado',
};
