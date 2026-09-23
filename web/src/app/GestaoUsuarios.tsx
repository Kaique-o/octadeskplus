import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, KeyRound, List, Pencil, Plus, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react';
import { Alert, EmptyState, MenuAcoes, Modal, Spinner, Toggle } from '../components/ui';
import { errorMessage, supabase } from '../lib/supabase';
import { useSession } from '../lib/session';
import { baixarCsv } from '../lib/csv';
import { AREAS, NIVEIS, nivelDe, type Nivel, type Permissoes } from '../lib/permissao';

interface Membro {
  user_id: string; nome: string | null; email: string; perfil_id: string; perfil: string; ativo: boolean;
  criado_em: string; ultimo_acesso: string | null; outras_empresas: number;
}
interface Perfil { id: string; nome: string; permissoes: Permissoes; usuarios: number }
interface EmpresaAlvo { id: string; nome: string }

type Janela =
  | { tipo: 'novo' }
  | { tipo: 'editar'; membro: Membro }
  | { tipo: 'senha'; membro: Membro }
  | { tipo: 'apagar'; membro: Membro }
  | { tipo: 'perfis' }
  | { tipo: 'todos' }
  | null;

const POR_PAGINA = 15;
const quando = (v: string | null) => (v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca');
const nomeDe = (m: Membro) => m.nome ?? m.email;

/**
 * Usuários de uma empresa: lista paginada, "Ver todos" com CSV e, para quem gerencia (dono ou perfil com
 * "Usuários: edita"), criar, editar, redefinir senha, inativar, apagar e configurar os perfis de acesso.
 */
export default function GestaoUsuarios({ empresa, podeGerenciar }: { empresa: EmpresaAlvo; podeGerenciar: boolean }) {
  const { session, eDono } = useSession();
  const [membros, setMembros] = useState<Membro[] | null>(null);
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [pagina, setPagina] = useState(0);
  const [janela, setJanela] = useState<Janela>(null);
  const [aviso, setAviso] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const carregar = useCallback(async () => {
    const [{ data: m }, { data: p }] = await Promise.all([
      supabase.rpc('listar_membros', { p_empresa: empresa.id }),
      supabase.rpc('listar_perfis', { p_empresa: empresa.id }),
    ]);
    setMembros((m as Membro[]) ?? []);
    setPerfis((p as Perfil[]) ?? []);
  }, [empresa.id]);
  useEffect(() => { setMembros(null); setPagina(0); setAviso(null); carregar(); }, [carregar]);

  const feito = (texto: string) => { setJanela(null); setAviso({ kind: 'success', text: texto }); carregar(); };

  async function alternar(m: Membro, ativo: boolean) {
    const { error } = await supabase.rpc('definir_membro_ativo', { p_empresa: empresa.id, p_usuario: m.user_id, p_ativo: ativo });
    if (error) return setAviso({ kind: 'error', text: errorMessage(error) });
    feito(ativo ? `${nomeDe(m)} voltou a ter acesso.` : `${nomeDe(m)} perdeu o acesso a ${empresa.nome}.`);
  }

  function exportar() {
    baixarCsv(`usuarios-${empresa.nome.toLowerCase().replace(/\s+/g, '-')}`, ['Nome', 'E-mail', 'Perfil', 'Ativo', 'Último acesso', 'Criado em'],
      (membros ?? []).map((m) => [m.nome ?? '', m.email, m.perfil, m.ativo ? 'Sim' : 'Não', m.ultimo_acesso ? quando(m.ultimo_acesso) : '', quando(m.criado_em)]));
  }

  const lista = membros ?? [];
  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, paginas - 1);
  const daPagina = lista.slice(paginaAtual * POR_PAGINA, (paginaAtual + 1) * POR_PAGINA);
  const eu = (m: Membro) => m.user_id === session?.user.id;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">Usuários de {empresa.nome}{membros && <span className="ml-2 font-normal text-muted">({lista.length})</span>}</h3>
        {podeGerenciar && (
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={() => setJanela({ tipo: 'perfis' })}><ShieldCheck className="h-4 w-4" />Configurar perfis de acesso</button>
            <button className="btn-primary" onClick={() => setJanela({ tipo: 'novo' })}><UserPlus className="h-4 w-4" />Criar usuário</button>
          </div>
        )}
      </div>
      {aviso && <Alert kind={aviso.kind}>{aviso.text}</Alert>}

      {!membros ? <Spinner /> : lista.length === 0 ? (
        <EmptyState icon={<Users />} title="Ninguém nesta empresa" text={podeGerenciar ? 'Crie os usuários que vão usar o painel desta empresa.' : 'Ainda não há usuários liberados nesta empresa.'} />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-medium">Usuário</th>
                  <th className="px-4 py-3 font-medium">Perfil</th>
                  <th className="px-4 py-3 font-medium">Último acesso</th>
                  <th className="px-4 py-3 font-medium">Ativo</th>
                  {podeGerenciar && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {daPagina.map((m) => (
                  <tr key={m.user_id} className={m.ativo ? '' : 'opacity-60'}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{nomeDe(m)}{eu(m) && <span className="ml-2 text-xs font-normal text-muted">(você)</span>}</p>
                      {m.nome && <p className="text-xs text-muted">{m.email}</p>}
                    </td>
                    <td className="px-4 py-3"><span className="chip bg-brand-soft text-blue-800">{m.perfil}</span></td>
                    <td className="px-4 py-3 text-muted">{quando(m.ultimo_acesso)}</td>
                    <td className="px-4 py-3">
                      {podeGerenciar && !eu(m)
                        ? <Toggle checked={m.ativo} onChange={(v) => alternar(m, v)} />
                        : <span className="text-muted">{m.ativo ? 'Sim' : 'Não'}</span>}
                    </td>
                    {podeGerenciar && (
                      <td className="px-4 py-3 text-right">
                        {!eu(m) && (
                          <MenuAcoes rotulo={`Ações de ${nomeDe(m)}`} itens={[
                            { label: 'Editar', icone: <Pencil className="h-4 w-4" />, onClick: () => setJanela({ tipo: 'editar', membro: m }) },
                            { label: 'Redefinir senha', icone: <KeyRound className="h-4 w-4" />, onClick: () => setJanela({ tipo: 'senha', membro: m }) },
                            { label: 'Excluir', icone: <Trash2 className="h-4 w-4" />, perigo: true, onClick: () => setJanela({ tipo: 'apagar', membro: m }) },
                          ]} />
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav className="flex items-center gap-2" aria-label="Paginação">
              <button className="btn-ghost px-2.5 py-2" disabled={paginaAtual === 0} onClick={() => setPagina(paginaAtual - 1)} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></button>
              <span className="text-sm text-muted tabular-nums">Página {paginaAtual + 1} de {paginas}</span>
              <button className="btn-ghost px-2.5 py-2" disabled={paginaAtual >= paginas - 1} onClick={() => setPagina(paginaAtual + 1)} aria-label="Próxima página"><ChevronRight className="h-4 w-4" /></button>
            </nav>
            <button className="inline-flex items-center gap-2 rounded px-1 text-sm font-semibold text-brand transition-colors hover:text-brand-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
              onClick={() => setJanela({ tipo: 'todos' })}><List className="h-4 w-4" />Ver todos ({lista.length})</button>
          </div>
        </>
      )}

      {janela?.tipo === 'todos' && (
        <Modal open largo title={`Todos os usuários de ${empresa.nome} (${lista.length})`} onClose={() => setJanela(null)}
          footer={<button className="btn-ghost" onClick={exportar}><Download className="h-4 w-4" />Exportar CSV</button>}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2 pr-3 font-medium">Usuário</th><th className="py-2 pr-3 font-medium">Perfil</th>
                <th className="py-2 pr-3 font-medium">Ativo</th><th className="py-2 font-medium">Último acesso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {lista.map((m) => (
                <tr key={m.user_id}>
                  <td className="py-2 pr-3"><p className="font-medium">{nomeDe(m)}</p>{m.nome && <p className="text-xs text-muted">{m.email}</p>}</td>
                  <td className="py-2 pr-3">{m.perfil}</td>
                  <td className="py-2 pr-3">{m.ativo ? 'Sim' : 'Não'}</td>
                  <td className="py-2 text-muted">{quando(m.ultimo_acesso)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
      {janela?.tipo === 'novo' && <NovoUsuario empresa={empresa} perfis={perfis} onClose={() => setJanela(null)} onFeito={feito} />}
      {janela?.tipo === 'editar' && <EditarUsuario empresa={empresa} perfis={perfis} membro={janela.membro} onClose={() => setJanela(null)} onFeito={feito} />}
      {janela?.tipo === 'senha' && <RedefinirSenha empresa={empresa} membro={janela.membro} eDono={eDono} onClose={() => setJanela(null)} onFeito={feito} />}
      {janela?.tipo === 'apagar' && <ExcluirUsuario empresa={empresa} membro={janela.membro} onClose={() => setJanela(null)} onFeito={feito} />}
      {janela?.tipo === 'perfis' && <PerfisDeAcesso empresa={empresa} perfis={perfis} onClose={() => setJanela(null)} onMudou={carregar} />}
    </section>
  );
}

// ---------------------------------------------------------------- janelas

type Props = { empresa: EmpresaAlvo; onClose: () => void; onFeito: (texto: string) => void };

function Rodape({ onClose, busy, desabilitado, rotulo, perigo, onOk }: { onClose: () => void; busy: boolean; desabilitado?: boolean; rotulo: string; perigo?: boolean; onOk: () => void }) {
  return (
    <>
      <button className="btn-ghost" onClick={onClose}>Cancelar</button>
      <button className={perigo ? 'btn-danger' : 'btn-primary'} disabled={busy || desabilitado} onClick={onOk}>{busy ? <Spinner /> : rotulo}</button>
    </>
  );
}

function SeletorPerfil({ perfis, valor, onChange }: { perfis: Perfil[]; valor: string; onChange: (id: string) => void }) {
  return (
    <select className="input" value={valor} onChange={(e) => onChange(e.target.value)}>
      <option value="" disabled>Escolha o perfil</option>
      {perfis.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
    </select>
  );
}

function NovoUsuario({ empresa, perfis, onClose, onFeito }: Props & { perfis: Perfil[] }) {
  const [form, setForm] = useState({ nome: '', email: '', senha: '', perfil: perfis.find((p) => p.nome === 'Só vê')?.id ?? perfis[0]?.id ?? '' });
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  async function criar() {
    setBusy(true); setErro('');
    const { error } = await supabase.rpc('criar_usuario', { p_empresa: empresa.id, p_email: form.email, p_nome: form.nome, p_senha: form.senha, p_perfil: form.perfil });
    setBusy(false);
    if (error) return setErro(errorMessage(error));
    onFeito(`${form.nome || form.email} tem acesso a ${empresa.nome}. Se a conta é nova, passe o e-mail e a senha para a pessoa; ela troca a senha em Meu perfil.`);
  }
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  return (
    <Modal open title={`Criar usuário em ${empresa.nome}`} onClose={onClose}
      footer={<Rodape onClose={onClose} busy={busy} desabilitado={!form.email.trim() || !form.perfil} rotulo="Criar usuário" onOk={criar} />}>
      {erro && <div className="mb-3"><Alert>{erro}</Alert></div>}
      <div className="space-y-3">
        <div><label className="label">Nome</label><input className="input" autoFocus value={form.nome} onChange={set('nome')} placeholder="Nome da pessoa" /></div>
        <div><label className="label">E-mail</label><input className="input" type="email" value={form.email} onChange={set('email')} placeholder="pessoa@empresa.com" /></div>
        <div>
          <label className="label">Senha provisória</label>
          <input className="input" type="text" autoComplete="off" value={form.senha} onChange={set('senha')} placeholder="Mínimo de 8 caracteres" />
          <p className="mt-1 text-xs text-muted">Se o e-mail já tem conta (em outra empresa), a senha atual dele continua valendo e este campo é ignorado.</p>
        </div>
        <div><label className="label">Perfil de acesso</label><SeletorPerfil perfis={perfis} valor={form.perfil} onChange={(perfil) => setForm({ ...form, perfil })} /></div>
      </div>
    </Modal>
  );
}

function EditarUsuario({ empresa, perfis, membro, onClose, onFeito }: Props & { perfis: Perfil[]; membro: Membro }) {
  const [nome, setNome] = useState(membro.nome ?? '');
  const [perfil, setPerfil] = useState(membro.perfil_id);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  async function salvar() {
    setBusy(true); setErro('');
    const { error } = await supabase.rpc('editar_membro', { p_empresa: empresa.id, p_usuario: membro.user_id, p_nome: nome, p_perfil: perfil });
    setBusy(false);
    if (error) return setErro(errorMessage(error));
    onFeito(`${nome.trim() || membro.email} atualizado.`);
  }
  return (
    <Modal open title="Editar usuário" onClose={onClose} footer={<Rodape onClose={onClose} busy={busy} rotulo="Salvar" onOk={salvar} />}>
      {erro && <div className="mb-3"><Alert>{erro}</Alert></div>}
      <div className="space-y-3">
        <div><label className="label">E-mail</label><input className="input" value={membro.email} disabled /></div>
        <div><label className="label">Nome</label><input className="input" autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da pessoa" /></div>
        <div><label className="label">Perfil de acesso em {empresa.nome}</label><SeletorPerfil perfis={perfis} valor={perfil} onChange={setPerfil} /></div>
      </div>
    </Modal>
  );
}

function RedefinirSenha({ empresa, membro, eDono, onClose, onFeito }: Props & { membro: Membro; eDono: boolean }) {
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const bloqueado = !eDono && membro.outras_empresas > 0;
  async function salvar() {
    if (senha !== confirmar) return setErro('As senhas não conferem.');
    setBusy(true); setErro('');
    const { error } = await supabase.rpc('redefinir_senha', { p_empresa: empresa.id, p_usuario: membro.user_id, p_senha: senha });
    setBusy(false);
    if (error) return setErro(errorMessage(error));
    onFeito(`Senha de ${nomeDe(membro)} redefinida. Passe a nova senha para a pessoa.`);
  }
  return (
    <Modal open title="Redefinir senha" onClose={onClose}
      footer={<Rodape onClose={onClose} busy={busy} desabilitado={bloqueado || senha.length < 8 || !confirmar} rotulo="Salvar nova senha" onOk={salvar} />}>
      {erro && <div className="mb-3"><Alert>{erro}</Alert></div>}
      {bloqueado ? (
        <Alert kind="warning"><b>{nomeDe(membro)}</b> também usa outras empresas. Como a senha vale em todas, só o dono da plataforma pode trocá-la.</Alert>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">Nova senha para <b>{nomeDe(membro)}</b>. A senha atual deixa de funcionar na hora{membro.outras_empresas > 0 && ', em todas as empresas da pessoa'}.</p>
          <div className="space-y-3">
            <input className="input" type="text" autoComplete="off" autoFocus value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Nova senha (mínimo de 8 caracteres)" />
            <input className="input" type="text" autoComplete="off" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} placeholder="Repita a nova senha" />
          </div>
        </>
      )}
    </Modal>
  );
}

function ExcluirUsuario({ empresa, membro, onClose, onFeito }: Props & { membro: Membro }) {
  const [confirmacao, setConfirmacao] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const confere = confirmacao.trim().toLowerCase() === membro.email.toLowerCase();
  async function excluir() {
    setBusy(true); setErro('');
    const { error } = await supabase.rpc('remover_membro', { p_empresa: empresa.id, p_usuario: membro.user_id });
    setBusy(false);
    if (error) return setErro(errorMessage(error));
    onFeito(`${nomeDe(membro)} não tem mais acesso a ${empresa.nome}.`);
  }
  return (
    <Modal open title="Excluir usuário" onClose={onClose}
      footer={<Rodape onClose={onClose} busy={busy} desabilitado={!confere} rotulo="Excluir usuário" perigo onOk={excluir} />}>
      {erro && <div className="mb-3"><Alert>{erro}</Alert></div>}
      <Alert kind="warning">
        <b>{nomeDe(membro)}</b> perde o acesso a <b>{empresa.nome}</b> na hora. As outras empresas da pessoa não mudam;
        para só suspender, use o interruptor “Ativo”.
      </Alert>
      <label className="label mt-4">Digite o e-mail do usuário para confirmar</label>
      <input className="input" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} placeholder={membro.email} />
    </Modal>
  );
}

// ---------------------------------------------------------------- perfis de acesso

function PerfisDeAcesso({ empresa, perfis, onClose, onMudou }: { empresa: EmpresaAlvo; perfis: Perfil[]; onClose: () => void; onMudou: () => void }) {
  const [editando, setEditando] = useState<Perfil | 'novo' | null>(null);
  const [excluindo, setExcluindo] = useState<Perfil | null>(null);
  const [aviso, setAviso] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  if (editando) {
    return <EditorPerfil empresa={empresa} perfil={editando === 'novo' ? null : editando} onVoltar={() => setEditando(null)}
      onSalvo={(nome) => { setEditando(null); setAviso({ kind: 'success', text: `Perfil ${nome} salvo.` }); onMudou(); }} />;
  }

  async function excluir(p: Perfil) {
    const { error } = await supabase.rpc('apagar_perfil', { p_empresa: empresa.id, p_perfil: p.id });
    setExcluindo(null);
    if (error) return setAviso({ kind: 'error', text: errorMessage(error) });
    setAviso({ kind: 'success', text: `Perfil ${p.nome} excluído.` });
    onMudou();
  }

  return (
    <Modal open largo title={`Perfis de acesso de ${empresa.nome}`} onClose={onClose}
      footer={<button className="btn-primary" onClick={() => setEditando('novo')}><Plus className="h-4 w-4" />Novo perfil</button>}>
      <p className="mb-3 text-sm text-muted">Cada perfil diz o que o usuário vê e edita em cada área do painel. Quem tem “Usuários: edita” também gerencia usuários e perfis desta empresa.</p>
      {aviso && <div className="mb-3"><Alert kind={aviso.kind}>{aviso.text}</Alert></div>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-2 pr-3 font-medium">Perfil</th>
              {AREAS.map((a) => <th key={a.chave} className="py-2 pr-3 font-medium">{a.label}</th>)}
              <th className="py-2 pr-3 font-medium">Usuários</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {perfis.map((p) => (
              <tr key={p.id}>
                <td className="py-2 pr-3 font-medium">{p.nome}</td>
                {AREAS.map((a) => <td key={a.chave} className="py-2 pr-3"><NivelChip nivel={nivelDe(p.permissoes, a.chave)} /></td>)}
                <td className="py-2 pr-3 tabular-nums">{p.usuarios}</td>
                <td className="py-2 text-right">
                  <MenuAcoes rotulo={`Ações do perfil ${p.nome}`} itens={[
                    { label: 'Editar', icone: <Pencil className="h-4 w-4" />, onClick: () => setEditando(p) },
                    { label: 'Excluir', icone: <Trash2 className="h-4 w-4" />, perigo: true, onClick: () => setExcluindo(p) },
                  ]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {excluindo && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
          {excluindo.usuarios > 0 ? (
            <p>O perfil <b>{excluindo.nome}</b> tem {excluindo.usuarios} usuário(s). Mude o perfil deles antes de excluir.</p>
          ) : (
            <p>Excluir o perfil <b>{excluindo.nome}</b>? Não tem volta.</p>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setExcluindo(null)}>Cancelar</button>
            {excluindo.usuarios === 0 && <button className="btn-danger" onClick={() => excluir(excluindo)}>Excluir perfil</button>}
          </div>
        </div>
      )}
    </Modal>
  );
}

function NivelChip({ nivel }: { nivel: Nivel }) {
  const cor = { nenhum: 'bg-fog text-muted', ver: 'bg-brand-soft text-blue-800', editar: 'bg-green-100 text-success' }[nivel];
  return <span className={`chip ${cor}`}>{NIVEIS.find((n) => n.valor === nivel)?.label}</span>;
}

function EditorPerfil({ empresa, perfil, onVoltar, onSalvo }: { empresa: EmpresaAlvo; perfil: Perfil | null; onVoltar: () => void; onSalvo: (nome: string) => void }) {
  const [nome, setNome] = useState(perfil?.nome ?? '');
  const [permissoes, setPermissoes] = useState<Permissoes>(perfil?.permissoes ?? Object.fromEntries(AREAS.map((a) => [a.chave, 'ver'])));
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  async function salvar() {
    setBusy(true); setErro('');
    const { error } = await supabase.rpc('salvar_perfil', { p_empresa: empresa.id, p: { id: perfil?.id, nome: nome.trim(), permissoes } });
    setBusy(false);
    if (error) return setErro(errorMessage(error));
    onSalvo(nome.trim());
  }
  return (
    <Modal open title={perfil ? `Editar perfil ${perfil.nome}` : 'Novo perfil de acesso'} onClose={onVoltar}
      footer={<><button className="btn-ghost" onClick={onVoltar}>Voltar</button><button className="btn-primary" disabled={busy || !nome.trim()} onClick={salvar}>{busy ? <Spinner /> : 'Salvar perfil'}</button></>}>
      {erro && <div className="mb-3"><Alert>{erro}</Alert></div>}
      <label className="label">Nome do perfil</label>
      <input className="input" autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Vendas, Expedição, Consulta" />
      <div className="mt-4 divide-y divide-line rounded-lg border border-line">
        {AREAS.map((a) => (
          <div key={a.chave} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
            <div><p className="text-sm font-medium">{a.label}</p><p className="text-xs text-muted">{a.descricao}</p></div>
            <div className="flex overflow-hidden rounded-lg border border-line text-xs" role="radiogroup" aria-label={a.label}>
              {NIVEIS.map((n) => (
                <button key={n.valor} type="button" role="radio" aria-checked={nivelDe(permissoes, a.chave) === n.valor}
                  className={`px-3 py-1.5 transition ${nivelDe(permissoes, a.chave) === n.valor ? 'bg-brand text-white' : 'bg-white hover:bg-fog'}`}
                  onClick={() => setPermissoes((atual) => ({ ...atual, [a.chave]: n.valor }))}>{n.label}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
