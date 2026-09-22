import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { Archive, ArchiveRestore, ChevronLeft, ChevronRight, Copy, List, MoreVertical, Pencil, Plus, Workflow } from 'lucide-react';
import { EmptyState, Modal, PageHeader, Spinner, Toggle } from '../components/ui';
import { ACOES, FONTES, GATILHOS, POLITICAS_CONVERSA, UNIDADES } from '../lib/constants';
import { errorMessage, supabase } from '../lib/supabase';
import { useSession } from '../lib/session';
import type { Acao, Automacao, Template } from '../lib/types';

interface Resumo {
  automacao_id: string; executadas: number; erros: number; sem_envio: number; ultima_execucao: string | null;
  envios: number; respostas: number; compras: number;
}

const unidade = (u: string) => UNIDADES.find((x) => x.value === u)?.label ?? u;
const quando = (a: Automacao) => (a.atraso_valor ? `Depois de ${a.atraso_valor} ${unidade(a.atraso_unidade)}` : 'Imediatamente');
const esperaDaAcao = (x: Acao, i: number) => (i === 0 || !x.espera_valor ? 'Na sequência' : `${x.espera_valor} ${unidade(x.espera_unidade)} depois`);

/** Parâmetros do gatilho em texto curto ("1 dia", "cadencia rompida, parada repentina") */
function resumoParametros(a: Automacao) {
  const partes = GATILHOS[a.gatilho].parametros.map((p) => {
    const v = a.parametros?.[p.chave];
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) return null;
    return `${p.label.replace(/ \(.*\)$/, '')}: ${Array.isArray(v) ? v.join(', ').replace(/_/g, ' ') : v}`;
  }).filter(Boolean);
  return partes.length ? partes.join(' · ') : '—';
}

function Card({ a, resumo, templates, arquivada, podeEditar, onToggle, onDuplicar, onArquivar }: {
  a: Automacao; resumo?: Resumo; templates: Template[]; arquivada: boolean; podeEditar: boolean;
  onToggle: (v: boolean) => void; onDuplicar: () => void; onArquivar: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const acoes = [...(a.automacao_acoes ?? [])].sort((x, y) => (x.posicao ?? 0) - (y.posicao ?? 0));
  const taxa = resumo?.envios ? Math.round((resumo.respostas / resumo.envios) * 100) : null;

  const gatilho: [string, string][] = [
    ['Origem', FONTES.find((f) => f.value === a.fonte)?.label ?? a.fonte],
    ['Gatilho', GATILHOS[a.gatilho].label],
    ['Parâmetros', resumoParametros(a)],
    ['Condições', a.condicoes?.ativas ? `Sim (${a.condicoes.lista?.length ?? 0})` : 'Não'],
    ['Envio', quando(a)],
    ['Horário comercial', a.respeitar_horario ? 'Adiar para horário útil' : 'Sem restrição'],
  ];

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center gap-3">
        {!arquivada && <Toggle checked={a.ativa} disabled={!podeEditar} onChange={onToggle} />}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{a.nome}</p>
          <p className="text-xs text-muted">
            <span className={`chip mr-2 ${a.ativa && !arquivada ? 'bg-green-100 text-success' : 'bg-fog text-muted'}`}>{arquivada ? 'Arquivada' : a.ativa ? 'Ativa' : 'Pausada'}</span>
            {resumo?.ultima_execucao ? `Últ.: ${new Date(resumo.ultima_execucao).toLocaleString('pt-BR')}` : 'Nunca executada'}
          </p>
        </div>
        {resumo && (
          <div className="flex gap-4 text-center text-xs">
            <span><b className="block font-title text-lg tabular-nums">{resumo.executadas}</b>executadas</span>
            <span><b className="block font-title text-lg tabular-nums text-danger">{resumo.erros}</b>erros</span>
            <span><b className="block font-title text-lg tabular-nums text-muted">{resumo.sem_envio}</b>sem envio</span>
            <span title="Clientes que responderam ao envio"><b className="block font-title text-lg tabular-nums text-brand">{taxa == null ? '—' : `${taxa}%`}</b>respostas</span>
            <span title="Clientes que compraram até 7 dias depois do envio"><b className="block font-title text-lg tabular-nums text-success">{resumo.compras}</b>compras</span>
          </div>
        )}
        {podeEditar && (
          <div className="relative">
            <button className="btn-ghost px-2 py-2" onClick={() => setMenu(!menu)} aria-label="Ações"><MoreVertical className="h-4 w-4" /></button>
            {menu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                <div className="card absolute right-0 z-20 mt-1 w-44 overflow-hidden py-1 text-sm shadow-lg">
                  {!arquivada && <Link to={`/app/automacoes/${a.id}`} className="flex items-center gap-2 px-3 py-2 hover:bg-fog"><Pencil className="h-4 w-4" />Editar</Link>}
                  {!arquivada && <button className="flex w-full items-center gap-2 px-3 py-2 hover:bg-fog" onClick={onDuplicar}><Copy className="h-4 w-4" />Duplicar</button>}
                  <button className="flex w-full items-center gap-2 px-3 py-2 hover:bg-fog" onClick={onArquivar}>
                    {arquivada ? <><ArchiveRestore className="h-4 w-4" />Restaurar</> : <><Archive className="h-4 w-4" />Arquivar</>}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-lg bg-fog p-3">
        <p className="text-[11px] font-semibold tracking-wide text-muted">GATILHO</p>
        <dl className="mt-1.5 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {gatilho.map(([k, v]) => <div key={k} className="flex gap-1.5"><dt className="text-muted">{k}:</dt><dd className="font-medium">{v}</dd></div>)}
        </dl>
      </div>

      <p className="mt-4 text-[11px] font-semibold tracking-wide text-muted">AÇÕES ({acoes.length} {acoes.length === 1 ? 'AÇÃO' : 'AÇÕES'})</p>
      {acoes.length === 0 ? <p className="mt-1 text-sm text-muted">Nenhuma ação configurada.</p> : (
        <div className="mt-1.5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] tracking-wide text-muted">
              <tr>{['OCORRE', 'AÇÃO', 'TELEFONE', 'TEMPLATE', 'CONVERSA ABERTA'].map((h) => <th key={h} className="py-1.5 pr-4 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {acoes.map((x, i) => (
                <tr key={x.id ?? i}>
                  <td className="whitespace-nowrap py-2 pr-4">{esperaDaAcao(x, i)}</td>
                  <td className="py-2 pr-4">{i + 1}. {ACOES[x.tipo].label}</td>
                  <td className="whitespace-nowrap py-2 pr-4 text-muted">{x.tipo === 'enviar_template' ? x.config?.numero ?? 'padrão' : '—'}</td>
                  <td className="py-2 pr-4 text-muted">{x.config?.template_id ? templates.find((t) => t.id === x.config.template_id)?.nome ?? x.config.template_id : '—'}</td>
                  <td className="py-2 pr-4 text-muted">{x.tipo === 'enviar_template' ? POLITICAS_CONVERSA.find((p) => p.value === (x.config?.conversa_aberta ?? 'nao_fazer_nada'))?.short : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Texto que aparece ao passar o mouse (ou focar). Vai para o body para não ser cortado pela rolagem do modal. */
function Dica({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const abrir = (e: { currentTarget: HTMLElement }) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPos({ x: Math.min(r.left, window.innerWidth - 336), y: r.bottom + 6 });
  };
  return (
    <span
      tabIndex={0} onMouseEnter={abrir} onMouseLeave={() => setPos(null)} onFocus={abrir} onBlur={() => setPos(null)}
      className="chip cursor-help bg-brand-soft text-brand underline decoration-dotted underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
    >
      {rotulo}
      {pos && createPortal(
        <div role="tooltip" style={{ left: Math.max(8, pos.x), top: pos.y }}
          className="card pointer-events-none fixed z-[60] w-80 p-3 text-left text-xs font-normal text-ink shadow-lg">
          {children}
        </div>,
        document.body,
      )}
    </span>
  );
}

/** Linha compacta do modal "Ver todas": nome, números, e Gatilho/Ações com detalhe no hover. Clicar abre a edição. */
function LinhaCompacta({ a, resumo, onAbrir }: { a: Automacao; resumo?: Resumo; onAbrir: () => void }) {
  const acoes = [...(a.automacao_acoes ?? [])].sort((x, y) => (x.posicao ?? 0) - (y.posicao ?? 0));
  const taxa = resumo?.envios ? Math.round((resumo.respostas / resumo.envios) * 100) : null;
  return (
    <li>
      <div
        role="button" tabIndex={0} onClick={onAbrir}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(); } }}
        className="card cursor-pointer px-4 py-3 transition hover:border-brand hover:shadow-sm focus-visible:border-brand focus-visible:outline-none"
      >
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate font-semibold">{a.nome}</p>
          <span className={`chip ${a.ativa ? 'bg-green-100 text-success' : 'bg-fog text-muted'}`}>{a.ativa ? 'Ativa' : 'Pausada'}</span>
        </div>
        <p className="mt-1 text-xs text-muted tabular-nums">
          {resumo
            ? <>{resumo.executadas} executadas · <span className="text-danger">{resumo.erros} erros</span> · {taxa == null ? '—' : `${taxa}%`} respostas · <span className="text-success">{resumo.compras} compras</span></>
            : 'Nunca executada'}
        </p>
        <div className="mt-2 flex gap-2">
          <Dica rotulo="Gatilho">
            <p className="font-semibold">{GATILHOS[a.gatilho].label}</p>
            <p className="mt-0.5 text-muted">{FONTES.find((f) => f.value === a.fonte)?.label ?? a.fonte}</p>
            <p className="mt-1.5">Parâmetros: {resumoParametros(a)}</p>
            <p>Condições: {a.condicoes?.ativas ? `sim (${a.condicoes.lista?.length ?? 0})` : 'não'}</p>
            <p>Envio: {quando(a).toLowerCase()}</p>
          </Dica>
          <Dica rotulo={`Ações (${acoes.length})`}>
            {acoes.length === 0 ? <p className="text-muted">Nenhuma ação configurada.</p> : (
              <ol className="space-y-1">
                {acoes.map((x, i) => <li key={x.id ?? i}>{i + 1}. {ACOES[x.tipo].label} <span className="text-muted">— {esperaDaAcao(x, i).toLowerCase()}</span></li>)}
              </ol>
            )}
          </Dica>
        </div>
      </div>
    </li>
  );
}

const POR_PAGINA = 3;

export default function Automations() {
  const nav = useNavigate();
  const { podeEditar } = useSession();
  const [itens, setItens] = useState<Automacao[]>([]);
  // ativas no momento da carga: pausar um card não o tira da página na hora
  const [fixas, setFixas] = useState<Set<string>>(new Set());
  const [resumo, setResumo] = useState<Record<string, Resumo>>({});
  const [templates, setTemplates] = useState<Template[]>([]);
  const [arquivadas, setArquivadas] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pagina, setPagina] = useState(0);
  const [todas, setTodas] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('automacoes').select('*, automacao_acoes(*)').order('atualizado_em', { ascending: false });
    q = arquivadas ? q.not('arquivada_em', 'is', null) : q.is('arquivada_em', null);
    const [{ data }, { data: r }, { data: t }] = await Promise.all([q, supabase.rpc('resumo_automacoes'), supabase.from('octa_templates').select('id, nome')]);
    const lista = (data as Automacao[]) ?? [];
    setItens(lista);
    setFixas(new Set(lista.filter((a) => arquivadas || a.ativa).map((a) => a.id!)));
    setResumo(Object.fromEntries(((r as Resumo[]) ?? []).map((x) => [x.automacao_id, x])));
    setTemplates((t as Template[]) ?? []);
    setLoading(false);
  }, [arquivadas]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => setPagina(0), [arquivadas]);

  const visiveis = itens.filter((a) => fixas.has(a.id!));
  const paginas = Math.max(1, Math.ceil(visiveis.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, paginas - 1);
  const daPagina = visiveis.slice(paginaAtual * POR_PAGINA, (paginaAtual + 1) * POR_PAGINA);

  async function toggle(a: Automacao, ativa: boolean) {
    if (ativa && !a.automacao_acoes?.length) return alert('Adicione pelo menos uma ação antes de ativar.');
    setItens((xs) => xs.map((x) => (x.id === a.id ? { ...x, ativa } : x)));
    const { error } = await supabase.from('automacoes').update({ ativa }).eq('id', a.id!);
    if (error) { alert(errorMessage(error)); load(); }
  }

  async function duplicar(a: Automacao) {
    const { data, error } = await supabase.rpc('duplicar_automacao', { p_id: a.id });
    if (error) return alert(errorMessage(error));
    nav(`/app/automacoes/${data}`);
  }

  async function arquivar(a: Automacao, arquivar: boolean) {
    await supabase.from('automacoes').update({ arquivada_em: arquivar ? new Date().toISOString() : null, ativa: false }).eq('id', a.id!);
    load();
  }

  return (
    <div>
      <PageHeader title="Automações" subtitle="Réguas de WhatsApp em cima dos dados do metrics, enviadas pelo Octadesk."
        actions={podeEditar && <Link to="/app/automacoes/nova" className="btn-primary"><Plus className="h-4 w-4" />Criar nova automação</Link>} />

      {loading ? <Spinner /> : visiveis.length === 0 ? (
        itens.length === 0 ? (
          <EmptyState icon={<Workflow />} title={arquivadas ? 'Nenhuma automação arquivada' : 'Crie sua primeira automação'}
            text="Escolha um gatilho do metrics (ex.: orçamento sem compra) e o que deve acontecer (ex.: enviar um template pelo Octadesk)."
            action={!arquivadas && podeEditar && <Link to="/app/automacoes/nova" className="btn-primary"><Plus className="h-4 w-4" />Criar nova automação</Link>} />
        ) : (
          <EmptyState icon={<Workflow />} title="Nenhuma automação ativa"
            text={`${itens.length} ${itens.length === 1 ? 'automação está pausada' : 'automações estão pausadas'}. Abra "Ver todas" para ligar ou editar.`} />
        )
      ) : (
        <div className="space-y-4">
          {daPagina.map((a) => (
            <Card key={a.id} a={a} resumo={resumo[a.id!]} templates={templates} arquivada={arquivadas} podeEditar={podeEditar}
              onToggle={(v) => toggle(a, v)} onDuplicar={() => duplicar(a)} onArquivar={() => arquivar(a, !arquivadas)} />
          ))}
        </div>
      )}

      {!loading && (visiveis.length > POR_PAGINA || (!arquivadas && itens.length > 0)) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {visiveis.length > POR_PAGINA ? (
            <nav className="flex items-center gap-2" aria-label="Paginação">
              <button className="btn-ghost px-2.5 py-2" disabled={paginaAtual === 0} onClick={() => setPagina(paginaAtual - 1)} aria-label="Página anterior">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-muted tabular-nums">Página {paginaAtual + 1} de {paginas}</span>
              <button className="btn-ghost px-2.5 py-2" disabled={paginaAtual >= paginas - 1} onClick={() => setPagina(paginaAtual + 1)} aria-label="Próxima página">
                <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          ) : <span />}
          {!arquivadas && (
            <button className="btn-ghost" onClick={() => setTodas(true)}><List className="h-4 w-4" />Ver todas ({itens.length})</button>
          )}
        </div>
      )}

      <Modal open={todas} title={`Todas as automações (${itens.length})`} onClose={() => setTodas(false)}>
        <p className="mb-3 text-xs text-muted">Passe o mouse em “Gatilho” ou “Ações” para ver os detalhes. Clique numa automação para editá-la.</p>
        <ul className="space-y-2">
          {itens.map((a) => <LinhaCompacta key={a.id} a={a} resumo={resumo[a.id!]} onAbrir={() => nav(`/app/automacoes/${a.id}`)} />)}
        </ul>
      </Modal>

      {!loading && (
        <>
          <hr className="mt-8 border-line" />
          <div className="mt-4 flex justify-center">
            <button className="btn-ghost" onClick={() => setArquivadas(!arquivadas)}>
              {arquivadas ? <><Workflow className="h-4 w-4" />Ver ativas</> : <><Archive className="h-4 w-4" />Arquivadas</>}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
