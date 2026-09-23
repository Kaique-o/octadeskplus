import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, KeyRound, Plus } from 'lucide-react';
import { Alert, EmptyState, Modal, Spinner } from '../components/ui';
import SettingsTabs from './SettingsTabs';
import { N8N_WEBHOOK_URL, errorMessage, supabase } from '../lib/supabase';
import { usePode } from '../lib/permissao';

interface ApiKey { id: string; nome: string; prefixo: string; usado_em: string | null; revogada_em: string | null; criado_em: string }

export default function ApiKeys() {
  const { podeEditar: canEdit } = usePode('api');
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [secret, setSecret] = useState('');
  const [copied, setCopied] = useState('');
  const [error, setError] = useState('');
  const endpoint = `${N8N_WEBHOOK_URL}/octaplus/v1/format`;

  const load = useCallback(async () => {
    const { data } = await supabase.from('chaves_api').select('id,nome,prefixo,usado_em,revogada_em,criado_em').order('criado_em', { ascending: false });
    setKeys(data ?? []); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create() {
    setError('');
    const { data, error } = await supabase.rpc('criar_chave_api', { p_nome: name || 'Chave' });
    if (error) return setError(errorMessage(error));
    setSecret((data as { segredo: string }).segredo); setName(''); load();
  }

  async function revoke(k: ApiKey) {
    if (!confirm(`Revogar a chave "${k.nome}"? Integrações que usam esta chave vão parar de funcionar.`)) return;
    await supabase.rpc('revogar_chave_api', { p_id: k.id });
    load();
  }

  const copy = (label: string, value: string) => { navigator.clipboard.writeText(value); setCopied(label); setTimeout(() => setCopied(''), 1500); };
  const curl = `curl -X POST '${endpoint}' \\\n  -H 'Authorization: Bearer br_live_SUA_CHAVE' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"phone":"(11) 98888-7777"}'`;

  return (
    <div className="space-y-6">
      <SettingsTabs />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted">
          Use nossa API para padronizar telefones no formato E.164 antes de gravar no seu sistema.
        </p>
        {canEdit && <button className="btn-primary" onClick={() => { setCreating(true); setSecret(''); }}><Plus className="h-4 w-4" />Nova chave</button>}
      </div>

      <section className="card p-5">
        <h2 className="font-semibold">Requisição de exemplo</h2>
        <p className="text-sm text-muted">cURL pronto para Postman, Insomnia ou terminal</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="chip bg-ink text-white">POST</span>
          <code className="min-w-0 flex-1 truncate text-sm">{endpoint}</code>
          <button className="btn-ghost px-2 py-1.5" onClick={() => copy('endpoint', endpoint)}>{copied === 'endpoint' ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}</button>
        </div>
        <div className="relative mt-3">
          <pre className="overflow-x-auto rounded-lg bg-ink p-4 text-xs text-white/90">{curl}</pre>
          <button className="absolute right-2 top-2 rounded bg-white/10 p-1.5 text-white hover:bg-white/20" onClick={() => copy('curl', curl)}>{copied === 'curl' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button>
        </div>
        <pre className="mt-3 overflow-x-auto rounded-lg border border-line bg-fog p-4 text-xs">{`200 OK\n{ "ok": true, "input": "(11) 98888-7777", "e164": "+5511988887777", "digits": "5511988887777" }`}</pre>
      </section>

      {loading ? <Spinner /> : keys.length === 0 ? (
        <EmptyState icon={<KeyRound />} title="Nenhuma chave criada" text="Crie uma chave para autenticar chamadas à API." />
      ) : (
        <div className="card divide-y divide-line">
          {keys.map((k) => (
            <div key={k.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{k.nome} {k.revogada_em && <span className="chip ml-2 bg-red-100 text-danger">Revogada</span>}</p>
                <p className="text-xs text-muted"><code>{k.prefixo}…</code> · criada em {new Date(k.criado_em).toLocaleDateString('pt-BR')} · {k.usado_em ? `último uso ${new Date(k.usado_em).toLocaleString('pt-BR')}` : 'nunca usada'}</p>
              </div>
              {canEdit && !k.revogada_em && <button className="btn-danger py-2" onClick={() => revoke(k)}>Revogar</button>}
            </div>
          ))}
        </div>
      )}

      <Modal open={creating} title={secret ? 'Chave criada' : 'Nova chave'} onClose={() => setCreating(false)}
        footer={secret ? <button className="btn-primary" onClick={() => setCreating(false)}>Pronto</button>
          : <><button className="btn-ghost" onClick={() => setCreating(false)}>Cancelar</button><button className="btn-primary" onClick={create}>Criar</button></>}>
        {error && <div className="mb-3"><Alert>{error}</Alert></div>}
        {secret ? (
          <div className="space-y-3">
            <Alert kind="warning">Copie agora. Por segurança, esta chave não será exibida novamente.</Alert>
            <div className="flex items-center gap-2 rounded-lg border border-line bg-fog p-2">
              <code className="min-w-0 flex-1 break-all text-xs">{secret}</code>
              <button className="btn-ghost px-2 py-1.5" onClick={() => copy('secret', secret)}>{copied === 'secret' ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}</button>
            </div>
          </div>
        ) : (
          <div><label className="label">Nome</label><input className="input" autoFocus placeholder="Ex.: Integração site" value={name} onChange={(e) => setName(e.target.value)} /></div>
        )}
      </Modal>
    </div>
  );
}
