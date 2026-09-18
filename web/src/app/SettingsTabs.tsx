import { NavLink } from 'react-router-dom';
import { PageHeader } from '../components/ui';

const ABAS = [
  { to: '/app/configuracoes', end: true, label: 'Integrações' },
  { to: '/app/configuracoes/api', end: false, label: 'API' },
  { to: '/app/configuracoes/nao-perturbe', end: false, label: 'Não perturbe' },
];

/** Cabeçalho e abas compartilhados pelas telas de Configurações. */
export default function SettingsTabs() {
  return (
    <>
      <PageHeader title="Configurações" subtitle="Octadesk, horário de envio, chaves de API e quem não recebe mensagens. Usuários e permissões ficam no metrics." />
      <div className="mb-6 flex gap-1 border-b border-line">
        {ABAS.map((a) => (
          <NavLink key={a.to} to={a.to} end={a.end}
            className={({ isActive }) => `-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${isActive ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'}`}>
            {a.label}
          </NavLink>
        ))}
      </div>
    </>
  );
}
