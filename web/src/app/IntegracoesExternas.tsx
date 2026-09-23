import { useCallback, useEffect, useState } from 'react';
import { Lock, Pencil, Plug, Plus, Trash2 } from 'lucide-react';
import { siGooglesheets, siHubspot, siTrello, siZoho, type SimpleIcon } from 'simple-icons';
import { Alert, EmptyState, MenuAcoes, Modal, Spinner } from '../components/ui';
import SettingsTabs from './SettingsTabs';
import { errorMessage, supabase } from '../lib/supabase';
import { usePode } from '../lib/permissao';
import { useEmpresas } from '../lib/empresas';

interface Integracao {
  id: string; tipo: 'metrics'; config: { url?: string }; status: 'pendente' | 'conectado' | 'erro';
  ultimo_erro: string | null; criada_em: string; atualizada_em: string;
}

// Catálogo do modal. Só o metrics conecta hoje; o resto aparece bloqueado ("Indisponível").
// Logos das marcas vêm do simple-icons (SVG embutido, sem CDN). Salesforce, Pipedrive e RD Station não estão no
// pacote: ficam com as iniciais na cor da marca até chegar a logo; o metrics também, até recebermos a dele.
interface ItemCatalogo { tipo: string; nome: string; descricao: string; cor: string; sigla: string; icone?: SimpleIcon; disponivel?: boolean }
const CATALOGO: ItemCatalogo[] = [
  { tipo: 'metrics', nome: 'metrics', descricao: 'CRM da Skytech: clientes, vendas, créditos e curvas para os gatilhos.', cor: '#1366c9', sigla: 'M', disponivel: true },
  { tipo: 'trello', nome: 'Trello', descricao: 'Cards e quadros.', cor: '#0052cc', sigla: 'T', icone: siTrello },
  { tipo: 'salesforce', nome: 'Salesforce', descricao: 'Leads, contas e oportunidades.', cor: '#00a1e0', sigla: 'SF' },
  { tipo: 'hubspot', nome: 'HubSpot', descricao: 'Contatos, negócios e pipelines.', cor: '#ff7a59', sigla: 'H', icone: siHubspot },
  { tipo: 'pipedrive', nome: 'Pipedrive', descricao: 'Negócios e atividades.', cor: '#017737', sigla: 'P' },
  { tipo: 'rdstation', nome: 'RD Station', descricao: 'Leads e automação de marketing.', cor: '#19c1ce', sigla: 'RD' },
  { tipo: 'zoho', nome: 'Zoho CRM', descricao: 'Leads, contatos e negócios.', cor: '#e42527', sigla: 'Z', icone: siZoho },
  { tipo: 'sheets', nome: 'Google Sheets', descricao: 'Planilhas como origem de contatos.', cor: '#34a853', sigla: 'GS', icone: siGooglesheets },
];

/** Logo da integração: SVG da marca sobre branco, ou as iniciais sobre a cor da marca. */
function LogoIntegracao({ item }: { item: ItemCatalogo }) {
  if (item.icone) {
    return (
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line bg-white">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill={item.cor} role="img" aria-label={item.nome}><path d={item.icone.path} /></svg>
      </span>
    );
  }
  return <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-xs font-bold text-white" style={{ background: item.cor }}>{item.sigla}</span>;
}

const STATUS: Record<Integracao['status'], [string, string]> = {
  pendente: ['Aguardando validação', 'text-amber-600'],
  conectado: ['Conectado', 'text-success'],
  erro: ['Erro', 'text-danger'],
};

const quando = (v: string) => new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/** Sistemas externos ligados à empresa aberta (hoje: o metrics). A chave fica no servidor. */
export default function IntegracoesExternas() {
  const { podeEditar } = usePode('integracoes');
  const { atual } = useEmpresas();
  const [itens, setItens] = useState<Integracao[] | null>(null);
  const [janela, setJanela] = useState<{ tipo: 'catalogo' } | { tipo: 'metrics'; atual?: Integracao } | { tipo: 'remover'; item: Integracao } | null>(null);
  const [aviso, setAviso] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const carregar = useCallback(async () => {
    const { data } = await supabase.from('integracoes_externas').select('*').order('criada_em');
    setItens((data as Integracao[]) ?? []);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const feito = (texto: string) => { setJanela(null); setAviso({ kind: 'success', text: texto }); carregar(); };
  const jaTem = (tipo: string) => itens?.some((i) => i.tipo === tipo);

  return (
    <div className="space-y-6">
      <SettingsTabs />
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">Integrações de {atual?.nome}{itens && <span className="ml-2 font-normal text-muted">({itens.length})</span>}</h3>
          {podeEditar && <button className="btn-primary" onClick={() => setJanela({ tipo: 'catalogo' })}><Plus className="h-4 w-4" />Adicionar integração</button>}
        </div>
        {aviso && <Alert kind={aviso.kind}>{aviso.text}</Alert>}

        {!itens ? <Spinner /> : itens.length === 0 ? (
          <EmptyState icon={<Plug />} title="Nenhuma integração" text={podeEditar ? 'Conecte o metrics para usar clientes e vendas nas automações.' : 'Ainda não há integrações nesta empresa.'} />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-medium">Integração</th>
                  <th className="px-4 py-3 font-medium">Endereço</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Atualizada</th>
                  {podeEditar && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {itens.map((i) => {
                  const cat = CATALOGO.find((c) => c.tipo === i.tipo)!;
                  const [rotulo, cor] = STATUS[i.status];
                  return (
                    <tr key={i.id}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <LogoIntegracao item={cat} />
                          <span className="font-medium">{cat.nome}</span>
                        </div>
                      </td>
                      <td className="max-w-64 truncate px-4 py-3 text-muted" title={i.config.url}>{i.config.url}</td>
                      <td className={`px-4 py-3 font-medium ${cor}`} title={i.ultimo_erro ?? undefined}>{rotulo}</td>
                      <td className="px-4 py-3 text-muted">{quando(i.atualizada_em)}</td>
                      {podeEditar && (
                        <td className="px-4 py-3 text-right">
                          <MenuAcoes rotulo={`Ações de ${cat.nome}`} itens={[
                            { label: 'Editar', icone: <Pencil className="h-4 w-4" />, onClick: () => setJanela({ tipo: 'metrics', atual: i }) },
                            { label: 'Desconectar', icone: <Trash2 className="h-4 w-4" />, perigo: true, onClick: () => setJanela({ tipo: 'remover', item: i }) },
                          ]} />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {janela?.tipo === 'catalogo' && (
        <Modal open title="Adicionar integração" onClose={() => setJanela(null)}>
          <div className="space-y-2">
            {CATALOGO.map((c) => {
              const bloqueada = !c.disponivel;
              const conectada = !bloqueada && jaTem(c.tipo);
              return (
                <button key={c.tipo} type="button" disabled={bloqueada}
                  onClick={() => setJanela({ tipo: 'metrics', atual: itens?.find((i) => i.tipo === c.tipo) })}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${bloqueada ? 'cursor-not-allowed border-line bg-fog opacity-60' : 'border-line bg-white hover:border-brand hover:shadow-sm'}`}>
                  <LogoIntegracao item={c} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <strong className="font-semibold">{c.nome}</strong>
                      {bloqueada ? <span className="flex items-center gap-1 text-xs text-muted"><Lock className="h-3.5 w-3.5" />Indisponível</span>
                        : conectada ? <span className="text-xs font-medium text-success">Conectado</span> : null}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">{c.descricao}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Modal>
      )}
      {janela?.tipo === 'metrics' && <ConectarMetrics atual={janela.atual} onClose={() => setJanela(null)} onFeito={feito} />}
      {janela?.tipo === 'remover' && <Desconectar item={janela.item} onClose={() => setJanela(null)} onFeito={feito} />}
    </div>
  );
}

function ConectarMetrics({ atual, onClose, onFeito }: { atual?: Integracao; onClose: () => void; onFeito: (texto: string) => void }) {
  const [url, setUrl] = useState(atual?.config.url ?? '');
  const [chave, setChave] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  async function salvar() {
    setBusy(true); setErro('');
    const { error } = await supabase.rpc('salvar_integracao_externa', { p: { tipo: 'metrics', url, chave } });
    setBusy(false);
    if (error) return setErro(errorMessage(error));
    onFeito(atual ? 'Integração com o metrics atualizada.' : 'metrics conectado. A conexão fica aguardando validação.');
  }
  return (
    <Modal open title={atual ? 'Editar conexão com o metrics' : 'Conectar ao metrics'} onClose={onClose}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={busy || !url.trim() || (!atual && !chave)} onClick={salvar}>{busy ? <Spinner /> : atual ? 'Salvar' : 'Conectar'}</button></>}>
      {erro && <div className="mb-3"><Alert>{erro}</Alert></div>}
      <p className="mb-4 text-sm text-muted">Informe o Supabase do metrics. A chave fica guardada no servidor e nunca volta para o navegador.</p>
      <div className="space-y-3">
        <div><label className="label">URL do Supabase do metrics</label><input className="input" autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxxxxxx.supabase.co" /></div>
        <div>
          <label className="label">Chave de acesso</label>
          <input className="input" type="password" autoComplete="off" value={chave} onChange={(e) => setChave(e.target.value)}
            placeholder={atual ? '•••••••• salva (deixe vazio para manter)' : 'Chave secreta do projeto do metrics'} />
        </div>
      </div>
    </Modal>
  );
}

function Desconectar({ item, onClose, onFeito }: { item: Integracao; onClose: () => void; onFeito: (texto: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  async function remover() {
    setBusy(true); setErro('');
    const { error } = await supabase.rpc('remover_integracao_externa', { p_id: item.id });
    setBusy(false);
    if (error) return setErro(errorMessage(error));
    onFeito('Integração desconectada. A chave foi apagada do servidor.');
  }
  return (
    <Modal open title="Desconectar integração" onClose={onClose}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-danger" disabled={busy} onClick={remover}>{busy ? <Spinner /> : 'Desconectar'}</button></>}>
      {erro && <div className="mb-3"><Alert>{erro}</Alert></div>}
      <p className="text-sm">Desconectar o <b>metrics</b> desta empresa? A chave salva é apagada; para voltar, é só conectar de novo.</p>
    </Modal>
  );
}
