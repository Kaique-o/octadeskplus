import SettingsTabs from './SettingsTabs';
import GestaoUsuarios from './GestaoUsuarios';
import { useEmpresas } from '../lib/empresas';
import { usePode } from '../lib/permissao';

/** Usuários da empresa aberta. Quem tem "Usuários: edita" no perfil cria, edita e exclui; os demais só veem. */
export default function Usuarios() {
  const { atual } = useEmpresas();
  const { podeEditar } = usePode('usuarios');
  return (
    <div className="space-y-6">
      <SettingsTabs />
      {atual && <GestaoUsuarios empresa={atual} podeGerenciar={podeEditar} />}
    </div>
  );
}
