import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useQuery } from '@tanstack/react-query';
import { List, PackageOpen, Printer, Tags } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';
import { preparacionJornada } from '../api/recursos';
import { Boton, Cargando, EncabezadoPagina, ErrorCarga, Tarjeta, Vacio } from '../components/ui';
import { cn, nombreCompleto } from '../lib/formato';
import { diaJornada } from './Jornadas';
const miles = (n) => n.toLocaleString('es-DO');
/** "1", "½", "1½": las dosis de media pastilla se leen mejor como fracción. */
const dosis = (n) => {
    const entero = Math.floor(n);
    const medio = n - entero === 0.5;
    if (medio)
        return entero ? `${entero}½` : '½';
    return n.toLocaleString('es-DO');
};
/* ───────────── /jornadas/:id/preparacion ───────────── */
export function HojaPreparacion() {
    const id = Number(useParams().id);
    const consulta = useQuery({ queryKey: ['jornadas', 'preparacion', id], queryFn: () => preparacionJornada(id), enabled: !!id });
    const [formato, setFormato] = useState('etiquetas');
    if (consulta.isPending)
        return _jsx(Cargando, {});
    if (consulta.isError)
        return _jsx(ErrorCarga, { error: consulta.error });
    const d = consulta.data;
    const j = d.jornada;
    const vacia = d.pacientes.length === 0;
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "print:hidden", children: [_jsx(EncabezadoPagina, { titulo: "Hoja de preparaci\u00F3n", descripcion: `${j.community.name} · ${diaJornada(j.fecha, true)}`, volver: { a: `/jornadas/${j.id}`, texto: 'Volver a la jornada' }, acciones: !vacia && (_jsx(Boton, { icono: _jsx(Printer, { className: "size-4" }), onClick: () => window.print(), children: "Imprimir" })) }), !vacia && (_jsxs("div", { className: "mb-6 flex flex-wrap items-start justify-between gap-4", children: [_jsxs("div", { className: "max-w-xl space-y-1 rounded-xl border border-borde bg-marca-50 px-4 py-3 text-sm", children: [_jsxs("p", { children: [_jsx("strong", { children: "Cantidades estimadas:" }), " la \u00FAltima receta para 90 d\u00EDas. Al atenderlo se ajusta con las pastillas que le queden."] }), _jsxs("p", { className: "text-tenue", children: [_jsx(Pendiente, {}), " = se le qued\u00F3 debiendo en su \u00FAltima visita."] })] }), _jsx("div", { className: "inline-flex rounded-lg border border-borde bg-superficie p-1", role: "radiogroup", "aria-label": "Qu\u00E9 imprimir", children: [
                                    ['etiquetas', 'Etiquetas', Tags],
                                    ['lista', 'Lista', List],
                                ].map(([valor, texto, Icono]) => (_jsxs("button", { role: "radio", "aria-checked": formato === valor, onClick: () => setFormato(valor), className: cn('inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors', formato === valor ? 'bg-marca-500 text-tinta' : 'text-tenue hover:text-tinta'), children: [_jsx(Icono, { className: "size-4" }), " ", texto] }, valor))) })] }))] }), vacia ? (_jsx(Tarjeta, { children: _jsxs(Vacio, { icono: _jsx(PackageOpen, { className: "size-8" }), titulo: "No hay bolsitas que preparar", children: ["Ning\u00FAn paciente de ", j.community.name, " tiene receta vigente ni pastillas pendientes para esta jornada."] }) })) : (_jsx("div", { className: "rounded-xl border border-borde bg-white p-6 shadow-sm sm:p-8 print:rounded-none print:border-0 print:p-0 print:shadow-none", children: formato === 'lista' ? _jsx(Lista, { d: d }) : _jsx(Etiquetas, { d: d }) }))] }));
}
function Pendiente() {
    return _jsx("span", { className: "inline-block rounded border border-amber-600 px-1 text-[10px] font-semibold tracking-wide text-amber-800 uppercase", children: "Pendiente" });
}
function Membrete({ d }) {
    const j = d.jornada;
    return (_jsxs("header", { className: "mb-5 flex flex-wrap items-end justify-between gap-2 border-b-2 border-tinta pb-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-medium tracking-wide text-tenue uppercase", children: "Light a Candle \u00B7 Dominican Republic" }), _jsxs("h2", { className: "text-xl font-bold", children: ["Preparaci\u00F3n de bolsitas \u00B7 ", j.community.name] }), _jsx("p", { className: "text-sm", children: diaJornada(j.fecha, true) })] }), _jsxs("p", { className: "text-right text-sm text-tenue", children: [j.responsable && _jsxs(_Fragment, { children: ["Responsable: ", nombreCompleto(j.responsable), _jsx("br", {})] }), d.pacientes.length, " ", d.pacientes.length === 1 ? 'paciente' : 'pacientes'] })] }));
}
/* Lista para ir marcando cada medicamento metido en la bolsita. */
function Lista({ d }) {
    const celda = 'border border-tinta/30 px-2 py-1.5 align-top';
    return (_jsxs("div", { children: [_jsx(Membrete, { d: d }), _jsxs("table", { className: "w-full border-collapse text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-black/5 text-left text-xs uppercase", children: [_jsx("th", { className: celda, children: "Paciente" }), _jsx("th", { className: celda, children: "Casa" }), _jsx("th", { className: celda, children: "Medicamento" }), _jsx("th", { className: cn(celda, 'text-right'), children: "Pastillas/d\u00EDa" }), _jsx("th", { className: cn(celda, 'text-right'), children: "Cantidad" }), _jsx("th", { className: cn(celda, 'w-12 text-center'), children: "Lista" })] }) }), d.pacientes.map((p) => (_jsx("tbody", { className: "break-inside-avoid", children: p.items.map((it, i) => (_jsxs("tr", { children: [i === 0 && (_jsxs(_Fragment, { children: [_jsxs("td", { className: celda, rowSpan: p.items.length, children: [_jsx("span", { className: "font-semibold", children: p.nombre }), _jsx("span", { className: "block font-mono text-xs text-tenue", children: p.codigo })] }), _jsx("td", { className: celda, rowSpan: p.items.length, children: p.casa ?? '—' })] })), _jsxs("td", { className: celda, children: [it.medicamento, " ", it.tipo === 'PENDIENTE' && _jsx(Pendiente, {})] }), _jsx("td", { className: cn(celda, 'tabular text-right'), children: dosis(it.dosisDiaria) }), _jsx("td", { className: cn(celda, 'tabular text-right font-semibold'), children: miles(it.cantidad) }), _jsx("td", { className: cn(celda, 'text-center'), children: _jsx("span", { className: "inline-block size-4 border-2 border-tinta/70 align-middle", "aria-hidden": true }) })] }, `${it.medicamento}-${it.tipo}`))) }, p.id)))] }), _jsxs("div", { className: "mt-6 break-inside-avoid", children: [_jsx("h3", { className: "mb-2 text-sm font-bold uppercase", children: "Totales a llevar" }), _jsxs("table", { className: "w-full max-w-md border-collapse text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-black/5 text-left text-xs uppercase", children: [_jsx("th", { className: celda, children: "Medicamento" }), _jsx("th", { className: cn(celda, 'text-right'), children: "Pastillas" })] }) }), _jsx("tbody", { children: d.totales.map((t) => (_jsxs("tr", { children: [_jsx("td", { className: celda, children: t.medicamento }), _jsx("td", { className: cn(celda, 'tabular text-right font-semibold'), children: miles(t.pastillas) })] }, t.medicamento))) })] })] })] }));
}
/* Etiquetas de ~9×5 cm para recortar y pegar en cada bolsita. */
function Etiquetas({ d }) {
    const j = d.jornada;
    return (_jsxs("div", { children: [_jsx("p", { className: "mb-4 text-sm text-tenue print:hidden", children: "Recorte por la l\u00EDnea punteada y pegue cada etiqueta en la bolsita del paciente." }), _jsx("div", { className: "grid grid-cols-1 gap-3 md:grid-cols-[repeat(2,minmax(0,9cm))] print:grid-cols-[repeat(2,9cm)] print:gap-[3mm]", children: d.pacientes.map((p) => (_jsx(Etiqueta, { p: p, batey: j.community.name, fecha: diaJornada(j.fecha) }, p.id))) })] }));
}
function Etiqueta({ p, batey, fecha }) {
    return (_jsxs("article", { className: "flex min-h-[5cm] w-full max-w-[9cm] break-inside-avoid flex-col border-2 border-dashed border-tinta/50 p-3 text-tinta", children: [_jsx("p", { className: "text-lg leading-tight font-bold", children: p.nombre }), _jsxs("p", { className: "mt-0.5 text-xs", children: [_jsx("span", { className: "font-mono font-semibold", children: p.codigo }), p.casa && _jsxs(_Fragment, { children: [" \u00B7 Casa ", p.casa] })] }), _jsxs("p", { className: "text-xs text-tenue", children: [batey, " \u00B7 ", fecha] }), _jsx("ul", { className: "mt-2 space-y-1 border-t border-tinta/20 pt-2 text-sm", children: p.items.map((it) => (_jsxs("li", { className: "leading-snug", children: [_jsx("span", { className: "font-semibold", children: it.medicamento }), " \u2014 ", _jsx("span", { className: "tabular", children: miles(it.cantidad) }), " pastillas \u2014 ", dosis(it.dosisDiaria), " al d\u00EDa", ' ', it.tipo === 'PENDIENTE' && _jsx(Pendiente, {})] }, `${it.medicamento}-${it.tipo}`))) })] }));
}
