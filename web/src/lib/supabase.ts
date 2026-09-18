import { createClient } from '@supabase/supabase-js';
import { DEMO, demoClient } from './demo';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (!DEMO && (!url || !key)) console.warn('Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY em web/.env.local');

// Mesmo Supabase do metrics: login e usuários são os dele; as tabelas do painel ficam no schema `octaplus`.
const realClient = createClient(url ?? 'http://localhost', key ?? 'missing', { db: { schema: 'octaplus' } });
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
    'Invalid login credentials': 'E-mail ou senha incorretos.',
  };
  return Object.entries(map).find(([k]) => raw.includes(k))?.[1] ?? raw;
}
