import type { ReactNode } from 'react';
import { Loader2, X } from 'lucide-react';
import { OctadeskLogo } from './LogoOctadesk';

/** Marca da Octadesk seguida do "+". Em fundo escuro, `light` pinta tudo de branco. */
export function Logo({ light = false, className = 'h-6' }: { light?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${light ? 'text-white' : 'text-ink'}`}>
      <OctadeskLogo className={className} />
      <span className={`font-title text-2xl font-semibold leading-none ${light ? 'text-white' : 'text-brand'}`}>+</span>
    </span>
  );
}

export const Spinner = ({ className = 'h-5 w-5' }: { className?: string }) => <Loader2 className={`animate-spin text-brand ${className}`} />;

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-title text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Alert({ kind = 'error', children }: { kind?: 'error' | 'success' | 'warning' | 'info'; children: ReactNode }) {
  const styles = {
    error: 'border-red-200 bg-red-50 text-danger',
    success: 'border-green-200 bg-green-50 text-success',
    warning: 'border-blue-200 bg-blue-50 text-blue-800',
    info: 'border-line bg-fog text-ink',
  }[kind];
  return <div className={`rounded-lg border px-3 py-2.5 text-sm ${styles}`}>{children}</div>;
}

export function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} disabled={disabled}
      onClick={() => onChange(!checked)}
      className="block h-6 w-11 shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-50"
    >
      {/* SVG em vez de caixas CSS: o Firefox com zoom fracionado arredonda trilho e bolinha para pixels diferentes
          e a bolinha encostava na borda. Num SVG os dois são uma figura só, sempre concêntricos; folga de 3px
          para que, mesmo em zoom baixo, sobre ao menos um pixel físico de azul em volta. */}
      <svg viewBox="0 0 44 24" className="block h-full w-full" aria-hidden="true">
        <rect width="44" height="24" rx="12" className={`transition-colors ${checked ? 'fill-brand' : 'fill-gray-300'}`} />
        <circle
          cx="12" cy="12" r="9" className="fill-white transition-transform"
          style={{ transform: checked ? 'translateX(20px)' : 'none', filter: 'drop-shadow(0 1px 1.5px rgb(0 0 0 / 0.15))' }}
        />
      </svg>
    </button>
  );
}

export function Modal({ open, title, onClose, children, footer, largo }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; largo?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onMouseDown={onClose}>
      <div className={`card w-full ${largo ? 'max-w-4xl' : 'max-w-lg'} animate-pop shadow-xl`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-title text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-fog" aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

const STATUS: Record<string, [string, string]> = {
  connected: ['Conectado', 'bg-green-100 text-success'],
  checking: ['Validando…', 'bg-brand-soft text-blue-800'],
  error: ['Erro', 'bg-red-100 text-danger'],
  missing: ['Não configurado', 'bg-fog text-muted'],
  success: ['Sucesso', 'bg-green-100 text-success'],
  skipped: ['Ignorado', 'bg-gray-100 text-muted'],
  pending: ['Agendado', 'bg-brand-soft text-blue-800'],
  running: ['Executando', 'bg-blue-100 text-blue-700'],
  sucesso: ['Sucesso', 'bg-green-100 text-success'],
  ignorado: ['Sem envio', 'bg-gray-100 text-muted'],
  erro: ['Erro', 'bg-red-100 text-danger'],
  pendente: ['Agendado', 'bg-brand-soft text-blue-800'],
  executando: ['Executando', 'bg-blue-100 text-blue-700'],
};

/** Texto do status como aparece no chip (também usado na exportação). */
export const rotuloStatus = (status: string) => STATUS[status]?.[0] ?? status;

export function StatusChip({ status }: { status: string }) {
  const [label, cls] = STATUS[status] ?? [status, 'bg-fog text-muted'];
  return <span className={`chip ${cls}`}>{label}</span>;
}

export function OptionCard({ selected, onClick, title, subtitle, disabled }: { selected: boolean; onClick: () => void; title: string; subtitle?: string; disabled?: boolean }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${selected ? 'border-brand bg-brand-soft font-semibold' : 'border-line bg-white hover:border-gray-400'}`}
    >
      {title}
      {subtitle && <span className="mt-0.5 block text-xs font-normal text-muted">{subtitle}</span>}
    </button>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-brand-soft text-brand">{icon}</div>
      <h3 className="font-title text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
