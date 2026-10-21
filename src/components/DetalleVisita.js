import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ChevronLeft, ChevronRight, Home, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { TIPOS_VISITA } from '../lib/etiquetas';
import { atendio, cn, colorCumplimiento, decimal, fecha, fechaYHora } from '../lib/formato';
import { InsigniaCategoria } from './ui';
function Dato({ etiqueta, children, className }) {
    return (_jsxs("div", { className: className, children: [_jsx("dt", { className: "text-xs text-tenue", children: etiqueta }), _jsx("dd", { className: "mt-0.5 text-sm", children: children })] }));
}
const par = (s, d) => (s && d ? `${s}/${d}` : '—');
const o = (v, sufijo = '') => (v === null || v === undefined || v === '' ? '—' : `${v}${sufijo}`);
/**
 * Todos los datos de una visita anterior, para consultarla sin salir del registro de la de hoy.
 * Las flechas (y ← →) pasan a la visita más antigua o a la más reciente.
 */
export function DetalleVisita({ visitas, indice, alCambiar, alCerrar }) {
    const ref = useRef(null);
    const v = visitas[indice];
    // visitas va de la más reciente a la más antigua
    const masAntigua = indice < visitas.length - 1 ? indice + 1 : null;
    const masReciente = indice > 0 ? indice - 1 : null;
    useEffect(() => {
        const d = ref.current;
        if (d && !d.open)
            d.showModal();
    }, []);
    useEffect(() => {
        const tecla = (e) => {
            if (e.key === 'ArrowLeft' && masAntigua !== null)
                alCambiar(masAntigua);
            if (e.key === 'ArrowRight' && masReciente !== null)
                alCambiar(masReciente);
        };
        window.addEventListener('keydown', tecla);
        return () => window.removeEventListener('keydown', tecla);
    }, [masAntigua, masReciente, alCambiar]);
    const cerrar = () => {
        ref.current?.close();
        alCerrar();
    };
    const flecha = 'grid size-10 place-items-center rounded-lg border border-borde bg-superficie text-tinta hover:bg-fondo disabled:opacity-30';
    const automatica = v.systolicAuto || v.diastolicAuto;
    return (_jsxs("dialog", { ref: ref, onCancel: (e) => {
            e.preventDefault();
            cerrar();
        }, onClick: (e) => e.target === e.currentTarget && cerrar(), className: "m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-borde bg-superficie p-0 text-tinta shadow-2xl backdrop:bg-tinta/40 backdrop:backdrop-blur-[2px]", "aria-labelledby": "detalle-visita-titulo", children: [_jsxs("div", { className: "sticky top-0 z-10 flex items-center gap-3 border-b border-borde bg-superficie px-5 py-4", children: [_jsx("button", { type: "button", className: flecha, onClick: () => masAntigua !== null && alCambiar(masAntigua), disabled: masAntigua === null, "aria-label": "Visita anterior (m\u00E1s antigua)", title: "M\u00E1s antigua (\u2190)", children: _jsx(ChevronLeft, { className: "size-5" }) }), _jsxs("div", { className: "min-w-0 flex-1 text-center", children: [_jsxs("h2", { id: "detalle-visita-titulo", className: "font-semibold", children: ["Visita del ", fecha(v.visitDate), v.isHomeVisit && _jsx(Home, { className: "ml-1.5 inline size-4 text-tenue", "aria-label": "Domiciliaria" })] }), _jsxs("p", { className: "text-xs text-tenue", children: [indice === 0 ? 'La última · ' : '', indice + 1, " de ", visitas.length] })] }), _jsx("button", { type: "button", className: flecha, onClick: () => masReciente !== null && alCambiar(masReciente), disabled: masReciente === null, "aria-label": "Visita siguiente (m\u00E1s reciente)", title: "M\u00E1s reciente (\u2192)", children: _jsx(ChevronRight, { className: "size-5" }) }), _jsx("button", { type: "button", className: "grid size-10 place-items-center rounded-lg text-tenue hover:bg-fondo hover:text-tinta", onClick: cerrar, "aria-label": "Cerrar", children: _jsx(X, { className: "size-5" }) })] }), _jsxs("div", { className: "space-y-5 px-5 py-5", children: [_jsxs("section", { className: "flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl bg-fondo px-4 py-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs text-tenue", children: v.systolicManual && v.diastolicManual ? 'Manual' : automatica ? 'Automática' : 'Presión' }), _jsx("p", { className: "tabular font-mono text-3xl font-semibold", children: par(v.systolicManual ?? v.systolicAuto, v.diastolicManual ?? v.diastolicAuto) })] }), _jsxs("div", { className: "space-y-1", children: [v.bpClassification ? _jsx(InsigniaCategoria, { config: v.bpClassification }) : _jsx("span", { className: "text-sm text-tenue", children: "Sin toma v\u00E1lida" }), v.systolicManual && v.diastolicManual && automatica && _jsxs("p", { className: "text-xs text-tenue", children: ["Autom\u00E1tica: ", par(v.systolicAuto, v.diastolicAuto)] })] })] }), _jsxs("dl", { className: "grid grid-cols-2 gap-4 sm:grid-cols-4", children: [_jsx(Dato, { etiqueta: "Peso", children: v.weightKg ? `${decimal(v.weightKg)} kg` : '—' }), _jsx(Dato, { etiqueta: "Estatura", children: v.heightM ? `${decimal(v.heightM, 2)} m` : '—' }), _jsx(Dato, { etiqueta: "IMC", children: v.bmi ? decimal(v.bmi) : '—' }), _jsx(Dato, { etiqueta: "Tipo", children: TIPOS_VISITA[v.visitType] }), _jsx(Dato, { etiqueta: "Frec. card\u00EDaca", children: o(v.heartRate, ' lpm') }), _jsx(Dato, { etiqueta: "Saturaci\u00F3n O\u2082", children: o(v.oxygenSaturation, ' %') }), _jsx(Dato, { etiqueta: "Temperatura", children: v.temperature ? `${decimal(v.temperature)} °C` : '—' }), _jsx(Dato, { etiqueta: "Pr\u00F3xima visita", children: fecha(v.nextVisitDate) }), _jsx(Dato, { etiqueta: "Atendi\u00F3", className: "col-span-2", children: atendio(v) }), _jsxs(Dato, { etiqueta: "Registrada", className: "col-span-2", children: [fechaYHora(v.createdAt ?? v.visitDate), v.importada && _jsx("span", { className: "text-tenue", children: " \u00B7 importada del Excel" })] })] }), _jsxs("section", { children: [_jsx("h3", { className: "mb-2 text-sm font-semibold", children: "Medicamentos" }), v.prescriptions?.length ? (_jsx("div", { className: "overflow-x-auto rounded-lg border border-borde", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-borde bg-fondo text-left text-xs text-tenue", children: [_jsx("th", { className: "px-3 py-2 font-medium", children: "Medicamento" }), _jsx("th", { className: "px-3 py-2 text-right font-medium", children: "Al d\u00EDa" }), _jsx("th", { className: "px-3 py-2 text-right font-medium", children: "Le quedaban" }), _jsx("th", { className: "px-3 py-2 text-right font-medium", children: "Entregadas" }), _jsx("th", { className: "px-3 py-2 text-right font-medium", children: "Cumplimiento" })] }) }), _jsx("tbody", { className: "tabular", children: v.prescriptions.map((r) => {
                                                const pendiente = r.cantidadIndicada !== undefined && r.quantityDispensed < r.cantidadIndicada;
                                                return (_jsxs("tr", { className: "border-b border-borde last:border-0", children: [_jsxs("td", { className: "px-3 py-2", children: [r.medication?.name, " ", _jsx("span", { className: "text-tenue", children: r.medication?.concentration })] }), _jsx("td", { className: "px-3 py-2 text-right", children: r.dailyDose }), _jsx("td", { className: "px-3 py-2 text-right", children: r.patientSupplyRemaining }), _jsx("td", { className: cn('px-3 py-2 text-right', pendiente && 'text-amber-800'), children: pendiente ? `${r.quantityDispensed} de ${r.cantidadIndicada}` : r.quantityDispensed }), _jsx("td", { className: "px-3 py-2 text-right", children: r.adherencePercentage !== null ? (_jsxs("span", { className: cn('font-medium', colorCumplimiento(Number(r.adherencePercentage))), children: [Math.round(Number(r.adherencePercentage)), "%"] })) : (_jsx("span", { className: "text-tenue", children: "\u2014" })) })] }, r.id));
                                            }) })] }) })) : (_jsx("p", { className: "text-sm text-tenue", children: "Sin medicamentos." }))] }), (v.reason || v.notes || v.prescriptionText) && (_jsxs("dl", { className: "space-y-3", children: [v.reason && _jsx(Dato, { etiqueta: "Motivo de consulta", children: v.reason }), v.notes && (_jsx(Dato, { etiqueta: "Comentario", children: _jsx("span", { className: "whitespace-pre-line", children: v.notes }) })), v.prescriptionText && (_jsx(Dato, { etiqueta: "Indicaciones", children: _jsx("span", { className: "whitespace-pre-line", children: v.prescriptionText }) }))] }))] })] }));
}
