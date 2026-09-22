import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, ChevronRight } from 'lucide-react';
import AuthShell from './AuthShell';
import { useEmpresas, useKonami } from '../lib/empresas';
import { supabase } from '../lib/supabase';

/** Tela entre o login e o painel: escolhe com qual empresa trabalhar. */
export default function EscolherEmpresa() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { empresas, atual, escolher, ativarAdm } = useEmpresas();

  useKonami(useCallback(() => { ativarAdm(); nav('/adm'); }, [ativarAdm, nav]));

  function entrar(id: string) {
    escolher(id);
    nav(params.get('next') || '/app', { replace: true });
  }

  return (
    <AuthShell
      title="Escolha a empresa"
      subtitle="Com qual empresa você vai trabalhar agora?"
      footer={<button type="button" className="font-medium text-brand hover:underline" onClick={() => supabase.auth.signOut()}>Sair</button>}
    >
      <ul className="space-y-3">
        {empresas.map((e) => (
          <li key={e.id}>
            <button
              type="button" onClick={() => entrar(e.id)}
              className={`card flex w-full items-center gap-3 px-4 py-4 text-left transition hover:border-brand hover:shadow-sm ${atual?.id === e.id ? 'border-brand' : ''}`}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><Building2 size={20} strokeWidth={1.8} /></span>
              <span className="flex-1">
                <strong className="block font-title text-base font-semibold">{e.nome}</strong>
                {atual?.id === e.id && <span className="text-xs text-muted">Última usada</span>}
              </span>
              <ChevronRight size={18} className="text-muted" />
            </button>
          </li>
        ))}
      </ul>
    </AuthShell>
  );
}
