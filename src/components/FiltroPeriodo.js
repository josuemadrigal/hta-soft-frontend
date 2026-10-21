import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSearchParams } from 'react-router';
import { useComunidades } from '../api/consultas';
import { cn } from '../lib/formato';
import { BotonesTrimestre } from './Periodo';
import { Selector, Tarjeta } from './ui';
import { SelectorFecha, ymd } from './SelectorFecha';
// Fecha local (no UTC): después de las 8 p. m. en RD, toISOString ya daría mañana.
const iso = (d) => ymd(d);
function presets() {
    const hoy = new Date();
    return [
        { texto: 'Últimos 12 meses', desde: iso(new Date(hoy.getFullYear() - 1, hoy.getMonth(), hoy.getDate())), hasta: iso(hoy) },
        { texto: 'Este año', desde: `${hoy.getFullYear()}-01-01`, hasta: iso(hoy) },
        { texto: 'Año pasado', desde: `${hoy.getFullYear() - 1}-01-01`, hasta: `${hoy.getFullYear() - 1}-12-31` },
        { texto: 'Todo el historial', desde: '2017-01-01', hasta: iso(hoy) },
    ];
}
/** Periodo y batey en la URL (?desde=&hasta=&batey=). Devuelve el filtro listo para la API. */
export function useFiltroPeriodo() {
    const [params] = useSearchParams();
    const [porDefecto] = presets();
    const desde = params.get('desde') ?? porDefecto.desde;
    const hasta = params.get('hasta') ?? porDefecto.hasta;
    // Días de RD: el servidor toma "YYYY-MM-DD" como el día entero.
    return { desde, hasta, from: desde, to: hasta, communityId: Number(params.get('batey')) || undefined };
}
export function FiltroPeriodo({ conBatey = true }) {
    const [params, setParams] = useSearchParams();
    const comunidades = useComunidades();
    const { desde, hasta, communityId } = useFiltroPeriodo();
    const cambiar = (c) => setParams((p) => {
        for (const [k, v] of Object.entries(c))
            v ? p.set(k, v) : p.delete(k);
        return p;
    }, { replace: true });
    return (_jsx(Tarjeta, { className: "mb-4", children: _jsxs("div", { className: "flex flex-wrap items-center gap-3 p-4", children: [_jsx("div", { className: "flex flex-wrap gap-1.5", children: presets().map((p) => (_jsx("button", { onClick: () => cambiar({ desde: p.desde, hasta: p.hasta }), className: cn('rounded-full border px-3 py-1 text-sm', desde === p.desde && hasta === p.hasta ? 'border-tinta bg-marca-500 font-medium text-tinta' : 'border-borde text-tenue hover:text-tinta'), children: p.texto }, p.texto))) }), _jsx("span", { className: "hidden h-6 w-px bg-borde sm:block" }), _jsx(BotonesTrimestre, { desde: desde, hasta: hasta, onCambiar: (r) => cambiar(r) }), _jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsxs("div", { className: "flex items-center gap-2 text-sm text-tenue", children: ["Desde", _jsx(SelectorFecha, { corto: true, vacio: "Cualquier fecha", className: "w-auto", "aria-label": "Desde", value: desde, max: hasta || undefined, onChange: (v) => cambiar({ desde: v }) })] }), _jsxs("div", { className: "flex items-center gap-2 text-sm text-tenue", children: ["Hasta", _jsx(SelectorFecha, { corto: true, vacio: "Cualquier fecha", className: "w-auto", "aria-label": "Hasta", value: hasta, min: desde || undefined, onChange: (v) => cambiar({ hasta: v }) })] })] }), conBatey && (_jsx(Selector, { className: "w-auto min-w-44", vacio: "Todos los bateyes", value: communityId ?? '', onChange: (e) => cambiar({ batey: e.target.value }), opciones: (comunidades.data ?? []).map((c) => ({ value: c.id, label: c.name })) })), [...params.keys()].some((k) => ['desde', 'hasta', 'batey'].includes(k)) && (_jsx("button", { onClick: () => cambiar({ desde: undefined, hasta: undefined, batey: undefined }), className: "text-sm font-medium text-marca-700 hover:underline", children: "Restablecer" }))] }) }));
}
