import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AuthShell from './AuthShell';
import { Alert, Spinner } from '../components/ui';
import { errorMessage, supabase } from '../lib/supabase';
import { useSession } from '../lib/session';

export default function Login() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { session, loading } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    if (loading || !session) return;
    const next = params.get('next');
    nav(next || '/app', { replace: true });
  }, [loading, session, nav, params]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(''); setInfo('');
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/redefinir-senha` });
        if (error) throw error;
        setInfo('Se o e-mail existir, você receberá um link para redefinir a senha.');
      }
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }

  return (
    <AuthShell
      title={mode === 'login' ? 'Entrar' : 'Esqueci minha senha'}
      subtitle={mode === 'login' ? 'Acesse sua conta para gerenciar integrações e automações.' : 'Enviaremos um link de redefinição para o seu e-mail.'}
      footer={<>Use o mesmo login do metrics.</>}
    >
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        {info && <Alert kind="success">{info}</Alert>}
        <div><label className="label">E-mail</label><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email corporativo" autoComplete="email" /></div>
        {mode === 'login' && (
          <div><label className="label">Senha</label><input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" autoComplete="current-password" /></div>
        )}
        <button type="button" className="text-sm font-medium text-brand hover:underline" onClick={() => { setMode(mode === 'login' ? 'forgot' : 'login'); setError(''); setInfo(''); }}>
          {mode === 'login' ? 'Esqueci minha senha' : 'Voltar para o login'}
        </button>
        <button className="btn-primary w-full py-3" disabled={busy}>{busy ? <Spinner /> : mode === 'login' ? 'Entrar' : 'Enviar link'}</button>
      </form>
    </AuthShell>
  );
}
