import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { DEMO, demoSession } from './demo';

// Usuários: auth.users + public.profiles + user_roles (os do metrics, ou os da base de um projeto próprio).
export interface Profile { id: string; email: string; full_name: string | null }

interface SessionState {
  session: Session | null;
  profile: Profile | null;
  podeVer: boolean;
  podeEditar: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<SessionState>({ session: null, profile: null, podeVer: false, podeEditar: false, loading: true, refresh: async () => {} });

export function SessionProvider({ children }: { children: ReactNode }) {
  if (DEMO) {
    return (
      <Ctx.Provider value={{ ...demoSession, session: demoSession.session as unknown as Session, loading: false, refresh: async () => {} }}>
        {children}
      </Ctx.Provider>
    );
  }
  return <RealSessionProvider>{children}</RealSessionProvider>;
}

function RealSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [podeVer, setPodeVer] = useState(false);
  const [podeEditar, setPodeEditar] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (s: Session | null) => {
    setSession(s);
    if (!s) { setProfile(null); setPodeVer(false); setPodeEditar(false); setLoading(false); return; }
    const [{ data: p }, { data: ver }, { data: editar }] = await Promise.all([
      supabase.schema('public').from('profiles').select('id, email, full_name').eq('id', s.user.id).maybeSingle(),
      supabase.rpc('pode', { p_acao: 'ver' }),
      supabase.rpc('pode', { p_acao: 'editar' }),
    ]);
    setProfile((p as Profile) ?? { id: s.user.id, email: s.user.email ?? '', full_name: null });
    setPodeVer(Boolean(ver)); setPodeEditar(Boolean(editar));
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED' || event === 'PASSWORD_RECOVERY') load(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const refresh = useCallback(async () => { const { data } = await supabase.auth.getSession(); await load(data.session); }, [load]);

  return <Ctx.Provider value={{ session, profile, podeVer, podeEditar, loading, refresh }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
