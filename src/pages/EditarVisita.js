import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Lock, Trash2 } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router';
import { useUsuarios, useVisita } from '../api/consultas';
import { usePermisosVisita } from '../auth/permisosVisita';
import { useSesion } from '../auth/sesion';
import { useEliminarVisita } from '../components/eliminarVisita';
import { FormularioVisita } from '../components/FormularioVisita';
import { Boton, Cargando, EncabezadoPagina, Vacio } from '../components/ui';
import { atendio, edadTexto, fecha, fechaYHora, nombreCompleto } from '../lib/formato';
import { useVolver } from '../lib/navegacion';
/** /visitas/:id/editar — médico: las suyas dentro del plazo; administrador: cualquiera. */
export function EditarVisita() {
    const id = Number(useParams().id);
    const consulta = useVisita(id);
    const permisos = usePermisosVisita();
    if (consulta.isPending)
        return _jsx(Cargando, {});
    if (!consulta.data)
        return _jsx(Vacio, { titulo: "Visita no encontrada", children: "Puede que se haya eliminado." });
    if (!permisos.puedeEditar(consulta.data)) {
        return (_jsxs(Vacio, { icono: _jsx(Lock, { className: "size-8" }), titulo: "No puedes editar esta visita", children: ["Los m\u00E9dicos corrigen solo las visitas que atendieron, durante ", permisos.horas, " horas desde que se registraron. Pide a un administrador que la corrija."] }));
    }
    return _jsx(Formulario, { visita: consulta.data });
}
function Formulario({ visita }) {
    const volverA = useVolver();
    const [params] = useSearchParams();
    const pedido = params.get('volver');
    const volver = pedido?.startsWith('/') && !pedido.startsWith('//') ? pedido : `/pacientes/${visita.patientId}`;
    const { tiene } = useSesion();
    const permisos = usePermisosVisita();
    const esAdmin = permisos.puedeEliminar;
    const usuarios = useUsuarios();
    const eliminar = useEliminarVisita(() => volverA(volver));
    const hasta = permisos.editableHasta(visita);
    const p = visita.patient;
    // Cambiar quién atendió: solo la administración.
    const medicos = esAdmin && tiene('usuarios.gestionar') ? (usuarios.data?.data ?? []).map((u) => ({ value: u.id, label: `${nombreCompleto(u)}${u.isActive ? '' : ' (inactivo)'}` })) : undefined;
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: `Editar visita del ${fecha(visita.visitDate)}`, descripcion: _jsxs(_Fragment, { children: [nombreCompleto(p), " \u00B7 ", _jsx("span", { className: "font-mono", children: p.patientCode }), " \u00B7 ", edadTexto(p), " \u00B7 atendi\u00F3 ", atendio(visita)] }), volver: { a: volver, texto: volver.startsWith('/visitas') ? 'Visitas' : nombreCompleto(p) }, acciones: esAdmin && (_jsx(Boton, { variante: "secundario", className: "hover:text-red-600", icono: _jsx(Trash2, { className: "size-4" }), onClick: () => eliminar({ ...visita, patient: p }), children: "Eliminar visita" })) }), hasta && (_jsxs("p", { className: "mb-4 rounded-lg bg-marca-50 px-4 py-2.5 text-sm", children: ["Puedes corregir esta visita hasta el ", _jsx("strong", { children: fechaYHora(hasta.toISOString()) }), ". Despu\u00E9s, solo un administrador."] })), medicos && usuarios.isPending ? _jsx(Cargando, {}) : _jsx(FormularioVisita, { paciente: p, visita: visita, medicos: medicos, alGuardar: () => volverA(volver) })] }));
}
