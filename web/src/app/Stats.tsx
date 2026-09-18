import { useCallback, useEffect, useMemo, useState } from 'react';
import { Spinner, StatusChip } from '../components/ui';
import { ACOES, MOTIVOS } from '../lib/constants';
import { supabase } from '../lib/supabase';
import type { TipoAcao } from '../lib/types';

interface Dia {
  dia: string; gatilhos: number; gatilhos_ignorados: number; acoes: number; acoes_sucesso: number; acoes_sem_envio: number;
  acoes_erro: number; envios: number; respostas: number; compras: number; valor_compras: number;
}
interface Linha {
  id: string; status: string; erro: string | null; codigo_erro: string | null; agendado_para: string; concluido_em: string | null;
  automacoes: { nome: string } | null; automacao_acoes: { tipo: TipoAcao } | null;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

/** Bloco de estatísticas — mora na tela inicial, abaixo do banner. */
export default function Stats() {
  const [de, setDe] = useState(ymd(new Date(Date.now() - 13 * 86400000)));
  const [ate, setAte] = useState(ymd(new Date()));
  const [automacaoId, setAutomacaoId] = useState('');
  const [automacoes, setAutomacoes] = useState<{ id: string; nome: string }[]>([]);
  const [dias, setDias] = useState<Dia[]>([]);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { supabase.from('automacoes').select('id, nome').order('nome').then(({ data }) => setAutomacoes((data as { id: string; nome: string }[]) ?? [])); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('execucoes').select('id, status, erro, codigo_erro, agendado_para, concluido_em, automacoes(nome), automacao_acoes(tipo)')
      .gte('criado_em', de).lte('criado_em', `${ate}T23:59:59`).order('criado_em', { ascending: false }).limit(50);
    if (automacaoId) q = q.eq('automacao_id', automacaoId);
    const [{ data: d }, { data: l }] = await Promise.all([
      supabase.rpc('estatisticas_diarias', { p_de: de, p_ate: ate, p_automacao: automacaoId || null }),
      q,
    ]);
    setDias((d as Dia[]) ?? []); setLinhas((l as unknown as Linha[]) ?? []); setLoading(false);
  }, [de, ate, automacaoId]);
  useEffect(() => { load(); }, [load]);

  const t = useMemo(() => dias.reduce((s, d) => ({
    gatilhos: s.gatilhos + Number(d.gatilhos), envios: s.envios + Number(d.envios), respostas: s.respostas + Number(d.respostas),
    compras: s.compras + Number(d.compras), valor: s.valor + Number(d.valor_compras),
    semEnvio: s.semEnvio + Number(d.acoes_sem_envio) + Number(d.gatilhos_ignorados), erros: s.erros + Number(d.acoes_erro),
  }), { gatilhos: 0, envios: 0, respostas: 0, compras: 0, valor: 0, semEnvio: 0, erros: 0 }), [dias]);
  const max = Math.max(1, ...dias.map((d) => Number(d.acoes)));
  const taxa = t.envios ? Math.round((t.respostas / t.envios) * 100) : 0;

  const cards: [string, string, string, string?][] = [
    ['Gatilhos', t.gatilhos.toLocaleString('pt-BR'), 'text-ink'],
    ['Mensagens enviadas', t.envios.toLocaleString('pt-BR'), 'text-brand'],
    ['Responderam', `${taxa}%`, 'text-brand', `${t.respostas} clientes`],
    ['Compraram em 7 dias', t.compras.toLocaleString('pt-BR'), 'text-success', brl(t.valor)],
    ['Sem envio', t.semEnvio.toLocaleString('pt-BR'), 'text-muted', 'regras e conversas abertas'],
    ['Erros', t.erros.toLocaleString('pt-BR'), 'text-danger'],
  ];

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div><label className="label">Data inicial</label><input type="date" className="input" value={de} max={ate} onChange={(e) => setDe(e.target.value)} /></div>
        <div><label className="label">Data final</label><input type="date" className="input" value={ate} min={de} onChange={(e) => setAte(e.target.value)} /></div>
        <div className="min-w-48 flex-1">
          <label className="label">Automação</label>
          <select className="input" value={automacaoId} onChange={(e) => setAutomacaoId(e.target.value)}>
            <option value="">Todas</option>{automacoes.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map(([label, valor, cor, sub]) => (
          <div key={label} className="card p-4">
            <p className="text-sm text-muted">{label}</p>
            <p className={`mt-1 font-title text-3xl font-bold tabular-nums ${cor}`}>{valor}</p>
            {sub && <p className="text-xs text-muted">{sub}</p>}
          </div>
        ))}
      </div>

      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Ações por dia</h2>
          <div className="flex gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-success" />Executadas</span>
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-gray-300" />Sem envio</span>
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-danger" />Erros</span>
          </div>
        </div>
        {loading ? <div className="py-10"><Spinner /></div> : (
          <div className="mt-5 flex h-48 items-end gap-1 overflow-x-auto">
            {dias.map((d) => (
              <div key={d.dia} className="flex min-w-5 flex-1 flex-col items-center"
                title={`${new Date(d.dia).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}: ${d.acoes_sucesso} executadas, ${d.acoes_sem_envio} sem envio, ${d.acoes_erro} erros`}>
                <div className="flex w-full flex-col justify-end gap-px" style={{ height: `${(Number(d.acoes) / max) * 160}px` }}>
                  {Number(d.acoes_erro) > 0 && <div className="rounded-t-sm bg-danger" style={{ flex: Number(d.acoes_erro) }} />}
                  {Number(d.acoes_sem_envio) > 0 && <div className="bg-gray-300" style={{ flex: Number(d.acoes_sem_envio) }} />}
                  {Number(d.acoes_sucesso) > 0 && <div className="rounded-b-sm bg-success" style={{ flex: Number(d.acoes_sucesso) }} />}
                </div>
                <span className="mt-1.5 text-[10px] text-muted">{d.dia.slice(8, 10)}/{d.dia.slice(5, 7)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card overflow-hidden">
        <h2 className="border-b border-line px-5 py-3 font-semibold">Últimas execuções</h2>
        {linhas.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted">Nenhuma execução no período.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-fog text-left text-xs text-muted">
                <tr><th className="px-4 py-2 font-medium">Automação</th><th className="px-4 py-2 font-medium">Ação</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium">Quando</th><th className="px-4 py-2 font-medium">Detalhe</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {linhas.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-2.5 font-medium">{l.automacoes?.nome}</td>
                    <td className="px-4 py-2.5 text-muted">{l.automacao_acoes ? ACOES[l.automacao_acoes.tipo]?.label : '—'}</td>
                    <td className="px-4 py-2.5"><StatusChip status={l.status} /></td>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-muted">{new Date(l.concluido_em ?? l.agendado_para).toLocaleString('pt-BR')}</td>
                    <td className="max-w-72 truncate px-4 py-2.5 text-muted" title={l.erro ?? ''}>
                      {l.codigo_erro ? MOTIVOS[l.codigo_erro] ?? `${l.codigo_erro}${l.erro ? ` — ${l.erro}` : ''}` : l.erro ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
