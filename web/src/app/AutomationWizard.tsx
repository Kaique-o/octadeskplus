import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, ChevronDown, ChevronUp, Copy, Plus, RefreshCw, Trash2, Webhook } from 'lucide-react';
import { Alert, OptionCard, Spinner, Toggle } from '../components/ui';
import { ACOES, CAMPOS_CLIENTE, FONTES, GATILHOS, OPERADORES, POLITICAS_CONVERSA, UNIDADES, type Parametro } from '../lib/constants';
import { errorMessage, supabase, urlWebhookExterno } from '../lib/supabase';
import { usePode } from '../lib/permissao';
import type { Acao, Automacao, Condicao, Fonte, Gatilho, Grupo, Numero, Tag, Template, TipoAcao, Unidade } from '../lib/types';

interface Campo { key: string; label: string }

const VAZIA: Automacao = {
  nome: '', ativa: false, fonte: 'metrics', gatilho: 'orcamento_sem_compra', parametros: { dias: 1 },
  condicoes: { ativas: false, modo: 'todas', lista: [] }, respeitar_horario: true, atraso_valor: 0, atraso_unidade: 'minutos',
};

const novaAcao = (tipo: TipoAcao = 'enviar_template'): Acao => ({
  tipo, espera_valor: 0, espera_unidade: 'minutos',
  config: tipo === 'enviar_template' ? { variaveis: {}, conversa_aberta: 'nao_fazer_nada', atribuir_automatico: true }
        : tipo === 'transferir_fila' ? { usar_mapa_filas: true } : {},
});

const parametrosPadrao = (g: Gatilho) =>
  Object.fromEntries(GATILHOS[g].parametros.filter((p) => p.padrao !== undefined).map((p) => [p.chave, p.padrao]));

/** Achata um JSON em caminhos "a.b.0.c" (payload de exemplo do webhook) */
function achatar(obj: unknown, prefixo = '', out: Campo[] = []): Campo[] {
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const p = prefixo ? `${prefixo}.${k}` : k;
      if (v && typeof v === 'object') achatar(v, p, out); else out.push({ key: p, label: `${p} = ${String(v).slice(0, 40)}` });
    }
  }
  return out;
}

function Passo({ n, titulo, sub, children }: { n: number; titulo: string; sub?: string; children: ReactNode }) {
  return (
    <section className="card p-5">
      <div className="flex gap-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white">{n}</span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{titulo}</h2>
          {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </section>
  );
}

function CampoLivre({ campos, valor, onChange, placeholder = 'Selecione ou digite um campo' }: { campos: Campo[]; valor?: string; onChange: (v: string) => void; placeholder?: string }) {
  const id = useMemo(() => `c-${Math.random().toString(36).slice(2)}`, []);
  return (
    <>
      <input className="input" list={id} value={valor ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      <datalist id={id}>{campos.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</datalist>
    </>
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

function EditorParametro({ p, valor, onChange }: { p: Parametro; valor: unknown; onChange: (v: unknown) => void }) {
  if (p.tipo === 'numero') {
    return <input type="number" min={0} className="input w-40" value={Number(valor ?? p.padrao ?? 0)} onChange={(e) => onChange(Number(e.target.value))} />;
  }
  if (p.tipo === 'texto') {
    return (
      <select className="input w-56" value={String(valor ?? '')} onChange={(e) => onChange(e.target.value)}>
        <option value="">Qualquer</option>
        {p.opcoes?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  const lista = (valor as string[]) ?? [];
  return (
    <div className="flex flex-wrap gap-2">
      {p.opcoes?.map((o) => {
        const on = lista.includes(o.value);
        return (
          <button key={o.value} type="button" onClick={() => onChange(on ? lista.filter((x) => x !== o.value) : [...lista, o.value])}
            className={`chip border ${on ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-white'}`}>
            {on && <Check className="h-3 w-3" />}{o.label}
          </button>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
function EditorAcao({ i, total, acao, campos, catalogo, apiPrivada, onChange, onRemover, onMover }: {
  i: number; total: number; acao: Acao; campos: Campo[]; apiPrivada: boolean;
  catalogo: { numeros: Numero[]; templates: Template[]; grupos: Grupo[]; tags: Tag[] };
  onChange: (a: Acao) => void; onRemover: () => void; onMover: (d: -1 | 1) => void;
}) {
  const cfg = acao.config;
  const set = (p: Partial<Acao['config']>) => onChange({ ...acao, config: { ...cfg, ...p } });
  const template = catalogo.templates.find((t) => t.id === cfg.template_id);
  const camposVariavel = campos.map((c) => ({ ...c, key: `{{${c.key}}}` }));

  return (
    <div className="rounded-lg border border-line">
      <div className="flex items-center justify-between border-b border-line bg-fog px-4 py-2.5">
        <p className="text-sm font-semibold">Ação {i + 1} · {ACOES[acao.tipo].label}</p>
        <div className="flex gap-1">
          <button className="rounded p-1 hover:bg-white disabled:opacity-30" disabled={i === 0} onClick={() => onMover(-1)} title="Subir"><ChevronUp className="h-4 w-4" /></button>
          <button className="rounded p-1 hover:bg-white disabled:opacity-30" disabled={i === total - 1} onClick={() => onMover(1)} title="Descer"><ChevronDown className="h-4 w-4" /></button>
          <button className="rounded p-1 text-danger hover:bg-white" onClick={onRemover} title="Remover"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="space-y-5 p-4">
        <div>
          <p className="label">O que fazer?</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(ACOES) as TipoAcao[]).map((t) => (
              <OptionCard key={t} title={ACOES[t].label} selected={acao.tipo === t}
                subtitle={ACOES[t].privada && !apiPrivada ? 'Ligue a API privada em Configurações' : ACOES[t].precisaConversa ? 'Precisa de uma conversa' : undefined}
                onClick={() => onChange({ ...novaAcao(t), espera_valor: acao.espera_valor, espera_unidade: acao.espera_unidade })} />
            ))}
          </div>
        </div>

        {i > 0 && (
          <div>
            <p className="label">Espera depois da ação anterior</p>
            <div className="flex gap-2">
              <input type="number" min={0} className="input w-28" value={acao.espera_valor} onChange={(e) => onChange({ ...acao, espera_valor: Number(e.target.value) })} />
              <select className="input w-40" value={acao.espera_unidade} onChange={(e) => onChange({ ...acao, espera_unidade: e.target.value as Unidade })}>
                {UNIDADES.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
          </div>
        )}

        {acao.tipo === 'enviar_template' && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="label">De qual número?</p>
                <select className="input" value={cfg.numero ?? ''} onChange={(e) => set({ numero: e.target.value || undefined })}>
                  <option value="">Número padrão das configurações</option>
                  {catalogo.numeros.map((n) => <option key={n.id} value={n.numero}>{n.rotulo || n.nome} ({n.numero})</option>)}
                </select>
              </div>
              <div>
                <p className="label">Qual template?</p>
                <select className="input" value={cfg.template_id ?? ''} onChange={(e) => {
                  const t = catalogo.templates.find((x) => x.id === e.target.value);
                  set({ template_id: e.target.value, variaveis: Object.fromEntries((t?.variaveis ?? []).map((v) => [v, cfg.variaveis?.[v] ?? ''])) });
                }}>
                  <option value="">Selecione</option>
                  {catalogo.templates.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>
            </div>
            {template?.corpo && <p className="whitespace-pre-wrap rounded-lg border border-green-200 bg-green-50 p-3 text-sm">{template.corpo}</p>}
            {template && template.variaveis.length > 0 && (
              <div>
                <p className="label">Variáveis do template</p>
                <p className="mb-2 text-xs text-muted">Texto fixo e/ou dados do evento entre chaves — ex.: <code>{'{{cliente.primeiro_nome}}'}</code></p>
                <div className="space-y-2">
                  {template.variaveis.map((v) => (
                    <div key={v} className="grid items-center gap-2 sm:grid-cols-[160px_1fr]">
                      <code className="text-sm text-muted">{v}</code>
                      <CampoLivre campos={camposVariavel} valor={cfg.variaveis?.[v]} placeholder="Texto ou {{campo}}"
                        onChange={(x) => set({ variaveis: { ...cfg.variaveis, [v]: x } })} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="label">E se o cliente já tiver uma conversa aberta?</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {POLITICAS_CONVERSA.map((p) => <OptionCard key={p.value} title={p.label} selected={(cfg.conversa_aberta ?? 'nao_fazer_nada') === p.value} onClick={() => set({ conversa_aberta: p.value })} />)}
              </div>
            </div>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span><b>Atribuir automaticamente</b><span className="block text-muted">A conversa nova entra na distribuição do Octadesk.</span></span>
              <Toggle checked={cfg.atribuir_automatico !== false} onChange={(v) => set({ atribuir_automatico: v })} />
            </label>
          </>
        )}

        {(acao.tipo === 'enviar_mensagem' || acao.tipo === 'nota_interna') && (
          <div>
            <p className="label">{acao.tipo === 'nota_interna' ? 'Texto da nota (só a equipe vê)' : 'Mensagem'}</p>
            <textarea className="input min-h-24" value={cfg.texto ?? ''} onChange={(e) => set({ texto: e.target.value })}
              placeholder="Ex.: Cliente {{cliente.nome}}, curva {{cliente.curva}}, sem comprar há {{cliente.dias_sem_compra}} dias." />
            {acao.tipo === 'enviar_mensagem' && <p className="mt-1 text-xs text-muted">Só vai se a janela de 24h do WhatsApp estiver aberta; fora dela, use um template.</p>}
          </div>
        )}

        {acao.tipo === 'aplicar_tags' && (
          <div>
            <p className="label">Tags</p>
            <div className="flex flex-wrap gap-2">
              {catalogo.tags.map((t) => {
                const on = (cfg.tags ?? []).some((x) => x.id === t.id);
                return (
                  <button key={t.id} type="button" onClick={() => set({ tags: on ? cfg.tags!.filter((x) => x.id !== t.id) : [...(cfg.tags ?? []), { id: t.id, nome: t.nome }] })}
                    className={`chip border ${on ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-white'}`}>{on && <Check className="h-3 w-3" />}{t.nome}</button>
                );
              })}
            </div>
          </div>
        )}

        {acao.tipo === 'campo_conversa' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div><p className="label">ID do campo</p><input className="input" placeholder="customField.nome_do_campo" value={cfg.campo_id ?? ''} onChange={(e) => set({ campo_id: e.target.value })} /></div>
            <div><p className="label">Título</p><input className="input" value={cfg.titulo ?? ''} onChange={(e) => set({ titulo: e.target.value })} /></div>
            <div>
              <p className="label">Tipo</p>
              <select className="input" value={cfg.tipo ?? 'string'} onChange={(e) => set({ tipo: e.target.value as 'string' })}>
                <option value="string">Texto</option><option value="number">Número</option><option value="boolean">Sim/Não</option>
              </select>
            </div>
            <div><p className="label">Valor</p><CampoLivre campos={camposVariavel} valor={cfg.valor} placeholder="Texto ou {{campo}}" onChange={(x) => set({ valor: x })} /></div>
          </div>
        )}

        {acao.tipo === 'transferir_fila' && (
          <div className="space-y-3">
            {!apiPrivada && <Alert kind="warning">A transferência usa a API privada do Octadesk. Ligue em Configurações › Integrações.</Alert>}
            <label className="flex items-center gap-3 text-sm">
              <Toggle checked={cfg.usar_mapa_filas !== false} onChange={(v) => set({ usar_mapa_filas: v, grupo_id: v ? undefined : cfg.grupo_id })} />
              Usar o mapa de filas (pelo tipo de entrega do cliente)
            </label>
            {cfg.usar_mapa_filas === false && (
              <select className="input w-72" value={cfg.grupo_id ?? ''} onChange={(e) => set({ grupo_id: e.target.value })}>
                <option value="">Selecione a fila</option>
                {catalogo.grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
              </select>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
export default function AutomationWizard() {
  const { id } = useParams();
  const nav = useNavigate();
  const { podeEditar } = usePode('automacoes');
  const [a, setA] = useState<Automacao>(VAZIA);
  const [acoes, setAcoes] = useState<Acao[]>([novaAcao()]);
  const [catalogo, setCatalogo] = useState({ numeros: [] as Numero[], templates: [] as Template[], grupos: [] as Grupo[], tags: [] as Tag[] });
  const [apiPrivada, setApiPrivada] = useState(false);
  const [loading, setLoading] = useState(Boolean(id));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async (aid: string) => {
    const { data } = await supabase.from('automacoes').select('*, automacao_acoes(*)').eq('id', aid).maybeSingle();
    if (!data) { setErro('Automação não encontrada.'); setLoading(false); return; }
    const { automacao_acoes, ...resto } = data as Automacao;
    setA({ ...VAZIA, ...resto, condicoes: { ...VAZIA.condicoes, ...resto.condicoes } });
    const lista = [...(automacao_acoes ?? [])].sort((x, y) => (x.posicao ?? 0) - (y.posicao ?? 0));
    setAcoes(lista.length ? lista : [novaAcao()]);
    setLoading(false);
  }, []);

  useEffect(() => {
    Promise.all([
      supabase.from('octa_numeros').select('*').eq('ativo', true),
      supabase.from('octa_templates').select('*').order('nome'),
      supabase.from('octa_grupos').select('*').order('nome'),
      supabase.from('octa_tags').select('*').order('nome'),
      supabase.from('integracao_octadesk').select('api_privada_ativa').maybeSingle(),
    ]).then(([n, t, g, tg, i]) => {
      setCatalogo({ numeros: (n.data as Numero[]) ?? [], templates: (t.data as Template[]) ?? [], grupos: (g.data as Grupo[]) ?? [], tags: (tg.data as Tag[]) ?? [] });
      setApiPrivada(Boolean((i.data as { api_privada_ativa?: boolean } | null)?.api_privada_ativa));
    });
  }, []);
  useEffect(() => { if (id) carregar(id); }, [id, carregar]);

  const def = GATILHOS[a.gatilho];
  const campos: Campo[] = useMemo(() => [
    ...CAMPOS_CLIENTE,
    ...def.campos.map((k) => ({ key: k, label: k.replace('evento.', '').replace(/[._]/g, ' ') })),
    ...(a.fonte === 'webhook' ? achatar(a.payload_exemplo ?? {}, 'evento') : []),
  ], [def, a.fonte, a.payload_exemplo]);

  const setCond = (patch: Partial<Automacao['condicoes']>) => setA((x) => ({ ...x, condicoes: { ...x.condicoes, ...patch } }));
  const lista = a.condicoes.lista ?? [];

  function payload(ativa = a.ativa) {
    return {
      id: a.id ?? null, nome: a.nome.trim(), ativa, fonte: a.fonte, gatilho: a.gatilho, parametros: a.parametros, condicoes: a.condicoes,
      respeitar_horario: a.respeitar_horario, atraso_valor: a.atraso_valor, atraso_unidade: a.atraso_unidade, campo_telefone: a.campo_telefone ?? '',
      acoes: acoes.map(({ tipo, config, espera_valor, espera_unidade }) => ({ tipo, config, espera_valor, espera_unidade })),
    };
  }

  function validar(): string | null {
    if (!a.nome.trim()) return 'Dê um nome para a automação.';
    if (a.gatilho === 'conversa_classificada' && !((a.parametros.etapas as string[]) ?? []).length) return 'Escolha pelo menos uma etapa.';
    if (!acoes.length) return 'Adicione pelo menos uma ação.';
    for (const [i, x] of acoes.entries()) {
      if (x.tipo === 'enviar_template' && !x.config.template_id) return `Ação ${i + 1}: escolha o template.`;
      if ((x.tipo === 'enviar_mensagem' || x.tipo === 'nota_interna') && !x.config.texto?.trim()) return `Ação ${i + 1}: escreva o texto.`;
      if (x.tipo === 'transferir_fila' && x.config.usar_mapa_filas === false && !x.config.grupo_id) return `Ação ${i + 1}: escolha a fila.`;
    }
    return null;
  }

  async function salvar(rascunho = false) {
    const problema = rascunho ? (a.nome.trim() ? null : 'Dê um nome para a automação.') : validar();
    if (problema) { setErro(problema); window.scrollTo({ top: 0, behavior: 'smooth' }); return null; }
    setSalvando(true); setErro('');
    const { data, error } = await supabase.rpc('salvar_automacao', { p: payload(rascunho ? false : a.ativa) });
    setSalvando(false);
    if (error) { setErro(errorMessage(error)); return null; }
    return data as string;
  }

  if (loading) return <Spinner />;
  let n = 0;

  return (
    <div className="space-y-4 pb-24">
      <Link to="/app/automacoes" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />Automações</Link>
      <h1 className="font-title text-2xl font-semibold">{id ? 'Editar automação' : 'Nova automação'}</h1>
      {erro && <Alert>{erro}</Alert>}

      <Passo n={++n} titulo="Nome" sub="Para reconhecer esta automação na lista.">
        <input className="input" placeholder="Ex.: Orçamentos de ontem que não fecharam" value={a.nome} onChange={(e) => setA({ ...a, nome: e.target.value })} />
      </Passo>

      <Passo n={++n} titulo="De onde vem o gatilho?">
        <div className="grid gap-2 sm:grid-cols-3">
          {FONTES.map((f) => (
            <OptionCard key={f.value} title={f.label} subtitle={f.descricao} selected={a.fonte === f.value}
              onClick={() => {
                const primeiro = (Object.keys(GATILHOS) as Gatilho[]).find((g) => GATILHOS[g].fonte === f.value)!;
                setA({ ...a, fonte: f.value as Fonte, gatilho: primeiro, parametros: parametrosPadrao(primeiro) });
              }} />
          ))}
        </div>
      </Passo>

      {a.fonte !== 'webhook' && (
        <Passo n={++n} titulo="Qual gatilho?" sub={def.descricao}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(GATILHOS) as Gatilho[]).filter((g) => GATILHOS[g].fonte === a.fonte).map((g) => (
              <OptionCard key={g} title={GATILHOS[g].label} selected={a.gatilho === g} onClick={() => setA({ ...a, gatilho: g, parametros: parametrosPadrao(g) })} />
            ))}
          </div>
          {def.parametros.length > 0 && (
            <div className="mt-5 space-y-4 border-t border-line pt-4">
              {def.parametros.map((p) => (
                <div key={p.chave}>
                  <p className="label">{p.label}</p>
                  <EditorParametro p={p} valor={a.parametros[p.chave]} onChange={(v) => setA({ ...a, parametros: { ...a.parametros, [p.chave]: v } })} />
                </div>
              ))}
            </div>
          )}
          {a.fonte === 'octadesk' && <p className="mt-4 text-xs text-muted">Precisa da URL de eventos cadastrada no Octadesk (Configurações › Integrações).</p>}
        </Passo>
      )}

      {a.fonte === 'webhook' && (
        <Passo n={++n} titulo="Endereço do webhook" sub="POST com JSON e o segredo no header X-Bridge-Secret (mesmo contrato do Bridge — basta trocar a URL nas campanhas do metrics).">
          {!a.id ? (
            <button className="btn-primary" disabled={salvando} onClick={async () => { const nova = await salvar(true); if (nova) nav(`/app/automacoes/${nova}`, { replace: true }); }}>
              <Webhook className="h-4 w-4" />Gerar URL do webhook
            </button>
          ) : (
            <div className="space-y-3">
              <Copiar valor={urlWebhookExterno(a.id, a.segredo_webhook!)} />
              <div className="flex flex-wrap items-center gap-3">
                <button className="btn-ghost" onClick={() => carregar(a.id!)}><RefreshCw className="h-4 w-4" />Verificar payload recebido</button>
                {a.payload_exemplo ? <span className="chip bg-green-100 text-success">{achatar(a.payload_exemplo).length} campos detectados</span> : <span className="text-sm text-muted">Aguardando o primeiro envio…</span>}
              </div>
              <div>
                <p className="label">Campo do telefone no payload</p>
                <CampoLivre campos={achatar(a.payload_exemplo ?? {})} valor={a.campo_telefone ?? ''} placeholder="ex.: contact.phone_digits"
                  onChange={(v) => setA({ ...a, campo_telefone: v })} />
              </div>
            </div>
          )}
        </Passo>
      )}

      <Passo n={++n} titulo="Condições" sub="Opcional: só segue quando os dados do cliente ou do evento atendem aos critérios.">
        <label className="flex items-center gap-3 text-sm">
          <Toggle checked={!!a.condicoes.ativas} onChange={(v) => setCond({ ativas: v, lista: lista.length ? lista : [{ campo: '', operador: 'igual', valor: '' }] })} />Usar condições
        </label>
        {a.condicoes.ativas && (
          <div className="mt-4 space-y-2">
            <select className="input w-auto" value={a.condicoes.modo ?? 'todas'} onChange={(e) => setCond({ modo: e.target.value as 'todas' })}>
              <option value="todas">Todas as condições</option><option value="qualquer">Qualquer condição</option>
            </select>
            {lista.map((c, i) => {
              const upd = (p: Partial<Condicao>) => setCond({ lista: lista.map((x, j) => (j === i ? { ...x, ...p } : x)) });
              const semValor = OPERADORES.find((o) => o.value === c.operador)?.semValor;
              return (
                <div key={i} className="grid gap-2 sm:grid-cols-[1fr_190px_1fr_auto]">
                  <CampoLivre campos={campos} valor={c.campo} onChange={(v) => upd({ campo: v })} />
                  <select className="input" value={c.operador} onChange={(e) => upd({ operador: e.target.value as Condicao['operador'] })}>
                    {OPERADORES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <input className="input" placeholder="Valor" disabled={semValor} value={c.valor} onChange={(e) => upd({ valor: e.target.value })} />
                  <button className="btn-ghost px-2.5" onClick={() => setCond({ lista: lista.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></button>
                </div>
              );
            })}
            <button className="btn-ghost" onClick={() => setCond({ lista: [...lista, { campo: '', operador: 'igual', valor: '' }] })}><Plus className="h-4 w-4" />Condição</button>
          </div>
        )}
      </Passo>

      <Passo n={++n} titulo="Quando executar?" sub="Contando a partir do evento. O limite de contato por cliente e o não perturbe valem sempre.">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Esperar</span>
          <input type="number" min={0} className="input w-24" value={a.atraso_valor} onChange={(e) => setA({ ...a, atraso_valor: Number(e.target.value) })} />
          <select className="input w-36" value={a.atraso_unidade} onChange={(e) => setA({ ...a, atraso_unidade: e.target.value as Unidade })}>
            {UNIDADES.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
          <span className="text-muted">(0 = imediatamente)</span>
        </div>
        <label className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4 text-sm">
          <span><b>Horário comercial</b><span className="block text-muted">Mensagens fora do horário configurado são adiadas para a próxima janela.</span></span>
          <Toggle checked={a.respeitar_horario} onChange={(v) => setA({ ...a, respeitar_horario: v })} />
        </label>
      </Passo>

      <Passo n={++n} titulo="Ações" sub="Executadas em sequência. A primeira que envia template abre a conversa que as seguintes usam.">
        <div className="space-y-3">
          {acoes.map((x, i) => (
            <EditorAcao key={i} i={i} total={acoes.length} acao={x} campos={campos} catalogo={catalogo} apiPrivada={apiPrivada}
              onChange={(v) => setAcoes(acoes.map((y, j) => (j === i ? v : y)))}
              onRemover={() => setAcoes(acoes.filter((_, j) => j !== i))}
              onMover={(d) => { const next = [...acoes]; [next[i], next[i + d]] = [next[i + d], next[i]]; setAcoes(next); }} />
          ))}
          <button className="btn-ghost w-full border-dashed" onClick={() => setAcoes([...acoes, novaAcao('nota_interna')])}><Plus className="h-4 w-4" />Adicionar ação</button>
        </div>
      </Passo>

      {podeEditar && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur min-[901px]:left-[240px]">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-end gap-2 px-4 py-3 md:px-8">
            <label className="mr-auto flex items-center gap-2 text-sm font-medium"><Toggle checked={a.ativa} onChange={(v) => setA({ ...a, ativa: v })} />Ativa</label>
            <button className="btn-ghost" onClick={() => nav('/app/automacoes')}>Cancelar</button>
            <button className="btn-primary" disabled={salvando} onClick={async () => { if (await salvar()) nav('/app/automacoes'); }}>
              {salvando ? <Spinner /> : 'Salvar automação'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
