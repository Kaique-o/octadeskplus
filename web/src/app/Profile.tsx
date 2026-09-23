import { useEffect, useState } from 'react';
import { Alert, PageHeader, Spinner } from '../components/ui';
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
  const [senha, setSenha] = useState({ nova: '', confirmar: '' });
  const [aviso, setAviso] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

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

  async function trocarSenha() {
    if (senha.nova.length < 8) return flash('error', 'A senha precisa ter pelo menos 8 caracteres.');
    if (senha.nova !== senha.confirmar) return flash('error', 'As senhas não conferem.');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: senha.nova });
    setBusy(false);
    if (error) return flash('error', errorMessage(error));
    setSenha({ nova: '', confirmar: '' });
    flash('success', 'Senha alterada.');
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Meu perfil" subtitle="Seu nome e sua senha de acesso ao painel." />
      {aviso && <Alert kind={aviso.kind}>{aviso.text}</Alert>}

      <section className="card max-w-xl p-5">
        <h2 className="font-semibold">Meus dados</h2>
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
          <button className="btn-primary" onClick={salvar}>Salvar perfil</button>
        </div>
      </section>

      <section className="card max-w-xl p-5">
        <h2 className="font-semibold">Senha</h2>
        <p className="mt-1 text-sm text-muted">Mínimo de 8 caracteres. Você continua conectado depois da troca.</p>
        <div className="mt-4 space-y-3">
          <div><label className="label">Nova senha</label><input className="input" type="password" autoComplete="new-password" value={senha.nova} onChange={(e) => setSenha({ ...senha, nova: e.target.value })} /></div>
          <div><label className="label">Confirmar nova senha</label><input className="input" type="password" autoComplete="new-password" value={senha.confirmar} onChange={(e) => setSenha({ ...senha, confirmar: e.target.value })} /></div>
          <button className="btn-ghost" onClick={trocarSenha} disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : 'Alterar senha'}</button>
        </div>
      </section>

      {atual && <div className="max-w-xl"><PlacaCargo tipo={atual.perfil_tipo} nome={atual.perfil} /></div>}
    </div>
  );
}
