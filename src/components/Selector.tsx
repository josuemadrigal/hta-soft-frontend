import { Check, ChevronDown, Search } from 'lucide-react';
import {
  forwardRef,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEventHandler,
  type KeyboardEvent,
  type SelectHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/formato';

type Opcion = { value: string | number; label: string };
type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'> & {
  opciones: Opcion[];
  /** Opción vacía (value ""), p. ej. "Todos los bateyes". */
  vacio?: string;
  value?: string | number;
  onChange?: ChangeEventHandler<HTMLSelectElement>;
};

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Con listas largas se muestra un buscador arriba. */
const CON_BUSCADOR = 10;

/**
 * Select con diseño propio. Por dentro conserva un <select> nativo oculto: así funciona igual con
 * react-hook-form (register) y con value/onChange, y el formulario lee el valor como siempre.
 */
export const Selector = forwardRef<HTMLSelectElement, Props>(function Selector(
  { className, opciones, vacio, value, onChange, disabled, id, 'aria-label': ariaLabel, 'aria-invalid': ariaInvalid, ...resto },
  ref,
) {
  const nativo = useRef<HTMLSelectElement | null>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const idLista = useId();
  const controlado = value !== undefined;
  const [interno, setInterno] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const [filtro, setFiltro] = useState('');
  const [pos, setPos] = useState<{ top: number; left: number; width: number; arriba: boolean } | null>(null);

  // En modo no controlado (register) el valor lo pone react-hook-form en el <select> nativo.
  useLayoutEffect(() => {
    if (!controlado && nativo.current && nativo.current.value !== interno) setInterno(nativo.current.value);
  });

  const actual = controlado ? String(value) : interno;
  const todas: Opcion[] = [...(vacio !== undefined ? [{ value: '', label: vacio }] : []), ...opciones];
  const visibles = filtro ? todas.filter((o) => sinTildes(o.label).includes(sinTildes(filtro))) : todas;
  const elegida = todas.find((o) => String(o.value) === actual);

  const elegir = (v: string) => {
    const el = nativo.current;
    if (el) {
      // Se usa el setter nativo y un evento real para que onChange (de React o de register) se entere.
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(el, v);
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (!controlado) setInterno(v);
    cerrar();
  };

  const posicionar = () => {
    const r = boton.current?.getBoundingClientRect();
    if (!r) return;
    const alto = Math.min(320, todas.length * 36 + (todas.length > CON_BUSCADOR ? 48 : 8));
    const arriba = r.bottom + alto > window.innerHeight - 8 && r.top > alto;
    setPos({ top: arriba ? r.top - 4 : r.bottom + 4, left: r.left, width: Math.max(r.width, 200), arriba });
  };

  const abrir = () => {
    if (disabled) return;
    posicionar();
    setFiltro('');
    setActivo(Math.max(0, todas.findIndex((o) => String(o.value) === actual)));
    setAbierto(true);
  };
  function cerrar(enfocar = true) {
    setAbierto(false);
    if (enfocar) boton.current?.focus();
  }

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!boton.current?.contains(t) && !lista.current?.contains(t)) cerrar(false);
    };
    const mover = () => posicionar();
    document.addEventListener('mousedown', fuera);
    window.addEventListener('resize', mover);
    window.addEventListener('scroll', mover, true);
    // Foco en el buscador o en la lista para navegar con el teclado.
    requestAnimationFrame(() => (lista.current?.querySelector('input') ?? lista.current)?.focus());
    return () => {
      document.removeEventListener('mousedown', fuera);
      window.removeEventListener('resize', mover);
      window.removeEventListener('scroll', mover, true);
    };
  }, [abierto]);

  // Mantener visible la opción activa al moverse con flechas.
  useEffect(() => {
    if (abierto) lista.current?.querySelector(`[data-i="${activo}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activo, abierto]);

  const teclaBoton = (e: KeyboardEvent) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      abrir();
    }
  };
  const teclaLista = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') setActivo((i) => Math.min(visibles.length - 1, i + 1));
    else if (e.key === 'ArrowUp') setActivo((i) => Math.max(0, i - 1));
    else if (e.key === 'Home') setActivo(0);
    else if (e.key === 'End') setActivo(visibles.length - 1);
    else if (e.key === 'Enter') visibles[activo] && elegir(String(visibles[activo].value));
    else if (e.key === 'Escape') cerrar();
    else if (e.key === 'Tab') return cerrar(false);
    else if (todas.length <= CON_BUSCADOR && e.key.length === 1) {
      // Sin buscador: saltar a la primera opción que empieza con esa letra.
      const i = visibles.findIndex((o) => sinTildes(o.label).startsWith(sinTildes(e.key)));
      if (i >= 0) setActivo(i);
    } else return;
    e.preventDefault();
  };

  return (
    <>
      <button
        ref={boton}
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => (abierto ? cerrar() : abrir())}
        onKeyDown={teclaBoton}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={abierto ? idLista : undefined}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-borde bg-superficie px-3 text-left text-sm outline-none transition',
          'focus-visible:border-tinta/60 focus-visible:ring-3 focus-visible:ring-marca-200 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-red-400',
          abierto && 'border-tinta/60 ring-3 ring-marca-200',
          className,
        )}
      >
        <span className={cn('truncate', !actual && 'text-tenue')}>{elegida?.label ?? vacio ?? 'Elegir…'}</span>
        <ChevronDown className={cn('size-4 shrink-0 text-tenue transition-transform', abierto && 'rotate-180')} />
      </button>

      {/* El valor real vive aquí (formularios, register, lectores de pantalla en forms). */}
      <select
        ref={(el) => {
          nativo.current = el;
          if (typeof ref === 'function') ref(el);
          else if (ref) ref.current = el;
        }}
        value={controlado ? String(value) : undefined}
        onChange={onChange ?? (() => {})}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        {...resto}
      >
        {todas.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {abierto &&
        pos &&
        createPortal(
          <div
            ref={lista}
            id={idLista}
            role="listbox"
            tabIndex={-1}
            onKeyDown={teclaLista}
            style={{ position: 'fixed', left: pos.left, width: pos.width, ...(pos.arriba ? { bottom: window.innerHeight - pos.top } : { top: pos.top }) }}
            className="z-50 flex max-h-80 flex-col overflow-hidden rounded-xl border border-borde bg-superficie text-sm text-tinta shadow-xl outline-none"
          >
            {todas.length > CON_BUSCADOR && (
              <div className="relative border-b border-borde p-1.5">
                <Search className="pointer-events-none absolute top-1/2 left-4 size-3.5 -translate-y-1/2 text-tenue" />
                <input
                  value={filtro}
                  onChange={(e) => {
                    setFiltro(e.target.value);
                    setActivo(0);
                  }}
                  placeholder="Buscar…"
                  className="h-8 w-full rounded-md bg-fondo pr-2 pl-8 outline-none placeholder:text-tenue"
                  aria-label="Buscar opción"
                />
              </div>
            )}
            <div className="overflow-y-auto p-1">
              {visibles.length === 0 && <p className="px-3 py-2 text-tenue">Sin coincidencias</p>}
              {visibles.map((o, i) => {
                const sel = String(o.value) === actual;
                return (
                  <div
                    key={o.value}
                    data-i={i}
                    role="option"
                    aria-selected={sel}
                    onMouseEnter={() => setActivo(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => elegir(String(o.value))}
                    className={cn(
                      'flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2',
                      i === activo && 'bg-marca-100',
                      sel && 'font-semibold',
                      o.value === '' && 'text-tenue',
                    )}
                  >
                    <span className="truncate">{o.label}</span>
                    {sel && <Check className="size-4 shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
});
