import { createContext } from 'react';

/** O que o usuário pode na empresa atual. Quem preenche é o EmpresasProvider; useSession() repassa. */
export interface Permissao { podeVer: boolean; podeEditar: boolean }

export const PermissaoCtx = createContext<Permissao>({ podeVer: false, podeEditar: false });
