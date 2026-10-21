import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, PackageCheck, Pill, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useComunidades } from '../api/consultas';
import { useSesion } from '../auth/sesion';
import { entregarPendientes, entregasDeHoy, pendientesDeEntrega } from '../api/recursos';
import { Avatar, Boton, Cargando, EncabezadoPagina, Entrada, ErrorCarga, Insignia, Selector, Tarjeta, Vacio } from '../components/ui';
import { cantidadSugerida, mensajeEntrega } from '../lib/entregas';
import { RECIBIO_ENTREGA } from '../lib/etiquetas';
import { cn, fecha, nombreCompleto } from '../lib/formato';
import { agregarPendiente, esFaltaDeConexion, nuevoId, usePendientes } from '../offline/cola';
const hora = new Intl.DateTimeFormat('es-DO', { timeStyle: 'short' });
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
/** /entregas — la mesa de farmacia del batey: lo que falta por entregar a cada paciente. */
export function Entregas() {
    const [params, setParams] = useSearchParams();
    const idPedido = Number(params.get('batey')) || undefined;
    const [busqueda, setBusqueda] = useState('');
    const [vista, setVista] = useState('pendientes');
    const cliente = useQueryClient();
    const { tiene } = useSesion();
    const comunidades = useComunidades();
    // Un enlace viejo puede traer un batey que ya no existe: se trata como "Todos".
    const comunidadId = comunidades.data?.some((c) => c.id === idPedido) ? idPedido : undefined;
    const clave = ['entregas', 'pendientes', comunidadId ?? null];
    const lista = useQuery({ queryKey: clave, queryFn: () => pendientesDeEntrega(comunidadId) });
    const hoy = useQuery({ queryKey: ['entregas', 'hoy', comunidadId ?? null], queryFn: () => entregasDeHoy(comunidadId) });
    const enCola = usePendientes();
    const locales = useMemo(() => {
        const porReceta = new Map();
        const pacientes = new Set();
        // Los que el servidor rechazó no se descuentan: quedan para revisarlos en Sincronización.
        for (const x of enCola) {
            if (x.tipo !== 'entrega' || x.error)
                continue;
            pacientes.add(x.resumen.pacienteId);
            for (const i of x.cuerpo.items)
                porReceta.set(i.prescriptionId, (porReceta.get(i.prescriptionId) ?? 0) + i.cantidad);
        }
        return { porReceta, pacientes };
    }, [enCola]);
    // Lo pendiente y la existencia, descontando lo que espera en la cola.
    const { filas, existencia } = useMemo(() => {
        const ex = { ...(lista.data?.existencia ?? {}) };
        const filas = (lista.data?.pacientes ?? []).map((pc) => ({
            ...pc,
            recetas: pc.recetas
                .map((r) => {
                const local = locales.porReceta.get(r.id) ?? 0;
                if (local)
                    ex[r.medicamento.id] = Math.max(0, (ex[r.medicamento.id] ?? 0) - local);
                return { ...r, entregada: r.entregada + local, pendiente: Math.max(0, r.pendiente - local) };
            })
                .filter((r) => r.pendiente > 0),
        }));
        return { filas, existencia: ex };
    }, [lista.data, locales]);
    // Sigue a la vista quien ya se entregó sin internet: así se nota que quedó "sin enviar".
    const porEntregar = filas.filter((pc) => pc.recetas.length || locales.pacientes.has(pc.paciente.id));
    const q = busqueda.trim().toLowerCase();
    const coincide = (p) => !q || `${p.firstName} ${p.lastName} ${p.patientCode} ${p.address ?? ''}`.toLowerCase().includes(q);
    const visibles = porEntregar.filter((pc) => coincide(pc.paciente));
    const deHoy = (hoy.data ?? []).filter((e) => !e.patient || coincide(e.patient));
    const volver = encodeURIComponent(`/entregas${comunidadId ? `?batey=${comunidadId}` : ''}`);
    /** Resta lo entregado de la lista guardada: la fila cambia al instante, sin esperar a recargar. */
    const descontar = (pacienteId, items, pc) => cliente.setQueryData(clave, (d) => {
        if (!d)
            return d;
        const ex = { ...d.existencia };
        for (const i of items) {
            const med = pc.recetas.find((r) => r.id === i.prescriptionId)?.medicamento.id;
            if (med !== undefined && ex[med] !== undefined)
                ex[med] = Math.max(0, ex[med] - i.cantidad);
        }
        const pacientes = d.pacientes
            .map((x) => x.paciente.id !== pacienteId
            ? x
            : {
                ...x,
                recetas: x.recetas
                    .map((r) => {
                    const c = items.find((i) => i.prescriptionId === r.id)?.cantidad ?? 0;
                    return { ...r, entregada: r.entregada + c, pendiente: r.pendiente - c };
                })
                    .filter((r) => r.pendiente > 0),
            })
            .filter((x) => x.recetas.length);
        return { pacientes, existencia: ex };
    });
    const entregar = async (pc, datos, quedan) => {
        const p = pc.paciente;
        const cuerpo = { ...datos, clienteId: nuevoId(), patientId: p.id };
        const total = datos.items.reduce((s, i) => s + i.cantidad, 0);
        const resto = quedan ? ` Quedan ${plural(quedan, 'pastilla pendiente', 'pastillas pendientes')}.` : '';
        const guardarEnCola = async () => {
            await agregarPendiente({
                id: cuerpo.clienteId,
                tipo: 'entrega',
                ruta: '/entregas',
                metodo: 'POST',
                cuerpo,
                resumen: { pacienteId: p.id, paciente: `${nombreCompleto(p)} · ${p.patientCode}`, detalle: `Entrega de ${plural(total, 'pastilla', 'pastillas')}` },
            });
            toast.success(`Entregado a ${nombreCompleto(p)}. Sin conexión: se enviará al volver la señal.${resto}`);
            return true;
        };
        if (!navigator.onLine)
            return guardarEnCola();
        try {
            await entregarPendientes(cuerpo);
            descontar(p.id, datos.items, pc);
            for (const k of [['entregas'], ['paciente', p.id], ['medicamentos']])
                void cliente.invalidateQueries({ queryKey: k });
            toast.success(`Entregado a ${nombreCompleto(p)}.${resto}`);
            return true;
        }
        catch (e) {
            if (esFaltaDeConexion(e))
                return guardarEnCola();
            // La receta pudo cambiar (otra mesa entregó, o hubo una consulta nueva): se recarga la lista.
            void cliente.invalidateQueries({ queryKey: ['entregas', 'pendientes'] });
            toast.error(mensajeEntrega(e instanceof Error ? e.message : 'No se pudo entregar'));
            return false;
        }
    };
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: "Entregas de medicamentos", descripcion: "La mesa de farmacia: lo que falta por entregar a cada paciente.", acciones: tiene('reportes.ver') && (_jsxs(Link, { to: "/reportes/entregas", className: "inline-flex h-9 items-center gap-2 rounded-lg border border-borde bg-superficie px-3.5 text-sm font-medium hover:bg-fondo", children: [_jsx(BarChart3, { className: "size-4" }), " Ver reporte"] })) }), _jsx("div", { className: "mb-4 flex flex-wrap items-end gap-3", children: _jsxs("label", { className: "flex min-w-60 flex-col gap-1.5", children: [_jsx("span", { className: "text-[13px] font-medium text-tinta/80", children: "Batey" }), _jsx(Selector, { vacio: "Todos los bateyes", value: comunidadId ?? '', onChange: (e) => setParams(e.target.value ? { batey: e.target.value } : {}, { replace: true }), opciones: (comunidades.data ?? []).filter((c) => c.isActive).map((c) => ({ value: c.id, label: c.name })) })] }) }), _jsxs(Tarjeta, { children: [_jsxs("div", { className: "flex flex-wrap items-center gap-3 border-b border-borde p-4", children: [_jsxs("div", { className: "relative min-w-52 flex-1", children: [_jsx(Search, { className: "pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tenue" }), _jsx(Entrada, { value: busqueda, onChange: (e) => setBusqueda(e.target.value), placeholder: "Nombre, c\u00F3digo o casa", className: "h-10 pl-9 xl:h-9" })] }), _jsx("div", { className: "flex rounded-lg bg-black/5 p-0.5 text-sm", children: [
                                    ['pendientes', `Por entregar (${porEntregar.length})`],
                                    ['hoy', `Entregadas hoy (${hoy.data?.length ?? 0})`],
                                ].map(([v, texto]) => (_jsx("button", { onClick: () => setVista(v), className: cn('rounded-md px-3 py-2 xl:py-1.5', vista === v ? 'bg-superficie font-medium shadow-sm' : 'text-tenue hover:text-tinta'), children: texto }, v))) })] }), vista === 'pendientes' ? (lista.isPending ? (_jsx(Cargando, {})) : lista.isError ? (_jsx(ErrorCarga, { error: lista.error })) : visibles.length === 0 ? (q ? (_jsx(Vacio, { icono: _jsx(Search, { className: "size-8" }), titulo: "Sin coincidencias" })) : (_jsx(Vacio, { icono: _jsx(PackageCheck, { className: "size-8" }), titulo: "Nada por entregar", children: "Todos los medicamentos recetados ya se entregaron." }))) : (_jsx("ul", { className: "divide-y divide-borde", children: visibles.map((pc) => (_jsx(FilaPaciente, { pc: pc, existencia: existencia, sinEnviar: locales.pacientes.has(pc.paciente.id), enlace: `/pacientes/${pc.paciente.id}?volver=${volver}`, alEntregar: entregar }, pc.paciente.id))) }))) : hoy.isPending ? (_jsx(Cargando, {})) : hoy.isError ? (_jsx(ErrorCarga, { error: hoy.error })) : deHoy.length === 0 ? (_jsx(Vacio, { icono: _jsx(Pill, { className: "size-8" }), titulo: q ? 'Sin coincidencias' : 'Nada entregado hoy todavía' })) : (_jsx("ul", { className: "divide-y divide-borde", children: deHoy.map((e) => (_jsxs("li", { className: "flex flex-wrap items-start gap-x-4 gap-y-1 px-5 py-3 text-sm xl:flex-nowrap", children: [_jsx("span", { className: "tabular w-20 shrink-0 font-mono whitespace-nowrap text-tenue", children: hora.format(new Date(e.createdAt)) }), _jsxs("div", { className: "min-w-0 flex-1 basis-[calc(100%-5rem)] xl:basis-0", children: [e.patient ? (_jsx(Link, { to: `/pacientes/${e.patient.id}?volver=${volver}`, className: "font-medium hover:underline", children: nombreCompleto(e.patient) })) : (_jsxs("span", { className: "font-medium", children: ["Paciente #", e.patientId] })), e.patient && _jsx("span", { className: "ml-1.5 font-mono text-xs text-tenue", children: e.patient.patientCode }), e.tipo === 'REPOSICION' && (_jsx(Insignia, { color: "#7a5c00", className: "ml-2", children: "Reposici\u00F3n" })), _jsx("p", { className: "text-tinta/80", children: e.items.map((i) => `${i.medication ? `${i.medication.name} ${i.medication.concentration}` : `#${i.medicationId}`}: ${i.cantidad}`).join(' · ') })] }), _jsxs("div", { className: "ml-20 text-xs text-tenue xl:ml-0 xl:w-56 xl:text-right", children: [_jsxs("p", { children: ["Recibi\u00F3: ", e.recibio === 'PACIENTE' ? 'el paciente' : (e.recibioNombre ?? RECIBIO_ENTREGA[e.recibio].toLowerCase())] }), e.entregadoPorNombre && _jsxs("p", { className: "truncate", children: ["Entreg\u00F3 ", e.entregadoPorNombre] })] })] }, e.id))) }))] })] }));
}
/** Un paciente en la mesa: sus recetas con lo que falta, cuánto se le da ahora y quién lo recibe. */
function FilaPaciente({ pc, existencia, sinEnviar, enlace, alEntregar, }) {
    const p = pc.paciente;
    // Solo se guarda lo que la persona cambió; lo demás sigue a lo pendiente y a la existencia (que baja con cada entrega).
    const [cambios, setCambios] = useState({});
    const [recibio, setRecibio] = useState('PACIENTE');
    const [nombre, setNombre] = useState('');
    const [enviando, setEnviando] = useState(false);
    const valor = (r) => cambios[r.id] ?? String(cantidadSugerida(r.pendiente, existencia[r.medicamento.id]));
    const items = pc.recetas.map((r) => ({ r, cantidad: Math.floor(Number(valor(r)) || 0) }));
    const fuera = items.some(({ r, cantidad }) => cantidad < 0 || cantidad > r.pendiente);
    const total = items.reduce((s, i) => s + Math.max(0, i.cantidad), 0);
    const entregar = async () => {
        setEnviando(true);
        const ok = await alEntregar(pc, {
            items: items.filter((i) => i.cantidad > 0).map((i) => ({ prescriptionId: i.r.id, cantidad: i.cantidad })),
            recibio,
            recibioNombre: recibio !== 'PACIENTE' ? nombre.trim() || undefined : undefined,
        }, items.reduce((s, i) => s + i.r.pendiente - i.cantidad, 0));
        setEnviando(false);
        if (ok)
            setCambios({});
    };
    return (_jsxs("li", { className: "space-y-3 px-5 py-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Avatar, { persona: p, foto: p.photoUrl }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx(Link, { to: enlace, className: "block truncate font-medium hover:underline", children: nombreCompleto(p) }), _jsxs("p", { className: "truncate text-xs text-tenue", children: [_jsx("span", { className: "font-mono", children: p.patientCode }), p.address && ` · Casa ${p.address}`] })] }), sinEnviar && _jsx(Insignia, { color: "#a16207", children: "Registrada \u00B7 sin enviar" })] }), pc.recetas.length > 0 && (_jsxs(_Fragment, { children: [_jsx("ul", { className: "space-y-2 sm:ml-12", children: items.map(({ r }) => {
                            const hay = existencia[r.medicamento.id];
                            return (_jsxs("li", { className: "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-fondo px-3 py-2.5 xl:flex-nowrap", children: [_jsxs("div", { className: "min-w-0 flex-1 basis-full xl:basis-0", children: [_jsxs("p", { className: "text-sm font-medium", children: [r.medicamento.name, " ", r.medicamento.concentration] }), _jsxs("p", { className: "text-xs text-tenue", children: ["Indicadas ", r.indicada, " \u00B7 entregadas ", r.entregada, " \u00B7 ", _jsxs("strong", { className: "text-tinta", children: ["faltan ", r.pendiente] })] }), _jsxs("p", { className: "truncate text-xs text-tenue", children: ["Visita del ", fecha(r.visitaFecha), r.atendio && ` · Atendió ${r.atendio}`] })] }), hay !== undefined && hay < r.pendiente && _jsxs("span", { className: "text-xs font-medium text-red-600", children: ["Hay ", hay] }), _jsxs("label", { className: "ml-auto flex items-center gap-2 text-sm xl:ml-0", children: [_jsx("span", { className: "text-[13px] font-medium text-tinta/80", children: "Entregar" }), _jsx(Entrada, { type: "number", inputMode: "numeric", min: 0, max: r.pendiente, className: "h-10 w-24 text-right xl:h-9", value: valor(r), "aria-invalid": Number(valor(r)) > r.pendiente || Number(valor(r)) < 0, onChange: (e) => setCambios((c) => ({ ...c, [r.id]: e.target.value })) })] })] }, r.id));
                        }) }), _jsxs("div", { className: "flex flex-wrap items-center gap-3 sm:ml-12", children: [_jsx(QuienRecibe, { valor: recibio, alCambiar: setRecibio }), recibio !== 'PACIENTE' && (_jsx(Entrada, { className: "h-10 w-48 xl:h-9", maxLength: 120, placeholder: "Nombre (opcional)", "aria-label": "Nombre de quien recibe", value: nombre, onChange: (e) => setNombre(e.target.value) })), _jsx(Boton, { className: "ml-auto h-10 px-4 xl:h-9", icono: _jsx(PackageCheck, { className: "size-4" }), disabled: !total || fuera, cargando: enviando, onClick: () => void entregar(), children: "Entregar" })] }), fuera && _jsx("p", { className: "text-xs text-red-600 sm:ml-12", children: "No se puede entregar m\u00E1s de lo que falta." })] }))] }));
}
const QUIEN = { PACIENTE: 'Paciente', FAMILIAR: 'Familiar', OTRO: 'Otra persona' };
/** Quién se lleva las pastillas: tres toques, sin abrir nada. */
export function QuienRecibe({ valor, alCambiar }) {
    return (_jsxs("div", { className: "flex items-center gap-2 text-sm", children: [_jsx("span", { className: "text-[13px] font-medium text-tinta/80", children: "Recibi\u00F3" }), _jsx("div", { className: "flex rounded-lg bg-black/5 p-0.5", role: "radiogroup", "aria-label": "Qui\u00E9n recibe", children: Object.keys(QUIEN).map((k) => (_jsx("button", { type: "button", role: "radio", "aria-checked": valor === k, onClick: () => alCambiar(k), className: cn('rounded-md px-3 py-2 xl:py-1.5', valor === k ? 'bg-superficie font-medium shadow-sm' : 'text-tenue hover:text-tinta'), children: QUIEN[k] }, k))) })] }));
}
