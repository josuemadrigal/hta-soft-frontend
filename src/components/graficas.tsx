/** Estilo común de las gráficas (recharts) y barras horizontales simples en HTML. */

export const EJE = { tickLine: false, axisLine: false, fontSize: 12, stroke: '#6b665e' } as const;
export const REJILLA = { vertical: false, stroke: '#e5e2dc' } as const;
export const TOOLTIP = { contentStyle: { borderRadius: 8, borderColor: '#e5e2dc', fontSize: 13 } } as const;

/** Leyenda con el texto siempre oscuro: el color va solo en el punto (amarillo sobre blanco no se lee). */
export const LEYENDA = {
  iconType: 'circle',
  iconSize: 8,
  wrapperStyle: { fontSize: 12 },
  formatter: (v: string) => <span style={{ color: '#3a3733' }}>{v}</span>,
} as const;

/** Paleta para series sin significado propio (medicamentos, géneros…). */
export const SERIES = ['#1d1b18', '#e0b800', '#6366f1', '#db2777', '#0284c7', '#65a30d', '#7c3aed', '#94a3b8'];

/** Colores de marca para gráficas: negro para la serie principal, amarillo del logo como acento. */
export const COLOR = { tinta: '#1d1b18', amarillo: '#fed801', amarilloOscuro: '#c9a400', gris: '#d6d3cd' } as const;

/** Con 5–8 categorías se leen mejor que un pastel. */
export function Barras({
  filas,
  formato = (v) => String(v),
  max,
}: {
  filas: { etiqueta: string; valor: number; color?: string; detalle?: string }[];
  formato?: (v: number) => string;
  /** Escala fija (p. ej. 100 para porcentajes); por defecto, el mayor valor. */
  max?: number;
}) {
  const tope = max ?? Math.max(1, ...filas.map((f) => f.valor));
  return (
    <ul className="space-y-3">
      {filas.map((f) => (
        <li key={f.etiqueta} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-tinta/80" title={f.etiqueta}>
            {f.etiqueta}
          </span>
          <span className="h-2 overflow-hidden rounded-full bg-black/[0.05]">
            <span className="block h-full rounded-full" style={{ width: `${Math.min(100, (f.valor / tope) * 100)}%`, backgroundColor: f.color ?? 'var(--color-marca-500)' }} />
          </span>
          <span className="tabular min-w-10 text-right font-medium">
            {formato(f.valor)}
            {f.detalle && <span className="ml-1 text-xs font-normal text-tenue">{f.detalle}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
