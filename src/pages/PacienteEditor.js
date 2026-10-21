import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { ClipboardPlus } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useComunidades, usePaciente } from '../api/consultas';
import { useConfirmar } from '../components/confirmar';
import { FormularioPaciente } from '../components/FormularioPaciente';
import { Cargando, EncabezadoPagina, Vacio } from '../components/ui';
import { nombreCompleto } from '../lib/formato';
/**
 * /pacientes/nuevo y /pacientes/:id/editar.
 * Desde la jornada llega con ?batey=X: el paciente nuevo queda en ese batey y se pasa directo a su visita.
 * Desde Pacientes, al guardar uno nuevo se pregunta si se registra ya su primera visita.
 */
export function PacienteEditor() {
    const id = Number(useParams().id) || undefined;
    const [params] = useSearchParams();
    const batey = Number(params.get('batey')) || undefined;
    const navegar = useNavigate();
    const paciente = usePaciente(id);
    const comunidades = useComunidades();
    const confirmar = useConfirmar();
    // El <select> de batey necesita sus opciones al montarse.
    if ((id && paciente.isPending) || !comunidades.data)
        return _jsx(Cargando, {});
    if (id && !paciente.data)
        return _jsx(Vacio, { titulo: "Paciente no encontrado" });
    const p = paciente.data ?? undefined;
    const nombreBatey = comunidades.data?.find((c) => c.id === batey)?.name;
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: p ? `Editar a ${nombreCompleto(p)}` : nombreBatey ? `Paciente nuevo en ${nombreBatey}` : 'Paciente nuevo', volver: p ? { a: `/pacientes/${p.id}`, texto: nombreCompleto(p) } : batey ? { a: `/jornada?batey=${batey}`, texto: 'Jornada' } : { a: '/pacientes', texto: 'Pacientes' } }), _jsx(FormularioPaciente, { paciente: p, comunidadInicial: batey, alTerminar: async (nuevo) => {
                    if (p)
                        return navegar(`/pacientes/${nuevo.id}`, { replace: true });
                    if (batey)
                        return navegar(`/pacientes/${nuevo.id}/visita?volver=${encodeURIComponent(`/jornada?batey=${batey}`)}`, { replace: true });
                    const ahora = await confirmar({
                        titulo: `¿Registrar la primera visita de ${nombreCompleto(nuevo)}?`,
                        mensaje: _jsxs("p", { children: ["Qued\u00F3 registrado con el c\u00F3digo ", _jsx("strong", { className: "font-mono text-tinta", children: nuevo.patientCode }), ". Si lo est\u00E1s viendo ahora, anota su presi\u00F3n y sus medicamentos."] }),
                        confirmar: 'Registrar primera visita',
                        cancelar: 'Ahora no',
                        peligro: false,
                        icono: _jsx(ClipboardPlus, { className: "size-5" }),
                    });
                    navegar(ahora ? `/pacientes/${nuevo.id}/visita` : `/pacientes/${nuevo.id}`, { replace: true });
                } })] }));
}
