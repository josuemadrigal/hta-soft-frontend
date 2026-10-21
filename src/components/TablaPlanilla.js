import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from '../lib/formato';
/** Las columnas de la planilla de papel, en su orden y con su texto en inglés y en español (va a los donantes). */
export const COLUMNAS_PLANILLA = [
    { clave: 'evaluados', en: '# of evaluated patients', es: '# de pacientes evaluados' },
    { clave: 'enPrograma', en: '# of existing patients', es: '# de pacientes existentes (en el programa)' },
    { clave: 'conToma', en: '# of BP checks', es: '# de pacientes consultados' },
    { clave: 'existentesConMedicamento', en: '# of existing patients on HTN meds', es: '# de pacientes con medicamentos para HTN', grupo: 'existentes' },
    { clave: 'controlados', en: '# of existing patients on meds showing controlled BP <140/90', es: '# de pacientes con presión controlada <140/90', grupo: 'existentes' },
    { clave: 'noControlados', en: '# of existing patients on meds showing uncontrolled BP >140/90', es: '# de pacientes con presión no controlada >140/90', grupo: 'existentes' },
    { clave: 'datosDudosos', en: '# existing patients with absent or questionable data', es: '# de pacientes con datos ausentes o cuestionables', grupo: 'existentes' },
    { clave: 'nuevos', en: '# of new patients', es: '# de pacientes nuevos', grupo: 'nuevos' },
    { clave: 'nuevosConMedicamento', en: '# of new patients placed on HTN meds', es: '# de pacientes nuevos que recibieron medicamentos para HTN', grupo: 'nuevos' },
];
const CORTA = new Intl.DateTimeFormat('es-DO', { day: 'numeric', month: 'short' });
const fechaDe = (s) => {
    const [a, m, d] = s.split('-').map(Number);
    return new Date(a, m - 1, d);
};
/** "9 oct", "9 · 16 oct", o "5 días" si son muchas. */
export function textoFechas(fechas) {
    if (!fechas.length)
        return '';
    if (fechas.length > 3)
        return `${fechas.length} días`;
    return fechas.map((f) => CORTA.format(fechaDe(f))).join(' · ');
}
/** La planilla como en el papel: una fila por batey y las 9 columnas en el mismo orden. */
export function TablaPlanilla({ filas, total, vacio }) {
    return (_jsxs("table", { className: "w-full min-w-[1080px] border-collapse text-sm print:min-w-0 print:text-[11px]", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-borde align-bottom", children: [_jsxs("th", { className: "px-4 py-3 text-left", children: [_jsx("span", { className: "block text-xs font-semibold", children: "Batey Name" }), _jsx("span", { className: "block text-[11px] font-normal text-tenue italic", children: "Nombre del batey" })] }), COLUMNAS_PLANILLA.map((c) => (_jsxs("th", { className: cn('w-[9%] px-3 py-3 text-right', c.grupo === 'existentes' && 'bg-fondo', c.grupo === 'nuevos' && 'bg-marca-50', (c.clave === 'existentesConMedicamento' || c.clave === 'nuevos') && 'border-l border-borde'), children: [_jsx("span", { className: "block text-xs leading-tight font-semibold text-balance", children: c.en }), _jsx("span", { className: "mt-1 block text-[11px] leading-tight font-normal text-balance text-tenue italic", children: c.es })] }, c.clave)))] }) }), _jsxs("tbody", { className: "divide-y divide-borde", children: [filas.map((f) => (_jsx(Fila, { f: f }, f.communityId))), filas.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: COLUMNAS_PLANILLA.length + 1, className: "px-5 py-10 text-center text-tenue", children: vacio }) }))] }), total && filas.length > 1 && (_jsx("tfoot", { children: _jsx(Fila, { f: total, total: true }) }))] }));
}
function Fila({ f, total }) {
    const vacio = f.evaluados === 0 && !total;
    return (_jsxs("tr", { className: cn(total ? 'border-t-2 border-tinta/20 bg-fondo font-semibold' : 'hover:bg-fondo/60', vacio && 'text-tenue'), children: [_jsxs("td", { className: "px-4 py-2.5 whitespace-nowrap", children: [_jsx("span", { className: "block font-medium", children: f.batey }), !total && f.fechas.length > 0 && _jsx("span", { className: "block text-[11px] text-tenue", children: textoFechas(f.fechas) })] }), COLUMNAS_PLANILLA.map((c) => {
                const v = f[c.clave];
                // Lo que no aplica (batey sin visitas) queda en blanco, como en el papel; en el programa siempre se muestra.
                const mostrar = !vacio || c.clave === 'enPrograma';
                return (_jsx("td", { className: cn('tabular px-3 py-2.5 text-right', c.grupo === 'existentes' && 'bg-fondo/60', c.grupo === 'nuevos' && 'bg-marca-50/60', (c.clave === 'existentesConMedicamento' || c.clave === 'nuevos') && 'border-l border-borde', c.clave === 'noControlados' && v > 0 && !vacio && 'text-red-700', c.clave === 'controlados' && v > 0 && !vacio && 'text-green-700'), children: mostrar ? v.toLocaleString('es-DO') : '' }, c.clave));
            })] }));
}
