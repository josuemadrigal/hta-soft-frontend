import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, ClipboardList, Download, FileSpreadsheet, HeartHandshake, PieChart, Pill, Users, X } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { descargar } from '../api/client';
import { useComunidades, usePlanilla, useResumenReporte, useRonda } from '../api/consultas';
import { TablaPlanilla } from '../components/TablaPlanilla';
import { RondaPorBatey } from '../components/RondaPorBatey';
import { Barras, EJE, REJILLA, SERIES, TOOLTIP, LEYENDA } from '../components/graficas';
import { Boton, Cargando, EncabezadoPagina, Entrada, ErrorCarga, Insignia, Selector, Tabla, Tarjeta, Vacio } from '../components/ui';
import { descargarCsv } from '../lib/copiar';
import { BotonesTrimestre } from '../components/Periodo';
import { CATEGORIAS, colorCategoria, GENEROS, opciones } from '../lib/etiquetas';
import { cn, fecha } from '../lib/formato';
import { AYUDA } from '../lib/ayuda-graficas';
import { SelectorFecha, ymd } from '../components/SelectorFecha';
// Fecha local (no UTC): después de las 8 p. m. en RD, toISOString ya daría mañana.
const iso = (d) => ymd(d);
const hoy = new Date();
const PRESETS = [
    { texto: 'Últimos 12 meses', desde: iso(new Date(hoy.getFullYear() - 1, hoy.getMonth(), hoy.getDate())), hasta: iso(hoy) },
    { texto: 'Este año', desde: `${hoy.getFullYear()}-01-01`, hasta: iso(hoy) },
    { texto: 'Año pasado', desde: `${hoy.getFullYear() - 1}-01-01`, hasta: `${hoy.getFullYear() - 1}-12-31` },
    { texto: 'Desde 2017', desde: '2017-01-01', hasta: iso(hoy) },
];
const ORDEN_CATEGORIAS = ['NORMAL', 'ELEVATED', 'GRADE_1', 'GRADE_2', 'CRISIS'];
const pct = (v) => (v === null ? '—' : `${Math.round(v)}%`);
const miles = (v) => v.toLocaleString('es-DO');
function Kpi({ titulo, valor, detalle, className }) {
    return (_jsxs("div", { className: cn('rounded-xl border border-borde bg-superficie p-4', className), children: [_jsx("p", { className: "text-xs text-tenue", children: titulo }), _jsx("p", { className: "tabular mt-1.5 text-2xl font-semibold tracking-tight", children: valor }), detalle && _jsx("div", { className: "mt-0.5 text-xs text-tenue", children: detalle })] }));
}
function BotonCsv({ onClick }) {
    return (_jsxs("button", { "data-no-copiar": true, onClick: onClick, className: "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-marca-700 hover:bg-marca-50", children: [_jsx(Download, { className: "size-3.5" }), " CSV"] }));
}
function Contenido({ r, filtro }) {
    const s = r.resumen;
    const sufijo = `${filtro.from ?? ''}_${filtro.to ?? ''}`;
    if (s.visitas === 0)
        return _jsx(Tarjeta, { children: _jsx(Vacio, { icono: _jsx(PieChart, { className: "size-8" }), titulo: "Sin visitas en este periodo", children: "Cambia las fechas o quita filtros." }) });
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-7", children: [_jsx(Kpi, { titulo: "Pacientes atendidos", valor: miles(s.pacientes), detalle: `${miles(s.nuevos)} visitas de primera vez` }), _jsx(Kpi, { titulo: "Visitas", valor: miles(s.visitas), detalle: `${miles(s.domiciliarias)} domiciliarias` }), _jsx(Kpi, { titulo: "Controlados", valor: pct(s.controladosPct), detalle: "\u00DAltima toma < 140/90" }), _jsx(Kpi, { titulo: "PA promedio", valor: s.sistolicaPromedio ? `${Math.round(s.sistolicaPromedio)}/${Math.round(s.diastolicaPromedio ?? 0)}` : '—', detalle: "mmHg, todas las tomas" }), _jsx(Kpi, { titulo: "Cumplimiento", valor: pct(s.cumplimientoPromedio), detalle: "Promedio de recetas" }), _jsx(Kpi, { titulo: "Pastillas entregadas", valor: miles(s.pastillas), className: "col-span-2 md:col-span-1 xl:col-span-2", detalle: r.medicamentos.length > 0 && (_jsx("ul", { className: "mt-2 space-y-1 border-t border-borde pt-2", children: r.medicamentos.map((m) => (_jsxs("li", { className: "flex items-baseline justify-between gap-3", children: [_jsx("span", { className: "truncate", children: m.medicamento }), _jsx("span", { className: "tabular shrink-0 font-medium text-tinta", children: miles(m.pastillas) })] }, m.medicamento))) })) })] }), _jsxs("div", { className: "grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]", children: [_jsx(Tarjeta, { titulo: "Visitas y control por trimestre", copiable: true, ayuda: AYUDA.visitasYControl, children: _jsx("div", { className: "h-72 px-2 pt-4 pb-2", children: _jsx(ResponsiveContainer, { children: _jsxs(ComposedChart, { data: r.porTrimestre, margin: { left: -8, right: 4 }, children: [_jsx(CartesianGrid, { ...REJILLA }), _jsx(XAxis, { dataKey: "trimestre", ...EJE }), _jsx(YAxis, { yAxisId: "v", allowDecimals: false, ...EJE }), _jsx(YAxis, { yAxisId: "p", orientation: "right", domain: [0, 100], unit: "%", ...EJE }), _jsx(Tooltip, { ...TOOLTIP, formatter: (v, n) => (n === '% controlados' ? `${v}%` : v) }), _jsx(Legend, { ...LEYENDA }), _jsx(Bar, { yAxisId: "v", dataKey: "visitas", name: "Visitas", fill: "#fed801", radius: [4, 4, 0, 0], maxBarSize: 40 }), _jsx(Line, { yAxisId: "p", dataKey: "controladosPct", name: "% controlados", stroke: "#1d1b18", strokeWidth: 2, dot: { r: 3 } })] }) }) }) }), _jsx(Tarjeta, { titulo: "Clasificaci\u00F3n al cierre del periodo", copiable: true, ayuda: AYUDA.clasificacionCierre, accion: _jsx("span", { className: "text-xs text-tenue", children: "\u00DAltima toma de cada paciente" }), children: _jsx("div", { className: "p-5", children: _jsx(Barras, { filas: r.categorias.map((c) => ({
                                    etiqueta: CATEGORIAS[c.categoria],
                                    valor: c.pacientes,
                                    color: colorCategoria(c.categoria),
                                    detalle: s.pacientes ? `${Math.round((c.pacientes / s.pacientes) * 100)}%` : undefined,
                                })) }) }) })] }), _jsxs("div", { className: "grid grid-cols-1 gap-4 lg:grid-cols-2", children: [_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(Tarjeta, { titulo: "Presi\u00F3n arterial promedio por trimestre", copiable: true, ayuda: AYUDA.presionPromedio, children: _jsx("div", { className: "h-64 px-2 pt-4 pb-2", children: _jsx(ResponsiveContainer, { children: _jsxs(LineChart, { data: r.porTrimestre, margin: { left: -16, right: 12 }, children: [_jsx(CartesianGrid, { ...REJILLA }), _jsx(XAxis, { dataKey: "trimestre", ...EJE }), _jsx(YAxis, { domain: [60, 'auto'], ...EJE }), _jsx(Tooltip, { ...TOOLTIP }), _jsx(Legend, { ...LEYENDA }), _jsx(Line, { dataKey: "sistolicaPromedio", name: "Sist\u00F3lica", stroke: "#1d1b18", strokeWidth: 2, dot: { r: 3 } }), _jsx(Line, { dataKey: "diastolicaPromedio", name: "Diast\u00F3lica", stroke: "#c9a400", strokeWidth: 2, dot: { r: 3 } })] }) }) }) }), _jsx(Tarjeta, { titulo: "Clasificaci\u00F3n por trimestre", copiable: true, ayuda: AYUDA.clasificacionTrimestre, className: "flex flex-1 flex-col", accion: _jsx("span", { className: "text-xs text-tenue", children: "% de pacientes vistos" }), children: _jsx("div", { className: "min-h-64 flex-1 px-2 pt-4 pb-2", children: _jsx(ResponsiveContainer, { children: _jsxs(BarChart, { data: r.porTrimestre.map((t) => ({ trimestre: t.trimestre, ...t.categorias })), stackOffset: "expand", margin: { left: -8, right: 12 }, children: [_jsx(CartesianGrid, { ...REJILLA }), _jsx(XAxis, { dataKey: "trimestre", ...EJE }), _jsx(YAxis, { ...EJE, tickFormatter: (v) => `${Math.round(Number(v) * 100)}%` }), _jsx(Tooltip, { ...TOOLTIP, formatter: (v, n) => [`${miles(Number(v))} pacientes`, n], cursor: { fill: 'rgba(0,0,0,0.04)' } }), _jsx(Legend, { ...LEYENDA, itemSorter: (i) => ORDEN_CATEGORIAS.indexOf(i.dataKey) }), ORDEN_CATEGORIAS.map((c) => (_jsx(Bar, { dataKey: c, name: CATEGORIAS[c], stackId: "c", fill: colorCategoria(c), maxBarSize: 44 }, c)))] }) }) }) })] }), _jsx(Tarjeta, { titulo: "Control por batey", copiable: true, ayuda: AYUDA.controlPorBatey, accion: _jsx("span", { className: "text-xs text-tenue", children: "% con \u00FAltima toma < 140/90" }), children: _jsx("div", { className: "p-5", children: _jsx(Barras, { max: 100, formato: (v) => `${Math.round(v)}%`, filas: [...r.porBatey]
                                    .sort((a, b) => (b.controladosPct ?? 0) - (a.controladosPct ?? 0))
                                    .map((b) => ({ etiqueta: b.batey, valor: b.controladosPct ?? 0, detalle: `de ${b.pacientes}` })) }) }) })] }), _jsx(Tarjeta, { titulo: "Resumen por batey", accion: _jsx(BotonCsv, { onClick: () => descargarCsv(r.porBatey.map((b) => ({ ...b, ...Object.fromEntries(r.medicamentosNombres.map((m) => [m, b.pastillasPorMed[m] ?? 0])) })), [
                        { clave: 'batey', titulo: 'Batey' },
                        { clave: 'pacientes', titulo: 'Pacientes' },
                        { clave: 'visitas', titulo: 'Visitas' },
                        { clave: 'controladosPct', titulo: '% controlados' },
                        { clave: 'sistolicaPromedio', titulo: 'Sistólica prom.' },
                        { clave: 'diastolicaPromedio', titulo: 'Diastólica prom.' },
                        { clave: 'cumplimientoPromedio', titulo: 'Cumplimiento prom. %' },
                        ...r.medicamentosNombres.map((m) => ({ clave: m, titulo: `Pastillas ${m}` })),
                        { clave: 'pastillas', titulo: 'Total pastillas' },
                    ], `reporte-bateyes_${sufijo}`) }), children: _jsx(TablaBateyes, { r: r }) }), r.medicamentos.length > 0 && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid grid-cols-1 gap-4 lg:grid-cols-2", children: [_jsx(Tarjeta, { titulo: "Cumplimiento por medicamento", copiable: true, ayuda: AYUDA.cumplimientoMedicamento, accion: _jsx("span", { className: "text-xs text-tenue", children: "Promedio de recetas con dato" }), children: _jsx("div", { className: "p-5", children: _jsx(Barras, { max: 100, formato: (v) => `${Math.round(v)}%`, filas: r.medicamentos.map((m) => ({ etiqueta: m.medicamento, valor: m.cumplimientoPromedio ?? 0, detalle: `${m.pacientes} pac.` })) }) }) }), _jsx(Tarjeta, { titulo: "Distribuci\u00F3n del cumplimiento", copiable: true, ayuda: AYUDA.distribucionCumplimiento, accion: _jsx("span", { className: "text-xs text-tenue", children: "Recetas" }), children: _jsx("div", { className: "p-5", children: _jsx(Barras, { filas: r.cumplimientoTramos.map((t, i) => ({ etiqueta: t.tramo, valor: t.recetas, color: ['#dc2626', '#ea580c', '#ca8a04', '#15803d'][i] })), formato: miles }) }) })] }), _jsx(Tarjeta, { titulo: "Pastillas entregadas por trimestre", copiable: true, ayuda: AYUDA.pastillasTrimestre, accion: _jsx(BotonCsv, { onClick: () => descargarCsv(r.medicamentos, [
                                { clave: 'medicamento', titulo: 'Medicamento' },
                                { clave: 'pacientes', titulo: 'Pacientes' },
                                { clave: 'recetas', titulo: 'Recetas' },
                                { clave: 'pastillas', titulo: 'Pastillas entregadas' },
                                { clave: 'cumplimientoPromedio', titulo: 'Cumplimiento prom. %' },
                            ], `reporte-medicamentos_${sufijo}`) }), children: _jsx("div", { className: "h-72 px-2 pt-4 pb-2", children: _jsx(ResponsiveContainer, { children: _jsxs(BarChart, { data: r.pastillasPorTrimestre, margin: { left: 0, right: 12 }, children: [_jsx(CartesianGrid, { ...REJILLA }), _jsx(XAxis, { dataKey: "trimestre", ...EJE }), _jsx(YAxis, { ...EJE, tickFormatter: miles }), _jsx(Tooltip, { ...TOOLTIP, formatter: (v) => miles(Number(v)) }), _jsx(Legend, { ...LEYENDA }), r.medicamentosNombres.map((m, i) => (_jsx(Bar, { dataKey: m, stackId: "p", fill: SERIES[i % SERIES.length], maxBarSize: 44 }, m)))] }) }) }) })] })), _jsxs("div", { className: "grid grid-cols-1 gap-4 md:grid-cols-3", children: [_jsx(Tarjeta, { titulo: "Pacientes por edad", copiable: true, ayuda: AYUDA.edad, children: _jsx("div", { className: "p-5", children: _jsx(Barras, { filas: r.demografia.edad.map((g) => ({ etiqueta: `${g.grupo} años`, valor: g.pacientes })), formato: miles }) }) }), _jsx(Tarjeta, { titulo: "Pacientes por g\u00E9nero", copiable: true, ayuda: AYUDA.genero, children: _jsx("div", { className: "p-5", children: _jsx(Barras, { filas: Object.entries(r.demografia.genero).map(([g, n], i) => ({
                                    etiqueta: GENEROS[g],
                                    valor: n,
                                    color: SERIES[i],
                                    detalle: `${Math.round((n / r.demografia.total) * 100)}%`,
                                })), formato: miles }) }) }), _jsx(Tarjeta, { titulo: "H\u00E1bitos y antecedentes", copiable: true, ayuda: AYUDA.habitos, accion: _jsx("span", { className: "text-xs text-tenue", children: "% de pacientes" }), children: _jsx("div", { className: "p-5", children: _jsx(Barras, { max: 100, formato: (v) => `${Math.round(v)}%`, filas: r.demografia.habitos.map((h) => ({ etiqueta: h.habito, valor: (h.pacientes / Math.max(1, r.demografia.total)) * 100, color: '#b45309', detalle: `(${h.pacientes})` })) }) }) })] }), _jsx(Tarjeta, { titulo: _jsxs("span", { className: "flex items-center gap-2", children: [_jsx(AlertTriangle, { className: "size-4 text-red-600" }), " Pacientes sin control al cierre (", miles(r.noControlados.length), ")"] }), accion: r.noControlados.length > 0 && (_jsx(BotonCsv, { onClick: () => descargarCsv(r.noControlados.map((p) => ({ ...p, categoria: CATEGORIAS[p.categoria], fecha: fecha(p.fecha) })), [
                        { clave: 'codigo', titulo: 'Código' },
                        { clave: 'nombre', titulo: 'Paciente' },
                        { clave: 'batey', titulo: 'Batey' },
                        { clave: 'presion', titulo: 'Última PA' },
                        { clave: 'categoria', titulo: 'Clasificación' },
                        { clave: 'fecha', titulo: 'Fecha' },
                        { clave: 'telefono', titulo: 'Teléfono' },
                    ], `pacientes-sin-control_${sufijo}`) })), children: r.noControlados.length === 0 ? (_jsx(Vacio, { titulo: "Todos los pacientes terminaron el periodo controlados" })) : (_jsx("div", { className: "max-h-[28rem] overflow-y-auto", children: _jsx(Tabla, { columnas: ['Paciente', 'Batey', 'Última PA', 'Clasificación', 'Fecha'], children: r.noControlados.map((p) => (_jsxs("tr", { className: "hover:bg-fondo", children: [_jsxs("td", { className: "px-5 py-2.5", children: [_jsx(Link, { to: `/pacientes/${p.id}`, className: "font-medium hover:underline", children: p.nombre }), _jsx("span", { className: "ml-2 font-mono text-xs text-tenue", children: p.codigo })] }), _jsx("td", { className: "px-5 py-2.5", children: p.batey }), _jsx("td", { className: "tabular px-5 py-2.5 font-mono", children: p.presion }), _jsx("td", { className: "px-5 py-2.5", children: _jsx(Insignia, { color: colorCategoria(p.categoria), children: CATEGORIAS[p.categoria] }) }), _jsx("td", { className: "px-5 py-2.5 whitespace-nowrap text-tenue", children: fecha(p.fecha) })] }, p.id))) }) })) })] }));
}
const EXPORTACIONES = [
    { ruta: '/reports/patients/export', archivo: 'pacientes.csv', titulo: 'Listado de pacientes', icono: _jsx(Users, { className: "size-4" }) },
    { ruta: '/reports/patients/high-risk', archivo: 'pacientes-alto-riesgo.csv', titulo: 'Pacientes de alto riesgo', icono: _jsx(AlertTriangle, { className: "size-4" }) },
    { ruta: '/reports/demographics', archivo: 'demografia.csv', titulo: 'Demografía', icono: _jsx(PieChart, { className: "size-4" }) },
];
function Exportacion({ ruta, archivo, titulo, icono }) {
    const bajar = useMutation({ mutationFn: () => descargar(ruta, archivo), onError: (e) => toast.error(`No se pudo generar: ${e.message}`) });
    return (_jsx(Boton, { variante: "secundario", icono: icono, cargando: bajar.isPending, onClick: () => bajar.mutate(), children: titulo }));
}
export function Reportes() {
    const [params, setParams] = useSearchParams();
    const comunidades = useComunidades();
    const filtro = {
        from: params.get('desde') ?? PRESETS[0].desde,
        to: params.get('hasta') ?? undefined,
        communityId: Number(params.get('batey')) || undefined,
        gender: params.get('genero') || undefined,
        ageMin: params.get('edadMin') ? Number(params.get('edadMin')) : undefined,
        ageMax: params.get('edadMax') ? Number(params.get('edadMax')) : undefined,
    };
    const consulta = useResumenReporte(filtro);
    const ronda = useRonda();
    const navegar = useNavigate();
    // Excel con formato: el mismo periodo y filtros de la pantalla, más el listado de pacientes.
    const excel = useMutation({
        mutationFn: () => {
            const q = new URLSearchParams();
            for (const [k, v] of Object.entries(filtro))
                if (v !== undefined && v !== '')
                    q.set(k, String(v));
            return descargar(`/reports/excel?${q}`, `reporte-hta_${filtro.from ?? ''}_${params.get('hasta') ?? ymd(new Date())}.xlsx`);
        },
        onError: (e) => toast.error(`No se pudo generar el Excel: ${e.message}`),
    });
    const cambiar = (c) => setParams((p) => {
        for (const [k, v] of Object.entries(c))
            v ? p.set(k, v) : p.delete(k);
        return p;
    }, { replace: true });
    const desde = params.get('desde') ?? PRESETS[0].desde;
    const hasta = params.get('hasta') ?? PRESETS[0].hasta;
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: "Reportes", descripcion: "Control, cobertura, cumplimiento y medicamentos seg\u00FAn el periodo y los filtros. Cada gr\u00E1fica se puede copiar como imagen.", acciones: _jsxs(_Fragment, { children: [_jsx(Boton, { variante: "secundario", icono: _jsx(ClipboardList, { className: "size-4" }), onClick: () => navegar('/reportes/planilla'), children: "Planilla de la jornada" }), _jsx(Boton, { variante: "secundario", icono: _jsx(HeartHandshake, { className: "size-4" }), onClick: () => navegar('/reportes/donantes'), children: "Informe para donantes" }), _jsx(Boton, { variante: "secundario", icono: _jsx(Pill, { className: "size-4" }), onClick: () => navegar('/reportes/entregas'), children: "Entregas de medicamentos" }), _jsx(Boton, { icono: _jsx(FileSpreadsheet, { className: "size-4" }), cargando: excel.isPending, onClick: () => excel.mutate(), children: "Descargar Excel" })] }) }), _jsx(Tarjeta, { className: "mb-4", children: _jsxs("div", { className: "space-y-3 p-4", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-1.5", children: [PRESETS.map((p) => (_jsx("button", { onClick: () => cambiar({ desde: p.desde, hasta: p.hasta }), className: cn('rounded-full border px-3 py-1 text-sm', desde === p.desde && hasta === p.hasta ? 'border-marca-500 bg-marca-50 font-medium text-marca-700' : 'border-borde text-tenue hover:text-tinta'), children: p.texto }, p.texto))), _jsx("span", { className: "mx-2 hidden h-6 w-px bg-borde sm:block" }), _jsx(BotonesTrimestre, { desde: desde, hasta: hasta, onCambiar: (r) => cambiar(r) })] }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2 xl:grid-cols-[auto_auto_minmax(0,1fr)_minmax(0,1fr)_auto_auto]", children: [_jsxs("div", { className: "flex items-center gap-2 text-sm text-tenue", children: ["Desde", _jsx(SelectorFecha, { corto: true, vacio: "Cualquier fecha", "aria-label": "Desde", value: desde, max: hasta || undefined, onChange: (v) => cambiar({ desde: v }) })] }), _jsxs("div", { className: "flex items-center gap-2 text-sm text-tenue", children: ["Hasta", _jsx(SelectorFecha, { corto: true, vacio: "Cualquier fecha", "aria-label": "Hasta", value: hasta, min: desde || undefined, onChange: (v) => cambiar({ hasta: v }) })] }), _jsx(Selector, { vacio: "Todos los bateyes", value: filtro.communityId ?? '', onChange: (e) => cambiar({ batey: e.target.value }), opciones: (comunidades.data ?? []).map((c) => ({ value: c.id, label: c.name })) }), _jsx(Selector, { vacio: "Todos los g\u00E9neros", value: filtro.gender ?? '', onChange: (e) => cambiar({ genero: e.target.value }), opciones: opciones(GENEROS) }), _jsxs("label", { className: "flex items-center gap-2 text-sm text-tenue", children: ["Edad", _jsx(Entrada, { type: "number", min: 0, max: 120, placeholder: "de", className: "w-16", value: params.get('edadMin') ?? '', onChange: (e) => cambiar({ edadMin: e.target.value }) }), _jsx(Entrada, { type: "number", min: 0, max: 120, placeholder: "a", className: "w-16", value: params.get('edadMax') ?? '', onChange: (e) => cambiar({ edadMax: e.target.value }) })] }), [...params.keys()].length > 0 && (_jsx(Boton, { variante: "fantasma", icono: _jsx(X, { className: "size-4" }), onClick: () => setParams({}, { replace: true }), children: "Limpiar" }))] })] }) }), consulta.isPending ? (_jsx(Cargando, { forma: "pagina", texto: "Calculando reporte\u2026" })) : consulta.isError ? (_jsx(ErrorCarga, { error: consulta.error })) : (_jsx("div", { className: cn('transition-opacity', consulta.isPlaceholderData && 'opacity-60'), children: _jsx(Contenido, { r: consulta.data, filtro: filtro }) })), _jsx(PlanillaReporte, { desde: desde, hasta: hasta, batey: filtro.communityId }), ronda.data && (_jsx("div", { className: "mt-4", children: _jsx(RondaPorBatey, { ronda: ronda.data }) })), _jsx(Tarjeta, { titulo: _jsxs("span", { className: "flex items-center gap-2", children: [_jsx(FileSpreadsheet, { className: "size-4" }), " Exportaciones completas"] }), className: "mt-4", children: _jsx("div", { className: "flex flex-wrap gap-2 p-5", children: EXPORTACIONES.map((e) => (_jsx(Exportacion, { ...e }, e.ruta))) }) })] }));
}
/** La planilla de papel dentro de Reportes, con el mismo periodo y batey de los filtros de arriba. */
function PlanillaReporte({ desde, hasta, batey }) {
    const hastaReal = hasta || ymd(new Date());
    const consulta = usePlanilla({ from: `${desde || '2017-01-01'}T00:00:00-04:00`, to: `${hastaReal}T23:59:59-04:00` });
    const navegar = useNavigate();
    const filas = (consulta.data?.filas ?? []).filter((f) => (batey ? f.communityId === batey : true));
    const total = batey ? undefined : consulta.data?.total;
    return (_jsx(Tarjeta, { className: "mt-4", titulo: _jsxs("span", { className: "flex items-center gap-2", children: [_jsx(ClipboardList, { className: "size-4" }), " Planilla de la jornada"] }), ayuda: AYUDA.planilla, accion: _jsx(Boton, { variante: "secundario", className: "h-8 text-xs", onClick: () => navegar(`/reportes/planilla?desde=${desde || '2017-01-01'}&hasta=${hastaReal}`), children: "Imprimir o enviar" }), children: consulta.isPending ? (_jsx(Cargando, { forma: "lista", texto: "Llenando la planilla\u2026" })) : consulta.isError ? (_jsx(ErrorCarga, { error: consulta.error })) : (_jsx("div", { className: cn('overflow-x-auto transition-opacity', consulta.isPlaceholderData && 'opacity-60'), children: _jsx(TablaPlanilla, { filas: filas, total: total, vacio: "No hubo visitas en este periodo." }) })) }));
}
/** Color del % controlado: verde si llega a 60, ámbar desde 40, rojo por debajo. */
const colorControl = (v) => (v === null ? 'text-tenue' : v >= 60 ? 'text-green-700' : v >= 40 ? 'text-amber-700' : 'text-red-600');
/**
 * Resumen por batey con encabezado agrupado: atención, control y pastillas entregadas por
 * medicamento y concentración. La columna del batey queda fija al desplazar a los lados.
 */
function TablaBateyes({ r }) {
    const s = r.resumen;
    // Medicamentos agrupados: { Amlodipina: ['Amlodipina 5 mg', 'Amlodipina 10 mg'], … }
    const grupos = new Map();
    for (const m of r.medicamentosNombres) {
        const nombre = m.split(' ')[0];
        grupos.set(nombre, [...(grupos.get(nombre) ?? []), m]);
    }
    const totalMed = (m) => r.porBatey.reduce((a, b) => a + (b.pastillasPorMed[m] ?? 0), 0);
    const fijo = 'sticky left-0 z-10 bg-superficie';
    const separador = 'border-l border-borde';
    const th = 'px-3 py-2 text-right font-medium whitespace-nowrap';
    const td = 'px-3 py-2.5 text-right tabular-nums';
    const cantidad = (n) => (n ? miles(n) : _jsx("span", { className: "text-tenue/50", children: "\u2014" }));
    const primeroDelGrupo = new Set([...grupos.values()].map((ms) => ms[0]));
    return (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsxs("thead", { className: "text-xs text-tenue", children: [_jsxs("tr", { className: "border-b border-borde/60 uppercase tracking-wide", children: [_jsx("th", { rowSpan: 2, className: cn(fijo, 'px-5 py-2 text-left font-medium'), children: "Batey" }), _jsx("th", { colSpan: 2, className: cn(separador, 'px-3 pt-2.5 pb-1 text-center font-semibold text-tinta/70'), children: "Atenci\u00F3n" }), _jsx("th", { colSpan: 3, className: cn(separador, 'px-3 pt-2.5 pb-1 text-center font-semibold text-tinta/70'), children: "Control" }), [...grupos.keys()].map((g) => (_jsx("th", { colSpan: grupos.get(g).length, className: cn(separador, 'bg-marca-50/60 px-3 pt-2.5 pb-1 text-center font-semibold text-tinta/70'), children: g }, g))), _jsxs("th", { rowSpan: 2, className: cn(separador, th, 'bg-marca-50/60 text-tinta/70'), children: ["Total", _jsx("br", {}), "pastillas"] })] }), _jsxs("tr", { className: "border-b border-borde", children: [_jsx("th", { className: cn(separador, th), children: "Pacientes" }), _jsx("th", { className: th, children: "Visitas" }), _jsx("th", { className: cn(separador, th), children: "Controlados" }), _jsx("th", { className: th, children: "PA prom." }), _jsx("th", { className: th, children: "Cumplim." }), r.medicamentosNombres.map((m) => (_jsx("th", { className: cn(th, 'bg-marca-50/60', primeroDelGrupo.has(m) && separador), children: m.split(' ').slice(1).join(' ') }, m)))] })] }), _jsx("tbody", { className: "divide-y divide-borde", children: r.porBatey.map((b) => (_jsxs("tr", { className: "group hover:bg-fondo", children: [_jsx("td", { className: cn(fijo, 'px-5 py-2.5 font-medium whitespace-nowrap group-hover:bg-fondo'), children: b.batey }), _jsx("td", { className: cn(td, separador), children: miles(b.pacientes) }), _jsx("td", { className: td, children: miles(b.visitas) }), _jsx("td", { className: cn(td, separador, 'font-medium', colorControl(b.controladosPct)), children: pct(b.controladosPct) }), _jsx("td", { className: cn(td, 'font-mono text-[13px]'), children: b.sistolicaPromedio ? `${Math.round(b.sistolicaPromedio)}/${Math.round(b.diastolicaPromedio ?? 0)}` : '—' }), _jsx("td", { className: td, children: pct(b.cumplimientoPromedio) }), r.medicamentosNombres.map((m) => (_jsx("td", { className: cn(td, primeroDelGrupo.has(m) && separador), children: cantidad(b.pastillasPorMed[m] ?? 0) }, m))), _jsx("td", { className: cn(td, separador, 'font-semibold'), children: miles(b.pastillas) })] }, b.communityId))) }), _jsx("tfoot", { children: _jsxs("tr", { className: "border-t-2 border-tinta/15 bg-fondo font-semibold", children: [_jsxs("td", { className: cn(fijo, 'bg-fondo px-5 py-3'), children: ["Total \u00B7 ", r.porBatey.length, " bateyes"] }), _jsx("td", { className: cn(td, separador), children: miles(s.pacientes) }), _jsx("td", { className: td, children: miles(s.visitas) }), _jsx("td", { className: cn(td, separador, colorControl(s.controladosPct)), children: pct(s.controladosPct) }), _jsx("td", { className: cn(td, 'font-mono text-[13px]'), children: s.sistolicaPromedio ? `${Math.round(s.sistolicaPromedio)}/${Math.round(s.diastolicaPromedio ?? 0)}` : '—' }), _jsx("td", { className: td, children: pct(s.cumplimientoPromedio) }), r.medicamentosNombres.map((m) => (_jsx("td", { className: cn(td, primeroDelGrupo.has(m) && separador), children: miles(totalMed(m)) }, m))), _jsx("td", { className: cn(td, separador), children: miles(s.pastillas) })] }) })] }) }));
}
