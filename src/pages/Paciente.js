import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, CalendarClock, Camera, ChevronDown, ClipboardPlus, GitMerge, History, Home, MoreHorizontal, Pencil, Pill, Printer, RefreshCw, Split, Stethoscope, Trash2, UserX } from 'lucide-react';
import { eliminarPaciente, entregasDelPaciente, reactivarPaciente, regenerarCodigoPaciente } from '../api/recursos';
import { useConfirmar } from '../components/confirmar';
import { useSesion } from '../auth/sesion';
import { ListaAlertas, useUmbrales } from '../components/Alertas';
import { alertasClinicas, tomaDe } from '../lib/alertas';
import { usePermisosVisita } from '../auth/permisosVisita';
import { useEliminarVisita } from '../components/eliminarVisita';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { useJornadas, usePaciente } from '../api/consultas';
import { hoyYmd } from './Jornadas';
import { subirFotoPaciente } from '../api/recursos';
import { LEYENDA } from '../components/graficas';
import { Avatar, Boton, Cargando, EnlaceVolver, ErrorCarga, Insignia, InsigniaCategoria, Tarjeta, Vacio } from '../components/ui';
import { ALCOHOL, ESTADOS, GENEROS, MOTIVOS_BAJA, MOTIVOS_INASISTENCIA, MOTIVOS_REPOSICION, RECIBIO_ENTREGA, SAL, TABACO, TIPOS_VISITA, conQuien } from '../lib/etiquetas';
import { atendio, cn, colorCumplimiento, decimal, DIA_MS, edadTexto, fecha, fechaYHora, nombreCompleto, num, tensionDe } from '../lib/formato';
import { SelectorFecha } from '../components/SelectorFecha';
import { AYUDA } from '../lib/ayuda-graficas';
const ejeFecha = new Intl.DateTimeFormat('es-DO', { day: 'numeric', month: 'short', year: '2-digit' });
function Dato({ etiqueta, children }) {
    return (_jsxs("div", { children: [_jsx("dt", { className: "text-xs text-tenue", children: etiqueta }), _jsx("dd", { className: "mt-0.5 text-sm", children: children })] }));
}
/** "Más": las acciones que se usan poco (baja, unir, separar, eliminar…), con su nombre a la vista. */
function MenuMas({ acciones }) {
    const [abierto, setAbierto] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        if (!abierto)
            return;
        const fuera = (e) => !ref.current?.contains(e.target) && setAbierto(false);
        const esc = (e) => e.key === 'Escape' && setAbierto(false);
        document.addEventListener('mousedown', fuera);
        document.addEventListener('keydown', esc);
        return () => {
            document.removeEventListener('mousedown', fuera);
            document.removeEventListener('keydown', esc);
        };
    }, [abierto]);
    if (!acciones.length)
        return null;
    return (_jsxs("div", { ref: ref, className: "relative", children: [_jsx(Boton, { variante: "secundario", icono: _jsx(MoreHorizontal, { className: "size-4" }), "aria-haspopup": "menu", "aria-expanded": abierto, onClick: () => setAbierto((x) => !x), children: "M\u00E1s" }), abierto && (_jsx("div", { role: "menu", className: "absolute right-0 z-30 mt-1.5 w-64 overflow-hidden rounded-xl border border-borde bg-superficie py-1 shadow-xl", children: acciones.map((a) => (_jsxs("button", { type: "button", role: "menuitem", disabled: !!a.deshabilitada, title: a.deshabilitada, onClick: () => {
                        setAbierto(false);
                        a.alElegir();
                    }, className: cn('flex w-full items-start gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-fondo disabled:cursor-not-allowed disabled:opacity-50', a.peligro && 'text-red-700'), children: [_jsx("span", { className: "mt-0.5 shrink-0", children: a.icono }), _jsxs("span", { children: [a.texto, a.deshabilitada && _jsx("span", { className: "block text-xs text-tenue", children: a.deshabilitada })] })] }, a.texto))) }))] }));
}
function FotoPaciente({ paciente }) {
    const input = useRef(null);
    const cliente = useQueryClient();
    const subir = useMutation({
        mutationFn: (f) => subirFotoPaciente(paciente.id, f),
        onSuccess: () => {
            cliente.invalidateQueries({ queryKey: ['paciente', paciente.id] });
            cliente.invalidateQueries({ queryKey: ['pacientes'] });
            toast.success('Foto actualizada');
        },
        onError: (e) => toast.error(e.message),
    });
    return (_jsxs("button", { onClick: () => input.current?.click(), className: "group relative shrink-0 rounded-full", title: "Cambiar foto", disabled: subir.isPending, children: [_jsx(Avatar, { persona: paciente, foto: paciente.photoUrl, tamano: "size-20 text-xl" }), _jsx("span", { className: cn('absolute inset-0 grid place-items-center rounded-full bg-tinta/50 text-white opacity-0 transition group-hover:opacity-100', subir.isPending && 'opacity-100'), children: _jsx(Camera, { className: "size-5" }) }), _jsx("input", { ref: input, type: "file", accept: "image/png,image/jpeg", hidden: true, onChange: (e) => {
                    const f = e.target.files?.[0];
                    if (f)
                        subir.mutate(f);
                    e.target.value = '';
                } })] }));
}
const RANGOS = [
    { valor: 'todo', texto: 'Todo' },
    { valor: '5', texto: '5 años' },
    { valor: '2', texto: '2 años' },
    { valor: '1', texto: '1 año' },
    { valor: 'fechas', texto: 'Fechas' },
];
/**
 * La gráfica sale de las visitas que ya trae la ficha (todas): así se ve también sin internet, en la
 * jornada, con lo descargado, y sin pedir nada más al servidor.
 */
function GraficoTension({ visitas }) {
    const data = useMemo(() => [...visitas]
        .sort((x, y) => new Date(x.visitDate).getTime() - new Date(y.visitDate).getTime())
        .map((v) => ({ date: v.visitDate, systolic: v.systolicManual ?? v.systolicAuto, diastolic: v.diastolicManual ?? v.diastolicAuto })), [visitas]);
    const [rango, setRango] = useState('todo');
    const [desde, setDesde] = useState('');
    const [hasta, setHasta] = useState('');
    if (!data)
        return _jsx(Cargando, {});
    const hoy = new Date();
    const inicio = rango === 'fechas' ? (desde ? new Date(`${desde}T00:00:00`) : null) : rango === 'todo' ? null : new Date(hoy.getFullYear() - Number(rango), hoy.getMonth(), hoy.getDate());
    const fin = rango === 'fechas' && hasta ? new Date(`${hasta}T23:59:59`) : null;
    const tomas = data.filter((p) => p.systolic && p.diastolic);
    const puntos = tomas
        .filter((p) => (!inicio || new Date(p.date) >= inicio) && (!fin || new Date(p.date) <= fin))
        .map((p) => ({ ...p, fecha: ejeFecha.format(new Date(p.date)) }));
    if (tomas.length === 0)
        return _jsx(Vacio, { titulo: "Sin tomas registradas" });
    // Con una sola toma no hay evolución que dibujar.
    if (tomas.length === 1)
        return (_jsxs("p", { className: "px-5 py-6 text-sm text-tenue", children: ["Con una sola toma todav\u00EDa no hay evoluci\u00F3n: ", _jsxs("span", { className: "font-mono font-medium text-tinta", children: [tomas[0].systolic, "/", tomas[0].diastolic] }), " el ", fecha(tomas[0].date), ". La gr\u00E1fica aparece desde la segunda visita."] }));
    return (_jsxs("div", { className: "px-2 pt-3 pb-2", children: [_jsxs("div", { "data-no-copiar": true, className: "flex flex-wrap items-center gap-2 px-3 pb-2", children: [_jsx("div", { className: "flex rounded-lg bg-black/5 p-0.5 text-xs", children: RANGOS.map((r) => (_jsx("button", { type: "button", onClick: () => setRango(r.valor), className: cn('rounded-md px-2.5 py-1', rango === r.valor ? 'bg-superficie font-medium shadow-sm' : 'text-tenue hover:text-tinta'), children: r.texto }, r.valor))) }), rango === 'fechas' && (_jsxs("div", { className: "flex items-center gap-2 text-xs text-tenue", children: [_jsx(SelectorFecha, { corto: true, vacio: "Desde", className: "h-8 w-auto text-xs", "aria-label": "Desde", value: desde, max: hasta || undefined, onChange: setDesde }), "a", _jsx(SelectorFecha, { corto: true, vacio: "Hasta", className: "h-8 w-auto text-xs", "aria-label": "Hasta", value: hasta, min: desde || undefined, onChange: setHasta })] })), _jsxs("span", { className: "ml-auto text-xs text-tenue", children: [puntos.length, " de ", tomas.length, " tomas"] })] }), puntos.length === 0 ? (_jsx(Vacio, { titulo: "Sin tomas en ese rango" })) : (_jsx("div", { className: "h-72", children: _jsx(ResponsiveContainer, { children: _jsxs(LineChart, { data: puntos, margin: { left: -16, right: 16 }, children: [_jsx(CartesianGrid, { vertical: false, stroke: "#e5e2dc" }), _jsx(XAxis, { dataKey: "fecha", tickLine: false, axisLine: false, fontSize: 12, stroke: "#6b665e", minTickGap: 24 }), _jsx(YAxis, { domain: [40, 'auto'], tickLine: false, axisLine: false, fontSize: 12, stroke: "#6b665e" }), _jsx(Tooltip, { contentStyle: { borderRadius: 8, borderColor: '#e5e2dc', fontSize: 13 } }), _jsx(Legend, { ...LEYENDA }), _jsx(ReferenceLine, { y: 140, stroke: "#dc2626", strokeDasharray: "4 4", strokeOpacity: 0.5 }), _jsx(ReferenceLine, { y: 90, stroke: "#ea580c", strokeDasharray: "4 4", strokeOpacity: 0.5 }), _jsx(Line, { type: "monotone", dataKey: "systolic", name: "Sist\u00F3lica", stroke: "#1d1b18", strokeWidth: 2, dot: { r: 3 } }), _jsx(Line, { type: "monotone", dataKey: "diastolic", name: "Diast\u00F3lica", stroke: "#c9a400", strokeWidth: 2, dot: { r: 3 } })] }) }) }))] }));
}
function FilaVisita({ visita }) {
    const [abierta, setAbierta] = useState(false);
    const permisos = usePermisosVisita();
    const eliminar = useEliminarVisita();
    const navegar = useNavigate();
    const signos = [
        ['Peso', visita.weightKg ? `${decimal(visita.weightKg)} kg` : '—'],
        ['Talla', visita.heightM ? `${decimal(visita.heightM, 2)} m` : '—'],
        ['IMC', decimal(visita.bmi)],
        ['Frecuencia cardíaca', visita.heartRate ? `${visita.heartRate} lpm` : '—'],
        ['Saturación O₂', visita.oxygenSaturation ? `${visita.oxygenSaturation}%` : '—'],
        ['Temperatura', visita.temperature ? `${decimal(visita.temperature)} °C` : '—'],
        ['PA manual', visita.systolicManual ? `${visita.systolicManual}/${visita.diastolicManual}` : '—'],
        ['PA automática', visita.systolicAuto ? `${visita.systolicAuto}/${visita.diastolicAuto}` : '—'],
    ];
    return (_jsxs("li", { children: [_jsxs("button", { onClick: () => setAbierta(!abierta), className: "flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 text-left hover:bg-fondo sm:flex-nowrap", "aria-expanded": abierta, children: [_jsxs("div", { className: "w-44 shrink-0", children: [_jsx("p", { className: "text-sm font-medium", children: fecha(visita.visitDate) }), _jsxs("p", { className: "truncate text-xs text-tenue", title: `Atendió ${atendio(visita)}`, children: [TIPOS_VISITA[visita.visitType], " \u00B7 ", atendio(visita)] })] }), _jsx("span", { className: "tabular w-20 font-mono text-sm", children: tensionDe(visita) }), _jsx(InsigniaCategoria, { config: visita.bpClassification }), visita.isHomeVisit && (_jsxs(Insignia, { children: [_jsx(Home, { className: "size-3" }), " Domicilio"] })), _jsx("span", { className: "ml-auto hidden truncate text-sm text-tenue sm:block", children: visita.reason }), _jsx(ChevronDown, { className: cn('ml-auto size-4 shrink-0 text-tenue transition-transform sm:ml-0', abierta && 'rotate-180') })] }), abierta && (_jsxs("div", { className: "space-y-4 bg-fondo/60 px-5 py-4", children: [_jsx("dl", { className: "grid grid-cols-2 gap-4 sm:grid-cols-4", children: signos.map(([e, v]) => (_jsx(Dato, { etiqueta: e, children: _jsx("span", { className: "tabular", children: v }) }, e))) }), _jsxs(Dato, { etiqueta: "Atendi\u00F3", children: [atendio(visita), visita.originalDoctorId && _jsx("span", { className: "text-tenue", children: " \u00B7 cuenta eliminada (visita reasignada al administrador)" })] }), visita.nextVisitDate && _jsx(Dato, { etiqueta: "Pr\u00F3xima visita", children: fecha(visita.nextVisitDate) }), visita.reason && _jsx(Dato, { etiqueta: "Motivo", children: visita.reason }), visita.notes && _jsx(Dato, { etiqueta: "Notas", children: _jsx("span", { className: "whitespace-pre-line", children: visita.notes }) }), visita.prescriptionText && _jsx(Dato, { etiqueta: "Indicaciones", children: _jsx("span", { className: "whitespace-pre-line", children: visita.prescriptionText }) }), !!visita.prescriptions?.length && (_jsxs("div", { children: [_jsx("p", { className: "mb-2 text-xs text-tenue", children: "Medicamentos dispensados" }), _jsx("ul", { className: "divide-y divide-borde rounded-lg border border-borde bg-superficie", children: visita.prescriptions.map((r) => (_jsxs("li", { className: "flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm", children: [_jsxs("span", { className: "font-medium", children: [r.medication?.name, " ", _jsx("span", { className: "font-normal text-tenue", children: r.medication?.concentration })] }), _jsxs("span", { className: "tabular text-tenue", children: [r.dailyDose, "/d\u00EDa \u00B7 ", r.daysUntilNextVisit, " d\u00EDas \u00B7", ' ', r.cantidadIndicada && r.quantityDispensed < r.cantidadIndicada ? (_jsxs("span", { className: "font-medium text-amber-800", children: [r.quantityDispensed, " de ", r.cantidadIndicada, " entregadas"] })) : (_jsxs("span", { className: "font-medium text-tinta", children: [r.quantityDispensed, " entregadas"] })), r.adherencePercentage !== null && (_jsxs(_Fragment, { children: [' · ', _jsxs("span", { className: cn('font-medium', colorCumplimiento(Number(r.adherencePercentage))), children: [Number(r.adherencePercentage).toFixed(0), "% cumplimiento"] })] }))] })] }, r.id))) })] })), (permisos.puedeEditar(visita) || permisos.puedeEliminar) && (_jsxs("div", { className: "flex flex-wrap items-center gap-2 border-t border-borde pt-4", children: [permisos.puedeEditar(visita) && (_jsx(Boton, { variante: "secundario", className: "h-8", icono: _jsx(Pencil, { className: "size-4" }), onClick: () => navegar(`/visitas/${visita.id}/editar?volver=${encodeURIComponent(`/pacientes/${visita.patientId}`)}`), children: "Editar visita" })), permisos.puedeEliminar && (_jsx(Boton, { variante: "secundario", className: "h-8 hover:text-red-600", icono: _jsx(Trash2, { className: "size-4" }), onClick: () => eliminar(visita), children: "Eliminar" })), permisos.editableHasta(visita) && (_jsxs("span", { className: "text-xs text-tenue", children: ["Puedes corregirla hasta el ", fechaYHora(permisos.editableHasta(visita).toISOString())] }))] }))] }))] }));
}
export function Paciente() {
    const id = Number(useParams().id);
    // Desde la jornada se vuelve a la jornada (solo rutas internas).
    const pedido = useSearchParams()[0].get('volver');
    const volver = pedido?.startsWith('/') && !pedido.startsWith('//') ? pedido : '/pacientes';
    const navegar = useNavigate();
    const consulta = usePaciente(id);
    const { tiene } = useSesion();
    const puedeRevisar = tiene('datos.revisar');
    const confirmar = useConfirmar();
    const cliente = useQueryClient();
    const reactivar = useMutation({
        mutationFn: () => reactivarPaciente(id),
        onSuccess: () => {
            for (const k of [['paciente'], ['pacientes'], ['jornada'], ['stats'], ['auditoria']])
                cliente.invalidateQueries({ queryKey: k });
            toast.success('Paciente reactivado. La baja anterior quedó en Auditoría.');
        },
        onError: (e) => toast.error(e.message),
    });
    // Eliminar la ficha por completo: solo fichas sin visitas (creadas por error). Solo el Administrador.
    const eliminarFicha = useMutation({
        mutationFn: () => eliminarPaciente(id),
        onSuccess: (r) => {
            for (const k of [['pacientes'], ['jornada'], ['stats'], ['auditoria'], ['revision']])
                cliente.invalidateQueries({ queryKey: k });
            cliente.removeQueries({ queryKey: ['paciente', id] });
            toast.success(`Ficha ${r.codigo} eliminada. Queda una copia en Auditoría.`);
            navegar('/pacientes', { replace: true });
        },
        onError: (e) => toast.error(e.message),
    });
    const regenerar = useMutation({
        mutationFn: () => regenerarCodigoPaciente(id),
        onSuccess: (r) => {
            for (const k of [['paciente'], ['pacientes'], ['jornada'], ['auditoria']])
                cliente.invalidateQueries({ queryKey: k });
            toast.success(`Nuevo código: ${r.patientCode}. El anterior quedó en Auditoría.`);
        },
        onError: (e) => toast.error(e.message),
    });
    const umbrales = useUmbrales();
    // La próxima jornada planificada en su batey (lo útil si está atrasado).
    const jornadas = useJornadas({ desde: hoyYmd(), estado: 'PLANIFICADA', communityId: consulta.data?.communityId });
    if (consulta.isPending)
        return _jsx(Cargando, {});
    if (consulta.isError)
        return _jsx(ErrorCarga, { error: consulta.error });
    const p = consulta.data;
    if (!p)
        return _jsx(Vacio, { titulo: "Paciente no encontrado", children: _jsx(Link, { to: "/pacientes", className: "text-marca-700 hover:underline", children: "Volver al listado" }) });
    // Promedio y máxima de las tomas, con las visitas de la ficha (también sin internet).
    const a = (() => {
        const ts = (p.clinicalVisits ?? []).map((v) => ({ s: v.systolicManual ?? v.systolicAuto, d: v.diastolicManual ?? v.diastolicAuto })).filter((t) => !!t.s && !!t.d);
        if (!ts.length)
            return null;
        const prom = (xs) => Math.round(xs.reduce((x, y) => x + y, 0) / xs.length);
        return {
            totalVisits: p.clinicalVisits?.length ?? 0,
            bpStats: { systolic: { avg: prom(ts.map((t) => t.s)), max: Math.max(...ts.map((t) => t.s)) }, diastolic: { avg: prom(ts.map((t) => t.d)), max: Math.max(...ts.map((t) => t.d)) } },
            // Del más viejo al más reciente, solo las visitas con peso.
            weightTrend: [...(p.clinicalVisits ?? [])]
                .filter((v) => v.weightKg)
                .reverse()
                .map((v) => ({ date: v.visitDate, weight: v.weightKg, bmi: v.bmi })),
        };
    })();
    // Se registró en un batey y luego se cambió: el código sigue con el prefijo del anterior.
    const codigoDeOtroBatey = !!p.community?.abbreviation && !new RegExp(`^${p.community.abbreviation}\\d+$`).test(p.patientCode);
    const ultima = p.clinicalVisits?.[0];
    const alertas = ultima ? alertasClinicas(tomaDe(ultima), p.clinicalVisits.slice(1), umbrales) : [];
    // Visitas viejas no tienen nextVisitDate: se asume la ronda trimestral.
    const proxima = ultima ? new Date(ultima.nextVisitDate ?? new Date(ultima.visitDate).getTime() + 90 * DIA_MS) : null;
    const toma = (v) => ({ s: v.systolicManual ?? v.systolicAuto, d: v.diastolicManual ?? v.diastolicAuto });
    const conToma = (p.clinicalVisits ?? []).filter((v) => toma(v).s && toma(v).d);
    const tomaUltima = conToma[0] ? toma(conToma[0]) : null;
    const tomaPrevia = conToma[1] ? toma(conToma[1]) : null;
    // Cada cuánto debe venir (el intervalo de su última visita) y cuántas visitas se ha perdido desde que le tocaba.
    const intervalo = ultima?.nextVisitDate ? Math.max(1, Math.round((new Date(ultima.nextVisitDate).getTime() - new Date(ultima.visitDate).getTime()) / DIA_MS)) : 90;
    const diasParaVolver = proxima ? Math.round((new Date(proxima).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / DIA_MS) : null;
    const jornadaProxima = (jornadas.data ?? []).filter((j) => j.communityId === p.communityId).sort((x, y) => x.fecha.localeCompare(y.fecha))[0];
    const visitasPerdidas = diasParaVolver !== null && diasParaVolver < 0 ? 1 + Math.floor(-diasParaVolver / intervalo) : 0;
    const habitos = [
        p.hasFamilyHistory && 'Antecedentes familiares',
        p.smokingStatus !== 'NO' && TABACO[p.smokingStatus],
        p.alcoholIntake !== 'NO' && `Alcohol ${ALCOHOL[p.alcoholIntake].toLowerCase()}`,
        p.saltIntake === 'YES' && 'Consume sal',
    ].filter(Boolean);
    return (_jsxs(_Fragment, { children: [_jsx(EnlaceVolver, { a: volver, texto: volver.startsWith('/jornada') ? 'Jornada' : 'Pacientes', className: "mb-4" }), _jsxs("div", { className: "mb-6 flex flex-wrap items-start gap-5", children: [_jsx(FotoPaciente, { paciente: p }), _jsxs("div", { className: "min-w-72 flex-1", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("h1", { className: "text-2xl font-semibold tracking-tight", children: nombreCompleto(p) }), _jsx(Insignia, { color: p.status === 'ACTIVE' ? '#15803d' : undefined, children: ESTADOS[p.status] }), !p.consentimientoDatos && (_jsx(Link, { to: `/pacientes/${p.id}/editar`, title: "Falta registrar su autorizaci\u00F3n para el uso de sus datos de salud", children: _jsx(Insignia, { color: "#b45309", children: "Sin consentimiento" }) }))] }), _jsxs("p", { className: "mt-1 text-sm text-tenue lg:hidden", children: [_jsx("span", { className: "font-mono font-semibold text-tinta", children: p.patientCode }), " \u00B7 ", p.community?.name] }), habitos.length > 0 && (_jsx("div", { className: "mt-2 flex flex-wrap gap-1.5", children: habitos.map((h) => (_jsx(Insignia, { color: "#b45309", children: h }, h))) }))] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [!!p.clinicalVisits?.[0]?.prescriptions?.length && (_jsx(Boton, { variante: "secundario", icono: _jsx(Printer, { className: "size-4" }), title: "Hoja para el paciente: sus medicamentos y la pr\u00F3xima visita", onClick: () => navegar(`/pacientes/${p.id}/indicaciones`), children: "Indicaciones" })), _jsx(Boton, { variante: "secundario", icono: _jsx(Pencil, { className: "size-4" }), onClick: () => navegar(`/pacientes/${p.id}/editar`), children: "Editar" }), _jsx(MenuMas, { acciones: [
                                    ...(p.status === 'ACTIVE' && tiene('pacientes.editar')
                                        ? [{ texto: 'Dar de baja (fallecimiento, mudanza…)', icono: _jsx(UserX, { className: "size-4" }), alElegir: () => navegar(`/pacientes/${p.id}/baja`), peligro: true }]
                                        : []),
                                    ...(puedeRevisar ? [{ texto: 'Unir con otra ficha de la misma persona', icono: _jsx(GitMerge, { className: "size-4" }), alElegir: () => navegar(`/revision/unir?a=${p.id}`) }] : []),
                                    ...(puedeRevisar && (p.clinicalVisits?.length ?? 0) > 1
                                        ? [{ texto: 'Separar visitas de otra persona', icono: _jsx(Split, { className: "size-4" }), alElegir: () => navegar(`/revision/separar/${p.id}`) }]
                                        : []),
                                    ...(tiene('auditoria.ver') ? [{ texto: 'Quién la ha visto o cambiado', icono: _jsx(History, { className: "size-4" }), alElegir: () => navegar(`/auditoria?registro=Patient&id=${p.id}`) }] : []),
                                    ...(puedeRevisar
                                        ? [
                                            {
                                                texto: 'Eliminar paciente',
                                                icono: _jsx(Trash2, { className: "size-4" }),
                                                peligro: true,
                                                deshabilitada: (p.clinicalVisits?.length ?? 0) > 0 ? 'Tiene visitas: únela con su otra ficha o dale de baja.' : undefined,
                                                alElegir: async () => {
                                                    if (await confirmar({
                                                        titulo: `¿Eliminar a ${nombreCompleto(p)} por completo?`,
                                                        mensaje: `Se borra la ficha ${p.patientCode} y sus "No vino". Úsalo solo para fichas creadas por error. No se puede deshacer desde la app; queda una copia en Auditoría.`,
                                                        confirmar: 'Eliminar paciente',
                                                        peligro: true,
                                                    }))
                                                        eliminarFicha.mutate();
                                                },
                                            },
                                        ]
                                        : []),
                                ] }), p.status !== 'DECEASED' && (_jsx(Boton, { icono: _jsx(ClipboardPlus, { className: "size-4" }), onClick: () => navegar(`/pacientes/${p.id}/visita${volver !== '/pacientes' ? `?volver=${encodeURIComponent(volver)}` : ''}`), children: "Nueva visita" }))] })] }), p.status !== 'ACTIVE' && (_jsxs("div", { className: cn('mb-4 flex flex-wrap items-center gap-3 rounded-xl border px-5 py-3 text-sm', p.status === 'DECEASED' ? 'border-borde bg-black/[0.04]' : 'border-amber-300 bg-marca-50'), children: [_jsx(UserX, { className: "size-4 shrink-0" }), _jsxs("span", { className: "flex-1", children: [_jsx("strong", { children: p.motivoBaja ? MOTIVOS_BAJA[p.motivoBaja] : ESTADOS[p.status] }), p.fechaBaja && ` el ${fecha(p.fechaBaja)}`, p.detalleBaja && ` · ${p.detalleBaja}`, p.bajaRegistradaPor && _jsxs("span", { className: "text-tenue", children: [" \u00B7 registrado por ", p.bajaRegistradaPor] })] }), tiene('pacientes.editar') && (_jsx(Boton, { variante: "secundario", className: "h-8 text-xs", cargando: reactivar.isPending, onClick: async () => {
                            if (await confirmar({ titulo: `¿Reactivar a ${nombreCompleto(p)}?`, mensaje: 'Vuelve a las listas de jornada y de la ronda. La baja queda registrada en Auditoría.', confirmar: 'Reactivar', peligro: false }))
                                reactivar.mutate();
                        }, children: "Reactivar" }))] })), ultima && (_jsxs("section", { className: "mb-4 rounded-xl border border-borde bg-superficie", children: [_jsxs("div", { className: "grid divide-y divide-borde md:grid-cols-3 md:divide-x md:divide-y-0", children: [_jsxs("div", { className: "p-5", children: [_jsx("p", { className: "text-xs font-medium text-tenue", children: "\u00DAltima presi\u00F3n" }), tomaUltima ? (_jsxs(_Fragment, { children: [_jsxs("p", { className: "tabular mt-1 font-mono text-3xl font-semibold", children: [tomaUltima.s, "/", tomaUltima.d] }), _jsxs("div", { className: "mt-1.5 flex flex-wrap items-center gap-2", children: [_jsx(InsigniaCategoria, { config: conToma[0].bpClassification }), tomaPrevia ? (_jsxs("span", { className: cn('inline-flex items-center gap-0.5 text-xs font-medium', tomaUltima.s > tomaPrevia.s ? 'text-red-600' : tomaUltima.s < tomaPrevia.s ? 'text-green-700' : 'text-tenue'), title: `La anterior fue ${tomaPrevia.s}/${tomaPrevia.d}`, children: [tomaUltima.s > tomaPrevia.s ? _jsx(ArrowUp, { className: "size-3.5" }) : tomaUltima.s < tomaPrevia.s ? _jsx(ArrowDown, { className: "size-3.5" }) : null, tomaUltima.s > tomaPrevia.s ? 'Subió' : tomaUltima.s < tomaPrevia.s ? 'Bajó' : 'Igual que antes', _jsxs("span", { className: "font-normal text-tenue", children: [' ', "\u00B7 antes ", _jsxs("span", { className: "font-mono", children: [tomaPrevia.s, "/", tomaPrevia.d] })] })] })) : (_jsx("span", { className: "text-xs text-tenue", children: "Primera toma" }))] }), _jsxs("p", { className: "mt-1.5 text-xs text-tenue", children: ["El ", fecha(conToma[0].visitDate), " \u00B7 ", atendio(conToma[0])] })] })) : (_jsx("p", { className: "mt-1 text-sm text-tenue", children: "Sin toma registrada" }))] }), _jsx("div", { className: "p-5", children: p.status !== 'ACTIVE' ? (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-xs font-medium text-tenue", children: "Pr\u00F3xima visita" }), _jsxs("p", { className: "mt-1 text-sm text-tenue", children: [ESTADOS[p.status], ": no se programa"] })] })) : proxima && diasParaVolver < 0 ? (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-xs font-medium text-tenue", children: "Sin asistir" }), _jsxs("p", { className: "mt-1 text-xl font-semibold text-red-600", children: [visitasPerdidas, " visita", visitasPerdidas === 1 ? '' : 's', " sin asistir"] }), _jsxs("p", { className: "mt-1 text-sm text-tenue", children: ["\u00DAltima visita el ", fecha(ultima.visitDate)] }), jornadaProxima ? (_jsxs("p", { className: "mt-2 flex items-center gap-1.5 text-sm font-medium", children: [_jsx(CalendarClock, { className: "size-4 text-tenue" }), "Pr\u00F3xima jornada en ", p.community?.name, ": ", fecha(jornadaProxima.fecha)] })) : (_jsxs("p", { className: "mt-2 text-xs text-tenue", children: ["No hay jornada planificada en ", p.community?.name, "."] }))] })) : proxima ? (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-xs font-medium text-tenue", children: "Pr\u00F3xima visita" }), _jsxs("p", { className: "mt-1 flex items-center gap-2 text-xl font-semibold", children: [_jsx(CalendarClock, { className: "size-5 text-tenue" }), fecha(proxima.toISOString())] }), _jsx("p", { className: cn('mt-1 text-sm font-medium', diasParaVolver <= 7 ? 'text-amber-800' : 'text-tenue'), children: diasParaVolver === 0 ? 'Le toca hoy' : `En ${diasParaVolver} día${diasParaVolver === 1 ? '' : 's'}` }), _jsxs("p", { className: "mt-1.5 text-xs text-tenue", children: ["\u00DAltima visita el ", fecha(ultima.visitDate)] })] })) : null }), _jsxs("div", { className: "p-5", children: [_jsx("p", { className: "text-xs font-medium text-tenue", children: "Tratamiento actual" }), ultima.prescriptions?.length ? (_jsx("ul", { className: "mt-1.5 space-y-1.5", children: ultima.prescriptions.map((r) => (_jsxs("li", { className: "flex items-baseline justify-between gap-2 text-sm", children: [_jsxs("span", { children: [_jsx("span", { className: "font-medium", children: r.medication?.name }), " ", _jsx("span", { className: "text-tenue", children: r.medication?.concentration }), _jsxs("span", { className: "block text-xs text-tenue", children: [r.dailyDose, " al d\u00EDa"] })] }), r.adherencePercentage !== null && (_jsxs("span", { className: cn('tabular shrink-0 text-xs font-medium', colorCumplimiento(Number(r.adherencePercentage))), title: "Cumplimiento en esta visita", children: [Math.round(Number(r.adherencePercentage)), "% cumpli\u00F3"] }))] }, r.id))) })) : (_jsx("p", { className: "mt-1 text-sm text-tenue", children: "Sin medicamentos en la \u00FAltima visita" }))] })] }), p.status === 'ACTIVE' && alertas.length > 0 && (_jsxs("div", { className: "border-t border-borde p-4", children: [_jsx("p", { className: "mb-2 text-xs font-medium text-tenue", children: "Alertas de la \u00FAltima visita" }), _jsx(ListaAlertas, { alertas: alertas, className: "grid gap-2 space-y-0 md:grid-cols-2" })] }))] })), _jsxs("div", { className: "grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]", children: [_jsxs("div", { className: "space-y-4", children: [_jsx(Tarjeta, { titulo: "Evoluci\u00F3n de la presi\u00F3n arterial", copiable: true, ayuda: AYUDA.evolucionPaciente, accion: _jsxs("span", { className: "tabular hidden text-xs text-tenue sm:inline", children: [a && a.totalVisits > 1 && (_jsxs(_Fragment, { children: ["Promedio ", _jsxs("strong", { className: "font-mono text-tinta", children: [a.bpStats.systolic.avg, "/", a.bpStats.diastolic.avg] }), " \u00B7 M\u00E1xima", ' ', _jsxs("strong", { className: "font-mono text-tinta", children: [a.bpStats.systolic.max, "/", a.bpStats.diastolic.max] }), " \u00B7", ' '] })), ultima?.bmi && (_jsxs(_Fragment, { children: ["IMC ", _jsx("strong", { className: "font-mono text-tinta", children: decimal(ultima.bmi) }), " (", decimal(ultima.weightKg), " kg)"] }))] }), children: _jsx(GraficoTension, { visitas: p.clinicalVisits ?? [] }) }), _jsx(Tarjeta, { titulo: `Visitas (${p.clinicalVisits?.length ?? 0})`, children: p.clinicalVisits?.length ? (_jsx("ul", { className: "divide-y divide-borde", children: p.clinicalVisits.map((v) => (_jsx(FilaVisita, { visita: v }, v.id))) })) : (_jsx(Vacio, { icono: _jsx(Stethoscope, { className: "size-8" }), titulo: "Sin visitas", children: "Registra la primera visita para empezar el seguimiento." })) })] }), _jsxs("aside", { className: "space-y-4", children: [_jsx(EntregasDelPaciente, { paciente: p }), _jsx(Tarjeta, { titulo: "Ficha", children: _jsxs("dl", { className: "grid gap-4 p-5", children: [_jsxs("div", { className: "rounded-lg bg-marca-50 px-4 py-3", children: [_jsx("dt", { className: "text-xs text-tenue", children: "C\u00F3digo" }), _jsxs("dd", { className: "flex items-baseline justify-between gap-2", children: [_jsx("span", { className: "font-mono text-2xl font-semibold tracking-wide", children: p.patientCode }), puedeRevisar && (_jsx(Link, { to: `/pacientes/${p.id}/codigo`, className: "text-xs text-tenue underline-offset-4 hover:text-tinta hover:underline", children: "Cambiar" }))] }), codigoDeOtroBatey && puedeRevisar && (_jsxs("dd", { className: "mt-1 text-xs text-amber-800", children: ["No es de ", p.community.name, " (sus c\u00F3digos empiezan por ", p.community.abbreviation, ")."] })), codigoDeOtroBatey && puedeRevisar && (_jsx("dd", { className: "mt-2", children: _jsx(Boton, { variante: "secundario", className: "h-8 text-xs", icono: _jsx(RefreshCw, { className: "size-3.5" }), cargando: regenerar.isPending, onClick: async () => {
                                                            if (await confirmar({
                                                                titulo: `¿Darle un código de ${p.community.name}?`,
                                                                mensaje: `${p.patientCode} se reemplaza por el siguiente código ${p.community.abbreviation} libre. Las visitas y entregas se quedan con el paciente. Si tiene una tarjeta o una hoja impresa con el código anterior, hay que cambiarla. El cambio queda en Auditoría.`,
                                                                confirmar: 'Regenerar código',
                                                                peligro: false,
                                                            }))
                                                                regenerar.mutate();
                                                        }, children: "Regenerar c\u00F3digo" }) }))] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsx(Dato, { etiqueta: "Sexo", children: GENEROS[p.gender] }), _jsx(Dato, { etiqueta: "Edad", children: edadTexto(p) }), _jsx(Dato, { etiqueta: "Visitas", children: p.clinicalVisits?.length ?? 0 }), _jsx(Dato, { etiqueta: "\u00DAltima visita", children: ultima ? fecha(ultima.visitDate) : '—' })] }), _jsx(Dato, { etiqueta: "\u00DAltimo m\u00E9dico", children: ultima ? atendio(ultima) : '—' }), _jsx(Dato, { etiqueta: "Nacimiento", children: p.birthDateIsEstimated ? `Aprox. ${new Date(p.birthDate).getUTCFullYear()}` : fecha(p.birthDate) }), _jsx(Dato, { etiqueta: "Tel\u00E9fono", children: p.phoneNumber || '—' }), _jsx(Dato, { etiqueta: "Direcci\u00F3n", children: p.address || '—' }), _jsxs(Dato, { etiqueta: "Comunidad", children: [p.community?.name, " ", _jsxs("span", { className: "text-tenue", children: ["\u00B7 ", p.community?.municipality, ", ", p.community?.province] })] }), _jsx(Dato, { etiqueta: "Registrado", children: fecha(p.registrationDate) })] }) }), !!p.inasistencias?.length && (_jsx(Tarjeta, { titulo: `No vino (${p.inasistencias.length})`, children: _jsx("ul", { className: "divide-y divide-borde text-sm", children: p.inasistencias.map((i) => (_jsxs("li", { className: "px-5 py-2", children: [_jsx("span", { className: "tabular", children: fecha(`${i.fecha.slice(0, 10)}T12:00:00`) }), _jsxs("span", { className: "block text-xs text-tenue", children: [MOTIVOS_INASISTENCIA[i.motivo], i.nota && ` · ${i.nota}`, i.userName && ` · lo marcó ${i.userName}`] })] }, i.fecha))) }) })), _jsx(Tarjeta, { titulo: "H\u00E1bitos", children: _jsxs("dl", { className: "grid grid-cols-2 gap-4 p-5", children: [_jsx(Dato, { etiqueta: "Sal", children: SAL[p.saltIntake] }), _jsx(Dato, { etiqueta: "Alcohol", children: ALCOHOL[p.alcoholIntake] }), _jsx(Dato, { etiqueta: "Tabaco", children: TABACO[p.smokingStatus] }), _jsx(Dato, { etiqueta: "Antecedentes", children: p.hasFamilyHistory ? 'Sí' : 'No' })] }) }), a && a.weightTrend.length > 1 && (_jsx(Tarjeta, { titulo: "Peso", children: _jsx("ul", { className: "divide-y divide-borde text-sm", children: a.weightTrend.slice(-5).reverse().map((w) => (_jsxs("li", { className: "tabular flex justify-between px-5 py-2", children: [_jsx("span", { className: "text-tenue", children: fecha(w.date) }), _jsxs("span", { children: [decimal(w.weight), " kg ", _jsxs("span", { className: "text-tenue", children: ["\u00B7 IMC ", num(w.bmi)?.toFixed(1)] })] })] }, w.date))) }) }))] })] })] }));
}
/** Medicamentos: lo pendiente de entregar, la reposición sin consulta y las últimas entregas. */
function EntregasDelPaciente({ paciente: p }) {
    const { tiene } = useSesion();
    const navegar = useNavigate();
    const [todas, setTodas] = useState(false);
    const consulta = useQuery({ queryKey: ['entregas', 'paciente', p.id], queryFn: () => entregasDelPaciente(p.id) });
    const d = consulta.data;
    if (!d || (!d.pendientes.length && !d.entregas.length && !tiene('entregas.registrar')))
        return null;
    const puede = tiene('entregas.registrar') && p.status === 'ACTIVE';
    const lista = todas ? d.entregas : d.entregas.slice(0, 4);
    return (_jsxs(Tarjeta, { titulo: "Medicamentos entregados", children: [d.sinConsulta >= 2 && (_jsxs("p", { className: "border-b border-borde bg-red-50 px-5 py-3 text-sm text-red-800", children: ["Lleva ", _jsxs("strong", { children: [d.sinConsulta, " rondas"] }), " recibiendo el tratamiento sin consulta. Que lo vea un m\u00E9dico en la pr\u00F3xima jornada."] })), d.pendientes.length > 0 && (_jsxs("div", { className: "border-b border-borde bg-amber-50 px-5 py-3 text-sm", children: [_jsx("p", { className: "font-medium text-amber-900", children: "Pendiente de entregar" }), _jsx("ul", { className: "mt-1 space-y-0.5 text-amber-900", children: d.pendientes.map((r) => (_jsxs("li", { className: "tabular", children: [r.medicamento.name, " ", r.medicamento.concentration, ": ", _jsx("strong", { children: r.pendiente }), ' ', _jsxs("span", { className: "text-xs text-amber-800", children: ["de ", r.indicada, " \u00B7 visita del ", fecha(r.visitaFecha)] })] }, r.id))) }), puede && (_jsx(Boton, { variante: "secundario", className: "mt-2 h-9 w-full", onClick: () => navegar(`/entregas?batey=${p.communityId}`), children: "Entregar ahora" }))] })), puede && (_jsxs("div", { className: "border-b border-borde px-5 py-3", children: [_jsx(Boton, { variante: "secundario", className: "h-9 w-full", icono: _jsx(Pill, { className: "size-4" }), disabled: !d.reposicion.permitida, onClick: () => navegar(`/pacientes/${p.id}/reposicion`), children: "Reposici\u00F3n sin consulta" }), _jsx("p", { className: "mt-1.5 text-xs text-tenue", children: d.reposicion.permitida ? 'Un familiar las recoge o se le acabaron antes de la jornada…' : d.reposicion.motivo })] })), d.entregas.length === 0 ? (_jsx("p", { className: "px-5 py-3 text-sm text-tenue", children: "Todav\u00EDa no hay entregas registradas en la app." })) : (_jsx("ul", { className: "divide-y divide-borde text-sm", children: lista.map((e) => (_jsxs("li", { className: "px-5 py-2.5", children: [_jsxs("div", { className: "flex items-baseline justify-between gap-2", children: [_jsx("span", { className: "tabular", children: fecha(e.fecha) }), e.tipo === 'REPOSICION' && _jsx(Insignia, { color: "#7a5c00", children: "Reposici\u00F3n" })] }), _jsx("p", { className: "tabular text-xs text-tinta/80", children: e.items
                                .map((i) => {
                                const devueltas = (i.devoluciones ?? []).reduce((a, d) => a + d.cantidad, 0);
                                return `${i.medication?.name} ${i.medication?.concentration}: ${i.cantidad}${devueltas ? ` (devueltas ${devueltas})` : ''}`;
                            })
                                .join(' · ') }), _jsxs("p", { className: "text-xs text-tenue", children: [e.motivo && `${MOTIVOS_REPOSICION[e.motivo]} · `, e.recibio !== 'PACIENTE' && `recibió ${e.recibioNombre ? conQuien(e.recibioNombre, e.recibioParentesco) : RECIBIO_ENTREGA[e.recibio].toLowerCase()} · `, e.entregadoPorNombre && `entregó ${e.entregadoPorNombre}`] }), puede && e.items.some((i) => i.cantidad > (i.devoluciones ?? []).reduce((a, d) => a + d.cantidad, 0)) && (_jsx(Link, { to: `/entregas/${e.id}/devolver`, className: "mt-0.5 inline-block text-xs text-tenue underline hover:text-tinta", children: "Devolver o corregir" }))] }, e.id))) })), d.entregas.length > 4 && (_jsx("button", { type: "button", className: "w-full border-t border-borde px-5 py-2 text-left text-sm text-tenue hover:text-tinta", onClick: () => setTodas((t) => !t), children: todas ? 'Ver menos' : `Ver las ${d.entregas.length}` }))] }));
}
