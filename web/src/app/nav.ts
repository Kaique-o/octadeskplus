import { Workflow, type LucideIcon } from 'lucide-react';

export interface NavItem {
  chave: string;
  to: string;
  end?: boolean;
  icone: LucideIcon;
  label: string;
}

/** Itens do menu principal. A sidebar só mapeia esta lista.
 *  A tela inicial não entra aqui: chega-se a ela pelo logo. */
export const NAV: NavItem[] = [
  { chave: 'automacoes', to: '/app/automacoes', icone: Workflow, label: 'Automações' },
];

/** Ajuda por tela. Rota sem verbete deixa o botão "Ajuda" desabilitado, nunca escondido. */
export const AJUDA: Record<string, { titulo: string; texto: string }> = {
  '/app': {
    titulo: 'Início',
    texto: 'Gatilhos são eventos que chegaram (do metrics, do Octadesk ou por webhook). "Mensagens enviadas" são os templates e '
      + 'mensagens que saíram de fato. "Responderam" conta quem escreveu na conversa depois do envio, e "Compraram em 7 dias" '
      + 'quem teve nota de venda no Sankhya nesse prazo. "Sem envio" junta o que as regras barraram: conversa já aberta, '
      + 'limite de contato, não perturbe, telefone inválido ou condição não atendida.',
  },
  '/app/automacoes': {
    titulo: 'Automações',
    texto: 'Cada automação é um gatilho seguido de ações em sequência. Gatilhos do metrics são conferidos a cada 5 minutos e só '
      + 'olham o que acontecer depois de a automação ser ligada — ligar uma régua nunca dispara sobre o histórico. '
      + 'O interruptor pausa sem perder a configuração; o menu permite editar, duplicar e arquivar.',
  },
  '/app/automacoes/nova': {
    titulo: 'Nova automação',
    texto: 'Escolha a origem e o gatilho, ajuste os parâmetros e, se quiser, condições sobre os dados do cliente. '
      + 'A primeira ação costuma ser um template: ele abre a conversa que as ações seguintes (nota, tags, transferência) usam.',
  },
  '/app/configuracoes': {
    titulo: 'Integrações',
    texto: 'Conecte o Octadesk com a chave de API e o e-mail do agente. Em até um minuto o sistema valida a chave e sincroniza '
      + 'números, templates aprovados, filas e tags. A transferência para filas usa o login de um usuário do Octadesk e é opcional. '
      + 'Nas regras de envio ficam o horário comercial e o limite de contato por cliente.',
  },
  '/app/configuracoes/empresa': {
    titulo: 'Empresa',
    texto: 'Dados cadastrais da empresa e o fuso horário. O fuso é o que o horário comercial das regras de envio usa '
      + 'para decidir se uma mensagem sai agora ou espera a próxima janela.',
  },
  '/app/configuracoes/usuarios': {
    titulo: 'Usuários',
    texto: 'Os usuários são os do metrics. "Edita" e "Só vê" vêm do perfil de acesso (recurso octaplus); dono e administrador '
      + 'do metrics editam sempre. Convidar, remover e mudar permissões é feito no metrics.',
  },
  '/app/configuracoes/api': {
    titulo: 'API',
    texto: 'Endpoint para padronizar telefones no formato E.164 antes de gravar no seu sistema. '
      + 'A chave aparece uma única vez, na criação: guarde-a em local seguro. Revogar derruba na hora quem estiver usando.',
  },
  '/app/configuracoes/nao-perturbe': {
    titulo: 'Não perturbe',
    texto: 'Quem está nesta lista não recebe nada de nenhuma automação. O bloqueio é conferido antes de agendar cada envio.',
  },
  '/app/perfil': {
    titulo: 'Meu perfil',
    texto: 'Seu login é o do metrics: nome e senha alterados aqui valem lá também. Permissões ficam no perfil de acesso do metrics.',
  },
};
