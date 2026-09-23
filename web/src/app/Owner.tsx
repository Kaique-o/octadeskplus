import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, KeyRound, Plus, Trash2, UserPlus, Users } from 'lucide-react';
import { Alert, EmptyState, Modal, Spinner, Toggle } from '../components/ui';
import SettingsTabs from './SettingsTabs';
import { errorMessage, supabase } from '../lib/supabase';
import { useEmpresas, type Empresa } from '../lib/empresas';

interface Membro {
  user_id: string; nome: string | null; email: string; nivel: 'ver' | 'editar'; ativo: boolean;
  criado_em: string; ultimo_acesso: string | null;
}

type Janela =
  | { tipo: 'empresa' }
  | { tipo: 'apagar'; empresa: Empresa }
  | { tipo: 'usuario' }
  | { tipo: 'senha'; membro: Membro }
  | null;

const quando = (v: string | null) => (v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca');

/** Área do dono da plataforma: empresas (criar, inativar, apagar) e os usuários de cada uma. */
export default function Owner() {
  const nav = useNavigate();
  const { empresas, atual, recarregar, sair } = useEmpresas();
  const [selecionadaId, setSelecionadaId] = useState<string | null>(atual?.id ?? null);
  const [membros, setMembros] = useState<Membro[] | null>(null);
  const [janela, setJanela] = useState<Janela>(null);
  const [aviso, setAviso] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const selecionada = empresas.find((e) => e.id === selecionadaId) ?? empresas[0] ?? null;

  const carregarMembros = useCallback(async () => {
    if (!selecionada) return setMembros([]);
    const { data } = await supabase.rpc('listar_membros', { p_empresa: selecionada.id });
    setMembros((data as Membro[]) ?? []);
  }, [selecionada]);
  useEffect(() => { setMembros(null); carregarMembros(); }, [carregarMembros]);

  // Toda ação passa por aqui: mostra o erro do banco ou a confirmação.
  async function executar(acao: () => PromiseLike<{ error: unknown }>, ok: string) {
    const { error } = await acao();
    if (error) { setAviso({ kind: 'error', text: errorMessage(error) }); return false; }
    setAviso({ kind: 'success', text: ok });
    return true;
  }

  async function alternarEmpresa(e: Empresa, ativa: boolean) {
    if (await executar(() => supabase.rpc('definir_empresa_ativa', { p_empresa: e.id, p_ativa: ativa }),
      ativa ? `${e.nome} reativada.` : `${e.nome} inativada: não recebe eventos nem envia mensagens, e os usuários dela perdem o acesso.`)) await recarregar();
  }

  async function alternarMembro(m: Membro, ativo: boolean) {
    if (await executar(() => supabase.rpc('definir_membro_ativo', { p_empresa: selecionada!.id, p_usuario: m.user_id, p_ativo: ativo }),
      ativo ? `${m.nome ?? m.email} voltou a ter acesso.` : `${m.nome ?? m.email} perdeu o acesso a ${selecionada!.nome}.`)) carregarMembros();
  }

  async function mudarNivel(m: Membro, nivel: string) {
    if (await executar(() => supabase.rpc('definir_nivel', { p_empresa: selecionada!.id, p_usuario: m.user_id, p_nivel: nivel }),
      `Nível de ${m.nome ?? m.email} alterado.`)) carregarMembros();
  }

  return (
    <div className="space-y-6">
      <SettingsTabs />
      {aviso && <Alert kind={aviso.kind}>{aviso.text}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        {/* empresas */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Empresas</h2>
            <button className="btn-ghost py-1.5" onClick={() => setJanela({ tipo: 'empresa' })}><Plus className="h-4 w-4" />Nova</button>
          </div>
          <ul className="space-y-2">
            {empresas.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => setSelecionadaId(e.id)}
                  className={`card flex w-full items-center gap-3 px-3 py-3 text-left transition hover:border-brand ${selecionada?.id === e.id ? 'border-brand' : ''}`}>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><Building2 size={18} strokeWidth={1.8} /></span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm">{e.nome}</strong>
                    <span className={`chip mt-1 ${e.ativa ? 'bg-green-100 text-success' : 'bg-fog text-muted'}`}>{e.ativa ? 'Ativa' : 'Inativa'}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* empresa selecionada e seus usuários */}
        {!selecionada ? (
          <EmptyState icon={<Building2 />} title="Nenhuma empresa" text="Cadastre a primeira empresa para liberar usuários nela." />
        ) : (
          <section className="space-y-4">
            <div className="card flex flex-wrap items-center gap-4 p-5">
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-title text-lg font-semibold">{selecionada.nome}</h2>
                <p className="text-sm text-muted">Criada em {new Date(selecionada.criada_em).toLocaleDateString('pt-BR')}{atual?.id === selecionada.id && ' · empresa aberta agora'}</p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Toggle checked={selecionada.ativa} onChange={(v) => alternarEmpresa(selecionada, v)} />
                {selecionada.ativa ? 'Ativa' : 'Inativa'}
              </label>
              <button className="btn-danger" onClick={() => setJanela({ tipo: 'apagar', empresa: selecionada })}><Trash2 className="h-4 w-4" />Apagar</button>
            </div>

            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Usuários de {selecionada.nome}</h3>
              <button className="btn-primary" onClick={() => setJanela({ tipo: 'usuario' })}><UserPlus className="h-4 w-4" />Adicionar usuário</button>
            </div>

            {!membros ? <Spinner /> : membros.length === 0 ? (
              <EmptyState icon={<Users />} title="Ninguém nesta empresa" text="Adicione quem vai usar o painel desta empresa. Você, como dono, já vê todas." />
            ) : (
              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                      <th className="px-4 py-3 font-medium">Usuário</th>
                      <th className="px-4 py-3 font-medium">Acesso</th>
                      <th className="px-4 py-3 font-medium">Último acesso</th>
                      <th className="px-4 py-3 font-medium">Ativo</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {membros.map((m) => (
                      <tr key={m.user_id} className={m.ativo ? '' : 'opacity-60'}>
                        <td className="px-4 py-3">
                          <p className="font-medium">{m.nome ?? m.email}</p>
                          {m.nome && <p className="text-xs text-muted">{m.email}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <select className="input w-32 py-1.5" value={m.nivel} onChange={(e) => mudarNivel(m, e.target.value)}>
                            <option value="ver">Só vê</option>
                            <option value="editar">Edita</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-muted">{quando(m.ultimo_acesso)}</td>
                        <td className="px-4 py-3"><Toggle checked={m.ativo} onChange={(v) => alternarMembro(m, v)} /></td>
                        <td className="px-4 py-3 text-right">
                          <button className="btn-ghost py-1.5" onClick={() => setJanela({ tipo: 'senha', membro: m })}><KeyRound className="h-4 w-4" />Redefinir senha</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>

      {janela?.tipo === 'empresa' && (
        <NovaEmpresa onClose={() => setJanela(null)} onCriada={async (id, nome) => {
          setJanela(null); await recarregar(); setSelecionadaId(id);
          setAviso({ kind: 'success', text: `${nome} criada. Adicione os usuários e, abrindo a empresa, configure a integração do Octadesk.` });
        }} />
      )}
      {janela?.tipo === 'apagar' && (
        <ApagarEmpresa empresa={janela.empresa} onClose={() => setJanela(null)} onApagada={async () => {
          const eraAberta = atual?.id === janela.empresa.id;
          setJanela(null); setSelecionadaId(null);
          setAviso({ kind: 'success', text: `${janela.empresa.nome} foi apagada com tudo o que tinha.` });
          await recarregar();
          if (eraAberta) { sair(); nav('/empresa', { replace: true }); }
        }} />
      )}
      {janela?.tipo === 'usuario' && selecionada && (
        <NovoUsuario empresa={selecionada} onClose={() => setJanela(null)} onCriado={(texto) => { setJanela(null); setAviso({ kind: 'success', text: texto }); carregarMembros(); }} />
      )}
      {janela?.tipo === 'senha' && (
        <RedefinirSenha membro={janela.membro} onClose={() => setJanela(null)} onFeito={(texto) => { setJanela(null); setAviso({ kind: 'success', text: texto }); }} />
      )}
    </div>
  );
}

function NovaEmpresa({ onClose, onCriada }: { onClose: () => void; onCriada: (id: string, nome: string) => void }) {
  const [nome, setNome] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  async function criar() {
    setBusy(true); setErro('');
    const { data, error } = await supabase.rpc('salvar_empresa', { p: { nome: nome.trim() } });
    setBusy(false);
    if (error) return setErro(errorMessage(error));
    onCriada(data as string, nome.trim());
  }
  return (
    <Modal open title="Nova empresa" onClose={onClose}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={busy || !nome.trim()} onClick={criar}>{busy ? <Spinner /> : 'Criar empresa'}</button></>}>
      {erro && <div className="mb-3"><Alert>{erro}</Alert></div>}
      <label className="label">Nome</label>
      <input className="input" autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Skyline" />
      <p className="mt-2 text-xs text-muted">A empresa nasce vazia: integração, automações, números e chaves de API são só dela.</p>
    </Modal>
  );
}

function ApagarEmpresa({ empresa, onClose, onApagada }: { empresa: Empresa; onClose: () => void; onApagada: () => void }) {
  const [confirmacao, setConfirmacao] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  async function apagar() {
    setBusy(true); setErro('');
    const { error } = await supabase.rpc('apagar_empresa', { p_empresa: empresa.id, p_confirmacao: confirmacao });
    setBusy(false);
    if (error) return setErro(errorMessage(error));
    onApagada();
  }
  return (
    <Modal open title="Apagar empresa" onClose={onClose}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-danger" disabled={busy || !confirmacao.trim()} onClick={apagar}>{busy ? <Spinner /> : 'Apagar para sempre'}</button></>}>
      {erro && <div className="mb-3"><Alert>{erro}</Alert></div>}
      <Alert kind="warning">Isso apaga <b>{empresa.nome}</b> e tudo dela: integração, automações, histórico de envios, chaves de API e acessos. Não tem volta. Para só pausar, use “Inativa”.</Alert>
      <label className="label mt-4">Digite o nome da empresa para confirmar</label>
      <input className="input" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} placeholder={empresa.nome} />
    </Modal>
  );
}

function NovoUsuario({ empresa, onClose, onCriado }: { empresa: Empresa; onClose: () => void; onCriado: (texto: string) => void }) {
  const [form, setForm] = useState({ nome: '', email: '', senha: '', nivel: 'ver' });
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  async function criar() {
    setBusy(true); setErro('');
    const { error } = await supabase.rpc('criar_usuario', {
      p_empresa: empresa.id, p_email: form.email, p_nome: form.nome, p_senha: form.senha, p_nivel: form.nivel,
    });
    setBusy(false);
    if (error) return setErro(errorMessage(error));
    onCriado(`${form.nome || form.email} tem acesso a ${empresa.nome}. Se a conta é nova, passe o e-mail e a senha para a pessoa; ela troca a senha em Meu perfil.`);
  }
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  return (
    <Modal open title={`Adicionar usuário em ${empresa.nome}`} onClose={onClose}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={busy || !form.email.trim()} onClick={criar}>{busy ? <Spinner /> : 'Adicionar'}</button></>}>
      {erro && <div className="mb-3"><Alert>{erro}</Alert></div>}
      <div className="space-y-3">
        <div><label className="label">Nome</label><input className="input" autoFocus value={form.nome} onChange={set('nome')} placeholder="Nome da pessoa" /></div>
        <div><label className="label">E-mail</label><input className="input" type="email" value={form.email} onChange={set('email')} placeholder="pessoa@empresa.com" /></div>
        <div>
          <label className="label">Senha provisória</label>
          <input className="input" type="text" autoComplete="off" value={form.senha} onChange={set('senha')} placeholder="Mínimo de 8 caracteres" />
          <p className="mt-1 text-xs text-muted">Se o e-mail já tem conta (em outra empresa), a senha atual dele continua valendo e este campo é ignorado.</p>
        </div>
        <div>
          <label className="label">Acesso</label>
          <select className="input" value={form.nivel} onChange={set('nivel')}>
            <option value="ver">Só vê: acompanha automações e estatísticas</option>
            <option value="editar">Edita: cria automações e mexe nas configurações da empresa</option>
          </select>
        </div>
      </div>
    </Modal>
  );
}

function RedefinirSenha({ membro, onClose, onFeito }: { membro: Membro; onClose: () => void; onFeito: (texto: string) => void }) {
  const [senha, setSenha] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  async function salvar() {
    setBusy(true); setErro('');
    const { error } = await supabase.rpc('redefinir_senha', { p_usuario: membro.user_id, p_senha: senha });
    setBusy(false);
    if (error) return setErro(errorMessage(error));
    onFeito(`Senha de ${membro.nome ?? membro.email} redefinida. Passe a nova senha para a pessoa.`);
  }
  return (
    <Modal open title="Redefinir senha" onClose={onClose}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={busy || senha.length < 8} onClick={salvar}>{busy ? <Spinner /> : 'Salvar nova senha'}</button></>}>
      {erro && <div className="mb-3"><Alert>{erro}</Alert></div>}
      <p className="mb-3 text-sm text-muted">Nova senha para <b>{membro.nome ?? membro.email}</b>. Vale para todas as empresas em que a pessoa tem acesso.</p>
      <input className="input" type="text" autoComplete="off" autoFocus value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo de 8 caracteres" />
    </Modal>
  );
}
