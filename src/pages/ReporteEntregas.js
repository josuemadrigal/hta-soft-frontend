import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Download, PackageOpen, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useComunidades } from '../api/consultas';
import { pacientesSinConsulta, reporteEntregas } from '../api/recursos';
import { COLOR, EJE, LEYENDA, REJILLA, TOOLTIP } from '../components/graficas';
import { BotonesTrimestre } from '../components/Periodo';
import { Boton, Cargando, EncabezadoPagina, ErrorCarga, Selector, Tabla, Tarjeta, Vacio } from '../components/ui';
import { descargarCsv } from '../lib/copiar';
import { MOTIVOS_REPOSICION } from '../lib/etiquetas';
import { cn, fecha } from '../lib/formato';
import { SelectorFecha } from '../components/SelectorFecha';
import { AYUDA } from '../lib/ayuda-graficas';
// Fechas locales: toISOString correría el día después de las 8 p. m. en RD (UTC-4).
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function presets() {
    const hoy = new Date();
    return [
        // Mismo periodo que usa el servidor por defecto: así el atajo queda marcado al entrar.
        { texto: 'Últimos 3 meses', desde: iso(new Date(hoy.getFullYear(), hoy.getMonth() - 3, hoy.getDate())), hasta: iso(hoy) },
        { texto: 'Este año', desde: `${hoy.getFullYear()}-01-01`, hasta: iso(hoy) },
        { texto: 'Año pasado', desde: `${hoy.getFullYear() - 1}-01-01`, hasta: `${hoy.getFullYear() - 1}-12-31` },
    ];
}
const miles = (v) => v.toLocaleString('es-DO');
/** Los ceros se atenúan para que resalten las cifras que sí importan. */
const cantidad = (n) => (n ? miles(n) : _jsx("span", { className: "text-tenue/50", children: "\u2014" }));
/** Tres vías de salida de las pastillas, siempre con el mismo color en gráfica y tablas. */
const VIAS = [
    { clave: 'visita', nombre: 'En la visita', color: COLOR.tinta },
    { clave: 'mesa', nombre: 'En la mesa de farmacia', color: COLOR.amarillo },
    { clave: 'reposicion', nombre: 'Reposición sin consulta', color: '#6366f1' },
];
function Kpi({ titulo, valor, detalle, color }) {
    return (_jsxs("div", { className: "rounded-xl border border-borde bg-superficie p-4", children: [_jsxs("p", { className: "flex items-center gap-1.5 text-xs text-tenue", children: [color && _jsx("span", { className: "size-2 shrink-0 rounded-full", style: { backgroundColor: color } }), titulo] }), _jsx("p", { className: "tabular mt-1.5 text-2xl font-semibold tracking-tight", children: valor }), detalle && _jsx("div", { className: "mt-0.5 text-xs text-tenue", children: detalle })] }));
}
function BotonCsv({ onClick }) {
    return (_jsxs("button", { "data-no-copiar": true, onClick: onClick, className: "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-marca-700 hover:bg-marca-50", children: [_jsx(Download, { className: "size-3.5" }), " CSV"] }));
}
const td = 'px-5 py-2.5 text-right tabular-nums whitespace-nowrap';
const der = 'text-right';
function Contenido({ r, sufijo }) {
    const t = r.totales;
    const pendientes = (_jsx(Kpi, { titulo: "Pendientes hoy", valor: miles(t.pendientesPacientes), detalle: _jsxs(_Fragment, { children: [t.pendientesPacientes === 1 ? 'paciente' : 'pacientes', " \u00B7 ", miles(t.pendientesPastillas), " pastillas", ' ', t.pendientesPacientes > 0 && (_jsx(Link, { to: "/entregas", className: "font-medium text-marca-700 hover:underline", children: "Ir a la mesa" }))] }) }));
    // Sin entregas en el periodo igual se muestra lo pendiente de hoy: no depende de las fechas.
    if (t.entregas === 0)
        return (_jsxs("div", { className: "space-y-4", children: [_jsx(Tarjeta, { children: _jsx(Vacio, { icono: _jsx(PackageOpen, { className: "size-8" }), titulo: "Sin entregas en este periodo", children: "Cambia las fechas o el batey." }) }), t.pendientesPacientes > 0 && _jsx("div", { className: "grid grid-cols-2 gap-4 md:grid-cols-3", children: pendientes })] }));
    const bateys = r.porBatey.filter((b) => b.entregas > 0 || b.pendientesPacientes > 0);
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6", children: [_jsx(Kpi, { titulo: "Pastillas entregadas", valor: miles(t.pastillas), detalle: `${miles(t.entregas)} entregas · ${miles(t.pacientes)} ${t.pacientes === 1 ? 'paciente' : 'pacientes'}` }), VIAS.map((v) => (_jsx(Kpi, { titulo: v.nombre, color: v.color, valor: miles(t[v.clave]), detalle: t.pastillas ? `${Math.round((t[v.clave] / t.pastillas) * 100)}% de las pastillas` : undefined }, v.clave))), _jsx(Kpi, { titulo: "Devueltas", valor: miles(t.devueltas), detalle: `al inventario · ${miles(t.descartadas)} descartadas` }), pendientes] }), _jsx(Tarjeta, { titulo: "Pastillas por batey", copiable: true, ayuda: AYUDA.pastillasPorBatey, accion: _jsx("span", { className: "text-xs text-tenue", children: "Seg\u00FAn d\u00F3nde se entregaron" }), children: _jsx("div", { className: "px-2 pt-4 pb-2", style: { height: Math.max(220, bateys.length * 34 + 70) }, children: _jsx(ResponsiveContainer, { children: _jsxs(BarChart, { data: bateys, layout: "vertical", margin: { left: 8, right: 16 }, children: [_jsx(CartesianGrid, { ...REJILLA, vertical: true, horizontal: false }), _jsx(XAxis, { type: "number", ...EJE, tickFormatter: miles }), _jsx(YAxis, { type: "category", dataKey: "batey", width: 110, ...EJE }), _jsx(Tooltip, { ...TOOLTIP, formatter: (v) => miles(Number(v)), cursor: { fill: 'rgba(0,0,0,0.04)' } }), _jsx(Legend, { ...LEYENDA }), VIAS.map((v, i) => (_jsx(Bar, { dataKey: v.clave, name: v.nombre, stackId: "v", fill: v.color, maxBarSize: 22, radius: i === VIAS.length - 1 ? [0, 4, 4, 0] : undefined }, v.clave)))] }) }) }) }), _jsx(Tarjeta, { titulo: "Por batey", accion: _jsx(BotonCsv, { onClick: () => descargarCsv(r.porBatey, [
                        { clave: 'batey', titulo: 'Batey' },
                        { clave: 'entregas', titulo: 'Entregas' },
                        { clave: 'pastillas', titulo: 'Pastillas' },
                        { clave: 'visita', titulo: 'En visita' },
                        { clave: 'mesa', titulo: 'En mesa' },
                        { clave: 'reposicion', titulo: 'Reposición' },
                        { clave: 'pendientesPacientes', titulo: 'Pacientes pendientes hoy' },
                        { clave: 'pendientesPastillas', titulo: 'Pastillas pendientes hoy' },
                    ], `entregas-por-batey_${sufijo}`) }), children: _jsxs(Tabla, { columnas: [
                        'Batey',
                        { texto: 'Entregas', className: der },
                        { texto: 'Pastillas', className: der },
                        { texto: 'En visita', className: der },
                        { texto: 'En mesa', className: der },
                        { texto: 'Reposición', className: der },
                        { texto: 'Pendientes hoy', className: der },
                    ], children: [r.porBatey.map((b) => (_jsxs("tr", { className: "hover:bg-fondo", children: [_jsx("td", { className: "px-5 py-2.5 font-medium whitespace-nowrap", children: b.batey }), _jsx("td", { className: td, children: cantidad(b.entregas) }), _jsx("td", { className: cn(td, 'font-semibold'), children: cantidad(b.pastillas) }), _jsx("td", { className: td, children: cantidad(b.visita) }), _jsx("td", { className: td, children: cantidad(b.mesa) }), _jsx("td", { className: td, children: cantidad(b.reposicion) }), _jsx("td", { className: td, children: b.pendientesPacientes ? (_jsxs("span", { className: "text-amber-700", children: [miles(b.pendientesPacientes), " pac. \u00B7 ", miles(b.pendientesPastillas)] })) : (cantidad(0)) })] }, b.communityId))), _jsxs("tr", { className: "border-t-2 border-tinta/15 bg-fondo font-semibold", children: [_jsx("td", { className: "px-5 py-3", children: "Total" }), _jsx("td", { className: td, children: miles(t.entregas) }), _jsx("td", { className: td, children: miles(t.pastillas) }), _jsx("td", { className: td, children: miles(t.visita) }), _jsx("td", { className: td, children: miles(t.mesa) }), _jsx("td", { className: td, children: miles(t.reposicion) }), _jsxs("td", { className: td, children: [miles(t.pendientesPacientes), " pac. \u00B7 ", miles(t.pendientesPastillas)] })] })] }) }), _jsxs(Tarjeta, { titulo: "Por medicamento", accion: _jsx(BotonCsv, { onClick: () => descargarCsv(r.porMedicamento, [
                        { clave: 'medicamento', titulo: 'Medicamento' },
                        { clave: 'pastillas', titulo: 'Pastillas (netas)' },
                        { clave: 'visita', titulo: 'En visita' },
                        { clave: 'mesa', titulo: 'En mesa' },
                        { clave: 'reposicion', titulo: 'Reposición' },
                        { clave: 'devueltas', titulo: 'Devueltas' },
                        { clave: 'descartadas', titulo: 'Descartadas' },
                    ], `entregas-por-medicamento_${sufijo}`) }), children: [_jsx(Tabla, { columnas: [
                            'Medicamento',
                            { texto: 'Pastillas', className: der },
                            { texto: 'En visita', className: der },
                            { texto: 'En mesa', className: der },
                            { texto: 'Reposición', className: der },
                            { texto: 'Devueltas', className: der },
                            { texto: 'Descartadas', className: der },
                        ], children: r.porMedicamento.map((m) => (_jsxs("tr", { className: "hover:bg-fondo", children: [_jsx("td", { className: "px-5 py-2.5 font-medium whitespace-nowrap", children: m.medicamento }), _jsx("td", { className: cn(td, 'font-semibold'), children: cantidad(m.pastillas) }), _jsx("td", { className: td, children: cantidad(m.visita) }), _jsx("td", { className: td, children: cantidad(m.mesa) }), _jsx("td", { className: td, children: cantidad(m.reposicion) }), _jsx("td", { className: td, children: cantidad(m.devueltas) }), _jsx("td", { className: td, children: cantidad(m.descartadas) })] }, m.medicamento))) }), _jsx("p", { className: "border-t border-borde px-5 py-2.5 text-xs text-tenue", children: "Pastillas netas: ya se restaron las devueltas y las descartadas." })] }), _jsxs("div", { className: "grid grid-cols-1 gap-4 lg:grid-cols-2", children: [_jsx(Tarjeta, { titulo: "Qui\u00E9n entreg\u00F3", children: r.porPersona.length === 0 ? (_jsx(Vacio, { titulo: "Sin datos de qui\u00E9n entreg\u00F3" })) : (_jsx(Tabla, { columnas: ['Persona', { texto: 'Entregas', className: der }, { texto: 'Pastillas', className: der }], children: r.porPersona.map((p) => (_jsxs("tr", { className: "hover:bg-fondo", children: [_jsx("td", { className: "px-5 py-2.5 font-medium", children: p.nombre }), _jsx("td", { className: td, children: miles(p.entregas) }), _jsx("td", { className: td, children: miles(p.pastillas) })] }, p.nombre))) })) }), _jsx(Tarjeta, { titulo: "Reposiciones por motivo", children: r.reposicionesPorMotivo.length === 0 ? (_jsx(Vacio, { titulo: "Sin reposiciones en este periodo" })) : (_jsx(Tabla, { columnas: ['Motivo', { texto: 'Entregas', className: der }, { texto: 'Pastillas', className: der }], children: r.reposicionesPorMotivo.map((m) => (_jsxs("tr", { className: "hover:bg-fondo", children: [_jsx("td", { className: "px-5 py-2.5", children: MOTIVOS_REPOSICION[m.motivo] ?? m.motivo }), _jsx("td", { className: td, children: miles(m.entregas) }), _jsx("td", { className: td, children: miles(m.pastillas) })] }, m.motivo))) })) })] })] }));
}
/** /reportes/entregas — cuántas pastillas salieron, por qué vía, en qué batey y quién las entregó. */
export function PantallaReporteEntregas() {
    const [params, setParams] = useSearchParams();
    const comunidades = useComunidades();
    const [porDefecto] = presets();
    const desde = params.get('desde') ?? porDefecto.desde;
    const hasta = params.get('hasta') ?? porDefecto.hasta;
    const communityId = Number(params.get('batey')) || undefined;
    const consulta = useQuery({
        queryKey: ['entregas', 'reporte', desde, hasta, communityId ?? null],
        queryFn: () => reporteEntregas({ desde, hasta, communityId }),
        // Al cambiar filtros se mantiene el reporte anterior (atenuado) en vez de parpadear.
        placeholderData: keepPreviousData,
    });
    const cambiar = (c) => setParams((p) => {
        for (const [k, v] of Object.entries(c))
            v ? p.set(k, v) : p.delete(k);
        return p;
    }, { replace: true });
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: "Entregas de medicamentos", descripcion: "Cu\u00E1ntas pastillas salieron, por d\u00F3nde y qui\u00E9n las entreg\u00F3.", volver: { a: '/reportes', texto: 'Reportes' } }), _jsx(Tarjeta, { className: "mb-4", children: _jsxs("div", { className: "space-y-3 p-4", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-1.5", children: [presets().map((p) => (_jsx("button", { onClick: () => cambiar({ desde: p.desde, hasta: p.hasta }), className: cn('rounded-full border px-3 py-1 text-sm', desde === p.desde && hasta === p.hasta ? 'border-marca-500 bg-marca-50 font-medium text-marca-700' : 'border-borde text-tenue hover:text-tinta'), children: p.texto }, p.texto))), _jsx("span", { className: "mx-2 hidden h-6 w-px bg-borde sm:block" }), _jsx(BotonesTrimestre, { desde: desde, hasta: hasta, onCambiar: (r) => cambiar(r) })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsxs("div", { className: "flex items-center gap-2 text-sm text-tenue", children: ["Desde", _jsx(SelectorFecha, { corto: true, vacio: "Cualquier fecha", className: "w-auto", "aria-label": "Desde", value: desde, max: hasta || undefined, onChange: (v) => cambiar({ desde: v }) })] }), _jsxs("div", { className: "flex items-center gap-2 text-sm text-tenue", children: ["Hasta", _jsx(SelectorFecha, { corto: true, vacio: "Cualquier fecha", className: "w-auto", "aria-label": "Hasta", value: hasta, min: desde || undefined, onChange: (v) => cambiar({ hasta: v }) })] }), _jsx(Selector, { className: "w-auto min-w-44", vacio: "Todos los bateyes", value: communityId ?? '', onChange: (e) => cambiar({ batey: e.target.value }), opciones: (comunidades.data ?? []).map((c) => ({ value: c.id, label: c.name })) }), [...params.keys()].length > 0 && (_jsx(Boton, { variante: "fantasma", icono: _jsx(X, { className: "size-4" }), onClick: () => setParams({}, { replace: true }), children: "Limpiar" }))] })] }) }), consulta.isPending ? (_jsx(Cargando, { forma: "pagina", texto: "Calculando reporte\u2026" })) : consulta.isError ? (_jsx(ErrorCarga, { error: consulta.error })) : (_jsx("div", { className: cn('transition-opacity', consulta.isPlaceholderData && 'opacity-60'), children: _jsx(Contenido, { r: consulta.data, sufijo: `${desde}_${hasta}` }) })), _jsx(SinConsulta, {})] }));
}
/** Quienes llevan 2 rondas o más recibiendo el tratamiento sin que los vea un médico (no depende del periodo). */
function SinConsulta() {
    const consulta = useQuery({ queryKey: ['entregas', 'sin-consulta'], queryFn: pacientesSinConsulta });
    const lista = consulta.data ?? [];
    if (!lista.length)
        return null;
    return (_jsx("div", { id: "sin-consulta", className: "mt-4 scroll-mt-6", children: _jsx(Tarjeta, { titulo: `Reciben tratamiento sin consulta (${lista.length})`, accion: _jsx("span", { className: "text-xs text-tenue", children: "2 rondas o m\u00E1s sin que los vea un m\u00E9dico" }), children: _jsx(Tabla, { columnas: ['Paciente', 'Batey', 'Rondas', 'Última consulta', 'Última entrega', 'Con quién'], children: lista.map((x) => (_jsxs("tr", { className: "hover:bg-fondo", children: [_jsxs("td", { className: "px-5 py-2.5", children: [_jsxs(Link, { to: `/pacientes/${x.paciente.id}`, className: "font-medium hover:underline", children: [x.paciente.firstName, " ", x.paciente.lastName] }), ' ', _jsx("span", { className: "font-mono text-xs text-tenue", children: x.paciente.patientCode })] }), _jsx("td", { className: "px-5 py-2.5", children: x.paciente.batey }), _jsx("td", { className: "tabular px-5 py-2.5 font-medium text-amber-800", children: x.rondas }), _jsx("td", { className: "tabular px-5 py-2.5 text-tenue", children: x.ultimaConsulta ? fecha(x.ultimaConsulta) : 'Nunca' }), _jsx("td", { className: "tabular px-5 py-2.5 text-tenue", children: fecha(x.ultimaEntrega) }), _jsx("td", { className: "px-5 py-2.5 text-tenue", children: x.con ?? '—' })] }, x.paciente.id))) }) }) }));
}
