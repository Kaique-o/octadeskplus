import { useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Alert, Modal, PageHeader, Spinner } from '../components/ui';
import { errorMessage, supabase } from '../lib/supabase';
import { useSession } from '../lib/session';
import { useEmpresas } from '../lib/empresas';
import PlacaCargo from '../components/PlacaCargo';
import FotoEditavel from '../components/FotoEditavel';
import { iniciais as iniciaisDe } from './SidebarFooter';

/** Dados do próprio usuário. Grava em public.profiles (no banco do metrics, muda lá também). */
export default function Profile() {
  const { session, profile, refresh } = useSession();
  const { atual } = useEmpresas();
  const [nome, setNome] = useState('');
  const [trocandoSenha, setTrocandoSenha] = useState(false);
  const [aviso, setAviso] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { if (profile) setNome(profile.full_name ?? ''); }, [profile]);
  const flash = (kind: 'success' | 'error', text: string) => { setAviso({ kind, text }); setTimeout(() => setAviso(null), 4000); };

  // foto do próprio perfil (octaplus.fotos_usuario); recarrega a sessão para o card do menu mudar junto
  async function salvarFoto(foto: string | null) {
    const { error } = await supabase.rpc('salvar_minha_foto', { p_foto: foto ?? '' });
    if (!error) { await refresh(); flash('success', foto ? 'Foto atualizada.' : 'Foto removida.'); }
    return error;
  }

  async function salvar() {
    const { error } = await supabase.schema('public').from('profiles').update({ full_name: nome.trim() || null }).eq('id', session!.user.id);
    if (error) return flash('error', errorMessage(error));
    await refresh();
    flash('success', 'Perfil atualizado.');
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Meu perfil" subtitle="Seu nome e sua senha de acesso ao painel." />
      {aviso && <Alert kind={aviso.kind}>{aviso.text}</Alert>}

      <section className="card p-5">
        {atual && <div><PlacaCargo tipo={atual.perfil_tipo} nome={atual.perfil} /></div>}
        <div className="mt-4 flex items-center gap-4">
          <FotoEditavel foto={profile?.foto} alt="Sua foto" tamanho="xl" redonda titulo="Sua foto"
            classeVazio="bg-ink text-white" vazio={<span className="font-title text-xl font-bold">{iniciaisDe(nome || session?.user.email || '')}</span>}
            ajuda="Aparece no seu card do menu." onSalvar={salvarFoto} />
          <p className="text-sm text-muted">Passe o mouse na foto e clique no lápis para trocar.</p>
        </div>
        <div className="mt-4 space-y-3">
          <div><label className="label">Nome</label><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div>
            <label className="label">E-mail</label>
            <input className="input" disabled value={session?.user.email ?? ''} />
            <p className="mt-1 text-xs text-muted">O e-mail identifica o login e não muda por aqui.</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <button className="btn-primary" onClick={salvar}>Salvar perfil</button>
          <button className="btn-ghost" onClick={() => setTrocandoSenha(true)}><KeyRound className="h-4 w-4" />Alterar senha</button>
        </div>
      </section>

      {trocandoSenha && <TrocarSenha onClose={() => setTrocandoSenha(false)} onFeito={() => { setTrocandoSenha(false); flash('success', 'Senha alterada.'); }} />}
    </div>
  );
}

function TrocarSenha({ onClose, onFeito }: { onClose: () => void; onFeito: () => void }) {
  const [senha, setSenha] = useState({ nova: '', confirmar: '' });
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');

  async function trocar() {
    if (senha.nova.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.');
    if (senha.nova !== senha.confirmar) return setErro('As senhas não conferem.');
    setBusy(true); setErro('');
    const { error } = await supabase.auth.updateUser({ password: senha.nova });
    setBusy(false);
    if (error) return setErro(errorMessage(error));
    onFeito();
  }

  return (
    <Modal open title="Alterar senha" onClose={onClose}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={trocar} disabled={busy || !senha.nova || !senha.confirmar}>{busy ? <Spinner /> : 'Alterar senha'}</button></>}>
      {erro && <div className="mb-3"><Alert>{erro}</Alert></div>}
      <p className="mb-4 text-sm text-muted">Mínimo de 8 caracteres. Você continua conectado depois da troca.</p>
      <div className="space-y-3">
        <div><label className="label">Nova senha</label><input className="input" type="password" autoFocus autoComplete="new-password" value={senha.nova} onChange={(e) => setSenha({ ...senha, nova: e.target.value })} /></div>
        <div><label className="label">Confirmar nova senha</label><input className="input" type="password" autoComplete="new-password" value={senha.confirmar} onChange={(e) => setSenha({ ...senha, confirmar: e.target.value })} /></div>
      </div>
    </Modal>
  );
}
