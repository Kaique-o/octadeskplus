import { useEffect, useState } from 'react';
import { ExternalLink, Users } from 'lucide-react';
import { EmptyState, Spinner } from '../components/ui';
import SettingsTabs from './SettingsTabs';
import { METRICS_URL, supabase } from '../lib/supabase';
import { useSession } from '../lib/session';

interface Usuario {
  id: string; nome: string | null; email: string; papel: string | null; perfil_acesso: string | null;
  pode_ver: boolean; pode_editar: boolean;
}

const PAPEL: Record<string, string> = { owner: 'Dono', superadmin: 'Administrador', viewer: 'Usuário' };

function Acesso({ u }: { u: Usuario }) {
  if (u.pode_editar) return <span className="chip bg-green-100 text-success">Edita</span>;
  if (u.pode_ver) return <span className="chip bg-brand-soft text-blue-800">Só vê</span>;
  return <span className="chip bg-fog text-muted">Sem acesso</span>;
}

/** Usuários do metrics e o que cada um pode no Octadesk Plus. Só leitura: cadastro e permissões são no metrics. */
export default function Usuarios() {
  const { session } = useSession();
  const [itens, setItens] = useState<Usuario[] | null>(null);

  useEffect(() => {
    supabase.rpc('listar_usuarios').then(({ data }) => setItens((data as Usuario[]) ?? []));
  }, []);

  return (
    <div className="space-y-6">
      <SettingsTabs />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-fog px-4 py-3 text-sm">
        <span>O login é o do metrics. Convidar, remover e mudar permissões (recurso <b>octaplus</b> no perfil de acesso) é feito lá.</span>
        <a className="btn-ghost" href={`${METRICS_URL}/usuarios`} target="_blank" rel="noreferrer">
          Gerenciar no metrics <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      {!itens ? <Spinner /> : itens.length === 0 ? (
        <EmptyState icon={<Users />} title="Nenhum usuário" text="Os usuários cadastrados no metrics aparecem aqui." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Usuário</th>
                <th className="px-4 py-3 font-medium">Papel no metrics</th>
                <th className="px-4 py-3 font-medium">Perfil de acesso</th>
                <th className="px-4 py-3 font-medium">Octadesk Plus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {itens.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{u.nome ?? u.email}{u.id === session?.user.id && <span className="ml-2 text-xs font-normal text-muted">(você)</span>}</p>
                    {u.nome && <p className="text-xs text-muted">{u.email}</p>}
                  </td>
                  <td className="px-4 py-3">{u.papel ? PAPEL[u.papel] ?? u.papel : '—'}</td>
                  <td className="px-4 py-3">{u.perfil_acesso ?? '—'}</td>
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
