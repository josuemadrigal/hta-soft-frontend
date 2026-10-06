import { useEffect, useState } from 'react';
import { cn } from '../lib/formato';
import { Selector } from './Selector';
import { Entrada } from './ui';

const PRIMER_ANIO = 2017; // inicio de los registros

export const trimestreActual = () => Math.floor(new Date().getMonth() / 3) + 1;

/** Rango de fechas (YYYY-MM-DD) de un trimestre. */
export function rangoTrimestre(anio: number, t: number) {
  const fin = new Date(Date.UTC(anio, t * 3, 0));
  return { desde: `${anio}-${String((t - 1) * 3 + 1).padStart(2, '0')}-01`, hasta: fin.toISOString().slice(0, 10) };
}

/** Si el rango coincide exactamente con un trimestre, cuál es. */
export function trimestreDe(desde?: string | null, hasta?: string | null) {
  const m = desde?.match(/^(\d{4})-(01|04|07|10)-01$/);
  if (!m) return null;
  const anio = Number(m[1]);
  const t = (Number(m[2]) - 1) / 3 + 1;
  return rangoTrimestre(anio, t).hasta === hasta ? { anio, t } : null;
}

const NOMBRES_T = ['enero–marzo', 'abril–junio', 'julio–septiembre', 'octubre–diciembre'];

/**
 * Año + botones T1–T4: un clic aplica el rango de ese trimestre. Si el rango actual es un
 * trimestre, queda marcado; cambiar el año con un trimestre elegido aplica el mismo en el año nuevo.
 * En el año en curso, los trimestres que aún no empiezan están desactivados.
 */
export function BotonesTrimestre({ desde, hasta, onCambiar }: { desde?: string | null; hasta?: string | null; onCambiar: (r: { desde: string; hasta: string }) => void }) {
  const hoy = new Date();
  const elegido = trimestreDe(desde, hasta);
  const [anio, setAnio] = useState(elegido?.anio ?? hoy.getFullYear());
  // Si el rango cambia desde fuera (atajo, URL), el año sigue al trimestre elegido.
  useEffect(() => {
    if (elegido) setAnio(elegido.anio);
  }, [elegido?.anio]); // eslint-disable-line react-hooks/exhaustive-deps
  const anios = Array.from({ length: hoy.getFullYear() - PRIMER_ANIO + 1 }, (_, i) => hoy.getFullYear() - i);
  const ultimoT = (a: number) => (a === hoy.getFullYear() ? trimestreActual() : 4);

  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="Trimestre">
      <Selector
        aria-label="Año del trimestre"
        className="h-8 w-24"
        value={anio}
        onChange={(e) => {
          const a = Number(e.target.value);
          setAnio(a);
          if (elegido) onCambiar(rangoTrimestre(a, Math.min(elegido.t, ultimoT(a))));
        }}
        opciones={anios.map((a) => ({ value: a, label: String(a) }))}
      />
      {[1, 2, 3, 4].map((t) => {
        const activo = elegido?.anio === anio && elegido.t === t;
        return (
          <button
            key={t}
            type="button"
            disabled={t > ultimoT(anio)}
            title={`${NOMBRES_T[t - 1]} de ${anio}`}
            aria-pressed={activo}
            onClick={() => onCambiar(rangoTrimestre(anio, t))}
            className={cn(
              'rounded-full border px-3 py-1 text-sm disabled:opacity-40',
              activo ? 'border-marca-500 bg-marca-50 font-medium text-marca-700' : 'border-borde text-tenue enabled:hover:text-tinta',
            )}
          >
            T{t}
          </button>
        );
      })}
    </div>
  );
}

type Modo = 'todo' | 'trimestre' | 'fechas';

/** Periodo con tres modos: sin filtro, por trimestre o por fechas exactas. */
export function Periodo({ desde, hasta, onCambiar }: { desde?: string | null; hasta?: string | null; onCambiar: (r: { desde?: string; hasta?: string }) => void }) {
  const [modo, setModo] = useState<Modo>(trimestreDe(desde, hasta) ? 'trimestre' : desde || hasta ? 'fechas' : 'todo');
  const cambiarModo = (m: Modo) => {
    setModo(m);
    if (m === 'todo') onCambiar({ desde: undefined, hasta: undefined });
    // Al pasar a trimestre se aplica el actual de una vez.
    if (m === 'trimestre') onCambiar(rangoTrimestre(new Date().getFullYear(), trimestreActual()));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg bg-black/5 p-0.5 text-sm">
        {(
          [
            ['todo', 'Todo'],
            ['trimestre', 'Trimestre'],
            ['fechas', 'Fechas'],
          ] as const
        ).map(([m, texto]) => (
          <button
            key={m}
            type="button"
            onClick={() => cambiarModo(m)}
            className={cn('rounded-md px-3 py-1.5', modo === m ? 'bg-superficie font-medium shadow-sm' : 'text-tenue hover:text-tinta')}
          >
            {texto}
          </button>
        ))}
      </div>
      {modo === 'trimestre' && <BotonesTrimestre desde={desde} hasta={hasta} onCambiar={onCambiar} />}
      {modo === 'fechas' && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-tenue">
          <Entrada type="date" className="w-auto" aria-label="Desde" value={desde ?? ''} onChange={(e) => onCambiar({ desde: e.target.value || undefined, hasta: hasta ?? undefined })} />
          a
          <Entrada type="date" className="w-auto" aria-label="Hasta" value={hasta ?? ''} onChange={(e) => onCambiar({ desde: desde ?? undefined, hasta: e.target.value || undefined })} />
        </div>
      )}
    </div>
  );
}
