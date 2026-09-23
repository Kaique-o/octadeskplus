import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronDown, Clock, Copy, KeyRound, Phone, Plus, RefreshCw, Route, Trash2, Webhook } from 'lucide-react';
import { Alert, Spinner, StatusChip, Toggle } from '../components/ui';
import { OctadeskMark } from '../components/LogoOctadesk';
import SettingsTabs from './SettingsTabs';
import { WEEKDAYS } from '../lib/constants';
import { empresaGuardada, errorMessage, supabase, urlWebhookOctadesk } from '../lib/supabase';
import { usePode } from '../lib/permissao';
import type { Configuracao, Grupo, Integracao, MapaFila, Numero, Template } from '../lib/types';

type Aviso = { kind: 'success' | 'error'; text: string } | null;
const quando = (d: string | null) => (d ? new Date(d).toLocaleString('pt-BR') : 'nunca');

/** Card recolhível: o cabeçalho (ícone, título, texto) abre e fecha; `acoes` fica sempre visível ao lado. */
function Secao({ icone, titulo, texto, children, acoes, aberta = true }: {
  icone: React.ReactNode; titulo: string; texto?: string; children: React.ReactNode; acoes?: React.ReactNode; aberta?: boolean;
}) {
  const [aberto, setAberto] = useState(aberta);
  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button type="button" onClick={() => setAberto(!aberto)} aria-expanded={aberto}
          className="group min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 rounded-lg">
          <div className="flex items-center gap-2 text-brand">
            {icone}<h2 className="font-title text-lg font-semibold text-ink">{titulo}</h2>
            <ChevronDown className={`h-5 w-5 text-muted transition-transform group-hover:text-ink ${aberto ? 'rotate-180' : ''}`} />
          </div>
          {texto && <p className="mt-1 max-w-3xl text-sm text-muted">{texto}</p>}
        </button>
        {acoes}
      </div>
      {aberto && <div className="mt-4">{children}</div>}
    </section>
  );
}

function Copiar({ valor }: { valor: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-fog p-2">
      <code className="min-w-0 flex-1 truncate text-xs">{valor}</code>
      <button className="btn-ghost px-2 py-1.5" onClick={() => { navigator.clipboard.writeText(valor); setOk(true); setTimeout(() => setOk(false), 1500); }}>
        {ok ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- Octadesk
function CardOctadesk({ integracao, onMudou }: { integracao: Integracao; onMudou: () => void }) {
  const { podeEditar } = usePode('integracoes');
  const [form, setForm] = useState({
    base_url: integracao.base_url ?? '', agente_email: integracao.agente_email ?? '', subdominio: integracao.subdominio ?? '',
    api_privada_ativa: integracao.api_privada_ativa, api_key: '', usuario: '', senha: '', tenant: '',
  });
  const [salvos, setSalvos] = useState<string[]>([]);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { supabase.rpc('segredos_preenchidos').then(({ data }) => setSalvos((data as string[]) ?? [])); }, [integracao.validado_em]);
  const set = (k: keyof typeof form, v: string | boolean) => setForm({ ...form, [k]: v });
  const temSegredo = (k: string) => salvos.includes(`octadesk_${k}`);
  const segredo = (k: 'api_key' | 'usuario' | 'senha' | 'tenant', label: string, dica: string) => (
    <div>
      <label className="label">{label}</label>
      <input className="input" type={k === 'usuario' ? 'text' : 'password'} autoComplete="off" disabled={!podeEditar}
        placeholder={temSegredo(k) ? '•••••••• salvo (deixe vazio para manter)' : dica}
        value={form[k]} onChange={(e) => set(k, e.target.value)} />
    </div>
  );

  async function salvar() {
    if (!form.base_url || !form.agente_email) return setAviso({ kind: 'error', text: 'Preencha a URL da API e o e-mail do agente.' });
    if (!form.api_key && !temSegredo('api_key')) return setAviso({ kind: 'error', text: 'Informe a chave de API.' });
    setBusy(true); setAviso(null);
    const { error } = await supabase.rpc('salvar_integracao', { p: form });
    setBusy(false);
    if (error) return setAviso({ kind: 'error', text: errorMessage(error) });
    setForm({ ...form, api_key: '', usuario: '', senha: '', tenant: '' });
    setAviso({ kind: 'success', text: 'Salvo. A validação e a sincronização acontecem em até um minuto.' });
    onMudou();
  }

  return (
    <Secao icone={<OctadeskMark className="h-5 w-5" />} titulo="Octadesk" aberta={integracao.status !== 'conectado'}
      texto="API pública do Octadesk (Configuração › Geral › API). A chave fica guardada no servidor e nunca volta para o navegador."
      acoes={<StatusChip status={{ nao_configurado: 'missing', validando: 'checking', conectado: 'connected', erro: 'error' }[integracao.status]} />}>
      <p className="mb-4 text-xs text-muted">Validado: {quando(integracao.validado_em)} · Catálogo sincronizado: {quando(integracao.sincronizado_em)}</p>
      {integracao.ultimo_erro && <div className="mb-4"><Alert>{integracao.ultimo_erro}</Alert></div>}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label">URL da API</label>
          <input className="input" disabled={!podeEditar} placeholder="https://o123456-789.api001.octadesk.services" value={form.base_url} onChange={(e) => set('base_url', e.target.value)} />
        </div>
        <div>
          <label className="label">E-mail do agente da chave</label>
          <input className="input" disabled={!podeEditar} placeholder="Vai no header octa-agent-email" value={form.agente_email} onChange={(e) => set('agente_email', e.target.value)} />
        </div>
        {segredo('api_key', 'Chave de API', 'X-API-KEY (73 caracteres)')}
        <div>
          <label className="label">Subdomínio</label>
          <input className="input" disabled={!podeEditar} placeholder="o123456-789" value={form.subdominio} onChange={(e) => set('subdominio', e.target.value)} />
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-line p-4">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span><b>Transferir conversas para filas</b>
            <span className="block text-muted">Usa a API interna do app do Octadesk, com o login de um usuário. Pode mudar sem aviso — deixe desligado se não for usar.</span></span>
          <Toggle checked={form.api_privada_ativa} disabled={!podeEditar} onChange={(v) => set('api_privada_ativa', v)} />
        </label>
        {form.api_privada_ativa && (
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {segredo('usuario', 'Usuário (e-mail)', 'login do Octadesk')}
            {segredo('senha', 'Senha', 'senha do Octadesk')}
            {segredo('tenant', 'Tenant ID', 'uuid da conta')}
          </div>
        )}
      </div>

      {aviso && <div className="mt-4"><Alert kind={aviso.kind}>{aviso.text}</Alert></div>}
      {podeEditar && (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button className="btn-ghost" onClick={async () => { await supabase.rpc('pedir_sincronizacao'); onMudou(); setAviso({ kind: 'success', text: 'Sincronização pedida.' }); }}>
            <RefreshCw className="h-4 w-4" />Sincronizar catálogo
          </button>
          <button className="btn-primary" onClick={salvar} disabled={busy}>{busy ? <Spinner /> : 'Salvar e validar'}</button>
        </div>
      )}
    </Secao>
  );
}

// ---------------------------------------------------------------- números, templates e filas
function Catalogo({ config, onConfig }: { config: Configuracao; onConfig: () => void }) {
  const { podeEditar } = usePode('integracoes');
  const [numeros, setNumeros] = useState<Numero[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [mapa, setMapa] = useState<MapaFila[]>([]);
  const [novoTipo, setNovoTipo] = useState('');

  const load = useCallback(async () => {
    const [n, t, g, m] = await Promise.all([
      supabase.from('octa_numeros').select('*').eq('ativo', true).order('numero'),
      supabase.from('octa_templates').select('*').order('nome'),
      supabase.from('octa_grupos').select('*').order('nome'),
      supabase.from('mapa_filas').select('*').order('tipo_entrega'),
    ]);
    setNumeros((n.data as Numero[]) ?? []); setTemplates((t.data as Template[]) ?? []);
    setGrupos((g.data as Grupo[]) ?? []); setMapa((m.data as MapaFila[]) ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const rotular = async (n: Numero, rotulo: string) => { await supabase.from('octa_numeros').update({ rotulo }).eq('id', n.id); };
  const padrao = async (numero: string) => { await supabase.from('configuracao').update({ numero_envio_padrao: numero }).eq('empresa_id', empresaGuardada()!); onConfig(); };
  const mapear = async (tipo: string, grupo_id: string) => { await supabase.from('mapa_filas').upsert({ tipo_entrega: tipo, grupo_id }, { onConflict: 'empresa_id,tipo_entrega' }); load(); };
  const tirar = async (tipo: string) => { await supabase.from('mapa_filas').delete().eq('tipo_entrega', tipo); load(); };

  return (
    <>
      <Secao icone={<Phone className="h-5 w-5" />} titulo="Números de envio"
        texto="Vêm do Octadesk (/chat/numbers). O rótulo é o nome que aparece ao montar uma automação; o padrão é usado quando a ação não escolhe.">
        {numeros.length === 0 ? <p className="text-sm text-muted">Nenhum número sincronizado ainda.</p> : (
          <div className="divide-y divide-line">
            {numeros.map((n) => (
              <div key={n.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <span className="w-40 font-medium tabular-nums">{n.numero}</span>
                <input className="input w-56 py-1.5" disabled={!podeEditar} defaultValue={n.rotulo ?? n.nome ?? ''} placeholder="Rótulo"
                  onBlur={(e) => rotular(n, e.target.value)} />
                <label className="ml-auto flex items-center gap-2 text-muted">
                  <input type="radio" name="padrao" className="accent-brand" disabled={!podeEditar}
                    checked={config.numero_envio_padrao === n.numero} onChange={() => padrao(n.numero)} />Padrão
                </label>
              </div>
            ))}
          </div>
        )}
      </Secao>

      <Secao icone={<KeyRound className="h-5 w-5" />} titulo={`Templates aprovados (${templates.length})`}
        texto="Só templates aprovados pela Meta aparecem aqui. As variáveis são as chaves que a automação preenche com dados do cliente.">
        {templates.length === 0 ? <p className="text-sm text-muted">Nenhum template sincronizado ainda.</p> : (
          <div className="grid gap-3 md:grid-cols-2">
            {templates.map((t) => (
              <div key={t.id} className="rounded-lg border border-line p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{t.nome}</p>
                  {t.categoria && <span className="chip bg-fog text-muted">{t.categoria}</span>}
                </div>
                {t.corpo && <p className="mt-2 whitespace-pre-wrap text-muted">{t.corpo}</p>}
                {t.variaveis.length > 0 && <p className="mt-2 text-xs text-muted">Variáveis: {t.variaveis.map((v) => <code key={v} className="mr-1">{v}</code>)}</p>}
              </div>
            ))}
          </div>
        )}
      </Secao>

      <Secao icone={<Route className="h-5 w-5" />} titulo="Mapa de filas"
        texto="Para a ação “Transferir para fila”: o tipo de entrega do contato no Octadesk decide a fila. A linha * vale para quem não bate com nenhuma outra.">
        <div className="divide-y divide-line">
          {mapa.map((m) => (
            <div key={m.tipo_entrega} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
              <span className="w-40 font-medium">{m.tipo_entrega === '*' ? 'Qualquer outro (*)' : m.tipo_entrega}</span>
              <select className="input w-72 py-1.5" disabled={!podeEditar} value={m.grupo_id ?? ''} onChange={(e) => mapear(m.tipo_entrega, e.target.value)}>
                <option value="">Selecione a fila</option>
                {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
              </select>
              {podeEditar && <button className="rounded p-1 text-danger hover:bg-red-50" title="Remover" onClick={() => tirar(m.tipo_entrega)}><Trash2 className="h-4 w-4" /></button>}
            </div>
          ))}
        </div>
        {podeEditar && (
          <div className="mt-3 flex gap-2">
            <input className="input w-56 py-1.5" placeholder="Tipo de entrega (ex.: SEDEX)" value={novoTipo} onChange={(e) => setNovoTipo(e.target.value.toUpperCase())} />
            <button className="btn-ghost py-1.5" disabled={!novoTipo} onClick={() => { mapear(novoTipo, ''); setNovoTipo(''); }}><Plus className="h-4 w-4" />Adicionar</button>
          </div>
        )}
      </Secao>
    </>
  );
}

// ---------------------------------------------------------------- regras de envio
interface Janela { start: string; end: string }
interface Dia { enabled: boolean; windows: Janela[] }
const JANELA_PADRAO: Janela = { start: '08:00', end: '18:00' };

function RegrasEnvio({ config, onSalvo }: { config: Configuracao; onSalvo: () => void }) {
  const { podeEditar } = usePode('integracoes');
  const [dias, setDias] = useState<Record<string, Dia>>(config.horario_comercial?.perDay ?? {});
  const [limite, setLimite] = useState(config.limite_contato_horas);
  const [emails, setEmails] = useState((config.emails_alerta ?? []).join('; '));
  const [aviso, setAviso] = useState<Aviso>(null);
  const [busy, setBusy] = useState(false);

  async function salvar() {
    for (const [d, dia] of Object.entries(dias)) {
      if (!dia.enabled) continue;
      const nome = WEEKDAYS.find((w) => w.key === d)?.label;
      if (!dia.windows.length) return setAviso({ kind: 'error', text: `${nome}: adicione um intervalo ou desative o dia.` });
      const ord = [...dia.windows].sort((a, b) => a.start.localeCompare(b.start));
      for (const [i, w] of ord.entries()) {
        if (w.start >= w.end) return setAviso({ kind: 'error', text: `${nome}: o início precisa ser antes do fim.` });
        if (i > 0 && w.start < ord[i - 1].end) return setAviso({ kind: 'error', text: `${nome}: os intervalos não podem se sobrepor.` });
      }
    }
    setBusy(true);
    const { error } = await supabase.from('configuracao').update({
      horario_comercial: { perDay: dias }, limite_contato_horas: limite, atualizado_em: new Date().toISOString(),
      emails_alerta: emails.split(/[;,\s]+/).map((e) => e.trim()).filter(Boolean),
    }).eq('empresa_id', empresaGuardada()!);
    setBusy(false);
    setAviso(error ? { kind: 'error', text: errorMessage(error) } : { kind: 'success', text: 'Regras de envio salvas.' });
    if (!error) onSalvo();
  }

  return (
    <Secao icone={<Clock className="h-5 w-5" />} titulo="Regras de envio"
      texto="Mensagens fora do horário comercial (Brasília) são adiadas para a próxima janela. O limite de contato vale somando todas as automações.">
      <div className="divide-y divide-line">
        {WEEKDAYS.map(({ key, label }) => {
          const dia = dias[key] ?? { enabled: false, windows: [JANELA_PADRAO] };
          const setDia = (p: Partial<Dia>) => setDias({ ...dias, [key]: { ...dia, ...p } });
          const setJanela = (i: number, p: Partial<Janela>) => setDia({ windows: dia.windows.map((w, j) => (j === i ? { ...w, ...p } : w)) });
          return (
            <div key={key} className="flex flex-wrap items-start gap-3 py-3">
              <Toggle checked={dia.enabled} disabled={!podeEditar} onChange={(on) => setDia({ enabled: on, windows: dia.windows.length ? dia.windows : [JANELA_PADRAO] })} />
              <span className="w-24 pt-1 text-sm font-medium">{label}</span>
              {dia.enabled ? (
                <div className="space-y-2">
                  {dia.windows.map((w, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <input type="time" className="input w-32 py-1.5" value={w.start} disabled={!podeEditar} onChange={(e) => setJanela(i, { start: e.target.value })} />
                      <span className="text-muted">até</span>
                      <input type="time" className="input w-32 py-1.5" value={w.end} disabled={!podeEditar} onChange={(e) => setJanela(i, { end: e.target.value })} />
                      {podeEditar && dia.windows.length > 1 && (
                        <button className="rounded p-1 text-danger hover:bg-red-50" title="Remover intervalo" onClick={() => setDia({ windows: dia.windows.filter((_, j) => j !== i) })}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {podeEditar && (
                    <button className="text-xs font-medium text-brand hover:underline" onClick={() => setDia({ windows: [...dia.windows, { start: '13:00', end: '18:00' }] })}>
                      + Intervalo (ex.: depois do almoço)
                    </button>
                  )}
                </div>
              ) : <span className="pt-1 text-sm text-muted">Fechado</span>}
            </div>
          );
        })}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className="label">Limite de contato por cliente</label>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">No máximo 1 mensagem a cada</span>
            <input type="number" min={0} className="input w-24 py-1.5" disabled={!podeEditar} value={limite} onChange={(e) => setLimite(Number(e.target.value))} />
            <span className="text-muted">horas (0 desliga)</span>
          </div>
        </div>
        <div>
          <label className="label">E-mails para alertas de erro</label>
          <input className="input" placeholder="email1@empresa.com; email2@empresa.com" value={emails} disabled={!podeEditar} onChange={(e) => setEmails(e.target.value)} />
        </div>
      </div>
      {aviso && <div className="mt-4"><Alert kind={aviso.kind}>{aviso.text}</Alert></div>}
      {podeEditar && <div className="mt-4 flex justify-end"><button className="btn-primary" onClick={salvar} disabled={busy}>{busy ? <Spinner /> : 'Salvar regras'}</button></div>}
    </Secao>
  );
}

// ---------------------------------------------------------------- tela
export default function Integrations() {
  const [integracao, setIntegracao] = useState<Integracao | null>(null);
  const [config, setConfig] = useState<Configuracao | null>(null);

  const load = useCallback(async () => {
    const [{ data: i }, { data: c }] = await Promise.all([
      supabase.from('integracao_octadesk').select('*').maybeSingle(),
      supabase.from('configuracao').select('*').maybeSingle(),
    ]);
    setIntegracao(i as Integracao); setConfig(c as Configuracao);
  }, []);
  useEffect(() => { load(); }, [load]);

  // enquanto o n8n valida, olha de novo a cada 5s
  useEffect(() => {
    if (integracao?.status !== 'validando') return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [integracao?.status, load]);

  return (
    <div className="space-y-6">
      <SettingsTabs />
      {!integracao || !config ? <Spinner /> : (
        <>
          <CardOctadesk key={integracao.validado_em ?? 'novo'} integracao={integracao} onMudou={load} />
          <Secao icone={<Webhook className="h-5 w-5" />} titulo="Eventos de conversa do Octadesk"
            texto="Para as automações de conversa (encerrada, atribuída, nova mensagem), cadastre esta URL nos webhooks da conta do Octadesk. O segredo no caminho substitui a assinatura, que o Octadesk não envia.">
            <Copiar valor={urlWebhookOctadesk(integracao.segredo_webhook)} />
            <p className="mt-2 text-xs text-muted">Eventos usados: room.after-close, room.after-set-agent e room.after-insert-message.</p>
          </Secao>
          <Catalogo config={config} onConfig={load} />
          <RegrasEnvio key={config.limite_contato_horas} config={config} onSalvo={load} />
        </>
      )}
    </div>
  );
}
