import { ArrowLeft, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Copy, Info, Loader2 } from 'lucide-react';
import type { AyudaGrafica } from '../lib/ayuda-graficas';
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import type { ConfigPA } from '../api/tipos';
import { copiarComoImagen } from '../lib/copiar';
import { CATEGORIAS, colorCategoria } from '../lib/etiquetas';
import { cn, iniciales } from '../lib/formato';

/* Botones */

type Variante = 'primario' | 'secundario' | 'fantasma' | 'peligro';
const VARIANTES: Record<Variante, string> = {
  primario: 'bg-marca-500 text-tinta font-semibold hover:bg-marca-600 shadow-sm',
  secundario: 'bg-superficie text-tinta border border-borde hover:bg-fondo',
  fantasma: 'text-tenue hover:text-tinta hover:bg-black/5',
  peligro: 'bg-red-600 text-white hover:bg-red-700',
};

export function Boton({
  variante = 'primario',
  cargando,
  icono,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; cargando?: boolean; icono?: ReactNode }) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || cargando}
      className={cn(
        'inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
        VARIANTES[variante],
        className,
      )}
    >
      {cargando ? <Loader2 className="size-4 animate-spin" /> : icono}
      {children}
    </button>
  );
}

/* Campos de formulario */

export function Campo({
  etiqueta,
  error,
  ayuda,
  grupo,
  className,
  children,
}: {
  etiqueta: string;
  error?: string;
  ayuda?: ReactNode;
  /** Para botones (Segmentos): un <label> mandaría el clic de la etiqueta al primer botón. */
  grupo?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const Contenedor = grupo ? 'div' : 'label';
  return (
    <Contenedor className={cn('flex flex-col gap-1.5', className)} {...(grupo && { role: 'group', 'aria-labelledby': id })}>
      <span id={id} className="text-[13px] font-medium text-tinta/80">
        {etiqueta}
      </span>
      {children}
      {error ? <span className="text-xs text-red-600">{error}</span> : ayuda && <span className="text-xs text-tenue">{ayuda}</span>}
    </Contenedor>
  );
}

const BASE_CAMPO =
  'h-9 w-full rounded-lg border border-borde bg-superficie px-3 text-sm outline-none transition placeholder:text-tenue/70 focus:border-tinta/60 focus:ring-3 focus:ring-marca-200 aria-invalid:border-red-400';

export const Entrada = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...p }, ref) => <input ref={ref} {...p} className={cn(BASE_CAMPO, className)} />,
);

export { Selector } from './Selector';

export const AreaTexto = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...p }, ref) => (
    <textarea ref={ref} rows={3} {...p} className={cn(BASE_CAMPO, 'h-auto py-2', className)} />
  ),
);

export const Casilla = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { etiqueta: string }>(
  ({ etiqueta, className, ...p }, ref) => (
    <label className={cn('flex cursor-pointer items-center gap-2 text-sm', className)}>
      <input ref={ref} type="checkbox" {...p} className="size-4 rounded accent-tinta" />
      {etiqueta}
    </label>
  ),
);

/**
 * Opciones de una sola elección como botones (en la tablet es un toque, no abrir una lista).
 * Sin valor, ninguna queda marcada. Flechas ← → cambian la elección, como un grupo de radios.
 */
export function Segmentos<T extends string>({
  valor,
  opciones,
  alCambiar,
  etiqueta,
  invalido,
  className,
}: {
  valor: T | '' | undefined;
  opciones: { value: T; label: string }[];
  alCambiar: (v: T) => void;
  etiqueta: string;
  invalido?: boolean;
  className?: string;
}) {
  const actual = opciones.findIndex((o) => o.value === valor);
  const tecla = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const paso = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!paso) return;
    e.preventDefault();
    const i = (Math.max(actual, 0) + paso + opciones.length) % opciones.length;
    alCambiar(opciones[i].value);
    (e.currentTarget.children[i] as HTMLElement | undefined)?.focus();
  };
  return (
    <div
      className={cn('flex rounded-lg bg-black/5 p-0.5', invalido && 'ring-1 ring-red-400', className)}
      role="radiogroup"
      aria-label={etiqueta}
      aria-invalid={invalido}
      onKeyDown={tecla}
    >
      {opciones.map((o, i) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={valor === o.value}
          tabIndex={i === (actual < 0 ? 0 : actual) ? 0 : -1}
          onClick={() => alCambiar(o.value)}
          className={cn(
            'h-9 min-w-0 flex-1 truncate rounded-md px-2 text-sm whitespace-nowrap transition sm:px-3',
            valor === o.value ? 'bg-superficie font-medium text-tinta shadow-sm' : 'text-tenue hover:text-tinta',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** react-hook-form: los inputs numéricos vacíos quedan como undefined en lugar de NaN. */
export const comoNumero = { setValueAs: (v: unknown) => (v === '' || v === null || v === undefined ? undefined : Number(v)) };

/* Contenedores */

/**
 * Botón (i) de una gráfica: explica cómo se lee y qué significa. No sale en la imagen copiada.
 * Se abre al tocarlo (en tableta no hay "pasar el mouse") y se cierra tocando fuera o con Escape.
 */
function BotonAyuda({ ayuda }: { ayuda: AyudaGrafica }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setAbierto(false);
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);
  return (
    <div ref={ref} data-no-copiar className="relative">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        className={cn('rounded-md p-1.5 text-tenue hover:bg-black/5 hover:text-tinta', abierto && 'bg-black/5 text-tinta')}
        aria-label="Cómo se lee esta gráfica"
        aria-expanded={abierto}
        aria-controls={id}
        title="Cómo se lee"
      >
        <Info className="size-4" />
      </button>
      {abierto && (
        <div id={id} role="dialog" aria-label="Cómo se lee esta gráfica" className="absolute top-full right-0 z-30 mt-1.5 w-80 max-w-[calc(100vw-2rem)] space-y-3 rounded-xl border border-borde bg-superficie p-4 text-left text-sm font-normal shadow-xl">
          <div>
            <p className="mb-1 text-xs font-semibold tracking-wide text-tenue uppercase">Cómo se lee</p>
            <p className="leading-relaxed">{ayuda.lee}</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold tracking-wide text-tenue uppercase">Qué significa</p>
            <p className="leading-relaxed">{ayuda.significa}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function Tarjeta({
  titulo,
  accion,
  copiable,
  ayuda,
  className,
  children,
}: {
  titulo?: ReactNode;
  accion?: ReactNode;
  /** Agrega un botón que copia la tarjeta (título + gráfica) como imagen. */
  copiable?: boolean;
  /** Botón (i) con la explicación de la gráfica. */
  ayuda?: AyudaGrafica;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const [copiando, setCopiando] = useState(false);
  const copiar = async () => {
    if (!ref.current) return;
    setCopiando(true);
    try {
      const nombre = (typeof titulo === 'string' ? titulo : 'grafica').toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, '-');
      const r = await copiarComoImagen(ref.current, nombre);
      toast.success(r === 'copiada' ? 'Gráfica copiada: pégala donde la necesites' : 'Se descargó la gráfica como imagen');
    } catch {
      toast.error('No se pudo copiar la gráfica');
    } finally {
      setCopiando(false);
    }
  };
  return (
    <section ref={ref} className={cn('rounded-xl border border-borde bg-superficie', className)}>
      {titulo && (
        <header className="flex items-center justify-between gap-3 border-b border-borde px-5 py-3.5">
          <h2 className="text-sm font-semibold">{titulo}</h2>
          <div className="flex items-center gap-2">
            {accion}
            {ayuda && <BotonAyuda ayuda={ayuda} />}
            {copiable && (
              <button
                data-no-copiar
                onClick={copiar}
                disabled={copiando}
                className="rounded-md p-1.5 text-tenue hover:bg-black/5 hover:text-tinta disabled:opacity-50"
                title="Copiar como imagen"
                aria-label="Copiar gráfica como imagen"
              >
                {copiando ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />}
              </button>
            )}
          </div>
        </header>
      )}
      {children}
    </section>
  );
}

export function EncabezadoPagina({
  titulo,
  descripcion,
  acciones,
  volver,
}: {
  titulo: string;
  descripcion?: ReactNode;
  acciones?: ReactNode;
  /** Pantallas de formulario: enlace a la lista de la que vienen. */
  volver?: { a: string; texto: string };
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      {volver && (
        <Link to={volver.a} className="-mb-2 inline-flex w-full items-center gap-1.5 text-sm text-tenue hover:text-tinta">
          <ArrowLeft className="size-4" /> {volver.texto}
        </Link>
      )}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        {descripcion && <p className="mt-1 text-sm text-tenue">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </div>
  );
}

/* Indicadores */

export function Insignia({ color, className, children }: { color?: string; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', !color && 'bg-black/5 text-tenue', className)}
      style={color ? { backgroundColor: `${color}1a`, color } : undefined}
    >
      {children}
    </span>
  );
}

export function InsigniaCategoria({ config }: { config?: ConfigPA | null }) {
  if (!config) return <Insignia>Sin clasificar</Insignia>;
  const color = colorCategoria(config);
  return (
    <Insignia color={color}>
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {CATEGORIAS[config.categoryName]}
    </Insignia>
  );
}

export function Avatar({
  persona,
  foto,
  tamano = 'size-9',
}: {
  persona: { firstName: string; lastName: string };
  foto?: string | null;
  tamano?: string;
}) {
  return foto ? (
    <img src={foto} alt="" className={cn('shrink-0 rounded-full object-cover', tamano)} />
  ) : (
    <span className={cn('grid shrink-0 place-items-center rounded-full bg-marca-100 text-xs font-semibold text-marca-700', tamano)}>
      {iniciales(persona)}
    </span>
  );
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-tenue">
      <Loader2 className="size-4 animate-spin" />
      {texto}
    </div>
  );
}

export function Vacio({ icono, titulo, children }: { icono?: ReactNode; titulo: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      {icono && <div className="mb-1 text-tenue/60">{icono}</div>}
      <p className="font-medium">{titulo}</p>
      {children && <div className="max-w-sm text-sm text-tenue">{children}</div>}
    </div>
  );
}

export function ErrorCarga({ error }: { error: unknown }) {
  return (
    <div className="m-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      No se pudo cargar: {error instanceof Error ? error.message : 'error desconocido'}
    </div>
  );
}

/** Páginas a mostrar: la primera, la última y las vecinas de la actual; "…" donde se saltan. */
export function paginasVisibles(pagina: number, ultima: number): (number | '…')[] {
  const set = new Set([1, ultima, pagina - 1, pagina, pagina + 1].filter((n) => n >= 1 && n <= ultima));
  // Cerca de los extremos se muestran unas más, para no poner "…" en lugar de un solo número.
  if (pagina <= 3) [2, 3, 4].forEach((n) => n <= ultima && set.add(n));
  if (pagina >= ultima - 2) [ultima - 1, ultima - 2, ultima - 3].forEach((n) => n >= 1 && set.add(n));
  const orden = [...set].sort((x, y) => x - y);
  const r: (number | '…')[] = [];
  orden.forEach((n, i) => {
    if (i > 0 && n - orden[i - 1] > 1) r.push(n - orden[i - 1] === 2 ? n - 1 : '…');
    r.push(n);
  });
  return r;
}

export const OPCIONES_POR_PAGINA = [15, 25, 50, 100];

export function Paginacion({
  pagina,
  ultima,
  total,
  alCambiar,
  porPagina,
  alCambiarPorPagina,
}: {
  pagina: number;
  ultima: number;
  total: number;
  alCambiar: (p: number) => void;
  /** Con esto aparece "Mostrar N por página". */
  porPagina?: number;
  alCambiarPorPagina?: (n: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const ultimaP = Math.max(ultima, 1);
  // Al cambiar de página se vuelve al inicio de la tabla (si no, se queda mirando el pie).
  const ir = (p: number) => {
    alCambiar(Math.min(Math.max(1, p), ultimaP));
    ref.current?.closest('section')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };
  const desde = porPagina ? (pagina - 1) * porPagina + 1 : null;
  const hasta = porPagina ? Math.min(pagina * porPagina, total) : null;
  const flecha = 'h-8 px-2';
  return (
    <div ref={ref} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-borde px-5 py-3 text-sm text-tenue">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="tabular">
          {desde && hasta && total > 0 ? (
            <>
              <span className="font-medium text-tinta">
                {desde.toLocaleString('es-DO')}–{hasta.toLocaleString('es-DO')}
              </span>{' '}
              de {total.toLocaleString('es-DO')}
            </>
          ) : (
            <>
              {total.toLocaleString('es-DO')} {total === 1 ? 'registro' : 'registros'}
            </>
          )}
        </span>
        {porPagina && alCambiarPorPagina && (
          <label className="flex items-center gap-2">
            Mostrar
            <select
              value={porPagina}
              onChange={(e) => alCambiarPorPagina(Number(e.target.value))}
              className="h-8 rounded-lg border border-borde bg-superficie px-2 text-sm text-tinta outline-none focus:border-tinta/60 focus:ring-3 focus:ring-marca-200"
            >
              {[...new Set([...OPCIONES_POR_PAGINA, porPagina])].sort((x, y) => x - y).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            por página
          </label>
        )}
      </div>
      {ultimaP > 1 && (
        <nav className="flex items-center gap-1" aria-label="Páginas">
          <Boton variante="fantasma" className={cn(flecha, 'hidden sm:inline-flex')} disabled={pagina <= 1} onClick={() => ir(1)} aria-label="Primera página" title="Primera página">
            <ChevronsLeft className="size-4" />
          </Boton>
          <Boton variante="fantasma" className={flecha} disabled={pagina <= 1} onClick={() => ir(pagina - 1)} aria-label="Anterior" title="Anterior">
            <ChevronLeft className="size-4" />
          </Boton>
          {/* En el teléfono basta "5 / 93"; en pantallas más anchas, los números */}
          <span className="tabular px-2 sm:hidden">
            {pagina} / {ultimaP}
          </span>
          <span className="hidden items-center gap-1 sm:flex">
            {paginasVisibles(pagina, ultimaP).map((n, i) =>
              n === '…' ? (
                <span key={`e${i}`} className="px-1 text-tenue/70">
                  …
                </span>
              ) : (
                <button
                  key={n}
                  type="button"
                  onClick={() => ir(n)}
                  aria-current={n === pagina ? 'page' : undefined}
                  className={cn(
                    'tabular h-8 min-w-8 rounded-lg px-2 text-sm transition',
                    n === pagina ? 'bg-marca-500 font-semibold text-tinta' : 'text-tinta/80 hover:bg-black/5',
                  )}
                >
                  {n}
                </button>
              ),
            )}
          </span>
          <Boton variante="fantasma" className={flecha} disabled={pagina >= ultimaP} onClick={() => ir(pagina + 1)} aria-label="Siguiente" title="Siguiente">
            <ChevronRight className="size-4" />
          </Boton>
          <Boton variante="fantasma" className={cn(flecha, 'hidden sm:inline-flex')} disabled={pagina >= ultimaP} onClick={() => ir(ultimaP)} aria-label="Última página" title="Última página">
            <ChevronsRight className="size-4" />
          </Boton>
        </nav>
      )}
    </div>
  );
}

/** Cuántos por página: el de la dirección, si no el último elegido en este dispositivo, si no el de siempre. */
export function porPaginaDe(params: URLSearchParams, clave: string, defecto: number) {
  const url = Number(params.get('por'));
  if (url >= 1 && url <= 200) return url;
  try {
    const guardado = Number(localStorage.getItem(`hta:porPagina:${clave}`));
    if (guardado >= 1 && guardado <= 200) return guardado;
  } catch {
    /* sin almacenamiento local: el de siempre */
  }
  return defecto;
}

export function recordarPorPagina(clave: string, n: number) {
  try {
    localStorage.setItem(`hta:porPagina:${clave}`, String(n));
  } catch {
    /* sin almacenamiento local: solo queda en la dirección */
  }
}

/** Tabla con encabezado fijo de estilo; las filas las pone cada pantalla. */
export function Tabla({ columnas, children }: { columnas: (string | { texto: string; className?: string })[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-borde text-left text-xs tracking-wide text-tenue uppercase">
            {columnas.map((c) => {
              const col = typeof c === 'string' ? { texto: c } : c;
              return (
                <th key={col.texto} className={cn('px-5 py-2.5 font-medium whitespace-nowrap', col.className)}>
                  {col.texto}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-borde">{children}</tbody>
      </table>
    </div>
  );
}
