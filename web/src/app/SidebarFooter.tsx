import { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ChevronDown, HelpCircle, LogOut, Settings, UserCircle2 } from 'lucide-react';

export interface FooterUsuario {
  nome: string;
  cargo: string;
}

interface Props {
  usuario: FooterUsuario;
  /** Ajuda da tela atual; ausente deixa o botão desabilitado, nunca escondido. */
  onAjuda?: () => void;
  onSair: () => void;
  onNavegar: () => void;
}

const iniciais = (nome: string) => {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return 'U';
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primeira + ultima).toUpperCase();
};

/** Rodapé da sidebar: ajuda, configurações e card do usuário. */
export default function SidebarFooter({ usuario, onAjuda, onSair, onNavegar }: Props) {
  const [aberto, setAberto] = useState(false);
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!card.current?.contains(e.target as Node)) setAberto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc); };
  }, [aberto]);

  return (
    <div className="sidebar-footer">
      <button
        type="button" className="nav-item" onClick={onAjuda} disabled={!onAjuda}
        title={onAjuda ? 'Ajuda desta tela' : 'Ainda não há ajuda escrita para esta tela'}
      >
        <HelpCircle size={20} strokeWidth={1.8} />
        Ajuda
      </button>

      <NavLink to="/app/configuracoes" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} onClick={onNavegar}>
        <Settings size={20} strokeWidth={1.8} />
        Configurações
      </NavLink>

      <div
        ref={card} className="sidebar-user" role="button" tabIndex={0}
        aria-haspopup="true" aria-expanded={aberto} aria-label={`Menu de ${usuario.nome}`}
        onClick={() => setAberto(!aberto)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAberto(!aberto); } }}
      >
        <span className="avatar">{iniciais(usuario.nome)}</span>
        <span className="user-meta">
          <strong>{usuario.nome}</strong>
          <span>{usuario.cargo}</span>
        </span>
        <ChevronDown size={16} strokeWidth={1.8} className="user-chevron" />

        <div className={`user-menu${aberto ? ' open' : ''}`}>
          <Link to="/app/perfil" className="user-menu-item" onClick={onNavegar}>
            <UserCircle2 size={16} strokeWidth={1.8} />Meu perfil
          </Link>
          <Link to="/app/configuracoes" className="user-menu-item" onClick={onNavegar}>
            <Settings size={16} strokeWidth={1.8} />Configurações
          </Link>
          <button type="button" className="user-menu-item danger" onClick={onSair}>
            <LogOut size={16} strokeWidth={1.8} />Sair
          </button>
        </div>
      </div>
    </div>
  );
}
