import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ChevronRight, Home } from 'lucide-react';
import { useState } from 'react';
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CATEGORIAS, colorCategoria } from '../lib/etiquetas';
import { atendio, cn, colorCumplimiento, decimal, fecha } from '../lib/formato';
import { COLOR, TOOLTIP } from './graficas';
import { DetalleVisita } from './DetalleVisita';
import { Tarjeta } from './ui';
const corta = new Intl.DateTimeFormat('es-DO', { month: 'short', year: '2-digit' });
const toma = (v) => ({ s: v.systolicManual ?? v.systolicAuto, d: v.diastolicManual ?? v.diastolicAuto });
/** Lo que el médico necesita a la vista para comparar mientras registra la visita de hoy. */
export function HistorialVisitas({ visitas, cuantas = 5 }) {
    // Visita abierta en la ventana de detalle (índice en `visitas`).
    const [abierta, setAbierta] = useState(null);
    if (visitas.length === 0) {
        return (_jsx(Tarjeta, { titulo: "Visitas anteriores", children: _jsx("p", { className: "p-5 text-sm text-tenue", children: "Es su primera visita." }) }));
    }
    // visitas viene de la más reciente a la más antigua
    const serie = visitas
        .slice(0, 8)
        .map((v) => ({ ...toma(v), fecha: corta.format(new Date(v.visitDate)) }))
        .filter((p) => p.s && p.d)
        .reverse();
    return (_jsxs(Tarjeta, { titulo: `Visitas anteriores (${visitas.length})`, children: [serie.length > 1 && (_jsx("div", { className: "h-28 border-b border-borde px-2 pt-3", children: _jsx(ResponsiveContainer, { children: _jsxs(LineChart, { data: serie, margin: { left: -28, right: 8, top: 4, bottom: 0 }, children: [_jsx(XAxis, { dataKey: "fecha", tickLine: false, axisLine: false, fontSize: 10, stroke: "#6b665e", interval: "preserveStartEnd" }), _jsx(YAxis, { domain: [60, 'auto'], tickLine: false, axisLine: false, fontSize: 10, stroke: "#6b665e" }), _jsx(ReferenceLine, { y: 140, stroke: "#dc2626", strokeDasharray: "3 3", strokeOpacity: 0.4 }), _jsx(ReferenceLine, { y: 90, stroke: "#ea580c", strokeDasharray: "3 3", strokeOpacity: 0.4 }), _jsx(Tooltip, { ...TOOLTIP }), _jsx(Line, { dataKey: "s", name: "Sist\u00F3lica", stroke: COLOR.tinta, strokeWidth: 2, dot: { r: 2.5 }, isAnimationActive: false }), _jsx(Line, { dataKey: "d", name: "Diast\u00F3lica", stroke: COLOR.amarilloOscuro, strokeWidth: 2, dot: { r: 2.5 }, isAnimationActive: false })] }) }) })), _jsx("ol", { className: "divide-y divide-borde", children: visitas.slice(0, cuantas).map((v, i) => {
                    const { s, d } = toma(v);
                    const color = v.bpClassification ? colorCategoria(v.bpClassification) : undefined;
                    return (_jsx("li", { className: cn(i === 0 && 'bg-marca-50/60'), children: _jsxs("div", { role: "button", tabIndex: 0, onClick: () => setAbierta(i), onKeyDown: (e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setAbierta(i);
                                }
                            }, className: "group block w-full cursor-pointer px-4 py-3 text-left text-sm transition outline-none hover:bg-black/[0.03] focus-visible:ring-2 focus-visible:ring-marca-500 focus-visible:ring-inset", "aria-label": `Ver la visita del ${fecha(v.visitDate)}`, children: [_jsxs("div", { className: "flex items-baseline justify-between gap-2", children: [_jsxs("span", { className: "font-medium", children: [fecha(v.visitDate), i === 0 && _jsx("span", { className: "ml-1.5 text-xs font-normal text-tenue", children: "\u00B7 \u00FAltima" }), v.isHomeVisit && _jsx(Home, { className: "ml-1 inline size-3 text-tenue" })] }), _jsx("span", { className: "tabular font-mono font-medium", children: s && d ? `${s}/${d}` : '—' })] }), _jsxs("div", { className: "mt-0.5 flex items-center justify-between gap-2 text-xs text-tenue", children: [_jsxs("span", { className: "flex items-center gap-1.5", children: [color && _jsx("span", { className: "size-1.5 rounded-full", style: { backgroundColor: color } }), v.bpClassification ? CATEGORIAS[v.bpClassification.categoryName] : 'Sin toma válida'] }), _jsxs("span", { className: "tabular", children: [v.weightKg ? `${decimal(v.weightKg)} kg` : '', v.weightKg && v.bmi ? ' · ' : '', v.bmi ? `IMC ${decimal(v.bmi)}` : ''] })] }), !!v.prescriptions?.length && (_jsx("ul", { className: "mt-1.5 space-y-0.5 text-xs", children: v.prescriptions.map((r) => (_jsxs("li", { className: "flex justify-between gap-2", children: [_jsxs("span", { className: "truncate", children: [r.medication?.name, " ", r.medication?.concentration, _jsxs("span", { className: "text-tenue", children: [' ', "\u00B7 ", r.dailyDose, "/d\u00EDa \u00B7", ' ', r.cantidadIndicada && r.quantityDispensed < r.cantidadIndicada ? (_jsxs("span", { className: "text-amber-800", children: [r.quantityDispensed, " de ", r.cantidadIndicada, " entregadas"] })) : (`${r.quantityDispensed} entregadas`)] })] }), r.adherencePercentage !== null && (_jsxs("span", { className: cn('tabular shrink-0 font-medium', colorCumplimiento(Number(r.adherencePercentage))), children: [Math.round(Number(r.adherencePercentage)), "%"] }))] }, r.id))) })), _jsxs("p", { className: "mt-1 text-[11px] text-tenue", children: ["Atendi\u00F3 ", atendio(v)] }), v.notes && _jsxs("p", { className: "mt-1.5 line-clamp-3 text-xs text-tinta/70 italic", children: ["\u201C", v.notes, "\u201D"] }), _jsxs("span", { className: "mt-1.5 flex items-center gap-0.5 text-[11px] font-medium text-tenue group-hover:text-tinta", children: ["Ver detalle ", _jsx(ChevronRight, { className: "size-3" })] })] }) }, v.id));
                }) }), visitas.length > cuantas && (_jsxs("button", { type: "button", onClick: () => setAbierta(cuantas), className: "w-full border-t border-borde px-4 py-2.5 text-left text-xs font-medium text-tenue hover:bg-black/[0.03] hover:text-tinta", children: ["Ver las ", visitas.length - cuantas, " m\u00E1s antiguas"] })), abierta !== null && _jsx(DetalleVisita, { visitas: visitas, indice: abierta, alCambiar: setAbierta, alCerrar: () => setAbierta(null) })] }));
}
