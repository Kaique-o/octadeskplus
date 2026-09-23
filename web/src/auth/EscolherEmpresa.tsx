import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, ShieldOff } from 'lucide-react';
import LogoEmpresa from '../app/LogoEmpresa';
import AuthShell from './AuthShell';
import { Alert, Spinner } from '../components/ui';
import { useEmpresas } from '../lib/empresas';
import { useSession } from '../lib/session';
import { empresaGuardada, errorMessage, supabase } from '../lib/supabase';

const sairDaConta = <button type="button" className="font-medium text-brand hover:underline" onClick={() => supabase.auth.signOut()}>Sair</button>;

/** Tela entre o login e o painel: escolhe com qual empresa trabalhar (só as que o usuário pode abrir). */
export default function EscolherEmpresa() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { eDono } = useSession();
  const { empresas, carregando, escolher, recarregar } = useEmpresas();
  const [nome, setNome] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ultima = empresaGuardada();

  function entrar(id: string) {
    escolher(id);
    nav(params.get('next') || '/app', { replace: true });
  }

  async function criarPrimeira(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    const { data, error } = await supabase.rpc('salvar_empresa', { p: { nome: nome.trim() } });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    await recarregar();
    entrar(data as string);
  }

  if (carregando) return <AuthShell title="Escolha a empresa"><div className="flex justify-center py-6"><Spinner /></div></AuthShell>;

  if (empresas.length === 0 && eDono) {
    return (
      <AuthShell title="Primeira empresa" subtitle="Você é o dono da plataforma. Cadastre a primeira empresa para começar." footer={sairDaConta}>
        <form onSubmit={criarPrimeira} className="space-y-4">
          {error && <Alert>{error}</Alert>}
          <div><label className="label">Nome da empresa</label><input className="input" required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: SkyTech" /></div>
          <button className="btn-primary w-full py-3" disabled={busy}>{busy ? <Spinner /> : 'Criar e entrar'}</button>
        </form>
      </AuthShell>
    );
  }

  if (empresas.length === 0) {
    return (
      <AuthShell title="Sem acesso" subtitle="Seu usuário ainda não foi liberado em nenhuma empresa. Peça ao dono da plataforma para dar acesso." footer={sairDaConta}>
        <div className="grid h-12 w-12 place-items-center rounded-full bg-fog text-muted"><ShieldOff /></div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Escolha a empresa" subtitle="Com qual empresa você vai trabalhar agora?" footer={sairDaConta}>
      <ul className="space-y-3">
        {empresas.map((e) => (
          <li key={e.id}>
            <button
              type="button" onClick={() => entrar(e.id)}
              className={`card flex w-full items-center gap-3 px-4 py-4 text-left transition hover:border-brand hover:shadow-sm ${ultima === e.id ? 'border-brand' : ''}`}
            >
              <LogoEmpresa empresa={e} />
              <span className="flex-1">
                <strong className="block font-title text-base font-semibold">{e.nome}</strong>
                <span className="text-xs text-muted">
                  {[!e.ativa && 'Inativa', ultima === e.id && 'Última usada'].filter(Boolean).join(' · ')}
                </span>
              </span>
              <ChevronRight size={18} className="text-muted" />
            </button>
          </li>
        ))}
      </ul>
    </AuthShell>
  );
}
