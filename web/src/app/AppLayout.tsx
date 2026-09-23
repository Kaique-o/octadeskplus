import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import { Modal } from '../components/ui';
import { AJUDA, NAV } from './nav';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/session';
import { useEmpresas } from '../lib/empresas';
import './sidebar.css';


export default function AppLayout() {
  const { profile, session } = useSession();
  const { atual } = useEmpresas();
  const [menuAberto, setMenuAberto] = useState(false);
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const loc = useLocation();

  useEffect(() => { setMenuAberto(false); }, [loc.pathname]);

  const ajuda = AJUDA[loc.pathname];
  const titulo = NAV.find((x) => (x.end ? loc.pathname === x.to : loc.pathname.startsWith(x.to)))?.label
    ?? (loc.pathname === '/app' ? 'Início' : loc.pathname.startsWith('/app/perfil') ? 'Meu perfil' : 'Configurações');
  const usuario = {
    nome: profile?.full_name || session?.user.email || 'Usuário',
    cargo: atual?.perfil ?? '',
  };

  return (
    <div className={`painel${menuAberto ? ' menu-aberto' : ''}`}>
      <Sidebar
        usuario={usuario}
        onAjuda={ajuda ? () => setAjudaAberta(true) : undefined}
        onSair={() => supabase.auth.signOut()}
        onNavegar={() => setMenuAberto(false)}
      />

      <div className="overlay" onClick={() => setMenuAberto(false)} />

      <div className="topo">
        <button type="button" className="topo-botao" onClick={() => setMenuAberto(true)} aria-label="Abrir menu">
          <Menu size={22} strokeWidth={1.8} />
        </button>
        <span className="topo-titulo">{titulo}</span>
      </div>

      <div className="conteudo">
        <div className="mx-auto max-w-5xl">
          <Outlet />
        </div>
      </div>

      <Modal open={ajudaAberta} title={ajuda?.titulo ?? 'Ajuda'} onClose={() => setAjudaAberta(false)}>
        <p className="text-sm leading-relaxed text-muted">{ajuda?.texto}</p>
      </Modal>
    </div>
  );
}
