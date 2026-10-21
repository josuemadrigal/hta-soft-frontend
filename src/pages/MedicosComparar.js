import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Crown, Plus, X } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useComparacion, useMedicos } from '../api/consultas';
import { FiltroPeriodo, useFiltroPeriodo } from '../components/FiltroPeriodo';
import { EJE, LEYENDA, REJILLA, TOOLTIP } from '../components/graficas';
import { Cargando, EncabezadoPagina, ErrorCarga, Selector, Tarjeta, Vacio } from '../components/ui';
import { CATEGORIAS, colorCategoria } from '../lib/etiquetas';
import { cn } from '../lib/formato';
import { AYUDA } from '../lib/ayuda-graficas';
/** Un color por médico (el amarillo de marca no se usa en líneas: no se lee sobre blanco). */
const COLORES = ['#1d1b18', '#d97706', '#2563eb', '#db2777'];
const miles = (n) => n.toLocaleString('es-DO');
const pct = (v) => (v === null ? '—' : `${Math.round(v)}%`);
const FILAS = [
    { texto: 'Visitas', valor: (m) => m.visitas, mostrar: (m) => miles(m.visitas) },
    { texto: 'Pacientes atendidos', valor: (m) => m.pacientes, mostrar: (m) => miles(m.pacientes) },
    { texto: 'Jornadas', valor: (m) => m.logros.jornadas, mostrar: (m) => miles(m.logros.jornadas) },
    { texto: 'Bateyes', valor: (m) => m.logros.bateyes, mostrar: (m) => miles(m.logros.bateyes) },
    { texto: 'Pacientes controlados', valor: (m) => m.controladosPct, mostrar: (m) => pct(m.controladosPct) },
    { texto: 'Llevó a control', valor: (m) => m.logros.llevoAControl, mostrar: (m) => miles(m.logros.llevoAControl) },
    { texto: 'Mejoraron de categoría', valor: (m) => m.logros.mejoraron, mostrar: (m) => miles(m.logros.mejoraron) },
    { texto: 'PA sistólica promedio', valor: (m) => m.sistolicaPromedio, mostrar: (m) => (m.sistolicaPromedio ? `${Math.round(m.sistolicaPromedio)}/${Math.round(m.diastolicaPromedio ?? 0)}` : '—'), menorEsMejor: true },
    { texto: 'Cumplimiento promedio', valor: (m) => m.cumplimientoPromedio, mostrar: (m) => pct(m.cumplimientoPromedio) },
    { texto: 'Pacientes nuevos', valor: (m) => m.logros.nuevos, mostrar: (m) => miles(m.logros.nuevos) },
    { texto: 'Domiciliarias', valor: (m) => m.logros.domiciliarias, mostrar: (m) => miles(m.logros.domiciliarias) },
];
export function MedicosComparar() {
    const [params, setParams] = useSearchParams();
    const ids = (params.get('ids') ?? '')
        .split(',')
        .map(Number)
        .filter((n) => n > 0);
    const filtro = useFiltroPeriodo();
    const todos = useMedicos(filtro);
    const consulta = useComparacion(ids, filtro);
    const cambiarIds = (nuevos) => setParams((p) => {
        p.set('ids', nuevos.join(','));
        return p;
    }, { replace: true });
    const medicos = consulta.data?.medicos ?? [];
    // Todos los trimestres que aparezcan en alguno, una columna por médico.
    const trimestres = [...new Map(medicos.flatMap((m) => m.porTrimestre.map((t) => [t.clave, t.trimestre]))).entries()].sort(([a], [b]) => a.localeCompare(b));
    const serie = (campo) => trimestres.map(([clave, trimestre]) => ({
        trimestre,
        ...Object.fromEntries(medicos.map((m) => [m.nombre, m.porTrimestre.find((t) => t.clave === clave)?.[campo] ?? null])),
    }));
    const disponibles = (todos.data?.medicos ?? []).filter((m) => m.visitas > 0 && !ids.includes(m.id));
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: "Comparar m\u00E9dicos", descripcion: "Mismo periodo y batey para todos. La corona marca el mejor valor de cada fila.", volver: { a: `/medicos?${new URLSearchParams([...params].filter(([k]) => k !== 'ids')).toString()}`, texto: 'Médicos' } }), _jsx(FiltroPeriodo, {}), _jsx(Tarjeta, { className: "mb-4", children: _jsxs("div", { className: "flex flex-wrap items-center gap-2 p-4", children: [ids.map((id, i) => {
                            const m = medicos.find((x) => x.id === id) ?? todos.data?.medicos.find((x) => x.id === id);
                            return (_jsxs("span", { className: "flex items-center gap-2 rounded-full border border-borde py-1 pr-1 pl-3 text-sm", children: [_jsx("span", { className: "size-2.5 rounded-full", style: { backgroundColor: COLORES[i] } }), m?.nombre ?? `#${id}`, _jsx("button", { onClick: () => cambiarIds(ids.filter((x) => x !== id)), className: "rounded-full p-1 text-tenue hover:bg-black/5 hover:text-tinta", "aria-label": "Quitar", children: _jsx(X, { className: "size-3.5" }) })] }, id));
                        }), ids.length < 4 && (_jsxs("label", { className: "flex items-center gap-2 text-sm text-tenue", children: [_jsx(Plus, { className: "size-4" }), _jsx(Selector, { className: "w-auto min-w-56", vacio: "Agregar m\u00E9dico\u2026", value: "", onChange: (e) => e.target.value && cambiarIds([...ids, Number(e.target.value)]), opciones: disponibles.map((m) => ({ value: m.id, label: `${m.nombre} (${miles(m.visitas)} visitas)` })) })] }))] }) }), ids.length < 2 ? (_jsx(Tarjeta, { children: _jsx(Vacio, { titulo: "Elige al menos dos m\u00E9dicos", children: "Agr\u00E9galos con el selector de arriba." }) })) : consulta.isPending ? (_jsx(Cargando, { forma: "pagina", texto: "Comparando\u2026" })) : consulta.isError ? (_jsx(ErrorCarga, { error: consulta.error })) : (_jsxs("div", { className: cn('space-y-4 transition-opacity', consulta.isPlaceholderData && 'opacity-60'), children: [_jsx(Tarjeta, { titulo: "Resumen", copiable: true, ayuda: AYUDA.compararResumen, children: _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-borde", children: [_jsx("th", { className: "px-5 py-3 text-left text-xs font-medium tracking-wide text-tenue uppercase", children: "Indicador" }), medicos.map((m, i) => (_jsx("th", { className: "px-5 py-3 text-right font-semibold whitespace-nowrap", children: _jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx("span", { className: "size-2.5 rounded-full", style: { backgroundColor: COLORES[i] } }), m.nombre] }) }, m.id)))] }) }), _jsx("tbody", { className: "divide-y divide-borde", children: FILAS.map((f) => {
                                            const valores = medicos.map((m) => f.valor(m)).filter((v) => v !== null);
                                            const mejor = valores.length > 1 ? (f.menorEsMejor ? Math.min(...valores) : Math.max(...valores)) : null;
                                            return (_jsxs("tr", { children: [_jsx("td", { className: "px-5 py-2.5 text-tenue", children: f.texto }), medicos.map((m) => {
                                                        const gana = mejor !== null && f.valor(m) === mejor;
                                                        return (_jsxs("td", { className: cn('tabular px-5 py-2.5 text-right', gana && 'bg-marca-50 font-semibold'), children: [gana && _jsx(Crown, { className: "mr-1.5 inline size-3.5 text-marca-700" }), f.mostrar(m)] }, m.id));
                                                    })] }, f.texto));
                                        }) })] }) }) }), _jsxs("div", { className: "grid grid-cols-1 gap-4 lg:grid-cols-2", children: [_jsx(Tarjeta, { titulo: "% de pacientes controlados por trimestre", copiable: true, ayuda: AYUDA.compararControl, children: _jsx("div", { className: "h-72 px-2 pt-4 pb-2", children: _jsx(ResponsiveContainer, { children: _jsxs(LineChart, { data: serie('controladosPct'), margin: { left: -16, right: 12 }, children: [_jsx(CartesianGrid, { ...REJILLA }), _jsx(XAxis, { dataKey: "trimestre", ...EJE }), _jsx(YAxis, { domain: [0, 100], unit: "%", ...EJE }), _jsx(Tooltip, { ...TOOLTIP, formatter: (v) => (v === null ? '—' : `${v}%`) }), _jsx(Legend, { ...LEYENDA }), medicos.map((m, i) => (_jsx(Line, { dataKey: m.nombre, stroke: COLORES[i], strokeWidth: 2.5, dot: { r: 3 }, connectNulls: true }, m.id)))] }) }) }) }), _jsx(Tarjeta, { titulo: "Visitas por trimestre", copiable: true, ayuda: AYUDA.compararVisitas, children: _jsx("div", { className: "h-72 px-2 pt-4 pb-2", children: _jsx(ResponsiveContainer, { children: _jsxs(BarChart, { data: serie('visitas'), margin: { left: -16, right: 12 }, children: [_jsx(CartesianGrid, { ...REJILLA }), _jsx(XAxis, { dataKey: "trimestre", ...EJE }), _jsx(YAxis, { allowDecimals: false, ...EJE }), _jsx(Tooltip, { ...TOOLTIP }), _jsx(Legend, { ...LEYENDA }), medicos.map((m, i) => (_jsx(Bar, { dataKey: m.nombre, fill: COLORES[i], radius: [3, 3, 0, 0], maxBarSize: 22 }, m.id)))] }) }) }) })] }), _jsx(Tarjeta, { titulo: "C\u00F3mo terminaron sus pacientes", copiable: true, ayuda: AYUDA.compararTerminaron, accion: _jsx("span", { className: "text-xs text-tenue", children: "% seg\u00FAn la \u00FAltima toma con cada m\u00E9dico" }), children: _jsxs("div", { className: "space-y-3 p-5", children: [medicos.map((m) => {
                                    const total = m.categorias.reduce((a, c) => a + c.pacientes, 0);
                                    return (_jsxs("div", { className: "grid grid-cols-[10rem_1fr] items-center gap-3 text-sm", children: [_jsx("span", { className: "truncate font-medium", children: m.nombre }), _jsx("div", { className: "flex h-5 overflow-hidden rounded-md", children: m.categorias
                                                    .filter((c) => c.pacientes > 0)
                                                    .map((c) => (_jsx("span", { title: `${CATEGORIAS[c.categoria]}: ${c.pacientes} (${Math.round((c.pacientes / total) * 100)}%)`, style: { width: `${(c.pacientes / total) * 100}%`, backgroundColor: colorCategoria(c.categoria) } }, c.categoria))) })] }, m.id));
                                }), _jsx("div", { className: "flex flex-wrap gap-x-4 gap-y-1 pt-2 text-xs text-tenue", children: ['NORMAL', 'ELEVATED', 'GRADE_1', 'GRADE_2', 'CRISIS'].map((c) => (_jsxs("span", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "size-2.5 rounded-sm", style: { backgroundColor: colorCategoria(c) } }), CATEGORIAS[c]] }, c))) })] }) })] }))] }));
}
