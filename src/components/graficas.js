import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** Estilo común de las gráficas (recharts) y barras horizontales simples en HTML. */
export const EJE = { tickLine: false, axisLine: false, fontSize: 12, stroke: '#6b665e' };
export const REJILLA = { vertical: false, stroke: '#e5e2dc' };
export const TOOLTIP = { contentStyle: { borderRadius: 8, borderColor: '#e5e2dc', fontSize: 13 } };
/** Leyenda con el texto siempre oscuro: el color va solo en el punto (amarillo sobre blanco no se lee). */
export const LEYENDA = {
    iconType: 'circle',
    iconSize: 8,
    wrapperStyle: { fontSize: 12 },
    formatter: (v) => _jsx("span", { style: { color: '#3a3733' }, children: v }),
};
/** Paleta para series sin significado propio (medicamentos, géneros…). */
export const SERIES = ['#1d1b18', '#e0b800', '#6366f1', '#db2777', '#0284c7', '#65a30d', '#7c3aed', '#94a3b8'];
/** Colores de marca para gráficas: negro para la serie principal, amarillo del logo como acento. */
export const COLOR = { tinta: '#1d1b18', amarillo: '#fed801', amarilloOscuro: '#c9a400', gris: '#d6d3cd' };
/** Con 5–8 categorías se leen mejor que un pastel. */
export function Barras({ filas, formato = (v) => String(v), max, }) {
    const tope = max ?? Math.max(1, ...filas.map((f) => f.valor));
    return (_jsx("ul", { className: "space-y-3", children: filas.map((f) => (_jsxs("li", { className: "grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm", children: [_jsx("span", { className: "truncate text-tinta/80", title: f.etiqueta, children: f.etiqueta }), _jsx("span", { className: "h-2 overflow-hidden rounded-full bg-black/[0.05]", children: _jsx("span", { className: "block h-full rounded-full", style: { width: `${Math.min(100, (f.valor / tope) * 100)}%`, backgroundColor: f.color ?? 'var(--color-marca-500)' } }) }), _jsxs("span", { className: "tabular min-w-10 text-right font-medium", children: [formato(f.valor), f.detalle && _jsx("span", { className: "ml-1 text-xs font-normal text-tenue", children: f.detalle })] })] }, f.etiqueta))) }));
}
