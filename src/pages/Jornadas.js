import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarPlus, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Lock, Mail, MapPin, Package, Pencil, Printer, Tent, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useAsistenciaJornadas, useComunidades, useDetalleJornada, useJornadas, useResponsables, useSugerenciasJornadas } from '../api/consultas';
import { cancelarJornada, cerrarJornada, crearJornada, editarJornada } from '../api/recursos';
import { useSesion } from '../auth/sesion';
import { conQuien, MOTIVOS_INASISTENCIA } from '../lib/etiquetas';
import { useConfirmar } from '../components/confirmar';
import { AreaTexto, Boton, Campo, Cargando, EncabezadoPagina, ErrorCarga, Insignia, InsigniaCategoria, Selector, Tabla, Tarjeta, Vacio } from '../components/ui';
import { cn, edadTexto, fecha, fechaYHora, nombreCompleto } from '../lib/formato';
import { SelectorFecha } from '../components/SelectorFecha';
/* Las jornadas son fechas "puras" (medianoche UTC): se muestran sin correr de día. */
const fmtDia = new Intl.DateTimeFormat('es-DO', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fmtLargo = new Intl.DateTimeFormat('es-DO', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtMes = new Intl.DateTimeFormat('es-DO', { month: 'long', year: 'numeric' });
export const diaJornada = (iso, largo = false) => {
    const t = (largo ? fmtLargo : fmtDia).format(new Date(iso));
    return t.charAt(0).toUpperCase() + t.slice(1);
};
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const hoyYmd = () => ymd(new Date());
const miles = (n) => n.toLocaleString('es-DO');
const ESTADOS = {
    PLANIFICADA: { texto: 'Planificada', color: '#a16207' },
    CERRADA: { texto: 'Cerrada', color: '#15803d' },
    CANCELADA: { texto: 'Cancelada', color: '#6b665e' },
};
function invalidar(cliente) {
    for (const k of [['jornadas'], ['auditoria']])
        cliente.invalidateQueries({ queryKey: k });
}
/* ───────────── Lista: próximas, sugerencias por batey y calendario ───────────── */
export function Jornadas() {
    const navegar = useNavigate();
    const puedePlanificar = useSesion().tiene('jornadas.planificar');
    const hoy = hoyYmd();
    const proximas = useJornadas({ desde: hoy, estado: 'PLANIFICADA' });
    const sugerencias = useSugerenciasJornadas();
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: "Jornadas", descripcion: "Planificaci\u00F3n de las visitas a cada batey: qu\u00E9 d\u00EDa, qui\u00E9n va y qu\u00E9 llevar.", acciones: puedePlanificar && (_jsx(Boton, { icono: _jsx(CalendarPlus, { className: "size-4" }), onClick: () => navegar('/jornadas/nueva'), children: "Planificar jornada" })) }), _jsxs("div", { className: "grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]", children: [_jsxs("div", { className: "space-y-4", children: [_jsx(Tarjeta, { titulo: "Pr\u00F3ximas jornadas", children: proximas.isPending ? (_jsx(Cargando, {})) : !proximas.data?.length ? (_jsx(Vacio, { icono: _jsx(Tent, { className: "size-8" }), titulo: "Nada planificado", children: "Usa las sugerencias por batey para planificar la pr\u00F3xima ronda." })) : (_jsx("ul", { className: "divide-y divide-borde", children: proximas.data.map((j) => (_jsx("li", { children: _jsxs(Link, { to: `/jornadas/${j.id}`, className: "flex items-center gap-4 px-5 py-3 hover:bg-fondo", children: [_jsx(FechaCaja, { iso: j.fecha }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "font-medium", children: j.community.name }), _jsx("p", { className: "text-xs text-tenue", children: j.responsable ? `Responsable: ${nombreCompleto(j.responsable)}` : 'Sin responsable' })] }), j.fecha.slice(0, 10) === hoy && _jsx(Insignia, { color: "#15803d", children: "Hoy" })] }) }, j.id))) })) }), _jsx(Tarjeta, { titulo: "Sugerencias por batey", accion: _jsx("span", { className: "text-xs text-tenue", children: "Cada ~3 meses desde la \u00FAltima visita" }), children: sugerencias.isPending ? (_jsx(Cargando, {})) : sugerencias.isError ? (_jsx(ErrorCarga, { error: sugerencias.error })) : (_jsx("ul", { className: "divide-y divide-borde", children: sugerencias.data.map((s) => (_jsxs("li", { className: "flex flex-wrap items-center gap-3 px-5 py-3", children: [_jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("p", { className: "flex items-center gap-2 font-medium", children: [s.batey, " ", s.atrasada && !s.proxima && _jsx(Insignia, { color: "#a16207", children: "Jornada pendiente" })] }), _jsxs("p", { className: "text-xs text-tenue", children: [miles(s.pacientes), " pacientes activos \u00B7 \u00FAltima visita ", s.ultimaVisita ? fecha(s.ultimaVisita) : 'nunca'] })] }), s.proxima ? (_jsxs(Link, { to: `/jornadas/${s.proxima.id}`, className: "text-sm text-tenue hover:text-tinta", children: ["Planificada: ", _jsx("span", { className: "font-medium text-tinta", children: diaJornada(s.proxima.fecha) })] })) : (_jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("span", { className: "text-sm text-tenue", children: ["Sugerida: ", diaJornada(s.sugerida)] }), puedePlanificar && (_jsx(Boton, { variante: "secundario", className: "h-8 px-3 text-xs", onClick: () => navegar(`/jornadas/nueva?batey=${s.communityId}&fecha=${s.sugerida.slice(0, 10)}`), children: "Planificar" }))] }))] }, s.communityId))) })) })] }), _jsx(Calendario, { puedePlanificar: puedePlanificar })] })] }));
}
function FechaCaja({ iso }) {
    const d = new Date(iso);
    return (_jsxs("div", { className: "grid w-12 shrink-0 place-items-center rounded-lg border border-borde bg-marca-50 py-1 leading-tight", children: [_jsx("span", { className: "text-[10px] text-tenue uppercase", children: new Intl.DateTimeFormat('es-DO', { timeZone: 'UTC', month: 'short' }).format(d) }), _jsx("span", { className: "text-lg font-semibold", children: d.getUTCDate() })] }));
}
function Calendario({ puedePlanificar }) {
    const [params, setParams] = useSearchParams();
    const navegar = useNavigate();
    const ahora = new Date();
    const [anio, mes] = (params.get('mes') ?? `${ahora.getFullYear()}-${ahora.getMonth() + 1}`).split('-').map(Number);
    const primero = new Date(anio, mes - 1, 1);
    const ultimo = new Date(anio, mes, 0);
    const consulta = useJornadas({ desde: ymd(primero), hasta: ymd(ultimo) });
    const hoy = hoyYmd();
    const cambiarMes = (delta) => {
        const d = new Date(anio, mes - 1 + delta, 1);
        setParams((p) => (p.set('mes', `${d.getFullYear()}-${d.getMonth() + 1}`), p), { replace: true });
    };
    const celdas = useMemo(() => {
        const inicio = (primero.getDay() + 6) % 7; // semana desde el lunes
        const dias = Array.from({ length: inicio }, () => null);
        for (let d = 1; d <= ultimo.getDate(); d++)
            dias.push(new Date(anio, mes - 1, d));
        while (dias.length % 7)
            dias.push(null);
        return dias;
    }, [anio, mes]); // eslint-disable-line react-hooks/exhaustive-deps
    const porDia = new Map();
    for (const j of consulta.data ?? [])
        porDia.set(j.fecha.slice(0, 10), [...(porDia.get(j.fecha.slice(0, 10)) ?? []), j]);
    return (_jsxs(Tarjeta, { titulo: fmtMes.format(primero).replace(/^./, (c) => c.toUpperCase()), accion: _jsxs("div", { className: "flex items-center gap-1", children: [_jsx(Boton, { variante: "fantasma", className: "h-8 px-2", onClick: () => cambiarMes(-1), "aria-label": "Mes anterior", children: _jsx(ChevronLeft, { className: "size-4" }) }), _jsx(Boton, { variante: "fantasma", className: "h-8 px-2 text-xs", onClick: () => setParams((p) => (p.delete('mes'), p), { replace: true }), children: "Hoy" }), _jsx(Boton, { variante: "fantasma", className: "h-8 px-2", onClick: () => cambiarMes(1), "aria-label": "Mes siguiente", children: _jsx(ChevronRight, { className: "size-4" }) })] }), children: [_jsx("div", { className: "grid grid-cols-7 border-b border-borde text-center text-[11px] text-tenue uppercase", children: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (_jsx("div", { className: "py-2", children: d }, d))) }), _jsx("div", { className: "grid grid-cols-7", children: celdas.map((d, i) => {
                    if (!d)
                        return _jsx("div", { className: "min-h-20 border-r border-b border-borde bg-fondo/50 [&:nth-child(7n)]:border-r-0" }, i);
                    const clave = ymd(d);
                    const js = porDia.get(clave) ?? [];
                    const futuro = clave >= hoy;
                    return (_jsxs("div", { onClick: () => puedePlanificar && futuro && !js.length && navegar(`/jornadas/nueva?fecha=${clave}`), className: cn('group min-h-20 border-r border-b border-borde p-1.5 [&:nth-child(7n)]:border-r-0', puedePlanificar && futuro && !js.length && 'cursor-pointer hover:bg-marca-50'), children: [_jsx("span", { className: cn('inline-grid size-6 place-items-center rounded-full text-xs', clave === hoy ? 'bg-tinta font-semibold text-white' : 'text-tenue'), children: d.getDate() }), _jsxs("div", { className: "mt-1 space-y-1", children: [js.map((j) => (_jsx(Link, { to: `/jornadas/${j.id}`, onClick: (e) => e.stopPropagation(), title: `${j.community.name} · ${ESTADOS[j.estado].texto}`, className: cn('block truncate rounded px-1.5 py-0.5 text-[11px] font-medium', j.estado === 'CANCELADA' && 'line-through'), style: { backgroundColor: `${ESTADOS[j.estado].color}1f`, color: ESTADOS[j.estado].color }, children: j.community.name }, j.id))), puedePlanificar && futuro && !js.length && _jsx("span", { className: "hidden text-[11px] text-tenue group-hover:block", children: "+ Planificar" })] })] }, i));
                }) }), !!consulta.data?.length && (_jsx("ul", { className: "divide-y divide-borde border-t border-borde text-sm", children: consulta.data.map((j) => (_jsx("li", { children: _jsxs(Link, { to: `/jornadas/${j.id}`, className: "flex items-center gap-3 px-5 py-2.5 hover:bg-fondo", children: [_jsx("span", { className: "w-36 shrink-0 text-tenue", children: diaJornada(j.fecha) }), _jsx("span", { className: "flex-1 font-medium", children: j.community.name }), j.resumen && (_jsxs("span", { className: "tabular text-xs text-tenue", children: [j.resumen.atendidos, " atendidos \u00B7 ", j.resumen.faltan, " faltaron"] })), _jsx(Insignia, { color: ESTADOS[j.estado].color, children: ESTADOS[j.estado].texto })] }) }, j.id))) }))] }));
}
/* ───────────── Formulario: /jornadas/nueva y /jornadas/:id/editar ───────────── */
export function JornadaEditor() {
    const id = Number(useParams().id) || undefined;
    const detalle = useDetalleJornada(id);
    const comunidades = useComunidades();
    const responsables = useResponsables();
    // Los selectores se montan con sus opciones ya cargadas, para que muestren el valor correcto.
    if ((id && detalle.isPending) || comunidades.isPending || responsables.isPending)
        return _jsx(Cargando, {});
    if (id && !detalle.data)
        return _jsx(Vacio, { titulo: "Jornada no encontrada" });
    const j = detalle.data?.jornada;
    if (j && j.estado !== 'PLANIFICADA') {
        return (_jsx(Vacio, { icono: _jsx(Lock, { className: "size-8" }), titulo: "Esta jornada ya no se puede editar", children: "Solo se editan las jornadas planificadas." }));
    }
    return _jsx(FormularioJornada, { jornada: j });
}
function FormularioJornada({ jornada }) {
    const [params] = useSearchParams();
    const navegar = useNavigate();
    const cliente = useQueryClient();
    const comunidades = useComunidades();
    const responsables = useResponsables();
    const { usuario } = useSesion();
    const { register, handleSubmit, formState, control } = useForm({
        defaultValues: jornada
            ? { communityId: String(jornada.communityId), fecha: jornada.fecha.slice(0, 10), responsableId: jornada.responsableId ? String(jornada.responsableId) : '', notas: jornada.notas ?? '' }
            : { communityId: params.get('batey') ?? '', fecha: params.get('fecha') ?? '', responsableId: usuario ? String(usuario.id) : '', notas: '' },
    });
    const guardar = useMutation({
        mutationFn: (d) => {
            const datos = { fecha: d.fecha, responsableId: d.responsableId ? Number(d.responsableId) : null, notas: d.notas.trim() };
            return jornada ? editarJornada(jornada.id, datos) : crearJornada({ ...datos, communityId: Number(d.communityId) });
        },
        onSuccess: (j) => {
            invalidar(cliente);
            toast.success(jornada ? 'Jornada actualizada' : `Jornada planificada en ${j.community.name}`);
            navegar(`/jornadas/${j.id}`, { replace: true });
        },
        onError: (e) => toast.error(e.message),
    });
    const e = formState.errors;
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: jornada ? `Editar jornada · ${jornada.community.name}` : 'Planificar jornada', volver: jornada ? { a: `/jornadas/${jornada.id}`, texto: 'Jornada' } : { a: '/jornadas', texto: 'Jornadas' } }), _jsxs("form", { onSubmit: handleSubmit((d) => guardar.mutate(d)), className: "max-w-2xl space-y-4", children: [_jsxs(Tarjeta, { titulo: "Jornada", children: [_jsxs("div", { className: "grid gap-4 p-5 sm:grid-cols-2", children: [_jsx(Campo, { etiqueta: "Batey", error: e.communityId && 'Elige el batey', className: "sm:col-span-2", ayuda: jornada ? 'El batey no se cambia: cancela y planifica otra.' : undefined, children: _jsx(Selector, { vacio: "Elegir batey\u2026", disabled: !!jornada, ...register('communityId', { required: true }), opciones: (comunidades.data ?? []).filter((c) => c.isActive || c.id === jornada?.communityId).map((c) => ({ value: c.id, label: c.name })) }) }), _jsx(Campo, { etiqueta: "Fecha", error: e.fecha && 'Elige la fecha', children: _jsx(Controller, { control: control, name: "fecha", rules: { required: true }, render: ({ field }) => _jsx(SelectorFecha, { min: jornada ? undefined : hoyYmd(), value: field.value, onChange: field.onChange, "aria-invalid": !!e.fecha, "aria-label": "Fecha de la jornada" }) }) }), _jsx(Campo, { etiqueta: "Responsable", children: _jsx(Selector, { vacio: "Sin asignar", ...register('responsableId'), opciones: (responsables.data ?? []).map((u) => ({ value: u.id, label: nombreCompleto(u) })) }) }), _jsx(Campo, { etiqueta: "Notas", className: "sm:col-span-2", ayuda: "Transporte, punto de encuentro, qui\u00E9nes van\u2026", children: _jsx(AreaTexto, { rows: 3, ...register('notas') }) })] }), _jsx("p", { className: "border-t border-borde px-5 py-3 text-sm text-tenue", children: "Si la jornada dura varios d\u00EDas, planifica un d\u00EDa por cada uno." })] }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Boton, { variante: "secundario", onClick: () => navegar(-1), children: "Cancelar" }), _jsx(Boton, { type: "submit", cargando: guardar.isPending, children: jornada ? 'Guardar' : 'Planificar' })] })] })] }));
}
/* ───────────── Detalle: /jornadas/:id ───────────── */
export function JornadaDetalle() {
    const id = Number(useParams().id);
    const consulta = useDetalleJornada(id);
    if (consulta.isPending)
        return _jsx(Cargando, {});
    if (consulta.isError)
        return _jsx(ErrorCarga, { error: consulta.error });
    return _jsx(Detalle, { d: consulta.data });
}
function Detalle({ d }) {
    const j = d.jornada;
    // Cuántos se esperan en las jornadas de este batey (media alta de las últimas jornadas): para saber cuánto llevar.
    const suelen = useAsistenciaJornadas().data?.find((x) => x.communityId === j.communityId);
    const navegar = useNavigate();
    const cliente = useQueryClient();
    const confirmar = useConfirmar();
    const { tiene } = useSesion();
    const [vista, setVista] = useState(j.estado === 'PLANIFICADA' ? 'faltan' : 'atendidos');
    const planificada = j.estado === 'PLANIFICADA';
    const hoy = hoyYmd();
    const diaJ = j.fecha.slice(0, 10);
    const r = j.estado === 'CERRADA' && j.resumen ? j.resumen : d.totales;
    const entregadas = j.estado === 'CERRADA' && j.resumen?.entregadas ? j.resumen.entregadas : d.entregadas;
    const accion = useMutation({
        mutationFn: (a) => (a === 'cerrar' ? cerrarJornada(j.id) : cancelarJornada(j.id)),
        onSuccess: (_, a) => {
            invalidar(cliente);
            toast.success(a === 'cerrar' ? 'Jornada cerrada. El resumen quedó guardado.' : 'Jornada cancelada');
        },
        onError: (e) => toast.error(e.message),
    });
    const cerrar = async () => {
        const ok = await confirmar({
            titulo: 'Cerrar la jornada',
            mensaje: (_jsxs(_Fragment, { children: ["Se guardar\u00E1 el resumen: ", _jsx("strong", { children: d.totales.atendidos }), " atendidos y ", _jsx("strong", { children: d.totales.faltan }), " esperados que no vinieron. Despu\u00E9s no se puede reabrir (las visitas se siguen pudiendo registrar)."] })),
            confirmar: 'Cerrar jornada',
            peligro: false,
        });
        if (ok)
            accion.mutate('cerrar');
    };
    const cancelar = async () => {
        if (await confirmar({ titulo: 'Cancelar la jornada', mensaje: `La jornada de ${j.community.name} del ${diaJornada(j.fecha)} quedará cancelada.`, confirmar: 'Cancelar jornada' }))
            accion.mutate('cancelar');
    };
    const pacientes = d.pacientes.filter((p) => (vista === 'faltan' ? p.esperado && !p.atendidoHoy : vista === 'atendidos' ? p.atendidoHoy : true));
    const faltaAlgo = d.llevar.some((m) => m.falta > 0);
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: `${j.community.name}`, descripcion: _jsxs("span", { className: "flex flex-wrap items-center gap-2", children: [_jsx("span", { children: diaJornada(j.fecha, true) }), _jsx(Insignia, { color: ESTADOS[j.estado].color, children: ESTADOS[j.estado].texto }), diaJ === hoy && planificada && _jsx(Insignia, { color: "#15803d", children: "Hoy" }), _jsxs("span", { children: ["\u00B7 ", j.responsable ? `Responsable: ${nombreCompleto(j.responsable)}` : 'Sin responsable'] })] }), volver: { a: '/jornadas', texto: 'Jornadas' }, acciones: _jsxs(_Fragment, { children: [j.estado !== 'CANCELADA' && tiene('visitas.registrar') && (_jsx(Boton, { variante: "secundario", icono: _jsx(Mail, { className: "size-4" }), onClick: () => navegar(`/jornadas/${j.id}/enviar-resumen`), children: "Enviar resumen" })), planificada && tiene('entregas.registrar') && (_jsx(Boton, { variante: "secundario", icono: _jsx(Printer, { className: "size-4" }), onClick: () => navegar(`/jornadas/${j.id}/preparacion`), children: "Hoja de preparaci\u00F3n" })), planificada && (_jsxs(_Fragment, { children: [tiene('jornadas.planificar') && (_jsxs(_Fragment, { children: [_jsx(Boton, { variante: "secundario", icono: _jsx(XCircle, { className: "size-4" }), className: "hover:text-red-600", onClick: cancelar, disabled: accion.isPending, children: "Cancelar" }), _jsx(Boton, { variante: "secundario", icono: _jsx(Pencil, { className: "size-4" }), onClick: () => navegar(`/jornadas/${j.id}/editar`), children: "Editar" })] })), tiene('visitas.registrar') && (_jsxs(_Fragment, { children: [_jsx(Boton, { variante: "secundario", icono: _jsx(CheckCircle2, { className: "size-4" }), onClick: cerrar, cargando: accion.isPending, disabled: diaJ > hoy, title: diaJ > hoy ? 'Se cierra el día de la jornada o después' : undefined, children: "Cerrar jornada" }), _jsx(Boton, { icono: _jsx(ClipboardList, { className: "size-4" }), onClick: () => navegar(`/jornada?batey=${j.communityId}`), children: "Abrir registro" })] }))] }))] }) }), j.notas && _jsx("p", { className: "mb-4 rounded-lg bg-marca-50 px-4 py-2.5 text-sm whitespace-pre-line", children: j.notas }), j.estado === 'CERRADA' && (_jsxs("p", { className: "mb-4 text-sm text-tenue", children: ["Cerrada por ", j.cerradaPor ?? '—', " el ", fechaYHora(j.cerradaEn), ". Las cifras son las del cierre."] })), _jsx("div", { className: "mb-4 grid grid-cols-2 gap-4 md:grid-cols-5", children: [
                    // Esperados: media alta de las últimas jornadas del batey (ver Configuración); nunca vienen todos los regulares.
                    { t: 'Esperados', v: suelen?.promedio ?? r.esperados, ayuda: suelen ? `media alta de las últimas ${suelen.jornadas.length} · ${r.esperados} regulares` : `de ${r.activos} regulares` },
                    { t: 'Atendidos', v: r.atendidos, ayuda: r.atendidos - r.atendidosEsperados > 0 ? `${r.atendidos - r.atendidosEsperados} fuera de lista` : undefined },
                    { t: planificada ? 'Faltan por ver' : 'No vinieron', v: r.faltan, color: r.faltan ? 'text-red-600' : '', ayuda: r.noVinieron ? `${r.noVinieron} marcados "No vino"` : undefined },
                    { t: 'Controlados', v: r.controlados, ayuda: r.atendidos ? `${Math.round((r.controlados / r.atendidos) * 100)}% de los atendidos` : undefined },
                    { t: 'Pacientes nuevos', v: r.nuevos },
                ].map((k) => (_jsxs("div", { className: "rounded-xl border border-borde bg-superficie p-4", children: [_jsx("p", { className: "text-xs text-tenue", children: k.t }), _jsx("p", { className: cn('tabular mt-1 text-2xl font-semibold', k.color), children: miles(k.v) }), k.ayuda && _jsx("p", { className: "text-xs text-tenue", children: k.ayuda })] }, k.t))) }), _jsxs("div", { className: "mb-4 grid gap-4 lg:grid-cols-2", children: [planificada && (_jsx(Tarjeta, { titulo: "Qu\u00E9 llevar", accion: _jsx("span", { className: "text-right text-xs text-tenue", children: "Seg\u00FAn la \u00FAltima receta de quienes faltan" }), children: !d.llevar.length ? (_jsx(Vacio, { icono: _jsx(Package, { className: "size-8" }), titulo: "Nada que llevar", children: "Nadie de los que faltan tiene una receta anterior." })) : (_jsxs(_Fragment, { children: [faltaAlgo && (_jsxs("p", { className: "flex items-center gap-2 border-b border-borde bg-red-50 px-5 py-2.5 text-sm text-red-700", children: [_jsx(AlertTriangle, { className: "size-4" }), " No alcanza la existencia vigente para esa fecha.", tiene('inventario.gestionar') && (_jsx(Link, { to: "/medicamentos/entrada", className: "ml-auto font-medium underline", children: "Registrar entrada" }))] })), _jsx(Tabla, { columnas: ['Medicamento', { texto: 'Pacientes', className: 'text-right' }, { texto: 'Llevar', className: 'text-right' }, { texto: 'Disponible', className: 'text-right' }, { texto: 'Falta', className: 'text-right' }], children: d.llevar.map((m) => (_jsxs("tr", { className: cn(m.falta > 0 && 'bg-red-50/60'), children: [_jsx("td", { className: "px-5 py-2.5", children: tiene('inventario.gestionar') ? (_jsx(Link, { to: `/medicamentos/${m.medicationId}`, className: "hover:underline", children: m.medicamento })) : (m.medicamento) }), _jsx("td", { className: "tabular px-5 py-2.5 text-right", children: m.pacientes }), _jsx("td", { className: "tabular px-5 py-2.5 text-right font-medium", children: miles(m.pastillas) }), _jsx("td", { className: "tabular px-5 py-2.5 text-right text-tenue", children: miles(m.disponible) }), _jsx("td", { className: cn('tabular px-5 py-2.5 text-right font-medium', m.falta > 0 ? 'text-red-600' : 'text-green-700'), children: m.falta > 0 ? miles(m.falta) : 'OK' })] }, m.medicationId))) })] })) })), _jsx(Tarjeta, { titulo: "Pastillas entregadas", children: !entregadas.length ? (_jsx(Vacio, { titulo: "A\u00FAn no se ha entregado nada" })) : (_jsxs(Tabla, { columnas: ['Medicamento', { texto: 'Pastillas', className: 'text-right' }], children: [entregadas.map((m) => (_jsxs("tr", { children: [_jsx("td", { className: "px-5 py-2.5", children: m.medicamento }), _jsx("td", { className: "tabular px-5 py-2.5 text-right font-medium", children: miles(m.pastillas) })] }, m.medicamento))), _jsxs("tr", { className: "border-t border-borde font-semibold", children: [_jsx("td", { className: "px-5 py-2.5", children: "Total" }), _jsx("td", { className: "tabular px-5 py-2.5 text-right", children: miles(entregadas.reduce((a, m) => a + m.pastillas, 0)) })] })] })) }), j.estado === 'CERRADA' && (_jsx(Tarjeta, { titulo: `No vinieron (${j.resumen?.faltantes?.length ?? 0})`, children: !j.resumen?.faltantes?.length ? (_jsx(Vacio, { titulo: "Vinieron todos los esperados" })) : (_jsx("ul", { className: "max-h-96 divide-y divide-borde overflow-y-auto text-sm", children: j.resumen.faltantes.map((p) => (_jsx("li", { children: _jsxs(Link, { to: `/pacientes/${p.id}`, className: "flex gap-3 px-5 py-2.5 hover:bg-fondo", children: [_jsx("span", { className: "w-20 font-mono text-xs text-tenue", children: p.codigo }), _jsx("span", { className: "flex-1", children: p.nombre }), p.motivo && _jsx("span", { className: "text-xs text-tenue", children: MOTIVOS_INASISTENCIA[p.motivo] })] }) }, p.id))) })) }))] }), j.estado !== 'CANCELADA' && (_jsx(Tarjeta, { titulo: "Pacientes", accion: _jsx("div", { className: "flex gap-1", children: [
                        ['faltan', planificada ? 'Faltan' : 'No vinieron', d.totales.faltan],
                        ['atendidos', 'Atendidos', d.totales.atendidos],
                        ['todos', 'Todos', d.pacientes.length],
                    ].map(([v, t, n]) => (_jsxs("button", { onClick: () => setVista(v), className: cn('rounded-full border px-3 py-1 text-xs', vista === v ? 'border-tinta bg-marca-500 font-medium' : 'border-borde text-tenue hover:text-tinta'), children: [t, " (", n, ")"] }, v))) }), children: !pacientes.length ? (_jsx(Vacio, { icono: _jsx(MapPin, { className: "size-8" }), titulo: "Nadie en esta lista" })) : (_jsx(Tabla, { columnas: ['Paciente', 'Edad', 'Casa', 'Última visita', 'PA', 'Atendió', 'Estado'], children: pacientes.map((p) => (_jsxs("tr", { onClick: () => navegar(`/pacientes/${p.id}?volver=${encodeURIComponent(`/jornadas/${j.id}`)}`), className: "cursor-pointer hover:bg-fondo", children: [_jsxs("td", { className: "px-5 py-2.5", children: [_jsx("span", { className: "font-medium whitespace-nowrap", children: nombreCompleto(p) }), _jsx("span", { className: "block font-mono text-xs text-tenue", children: p.patientCode })] }), _jsx("td", { className: "px-5 py-2.5 whitespace-nowrap", children: edadTexto(p) }), _jsx("td", { className: "px-5 py-2.5 text-tenue", children: p.address ?? '—' }), _jsx("td", { className: "px-5 py-2.5 whitespace-nowrap", children: fecha(p.ultimaVisita) }), _jsxs("td", { className: "px-5 py-2.5 whitespace-nowrap", children: [_jsx("span", { className: "tabular mr-2 font-mono", children: p.presion ?? '—' }), p.categoria && _jsx(InsigniaCategoria, { config: p.categoria })] }), _jsx("td", { className: "px-5 py-2.5 whitespace-nowrap text-tenue", children: p.atendio ?? '—' }), _jsx("td", { className: "px-5 py-2.5", children: p.atendidoHoy ? (_jsx(Insignia, { color: "#15803d", children: "Atendido" })) : p.noVino ? (_jsxs(Insignia, { color: "#6b665e", children: ["No vino \u00B7 ", MOTIVOS_INASISTENCIA[p.noVino].toLowerCase(), p.tratamientoDejado && ` · tratamiento dejado con ${conQuien(p.tratamientoDejado.con, p.tratamientoDejado.parentesco)}`] })) : (_jsx(Insignia, { color: planificada ? '#b45309' : '#6b665e', children: planificada ? 'Por ver' : 'No vino' })) })] }, p.id))) })) }))] }));
}
