import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from './AuthShell';
import { Alert, Spinner } from '../components/ui';
import { errorMessage, supabase } from '../lib/supabase';
import { useSession } from '../lib/session';

/** Destino do link "esqueci minha senha": o Supabase já abre a sessão de recuperação pela URL. */
export default function ResetPassword() {
  const nav = useNavigate();
  const { session, loading } = useSession();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres.');
    if (password !== confirm) return setError('As senhas não conferem.');
    setBusy(true); setError('');
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    nav('/app', { replace: true });
  }

  if (loading) return <AuthShell title="Redefinir senha"><div className="flex justify-center py-6"><Spinner /></div></AuthShell>;

  if (!session) {
    return (
      <AuthShell title="Link inválido" subtitle="Este link de redefinição expirou ou já foi usado."
        footer={<Link to="/entrar" className="font-medium text-brand hover:underline">Voltar para o login e pedir um novo</Link>}>
        {null}
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Redefinir senha" subtitle={`Escolha uma nova senha para ${session.user.email ?? 'sua conta'}.`}>
      <form onSubmit={submit} className="space-y-3.5">
        {error && <Alert>{error}</Alert>}
        <input className="input" type="password" required placeholder="Nova senha (mínimo de 8 caracteres)" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        <input className="input" type="password" required placeholder="Confirmar nova senha" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        <button className="btn-primary w-full py-3" disabled={busy}>{busy ? <Spinner /> : 'Salvar nova senha'}</button>
      </form>
    </AuthShell>
  );
}
