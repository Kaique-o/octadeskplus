import type { ReactNode } from 'react';
import { Logo } from '../components/ui';
import { BRAND } from '../lib/constants';

export default function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <aside className="honeycomb relative hidden flex-col justify-between bg-ink p-10 text-white md:flex">
        <Logo light />
        <div>
          <h2 className="font-title text-4xl font-bold leading-tight">{BRAND.name}</h2>
          <p className="mt-3 max-w-sm text-white/70">Conecte negócio e tecnologia: configure integrações e automações com foco no resultado.</p>
        </div>
        <p className="text-xs text-white/40">© {new Date().getFullYear()} {BRAND.empresa}</p>
      </aside>
      <main className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm animate-pop">
          <span className="mb-8 inline-block md:hidden"><Logo /></span>
          <h1 className="font-title text-2xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
