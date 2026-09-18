import { NavLink } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import SidebarFooter, { type FooterUsuario } from './SidebarFooter';
import { Logo } from '../components/ui';
import { NAV } from './nav';
import { BRAND } from '../lib/constants';

interface Props {
  usuario: FooterUsuario;
  onAjuda?: () => void;
  onSair: () => void;
  /** Fecha o menu fora da tela no mobile. */
  onNavegar: () => void;
  /** Rota do nível acima; ausente esconde o botão voltar. */
  onVoltar?: () => void;
}

export default function Sidebar({ usuario, onAjuda, onSair, onNavegar, onVoltar }: Props) {
  return (
    <aside className="sidebar">
      <div className={`brand-linha${onVoltar ? '' : ' brand-linha--solo'}`}>
        {onVoltar && (
          <button type="button" className="brand-voltar" onClick={onVoltar} aria-label="Voltar" title="Voltar">
            <ChevronLeft size={18} strokeWidth={2} />
          </button>
        )}
        <NavLink to="/app" end className="brand" onClick={onNavegar} aria-label={BRAND.name}>
          <Logo className="h-7" />
        </NavLink>
      </div>

      <nav className="nav" aria-label="menu principal">
        {NAV.map(({ chave, to, end, icone: Icone, label }) => (
          <NavLink key={chave} to={to} end={end} onClick={onNavegar}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <Icone size={20} strokeWidth={1.8} />
            {label}
          </NavLink>
        ))}
      </nav>

      <SidebarFooter usuario={usuario} onAjuda={onAjuda} onSair={onSair} onNavegar={onNavegar} />
    </aside>
  );
}
