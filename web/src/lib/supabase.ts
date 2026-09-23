import { createClient } from '@supabase/supabase-js';
import { DEMO, demoClient } from './demo';

// Projeto padrão: URL e chave publishable são públicas (vão no JavaScript de qualquer jeito; quem protege é o RLS).
// Assim um deploy sem as variáveis não aponta para lugar nenhum. As variáveis de ambiente continuam valendo por cima.
const url = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://gsndcxdjwblsukxjzwhi.supabase.co';
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) || 'sb_publishable_L3m2GbxCxn4wHDyVuR_iBQ_OAJssJEV';

// Empresa atual: vai no header x-empresa de toda chamada e o banco só mostra os dados dela (RLS).
// Começa pela última escolhida, para as primeiras chamadas depois de recarregar a página já irem certas.
const CHAVE_EMPRESA = 'octaplus.empresa';
let empresaAtual: string | null = (() => {
  try { return JSON.parse(localStorage.getItem(CHAVE_EMPRESA) ?? 'null') as string | null; } catch { return null; }
})();

export function definirEmpresaAtual(id: string | null) {
  empresaAtual = id;
  try { if (id) localStorage.setItem(CHAVE_EMPRESA, JSON.stringify(id)); else localStorage.removeItem(CHAVE_EMPRESA); } catch { /* sem storage */ }
}
export const empresaGuardada = () => empresaAtual;

const comEmpresa: typeof fetch = (input, init) => {
  if (!empresaAtual) return fetch(input, init);
  const headers = new Headers(init?.headers);
  headers.set('x-empresa', empresaAtual);
  return fetch(input, { ...init, headers });
};

// As tabelas do painel ficam no schema `octaplus`.
const realClient = createClient(url, key, { db: { schema: 'octaplus' }, global: { fetch: comEmpresa } });
// No modo demonstração tudo roda em memória (veja demo.ts): nenhuma chamada sai do navegador.
export const supabase = DEMO ? (demoClient as unknown as typeof realClient) : realClient;

const n8nUrl = (import.meta.env.VITE_N8N_WEBHOOK_URL as string) || (DEMO ? 'https://n8n.seu-dominio.com/webhook' : '');
export const N8N_WEBHOOK_URL = n8nUrl.replace(/\/$/, '');

/** URL que um sistema externo (ou uma campanha do metrics) chama para disparar a automação. */
export const urlWebhookExterno = (id: string, segredo: string) => `${N8N_WEBHOOK_URL}/octaplus/in/${id}?secret=${segredo}`;

/** URL a cadastrar nos webhooks de conversa do Octadesk (o segredo vai no caminho). */
export const urlWebhookOctadesk = (segredo: string) => `${N8N_WEBHOOK_URL}/octaplus/octadesk/${segredo}`;

/** Converte erro do PostgREST/RPC em mensagem legível. */
export function errorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  const map: Record<string, string> = {
    sem_permissao: 'Você não tem permissão para esta ação.',
    fonte_combina_com_gatilho: 'A origem e o gatilho escolhidos não combinam.',
    confirmacao_invalida: 'O nome digitado não confere com o da empresa.',
    usuario_e_dono: 'Esse usuário é o dono da plataforma: ele já tem acesso a tudo.',
    senha_curta: 'A senha precisa ter pelo menos 8 caracteres.',
    email_invalido: 'E-mail inválido.',
    nivel_invalido: 'Nível de acesso inválido.',
    nao_encontrado: 'Registro não encontrado nesta empresa.',
    empresas_cnpj_check: 'O CNPJ precisa ter 14 dígitos.',
    empresas_nome_check: 'Informe o nome da empresa.',
    perfil_invalido: 'Escolha um perfil de acesso desta empresa.',
    perfil_em_uso: 'Este perfil ainda tem usuários. Mude o perfil deles antes de apagar.',
    perfil_repetido: 'Já existe um perfil com esse nome nesta empresa.',
    perfil_sem_nome: 'Informe o nome do perfil.',
    permissao_invalida: 'Permissão inválida no perfil.',
    voce_mesmo: 'Você não pode alterar o seu próprio acesso por aqui.',
    usuario_em_outras_empresas: 'Essa pessoa também usa outras empresas: só o dono da plataforma pode trocar a senha dela.',
    'Invalid login credentials': 'E-mail ou senha incorretos.',
    'Email not confirmed': 'Confirme o e-mail pelo link que enviamos antes de entrar.',
    'User already registered': 'Já existe uma conta com este e-mail.',
    'Signups not allowed': 'O cadastro está fechado. Peça acesso a quem administra o painel.',
    'Password should be at least': 'A senha é curta demais.',
    'New password should be different': 'A nova senha precisa ser diferente da atual.',
    'Auth session missing': 'O link expirou ou já foi usado. Peça um novo.',
    'rate limit': 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.',
    'For security purposes': 'Por segurança, espere alguns segundos antes de pedir de novo.',
    'invalid format': 'E-mail inválido.',
    'NetworkError': 'Não foi possível falar com o servidor. Confira sua internet e tente de novo.',
    'Failed to fetch': 'Não foi possível falar com o servidor. Confira sua internet e tente de novo.',
  };
  return Object.entries(map).find(([k]) => raw.includes(k))?.[1] ?? raw;
}
