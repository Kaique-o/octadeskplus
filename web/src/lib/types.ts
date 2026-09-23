// Espelha as tabelas do schema `octaplus` (supabase/migrations/20260918000001_octaplus_tabelas.sql)

export type Fonte = 'metrics' | 'octadesk' | 'webhook';
export type Gatilho =
  | 'orcamento_sem_compra' | 'pediu_orcamento' | 'conversa_classificada' | 'venda_faturada' | 'venda_cancelada'
  | 'alerta_comportamento' | 'mudanca_curva' | 'credito_disponivel' | 'sem_compra'
  | 'octa_conversa_encerrada' | 'octa_conversa_atribuida' | 'octa_nova_mensagem'
  | 'webhook_externo';
export type TipoAcao = 'enviar_template' | 'enviar_mensagem' | 'nota_interna' | 'aplicar_tags' | 'campo_conversa' | 'transferir_fila';
export type Unidade = 'minutos' | 'horas' | 'dias';
export type PoliticaConversa = 'nao_fazer_nada' | 'nota_interna' | 'enviar_mesmo_assim';
export type Operador = 'igual' | 'diferente' | 'contem' | 'maior' | 'menor' | 'preenchido' | 'vazio' | 'em';

export interface Condicao { campo: string; operador: Operador; valor: string }
export interface Condicoes { ativas?: boolean; modo?: 'todas' | 'qualquer'; lista?: Condicao[] }

export interface ConfigAcao {
  numero?: string;
  template_id?: string;
  variaveis?: Record<string, string>;
  conversa_aberta?: PoliticaConversa;
  atribuir_automatico?: boolean;
  texto?: string;
  tags?: { id: string; nome: string }[];
  campo_id?: string;
  titulo?: string;
  tipo?: 'string' | 'boolean' | 'number';
  valor?: string;
  grupo_id?: string;
  usar_mapa_filas?: boolean;
}

export interface Acao {
  id?: string;
  posicao?: number;
  tipo: TipoAcao;
  config: ConfigAcao;
  espera_valor: number;
  espera_unidade: Unidade;
}

export interface Automacao {
  id?: string;
  nome: string;
  ativa: boolean;
  arquivada_em?: string | null;
  fonte: Fonte;
  gatilho: Gatilho;
  parametros: Record<string, unknown>;
  condicoes: Condicoes;
  respeitar_horario: boolean;
  atraso_valor: number;
  atraso_unidade: Unidade;
  campo_telefone?: string | null;
  segredo_webhook?: string;
  payload_exemplo?: Record<string, unknown> | null;
  atualizado_em?: string;
  automacao_acoes?: Acao[];
}

export interface Integracao {
  base_url: string | null;
  subdominio: string | null;
  agente_email: string | null;
  api_privada_ativa: boolean;
  status: 'nao_configurado' | 'validando' | 'conectado' | 'erro';
  ultimo_erro: string | null;
  validado_em: string | null;
  sincronizado_em: string | null;
  sincronizacao_pedida_em: string | null;
  segredo_webhook: string;
}

export interface Configuracao {
  empresa_id: string;
  fuso: string;
  horario_comercial: { perDay: Record<string, { enabled: boolean; windows: { start: string; end: string }[] }> };
  numero_envio_padrao: string | null;
  emails_alerta: string[];
  limite_contato_horas: number;
  janela_deteccao_horas: number;
}

export interface Numero { id: string; nome: string | null; numero: string; rotulo: string | null; ativo: boolean }
export interface Template { id: string; nome: string; status: string | null; categoria: string | null; variaveis: string[]; corpo: string | null }
export interface Grupo { id: string; nome: string }
export interface Tag { id: string; nome: string }
export interface MapaFila { tipo_entrega: string; grupo_id: string | null; rotulo: string | null }
