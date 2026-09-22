import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

// Empresas do painel. Por enquanto a escolha fica só no navegador: o schema octaplus ainda é de uma empresa só,
// então trocar de empresa muda o que o painel mostra de cabeçalho, não os dados.
export interface Empresa { id: string; nome: string }

const PADRAO: Empresa[] = [
  { id: 'skytech', nome: 'SkyTech' },
  { id: 'skyline', nome: 'Skyline' },
];

const CHAVE_LISTA = 'octaplus.empresas';
const CHAVE_ATUAL = 'octaplus.empresa';
const CHAVE_ADM = 'octaplus.adm';

function ler<T>(storage: () => Storage, chave: string, padrao: T): T {
  try { const v = storage().getItem(chave); return v ? (JSON.parse(v) as T) : padrao; } catch { return padrao; }
}
function gravar(storage: () => Storage, chave: string, valor: unknown) {
  try { if (valor == null) storage().removeItem(chave); else storage().setItem(chave, JSON.stringify(valor)); } catch { /* sem storage */ }
}
const local = () => localStorage;
const sessao = () => sessionStorage;

export const slug = (nome: string) =>
  nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

interface EmpresasState {
  empresas: Empresa[];
  atual: Empresa | null;
  escolher: (id: string) => void;
  sair: () => void;
  criar: (nome: string) => Empresa;
  remover: (id: string) => void;
  /** Módulo adm: só liga pelo código Konami e dura até fechar a aba. */
  admAtivo: boolean;
  ativarAdm: () => void;
  desativarAdm: () => void;
}

const Ctx = createContext<EmpresasState | null>(null);

export function EmpresasProvider({ children }: { children: ReactNode }) {
  const [empresas, setEmpresas] = useState<Empresa[]>(() => ler(local, CHAVE_LISTA, PADRAO));
  const [atualId, setAtualId] = useState<string | null>(() => ler(local, CHAVE_ATUAL, null));
  const [admAtivo, setAdmAtivo] = useState<boolean>(() => ler(sessao, CHAVE_ADM, false));

  useEffect(() => gravar(local, CHAVE_LISTA, empresas), [empresas]);
  useEffect(() => gravar(local, CHAVE_ATUAL, atualId), [atualId]);
  useEffect(() => gravar(sessao, CHAVE_ADM, admAtivo || null), [admAtivo]);

  const criar = useCallback((nome: string) => {
    const limpo = nome.trim();
    const id = slug(limpo);
    if (!limpo || !id) throw new Error('Informe o nome da empresa.');
    if (empresas.some((e) => e.id === id)) throw new Error('Já existe uma empresa com esse nome.');
    const nova = { id, nome: limpo };
    setEmpresas([...empresas, nova]);
    return nova;
  }, [empresas]);

  const remover = useCallback((id: string) => {
    setEmpresas((lista) => lista.filter((e) => e.id !== id));
    setAtualId((a) => (a === id ? null : a));
  }, []);

  const valor = useMemo<EmpresasState>(() => ({
    empresas,
    atual: empresas.find((e) => e.id === atualId) ?? null,
    escolher: setAtualId,
    sair: () => setAtualId(null),
    criar,
    remover,
    admAtivo,
    ativarAdm: () => setAdmAtivo(true),
    desativarAdm: () => setAdmAtivo(false),
  }), [empresas, atualId, criar, remover, admAtivo]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useEmpresas() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useEmpresas fora do EmpresasProvider');
  return v;
}

// ↑ ↑ ↓ ↓ ← → ← → B A
const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];

/** Chama `aoAcertar` quando o código Konami é digitado (fora de campos de texto). */
export function useKonami(aoAcertar: () => void) {
  useEffect(() => {
    let pos = 0;
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName))) return;
      const k = e.key.toLowerCase();
      pos = k === KONAMI[pos] ? pos + 1 : k === KONAMI[0] ? (pos >= 2 && KONAMI[pos] === 'arrowdown' ? pos : 1) : 0;
      if (pos === KONAMI.length) { pos = 0; aoAcertar(); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aoAcertar]);
}
