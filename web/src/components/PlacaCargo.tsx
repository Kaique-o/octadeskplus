export type TipoCargo = 'owner' | 'master' | 'comum';

const ESTILO: Record<TipoCargo, string> = {
  owner: 'placa placa-ouro',
  master: 'placa placa-prata',
  comum: 'border border-line bg-white text-ink',
};

/** Placa com o nome do cargo: Owner dourada, Master prateada, os demais em card branco. */
export default function PlacaCargo({ tipo, nome, pequena }: { tipo: TipoCargo; nome: string; pequena?: boolean }) {
  return pequena ? (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${ESTILO[tipo]}`}>{nome}</span>
  ) : (
    <div className={`grid min-h-24 place-items-center rounded-2xl px-6 py-7 ${ESTILO[tipo]}`}>
      <span className="font-title text-3xl font-bold tracking-wide">{nome}</span>
    </div>
  );
}
