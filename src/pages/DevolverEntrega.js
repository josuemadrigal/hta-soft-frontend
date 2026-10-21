import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Undo2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { devolverEntrega, obtenerEntrega } from '../api/recursos';
import { AreaTexto, Boton, Campo, Cargando, EncabezadoPagina, Entrada, ErrorCarga, Tarjeta, Vacio } from '../components/ui';
import { DESTINOS_DEVOLUCION, MOTIVOS_DEVOLUCION } from '../lib/etiquetas';
import { cn, fecha } from '../lib/formato';
import { useEnLinea } from '../offline/datos';
import { useVolver } from '../lib/navegacion';
/** /entregas/:id/devolver — corregir una entrega o registrar lo que el paciente devolvió. */
export function DevolverEntrega() {
    const id = Number(useParams().id);
    const consulta = useQuery({ queryKey: ['entregas', 'entrega', id], queryFn: () => obtenerEntrega(id) });
    const navegar = useNavigate();
    const volverA = useVolver();
    const cliente = useQueryClient();
    const enLinea = useEnLinea();
    const [motivo, setMotivo] = useState('');
    const [destino, setDestino] = useState('INVENTARIO');
    const [cantidades, setCantidades] = useState({});
    const [nota, setNota] = useState('');
    const e = consulta.data;
    const guardar = useMutation({
        mutationFn: () => devolverEntrega(id, {
            motivo: motivo,
            // Una corrección siempre vuelve al inventario: las pastillas nunca salieron.
            destino: motivo === 'CORRECCION' ? 'INVENTARIO' : destino,
            nota: nota.trim() || undefined,
            items: Object.entries(cantidades)
                .filter(([, c]) => Number(c) > 0)
                .map(([itemId, c]) => ({ entregaItemId: Number(itemId), cantidad: Number(c) })),
        }),
        onSuccess: () => {
            for (const k of [['entregas'], ['paciente', e.patientId], ['medicamentos'], ['auditoria']])
                cliente.invalidateQueries({ queryKey: k });
            toast.success(motivo === 'CORRECCION' ? 'Entrega corregida. Lo que faltaba quedó pendiente otra vez.' : destino === 'DESCARTE' ? 'Devolución registrada: las pastillas se descartaron.' : 'Devolución registrada: las pastillas volvieron al inventario.');
            volverA(`/pacientes/${e.patientId}`);
        },
        onError: (err) => toast.error(err.message),
    });
    if (consulta.isPending)
        return _jsx(Cargando, {});
    if (consulta.isError)
        return _jsx(ErrorCarga, { error: consulta.error });
    if (!e)
        return _jsx(Vacio, { titulo: "Entrega no encontrada" });
    const devolvibles = e.items.filter((i) => (i.devolvible ?? 0) > 0);
    const nombre = `${e.patient.firstName} ${e.patient.lastName}`.trim();
    const total = Object.values(cantidades).reduce((a, c) => a + (Number(c) || 0), 0);
    const excede = e.items.some((i) => Number(cantidades[i.id] ?? 0) > (i.devolvible ?? 0));
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: "Devolver o corregir una entrega", descripcion: `${nombre} · ${e.patient.patientCode} · ${e.tipo === 'REPOSICION' ? 'reposición' : 'entrega'} del ${fecha(e.fecha)}${e.entregadoPorNombre ? ` · entregó ${e.entregadoPorNombre}` : ''}`, volver: { a: `/pacientes/${e.patientId}`, texto: nombre } }), devolvibles.length === 0 ? (_jsx(Vacio, { titulo: "No queda nada por devolver", children: "Todo lo de esta entrega ya se devolvi\u00F3 o se corrigi\u00F3." })) : (_jsxs("div", { className: "max-w-2xl space-y-4", children: [_jsx(Tarjeta, { titulo: "\u00BFQu\u00E9 pas\u00F3?", children: _jsx("div", { className: "grid gap-2 p-5", children: Object.keys(MOTIVOS_DEVOLUCION).map((m) => (_jsxs("label", { className: cn('flex cursor-pointer gap-3 rounded-lg border px-4 py-3 text-sm', motivo === m ? 'border-tinta bg-marca-50' : 'border-borde hover:bg-fondo'), children: [_jsx("input", { type: "radio", name: "motivo", className: "mt-0.5 accent-tinta", checked: motivo === m, onChange: () => setMotivo(m) }), _jsxs("span", { children: [_jsx("span", { className: "font-medium", children: MOTIVOS_DEVOLUCION[m].texto }), _jsx("span", { className: "block text-tenue", children: MOTIVOS_DEVOLUCION[m].ayuda })] })] }, m))) }) }), _jsx(Tarjeta, { titulo: "Medicamentos", children: _jsx("ul", { className: "divide-y divide-borde", children: e.items.map((i) => {
                                const yaDevueltas = (i.devoluciones ?? []).reduce((a, d) => a + d.cantidad, 0);
                                const valor = cantidades[i.id] ?? '';
                                return (_jsxs("li", { className: "flex flex-wrap items-end gap-x-4 gap-y-2 px-5 py-3", children: [_jsxs("div", { className: "min-w-0 flex-1 basis-56", children: [_jsxs("p", { className: "font-medium", children: [i.medication?.name, " ", i.medication?.concentration] }), _jsxs("p", { className: "text-xs text-tenue", children: ["Entregadas ", i.cantidad, yaDevueltas > 0 && ` · ya devueltas o corregidas ${yaDevueltas}`, " \u00B7 se pueden devolver ", i.devolvible] })] }), _jsx(Campo, { etiqueta: "Cantidad", error: Number(valor) > (i.devolvible ?? 0) ? `Máximo ${i.devolvible}` : undefined, className: "w-32", children: _jsx(Entrada, { type: "number", inputMode: "numeric", min: 0, max: i.devolvible, placeholder: "0", disabled: !i.devolvible, className: "h-10 text-right xl:h-9", value: valor, onChange: (ev) => setCantidades((c) => ({ ...c, [i.id]: ev.target.value === '' ? '' : Math.max(0, Math.floor(Number(ev.target.value))) })) }) })] }, i.id));
                            }) }) }), motivo === 'PACIENTE_DEVOLVIO' && (_jsx(Tarjeta, { titulo: "\u00BFQu\u00E9 se hace con las pastillas?", children: _jsx("div", { className: "grid gap-2 p-5 sm:grid-cols-2", children: Object.keys(DESTINOS_DEVOLUCION).map((d) => (_jsxs("label", { className: cn('flex cursor-pointer gap-3 rounded-lg border px-4 py-3 text-sm', destino === d ? 'border-tinta bg-marca-50' : 'border-borde hover:bg-fondo'), children: [_jsx("input", { type: "radio", name: "destino", className: "mt-0.5 accent-tinta", checked: destino === d, onChange: () => setDestino(d) }), _jsxs("span", { children: [_jsx("span", { className: "font-medium", children: DESTINOS_DEVOLUCION[d].texto }), _jsx("span", { className: "block text-tenue", children: DESTINOS_DEVOLUCION[d].ayuda })] })] }, d))) }) })), _jsxs(Tarjeta, { titulo: "Nota", children: [_jsx("div", { className: "p-5", children: _jsx(AreaTexto, { rows: 2, maxLength: 500, placeholder: "Opcional: qu\u00E9 pas\u00F3, qui\u00E9n las trajo\u2026", value: nota, onChange: (ev) => setNota(ev.target.value) }) }), _jsx("p", { className: "border-t border-borde px-5 py-3 text-sm text-tenue", children: "La entrega original no se borra: la devoluci\u00F3n queda aparte, en el k\u00E1rdex del medicamento y en Auditor\u00EDa." })] }), _jsxs("div", { className: "flex flex-wrap items-center justify-end gap-2", children: [!enLinea && _jsx("span", { className: "text-sm text-amber-700", children: "Necesita conexi\u00F3n: cambia el inventario." }), _jsx(Boton, { variante: "secundario", onClick: () => navegar(-1), children: "Cancelar" }), _jsx(Boton, { icono: _jsx(Undo2, { className: "size-4" }), disabled: !motivo || total === 0 || excede || !enLinea, cargando: guardar.isPending, onClick: () => guardar.mutate(), children: motivo === 'CORRECCION' ? 'Corregir la entrega' : 'Registrar devolución' })] })] }))] }));
}
