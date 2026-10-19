import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/formato';

/** Fecha local como 'YYYY-MM-DD' (el mismo formato que <input type="date">). */
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const deYmd = (s: string) => {
  const [a, m, d] = s.split('-').map(Number);
  return new Date(a, m - 1, d);
};
const valida = (s: string | null | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
const sumarDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const MES = new Intl.DateTimeFormat('es-DO', { month: 'long', year: 'numeric' });
const MES_CORTO = new Intl.DateTimeFormat('es-DO', { month: 'short' });
const LARGA = new Intl.DateTimeFormat('es-DO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const CORTA = new Intl.DateTimeFormat('es-DO', { day: 'numeric', month: 'short', year: 'numeric' });
const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Vista = 'dias' | 'meses' | 'anios';

type Props = {
  value: string | null | undefined;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  /** Texto cuando no hay fecha; con él, el calendario deja borrarla (filtros "Desde"/"Hasta"). */
  vacio?: string;
  /** "19 oct 2026" en vez de "Lunes, 19 de octubre de 2026": para filtros y espacios estrechos. */
  corto?: boolean;
  /** Abrir eligiendo el año (fecha de nacimiento). */
  empezarPorAnio?: boolean;
  id?: string;
  className?: string;
  disabled?: boolean;
  'aria-invalid'?: boolean;
  'aria-label'?: string;
};

/**
 * Selector de fecha con el diseño de la app (sin hora). Se cierra al elegir un día.
 * Tocando el mes se elige mes y año rápido. Teclado: flechas, Re Pág / Av Pág (mes), Enter, Escape.
 */
export function SelectorFecha({ value, onChange, min, max, vacio, corto, empezarPorAnio, id, className, disabled, 'aria-invalid': invalido, 'aria-label': ariaLabel }: Props) {
  const boton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState<Vista>('dias');
  const [foco, setFoco] = useState(new Date());
  const [pos, setPos] = useState<{ top: number; left: number; arriba: boolean } | null>(null);

  const actual = valida(value) ? value : '';
  const hoy = ymd(new Date());
  const fuera = (d: string) => (!!min && d < min) || (!!max && d > max);

  /** Dónde abre: la fecha elegida o hoy, sin salirse de min/max. */
  const inicial = () => {
    if (actual) return deYmd(actual);
    if (max && hoy > max) return deYmd(max);
    if (min && hoy < min) return deYmd(min);
    return new Date();
  };

  const posicionar = () => {
    const r = boton.current?.getBoundingClientRect();
    if (!r) return;
    const alto = 360;
    const ancho = 304;
    const arriba = r.bottom + alto > window.innerHeight - 8 && r.top > alto;
    setPos({ top: arriba ? r.top - 4 : r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - ancho - 8)), arriba });
  };

  const abrir = () => {
    if (disabled) return;
    posicionar();
    setFoco(inicial());
    setVista(empezarPorAnio && !actual ? 'anios' : 'dias');
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

  // El elemento con foco (día, mes o año) recibe el foco real, para que el teclado y el lector de pantalla lo sigan.
  useEffect(() => {
    if (!abierto) return;
    const clave = vista === 'dias' ? ymd(foco) : vista === 'meses' ? String(foco.getMonth()) : String(foco.getFullYear());
    panel.current?.querySelector<HTMLButtonElement>(`[data-clave="${clave}"]`)?.focus();
  }, [abierto, foco, vista]);

  const tecla = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (vista !== 'dias') setVista('dias');
      else cerrar();
    } else if (e.key === 'Tab') return cerrar(false);
    else if (vista === 'dias') {
      const pasos: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
      if (e.key in pasos) setFoco((f) => sumarDias(f, pasos[e.key]));
      else if (e.key === 'PageUp') setFoco((f) => new Date(f.getFullYear(), f.getMonth() - 1, Math.min(f.getDate(), 28)));
      else if (e.key === 'PageDown') setFoco((f) => new Date(f.getFullYear(), f.getMonth() + 1, Math.min(f.getDate(), 28)));
      else if (e.key === 'Enter' || e.key === ' ') elegir(foco);
      else return;
    } else {
      // Meses y años: rejilla de 3 columnas.
      const pasos: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 };
      if (e.key in pasos) {
        const n = pasos[e.key];
        setFoco((f) => (vista === 'meses' ? new Date(f.getFullYear(), f.getMonth() + n, 1) : new Date(f.getFullYear() + n, f.getMonth(), 1)));
      } else if (e.key === 'Enter' || e.key === ' ') setVista(vista === 'anios' ? 'meses' : 'dias');
      else return;
    }
    e.preventDefault();
  };

  // Semanas de lunes a domingo que cubren el mes con foco.
  const primero = new Date(foco.getFullYear(), foco.getMonth(), 1);
  const inicio = sumarDias(primero, -((primero.getDay() + 6) % 7));
  const dias = Array.from({ length: 42 }, (_, i) => sumarDias(inicio, i));
  const semanas = dias[35].getMonth() === foco.getMonth() ? 6 : 5;
  const anioInicial = foco.getFullYear() - (foco.getFullYear() % 12);
  const anios = Array.from({ length: 12 }, (_, i) => anioInicial + i);

  // Un mes (o año) entero fuera de min/max no se puede elegir.
  const mesFuera = (a: number, m: number) => (!!min && ymd(new Date(a, m + 1, 0)) < min) || (!!max && ymd(new Date(a, m, 1)) > max);
  const anioFuera = (a: number) => (!!min && `${a}-12-31` < min) || (!!max && `${a}-01-01` > max);

  const anterior = () =>
    setFoco((f) => (vista === 'dias' ? new Date(f.getFullYear(), f.getMonth() - 1, 1) : vista === 'meses' ? new Date(f.getFullYear() - 1, f.getMonth(), 1) : new Date(f.getFullYear() - 12, f.getMonth(), 1)));
  const siguiente = () =>
    setFoco((f) => (vista === 'dias' ? new Date(f.getFullYear(), f.getMonth() + 1, 1) : vista === 'meses' ? new Date(f.getFullYear() + 1, f.getMonth(), 1) : new Date(f.getFullYear() + 12, f.getMonth(), 1)));
  const sinAnterior = vista === 'dias' ? mesFuera(foco.getFullYear(), foco.getMonth() - 1) : vista === 'meses' ? anioFuera(foco.getFullYear() - 1) : anioFuera(anioInicial - 1);
  const sinSiguiente = vista === 'dias' ? mesFuera(foco.getFullYear(), foco.getMonth() + 1) : vista === 'meses' ? anioFuera(foco.getFullYear() + 1) : anioFuera(anioInicial + 12);
  const titulo = vista === 'dias' ? mayuscula(MES.format(foco)) : vista === 'meses' ? String(foco.getFullYear()) : `${anios[0]} – ${anios[11]}`;

  const flecha = 'grid size-8 place-items-center rounded-lg text-tenue hover:bg-fondo hover:text-tinta disabled:opacity-30 disabled:hover:bg-transparent';
  const celda = (elegido: boolean, actualHoy: boolean, bloqueado: boolean) =>
    cn(
      'tabular relative grid place-items-center rounded-lg text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-tinta',
      elegido ? 'bg-marca-500 font-semibold text-tinta' : 'hover:bg-marca-100',
      actualHoy && !elegido && 'font-semibold text-marca-700',
      bloqueado && 'cursor-not-allowed opacity-30 hover:bg-transparent',
    );

  return (
    <>
      <button
        ref={boton}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-invalid={invalido}
        aria-label={ariaLabel ? `${ariaLabel}: ${actual ? LARGA.format(deYmd(actual)) : (vacio ?? 'sin fecha')}` : undefined}
        onClick={() => (abierto ? cerrar() : abrir())}
        onKeyDown={(e) => e.key === 'ArrowDown' && (e.preventDefault(), abrir())}
        className={cn(
          'flex h-9 w-full items-center gap-2 rounded-lg border border-borde bg-superficie px-3 text-left text-sm whitespace-nowrap transition outline-none focus:border-tinta/60 focus:ring-3 focus:ring-marca-200 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-red-400',
          abierto && 'border-tinta/60 ring-3 ring-marca-200',
          className,
        )}
      >
        <CalendarDays className="size-4 shrink-0 text-tenue" />
        {actual ? (
          <span className="truncate">
            {corto ? CORTA.format(deYmd(actual)) : mayuscula(LARGA.format(deYmd(actual)))}
            {actual === hoy && !corto && <span className="ml-1.5 text-tenue">· hoy</span>}
          </span>
        ) : (
          <span className="text-tenue/70">{vacio ?? 'Elegir fecha'}</span>
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
            className={cn('fixed z-50 w-76 rounded-xl border border-borde bg-superficie p-3 text-sm text-tinta shadow-xl', pos.arriba && '-translate-y-full')}
          >
            <div className="mb-2 flex items-center justify-between gap-1">
              <button type="button" tabIndex={-1} onClick={anterior} disabled={sinAnterior} className={flecha} aria-label="Anterior">
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setVista(vista === 'dias' ? 'meses' : vista === 'meses' ? 'anios' : 'dias')}
                className="rounded-lg px-2.5 py-1 font-semibold hover:bg-fondo"
                aria-live="polite"
                title={vista === 'dias' ? 'Elegir mes y año' : vista === 'meses' ? 'Elegir año' : 'Volver a los días'}
              >
                {titulo}
              </button>
              <button type="button" tabIndex={-1} onClick={siguiente} disabled={sinSiguiente} className={flecha} aria-label="Siguiente">
                <ChevronRight className="size-4" />
              </button>
            </div>

            {vista === 'dias' && (
              <>
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
                    const elegido = v === actual;
                    const esHoy = v === hoy;
                    return (
                      <button
                        key={v}
                        type="button"
                        data-clave={v}
                        tabIndex={v === ymd(foco) ? 0 : -1}
                        disabled={fuera(v)}
                        aria-pressed={elegido}
                        aria-label={`${LARGA.format(d)}${esHoy ? ', hoy' : ''}`}
                        onClick={() => elegir(d)}
                        className={cn(celda(elegido, esHoy, fuera(v)), 'h-9', d.getMonth() !== foco.getMonth() && !elegido && 'text-tenue/50')}
                      >
                        {d.getDate()}
                        {esHoy && <span className={cn('absolute bottom-1 size-1 rounded-full', elegido ? 'bg-tinta' : 'bg-marca-500')} />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {vista === 'meses' && (
              <div className="grid grid-cols-3 gap-1">
                {Array.from({ length: 12 }, (_, m) => {
                  const a = foco.getFullYear();
                  const elegido = !!actual && deYmd(actual).getFullYear() === a && deYmd(actual).getMonth() === m;
                  const bloqueado = mesFuera(a, m);
                  return (
                    <button
                      key={m}
                      type="button"
                      data-clave={m}
                      tabIndex={m === foco.getMonth() ? 0 : -1}
                      disabled={bloqueado}
                      onClick={() => {
                        setFoco(new Date(a, m, 1));
                        setVista('dias');
                      }}
                      className={cn(celda(elegido, `${a}-${String(m + 1).padStart(2, '0')}` === hoy.slice(0, 7), bloqueado), 'h-12 capitalize')}
                    >
                      {MES_CORTO.format(new Date(a, m, 1)).replace('.', '')}
                    </button>
                  );
                })}
              </div>
            )}

            {vista === 'anios' && (
              <div className="grid grid-cols-3 gap-1">
                {anios.map((a) => {
                  const bloqueado = anioFuera(a);
                  return (
                    <button
                      key={a}
                      type="button"
                      data-clave={a}
                      tabIndex={a === foco.getFullYear() ? 0 : -1}
                      disabled={bloqueado}
                      onClick={() => {
                        setFoco(new Date(a, foco.getMonth(), 1));
                        setVista('meses');
                      }}
                      className={cn(celda(!!actual && deYmd(actual).getFullYear() === a, String(a) === hoy.slice(0, 4), bloqueado), 'h-12')}
                    >
                      {a}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-2 flex items-center justify-between border-t border-borde pt-2">
              {vacio !== undefined && actual ? (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => {
                    onChange('');
                    cerrar();
                  }}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-tenue hover:bg-fondo hover:text-tinta"
                >
                  <X className="size-3.5" /> Borrar
                </button>
              ) : (
                <span />
              )}
              <button type="button" tabIndex={-1} disabled={fuera(hoy)} onClick={() => elegir(new Date())} className="rounded-lg px-2.5 py-1.5 font-medium text-marca-700 hover:bg-marca-100 disabled:opacity-30">
                Hoy
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
