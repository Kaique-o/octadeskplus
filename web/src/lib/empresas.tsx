import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { definirEmpresaAtual, empresaGuardada, supabase } from './supabase';
import { useSession } from './session';
import { PermissaoCtx, type Permissao } from './permissao';

/** Empresa que o usuário pode abrir, com o nível dele nela ('dono' = dono da plataforma). */
export interface Empresa {
  id: string; nome: string; ativa: boolean; cnpj: string | null; telefone: string | null; site: string | null;
  criada_em: string; nivel: 'dono' | 'editar' | 'ver';
}

interface EmpresasState {
  empresas: Empresa[];
  carregando: boolean;
  atual: Empresa | null;
  escolher: (id: string) => void;
  sair: () => void;
  recarregar: () => Promise<void>;
}

const Ctx = createContext<EmpresasState | null>(null);

export function EmpresasProvider({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();
  const usuario = session?.user.id ?? null;
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [carregadaPara, setCarregadaPara] = useState<string | null>(null);   // lista é deste usuário
  const [atualId, setAtualId] = useState<string | null>(empresaGuardada);
  const carregando = loading || (usuario !== null && carregadaPara !== usuario);

  const recarregar = useCallback(async () => {
    const { data } = await supabase.rpc('listar_empresas');
    setEmpresas((data as Empresa[]) ?? []);
    setCarregadaPara(usuario);
  }, [usuario]);

  useEffect(() => {
    if (loading) return;
    if (!usuario) { setEmpresas([]); setCarregadaPara(null); return; }
    recarregar();
  }, [usuario, loading, recarregar]);

  const atual = carregando ? null : empresas.find((e) => e.id === atualId) ?? null;
  // O header precisa estar certo antes de as telas buscarem dados (efeitos dos filhos rodam antes dos do pai).
  // Empresa guardada que o usuário não pode mais abrir é esquecida.
  if (usuario && !carregando && empresaGuardada() !== (atual?.id ?? null)) definirEmpresaAtual(atual?.id ?? null);

  const valor = useMemo<EmpresasState>(() => ({
    empresas, carregando, atual,
    escolher: (id) => { definirEmpresaAtual(id); setAtualId(id); },
    sair: () => { definirEmpresaAtual(null); setAtualId(null); },
    recarregar,
  }), [empresas, carregando, atual, recarregar]);

  const permissao = useMemo<Permissao>(() => ({
    podeVer: Boolean(atual),
    podeEditar: atual?.nivel === 'dono' || atual?.nivel === 'editar',
  }), [atual]);

  return (
    <Ctx.Provider value={valor}>
      <PermissaoCtx.Provider value={permissao}>{children}</PermissaoCtx.Provider>
    </Ctx.Provider>
  );
}

export function useEmpresas() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useEmpresas fora do EmpresasProvider');
  return v;
}
