import { Workflow, type LucideIcon } from 'lucide-react';
import type { Area } from '../lib/permissao';

export interface NavItem {
  chave: string;
  to: string;
  end?: boolean;
  icone: LucideIcon;
  label: string;
  /** some do menu quando o perfil não vê esta área */
  area: Area;
}

/** Itens do menu principal. A sidebar só mapeia esta lista.
 *  A tela inicial não entra aqui: chega-se a ela pelo logo. */
export const NAV: NavItem[] = [
  { chave: 'automacoes', to: '/app/automacoes', icone: Workflow, label: 'Automações', area: 'automacoes' },
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
      + 'O interruptor pausa sem perder a configuração; o menu permite editar, duplicar e arquivar. '
      + 'A lista mostra 10 por página, ativas primeiro e pausadas depois (a seta de cada card mostra gatilho e ações); "Ver todas" abre todas em resumo — passe o mouse em '
      + '"Gatilho" ou "Ações" para ver os detalhes e clique na automação para editá-la.',
  },
  '/app/automacoes/nova': {
    titulo: 'Nova automação',
    texto: 'Escolha a origem e o gatilho, ajuste os parâmetros e, se quiser, condições sobre os dados do cliente. '
      + 'A primeira ação costuma ser um template: ele abre a conversa que as ações seguintes (nota, tags, transferência) usam.',
  },
  '/app/configuracoes': {
    titulo: 'Octadesk',
    texto: 'Conecte o Octadesk com a chave de API e o e-mail do agente. Em até um minuto o sistema valida a chave e sincroniza '
      + 'números, templates aprovados, filas e tags. A transferência para filas usa o login de um usuário do Octadesk e é opcional. '
      + 'Nas regras de envio ficam o horário comercial e o limite de contato por cliente.',
  },
  '/app/configuracoes/integracoes': {
    titulo: 'Integrações',
    texto: 'Sistemas externos ligados a esta empresa. Em "Adicionar integração" você conecta o metrics informando a URL do '
      + 'Supabase dele e uma chave de acesso — a chave fica guardada no servidor e nunca volta para a tela. Trello, Salesforce, '
      + 'HubSpot e os demais aparecem como "Em breve". Editar e Desconectar ficam no ⋮ de cada integração.',
  },
  '/app/configuracoes/empresa': {
    titulo: 'Empresa',
    texto: 'Dados cadastrais da empresa aberta agora e o fuso horário. O fuso é o que o horário comercial das regras de envio '
      + 'usa para decidir se uma mensagem sai agora ou espera a próxima janela. O nome da empresa só o dono da plataforma muda.',
  },
  '/app/configuracoes/usuarios': {
    titulo: 'Usuários',
    texto: 'Quem acessa esta empresa e com qual perfil. Quem tem "Usuários: edita" no perfil cria usuários com senha provisória e, '
      + 'no ⋮ de cada um, edita nome e perfil, redefine a senha ou exclui (tira o acesso a esta empresa). O interruptor Ativo '
      + 'suspende sem excluir. Em "Configurar perfis de acesso" você define, para cada área do painel, se o perfil não vê, só vê ou '
      + 'edita. O Master é o administrador fixo da empresa e sempre sobra pelo menos um. "Ver todos" lista todo mundo e exporta em CSV.',
  },
  '/app/configuracoes/owner': {
    titulo: 'Owner',
    texto: 'Área do dono da plataforma. Cada empresa é isolada: integração do Octadesk, automações, números, histórico, chaves '
      + 'de API, usuários e perfis são só dela. Inativar pausa tudo (não recebe eventos, não envia e os usuários dela perdem o '
      + 'acesso); Editar e Apagar ficam no ⋮. Toda empresa nasce com um usuário Master (administrador dela). Abaixo da empresa, os usuários e perfis dela, como na aba Usuários.',
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
    texto: 'Seu nome e sua senha valem para todas as empresas em que você tem acesso. O nível de acesso em cada empresa é '
      + 'definido pelo dono da plataforma.',
  },
};
