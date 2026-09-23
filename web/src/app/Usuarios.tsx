import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import { EmptyState, Spinner } from '../components/ui';
import SettingsTabs from './SettingsTabs';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/session';
import { useEmpresas } from '../lib/empresas';

interface Usuario { id: string; nome: string | null; email: string; nivel: 'ver' | 'editar'; ativo: boolean }

function Acesso({ u }: { u: Usuario }) {
  if (!u.ativo) return <span className="chip bg-fog text-muted">Inativo</span>;
  if (u.nivel === 'editar') return <span className="chip bg-green-100 text-success">Edita</span>;
  return <span className="chip bg-brand-soft text-blue-800">Só vê</span>;
}

/** Quem tem acesso à empresa aberta. Só leitura: quem gerencia é o dono, em Configurações › Owner. */
export default function Usuarios() {
  const { session, eDono } = useSession();
  const { atual } = useEmpresas();
  const [itens, setItens] = useState<Usuario[] | null>(null);

  useEffect(() => {
    supabase.rpc('listar_usuarios').then(({ data }) => setItens((data as Usuario[]) ?? []));
  }, []);

  return (
    <div className="space-y-6">
      <SettingsTabs />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-fog px-4 py-3 text-sm">
        <span>Usuários com acesso a <b>{atual?.nome}</b>. Adicionar, mudar o nível, redefinir senha e inativar é com o dono da plataforma.</span>
        {eDono && <Link className="btn-ghost" to="/app/configuracoes/owner">Gerenciar em Owner</Link>}
      </div>

      {!itens ? <Spinner /> : itens.length === 0 ? (
        <EmptyState icon={<Users />} title="Nenhum usuário nesta empresa" text="O dono da plataforma libera o acesso em Configurações › Owner." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Usuário</th>
                <th className="px-4 py-3 font-medium">Acesso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {itens.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{u.nome ?? u.email}{u.id === session?.user.id && <span className="ml-2 text-xs font-normal text-muted">(você)</span>}</p>
                    {u.nome && <p className="text-xs text-muted">{u.email}</p>}
                  </td>
                  <td className="px-4 py-3"><Acesso u={u} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
