import { createContext, useContext } from 'react';

/** Áreas do painel que um perfil de acesso libera (mesma lista de octaplus.areas()). */
export const AREAS = [
  { chave: 'automacoes', label: 'Automações', descricao: 'Réguas, estatísticas e histórico de envios' },
  { chave: 'integracoes', label: 'Integrações', descricao: 'Octadesk, números, filas e regras de envio' },
  { chave: 'empresa', label: 'Empresa', descricao: 'Dados cadastrais e fuso horário' },
  { chave: 'usuarios', label: 'Usuários', descricao: 'Quem acessa a empresa e os perfis de acesso' },
  { chave: 'api', label: 'API', descricao: 'Chaves da API pública' },
  { chave: 'nao_perturbe', label: 'Não perturbe', descricao: 'Quem não recebe mensagens' },
] as const;

export type Area = (typeof AREAS)[number]['chave'];
export type Nivel = 'nenhum' | 'ver' | 'editar';
export type Permissoes = Partial<Record<Area, Nivel>>;

export const NIVEIS: { valor: Nivel; label: string }[] = [
  { valor: 'nenhum', label: 'Sem acesso' },
  { valor: 'ver', label: 'Só vê' },
  { valor: 'editar', label: 'Edita' },
];

/** Permissões do usuário na empresa aberta. Quem preenche é o EmpresasProvider. */
export const PermissaoCtx = createContext<Permissoes>({});

export const nivelDe = (p: Permissoes, area: Area): Nivel => p[area] ?? 'nenhum';

/** O que o usuário pode numa área da empresa aberta. */
export function usePode(area: Area) {
  const nivel = nivelDe(useContext(PermissaoCtx), area);
  return { podeVer: nivel !== 'nenhum', podeEditar: nivel === 'editar' };
}

export const usePermissoes = () => useContext(PermissaoCtx);
