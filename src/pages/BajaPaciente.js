import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserX } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { usePaciente } from '../api/consultas';
import { darDeBaja } from '../api/recursos';
import { AreaTexto, Boton, Campo, Cargando, EncabezadoPagina, Tarjeta, Vacio } from '../components/ui';
import { MOTIVOS_BAJA } from '../lib/etiquetas';
import { cn, edadTexto, fecha, nombreCompleto } from '../lib/formato';
import { SelectorFecha } from '../components/SelectorFecha';
import { useVolver } from '../lib/navegacion';
const AYUDA = {
    FALLECIDO: 'Causa, si se conoce (infarto, ACV, otra enfermedad, accidente…)',
    MUDANZA: 'A dónde se mudó, si se sabe',
    ABANDONO: 'Por qué dejó de venir, si lo dijo',
    TRASLADO: 'A qué programa, clínica u hospital',
    OTRO: 'Explica el motivo',
};
const hoyIso = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** /pacientes/:id/baja — registra fallecimiento, mudanza, abandono… con fecha y motivo. */
export function BajaPaciente() {
    const id = Number(useParams().id);
    const consulta = usePaciente(id);
    const navegar = useNavigate();
    const volverA = useVolver();
    const cliente = useQueryClient();
    const [motivo, setMotivo] = useState('');
    const [fechaBaja, setFechaBaja] = useState(hoyIso());
    const [detalle, setDetalle] = useState('');
    const guardar = useMutation({
        mutationFn: () => darDeBaja(id, { motivo: motivo, fecha: fechaBaja, detalle: detalle.trim() || undefined }),
        onSuccess: () => {
            for (const k of [['paciente'], ['pacientes'], ['jornada'], ['jornadas'], ['stats'], ['auditoria'], ['metas']])
                cliente.invalidateQueries({ queryKey: k });
            toast.success(motivo === 'FALLECIDO' ? 'Fallecimiento registrado.' : 'Baja registrada.');
            volverA(`/pacientes/${id}`);
        },
        onError: (e) => toast.error(e.message),
    });
    if (consulta.isPending)
        return _jsx(Cargando, {});
    const p = consulta.data;
    if (!p)
        return _jsx(Vacio, { titulo: "Paciente no encontrado" });
    if (p.status !== 'ACTIVE')
        return _jsx(Vacio, { titulo: "Este paciente ya est\u00E1 dado de baja", children: "Si volvi\u00F3, usa \"Reactivar\" en su ficha." });
    const ultima = p.clinicalVisits?.[0];
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: "Dar de baja", descripcion: _jsxs(_Fragment, { children: [nombreCompleto(p), " \u00B7 ", _jsx("span", { className: "font-mono", children: p.patientCode }), " \u00B7 ", edadTexto(p), " \u00B7 ", p.community?.name, ultima && ` · última visita el ${fecha(ultima.visitDate)}`] }), volver: { a: `/pacientes/${id}`, texto: nombreCompleto(p) } }), _jsxs("div", { className: "max-w-2xl space-y-4", children: [_jsx(Tarjeta, { titulo: "Motivo", children: _jsx("div", { className: "grid gap-2 p-5 sm:grid-cols-2", children: Object.keys(MOTIVOS_BAJA).map((m) => (_jsxs("label", { className: cn('flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm', motivo === m ? 'border-tinta bg-marca-50 font-medium' : 'border-borde hover:bg-fondo'), children: [_jsx("input", { type: "radio", name: "motivo", className: "accent-tinta", checked: motivo === m, onChange: () => setMotivo(m) }), MOTIVOS_BAJA[m]] }, m))) }) }), motivo && (_jsxs(Tarjeta, { titulo: "Detalle", children: [_jsxs("div", { className: "grid gap-4 p-5 sm:grid-cols-[200px_minmax(0,1fr)]", children: [_jsx(Campo, { etiqueta: motivo === 'FALLECIDO' ? 'Fecha del fallecimiento' : 'Fecha de la baja', ayuda: "Aproximada, si no se sabe el d\u00EDa", children: _jsx(SelectorFecha, { corto: true, max: hoyIso(), value: fechaBaja, onChange: setFechaBaja }) }), _jsx(Campo, { etiqueta: motivo === 'FALLECIDO' ? 'Causa' : 'Detalle', ayuda: AYUDA[motivo], children: _jsx(AreaTexto, { rows: 3, maxLength: 500, value: detalle, onChange: (e) => setDetalle(e.target.value) }) })] }), _jsx("p", { className: "border-t border-borde px-5 py-3 text-sm text-tenue", children: "Sale de las listas de jornada y de los pendientes de la ronda, pero conserva todo su historial. Si vuelve, se puede reactivar. Queda en Auditor\u00EDa." })] })), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Boton, { variante: "secundario", onClick: () => navegar(-1), children: "Cancelar" }), _jsx(Boton, { variante: "peligro", icono: _jsx(UserX, { className: "size-4" }), disabled: !motivo || !fechaBaja, cargando: guardar.isPending, onClick: () => guardar.mutate(), children: motivo === 'FALLECIDO' ? 'Registrar fallecimiento' : 'Dar de baja' })] })] })] }));
}
