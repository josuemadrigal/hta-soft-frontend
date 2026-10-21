import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { CheckCircle2, ClipboardPlus, CloudDownload, MapPin, Search, UserPlus, UserX } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router';
import { useAsistenciaJornadas, useComunidades, useConfiguracion, useJornada, useJornadas, useResponsables } from '../api/consultas';
import { hoyYmd } from './Jornadas';
import { marcarNoVino, quitarNoVino } from '../api/recursos';
import { conQuien, MOTIVOS_INASISTENCIA } from '../lib/etiquetas';
import { DejarTratamiento } from '../components/DejarTratamiento';
import { useSesion } from '../auth/sesion';
import { agregarPendiente, descartarPendiente, esFaltaDeConexion, nuevoId, usePendientes } from '../offline/cola';
import { descargarJornada, jornadasDescargadas, useEnLinea } from '../offline/datos';
import { Avatar, Boton, Cargando, EncabezadoPagina, Entrada, ErrorCarga, Insignia, InsigniaCategoria, Selector, Tarjeta, Vacio } from '../components/ui';
import { asistencia } from '../lib/asistencia';
import { mensajeEntrega } from '../lib/entregas';
import { cn, edadTexto, fecha, fechaYHora, nombreCompleto, tensionDe } from '../lib/formato';
import { ymd } from '../components/SelectorFecha';
import { corteRegulares, esRegular, tiempoSinVenir, VISITAS_SIN_VENIR_REGULAR } from '../lib/regulares';
/** Asistencia (lib/asistencia.ts): "Pendiente" aún no viene en esta ronda; "No asiste desde…" lleva más de 6 meses sin venir. */
const ESTADOS = {
    pendiente: { texto: 'Pendiente', color: '#a16207', orden: 0 },
    sinVenir: { texto: 'No asiste', color: '#9a3412', orden: 1 },
    nuevo: { texto: 'Sin visitas', color: '#6b665e', orden: 2 },
    hoy: { texto: 'Visto hoy', color: '#15803d', orden: 3 },
    ronda: { texto: 'Visto en la ronda', color: '#7a5c00', orden: 4 },
    noVino: { texto: 'No vino', color: '#6b665e', orden: 5 },
    // Se perdió más visitas de las que se aceptan (Configuración): no cuenta como "por ver".
    yaNoViene: { texto: 'Ya no viene', color: '#6b665e', orden: 6 },
};
const FILTROS = [
    { valor: 'pendientes', texto: 'Por ver' },
    { valor: 'hoy', texto: 'Vistos hoy' },
    { valor: 'novino', texto: 'No vinieron' },
    { valor: 'yanovienen', texto: 'Ya no vienen' },
    { valor: 'todos', texto: 'Todos' },
];
function inicioRonda() {
    const h = new Date();
    return new Date(h.getFullYear(), Math.floor(h.getMonth() / 3) * 3, 1);
}
/** "No vino · estaba trabajando · tratamiento dejado con Rosa (hijo/a)" */
function textoNoVino(p, locales) {
    const marca = p.inasistencias?.find((i) => i.fecha.slice(0, 10) === hoyYmd());
    const motivo = locales.noVino.get(p.id) ?? marca?.motivo ?? 'NO_ESTABA';
    const local = locales.tratamiento.get(p.id);
    const t = local ? { recibioNombre: local.recibioNombre, recibioParentesco: local.recibioParentesco } : marca?.entrega;
    return `No vino · ${MOTIVOS_INASISTENCIA[motivo].toLowerCase()}${t ? ` · tratamiento dejado con ${conQuien(t.recibioNombre, t.recibioParentesco)}` : ''}`;
}
function estadoDe(p, ronda, hoy, locales, corte) {
    if (locales.visitas.has(p.id))
        return 'hoy';
    const u = p.clinicalVisits[0];
    if (!(u && new Date(u.visitDate) >= hoy) && (locales.noVino.has(p.id) || p.inasistencias?.some((i) => i.fecha.slice(0, 10) === hoyYmd())))
        return 'noVino';
    if (!esRegular(u?.visitDate, p.registrationDate, corte))
        return 'yaNoViene';
    if (!u)
        return 'nuevo';
    const visita = new Date(u.visitDate);
    if (visita >= hoy)
        return 'hoy';
    if (visita >= ronda)
        return 'ronda';
    return asistencia(u.visitDate).clave === 'sin-venir' ? 'sinVenir' : 'pendiente';
}
const FECHA_CORTA = new Intl.DateTimeFormat('es-DO', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fechaCorta = (ymd) => FECHA_CORTA.format(new Date(`${ymd}T00:00:00Z`));
const CLAVE_BATEY = 'hta:ultimoBatey';
const leerUltimoBatey = () => {
    try {
        return localStorage.getItem(CLAVE_BATEY);
    }
    catch {
        return null;
    }
};
const guardarUltimoBatey = (id) => {
    try {
        localStorage.setItem(CLAVE_BATEY, id);
    }
    catch {
        /* sin almacenamiento: no se recuerda */
    }
};
export function Jornada() {
    const [params, setParams] = useSearchParams();
    const idPedido = Number(params.get('batey')) || undefined;
    const [busqueda, setBusqueda] = useState('');
    const [filtro, setFiltro] = useState('pendientes');
    const [medico, setMedico] = useState('');
    const navegar = useNavigate();
    const comunidades = useComunidades();
    // Un enlace viejo puede traer un batey que ya no existe: se trata como sin elegir.
    const comunidadId = comunidades.data?.some((c) => c.id === idPedido) ? idPedido : undefined;
    const lista = useJornada(comunidadId);
    const configuracion = useConfiguracion();
    const asistenciaJ = useAsistenciaJornadas();
    const usuariosActivos = useResponsables();
    const visitasSinVenir = configuracion.data?.visitasSinVenirRegular ?? VISITAS_SIN_VENIR_REGULAR;
    const hoyPlan = useJornadas({ desde: hoyYmd(), hasta: hoyYmd(), estado: 'PLANIFICADA' });
    // Jornadas de hoy y de mañana: esos bateyes se descargan solos para trabajar sin señal.
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    const pronto = useJornadas({ desde: hoyYmd(), hasta: ymd(manana), estado: 'PLANIFICADA' });
    const planHoy = hoyPlan.data?.find((j) => j.communityId === comunidadId);
    // Al entrar sin batey elegido se pone solo el de la jornada de hoy (una sola vez: si después lo
    // cambian o lo quitan, se respeta). Sin internet, el último batey usado en este dispositivo.
    const autoElegido = useRef(false);
    const [elegidoSolo, setElegidoSolo] = useState(false);
    useEffect(() => {
        if (autoElegido.current || idPedido || !comunidades.data)
            return;
        const activo = (id) => !!id && comunidades.data.some((c) => c.id === id && c.isActive);
        let id;
        if (hoyPlan.data) {
            const deHoy = [...new Set(hoyPlan.data.map((j) => j.communityId))];
            if (deHoy.length === 1 && activo(deHoy[0]))
                id = deHoy[0];
        }
        else if (hoyPlan.isError || !navigator.onLine) {
            const ultimo = Number(leerUltimoBatey());
            if (activo(ultimo))
                id = ultimo;
        }
        else
            return; // todavía cargando la jornada de hoy
        autoElegido.current = true;
        if (id) {
            setElegidoSolo(true);
            setParams({ batey: String(id) }, { replace: true });
        }
    }, [idPedido, comunidades.data, hoyPlan.data, hoyPlan.isError, setParams]);
    // Recordar el batey para la próxima vez (sobre todo sin internet)
    useEffect(() => {
        if (comunidadId)
            guardarUltimoBatey(String(comunidadId));
    }, [comunidadId]);
    // Lo registrado en este dispositivo que aún no se envía (sin internet)
    const pendientes = usePendientes();
    const enLinea = useEnLinea();
    const locales = useMemo(() => {
        const visitas = new Set();
        const noVino = new Map();
        const tratamiento = new Map();
        for (const x of pendientes) {
            if (x.tipo === 'visita')
                visitas.add(x.resumen.pacienteId);
            if (x.tipo === 'no-vino') {
                const d = x.cuerpo;
                noVino.set(x.resumen.pacienteId, d.motivo);
                if (d.tratamiento)
                    tratamiento.set(x.resumen.pacienteId, d.tratamiento);
            }
        }
        return { visitas, noVino, tratamiento };
    }, [pendientes]);
    const cliente = useQueryClient();
    const { tiene } = useSesion();
    // Paciente al que se le está preguntando si se le deja el tratamiento (ventana abierta)
    const [dejar, setDejar] = useState(null);
    /** Cambia la marca de "No vino" en la lista guardada (se ve al instante, también sin internet). */
    const ajustarLista = (pacienteId, marca) => cliente.setQueryData(['jornada', comunidadId], (l) => l?.map((p) => (p.id === pacienteId ? { ...p, inasistencias: marca ? [marca] : (p.inasistencias ?? []).filter((i) => i.fecha.slice(0, 10) !== hoyYmd()) } : p)));
    const marcarNoVinoEn = async (p, motivo, tratamiento) => {
        const datos = { fecha: hoyYmd(), motivo, clienteId: nuevoId(), tratamiento };
        const dejado = tratamiento ? ` · se le dejó el tratamiento con ${conQuien(tratamiento.recibioNombre, tratamiento.recibioParentesco)}` : '';
        ajustarLista(p.id, { fecha: datos.fecha, motivo, entrega: tratamiento ? { recibioNombre: tratamiento.recibioNombre ?? null, recibioParentesco: tratamiento.recibioParentesco } : null });
        const enCola = () => agregarPendiente({
            id: datos.clienteId,
            tipo: 'no-vino',
            ruta: `/patients/${p.id}/no-vino`,
            metodo: 'POST',
            cuerpo: datos,
            resumen: { pacienteId: p.id, paciente: `${nombreCompleto(p)} · ${p.patientCode}`, detalle: `No vino (${MOTIVOS_INASISTENCIA[motivo].toLowerCase()}) el ${fecha(`${datos.fecha}T12:00:00`)}${dejado}` },
        });
        try {
            if (!navigator.onLine)
                await enCola();
            else
                await marcarNoVino(p.id, datos);
            if (tratamiento)
                cliente.invalidateQueries({ queryKey: ['medicamentos'] });
            toast.success(`${nombreCompleto(p)}: no vino (${MOTIVOS_INASISTENCIA[motivo].toLowerCase()})${dejado}`, {
                action: { label: 'Deshacer', onClick: () => void deshacerNoVino(p) },
            });
        }
        catch (e) {
            if (esFaltaDeConexion(e)) {
                await enCola();
                toast.success(`${nombreCompleto(p)}: no vino${dejado}. Se enviará al volver la señal.`);
            }
            else {
                ajustarLista(p.id, null);
                toast.error(e instanceof Error ? mensajeEntrega(e.message) : 'No se pudo marcar');
            }
        }
    };
    const deshacerNoVino = async (p) => {
        ajustarLista(p.id, null);
        // Si todavía no se había enviado, basta con sacarlo de la cola.
        const enCola = pendientes.find((x) => x.tipo === 'no-vino' && x.resumen.pacienteId === p.id);
        if (enCola)
            return descartarPendiente(enCola.id);
        const quitar = () => agregarPendiente({
            id: nuevoId(),
            tipo: 'quitar-no-vino',
            ruta: `/patients/${p.id}/no-vino/${hoyYmd()}`,
            metodo: 'DELETE',
            resumen: { pacienteId: p.id, paciente: `${nombreCompleto(p)} · ${p.patientCode}`, detalle: 'Quitar "No vino" de hoy' },
        });
        try {
            if (!navigator.onLine)
                await quitar();
            else
                await quitarNoVino(p.id, hoyYmd());
        }
        catch (e) {
            if (esFaltaDeConexion(e))
                await quitar();
            else
                toast.error(e instanceof Error ? e.message : 'No se pudo deshacer');
        }
    };
    const filas = useMemo(() => {
        const ronda = inicioRonda();
        const hoy = new Date(new Date().setHours(0, 0, 0, 0));
        const corte = corteRegulares(visitasSinVenir);
        return (lista.data ?? [])
            .map((p) => ({ p, estado: estadoDe(p, ronda, hoy, locales, corte) }))
            // Dentro de cada estado, la visita más reciente primero (los que faltan desde hace poco se recuperan más fácil).
            .sort((a, b) => ESTADOS[a.estado].orden - ESTADOS[b.estado].orden ||
            new Date(b.p.clinicalVisits[0]?.visitDate ?? 0).getTime() - new Date(a.p.clinicalVisits[0]?.visitDate ?? 0).getTime());
    }, [lista.data, locales, visitasSinVenir]);
    // Médicos que figuran como último en atender a alguien de este batey. Solo los usuarios activos van por
    // nombre; los demás (cuentas borradas o desactivadas, iniciales del Excel) se juntan como "Otros" (id 0).
    const activos = new Set((usuariosActivos.data ?? []).map((u) => u.id));
    const esOtro = (id) => usuariosActivos.data !== undefined && !activos.has(id);
    const porMedico = filas.reduce((m, { p }) => {
        if (!p.lastDoctorId)
            return m;
        const id = esOtro(p.lastDoctorId) ? 0 : p.lastDoctorId;
        m.set(id, { id, nombre: id === 0 ? 'Otros' : (p.lastDoctorNombre ?? `#${id}`), n: (m.get(id)?.n ?? 0) + 1 });
        return m;
    }, new Map());
    const medicosDelBatey = [...porMedico.values()].sort((a, b) => Number(a.id === 0) - Number(b.id === 0) || a.nombre.localeCompare(b.nombre));
    const vistos = filas.filter((f) => f.estado === 'hoy' || f.estado === 'ronda').length;
    const vistosHoy = filas.filter((f) => f.estado === 'hoy').length;
    const noVinieron = filas.filter((f) => f.estado === 'noVino').length;
    const yaNoVienen = filas.filter((f) => f.estado === 'yaNoViene').length;
    // Los regulares: la ronda se mide contra ellos, no contra todos los registrados desde 2017.
    const regulares = filas.length - yaNoVienen;
    const porVer = filas.filter((f) => f.estado !== 'hoy' && f.estado !== 'ronda' && f.estado !== 'noVino' && f.estado !== 'yaNoViene').length;
    const q = busqueda.trim().toLowerCase();
    const visibles = filas.filter(({ p, estado }) => {
        if (medico === 0 && !(p.lastDoctorId && esOtro(p.lastDoctorId)))
            return false;
        if (medico && p.lastDoctorId !== medico)
            return false;
        if (q)
            return `${p.firstName} ${p.lastName} ${p.patientCode} ${p.address ?? ''}`.toLowerCase().includes(q);
        if (filtro === 'pendientes')
            return estado !== 'hoy' && estado !== 'ronda' && estado !== 'noVino' && estado !== 'yaNoViene';
        if (filtro === 'hoy')
            return estado === 'hoy';
        if (filtro === 'novino')
            return estado === 'noVino';
        if (filtro === 'yanovienen')
            return estado === 'yaNoViene';
        return true;
    });
    return (_jsxs(_Fragment, { children: [dejar && (_jsx(DejarTratamiento, { paciente: dejar.p, motivo: dejar.motivo, alSoloNoVino: () => {
                    void marcarNoVinoEn(dejar.p, dejar.motivo);
                    setDejar(null);
                }, alDejar: (t) => {
                    void marcarNoVinoEn(dejar.p, dejar.motivo, t);
                    setDejar(null);
                }, alCancelar: () => setDejar(null) }, dejar.p.id)), _jsx(EncabezadoPagina, { titulo: "Registro en jornada" }), !comunidadId && !!hoyPlan.data?.length && (_jsxs("p", { className: "mb-4 text-sm text-tenue", children: ["Hoy hay jornada en:", ' ', hoyPlan.data.map((j, i) => (_jsxs("span", { children: [i > 0 && ', ', _jsx("button", { className: "font-medium text-tinta underline", onClick: () => {
                                    autoElegido.current = true;
                                    setParams({ batey: String(j.communityId) }, { replace: true });
                                }, children: j.community.name })] }, j.id)))] })), _jsx("section", { className: "mb-4 rounded-xl border border-borde bg-superficie p-4", children: _jsxs("div", { className: "flex flex-wrap items-center gap-x-6 gap-y-4", children: [_jsxs("label", { className: "flex w-full flex-col gap-1 sm:w-64", children: [_jsx("span", { className: "text-[13px] font-medium text-tinta/80", children: "Batey" }), _jsx(Selector, { vacio: "Elegir batey\u2026", className: "h-10", value: comunidadId ?? '', onChange: (e) => {
                                        autoElegido.current = true;
                                        setElegidoSolo(false);
                                        setParams(e.target.value ? { batey: e.target.value } : {}, { replace: true });
                                    }, opciones: (comunidades.data ?? []).filter((c) => c.isActive).map((c) => ({ value: c.id, label: c.name })) }), elegidoSolo && comunidadId && _jsx("span", { className: "text-xs text-tenue", children: planHoy ? 'Jornada de hoy. Puedes cambiarlo.' : 'El último que usaste. Puedes cambiarlo.' })] }), comunidadId && lista.data && (() => {
                            // Lo esperado en la ronda es la media alta de las últimas jornadas (las de más pacientes; ver Configuración), no todos
                            // los regulares: nunca vienen todos. Sin jornadas anteriores, los regulares.
                            const a = asistenciaJ.data?.find((x) => x.communityId === comunidadId);
                            const esperados = a?.promedio ?? regulares;
                            const detalle = a ? `Media alta de las últimas ${a.jornadas.length} (las ${a.mejores ?? 3} con más pacientes)${a.media !== undefined ? `; promedio simple ~${a.media}` : ''}: ${a.jornadas.map((j) => `${fechaCorta(j.fecha)}: ${j.pacientes}`).join(' · ')}` : undefined;
                            const superado = vistos >= esperados && esperados > 0;
                            return (_jsxs("div", { className: "min-w-56 flex-1", children: [_jsxs("p", { className: "flex flex-wrap items-baseline gap-x-2", children: [_jsx("span", { className: "tabular text-2xl font-semibold tracking-tight", children: vistos }), _jsxs("span", { className: "text-sm text-tenue", title: detalle, children: ["de ", a ? '~' : '', esperados, " esperados en la ronda"] }), _jsxs("span", { className: "tabular ml-auto text-sm text-tenue", children: [_jsx("strong", { className: "font-semibold text-tinta", children: vistosHoy }), " hoy", noVinieron > 0 && (_jsxs(_Fragment, { children: [' · ', _jsx("strong", { className: "font-semibold text-tinta", children: noVinieron }), " no vinieron"] }))] })] }), _jsx("div", { className: "mt-2 h-2 overflow-hidden rounded-full bg-black/[0.06]", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": esperados, "aria-valuenow": Math.min(vistos, esperados), "aria-label": "Vistos de los esperados en la ronda", children: _jsx("div", { className: cn('h-full rounded-full transition-[width] duration-300 ease-out', superado ? 'bg-green-600' : 'bg-marca-500'), style: { width: `${esperados ? Math.min(100, (vistos / esperados) * 100) : 0}%` } }) }), _jsxs("p", { className: "mt-1.5 text-xs text-tenue", title: `Regulares: los que se han perdido como mucho ${visitasSinVenir} visitas. Se cambia en Configuración.`, children: [a ? (_jsxs(_Fragment, { children: ["Esperados: lo que viene en un buen d\u00EDa ", _jsxs("span", { className: "hidden sm:inline", children: ["(media alta de las \u00FAltimas ", a.jornadas.length === 1 ? 'jornada' : `${a.jornadas.length} jornadas`, ")"] }), " \u00B7", ' '] })) : null, regulares, " pacientes regulares", superado && _jsx("span", { className: "font-medium text-green-700", children: " \u00B7 ya se super\u00F3 lo esperado" })] })] }));
                        })(), comunidadId && (_jsxs("div", { className: "flex w-full flex-wrap items-center gap-2 sm:w-auto", children: [_jsx(DescargarBatey, { comunidadId: comunidadId, total: lista.data?.length, enLinea: enLinea, automatica: !!pronto.data?.some((j) => j.communityId === comunidadId) }), _jsx(Boton, { variante: "secundario", className: "h-10", icono: _jsx(UserPlus, { className: "size-4" }), onClick: () => navegar(`/pacientes/nuevo?batey=${comunidadId}`), children: "Paciente nuevo" })] }))] }) }), !comunidadId ? (_jsx(Tarjeta, { children: _jsx(Vacio, { icono: _jsx(MapPin, { className: "size-8" }), titulo: "Elige el batey de la jornada", children: "Ver\u00E1s a sus pacientes activos y qui\u00E9n falta por ver en esta ronda." }) })) : (_jsxs(Tarjeta, { children: [_jsxs("div", { className: "flex flex-wrap items-center gap-3 border-b border-borde p-4", children: [_jsx("div", { className: "grid w-full grid-cols-2 gap-0.5 rounded-lg bg-black/5 p-0.5 text-sm sm:flex lg:w-auto", role: "tablist", "aria-label": "Qu\u00E9 pacientes ver", children: FILTROS.map((f) => {
                                    const n = f.valor === 'pendientes' ? porVer : f.valor === 'hoy' ? vistosHoy : f.valor === 'novino' ? noVinieron : f.valor === 'yanovienen' ? yaNoVienen : filas.length;
                                    const activo = filtro === f.valor && !q;
                                    return (_jsxs("button", { role: "tab", "aria-selected": activo, onClick: () => setFiltro(f.valor), className: cn('flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 whitespace-nowrap transition-colors', activo ? 'bg-superficie font-medium shadow-sm' : 'text-tenue hover:text-tinta'), children: [f.texto, _jsx("span", { className: cn('tabular rounded-full px-1.5 text-xs', activo ? 'bg-marca-100 text-marca-700' : 'bg-black/5'), children: n })] }, f.valor));
                                }) }), _jsxs("div", { className: "relative min-w-52 flex-1", children: [_jsx(Search, { className: "pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tenue" }), _jsx(Entrada, { value: busqueda, onChange: (e) => setBusqueda(e.target.value), placeholder: "Buscar por nombre, c\u00F3digo o casa", className: "h-10 pl-9", "aria-label": "Buscar paciente" })] }), _jsx(Selector, { className: "h-10 w-full min-w-48 sm:w-auto", vacio: "Lo atendi\u00F3: cualquiera", value: medico, onChange: (e) => setMedico(e.target.value === '' ? '' : Number(e.target.value)), opciones: medicosDelBatey.map((m) => ({ value: m.id, label: `${m.nombre} (${m.n})` })), "aria-label": "\u00DAltimo que lo atendi\u00F3" })] }), lista.isPending ? (_jsx(Cargando, {})) : lista.isError ? (_jsx(ErrorCarga, { error: lista.error })) : visibles.length === 0 ? (_jsx(Vacio, { icono: _jsx(CheckCircle2, { className: "size-8" }), titulo: q ? 'Sin coincidencias' : filtro === 'pendientes' ? 'No falta nadie por ver' : filtro === 'yanovienen' ? 'Todos siguen viniendo' : 'Nadie todavía', children: q ? 'Revisa cómo está escrito o busca por el código o la casa.' : filtro === 'pendientes' ? 'Todos los pacientes de este batey ya se vieron en la ronda.' : undefined })) : (_jsxs("ul", { className: "divide-y divide-borde", children: [filtro === 'yanovienen' && !q && (_jsxs("li", { className: "bg-fondo px-5 py-3 text-sm text-tenue", children: ["Se perdieron m\u00E1s de ", visitasSinVenir, " ", visitasSinVenir === 1 ? 'visita' : 'visitas', " (m\u00E1s de ", tiempoSinVenir(visitasSinVenir), " sin venir), as\u00ED que no cuentan como \"por ver\". Si alguno vuelve, al registrarle la visita vuelve a contar. El n\u00FAmero se cambia en Configuraci\u00F3n."] })), visibles.map(({ p, estado }) => {
                                const u = p.clinicalVisits[0];
                                const e = ESTADOS[estado];
                                const sinEnviar = locales.visitas.has(p.id);
                                // El estado solo se muestra cuando dice algo: en "Por ver" todos están pendientes.
                                const aviso = sinEnviar
                                    ? { texto: 'Registrada · sin enviar', color: '#a16207' }
                                    : estado === 'noVino'
                                        ? { texto: textoNoVino(p, locales), color: e.color }
                                        : (estado === 'sinVenir' || estado === 'yaNoViene') && u
                                            ? { texto: asistencia(u.visitDate).texto, color: asistencia(u.visitDate).masDeUnAno ? '#6b665e' : e.color }
                                            : estado === 'pendiente'
                                                ? null
                                                : { texto: e.texto, color: e.color };
                                return (_jsxs("li", { onClick: () => navegar(`/pacientes/${p.id}?volver=${encodeURIComponent(`/jornada?batey=${comunidadId}`)}`), className: "grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-fondo sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:px-5 md:grid-cols-[auto_minmax(0,1fr)_13rem_auto]", children: [_jsx(Avatar, { persona: p, foto: p.photoUrl, tamano: "size-10" }), _jsxs("div", { className: "min-w-0", children: [_jsxs("p", { className: "flex flex-wrap items-center gap-x-2 gap-y-1", children: [_jsx("span", { className: "truncate font-medium", children: nombreCompleto(p) }), aviso && _jsx(Insignia, { color: aviso.color, children: aviso.texto })] }), _jsxs("p", { className: "truncate text-xs text-tenue", children: [_jsx("span", { className: "font-mono text-tinta/70", children: p.patientCode }), " \u00B7 ", edadTexto(p), p.address && ` · Casa ${p.address}`] })] }), _jsx("div", { className: "col-span-2 col-start-1 row-start-2 pl-14 text-xs text-tenue sm:col-span-3 md:col-span-1 md:col-start-auto md:row-start-auto md:pl-0", children: u ? (_jsxs(_Fragment, { children: [_jsxs("p", { className: "flex items-center gap-2", children: [_jsx("span", { className: "tabular font-mono text-sm font-medium text-tinta", children: tensionDe(u) }), _jsx(InsigniaCategoria, { config: u.bpClassification })] }), _jsxs("p", { className: "mt-0.5 truncate", children: [fecha(u.visitDate), p.lastDoctorNombre && ` · ${p.lastDoctorNombre}`] })] })) : (_jsx("p", { children: "Primera visita" })) }), _jsxs("div", { className: "col-span-2 flex items-center gap-2 pl-14 sm:col-span-1 sm:justify-end sm:pl-0", onClick: (ev) => ev.stopPropagation(), children: [estado === 'noVino' ? (_jsx(Boton, { variante: "fantasma", className: "h-10 px-3 text-sm", onClick: () => void deshacerNoVino(p), children: "Deshacer" })) : (
                                                // Con permiso de entregar, al elegir el motivo se pregunta si se le deja el tratamiento con alguien.
                                                estado !== 'hoy' && estado !== 'ronda' && _jsx(MenuNoVino, { alElegir: (m) => (tiene('entregas.registrar') ? setDejar({ p, motivo: m }) : void marcarNoVinoEn(p, m)) })), _jsx(Boton, { variante: estado === 'hoy' || estado === 'ronda' ? 'secundario' : 'primario', className: "h-10 px-4", icono: _jsx(ClipboardPlus, { className: "size-4" }), onClick: () => navegar(`/pacientes/${p.id}/visita?volver=${encodeURIComponent(`/jornada?batey=${comunidadId}`)}`), children: estado === 'hoy' ? 'Otra' : 'Registrar' })] })] }, p.id));
                            })] }))] }))] }));
}
/** Botón "No vino" con el motivo (menú pequeño, no un formulario: es un toque en la jornada). */
function MenuNoVino({ alElegir }) {
    const [abierto, setAbierto] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        if (!abierto)
            return;
        const cerrar = (e) => !ref.current?.contains(e.target) && setAbierto(false);
        document.addEventListener('mousedown', cerrar);
        return () => document.removeEventListener('mousedown', cerrar);
    }, [abierto]);
    return (_jsxs("div", { ref: ref, className: "relative", onClick: (e) => e.stopPropagation(), children: [_jsx(Boton, { variante: "secundario", className: "h-10 px-3 text-sm whitespace-nowrap", icono: _jsx(UserX, { className: "size-3.5" }), onClick: () => setAbierto((a) => !a), "aria-expanded": abierto, children: "No vino" }), abierto && (_jsxs("ul", { className: "absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-lg border border-borde bg-superficie py-1 text-sm shadow-lg", children: [_jsx("li", { className: "px-3 py-1.5 text-xs text-tenue", children: "\u00BFPor qu\u00E9 no vino?" }), Object.keys(MOTIVOS_INASISTENCIA).map((m) => (_jsx("li", { children: _jsx("button", { className: "w-full px-3 py-2 text-left hover:bg-fondo", onClick: () => {
                                setAbierto(false);
                                alElegir(m);
                            }, children: MOTIVOS_INASISTENCIA[m] }) }, m)))] }))] }));
}
/** Deja el batey en el dispositivo para trabajar sin internet (lista, fichas y catálogos). */
/** Más de esto desde la última descarga: se vuelve a bajar sola (los datos pudieron cambiar). */
const VIGENCIA_DESCARGA_MS = 12 * 60 * 60 * 1000;
function DescargarBatey({ comunidadId, total, enLinea, automatica }) {
    const cliente = useQueryClient();
    const [avance, setAvance] = useState(null);
    const [cuando, setCuando] = useState(() => jornadasDescargadas()[comunidadId] ?? null);
    useEffect(() => setCuando(jornadasDescargadas()[comunidadId] ?? null), [comunidadId]);
    const descargar = async (sola = false) => {
        try {
            const n = await descargarJornada(cliente, comunidadId, (hechos, t) => setAvance({ hechos, total: t }));
            setCuando(new Date().toISOString());
            toast.success(sola ? `Jornada descargada sola: ${n} pacientes disponibles sin internet.` : `Listo: ${n} pacientes disponibles sin internet en este dispositivo.`);
        }
        catch (e) {
            // La descarga automática no molesta si falla: queda el botón para intentarlo a mano.
            if (!sola)
                toast.error(`No se pudo descargar: ${e instanceof Error ? e.message : 'error'}`);
        }
        finally {
            setAvance(null);
        }
    };
    // Batey con jornada hoy o mañana: se descarga solo al abrirlo (con internet), si no estaba o tiene más de 12 horas.
    const intentado = useRef(null);
    useEffect(() => {
        if (!automatica || !enLinea || avance || intentado.current === comunidadId)
            return;
        const previa = jornadasDescargadas()[comunidadId];
        if (previa && Date.now() - new Date(previa).getTime() < VIGENCIA_DESCARGA_MS)
            return;
        intentado.current = comunidadId;
        void descargar(true);
    }, [automatica, enLinea, comunidadId]); // eslint-disable-line react-hooks/exhaustive-deps
    // Un solo botón en la barra: dice si ya está listo para trabajar sin señal y lo actualiza.
    return (_jsx(Boton, { variante: "secundario", className: cn('h-10', cuando && !avance && 'border-green-200 text-green-800'), icono: cuando && !avance ? _jsx(CheckCircle2, { className: "size-4" }) : _jsx(CloudDownload, { className: "size-4" }), cargando: !!avance, disabled: !enLinea && !avance, title: cuando
            ? `Disponible sin internet · descargado el ${fechaYHora(cuando)}. Toca para actualizar.`
            : `Para trabajar sin señal en el batey, descárgalo antes de salir${total ? ` (${total} pacientes)` : ''}.`, onClick: () => void descargar(), children: avance ? `Descargando ${avance.hechos} de ${avance.total}` : cuando ? `Sin internet: listo · ${fechaYHora(cuando).split(',')[0]}` : `Descargar para usar sin internet` }));
}
