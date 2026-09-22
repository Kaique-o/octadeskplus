import Stats from './Stats';
import { useSession } from '../lib/session';
import { useEmpresas } from '../lib/empresas';

/** Tela inicial: banner de boas-vindas e, abaixo dele, as estatísticas de execução. */
export default function Home() {
  const { profile } = useSession();
  const { atual } = useEmpresas();
  const primeiroNome = profile?.full_name?.trim().split(/\s+/)[0];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-ink to-brand p-8 text-white shadow-sm md:p-10">
        <p className="text-sm font-medium text-white/70">{atual?.nome}</p>
        <h1 className="mt-1 font-title text-3xl font-bold tracking-tight md:text-4xl">
          {primeiroNome ? `Olá, ${primeiroNome}` : 'Olá'}
        </h1>
        <p className="mt-3 max-w-xl text-white/80">
          Os sinais do metrics viram conversas no WhatsApp pelo Octadesk, sem ninguém precisar lembrar de mandar mensagem.
        </p>
      </section>

      <Stats />
    </div>
  );
}
