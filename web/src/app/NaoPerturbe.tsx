import { useCallback, useEffect, useState } from 'react';
import { BellOff, Plus, Trash2 } from 'lucide-react';
import { Alert, EmptyState, Spinner } from '../components/ui';
import SettingsTabs from './SettingsTabs';
import { errorMessage, supabase } from '../lib/supabase';
import { useSession } from '../lib/session';
import { usePode } from '../lib/permissao';

interface Bloqueio { id: string; telefone: string | null; client_id: string | null; motivo: string | null; criado_em: string }

/** Lista de quem não recebe mensagem de nenhuma automação (opt-out). O banco confere antes de agendar. */
export default function NaoPerturbe() {
  const { session } = useSession();
  const { podeEditar } = usePode('nao_perturbe');
  const [itens, setItens] = useState<Bloqueio[]>([]);
  const [loading, setLoading] = useState(true);
  const [telefone, setTelefone] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.from('nao_perturbe').select('*').order('criado_em', { ascending: false });
    setItens((data as Bloqueio[]) ?? []); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function adicionar() {
    setErro('');
    const d = telefone.replace(/\D/g, '');
    if (d.length < 10) return setErro('Informe o telefone com DDD.');
    const e164 = '+' + (d.length <= 11 ? '55' + d : d);
    const { error } = await supabase.from('nao_perturbe').insert({ telefone: e164, motivo: motivo || null, criado_por: session?.user.id });
    if (error) return setErro(errorMessage(error));
    setTelefone(''); setMotivo(''); load();
  }

  async function remover(b: Bloqueio) {
    if (!confirm(`Voltar a enviar mensagens para ${b.telefone ?? 'este cliente'}?`)) return;
    await supabase.from('nao_perturbe').delete().eq('id', b.id);
    load();
  }

  return (
    <div className="space-y-6">
      <SettingsTabs />

      {podeEditar && (
        <section className="card p-5">
          <h2 className="font-semibold">Adicionar número</h2>
          <p className="mt-1 text-sm text-muted">Quem está nesta lista não recebe nada de nenhuma automação. Os eventos aparecem nas estatísticas como “Não perturbe”.</p>
          {erro && <div className="mt-3"><Alert>{erro}</Alert></div>}
          <div className="mt-4 flex flex-wrap gap-2">
            <input className="input w-56" placeholder="(11) 99999-9999" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            <input className="input min-w-48 flex-1" placeholder="Motivo (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            <button className="btn-primary" onClick={adicionar}><Plus className="h-4 w-4" />Adicionar</button>
          </div>
        </section>
      )}

      {loading ? <Spinner /> : itens.length === 0 ? (
        <EmptyState icon={<BellOff />} title="Ninguém na lista" text="Adicione quem pediu para não receber mensagens automáticas." />
      ) : (
        <div className="card divide-y divide-line">
          {itens.map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <p className="font-medium tabular-nums">{b.telefone ?? 'Cliente (pelo cadastro)'}</p>
                <p className="text-xs text-muted">{b.motivo ?? 'Sem motivo informado'} · desde {new Date(b.criado_em).toLocaleDateString('pt-BR')}</p>
              </div>
              {podeEditar && <button className="rounded p-1.5 text-danger hover:bg-red-50" title="Remover" onClick={() => remover(b)}><Trash2 className="h-4 w-4" /></button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
