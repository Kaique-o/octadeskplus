import { NavLink } from 'react-router-dom';
import { PageHeader } from '../components/ui';
import { useSession } from '../lib/session';

const ABAS = [
  { to: '/app/configuracoes', end: true, label: 'Integrações' },
  { to: '/app/configuracoes/empresa', end: false, label: 'Empresa' },
  { to: '/app/configuracoes/usuarios', end: false, label: 'Usuários' },
  { to: '/app/configuracoes/api', end: false, label: 'API' },
  { to: '/app/configuracoes/nao-perturbe', end: false, label: 'Não perturbe' },
];
// só o dono da plataforma vê
const OWNER = { to: '/app/configuracoes/owner', end: false, label: 'Owner' };

/** Cabeçalho e abas compartilhados pelas telas de Configurações. */
export default function SettingsTabs() {
  const { eDono } = useSession();
  const abas = eDono ? [...ABAS, OWNER] : ABAS;
  return (
    <>
      <PageHeader title="Configurações" subtitle="Octadesk, dados da empresa, usuários, chaves de API e quem não recebe mensagens." />
      <div className="mb-6 flex gap-1 border-b border-line">
        {abas.map((a) => (
          <NavLink key={a.to} to={a.to} end={a.end}
            className={({ isActive }) => `-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${isActive ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'}`}>
            {a.label}
          </NavLink>
        ))}
      </div>
    </>
  );
}
