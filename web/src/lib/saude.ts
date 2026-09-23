import type { Integracao } from './types';

/** Algo que impede ou atrapalha os envios e precisa da atenção de alguém. */
export interface Problema { titulo: string; detalhe: string; log?: string; link: string }

export interface IntegracaoExterna { tipo: string; status: 'pendente' | 'conectado' | 'erro'; ultimo_erro: string | null; atualizada_em: string }

const NOMES: Record<string, string> = { metrics: 'metrics' };

// O fluxo de manutenção do n8n ressincroniza o catálogo de hora em hora: 3h sem sincronizar = motor parado.
const HORAS_SEM_RESPOSTA = 3;

const horasDesde = (iso: string, agora: Date) => Math.floor((agora.getTime() - new Date(iso).getTime()) / 3_600_000);

/** Problemas da empresa aberta a partir da integração do Octadesk e das integrações externas. Vazio = tudo normal. */
export function problemasDaEmpresa(octa: Integracao | null, externas: IntegracaoExterna[], agora = new Date()): Problema[] {
  const lista: Problema[] = [];

  if (octa) {
    if (octa.status === 'nao_configurado') {
      lista.push({ titulo: 'Octadesk não configurado', detalhe: 'Precisa da sua atenção: sem a chave de API nenhuma mensagem é enviada.', link: '/app/configuracoes' });
    } else if (octa.status === 'erro') {
      lista.push({ titulo: 'Octadesk desconectado', detalhe: 'A API do Octadesk recusou a conexão ou não está respondendo. As mensagens estão paradas.',
        log: octa.ultimo_erro ?? 'Sem detalhe do erro.', link: '/app/configuracoes' });
    } else if (octa.status === 'conectado' && octa.sincronizado_em && horasDesde(octa.sincronizado_em, agora) >= HORAS_SEM_RESPOSTA) {
      const h = horasDesde(octa.sincronizado_em, agora);
      lista.push({ titulo: 'Octadesk sem resposta', detalhe: `A última sincronização foi há ${h} horas. O motor (n8n) pode estar parado.`,
        log: `Última sincronização: ${new Date(octa.sincronizado_em).toLocaleString('pt-BR')}`, link: '/app/configuracoes' });
    }
  }

  for (const e of externas) {
    if (e.status !== 'erro') continue;
    lista.push({ titulo: `Integração com ${NOMES[e.tipo] ?? e.tipo} com erro`, detalhe: 'A conexão falhou. Confira o endereço e a chave de acesso.',
      log: e.ultimo_erro ?? 'Sem detalhe do erro.', link: '/app/configuracoes/integracoes' });
  }
  return lista;
}
