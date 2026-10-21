import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, CalendarCheck, CalendarPlus, Tent, HeartPulse, Pill, SearchX, Users } from 'lucide-react';
import { conteoPendientesEntrega, pacientesSinConsulta } from '../api/recursos';
import { Link, useSearchParams } from 'react-router';
import { MiPanelVista } from '../components/MiPanel';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAlertasInventario, useComunidades, useEstadisticasPanel, useJornadas, useResumenReporte, useRonda, useTendencia } from '../api/consultas';
import { useSesion } from '../auth/sesion';
import { COLOR, EJE, REJILLA, TOOLTIP, LEYENDA } from '../components/graficas';
import { Cargando, EncabezadoPagina, ErrorCarga, Hueso, Insignia, Selector, Tarjeta, Vacio } from '../components/ui';
import { BarraPeriodo } from '../components/BarraPeriodo';
import { usePeriodoPanel } from '../lib/periodo-panel';
import { CATEGORIAS, colorCategoria } from '../lib/etiquetas';
import { cn, fecha, nombreCompleto } from '../lib/formato';
import { diaJornada, hoyYmd } from './Jornadas';
import { asistencia } from '../lib/asistencia';
import { AYUDA } from '../lib/ayuda-graficas';
const miles = (n) => n.toLocaleString('es-DO');
const ORDEN = ['NORMAL', 'ELEVATED', 'GRADE_1', 'GRADE_2', 'CRISIS'];
function Indicador({ titulo, valor, detalle, icono, progreso, a, tono, }) {
    const cuerpo = (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center justify-between text-sm text-tenue", children: [titulo, _jsx("span", { className: tono === 'alerta' ? 'text-red-600' : 'text-tinta/40', children: icono })] }), _jsx("p", { className: "tabular mt-2 text-3xl font-semibold tracking-tight", children: valor }), progreso !== undefined && (_jsx("div", { className: "mt-2 h-1.5 overflow-hidden rounded-full bg-black/[0.06]", children: _jsx("div", { className: "h-full rounded-full bg-marca-500", style: { width: `${Math.min(100, progreso)}%` } }) })), _jsx("p", { className: "mt-2 text-xs leading-snug text-tenue", children: detalle })] }));
    const clase = 'block rounded-xl border border-borde bg-superficie p-5';
    return a ? (_jsx(Link, { to: a, className: `${clase} transition-colors hover:border-tinta/30`, children: cuerpo })) : (_jsx("div", { className: clase, children: cuerpo }));
}
/** Panel: vista general (filtrable por batey) o "Mi panel" del médico. Ambas en la URL. */
export function Panel() {
    const { usuario, tiene } = useSesion();
    const [params, setParams] = useSearchParams();
    const comunidades = useComunidades();
    const puedeMio = tiene('visitas.registrar');
    // Quien registra visitas pero no ve reportes (médico, enfermería) entra a su propio panel.
    const porDefecto = puedeMio && !tiene('reportes.ver') ? 'mio' : 'general';
    const vista = puedeMio ? (params.get('vista') ?? porDefecto) : 'general';
    const batey = Number(params.get('batey')) || undefined;
    const periodo = usePeriodoPanel();
    const cambiar = (c) => setParams((p) => {
        for (const [k, v] of Object.entries(c))
            (v ? p.set(k, v) : p.delete(k));
        return p;
    }, { replace: true });
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: `Hola, ${usuario?.firstName ?? ''}`, descripcion: new Intl.DateTimeFormat('es-DO', { dateStyle: 'full' }).format(new Date()), acciones: _jsxs(_Fragment, { children: [vista === 'general' && (_jsx(Selector, { "aria-label": "Batey", className: "w-56", vacio: "Todos los bateyes", value: batey ?? '', onChange: (e) => cambiar({ batey: e.target.value || undefined }), opciones: (comunidades.data ?? []).filter((c) => c.isActive).map((c) => ({ value: c.id, label: c.name })) })), puedeMio && (_jsx("div", { className: "flex rounded-lg border border-borde bg-superficie p-0.5 text-sm", role: "tablist", children: [
                                ['mio', 'Mi panel'],
                                ['general', 'General'],
                            ].map(([v, texto]) => (_jsx("button", { role: "tab", "aria-selected": vista === v, onClick: () => cambiar({ vista: v === porDefecto ? undefined : v }), className: cn('rounded-md px-3 py-1.5', vista === v ? 'bg-marca-500 font-medium' : 'text-tenue hover:text-tinta'), children: texto }, v))) }))] }) }), _jsx(BarraPeriodo, { periodo: periodo, cambiar: periodo.cambiar }), vista === 'mio' ? _jsx(MiPanelVista, { periodo: periodo }) : _jsx(PanelGeneral, { batey: batey, periodo: periodo, nombreBatey: comunidades.data?.find((c) => c.id === batey)?.name })] }));
}
/** Encabezado de sección: título y una línea de contexto. */
function Seccion({ titulo, detalle, children }) {
    return (_jsxs("section", { className: "mt-8", children: [_jsxs("div", { className: "mb-3 flex flex-wrap items-baseline justify-between gap-x-4", children: [_jsx("h2", { className: "text-lg font-semibold tracking-tight", children: titulo }), detalle && _jsx("p", { className: "text-sm text-tenue", children: detalle })] }), children] }));
}
function PanelGeneral({ batey, periodo, nombreBatey: nombreDelBatey }) {
    const { tiene } = useSesion();
    const stats = useEstadisticasPanel(batey);
    const alertas = useAlertasInventario();
    const porEntregar = useQuery({ queryKey: ['entregas', 'conteo'], queryFn: conteoPendientesEntrega });
    const sinConsulta = useQuery({ queryKey: ['entregas', 'sin-consulta'], queryFn: pacientesSinConsulta });
    const proximas = useJornadas({ desde: hoyYmd(), estado: 'PLANIFICADA', communityId: batey });
    const ronda = useRonda(batey);
    const tendencia = useTendencia(batey);
    const comunidades = useComunidades();
    if (stats.isPending || ronda.isPending)
        return _jsx(EsqueletoPanel, {});
    if (stats.isError)
        return _jsx(ErrorCarga, { error: stats.error });
    if (ronda.isError)
        return _jsx(ErrorCarga, { error: ronda.error });
    const s = stats.data;
    const r = ronda.data;
    const t = r.totals;
    const nombreBatey = (id) => comunidades.data?.find((c) => c.id === id)?.name ?? '';
    const finRonda = new Date(r.round.end);
    const diasParaCerrar = Math.max(0, Math.ceil((finRonda.getTime() - Date.now()) / 86_400_000));
    // En seguimiento = vinieron en los últimos 6 meses.
    const enSeguimiento = t.seen + t.pending;
    // La ronda se mide contra lo esperado: la media alta de las últimas jornadas de cada batey (ver Configuración).
    const esperados = t.expected ?? enSeguimiento;
    const pctRonda = esperados ? Math.min(100, Math.round((t.seen / esperados) * 100)) : 0;
    const faltan = (c) => c.missing ?? c.pending;
    // Tendencia del control
    const trimestres = tendencia.data?.trimestres ?? [];
    const ultimoConDatos = [...trimestres].reverse().find((q) => q.controladosPct !== null);
    const anterior = ultimoConDatos ? trimestres[trimestres.indexOf(ultimoConDatos) - 1] : undefined;
    const cambio = ultimoConDatos && anterior?.controladosPct != null ? Math.round(ultimoConDatos.controladosPct - anterior.controladosPct) : null;
    // Clasificación de la última toma de los pacientes en seguimiento
    const hoy = tendencia.data?.hoy ?? [];
    const totalHoy = hoy.reduce((a, h) => a + h.pacientes, 0);
    const rebanadas = [
        ...ORDEN.map((c) => {
            const h = hoy.find((x) => x.categoria === c);
            return { nombre: CATEGORIAS[c], valor: h?.pacientes ?? 0, color: colorCategoria(c), configId: h?.configId ?? null };
        }),
        { nombre: 'Sin toma válida', valor: hoy.find((x) => x.categoria === null)?.pacientes ?? 0, color: COLOR.gris, configId: null },
    ].filter((x) => x.valor > 0);
    const altoRiesgo = rebanadas.filter((x) => x.nombre === CATEGORIAS.GRADE_2 || x.nombre === CATEGORIAS.CRISIS).reduce((a, x) => a + x.valor, 0);
    // Para hacer
    const conJornada = new Set((proximas.data ?? []).map((j) => j.communityId));
    const sinJornada = r.byCommunity.filter((c) => !conJornada.has(c.communityId) && faltan(c) > 0).sort((a, b) => faltan(b) - faltan(a));
    const pendientes = [];
    const proxima = proximas.data?.[0];
    if (proxima) {
        const esHoy = proxima.fecha.slice(0, 10) === hoyYmd();
        pendientes.push({
            icono: _jsx(Tent, { className: "size-4" }),
            texto: (_jsxs(_Fragment, { children: [esHoy ? 'Hoy hay jornada en ' : 'Próxima jornada: ', _jsx("strong", { children: proxima.community.name }), !esHoy && `, ${diaJornada(proxima.fecha, true).toLowerCase()}`, ". Revisa qu\u00E9 llevar."] })),
            a: `/jornadas/${proxima.id}`,
        });
    }
    if (sinJornada.length && tiene('jornadas.planificar')) {
        pendientes.push({
            icono: _jsx(CalendarPlus, { className: "size-4" }),
            texto: (_jsxs(_Fragment, { children: [_jsx("strong", { children: sinJornada.length === 1 ? '1 batey' : `${sinJornada.length} bateyes` }), " sin jornada planificada esta ronda; donde m\u00E1s faltan para lo esperado es", ' ', _jsx("strong", { children: sinJornada[0].name }), " (", miles(faltan(sinJornada[0])), ")."] })),
            a: `/jornadas/nueva?batey=${sinJornada[0].communityId}`,
        });
    }
    if (r.priority.total) {
        pendientes.push({
            icono: _jsx(HeartPulse, { className: "size-4" }),
            texto: (_jsxs(_Fragment, { children: [_jsxs("strong", { children: [miles(r.priority.total), " pacientes en crisis o grado 2"] }), " a\u00FAn no vistos esta ronda: ati\u00E9ndelos primero."] })),
            a: '#prioridad',
            tono: 'aviso',
        });
    }
    const inv = alertas.data;
    const inventario = [
        inv?.vencidos.length && `${inv.vencidos.length} ${inv.vencidos.length === 1 ? 'lote vencido' : 'lotes vencidos'}`,
        inv?.porVencer.length && `${inv.porVencer.length} por vencer`,
        s.lowStockMedications.length && `${s.lowStockMedications.map((m) => `${m.name} ${m.concentration}`).join(', ')} bajo el mínimo`,
    ].filter(Boolean);
    if (porEntregar.data?.pacientes && tiene('entregas.registrar')) {
        pendientes.push({
            icono: _jsx(Pill, { className: "size-4" }),
            texto: (_jsxs(_Fragment, { children: [_jsx("strong", { children: porEntregar.data.pacientes === 1 ? '1 paciente' : `${miles(porEntregar.data.pacientes)} pacientes` }), " con medicamentos pendientes de entregar (", miles(porEntregar.data.pastillas), " pastillas)."] })),
            a: '/entregas',
            tono: 'aviso',
        });
    }
    const sinVer = sinConsulta.data ?? [];
    if (sinVer.length) {
        pendientes.push({
            icono: _jsx(Pill, { className: "size-4" }),
            texto: (_jsxs(_Fragment, { children: [_jsx("strong", { children: sinVer.length === 1 ? `${sinVer[0].paciente.firstName} ${sinVer[0].paciente.lastName}` : `${sinVer.length} pacientes` }), ' ', sinVer.length === 1 ? 'lleva' : 'llevan', " 2 rondas o m\u00E1s recibiendo el tratamiento sin consulta: que los vea un m\u00E9dico en la pr\u00F3xima jornada."] })),
            a: sinVer.length === 1 ? `/pacientes/${sinVer[0].paciente.id}` : '/reportes/entregas#sin-consulta',
            tono: 'aviso',
        });
    }
    if (inventario.length && tiene('inventario.gestionar'))
        pendientes.push({ icono: _jsx(AlertTriangle, { className: "size-4" }), texto: _jsxs(_Fragment, { children: ["Inventario: ", inventario.join(' · '), "."] }), a: '/medicamentos', tono: 'aviso' });
    return (_jsxs(_Fragment, { children: [batey && (_jsxs("p", { className: "mb-4 rounded-lg bg-marca-50 px-4 py-2.5 text-sm", children: ["Mostrando solo ", _jsx("strong", { children: nombreDelBatey }), ". El inventario es el de toda la fundaci\u00F3n."] })), tiene('reportes.ver') && (_jsx("div", { className: "mb-6 [&>section]:mt-0", children: _jsx(ActividadPeriodo, { periodo: periodo, batey: batey }) })), _jsxs("div", { className: "grid gap-4 sm:grid-cols-2 xl:grid-cols-4", children: [_jsx(Indicador, { titulo: "En seguimiento", valor: miles(enSeguimiento), detalle: `Vinieron en los últimos 6 meses · ${miles(t.active)} registrados`, icono: _jsx(Users, { className: "size-4" }), a: "/pacientes?situacion=le-toca" }), _jsx(Indicador, { titulo: `Ronda ${r.round.label}`, valor: `${pctRonda}%`, progreso: pctRonda, detalle: `${miles(t.seen)} de ~${miles(esperados)} esperados · cierra en ${diasParaCerrar} días`, icono: _jsx(CalendarCheck, { className: "size-4" }), a: "/jornadas" }), _jsx(Indicador, { titulo: "Presi\u00F3n controlada", valor: `${Math.round(s.bpControl.controlledPercentage)}%`, progreso: s.bpControl.controlledPercentage, detalle: _jsxs(_Fragment, { children: ["\u00DAltima toma por debajo de 140/90", cambio !== null && (_jsxs("span", { className: cn('ml-1 font-medium', cambio >= 0 ? 'text-green-700' : 'text-red-600'), children: ["\u00B7 ", cambio >= 0 ? '+' : '', cambio, " pts vs. trimestre anterior"] }))] }), icono: _jsx(HeartPulse, { className: "size-4" }) }), _jsx(Indicador, { titulo: "Dejaron de venir", valor: miles(t.absent), detalle: `Más de 6 meses sin venir${t.retired ? ` · ${miles(t.retired)} ya no vienen (no cuentan)` : ` · ${miles(t.absentYear)} hace más de un año`}`, icono: _jsx(SearchX, { className: "size-4" }), a: "/pacientes?situacion=sin-venir&orden=ausencia" })] }), _jsx(Seccion, { titulo: "Salud de los pacientes", detalle: ultimoConDatos
                    ? `En ${ultimoConDatos.trimestre}, el ${Math.round(ultimoConDatos.controladosPct)}% salió controlado · hoy ${miles(altoRiesgo)} están en grado 2 o crisis`
                    : undefined, children: _jsxs("div", { className: "grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]", children: [_jsx(Tarjeta, { titulo: "Control de la presi\u00F3n por trimestre", copiable: true, ayuda: AYUDA.controlPanel, accion: _jsx("span", { className: "text-xs text-tenue", children: "\u00DAltimos 8 trimestres" }), children: tendencia.isPending ? (_jsx(Cargando, { forma: "grafica" })) : (_jsx("div", { className: "h-72 px-2 pt-4 pb-2", children: _jsx(ResponsiveContainer, { children: _jsxs(ComposedChart, { data: trimestres, margin: { left: -8, right: 4 }, children: [_jsx(CartesianGrid, { ...REJILLA }), _jsx(XAxis, { dataKey: "trimestre", ...EJE }), _jsx(YAxis, { yAxisId: "n", allowDecimals: false, ...EJE }), _jsx(YAxis, { yAxisId: "p", orientation: "right", domain: [0, 100], unit: "%", ...EJE }), _jsx(Tooltip, { ...TOOLTIP, formatter: (v, n) => (n === '% controlados' ? [`${v}%`, n] : [miles(Number(v)), n]) }), _jsx(Legend, { ...LEYENDA }), _jsx(Bar, { yAxisId: "n", dataKey: "pacientes", name: "Pacientes vistos", fill: COLOR.amarillo, radius: [4, 4, 0, 0], maxBarSize: 44 }), _jsx(Line, { yAxisId: "p", dataKey: "controladosPct", name: "% controlados", stroke: COLOR.tinta, strokeWidth: 2.5, dot: { r: 4, fill: COLOR.tinta } })] }) }) })) }), _jsx(Tarjeta, { titulo: "C\u00F3mo est\u00E1n hoy", copiable: true, ayuda: AYUDA.comoEstanHoy, accion: _jsx("span", { className: "text-xs text-tenue", children: "\u00DAltima toma \u00B7 en seguimiento" }), children: tendencia.isPending ? (_jsx(Cargando, { forma: "lista" })) : totalHoy === 0 ? (_jsx(Vacio, { titulo: "Sin datos" })) : (_jsxs("ul", { className: "space-y-1 p-4", children: [rebanadas.map((x) => {
                                        const fila = (_jsxs(_Fragment, { children: [_jsx("span", { className: "w-36 shrink-0", children: x.nombre }), _jsx("span", { className: "h-2 flex-1 overflow-hidden rounded-full bg-black/[0.06]", children: _jsx("span", { className: "block h-full rounded-full", style: { width: `${(x.valor / totalHoy) * 100}%`, backgroundColor: x.color } }) }), _jsx("span", { className: "tabular w-12 text-right font-medium", children: miles(x.valor) }), _jsxs("span", { className: "tabular w-10 text-right text-xs text-tenue", children: [Math.round((x.valor / totalHoy) * 100), "%"] })] }));
                                        const filtro = x.configId ? `clasificacion=${x.configId}` : 'clasificacion=ninguna';
                                        return (_jsx("li", { children: tiene('pacientes.ver') ? (_jsx(Link, { to: `/pacientes?${filtro}&orden=presion`, className: "flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-fondo", title: "Ver estos pacientes", children: fila })) : (_jsx("div", { className: "flex items-center gap-3 px-2 py-2 text-sm", children: fila })) }, x.nombre));
                                    }), _jsxs("li", { className: "px-2 pt-2 text-xs text-tenue", children: [miles(totalHoy), " pacientes que vinieron en los \u00FAltimos 6 meses."] })] })) })] }) }), pendientes.length > 0 && (_jsxs("section", { className: "mt-8", "aria-labelledby": "para-hacer", children: [_jsx("h2", { id: "para-hacer", className: "mb-2 text-sm font-semibold text-tenue", children: "Para hacer" }), _jsx("ul", { className: "grid gap-px overflow-hidden rounded-xl border border-borde bg-borde lg:grid-cols-2 [&>li]:bg-superficie lg:[&>li:last-child:nth-child(odd)]:col-span-2", children: pendientes.map((p, i) => {
                            const contenido = (_jsxs(_Fragment, { children: [_jsx("span", { className: cn('grid size-6 shrink-0 place-items-center rounded-full [&>svg]:size-3.5', p.tono === 'aviso' ? 'bg-amber-100 text-amber-800' : 'bg-marca-100 text-tinta'), children: p.icono }), _jsx("span", { className: "flex-1 text-[13px] leading-snug", children: p.texto }), _jsx(ArrowRight, { className: "size-3.5 shrink-0 text-tenue" })] }));
                            const clase = 'flex h-full items-center gap-2.5 px-4 py-2 hover:bg-fondo';
                            return (_jsx("li", { children: p.a.startsWith('#') ? (_jsx("a", { href: p.a, className: clase, children: contenido })) : (_jsx(Link, { to: p.a, className: clase, children: contenido })) }, i));
                        }) })] })), _jsx(Seccion, { titulo: "Esta ronda", detalle: `Del ${fecha(r.round.start)} al ${fecha(r.round.end)}`, children: _jsxs("div", { className: "grid grid-cols-1 gap-4 lg:grid-cols-2", children: [_jsxs(Tarjeta, { titulo: "Agenda de jornadas", accion: _jsxs(Link, { to: "/jornadas", className: "flex items-center gap-1 text-xs font-medium text-marca-700 hover:underline", children: ["Calendario ", _jsx(ArrowRight, { className: "size-3" })] }), children: [(proximas.data ?? []).length > 0 && (_jsx("ul", { className: "divide-y divide-borde border-b border-borde", children: proximas.data.slice(0, 4).map((j) => {
                                        const fila = r.byCommunity.find((c) => c.communityId === j.communityId);
                                        const pendientesBatey = fila ? faltan(fila) : 0;
                                        return (_jsx("li", { children: _jsxs(Link, { to: `/jornadas/${j.id}`, className: "flex items-center gap-4 px-5 py-3 hover:bg-fondo", children: [_jsx("span", { className: "w-24 shrink-0 text-sm font-medium", children: diaJornada(j.fecha) }), _jsxs("span", { className: "min-w-0 flex-1", children: [_jsx("span", { className: "block truncate font-medium", children: j.community.name }), _jsx("span", { className: "block truncate text-xs text-tenue", children: j.responsable ? `Responsable: ${nombreCompleto(j.responsable)}` : 'Sin responsable' })] }), _jsxs("span", { className: "shrink-0 text-right text-xs text-tenue", children: [_jsx("span", { className: "tabular block text-base font-semibold text-tinta", children: miles(pendientesBatey) }), "faltan"] })] }) }, j.id));
                                    }) })), sinJornada.length > 0 ? (_jsxs("div", { className: "px-5 py-3", children: [_jsx("p", { className: "mb-2 text-xs font-medium text-tenue", children: "Sin jornada planificada" }), _jsx("ul", { className: "space-y-2", children: sinJornada.slice(0, (proximas.data ?? []).length ? 4 : 7).map((c) => (_jsxs("li", { className: "flex items-center gap-3 text-sm", children: [_jsxs("span", { className: "min-w-0 flex-1", children: [_jsx("span", { className: "block truncate", children: c.name }), _jsxs("span", { className: "tabular block truncate text-xs text-tenue", children: [miles(faltan(c)), " faltan de ~", miles(c.expected ?? c.active), " \u00B7 \u00FAltima visita ", fecha(c.lastVisit)] })] }), tiene('jornadas.planificar') && (_jsx(Link, { to: `/jornadas/nueva?batey=${c.communityId}`, className: "rounded-md border border-borde px-2 py-1 text-xs font-medium hover:bg-fondo", children: "Planificar" }))] }, c.communityId))) })] })) : (!(proximas.data ?? []).length && _jsx(Vacio, { titulo: "Nada pendiente de planificar" }))] }), _jsx("div", { id: "prioridad", className: "scroll-mt-6", children: _jsx(Tarjeta, { titulo: `Prioridad para la próxima jornada (${miles(r.priority.total)})`, accion: _jsx("span", { className: "text-xs text-tenue", children: "\u00DAltima toma en grado 2 o crisis \u00B7 a\u00FAn no vistos esta ronda" }), children: r.priority.lista.length === 0 ? (_jsx(Vacio, { titulo: "Nadie en grado 2 o crisis pendiente de venir" })) : (_jsx("ul", { className: "divide-y divide-borde", children: r.priority.lista.map((p) => (_jsx("li", { children: _jsxs(Link, { to: `/pacientes/${p.id}`, className: "flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-fondo", children: [_jsxs("span", { className: "min-w-0 flex-1", children: [_jsx("span", { className: "block truncate font-medium", children: nombreCompleto(p) }), _jsxs("span", { className: "block truncate text-xs text-tenue", children: [_jsx("span", { className: "font-mono", children: p.patientCode }), " \u00B7 ", nombreBatey(p.communityId), p.address && ` · Casa ${p.address}`, " \u00B7 vino el ", fecha(p.lastVisitDate)] })] }), _jsx("span", { className: "tabular font-mono", children: p.presion }), _jsx(Insignia, { color: colorCategoria(p.categoria), children: CATEGORIAS[p.categoria] })] }) }, p.id))) })) }) })] }) }), _jsx(Seccion, { titulo: "Dejaron de venir", detalle: "Primero los que faltan desde hace menos: son los m\u00E1s f\u00E1ciles de recuperar", children: _jsx(Tarjeta, { titulo: `${miles(t.absent)} pacientes con más de 6 meses sin venir`, accion: _jsxs(Link, { to: "/pacientes?situacion=sin-venir&orden=ausencia", className: "flex items-center gap-1 text-xs font-medium text-marca-700 hover:underline", children: ["Ver todos ", _jsx(ArrowRight, { className: "size-3" })] }), children: r.absentPatients.length === 0 ? (_jsx(Vacio, { titulo: "Todos han venido en los \u00FAltimos 6 meses" })) : (_jsx("ul", { className: "grid md:grid-cols-2", children: r.absentPatients.slice(0, 8).map((p) => (_jsx("li", { className: "border-b border-borde md:odd:border-r", children: _jsxs(Link, { to: `/pacientes/${p.id}`, className: "flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-fondo", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "truncate text-sm font-medium", children: nombreCompleto(p) }), _jsxs("p", { className: "truncate text-xs text-tenue", children: [_jsx("span", { className: "font-mono", children: p.patientCode }), " \u00B7 ", nombreBatey(p.communityId), p.address && ` · Casa ${p.address}`, p.phoneNumber && ` · ${p.phoneNumber}`] })] }), _jsx("span", { className: "shrink-0 text-right text-xs text-tenue", children: asistencia(p.lastVisitDate).texto })] }) }, p.id))) })) }) })] }));
}
/** Mientras carga el panel: la misma forma que tendrá (pendientes, cifras, gráficas). */
function EsqueletoPanel() {
    return (_jsxs("div", { role: "status", "aria-busy": "true", className: "space-y-6", children: [_jsx("span", { className: "sr-only", children: "Cargando el panel\u2026" }), _jsxs("div", { className: "rounded-xl border border-borde bg-superficie", children: [_jsx("div", { className: "border-b border-borde px-5 py-3.5", children: _jsx(Hueso, { className: "h-4 w-24" }) }), [0, 1, 2, 3].map((i) => (_jsxs("div", { className: "flex items-center gap-3 border-b border-borde px-5 py-3.5 last:border-0", children: [_jsx(Hueso, { className: "size-8 shrink-0 rounded-full" }), _jsx(Hueso, { className: cn('h-3.5', ['w-1/2', 'w-2/3', 'w-2/5', 'w-1/3'][i]) })] }, i)))] }), _jsx(FilaCifrasEsqueleto, { n: 4 }), _jsxs("div", { className: "grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]", children: [_jsxs("div", { className: "rounded-xl border border-borde bg-superficie", children: [_jsx("div", { className: "border-b border-borde px-5 py-3.5", children: _jsx(Hueso, { className: "h-4 w-48" }) }), _jsx(Cargando, { forma: "grafica" })] }), _jsxs("div", { className: "rounded-xl border border-borde bg-superficie", children: [_jsx("div", { className: "border-b border-borde px-5 py-3.5", children: _jsx(Hueso, { className: "h-4 w-32" }) }), _jsx("div", { className: "space-y-4 p-5", children: [0, 1, 2, 3, 4].map((i) => (_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Hueso, { className: "h-3.5 w-24" }), _jsx(Hueso, { className: "h-2 flex-1" }), _jsx(Hueso, { className: "h-3.5 w-8" })] }, i))) })] })] })] }));
}
function FilaCifrasEsqueleto({ n }) {
    return (_jsx("div", { className: cn('grid gap-4 sm:grid-cols-2', n === 5 ? 'lg:grid-cols-5' : 'xl:grid-cols-4'), children: Array.from({ length: n }, (_, i) => (_jsxs("div", { className: "space-y-3 rounded-xl border border-borde bg-superficie p-5", children: [_jsx(Hueso, { className: "h-3.5 w-1/2" }), _jsx(Hueso, { className: "h-8 w-2/5" }), _jsx(Hueso, { className: "h-3 w-3/4" })] }, i))) }));
}
/** Visitas, pacientes, control y pastillas del día o rango elegido arriba. */
function ActividadPeriodo({ periodo, batey }) {
    // Días de RD (UTC−4): el servidor compara instantes.
    const consulta = useResumenReporte({ from: `${periodo.desde}T00:00:00-04:00`, to: `${periodo.hasta}T23:59:59-04:00`, communityId: batey });
    const enlace = `/reportes?desde=${periodo.desde}&hasta=${periodo.hasta}${batey ? `&batey=${batey}` : ''}`;
    const cabecera = (_jsxs("span", { className: "flex flex-wrap items-center gap-x-3", children: ["Visitas registradas ", periodo.frase, _jsxs(Link, { to: enlace, className: "inline-flex items-center gap-1 font-medium text-marca-700 hover:underline", children: ["Ver el reporte ", _jsx(ArrowRight, { className: "size-3.5" })] })] }));
    return (_jsx(Seccion, { titulo: `Actividad · ${periodo.texto}`, detalle: cabecera, children: consulta.isPending ? (_jsx(FilaCifrasEsqueleto, { n: 5 })) : consulta.isError ? (_jsx(ErrorCarga, { error: consulta.error })) : consulta.data.resumen.visitas === 0 ? (_jsxs("p", { className: "rounded-xl border border-dashed border-borde px-5 py-6 text-center text-sm text-tenue", children: ["No hay visitas registradas ", periodo.frase, "."] })) : ((() => {
            const r = consulta.data;
            const x = r.resumen;
            const meds = [...r.medicamentos].sort((a, b) => b.pastillas - a.pastillas);
            return (_jsxs("div", { className: cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-5 transition-opacity', consulta.isPlaceholderData && 'opacity-60'), children: [_jsx(Indicador, { titulo: "Pacientes atendidos", valor: miles(x.pacientes), detalle: `${miles(x.nuevos)} de primera vez`, icono: _jsx(Users, { className: "size-4" }), a: `/pacientes?desde=${periodo.desde}&hasta=${periodo.hasta}${batey ? `&batey=${batey}` : ''}` }), _jsx(Indicador, { titulo: "Visitas", valor: miles(x.visitas), detalle: `${miles(x.domiciliarias)} en su casa`, icono: _jsx(CalendarCheck, { className: "size-4" }) }), _jsx(Indicador, { titulo: "Salieron controlados", valor: x.controladosPct === null ? '—' : `${Math.round(x.controladosPct)}%`, progreso: x.controladosPct ?? undefined, detalle: "\u00DAltima toma del periodo < 140/90", icono: _jsx(HeartPulse, { className: "size-4" }) }), _jsx(Indicador, { titulo: "Presi\u00F3n promedio", valor: x.sistolicaPromedio ? `${Math.round(x.sistolicaPromedio)}/${Math.round(x.diastolicaPromedio ?? 0)}` : '—', detalle: "mmHg, todas las tomas", icono: _jsx(HeartPulse, { className: "size-4" }) }), _jsx(Indicador, { titulo: "Pastillas entregadas", valor: miles(x.pastillas), detalle: meds.slice(0, 2).map((m) => `${m.medicamento}: ${miles(m.pastillas)}`).join(' · ') || 'Sin medicamentos', icono: _jsx(Pill, { className: "size-4" }) })] }));
        })()) }));
}
