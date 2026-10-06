import { ArrowLeft, ChevronLeft, ChevronRight, Copy, Loader2 } from 'lucide-react';
import {
  forwardRef,
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
  className,
  children,
}: {
  etiqueta: string;
  error?: string;
  ayuda?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-[13px] font-medium text-tinta/80">{etiqueta}</span>
      {children}
      {error ? <span className="text-xs text-red-600">{error}</span> : ayuda && <span className="text-xs text-tenue">{ayuda}</span>}
    </label>
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

/** react-hook-form: los inputs numéricos vacíos quedan como undefined en lugar de NaN. */
export const comoNumero = { setValueAs: (v: unknown) => (v === '' || v === null || v === undefined ? undefined : Number(v)) };

/* Contenedores */

export function Tarjeta({
  titulo,
  accion,
  copiable,
  className,
  children,
}: {
  titulo?: ReactNode;
  accion?: ReactNode;
  /** Agrega un botón que copia la tarjeta (título + gráfica) como imagen. */
  copiable?: boolean;
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

export function Paginacion({
  pagina,
  ultima,
  total,
  alCambiar,
}: {
  pagina: number;
  ultima: number;
  total: number;
  alCambiar: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-between border-t border-borde px-5 py-3 text-sm text-tenue">
      <span className="tabular">
        {total} {total === 1 ? 'registro' : 'registros'}
      </span>
      <div className="flex items-center gap-1">
        <Boton variante="fantasma" className="h-8 px-2" disabled={pagina <= 1} onClick={() => alCambiar(pagina - 1)} aria-label="Anterior">
          <ChevronLeft className="size-4" />
        </Boton>
        <span className="tabular px-2">
          {pagina} / {Math.max(ultima, 1)}
        </span>
        <Boton variante="fantasma" className="h-8 px-2" disabled={pagina >= ultima} onClick={() => alCambiar(pagina + 1)} aria-label="Siguiente">
          <ChevronRight className="size-4" />
        </Boton>
      </div>
    </div>
  );
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
