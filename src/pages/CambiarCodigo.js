import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';
import { toast } from 'sonner';
import { usePaciente } from '../api/consultas';
import { cambiarCodigoPaciente } from '../api/recursos';
import { Boton, Campo, Cargando, EncabezadoPagina, Entrada, Tarjeta, Vacio } from '../components/ui';
import { nombreCompleto } from '../lib/formato';
import { useVolver } from '../lib/navegacion';
const FORMATO = /^[A-Z]{1,6}\d{1,8}$/;
/** /pacientes/:id/codigo — caso extremo: el administrador escribe el código exacto. */
export function CambiarCodigo() {
    const id = Number(useParams().id);
    const consulta = usePaciente(id);
    const volverA = useVolver();
    const cliente = useQueryClient();
    const [codigo, setCodigo] = useState('');
    const limpio = codigo.trim().toUpperCase();
    const valido = FORMATO.test(limpio);
    const guardar = useMutation({
        mutationFn: () => cambiarCodigoPaciente(id, limpio),
        onSuccess: (r) => {
            for (const k of [['paciente'], ['pacientes'], ['jornada'], ['auditoria'], ['comunidades']])
                cliente.invalidateQueries({ queryKey: k });
            toast.success(`Código cambiado a ${r.patientCode}. El anterior quedó en Auditoría.`);
            volverA(`/pacientes/${id}`);
        },
        onError: (e) => toast.error(e.message),
    });
    if (consulta.isPending)
        return _jsx(Cargando, {});
    const p = consulta.data;
    if (!p)
        return _jsx(Vacio, { titulo: "Paciente no encontrado" });
    const prefijo = p.community?.abbreviation;
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: "Cambiar el c\u00F3digo", descripcion: nombreCompleto(p), volver: { a: `/pacientes/${id}`, texto: nombreCompleto(p) } }), _jsxs("form", { className: "max-w-xl space-y-4", onSubmit: (e) => {
                    e.preventDefault();
                    if (valido)
                        guardar.mutate();
                }, children: [_jsx(Tarjeta, { titulo: "C\u00F3digo", children: _jsxs("div", { className: "space-y-4 p-5", children: [_jsxs("p", { className: "text-sm", children: ["C\u00F3digo actual: ", _jsx("span", { className: "font-mono text-lg font-semibold", children: p.patientCode })] }), _jsx(Campo, { etiqueta: "C\u00F3digo nuevo", error: limpio && !valido ? 'Letras y luego números, por ejemplo MG1023' : undefined, ayuda: prefijo ? `Los de ${p.community?.name} empiezan por ${prefijo}.` : undefined, children: _jsx(Entrada, { autoFocus: true, maxLength: 14, autoComplete: "off", spellCheck: false, className: "h-12 font-mono text-xl tracking-wide uppercase", placeholder: prefijo ? `${prefijo}1234` : 'MG1234', value: codigo, onChange: (e) => setCodigo(e.target.value.replace(/\s/g, '')), "aria-invalid": !!limpio && !valido }) }), _jsxs("div", { className: "rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900", children: ["\u00DAsalo solo en un caso extremo, por ejemplo para que coincida con su tarjeta en papel. Si el paciente solo cambi\u00F3 de batey, usa ", _jsx("strong", { children: "Regenerar c\u00F3digo" }), " en su ficha. El c\u00F3digo anterior deja de encontrarse en el buscador y el cambio queda en Auditor\u00EDa."] })] }) }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Boton, { variante: "secundario", onClick: () => volverA(`/pacientes/${id}`), children: "Cancelar" }), _jsx(Boton, { type: "submit", icono: _jsx(Save, { className: "size-4" }), disabled: !valido || limpio === p.patientCode, cargando: guardar.isPending, children: "Guardar c\u00F3digo" })] })] })] }));
}
