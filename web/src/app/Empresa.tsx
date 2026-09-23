import { useCallback, useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { Alert, Spinner } from '../components/ui';
import SettingsTabs from './SettingsTabs';
import { errorMessage, supabase } from '../lib/supabase';
import { useSession } from '../lib/session';
import { useEmpresas } from '../lib/empresas';

const FUSOS = [
  { valor: 'America/Sao_Paulo', label: 'Brasília (GMT-3)' },
  { valor: 'America/Manaus', label: 'Manaus (GMT-4)' },
  { valor: 'America/Cuiaba', label: 'Cuiabá (GMT-4)' },
  { valor: 'America/Rio_Branco', label: 'Rio Branco (GMT-5)' },
  { valor: 'America/Noronha', label: 'Fernando de Noronha (GMT-2)' },
];

const soDigitos = (v: string) => v.replace(/\D/g, '');
const mascaraCnpj = (v: string) => soDigitos(v).slice(0, 14)
  .replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
  .replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');

/** Dados da empresa aberta (octaplus.empresas) e o fuso do horário comercial (octaplus.configuracao). */
export default function Empresa() {
  const { podeEditar, eDono } = useSession();
  const { atual, recarregar } = useEmpresas();
  const [form, setForm] = useState({ nome: '', cnpj: '', telefone: '', site: '', fuso: 'America/Sao_Paulo' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!atual) return;
    const { data } = await supabase.from('configuracao').select('fuso').maybeSingle();
    setForm({ nome: atual.nome, cnpj: mascaraCnpj(atual.cnpj ?? ''), telefone: atual.telefone ?? '', site: atual.site ?? '',
      fuso: (data as { fuso: string } | null)?.fuso ?? 'America/Sao_Paulo' });
    setLoading(false);
  }, [atual]);
  useEffect(() => { load(); }, [load]);

  async function salvar() {
    const cnpj = soDigitos(form.cnpj);
    if (cnpj && cnpj.length !== 14) return setAviso({ kind: 'error', text: 'O CNPJ precisa ter 14 dígitos.' });
    if (!form.nome.trim()) return setAviso({ kind: 'error', text: 'Informe o nome da empresa.' });
    setBusy(true);
    const [{ error }, { error: erroFuso }] = await Promise.all([
      supabase.rpc('salvar_empresa', { p: { id: atual!.id, nome: form.nome.trim(), cnpj, telefone: form.telefone.trim(), site: form.site.trim() } }),
      supabase.from('configuracao').update({ fuso: form.fuso, atualizado_em: new Date().toISOString() }).eq('empresa_id', atual!.id),
    ]);
    setBusy(false);
    if (error || erroFuso) return setAviso({ kind: 'error', text: errorMessage(error ?? erroFuso) });
    setAviso({ kind: 'success', text: 'Dados da empresa salvos.' });
    recarregar();
  }

  const campo = (k: keyof typeof form) => ({ value: form[k], disabled: !podeEditar, onChange: (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value }) });

  return (
    <div className="space-y-6">
      <SettingsTabs />
      {loading ? <Spinner /> : (
        <section className="card p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><Building2 className="h-5 w-5" /></div>
            <div>
              <h2 className="font-semibold">Dados da empresa</h2>
              <p className="mt-0.5 text-sm text-muted">O fuso define o horário comercial das regras de envio.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2"><label className="label">Nome da empresa</label><input className="input" placeholder="Ex.: Grupo Skytech" {...campo('nome')} disabled={!eDono} title={eDono ? undefined : 'Só o dono da plataforma muda o nome'} /></div>
            <div>
              <label className="label">CNPJ</label>
              <input className="input tabular-nums" placeholder="00.000.000/0000-00" inputMode="numeric" value={form.cnpj} disabled={!podeEditar}
                onChange={(e) => setForm({ ...form, cnpj: mascaraCnpj(e.target.value) })} />
            </div>
            <div><label className="label">Telefone</label><input className="input" placeholder="(11) 99999-9999" {...campo('telefone')} /></div>
            <div><label className="label">Site</label><input className="input" placeholder="https://" {...campo('site')} /></div>
            <div>
              <label className="label">Fuso horário</label>
              <select className="input" {...campo('fuso')}>
                {FUSOS.map((f) => <option key={f.valor} value={f.valor}>{f.label}</option>)}
              </select>
            </div>
          </div>
          {aviso && <div className="mt-4"><Alert kind={aviso.kind}>{aviso.text}</Alert></div>}
          {podeEditar && <div className="mt-4 flex justify-end"><button className="btn-primary" onClick={salvar} disabled={busy}>{busy ? <Spinner /> : 'Salvar empresa'}</button></div>}
        </section>
      )}
    </div>
  );
}
