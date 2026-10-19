import { ymd } from './SelectorFecha';
import { SelectorFecha } from './SelectorFecha';
import { cn } from '../lib/formato';
import { atajosPeriodo, type PeriodoPanel } from '../lib/periodo-panel';

/**
 * Elegir de qué días se ven los datos: un atajo (Hoy, Este mes…), un día, o un rango.
 * "Fecha" sola es ese día; con "hasta" es el rango.
 */
export function BarraPeriodo({ periodo, cambiar }: { periodo: PeriodoPanel; cambiar: (r: { desde?: string; hasta?: string }) => void }) {
  const hoy = ymd(new Date());
  const unDia = periodo.desde === periodo.hasta;
  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-borde bg-superficie px-4 py-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Periodo">
        {atajosPeriodo().map((a) => {
          const activo = periodo.atajo === a.clave;
          return (
            <button
              key={a.clave}
              type="button"
              aria-pressed={activo}
              onClick={() => cambiar({ desde: a.desde, hasta: a.hasta })}
              className={cn(
                'h-8 rounded-full border px-3 text-sm whitespace-nowrap transition-colors',
                activo ? 'border-tinta bg-marca-500 font-medium text-tinta' : 'border-borde text-tenue hover:border-tinta/30 hover:text-tinta',
              )}
            >
              {a.texto}
            </button>
          );
        })}
      </div>
      <span className="hidden h-6 w-px bg-borde md:block" aria-hidden />
      <div className="flex flex-wrap items-center gap-2 text-sm text-tenue">
        <span>Fecha</span>
        <SelectorFecha
          corto
          className={cn('h-8 w-auto min-w-36', !periodo.atajo && 'border-tinta/40')}
          aria-label="Fecha o inicio del rango"
          value={periodo.desde}
          max={hoy}
          onChange={(v) => v && cambiar({ desde: v, hasta: unDia ? v : periodo.hasta < v ? v : periodo.hasta })}
        />
        <span>hasta</span>
        <SelectorFecha
          corto
          vacio="un solo día"
          className={cn('h-8 w-auto min-w-36', !unDia && !periodo.atajo && 'border-tinta/40')}
          aria-label="Fin del rango (opcional)"
          value={unDia ? '' : periodo.hasta}
          min={periodo.desde}
          max={hoy}
          onChange={(v) => cambiar({ desde: periodo.desde, hasta: v || periodo.desde })}
        />
      </div>
    </div>
  );
}
