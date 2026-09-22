import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Building2, ShieldCheck, Trash2 } from 'lucide-react';
import AuthShell from './AuthShell';
import { Alert } from '../components/ui';
import { useEmpresas } from '../lib/empresas';
import { errorMessage } from '../lib/supabase';

/** Módulo adm: cadastro de empresas. Só abre depois do código Konami na escolha de empresa. */
export default function AdmEmpresas() {
  const nav = useNavigate();
  const { empresas, criar, remover, admAtivo, desativarAdm } = useEmpresas();
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');

  if (!admAtivo) return <Navigate to="/empresa" replace />;

  function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(''); setOk('');
    try { const nova = criar(nome); setOk(`Empresa “${nova.nome}” criada.`); setNome(''); } catch (err) { setErro(errorMessage(err)); }
  }

  function sair() { desativarAdm(); nav('/empresa', { replace: true }); }

  return (
    <AuthShell
      title="Módulo adm"
      subtitle="Cadastre as empresas que aparecem na tela de escolha."
      footer={<button type="button" className="font-medium text-brand hover:underline" onClick={sair}>Sair do módulo adm</button>}
    >
      <div className="mb-4 inline-flex items-center gap-1.5 chip bg-brand-soft text-brand"><ShieldCheck size={14} />Código Konami aceito</div>

      <form onSubmit={salvar} className="space-y-4">
        {erro && <Alert>{erro}</Alert>}
        {ok && <Alert kind="success">{ok}</Alert>}
        <div>
          <label className="label" htmlFor="nome-empresa">Nome da nova empresa</label>
          <input id="nome-empresa" className="input" required autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Skyport" />
        </div>
        <button className="btn-primary w-full py-3">Criar empresa</button>
      </form>

      <h2 className="mt-8 mb-3 text-sm font-semibold text-muted">Empresas cadastradas</h2>
      <ul className="space-y-2">
        {empresas.map((e) => (
          <li key={e.id} className="card flex items-center gap-3 px-3 py-2.5">
            <Building2 size={18} strokeWidth={1.8} className="text-brand" />
            <span className="flex-1 text-sm font-medium">{e.nome}</span>
            <button
              type="button" className="rounded p-1.5 text-muted hover:bg-red-50 hover:text-danger disabled:opacity-40"
              disabled={empresas.length <= 1} title={empresas.length <= 1 ? 'Precisa sobrar ao menos uma empresa' : `Remover ${e.nome}`}
              onClick={() => { if (confirm(`Remover a empresa “${e.nome}”?`)) remover(e.id); }}
            >
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>
    </AuthShell>
  );
}
