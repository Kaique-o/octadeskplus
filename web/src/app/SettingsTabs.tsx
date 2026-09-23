import { NavLink } from 'react-router-dom';
import { PageHeader } from '../components/ui';
import { useSession } from '../lib/session';
import { nivelDe, usePermissoes, type Area, type Permissoes } from '../lib/permissao';

const ABAS: { to: string; end: boolean; label: string; area: Area }[] = [
  { to: '/app/configuracoes', end: true, label: 'Octadesk', area: 'integracoes' },
  { to: '/app/configuracoes/integracoes', end: false, label: 'Integrações', area: 'integracoes' },
  { to: '/app/configuracoes/empresa', end: false, label: 'Empresa', area: 'empresa' },
  { to: '/app/configuracoes/usuarios', end: false, label: 'Usuários', area: 'usuarios' },
  { to: '/app/configuracoes/api', end: false, label: 'API', area: 'api' },
  { to: '/app/configuracoes/nao-perturbe', end: false, label: 'Não perturbe', area: 'nao_perturbe' },
];
// só o dono da plataforma vê
const OWNER = { to: '/app/configuracoes/owner', end: false, label: 'Owner' };

/** Abas de Configurações que o perfil deixa ver, na ordem do menu. */
export const abasVisiveis = (p: Permissoes) => ABAS.filter((a) => nivelDe(p, a.area) !== 'nenhum');

/** Para onde leva o "Configurações" do rodapé: a primeira aba liberada. */
export function destinoConfiguracoes(p: Permissoes, eDono: boolean) {
  return abasVisiveis(p)[0]?.to ?? (eDono ? OWNER.to : null);
}

/** Cabeçalho e abas compartilhados pelas telas de Configurações. */
export default function SettingsTabs() {
  const { eDono } = useSession();
  const permissoes = usePermissoes();
  const abas = [...abasVisiveis(permissoes), ...(eDono ? [OWNER] : [])];
  return (
    <>
      <PageHeader title="Configurações" subtitle="Octadesk, dados da empresa, usuários, chaves de API e quem não recebe mensagens." />
      <div className="mb-6 flex flex-wrap gap-1 border-b border-line">
        {abas.map((a) => (
          <NavLink key={a.to} to={a.to} end={a.end}
            className={({ isActive }) => `-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${isActive ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'}`}>
            {a.label}
          </NavLink>
        ))}
      </div>
    </>
  );
}
