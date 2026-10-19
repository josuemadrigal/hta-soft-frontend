import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/formato';

/** Fecha local como 'YYYY-MM-DD' (el mismo formato que <input type="date">). */
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const deYmd = (s: string) => {
  const [a, m, d] = s.split('-').map(Number);
  return new Date(a, m - 1, d);
};
const sumarDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const MES = new Intl.DateTimeFormat('es-DO', { month: 'long', year: 'numeric' });
const LARGA = new Intl.DateTimeFormat('es-DO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Props = {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  id?: string;
  className?: string;
  'aria-invalid'?: boolean;
  'aria-label'?: string;
};

/**
 * Selector de fecha con el diseño de la app (sin hora). Se cierra al elegir un día.
 * Teclado: flechas para moverse, Enter para elegir, Escape para cerrar.
 */
export function SelectorFecha({ value, onChange, min, max, id, className, 'aria-invalid': invalido, 'aria-label': ariaLabel }: Props) {
  const boton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [foco, setFoco] = useState(() => (value ? deYmd(value) : new Date()));
  const [pos, setPos] = useState<{ top: number; left: number; arriba: boolean } | null>(null);

  const hoy = ymd(new Date());
  const fuera = (d: string) => (!!min && d < min) || (!!max && d > max);

  const posicionar = () => {
    const r = boton.current?.getBoundingClientRect();
    if (!r) return;
    const alto = 360;
    const ancho = 304;
    const arriba = r.bottom + alto > window.innerHeight - 8 && r.top > alto;
    setPos({ top: arriba ? r.top - 4 : r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - ancho - 8)), arriba });
  };

  const abrir = () => {
    posicionar();
    setFoco(value ? deYmd(value) : new Date());
    setAbierto(true);
  };
  const cerrar = (enfocar = true) => {
    setAbierto(false);
    if (enfocar) boton.current?.focus();
  };
  const elegir = (d: Date) => {
    const v = ymd(d);
    if (fuera(v)) return;
    onChange(v);
    cerrar();
  };

  useEffect(() => {
    if (!abierto) return;
    const clic = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!boton.current?.contains(t) && !panel.current?.contains(t)) cerrar(false);
    };
    document.addEventListener('mousedown', clic);
    window.addEventListener('resize', posicionar);
    window.addEventListener('scroll', posicionar, true);
    return () => {
      document.removeEventListener('mousedown', clic);
      window.removeEventListener('resize', posicionar);
      window.removeEventListener('scroll', posicionar, true);
    };
  }, [abierto]);

  // El día con foco recibe el foco real, para que el teclado y el lector de pantalla lo sigan.
  useEffect(() => {
    if (abierto) panel.current?.querySelector<HTMLButtonElement>(`[data-dia="${ymd(foco)}"]`)?.focus();
  }, [abierto, foco]);

  const tecla = (e: KeyboardEvent) => {
    const pasos: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in pasos) setFoco((f) => sumarDias(f, pasos[e.key]));
    else if (e.key === 'PageUp') setFoco((f) => new Date(f.getFullYear(), f.getMonth() - 1, Math.min(f.getDate(), 28)));
    else if (e.key === 'PageDown') setFoco((f) => new Date(f.getFullYear(), f.getMonth() + 1, Math.min(f.getDate(), 28)));
    else if (e.key === 'Enter' || e.key === ' ') elegir(foco);
    else if (e.key === 'Escape') cerrar();
    else if (e.key === 'Tab') return cerrar(false);
    else return;
    e.preventDefault();
  };

  // Semanas de lunes a domingo que cubren el mes con foco.
  const primero = new Date(foco.getFullYear(), foco.getMonth(), 1);
  const inicio = sumarDias(primero, -((primero.getDay() + 6) % 7));
  const dias = Array.from({ length: 42 }, (_, i) => sumarDias(inicio, i));
  const semanas = dias[35].getMonth() === foco.getMonth() ? 6 : 5;
  const cambiarMes = (n: number) => setFoco((f) => new Date(f.getFullYear(), f.getMonth() + n, 1));
  const mesFuera = (n: number) => {
    const m = new Date(foco.getFullYear(), foco.getMonth() + n, 1);
    if (n < 0 && min) return ymd(new Date(m.getFullYear(), m.getMonth() + 1, 0)) < min;
    if (n > 0 && max) return ymd(m) > max;
    return false;
  };

  return (
    <>
      <button
        ref={boton}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-invalid={invalido}
        aria-label={ariaLabel}
        onClick={() => (abierto ? cerrar() : abrir())}
        onKeyDown={(e) => e.key === 'ArrowDown' && (e.preventDefault(), abrir())}
        className={cn(
          'flex h-9 w-full items-center gap-2 rounded-lg border border-borde bg-superficie px-3 text-left text-sm transition outline-none focus:border-tinta/60 focus:ring-3 focus:ring-marca-200 aria-invalid:border-red-400',
          abierto && 'border-tinta/60 ring-3 ring-marca-200',
          className,
        )}
      >
        <CalendarDays className="size-4 shrink-0 text-tenue" />
        {value ? (
          <span className="truncate">
            {mayuscula(LARGA.format(deYmd(value)))}
            {value === hoy && <span className="ml-1.5 text-tenue">· hoy</span>}
          </span>
        ) : (
          <span className="text-tenue/70">Elegir fecha</span>
        )}
      </button>

      {abierto &&
        pos &&
        createPortal(
          <div
            ref={panel}
            role="dialog"
            aria-label="Elegir fecha"
            onKeyDown={tecla}
            style={{ top: pos.top, left: pos.left }}
            className={cn('fixed z-50 w-76 rounded-xl border border-borde bg-superficie p-3 text-tinta shadow-xl', pos.arriba && '-translate-y-full')}
          >
            <div className="mb-2 flex items-center justify-between">
              <button type="button" tabIndex={-1} onClick={() => cambiarMes(-1)} disabled={mesFuera(-1)} className="grid size-8 place-items-center rounded-lg text-tenue hover:bg-fondo hover:text-tinta disabled:opacity-30" aria-label="Mes anterior">
                <ChevronLeft className="size-4" />
              </button>
              <p className="text-sm font-semibold" aria-live="polite">
                {mayuscula(MES.format(foco))}
              </p>
              <button type="button" tabIndex={-1} onClick={() => cambiarMes(1)} disabled={mesFuera(1)} className="grid size-8 place-items-center rounded-lg text-tenue hover:bg-fondo hover:text-tinta disabled:opacity-30" aria-label="Mes siguiente">
                <ChevronRight className="size-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 text-center text-[11px] font-medium text-tenue" aria-hidden>
              {DIAS.map((d, i) => (
                <span key={i} className="py-1">
                  {d}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {dias.slice(0, semanas * 7).map((d) => {
                const v = ymd(d);
                const delMes = d.getMonth() === foco.getMonth();
                const elegido = v === value;
                const esHoy = v === hoy;
                const bloqueado = fuera(v);
                return (
                  <button
                    key={v}
                    type="button"
                    data-dia={v}
                    tabIndex={v === ymd(foco) ? 0 : -1}
                    disabled={bloqueado}
                    aria-pressed={elegido}
                    aria-label={`${LARGA.format(d)}${esHoy ? ', hoy' : ''}`}
                    onClick={() => elegir(d)}
                    className={cn(
                      'tabular relative grid h-9 place-items-center rounded-lg text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-tinta',
                      elegido ? 'bg-marca-500 font-semibold text-tinta' : 'hover:bg-marca-100',
                      !delMes && !elegido && 'text-tenue/50',
                      esHoy && !elegido && 'font-semibold text-marca-700',
                      bloqueado && 'cursor-not-allowed opacity-30 hover:bg-transparent',
                    )}
                  >
                    {d.getDate()}
                    {esHoy && <span className={cn('absolute bottom-1 size-1 rounded-full', elegido ? 'bg-tinta' : 'bg-marca-500')} />}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 flex justify-end border-t border-borde pt-2">
              <button
                type="button"
                tabIndex={-1}
                disabled={fuera(hoy)}
                onClick={() => elegir(new Date())}
                className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-marca-700 hover:bg-marca-100 disabled:opacity-30"
              >
                Hoy
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
