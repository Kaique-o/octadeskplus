import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AuthShell from './AuthShell';
import { Alert, Spinner } from '../components/ui';
import { errorMessage, supabase } from '../lib/supabase';
import { useSession } from '../lib/session';

type Modo = 'entrar' | 'esqueci' | 'criar';

const TEXTOS: Record<Modo, { titulo: string; subtitulo: string; botao: string }> = {
  entrar: { titulo: 'Entrar', subtitulo: 'Acesse sua conta para gerenciar integrações e automações.', botao: 'Entrar' },
  esqueci: { titulo: 'Esqueci minha senha', subtitulo: 'Enviaremos um link de redefinição para o seu e-mail.', botao: 'Enviar link' },
  criar: { titulo: 'Primeiro acesso', subtitulo: 'Ainda não há ninguém cadastrado. Esta conta será a dona do painel.', botao: 'Criar conta' },
};

export default function Login() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { session, loading } = useSession();
  const [modo, setModo] = useState<Modo>('entrar');
  const [primeiroAcesso, setPrimeiroAcesso] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    if (loading || !session) return;
    const next = params.get('next');
    nav(next || '/app', { replace: true });
  }, [loading, session, nav, params]);

  // Sem nenhum usuário no banco, a tela abre direto em "Criar conta"
  useEffect(() => {
    supabase.rpc('primeiro_acesso').then(({ data }) => {
      if (data !== true) return;
      setPrimeiroAcesso(true);
      setModo('criar');
    });
  }, []);

  function trocar(m: Modo) { setModo(m); setError(''); setInfo(''); }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(''); setInfo('');
    if (modo === 'criar') {
      if (password.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres.');
      if (password !== confirmar) return setError('As senhas não conferem.');
    }
    setBusy(true);
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (modo === 'esqueci') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/redefinir-senha` });
        if (error) throw error;
        setInfo('Se o e-mail existir, você receberá um link para redefinir a senha.');
      } else {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: nome.trim() || null }, emailRedirectTo: `${location.origin}/entrar` },
        });
        if (error) throw error;
        setPrimeiroAcesso(false);
        // com confirmação de e-mail ligada no Supabase não vem sessão: falta clicar no link
        if (!data.session) {
          setModo('entrar'); setPassword(''); setConfirmar('');
          setInfo(`Conta criada. Enviamos um link de confirmação para ${email}; depois de confirmar, entre aqui.`);
        }
      }
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }

  const t = TEXTOS[modo];
  return (
    <AuthShell
      title={t.titulo}
      subtitle={t.subtitulo}
      footer={modo === 'entrar' && primeiroAcesso ? (
        <button type="button" className="font-medium text-brand hover:underline" onClick={() => trocar('criar')}>Primeiro acesso? Criar conta</button>
      ) : modo === 'criar' ? (
        <button type="button" className="font-medium text-brand hover:underline" onClick={() => trocar('entrar')}>Já tenho conta</button>
      ) : undefined}
    >
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        {info && <Alert kind="success">{info}</Alert>}
        {modo === 'criar' && (
          <div><label className="label">Nome</label><input className="input" required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" autoComplete="name" /></div>
        )}
        <div><label className="label">E-mail</label><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email corporativo" autoComplete="email" /></div>
        {modo !== 'esqueci' && (
          <div><label className="label">Senha</label><input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder={modo === 'criar' ? 'Mínimo de 8 caracteres' : 'Senha'} autoComplete={modo === 'criar' ? 'new-password' : 'current-password'} /></div>
        )}
        {modo === 'criar' && (
          <div><label className="label">Confirmar senha</label><input className="input" type="password" required value={confirmar} onChange={(e) => setConfirmar(e.target.value)} placeholder="Repita a senha" autoComplete="new-password" /></div>
        )}
        {modo !== 'criar' && (
          <button type="button" className="text-sm font-medium text-brand hover:underline" onClick={() => trocar(modo === 'entrar' ? 'esqueci' : 'entrar')}>
            {modo === 'entrar' ? 'Esqueci minha senha' : 'Voltar para o login'}
          </button>
        )}
        <button className="btn-primary w-full py-3" disabled={busy}>{busy ? <Spinner /> : t.botao}</button>
      </form>
    </AuthShell>
  );
}
