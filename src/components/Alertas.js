import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AlertOctagon, AlertTriangle, Info } from 'lucide-react';
import { useConfiguracion } from '../api/consultas';
import { UMBRALES_POR_DEFECTO } from '../lib/alertas';
import { cn } from '../lib/formato';
const ESTILO = {
    urgente: { caja: 'border-red-300 bg-red-50 text-red-900', icono: _jsx(AlertOctagon, { className: "size-4 shrink-0 text-red-600" }) },
    aviso: { caja: 'border-amber-300 bg-marca-50 text-amber-950', icono: _jsx(AlertTriangle, { className: "size-4 shrink-0 text-amber-700" }) },
    info: { caja: 'border-borde bg-fondo text-tinta', icono: _jsx(Info, { className: "size-4 shrink-0 text-tenue" }) },
};
/** Umbrales configurados (o los de por defecto mientras cargan). */
export function useUmbrales() {
    return useConfiguracion().data ?? UMBRALES_POR_DEFECTO;
}
export function ListaAlertas({ alertas, compacta, className }) {
    if (!alertas.length)
        return null;
    return (_jsx("ul", { className: cn('space-y-2', className), role: "list", "aria-label": "Alertas cl\u00EDnicas", children: alertas.map((a) => (_jsxs("li", { className: cn('flex gap-2.5 rounded-lg border px-3 py-2.5 text-sm', ESTILO[a.nivel].caja), children: [_jsx("span", { className: "mt-0.5", children: ESTILO[a.nivel].icono }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "font-medium", children: a.titulo }), !compacta && _jsx("p", { className: "mt-0.5 text-[13px] opacity-80", children: a.detalle })] })] }, a.clave))) }));
}
