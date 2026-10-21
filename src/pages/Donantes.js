import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDownRight, ArrowUpRight, Check, FileDown, HeartHandshake, Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { useReporteDonantes } from '../api/consultas';
import { descargarPdfDonantes, guardarTextoDonantes } from '../api/recursos';
import { trimestreActual } from '../components/Periodo';
import { Barras, COLOR, EJE, LEYENDA, REJILLA, TOOLTIP } from '../components/graficas';
import { AreaTexto, Boton, Cargando, ErrorCarga, Selector, Tarjeta } from '../components/ui';
import { CATEGORIAS, colorCategoria, MOTIVOS_BAJA } from '../lib/etiquetas';
import { cn, fecha } from '../lib/formato';
import { formatoIndicador } from './Metas';
import { AYUDA } from '../lib/ayuda-graficas';
const PRIMER_ANIO = 2017;
const MESES = ['enero – marzo', 'abril – junio', 'julio – septiembre', 'octubre – diciembre'];
const mesAnio = new Intl.DateTimeFormat('es-DO', { month: 'long', year: 'numeric' });
/** "Amlodipina 10 mg" → "AML 10 mg" */
export const abreviar = (m) => {
    const [nombre, ...resto] = m.split(' ');
    return `${nombre.slice(0, 3).toUpperCase()} ${resto.join(' ')}`;
};
const miles = (n) => (n === null ? '—' : n.toLocaleString('es-DO'));
/** /reportes/donantes?anio=&t= — informe trimestral listo para imprimir o guardar como PDF. */
export function Donantes() {
    const [params, setParams] = useSearchParams();
    const hoy = new Date();
    // Por defecto, el último trimestre cerrado.
    const tCerrado = trimestreActual() === 1 ? 4 : trimestreActual() - 1;
    const aCerrado = trimestreActual() === 1 ? hoy.getFullYear() - 1 : hoy.getFullYear();
    const anio = Number(params.get('anio')) || aCerrado;
    // t = null: año completo
    const t = params.get('t') === 'anual' ? null : Number(params.get('t')) || tCerrado;
    const consulta = useReporteDonantes(anio, t);
    const ultimoT = anio === hoy.getFullYear() ? trimestreActual() : 4;
    const pdf = useMutation({
        mutationFn: () => descargarPdfDonantes(anio, t),
        onSuccess: () => toast.success('PDF descargado: listo para enviar.'),
        onError: (e) => toast.error(`No se pudo generar el PDF: ${e.message}`),
    });
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "no-imprimir mb-6 flex flex-wrap items-end justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold tracking-tight", children: "Informe para donantes" }), _jsx("p", { className: "mt-1 text-sm text-tenue", children: "Resumen del impacto por trimestre o por a\u00F1o, sin datos personales de los pacientes. Escribe el mensaje de la fundaci\u00F3n y descarga el PDF para enviarlo." })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(Selector, { className: "w-28", value: anio, onChange: (e) => setParams({ anio: e.target.value, t: t === null ? 'anual' : String(Math.min(t, Number(e.target.value) === hoy.getFullYear() ? trimestreActual() : 4)) }, { replace: true }), opciones: Array.from({ length: hoy.getFullYear() - PRIMER_ANIO + 1 }, (_, i) => ({ value: hoy.getFullYear() - i, label: String(hoy.getFullYear() - i) })) }), _jsx(Selector, { className: "w-52", value: t ?? 'anual', onChange: (e) => setParams({ anio: String(anio), t: e.target.value }, { replace: true }), opciones: [
                                    ...Array.from({ length: ultimoT }, (_, i) => ({ value: String(i + 1), label: `T${i + 1} · ${MESES[i]}` })),
                                    { value: 'anual', label: anio === hoy.getFullYear() ? 'Año completo (hasta hoy)' : 'Año completo' },
                                ] }), _jsx(Boton, { icono: _jsx(FileDown, { className: "size-4" }), disabled: !consulta.data, cargando: pdf.isPending, onClick: () => pdf.mutate(), children: "Descargar PDF" })] })] }), consulta.isPending ? (_jsx(Cargando, { forma: "pagina", texto: "Preparando el informe\u2026" })) : consulta.isError ? (_jsx(ErrorCarga, { error: consulta.error })) : (_jsx("div", { className: cn('transition-opacity', consulta.isPlaceholderData && 'opacity-60'), children: _jsx(Informe, { r: consulta.data }) }))] }));
}
function Comparacion({ actual, antes, etiqueta, mayorEsMejor = true, pct }) {
    if (actual === null || antes === null)
        return _jsxs("span", { className: "text-tenue", children: ["sin dato de ", etiqueta] });
    const d = actual - antes;
    if (Math.abs(d) < (pct ? 0.5 : 1))
        return _jsxs("span", { className: "text-tenue", children: ["igual que ", etiqueta] });
    const bueno = d > 0 === mayorEsMejor;
    const Icono = d > 0 ? ArrowUpRight : ArrowDownRight;
    return (_jsxs("span", { className: cn('inline-flex items-center gap-0.5', bueno ? 'text-green-700' : 'text-red-600'), children: [_jsx(Icono, { className: "size-3.5" }), pct ? `${d > 0 ? '+' : ''}${Math.round(d)} pts` : `${d > 0 ? '+' : ''}${miles(d)}`, " vs ", etiqueta] }));
}
function Cifra({ titulo, valor, children }) {
    return (_jsxs("div", { className: "sin-cortar rounded-xl border border-borde bg-superficie p-4", children: [_jsx("p", { className: "text-xs text-tenue", children: titulo }), _jsx("p", { className: "tabular mt-1 text-3xl font-semibold tracking-tight", children: valor }), children && _jsx("p", { className: "mt-1 text-xs", children: children })] }));
}
function Informe({ r }) {
    const a = r.actual;
    const p = r.previo;
    const total = r.categorias.reduce((x, c) => x + c.pacientes, 0);
    const fallecidos = r.bajas.FALLECIDO ?? 0;
    const otrasBajas = Object.entries(r.bajas).filter(([m]) => m !== 'FALLECIDO');
    const bateyes = r.porBatey.length;
    const periodo = r.periodo.anual ? 'año' : 'trimestre';
    return (_jsxs("article", { className: "space-y-5", children: [_jsxs("header", { className: "sin-cortar flex flex-wrap items-center justify-between gap-4 rounded-xl border border-borde bg-superficie p-6", children: [_jsxs("div", { children: [_jsx("img", { src: "/logo.webp", alt: "Light a Candle \u00B7 Dominican Republic", className: "h-14 w-auto" }), _jsx("p", { className: "mt-3 text-xs font-semibold tracking-wider text-tenue uppercase", children: "Programa de control de la hipertensi\u00F3n \u00B7 bateyes de La Romana" }), _jsx("h2", { className: "mt-1 text-3xl font-semibold tracking-tight", children: r.periodo.anual ? `Informe anual ${r.periodo.anio}` : `Informe trimestral ${r.periodo.etiqueta}` }), _jsxs("p", { className: "mt-1 text-sm text-tenue", children: ["Del ", fecha(r.periodo.desde), " al ", fecha(r.periodo.hasta), r.periodo.enCurso && ' · periodo en curso: cifras parciales'] })] }), _jsxs("div", { className: "rounded-xl bg-marca-500 px-6 py-4 text-center", children: [_jsx("p", { className: "tabular text-4xl font-bold", children: miles(a.pacientes_atendidos) }), _jsx("p", { className: "text-sm font-medium", children: "pacientes atendidos" }), _jsxs("p", { className: "text-xs", children: ["en ", bateyes, " bateyes"] })] })] }), _jsx(Mensaje, { r: r }), _jsxs("section", { className: "grid grid-cols-2 gap-4 md:grid-cols-3", children: [_jsx(Cifra, { titulo: "Pacientes con la presi\u00F3n controlada", valor: formatoIndicador('pct', a.controlados_pct), children: _jsx(Comparacion, { actual: a.controlados_pct, antes: p.controlados_pct, etiqueta: p.etiqueta, pct: true }) }), _jsx(Cifra, { titulo: "Consultas realizadas", valor: miles(a.visitas), children: _jsx(Comparacion, { actual: a.visitas, antes: p.visitas, etiqueta: p.etiqueta }) }), _jsx(Cifra, { titulo: "Pastillas entregadas gratis", valor: miles(r.pastillasTotal), children: _jsxs("span", { className: "text-tenue", children: [[...new Set(r.medicamentos.map((m) => m.medicamento.split(' ')[0]))].join(', ') || '—', " \u00B7 ", r.medicamentos.length, " presentaciones"] }) }), _jsx(Cifra, { titulo: "D\u00EDas de jornada en los bateyes", valor: miles(a.dias_jornada), children: _jsx(Comparacion, { actual: a.dias_jornada, antes: p.dias_jornada, etiqueta: p.etiqueta }) }), _jsx(Cifra, { titulo: "Pacientes nuevos", valor: miles(a.pacientes_nuevos), children: _jsx(Comparacion, { actual: a.pacientes_nuevos, antes: p.pacientes_nuevos, etiqueta: p.etiqueta }) }), _jsx(Cifra, { titulo: "Toman su tratamiento", valor: formatoIndicador('pct', a.cumplimiento_pct), children: _jsx("span", { className: "text-tenue", children: "cumplimiento promedio" }) })] }), _jsxs("p", { className: "sin-cortar rounded-xl border border-borde bg-superficie px-5 py-4 text-sm leading-relaxed", children: ["Atendimos a ", _jsxs("strong", { children: [miles(r.demografia.mujeres), " mujeres"] }), " y ", _jsxs("strong", { children: [miles(r.demografia.hombres), " hombres"] }), r.demografia.edadPromedio !== null && _jsxs(_Fragment, { children: [", con una edad promedio de ", _jsxs("strong", { children: [r.demografia.edadPromedio, " a\u00F1os"] })] }), "; ", miles(r.demografia.mayores60), " tienen 60 a\u00F1os o m\u00E1s. ", r.periodo.anual ? `Frente a ${r.previo.etiqueta}` : `Comparado con el mismo trimestre del año pasado (${r.mismoAnterior.etiqueta})`, ", el control de la presi\u00F3n pas\u00F3 de", ' ', _jsx("strong", { children: formatoIndicador('pct', r.mismoAnterior.controlados_pct) }), " a ", _jsx("strong", { children: formatoIndicador('pct', a.controlados_pct) }), "."] }), _jsxs("div", { className: "grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]", children: [_jsx(Tarjeta, { titulo: "Evoluci\u00F3n en los \u00FAltimos dos a\u00F1os", copiable: true, ayuda: AYUDA.donantesEvolucion, className: "sin-cortar", children: _jsx("div", { className: "h-64 px-2 pt-4 pb-2", children: _jsx(ResponsiveContainer, { children: _jsxs(ComposedChart, { data: r.evolucion, margin: { left: -8, right: 4 }, children: [_jsx(CartesianGrid, { ...REJILLA }), _jsx(XAxis, { dataKey: "etiqueta", ...EJE, fontSize: 11 }), _jsx(YAxis, { yAxisId: "n", allowDecimals: false, ...EJE }), _jsx(YAxis, { yAxisId: "p", orientation: "right", domain: [0, 100], unit: "%", ...EJE }), _jsx(Tooltip, { ...TOOLTIP, formatter: (v, n) => (n === '% controlados' ? `${v}%` : miles(Number(v))) }), _jsx(Legend, { ...LEYENDA }), _jsx(Bar, { yAxisId: "n", dataKey: "pacientes", name: "Pacientes atendidos", fill: COLOR.amarillo, radius: [4, 4, 0, 0], maxBarSize: 36, isAnimationActive: false }), _jsx(Line, { yAxisId: "p", dataKey: "controlados", name: "% controlados", stroke: COLOR.tinta, strokeWidth: 2, dot: { r: 3 }, isAnimationActive: false })] }) }) }) }), _jsx(Tarjeta, { titulo: `Cómo terminaron el ${periodo}`, copiable: true, ayuda: AYUDA.donantesCierre, className: "sin-cortar", accion: _jsx("span", { className: "text-xs text-tenue", children: "\u00DAltima toma de cada paciente" }), children: _jsx("div", { className: "p-5", children: _jsx(Barras, { filas: r.categorias.map((c) => ({ etiqueta: CATEGORIAS[c.categoria], valor: c.pacientes, color: colorCategoria(c.categoria), detalle: total ? `${Math.round((c.pacientes / total) * 100)}%` : undefined })) }) }) })] }), r.casos.length > 0 && (_jsxs("section", { className: "sin-cortar", children: [_jsxs("h3", { className: "mb-2 flex items-center gap-2 text-sm font-semibold", children: [_jsx(HeartHandshake, { className: "size-4" }), " Historias del ", periodo] }), _jsx("div", { className: "grid gap-3 md:grid-cols-2", children: r.casos.map((c, i) => (_jsx("div", { className: "rounded-xl border border-borde bg-superficie p-4 text-sm leading-relaxed", children: _jsxs("p", { children: [_jsxs("strong", { children: [c.iniciales, ", ", c.sexo, " de ", c.edad, " a\u00F1os"] }), ' ', "de ", c.batey, ". En ", mesAnio.format(new Date(c.fechaAntes)), " lleg\u00F3 con la presi\u00F3n en ", _jsx("strong", { className: "text-red-600", children: c.antes }), "; con el tratamiento y el seguimiento de cada jornada, el ", fecha(c.fechaAhora), " la ten\u00EDa en ", _jsx("strong", { className: "text-green-700", children: c.ahora }), "."] }) }, i))) }), _jsx("p", { className: "mt-1.5 text-xs text-tenue", children: "Para proteger su privacidad solo se muestran las iniciales." })] })), _jsxs("div", { className: "grid gap-4 lg:grid-cols-2", children: [_jsx(Tarjeta, { titulo: "Por batey", className: "sin-cortar overflow-x-auto lg:col-span-2", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-borde text-left text-xs text-tenue", children: [_jsx("th", { className: "px-5 py-2 font-medium", children: "Batey" }), _jsx("th", { className: "px-3 py-2 text-right font-medium", children: "Pacientes" }), _jsx("th", { className: "px-3 py-2 text-right font-medium", children: "Hombres" }), _jsx("th", { className: "px-3 py-2 text-right font-medium", children: "Mujeres" }), _jsx("th", { className: "px-3 py-2 text-right font-medium whitespace-nowrap", title: "Edad promedio, en a\u00F1os", children: "Edad prom." }), _jsx("th", { className: "px-3 py-2 text-right font-medium", children: "Controlados" }), r.medicamentosNombres.map((m) => (_jsx("th", { className: "px-3 py-2 text-right font-medium whitespace-nowrap", title: m, children: abreviar(m) }, m))), _jsx("th", { className: "px-5 py-2 text-right font-medium", children: "Total" })] }) }), _jsx("tbody", { className: "tabular", children: r.porBatey.map((b) => (_jsxs("tr", { className: "border-b border-borde last:border-0", children: [_jsx("td", { className: "px-5 py-1.5 whitespace-nowrap", children: b.batey }), _jsx("td", { className: "px-3 py-1.5 text-right", children: miles(b.pacientes) }), _jsx("td", { className: "px-3 py-1.5 text-right", children: miles(b.hombres) }), _jsx("td", { className: "px-3 py-1.5 text-right", children: miles(b.mujeres) }), _jsx("td", { className: "px-3 py-1.5 text-right", children: b.edadPromedio ?? '—' }), _jsx("td", { className: "px-3 py-1.5 text-right", children: formatoIndicador('pct', b.controladosPct) }), r.medicamentosNombres.map((m) => (_jsx("td", { className: "px-3 py-1.5 text-right", children: miles(b.pastillasPorMed[m] ?? 0) }, m))), _jsx("td", { className: "px-5 py-1.5 text-right font-medium", children: miles(b.pastillas) })] }, b.batey))) })] }) }), _jsxs("div", { className: "space-y-4", children: [r.metas.length > 0 && (_jsx(Tarjeta, { titulo: `Metas ${r.periodo.anio} (en lo que va del año)`, className: "sin-cortar", children: _jsx("ul", { className: "space-y-3 p-5", children: r.metas.map((m) => {
                                        const avance = m.valor === null ? 0 : m.mayorEsMejor ? Math.min(1, m.valor / (m.meta || 1)) : Math.min(1, (m.meta || 0.1) / Math.max(m.valor, 0.1));
                                        return (_jsxs("li", { className: "text-sm", children: [_jsxs("div", { className: "mb-1 flex justify-between", children: [_jsx("span", { children: m.nombre }), _jsxs("span", { className: "tabular text-tenue", children: [_jsx("strong", { className: "text-tinta", children: formatoIndicador(m.tipo, m.valor) }), " de ", formatoIndicador(m.tipo, m.meta)] })] }), _jsx("div", { className: "h-2 overflow-hidden rounded-full bg-black/[0.06]", children: _jsx("div", { className: "h-full rounded-full bg-marca-500", style: { width: `${avance * 100}%` } }) })] }, m.clave));
                                    }) }) })), (fallecidos > 0 || otrasBajas.length > 0) && (_jsx(Tarjeta, { titulo: `Bajas del ${periodo}`, className: "sin-cortar", children: _jsxs("p", { className: "p-5 text-sm leading-relaxed", children: [fallecidos > 0 && (_jsxs(_Fragment, { children: ["Recordamos a ", _jsx("strong", { children: fallecidos }), " ", fallecidos === 1 ? 'paciente que falleció' : 'pacientes que fallecieron', " en este ", periodo, ".", ' '] })), otrasBajas.length > 0 && _jsxs(_Fragment, { children: ["Otras bajas: ", otrasBajas.map(([m, n]) => `${MOTIVOS_BAJA[m].toLowerCase()} (${n})`).join(', '), "."] })] }) }))] })] }), _jsxs("footer", { className: "pt-2 text-center text-xs text-tenue", children: ["Light a Candle \u00B7 Dominican Republic \u2014 informe generado el ", fecha(new Date().toISOString()), ". Controlado = \u00FAltima toma por debajo de 140/90 mmHg."] })] }));
}
/** Mensaje de la fundación para el trimestre: se edita aquí y se imprime como texto. */
function Mensaje({ r }) {
    const cliente = useQueryClient();
    const [texto, setTexto] = useState(r.texto);
    const [editando, setEditando] = useState(false);
    useEffect(() => {
        setTexto(r.texto);
        setEditando(false);
    }, [r.texto, r.periodo.etiqueta]);
    const guardar = useMutation({
        mutationFn: () => guardarTextoDonantes(r.periodo.anio, r.periodo.trimestre, texto.trim()),
        onSuccess: () => {
            cliente.invalidateQueries({ queryKey: ['donantes', r.periodo.anio, r.periodo.trimestre] });
            setEditando(false);
            toast.success('Mensaje guardado');
        },
        onError: (e) => toast.error(e.message),
    });
    if (editando) {
        return (_jsxs("div", { className: "no-imprimir space-y-2 rounded-xl border border-borde bg-superficie p-4", children: [_jsx(AreaTexto, { autoFocus: true, rows: 5, maxLength: 4000, value: texto, onChange: (e) => setTexto(e.target.value), placeholder: "Gracias a su apoyo\u2026 Este trimestre visitamos\u2026 Lo que viene\u2026" }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Boton, { variante: "secundario", onClick: () => (setTexto(r.texto), setEditando(false)), children: "Cancelar" }), _jsx(Boton, { icono: _jsx(Check, { className: "size-4" }), cargando: guardar.isPending, onClick: () => guardar.mutate(), children: "Guardar mensaje" })] })] }));
    }
    if (!r.texto) {
        return (_jsxs("button", { onClick: () => setEditando(true), className: "no-imprimir flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-borde p-4 text-sm text-tenue hover:text-tinta", children: [_jsx(Pencil, { className: "size-4" }), " Escribir el mensaje de la fundaci\u00F3n para este ", r.periodo.anual ? 'año' : 'trimestre'] }));
    }
    return (_jsxs("section", { className: "group sin-cortar relative rounded-xl border-l-4 border-marca-500 bg-superficie px-6 py-4", children: [_jsx("p", { className: "text-[15px] leading-relaxed whitespace-pre-line", children: r.texto }), _jsx("button", { onClick: () => setEditando(true), className: "no-imprimir absolute top-3 right-3 rounded-md p-1.5 text-tenue opacity-0 group-hover:opacity-100 hover:bg-black/5", "aria-label": "Editar mensaje", children: _jsx(Pencil, { className: "size-4" }) })] }));
}
