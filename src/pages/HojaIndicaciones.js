import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { CalendarDays, FileText, Printer } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { usePaciente } from '../api/consultas';
import { Cargando, EncabezadoPagina, ErrorCarga, Tarjeta, Vacio, Boton } from '../components/ui';
import { CATEGORIAS, colorCategoria } from '../lib/etiquetas';
import { DIA_MS, fecha, nombreCompleto, tensionDe } from '../lib/formato';
/* La próxima visita guardada es fecha "pura" (medianoche UTC); la estimada se calcula en hora local. */
const fmtLargoUTC = new Intl.DateTimeFormat('es-DO', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtLargo = new Intl.DateTimeFormat('es-DO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
/** "media pastilla", "1 pastilla", "2 pastillas", "1½ pastillas". */
function pastillas(n) {
    if (n === 0.5)
        return 'media pastilla';
    const entero = Math.floor(n);
    const cifra = n - entero === 0.5 ? `${entero}½` : n.toLocaleString('es-DO');
    return `${cifra} ${n === 1 ? 'pastilla' : 'pastillas'}`;
}
const CONSEJOS = [
    'Use poca sal en la comida.',
    'Tome las pastillas todos los días, aunque se sienta bien.',
    'No deje las pastillas sin preguntar al médico.',
    'Venga a la próxima jornada.',
    'Vaya al hospital si tiene dolor de cabeza muy fuerte, dolor en el pecho o le falta el aire.',
];
/* ───────────── /pacientes/:id/indicaciones ───────────── */
export function HojaIndicaciones() {
    const id = Number(useParams().id);
    const consulta = usePaciente(id);
    if (consulta.isPending)
        return _jsx(Cargando, {});
    if (consulta.isError)
        return _jsx(ErrorCarga, { error: consulta.error });
    const p = consulta.data;
    if (!p)
        return (_jsx(Vacio, { titulo: "Paciente no encontrado", children: _jsx(Link, { to: "/pacientes", className: "text-marca-700 hover:underline", children: "Volver al listado" }) }));
    // La API devuelve las visitas de la más reciente a la más antigua.
    const v = p.clinicalVisits?.[0];
    const recetas = (v?.prescriptions ?? []).filter((r) => !!r.medication);
    const vacia = !v || recetas.length === 0;
    const proxima = v?.nextVisitDate
        ? mayuscula(fmtLargoUTC.format(new Date(v.nextVisitDate)))
        : v
            ? mayuscula(fmtLargo.format(new Date(Date.parse(v.visitDate) + 90 * DIA_MS)))
            : '';
    const categoria = v?.bpClassification;
    const tension = v ? tensionDe(v) : '—';
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "print:hidden", children: _jsx(EncabezadoPagina, { titulo: "Hoja de indicaciones", descripcion: `${nombreCompleto(p)} · ${p.patientCode}`, volver: { a: `/pacientes/${p.id}`, texto: 'Volver al paciente' }, acciones: !vacia && (_jsx(Boton, { icono: _jsx(Printer, { className: "size-4" }), onClick: () => window.print(), children: "Imprimir" })) }) }), vacia ? (_jsx(Tarjeta, { children: _jsx(Vacio, { icono: _jsx(FileText, { className: "size-8" }), titulo: v ? 'La última visita no tiene medicamentos' : 'Este paciente no tiene visitas', children: "La hoja se arma con los medicamentos recetados en la \u00FAltima visita." }) })) : (_jsxs("article", { className: "mx-auto max-w-[148mm] rounded-xl border border-borde bg-white p-6 text-tinta shadow-sm sm:p-8 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none", children: [_jsxs("header", { className: "border-b-2 border-tinta pb-3", children: [_jsx("p", { className: "text-xs font-semibold tracking-wide text-tenue uppercase", children: "Light a Candle \u00B7 Dominican Republic" }), _jsx("h2", { className: "mt-1 text-2xl leading-tight font-bold", children: nombreCompleto(p) }), _jsxs("p", { className: "mt-0.5 text-sm", children: [_jsx("span", { className: "font-mono font-semibold", children: p.patientCode }), p.community?.name && _jsxs(_Fragment, { children: [" \u00B7 ", p.community.name] }), " \u00B7 Visita del ", fecha(v.visitDate)] })] }), _jsxs("section", { className: "mt-4", children: [_jsx("h3", { className: "mb-2 text-lg font-bold", children: "Sus medicamentos" }), _jsx("table", { className: "w-full border-collapse text-base", children: _jsx("tbody", { children: recetas.map((r) => {
                                        const debemos = Math.max((r.cantidadIndicada ?? 0) - r.quantityDispensed, 0);
                                        return (_jsxs("tr", { className: "border-y border-tinta/30", children: [_jsxs("td", { className: "py-2 pr-3 align-top", children: [_jsx("span", { className: "block text-lg leading-tight font-bold", children: r.medication.name }), _jsx("span", { className: "text-sm", children: r.medication.concentration })] }), _jsxs("td", { className: "py-2 pr-3 align-top text-lg font-semibold", children: ["Tome ", pastillas(r.dailyDose), " al d\u00EDa"] }), _jsxs("td", { className: "py-2 text-right align-top text-sm whitespace-nowrap", children: ["Le entregamos ", _jsx("strong", { className: "tabular text-base", children: r.quantityDispensed }), debemos > 0 && (_jsxs("span", { className: "block", children: ["Le debemos ", _jsx("strong", { className: "tabular", children: debemos })] }))] })] }, r.id));
                                    }) }) })] }), tension !== '—' && (_jsxs("p", { className: "mt-4 text-lg", children: ["Su presi\u00F3n hoy: ", _jsx("strong", { className: "tabular", children: tension }), categoria && (_jsxs("span", { className: "font-semibold", style: { color: colorCategoria(categoria) }, children: [' ', "(", CATEGORIAS[categoria.categoryName], ")"] }))] })), _jsxs("div", { className: "mt-4 flex items-center gap-3 rounded-lg border-2 border-tinta px-4 py-3", children: [_jsx(CalendarDays, { className: "size-7 shrink-0" }), _jsxs("p", { className: "leading-tight", children: [_jsx("span", { className: "block text-sm font-medium", children: "Pr\u00F3xima visita" }), _jsx("span", { className: "text-xl font-bold", children: proxima })] })] }), v.prescriptionText?.trim() && (_jsxs("section", { className: "mt-4", children: [_jsx("h3", { className: "mb-1 text-base font-bold", children: "Indicaciones del m\u00E9dico" }), _jsx("p", { className: "text-base whitespace-pre-line", children: v.prescriptionText.trim() })] })), _jsxs("section", { className: "mt-4 break-inside-avoid", children: [_jsx("h3", { className: "mb-1 text-base font-bold", children: "Recuerde" }), _jsx("ul", { className: "list-disc space-y-0.5 pl-5 text-base", children: CONSEJOS.map((c) => (_jsx("li", { children: c }, c))) })] })] }))] }));
}
