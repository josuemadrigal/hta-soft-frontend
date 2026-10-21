import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { AlertTriangle, Pill } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useConfiguracion, useMedicamentos } from '../api/consultas';
import { MOTIVOS_INASISTENCIA, PARENTESCOS, PARENTESCOS_OPCIONES } from '../lib/etiquetas';
import { cn, fecha, nombreCompleto } from '../lib/formato';
import { cantidadPorDias, margenDe } from '../lib/entregas';
import { Boton, Entrada } from './ui';
const DIAS = [30, 60, 90];
/**
 * Después de elegir el motivo de "No vino": ¿se le deja el tratamiento con alguien?
 * Es una ventana (no una página) para no perder la lista en plena jornada. Usa la última receta que ya
 * trae la lista del batey, así funciona sin internet.
 */
export function DejarTratamiento({ paciente: p, motivo, alSoloNoVino, alDejar, alCancelar, }) {
    const ref = useRef(null);
    useEffect(() => {
        const d = ref.current;
        if (d && !d.open)
            d.showModal();
    }, []);
    const medicamentos = useMedicamentos().data ?? [];
    const meses = useConfiguracion().data?.reposicionMesesMaximo ?? 6;
    const ultima = p.clinicalVisits?.[0];
    const receta = useMemo(() => (ultima?.prescriptions ?? []).filter((r) => r.medicationId), [ultima]);
    const [nombre, setNombre] = useState('');
    const [parentesco, setParentesco] = useState(null);
    const [dias, setDias] = useState(90);
    const [cantidades, setCantidades] = useState(() => Object.fromEntries(receta.map((r) => [r.medicationId, cantidadPorDias(r.dailyDose, 90, margenDe(r))])));
    const [nota, setNota] = useState('');
    const elegirDias = (d) => {
        setDias(d);
        setCantidades(Object.fromEntries(receta.map((r) => [r.medicationId, cantidadPorDias(r.dailyDose, d, margenDe(r))])));
    };
    // Más del plazo sin consulta: se permite (no se le niega la medicina), pero se avisa.
    const limite = new Date();
    limite.setMonth(limite.getMonth() - meses);
    const ultimaFecha = ultima?.visitDate ? new Date(ultima.visitDate) : null;
    const sinConsultaHaceMucho = !ultimaFecha || ultimaFecha < limite;
    const mesesSinConsulta = ultimaFecha ? Math.floor((Date.now() - ultimaFecha.getTime()) / (30.44 * 86_400_000)) : null;
    const items = receta.map((r) => ({ medicationId: r.medicationId, cantidad: Number(cantidades[r.medicationId]) || 0 })).filter((i) => i.cantidad > 0);
    // Lo que se puede entregar: sin vencer (si no se conoce, la existencia total).
    const hayDe = (id) => {
        const m = medicamentos.find((x) => x.id === id);
        return m ? (m.vigente ?? m.currentStock) : undefined;
    };
    const sinStock = items.filter((i) => i.cantidad > (hayDe(i.medicationId) ?? Infinity));
    const listo = parentesco !== null && items.length > 0 && sinStock.length === 0;
    const cerrar = (accion) => {
        ref.current?.close();
        accion();
    };
    return (_jsxs("dialog", { ref: ref, onCancel: (e) => {
            e.preventDefault();
            cerrar(alCancelar);
        }, onClick: (e) => e.target === e.currentTarget && cerrar(alCancelar), className: "m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-borde bg-superficie p-0 text-tinta shadow-2xl backdrop:bg-tinta/40 backdrop:backdrop-blur-[2px]", "aria-labelledby": "dejar-titulo", children: [_jsxs("div", { className: "border-b border-borde px-6 py-4", children: [_jsxs("h2", { id: "dejar-titulo", className: "font-semibold", children: [nombreCompleto(p), " no vino"] }), _jsxs("p", { className: "text-sm text-tenue", children: [MOTIVOS_INASISTENCIA[motivo], " \u00B7 \u00BFSe le deja el tratamiento con alguien?"] })] }), receta.length === 0 ? (_jsx("p", { className: "px-6 py-5 text-sm text-tenue", children: "No tiene una receta anterior: no hay tratamiento que dejarle. Que venga a la pr\u00F3xima jornada." })) : (_jsxs("div", { className: "space-y-5 px-6 py-5", children: [sinConsultaHaceMucho && (_jsxs("p", { className: "flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900", children: [_jsx(AlertTriangle, { className: "mt-0.5 size-4 shrink-0" }), _jsxs("span", { children: [ultimaFecha ? `Lleva ${mesesSinConsulta} meses sin consulta (desde el ${fecha(ultima.visitDate)}).` : 'Nunca ha tenido una consulta.', " Se le puede dejar, pero que venga a la pr\u00F3xima jornada."] })] })), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "block text-[13px] font-medium text-tinta/80", htmlFor: "dejar-nombre", children: "\u00BFCon qui\u00E9n?" }), _jsx(Entrada, { id: "dejar-nombre", className: "h-11", maxLength: 120, placeholder: "Nombre (opcional)", autoComplete: "off", value: nombre, onChange: (e) => setNombre(e.target.value) }), _jsx("div", { className: "grid grid-cols-3 gap-2", role: "radiogroup", "aria-label": "Parentesco", children: PARENTESCOS_OPCIONES.map((k) => (_jsx("button", { type: "button", role: "radio", "aria-checked": parentesco === k, onClick: () => setParentesco(k), className: cn('h-10 rounded-lg border text-sm', parentesco === k ? 'border-tinta bg-marca-50 font-medium' : 'border-borde hover:bg-fondo'), children: PARENTESCOS[k] }, k))) })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [_jsx("span", { className: "text-[13px] font-medium text-tinta/80", children: "\u00BFCu\u00E1ntas pastillas?" }), _jsx("div", { className: "flex rounded-lg bg-black/5 p-0.5 text-sm", role: "radiogroup", "aria-label": "D\u00EDas a cubrir", children: DIAS.map((d) => (_jsxs("button", { type: "button", role: "radio", "aria-checked": dias === d, onClick: () => elegirDias(d), className: cn('rounded-md px-3 py-1.5', dias === d ? 'bg-superficie font-medium shadow-sm' : 'text-tenue hover:text-tinta'), children: [d, " d\u00EDas"] }, d))) })] }), _jsx("ul", { className: "divide-y divide-borde rounded-lg border border-borde", children: receta.map((r) => {
                                    const valor = cantidades[r.medicationId] ?? '';
                                    const hay = hayDe(r.medicationId);
                                    const falta = hay !== undefined && Number(valor) > hay;
                                    return (_jsxs("li", { className: "flex items-center gap-3 px-3 py-2.5", children: [_jsx(Pill, { className: "size-4 shrink-0 text-tenue" }), _jsxs("span", { className: "min-w-0 flex-1 text-sm", children: [_jsxs("span", { className: "block font-medium", children: [r.medication?.name, " ", r.medication?.concentration] }), _jsxs("span", { className: cn('block text-xs', falta ? 'text-red-600' : 'text-tenue'), children: [r.dailyDose, " al d\u00EDa \u00B7 ", dias, " d\u00EDas + ", margenDe(r), " de margen", hay !== undefined && ` · hay ${hay}`] })] }), _jsx(Entrada, { type: "number", inputMode: "numeric", min: 0, "aria-label": `Pastillas de ${r.medication?.name ?? 'medicamento'}`, className: "h-10 w-24 text-right", value: valor, onChange: (e) => setCantidades((c) => ({ ...c, [r.medicationId]: e.target.value === '' ? '' : Math.max(0, Math.floor(Number(e.target.value))) })) })] }, r.medicationId));
                                }) })] }), sinStock.length > 0 && (_jsxs("p", { className: "flex gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700", role: "alert", children: [_jsx(AlertTriangle, { className: "mt-0.5 size-4 shrink-0" }), _jsx("span", { children: "No hay suficiente en inventario para dejarle el tratamiento. Baja la cantidad o marca solo que no vino." })] })), _jsx(Entrada, { className: "h-10", maxLength: 500, placeholder: "Nota (opcional)", value: nota, onChange: (e) => setNota(e.target.value) })] })), _jsxs("div", { className: "flex flex-wrap justify-end gap-2 border-t border-borde px-6 py-4", children: [_jsx(Boton, { variante: "secundario", className: "h-10", onClick: () => cerrar(alSoloNoVino), children: "Solo marcar que no vino" }), receta.length > 0 && (_jsx(Boton, { className: "h-10", icono: _jsx(Pill, { className: "size-4" }), disabled: !listo, title: sinStock.length > 0 ? 'No hay suficiente en inventario' : !listo ? 'Falta el parentesco o la cantidad' : undefined, onClick: () => cerrar(() => alDejar({ recibioNombre: nombre.trim() || undefined, recibioParentesco: parentesco, items, nota: nota.trim() || undefined })), children: "Dejar tratamiento" }))] })] }));
}
