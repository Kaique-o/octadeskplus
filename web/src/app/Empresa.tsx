import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { Alert, Spinner } from '../components/ui';
import SettingsTabs from './SettingsTabs';
import CamposEmpresa, { dadosIniciais, paraSalvar, validarEmpresa, type DadosEmpresa } from './FormEmpresa';
import { errorMessage, supabase } from '../lib/supabase';
import { useSession } from '../lib/session';
import { usePode } from '../lib/permissao';
import { useEmpresas } from '../lib/empresas';

/** Dados da empresa aberta e o fuso do horário comercial — o mesmo formulário da área Owner. */
export default function Empresa() {
  const { eDono } = useSession();
  const { podeEditar } = usePode('empresa');
  const { atual, recarregar } = useEmpresas();
  const [dados, setDados] = useState<DadosEmpresa>(dadosIniciais(atual ?? undefined));
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { if (atual) setDados(dadosIniciais(atual)); }, [atual]);

  async function salvar() {
    const invalido = validarEmpresa(dados);
    if (invalido) return setAviso({ kind: 'error', text: invalido });
    setBusy(true);
    const { error } = await supabase.rpc('salvar_empresa', { p: paraSalvar(dados, atual!.id) });
    setBusy(false);
    if (error) return setAviso({ kind: 'error', text: errorMessage(error) });
    setAviso({ kind: 'success', text: 'Dados da empresa salvos.' });
    recarregar();
  }

  return (
    <div className="space-y-6">
      <SettingsTabs />
      <section className="card p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><Building2 className="h-5 w-5" /></div>
          <div>
            <h2 className="font-semibold">Dados da empresa</h2>
            <p className="mt-0.5 text-sm text-muted">O fuso define o horário comercial das regras de envio.</p>
          </div>
        </div>
        <div className="mt-5">
          <CamposEmpresa dados={dados} onChange={setDados} desabilitado={!podeEditar} nomeBloqueado={!eDono} />
        </div>
        {aviso && <div className="mt-4"><Alert kind={aviso.kind}>{aviso.text}</Alert></div>}
        {podeEditar && <div className="mt-4 flex justify-end"><button className="btn-primary" onClick={salvar} disabled={busy}>{busy ? <Spinner /> : 'Salvar empresa'}</button></div>}
      </section>
    </div>
  );
}
