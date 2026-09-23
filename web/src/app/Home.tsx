import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import Stats from './Stats';
import { useSession } from '../lib/session';
import { useEmpresas } from '../lib/empresas';
import { usePode } from '../lib/permissao';
import { supabase } from '../lib/supabase';
import { problemasDaEmpresa, type IntegracaoExterna, type Problema } from '../lib/saude';
import type { Integracao } from '../lib/types';

/** Tela inicial: banner (azul quando tudo está normal, vermelho com o log quando algo precisa de atenção) e estatísticas. */
export default function Home() {
  const { profile } = useSession();
  const { atual } = useEmpresas();
  const { podeVer: veIntegracoes } = usePode('integracoes');
  // null = ainda verificando: não mostra nenhum dos dois banners, para o azul não piscar antes do vermelho
  const [problemas, setProblemas] = useState<Problema[] | null>(null);
  const primeiroNome = profile?.full_name?.trim().split(/\s+/)[0];

  useEffect(() => {
    setProblemas(null);
    Promise.all([
      supabase.from('integracao_octadesk').select('*').maybeSingle(),
      supabase.from('integracoes_externas').select('tipo, status, ultimo_erro, atualizada_em'),
    ]).then(([{ data: octa }, { data: externas }]) =>
      setProblemas(problemasDaEmpresa(octa as Integracao | null, (externas as IntegracaoExterna[]) ?? [])));
  }, [atual?.id]);

  const saudacao = primeiroNome ? `Olá, ${primeiroNome}` : 'Olá';

  return (
    <div className="space-y-6">
      {problemas === null ? (
        <section className="h-44 animate-pulse rounded-2xl border border-line bg-fog md:h-48" aria-hidden />
      ) : problemas.length === 0 ? (
        <section className="overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-ink to-brand p-8 text-white shadow-sm md:p-10">
          <p className="text-sm font-medium text-white/70">{atual?.nome}</p>
          <h1 className="mt-1 font-title text-3xl font-bold tracking-tight md:text-4xl">{saudacao}</h1>
          <p className="mt-3 max-w-xl text-white/80">
            Suas automações conversam com os clientes pelo Octadesk no momento certo, sem ninguém precisar lembrar.
          </p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-red-300 bg-gradient-to-br from-red-900 via-red-700 to-rose-500 p-8 text-white shadow-sm md:p-10" role="alert">
          <p className="text-sm font-medium text-white/75">{atual?.nome} · {saudacao}</p>
          <h1 className="mt-1 flex items-center gap-3 font-title text-3xl font-bold tracking-tight md:text-4xl">
            <AlertTriangle className="h-8 w-8 shrink-0" strokeWidth={2} />
            {problemas.length === 1 ? problemas[0].titulo : `${problemas.length} problemas precisam da sua atenção`}
          </h1>
          <ul className="mt-5 space-y-3">
            {problemas.map((p) => (
              <li key={p.titulo} className="rounded-xl bg-black/20 p-4 backdrop-blur-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    {problemas.length > 1 && <p className="font-semibold">{p.titulo}</p>}
                    <p className="text-sm text-white/85">{p.detalhe}</p>
                  </div>
                  {veIntegracoes && (
                    <Link to={p.link} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-red-800 transition hover:bg-red-50">
                      Resolver<ChevronRight className="h-4 w-4" />
                    </Link>
                  )}
                </div>
                {p.log && <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-black/30 px-3 py-2 font-mono text-xs text-red-50">{p.log}</pre>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Stats />
    </div>
  );
}
