import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { ArrowLeft, CalendarCheck2, ClipboardPlus, Pencil } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { usePaciente } from '../api/consultas';
import { usePermisosVisita } from '../auth/permisosVisita';
import { FormularioVisita } from '../components/FormularioVisita';
import { ymd } from '../components/SelectorFecha';
import { Boton, Cargando, EncabezadoPagina, Vacio } from '../components/ui';
import { atendio, edadTexto, nombreCompleto } from '../lib/formato';
import { usePendientes } from '../offline/cola';
import { useVolver } from '../lib/navegacion';
const HORA = new Intl.DateTimeFormat('es-DO', { hour: 'numeric', minute: '2-digit' });
/** /pacientes/:id/visita. Con ?volver=/jornada?batey=X regresa a la jornada al guardar. */
export function NuevaVisita() {
    const id = Number(useParams().id);
    const [params] = useSearchParams();
    // Solo rutas internas: evita que un enlace manipulado mande a otro sitio.
    const pedido = params.get('volver');
    const volver = pedido?.startsWith('/') && !pedido.startsWith('//') ? pedido : `/pacientes/${id}`;
    const navegar = useNavigate();
    const volverA = useVolver();
    const paciente = usePaciente(id);
    const pendientes = usePendientes();
    // Ya eligió "Registrar otra visita": no se vuelve a preguntar.
    const [otra, setOtra] = useState(false);
    if (paciente.isPending)
        return _jsx(Cargando, {});
    if (!paciente.data)
        return _jsx(Vacio, { titulo: "Paciente no encontrado" });
    const p = paciente.data;
    // ¿Ya tiene una visita hoy? En el servidor, o guardada sin internet y todavía sin enviar.
    const hoy = ymd(new Date());
    const deHoy = (p.clinicalVisits ?? []).find((v) => ymd(new Date(v.visitDate)) === hoy);
    const pendienteHoy = pendientes.find((x) => x.tipo === 'visita' && x.resumen.pacienteId === p.id && ymd(new Date(x.creado)) === hoy);
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: `Visita · ${nombreCompleto(p)}`, descripcion: _jsxs(_Fragment, { children: [_jsx("span", { className: "font-mono", children: p.patientCode }), " \u00B7 ", edadTexto(p), " \u00B7 ", p.community?.name] }), volver: { a: volver, texto: volver.startsWith('/jornada') ? 'Jornada' : nombreCompleto(p) } }), _jsx(FormularioVisita, { paciente: p, alGuardar: () => volverA(volver) }), !otra && (deHoy || pendienteHoy) && (_jsx(AvisoVisitaHoy, { paciente: p, visita: deHoy, sinEnviar: !deHoy && !!pendienteHoy, alEditar: (visitaId) => navegar(`/visitas/${visitaId}/editar`, { replace: true }), alRegistrarOtra: () => setOtra(true), alVolver: () => navegar(volver, { replace: true }) }))] }));
}
/**
 * Ya se le registró una visita hoy: casi siempre es un toque doble o alguien que no sabía.
 * Se pregunta antes de llenar nada: corregir la de hoy, registrar otra de verdad, o volver.
 */
function AvisoVisitaHoy({ paciente, visita, sinEnviar, alEditar, alRegistrarOtra, alVolver, }) {
    const ref = useRef(null);
    const permisos = usePermisosVisita();
    const puedeEditar = !!visita && permisos.puedeEditar(visita);
    useEffect(() => {
        const d = ref.current;
        if (d && !d.open)
            d.showModal();
    }, []);
    const s = visita && (visita.systolicManual ?? visita.systolicAuto);
    const d = visita && (visita.diastolicManual ?? visita.diastolicAuto);
    return (_jsx("dialog", { ref: ref, 
        // Escape = lo más seguro: volver sin registrar nada.
        onCancel: (e) => {
            e.preventDefault();
            alVolver();
        }, className: "m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-borde bg-superficie p-0 text-tinta shadow-2xl backdrop:bg-tinta/40 backdrop:backdrop-blur-[2px]", "aria-labelledby": "visita-hoy-titulo", children: _jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "flex gap-4", children: [_jsx("span", { className: "grid size-10 shrink-0 place-items-center rounded-full bg-marca-100 text-marca-700", children: _jsx(CalendarCheck2, { className: "size-5" }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("h2", { id: "visita-hoy-titulo", className: "font-semibold text-balance", children: [nombreCompleto(paciente), " ya tiene una visita hoy"] }), visita ? (_jsxs("dl", { className: "mt-3 space-y-1 rounded-lg bg-fondo px-3 py-2.5 text-sm", children: [_jsxs("div", { className: "flex justify-between gap-3", children: [_jsx("dt", { className: "text-tenue", children: "Registrada" }), _jsxs("dd", { children: ["a las ", HORA.format(new Date(visita.createdAt ?? visita.visitDate))] })] }), _jsxs("div", { className: "flex justify-between gap-3", children: [_jsx("dt", { className: "text-tenue", children: "Atendi\u00F3" }), _jsx("dd", { className: "truncate", children: atendio(visita) })] }), _jsxs("div", { className: "flex justify-between gap-3", children: [_jsx("dt", { className: "text-tenue", children: "Presi\u00F3n" }), _jsx("dd", { className: "tabular font-mono", children: s && d ? `${s}/${d}` : 'sin toma' })] })] })) : (_jsx("p", { className: "mt-1.5 text-sm text-tenue", children: "Se guard\u00F3 en esta tableta sin internet y se enviar\u00E1 sola cuando vuelva la conexi\u00F3n." })), _jsx("p", { className: "mt-3 text-sm text-tenue", children: puedeEditar
                                        ? 'Si hay que cambiar algo, corrige esa visita. Registra otra solo si de verdad volvió a consulta hoy.'
                                        : sinEnviar
                                            ? 'Registra otra solo si de verdad volvió a consulta hoy.'
                                            : 'Registra otra solo si de verdad volvió a consulta hoy. Para corregir la de hoy, pídeselo a quien la registró o a un administrador.' })] })] }), _jsxs("div", { className: "mt-6 flex flex-col gap-2", children: [puedeEditar && (_jsx(Boton, { className: "h-11 w-full", icono: _jsx(Pencil, { className: "size-4" }), onClick: () => alEditar(visita.id), autoFocus: true, children: "Corregir la visita de hoy" })), _jsx(Boton, { variante: puedeEditar ? 'secundario' : 'primario', className: "h-11 w-full", icono: _jsx(ClipboardPlus, { className: "size-4" }), onClick: alRegistrarOtra, autoFocus: !puedeEditar, children: "Registrar otra visita" }), _jsx(Boton, { variante: "fantasma", className: "h-11 w-full", icono: _jsx(ArrowLeft, { className: "size-4" }), onClick: alVolver, children: "Volver" })] })] }) }));
}
