import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, ChevronDown, Minus, Plus, Save, X } from 'lucide-react';
import { useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useConfigPA, useConfiguracion, useMedicamentos } from '../api/consultas';
import { crearVisita, editarVisita } from '../api/recursos';
import { agregarPendiente, esFaltaDeConexion, nuevoId } from '../offline/cola';
import { useSesion } from '../auth/sesion';
import { useConfirmar } from './confirmar';
import { alertasClinicas } from '../lib/alertas';
import { opciones, TIPOS_VISITA } from '../lib/etiquetas';
import { margenDe, mensajeEntrega } from '../lib/entregas';
import { clasificar, cn, colorCumplimiento, DIA_MS, fecha as fechaCorta, nombreCompleto } from '../lib/formato';
import { ListaAlertas, useUmbrales } from './Alertas';
import { HistorialVisitas } from './HistorialVisitas';
import { SelectorFecha, ymd } from './SelectorFecha';
import { AreaTexto, Boton, Campo, Cargando, Casilla, comoNumero, Entrada, InsigniaCategoria, Segmentos, Selector, Tarjeta } from './ui';
const entero = (min, max) => z.number().int('Sin decimales').min(min, `Mínimo ${min}`).max(max, `Máximo ${max}`).optional();
const base = z.object({
    visitDate: z.string().min(1, 'Requerida'),
    visitType: z.enum(['NEW', 'FOLLOW_UP']),
    isHomeVisit: z.boolean(),
    /** Entregar los medicamentos al guardar; si no, quedan para la mesa de farmacia. */
    entregar: z.boolean(),
    // Obligatorios al registrar; al corregir pueden quedar vacíos (visitas viejas del Excel).
    weightKg: z.number().min(2, 'Revisa el peso').max(350, 'Revisa el peso').optional(),
    heightM: z.number().min(0.4, 'En metros, p. ej. 1.68').max(2.5, 'En metros, p. ej. 1.68').optional(),
    systolicManual: entero(40, 300),
    diastolicManual: entero(20, 200),
    systolicAuto: entero(40, 300),
    diastolicAuto: entero(20, 200),
    heartRate: entero(20, 250),
    oxygenSaturation: entero(50, 100),
    temperature: z.number().min(30).max(45).optional(),
    reason: z.string().trim(),
    notes: z.string().trim(),
    prescriptionText: z.string().trim(),
    intervalo: z.enum(['90', '30', 'otro']),
    diasOtro: z.number().int().min(7, 'Mínimo 7 días').max(365, 'Máximo 365').optional(),
    /** Al corregir, quién atendió (solo administración). */
    doctorId: z.string().optional(),
    recetas: z.array(z.object({
        /** Al corregir: la receta que ya existía (sin id es un medicamento agregado). */
        id: z.number().optional(),
        /** Al corregir: cuántas se entregaron de verdad (mueve el inventario por la diferencia). */
        entregadas: z.number().int('Sin decimales').min(0).max(2000, 'Máximo 2000').optional(),
        medicationId: z.string().min(1, 'Elige uno'),
        dailyDose: z.number('Requerida').int().min(1, 'Mínimo 1'),
        bufferDays: z.number('Requerido').int().min(0),
        // Vacío = no trajo ninguna (0).
        patientSupplyRemaining: z.number().int('Sin decimales').min(0, 'No puede ser negativo').optional(),
    })),
});
const crearEsquema = (edicion) => base
    .refine((d) => edicion || (d.systolicManual && d.diastolicManual) || (d.systolicAuto && d.diastolicAuto), {
    message: 'Registra al menos una toma completa (sistólica y diastólica), manual o automática.',
    path: ['systolicManual'],
})
    .refine((d) => edicion || d.weightKg !== undefined, { message: 'Requerido', path: ['weightKg'] })
    .refine((d) => edicion || d.heightM !== undefined, { message: 'Requerida', path: ['heightM'] })
    // Casi siempre es un error al teclear: la diastólica es la de abajo.
    .refine((d) => !(d.systolicManual && d.diastolicManual && d.diastolicManual >= d.systolicManual), { message: 'La diastólica debe ser menor que la sistólica', path: ['diastolicManual'] })
    .refine((d) => !(d.systolicAuto && d.diastolicAuto && d.diastolicAuto >= d.systolicAuto), { message: 'La diastólica debe ser menor que la sistólica', path: ['diastolicAuto'] })
    .refine((d) => d.intervalo !== 'otro' || d.diasOtro, { message: 'Indica los días', path: ['diasOtro'] })
    .refine((d) => new Set(d.recetas.map((r) => r.medicationId)).size === d.recetas.length, {
    message: 'Hay un medicamento repetido.',
    path: ['recetas'],
});
/**
 * La visita se elige por día; la hora se conserva: la de ahora al registrarla, la que tenía al corregirla
 * (así varias del mismo día siguen en su orden).
 */
const conHora = (dia, hora) => {
    const [a, m, d] = dia.split('-').map(Number);
    return new Date(a, m - 1, d, hora.getHours(), hora.getMinutes(), hora.getSeconds());
};
const diasDe = (d) => (d.intervalo === 'otro' ? (d.diasOtro ?? 0) : Number(d.intervalo));
/** Receta más reciente de ese medicamento en el historial del paciente, con la fecha de su visita. */
function recetaAnterior(visitas, medicationId) {
    for (const v of visitas) {
        const r = v.prescriptions?.find((p) => p.medicationId === medicationId);
        if (r)
            return { receta: r, fecha: v.visitDate };
    }
    return null;
}
/** Misma cuenta que PrescriptionsService.calcularCumplimiento, para verla antes de guardar. */
function estimarCumplimiento(anterior, fechaVisita, quedan) {
    // Vacío = no le quedaba ninguna.
    const sobrante = quedan === undefined || Number.isNaN(quedan) ? 0 : quedan;
    if (!anterior)
        return null;
    const dias = Math.round((new Date(fechaVisita).getTime() - new Date(anterior.fecha).getTime()) / DIA_MS);
    const tenia = anterior.receta.quantityDispensed + anterior.receta.patientSupplyRemaining;
    const debia = Math.min(anterior.receta.dailyDose * dias, tenia);
    if (debia <= 0)
        return null;
    return Math.min(100, (Math.max(0, tenia - sobrante) / debia) * 100);
}
/**
 * Campo solo de dígitos, con tope de largo (la presión no pasa de 3). type="text" porque
 * type="number" no respeta maxLength y deja escribir letras como la "e".
 */
function digitos(register, nombre, max) {
    const r = register(nombre, comoNumero);
    return {
        ...r,
        type: 'text',
        inputMode: 'numeric',
        pattern: '[0-9]*',
        maxLength: max,
        autoComplete: 'off',
        onChange: (ev) => {
            ev.target.value = ev.target.value.replace(/\D/g, '').slice(0, max);
            return r.onChange(ev);
        },
    };
}
/** Enter pasa al siguiente campo (como Tab) en vez de guardar: así se llena la visita sin soltar el teclado. */
function siguienteCampo(ev) {
    if (ev.key !== 'Enter' || ev.shiftKey)
        return;
    const actual = ev.target;
    if (actual.tagName !== 'INPUT' || actual.type === 'checkbox')
        return;
    ev.preventDefault();
    const campos = [...ev.currentTarget.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([disabled]), textarea')].filter((c) => c.offsetParent !== null);
    const siguiente = campos[campos.indexOf(actual) + 1];
    if (siguiente) {
        siguiente.focus();
        if (siguiente instanceof HTMLInputElement && siguiente.type !== 'date')
            siguiente.select();
    }
}
/** Botones de un toque (tablet): elige una opción entre pocas. */
/** Número con − y + a los lados: en la tablet es más fácil que escribir. */
function Contador({ campo, valor, min, register, setValue }) {
    const cambiar = (d) => setValue(campo, Math.max(min, (Number.isFinite(valor) ? valor : min) + d), { shouldDirty: true, shouldValidate: true });
    const boton = 'grid size-10 shrink-0 place-items-center rounded-lg border border-borde bg-superficie text-tenue hover:text-tinta disabled:opacity-40';
    return (_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("button", { type: "button", className: boton, onClick: () => cambiar(-1), disabled: (valor ?? min) <= min, "aria-label": "Menos", children: _jsx(Minus, { className: "size-4" }) }), _jsx(Entrada, { enterKeyHint: "next", className: "h-10 text-center text-base font-medium", ...digitos(register, campo, 2) }), _jsx("button", { type: "button", className: boton, onClick: () => cambiar(1), "aria-label": "M\u00E1s", children: _jsx(Plus, { className: "size-4" }) })] }));
}
function FilaReceta({ indice, control, register, setValue, medicamentos, historial, alQuitar, errores, correccion, }) {
    const [receta, fecha, intervalo, diasOtro, entregarAhora] = useWatch({ control, name: [`recetas.${indice}`, 'visitDate', 'intervalo', 'diasOtro', 'entregar'] });
    const med = medicamentos.find((m) => m.id === Number(receta.medicationId));
    // Misma cuenta que el backend: dosis × días + margen − lo que le queda.
    const total = (receta.dailyDose || 0) * diasDe({ intervalo, diasOtro }) + (receta.bufferDays || 0);
    const entregar = Math.max(0, total - (receta.patientSupplyRemaining || 0));
    const anterior = med ? recetaAnterior(historial, med.id) : null;
    const cumplimiento = estimarCumplimiento(anterior, fecha, receta.patientSupplyRemaining);
    const hay = med ? Math.max(0, med.vigente ?? med.currentStock) : undefined;
    // Al corregir: lo que sale o vuelve al inventario por la diferencia con lo que ya se había entregado.
    const entregadasAntes = correccion?.antes.find((r) => r.id === receta.id && r.medicationId === Number(receta.medicationId))?.quantityDispensed ?? 0;
    const diferencia = correccion ? (receta.entregadas ?? 0) - entregadasAntes : 0;
    const noAlcanza = !!correccion && !correccion.importada && diferencia > 0 && hay !== undefined && diferencia > hay;
    return (_jsxs("li", { className: "space-y-3 px-5 py-4", children: [_jsxs("div", { className: "flex items-start gap-2", children: [_jsx(Campo, { etiqueta: "Medicamento", error: errores?.medicationId?.message, className: "min-w-0 flex-1", children: _jsx(Selector, { vacio: "Elegir\u2026", className: "h-10", ...register(`recetas.${indice}.medicationId`), opciones: medicamentos.map((m) => ({ value: m.id, label: `${m.name} ${m.concentration}` })) }) }), _jsx("button", { type: "button", onClick: alQuitar, className: "mt-7 grid size-10 shrink-0 place-items-center rounded-lg text-tenue hover:bg-red-50 hover:text-red-600", "aria-label": "Quitar medicamento", title: "Quitar medicamento", children: _jsx(X, { className: "size-4" }) })] }), anterior && (_jsxs("p", { className: "text-xs text-tenue", children: ["La vez pasada (", fechaCorta(anterior.fecha), "): ", anterior.receta.dailyDose, " al d\u00EDa \u00B7 se le entregaron ", anterior.receta.quantityDispensed, anterior.receta.patientSupplyRemaining > 0 && ` · le quedaban ${anterior.receta.patientSupplyRemaining}`] })), _jsxs("div", { className: cn('grid grid-cols-2 gap-3', correccion ? 'sm:grid-cols-4' : 'sm:grid-cols-3'), children: [_jsx(Campo, { etiqueta: "Pastillas al d\u00EDa", error: errores?.dailyDose?.message, children: _jsx(Contador, { campo: `recetas.${indice}.dailyDose`, valor: receta.dailyDose, min: 1, register: register, setValue: setValue }) }), _jsx(Campo, { etiqueta: "D\u00EDas de margen", error: errores?.bufferDays?.message, children: _jsx(Contador, { campo: `recetas.${indice}.bufferDays`, valor: receta.bufferDays, min: 0, register: register, setValue: setValue }) }), _jsx(Campo, { etiqueta: "\u00BFCu\u00E1ntas le quedan?", error: errores?.patientSupplyRemaining?.message, ayuda: "Vac\u00EDo si no trajo ninguna", className: "col-span-2 sm:col-span-1", children: _jsx(Entrada, { placeholder: "0", enterKeyHint: "next", className: "h-10 text-center text-base font-medium", ...digitos(register, `recetas.${indice}.patientSupplyRemaining`, 4), "aria-invalid": !!errores?.patientSupplyRemaining }) }), correccion && (_jsx(Campo, { etiqueta: "Entregadas", error: errores?.entregadas?.message ?? (noAlcanza ? `Hay ${hay} en inventario` : undefined), className: "col-span-2 sm:col-span-1", children: _jsx(Entrada, { enterKeyHint: "next", className: "h-10 text-center text-base font-semibold", ...digitos(register, `recetas.${indice}.entregadas`, 4), "aria-invalid": noAlcanza || !!errores?.entregadas }) }))] }), _jsxs("div", { className: "tabular flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-fondo px-3 py-2.5 text-[13px] text-tenue", children: [correccion ? (_jsxs(_Fragment, { children: [_jsxs("span", { children: ["Le corresponden ", _jsx("strong", { className: "text-base text-tinta", children: entregar })] }), !correccion.importada && diferencia !== 0 && (_jsx("span", { className: cn('font-medium', diferencia > 0 ? (noAlcanza ? 'text-red-600' : 'text-amber-800') : 'text-green-700'), children: diferencia > 0 ? `Salen ${diferencia} más del inventario` : `Vuelven ${-diferencia} al inventario` })), correccion.importada && _jsx("span", { children: "Visita del Excel: no mueve el inventario" })] })) : !entregarAhora ? (_jsxs("span", { children: ["Le corresponden ", _jsx("strong", { className: "text-base text-tinta", children: entregar }), " \u00B7 se entregan en la mesa de farmacia"] })) : hay !== undefined && hay < entregar ? (_jsxs("span", { className: "text-amber-800", children: ["Le corresponden ", _jsx("strong", { className: "text-base", children: entregar }), " \u00B7 hay ", hay, ": se entregan ", hay, " y quedan ", _jsxs("strong", { children: [entregar - hay, " pendientes"] })] })) : (_jsxs("span", { children: ["Se entregan ", _jsx("strong", { className: "text-base text-tinta", children: entregar }), hay !== undefined && ` · quedan ${(hay - entregar).toLocaleString('es-DO')} en inventario`] })), _jsxs("span", { className: "ml-auto", children: ["Cumplimiento:", ' ', cumplimiento === null ? (_jsx("span", { children: !anterior ? 'primera vez con este medicamento' : 'la receta anterior es de este mismo día' })) : (_jsxs("strong", { className: colorCumplimiento(cumplimiento), children: [cumplimiento.toFixed(0), "%"] }))] })] })] }));
}
/** Los <select> precargados necesitan sus opciones al montarse, si no se quedan en "Elegir…". */
export function FormularioVisita(props) {
    const configs = useConfigPA();
    const medicamentos = useMedicamentos();
    if (!configs.data || !medicamentos.data)
        return _jsx(Cargando, {});
    return _jsx(Formulario, { ...props, configs: configs.data, medicamentos: medicamentos.data });
}
const local = (iso) => (iso ? ymd(new Date(iso)) : '');
const aNumero = (v) => (v === null || v === undefined || v === '' ? undefined : Number(v));
/** Los datos guardados de una visita, en la forma del formulario (para corregirla). */
function valoresDe(v) {
    const dias = v.nextVisitDate ? Math.round((new Date(v.nextVisitDate).getTime() - new Date(v.visitDate).getTime()) / DIA_MS) : 90;
    return {
        visitDate: local(v.visitDate),
        visitType: v.visitType,
        isHomeVisit: v.isHomeVisit,
        entregar: true,
        weightKg: aNumero(v.weightKg),
        heightM: aNumero(v.heightM),
        systolicManual: aNumero(v.systolicManual),
        diastolicManual: aNumero(v.diastolicManual),
        systolicAuto: aNumero(v.systolicAuto),
        diastolicAuto: aNumero(v.diastolicAuto),
        heartRate: aNumero(v.heartRate),
        oxygenSaturation: aNumero(v.oxygenSaturation),
        temperature: aNumero(v.temperature),
        reason: v.reason ?? '',
        notes: v.notes ?? '',
        prescriptionText: v.prescriptionText ?? '',
        intervalo: dias === 90 ? '90' : dias === 30 ? '30' : 'otro',
        diasOtro: dias === 90 || dias === 30 ? undefined : Math.max(7, dias),
        doctorId: String(v.doctorId),
        recetas: (v.prescriptions ?? []).map((r) => ({
            id: r.id,
            medicationId: String(r.medicationId),
            dailyDose: r.dailyDose,
            bufferDays: r.bufferDays,
            patientSupplyRemaining: r.patientSupplyRemaining,
            entregadas: r.quantityDispensed,
        })),
    };
}
function Formulario({ paciente, visita: editada, medicos, enModal, alGuardar, configs, medicamentos }) {
    const { usuario } = useSesion();
    const edicion = !!editada;
    const confirmar = useConfirmar();
    const entregaInmediata = (useConfiguracion().data?.entregaInmediata ?? 1) === 1;
    const cliente = useQueryClient();
    const [error, setError] = useState(null);
    // Al corregir, las "anteriores" son las de antes de esa visita.
    const historial = (paciente.clinicalVisits ?? []).filter((v) => !editada || (v.id !== editada.id && new Date(v.visitDate) < new Date(editada.visitDate)));
    const ultima = historial[0];
    const { register, handleSubmit, control, formState, setValue } = useForm({
        resolver: zodResolver(crearEsquema(edicion)),
        defaultValues: editada
            ? valoresDe(editada)
            : {
                visitDate: ymd(new Date()),
                visitType: ultima ? 'FOLLOW_UP' : 'NEW',
                isHomeVisit: false,
                entregar: entregaInmediata,
                // La estatura casi no cambia: se toma la última registrada.
                heightM: (() => {
                    const h = historial.find((v) => v.heightM)?.heightM;
                    return h ? Math.round(Number(h) * 100) / 100 : undefined;
                })(),
                reason: '',
                notes: '',
                prescriptionText: '',
                intervalo: '90',
                // Lo normal es repetir el tratamiento: se precargan los medicamentos de la última visita.
                recetas: (ultima?.prescriptions ?? []).map((r) => ({
                    medicationId: String(r.medicationId),
                    dailyDose: r.dailyDose,
                    // Las recetas importadas del Excel traen 0 días de margen: se proponen los 5 de siempre.
                    bufferDays: margenDe(r),
                    patientSupplyRemaining: undefined,
                })),
            },
    });
    const recetas = useFieldArray({ control, name: 'recetas' });
    const e = formState.errors;
    const [sm, dm, sa, da, peso, talla, intervalo, diasOtro, fc, spo2, temperatura, recetasHoy, fechaHoy, tipo] = useWatch({
        control,
        name: ['systolicManual', 'diastolicManual', 'systolicAuto', 'diastolicAuto', 'weightKg', 'heightM', 'intervalo', 'diasOtro', 'heartRate', 'oxygenSaturation', 'temperature', 'recetas', 'visitDate', 'visitType'],
    });
    const s = sm ?? sa;
    const d = dm ?? da;
    const categoria = s && d ? clasificar(configs, s, d) : null;
    // La fecha en que le toca volver, para decírsela al paciente.
    const diasProxima = diasDe({ intervalo, diasOtro });
    const proxima = fechaHoy && diasProxima > 0
        ? new Intl.DateTimeFormat('es-DO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(conHora(fechaHoy, new Date(2000, 0, 1, 12)).getTime() + diasProxima * DIA_MS)
        : null;
    const imc = peso && talla ? peso / (talla * talla) : null;
    // Alertas clínicas con lo que se va escribiendo y el historial
    const umbrales = useUmbrales();
    const alertas = alertasClinicas({
        s,
        d,
        fc,
        spo2,
        temperatura,
        peso,
        talla,
        medicamentos: recetasHoy.map((r) => medicamentos.find((m) => m.id === Number(r.medicationId))?.name ?? '').filter(Boolean),
        cumplimientos: recetasHoy
            .map((r) => estimarCumplimiento(recetaAnterior(historial, Number(r.medicationId)), fechaHoy, r.patientSupplyRemaining))
            .filter((x) => x !== null),
    }, historial, umbrales);
    /** Corregir una visita: los mismos campos; lo vacío se borra y los medicamentos mueven el inventario por la diferencia. */
    const corregir = async (datos) => {
        const v = editada;
        const fecha = conHora(datos.visitDate, new Date(v.visitDate));
        const nulo = (x) => (x === undefined || (typeof x === 'number' && Number.isNaN(x)) ? null : x);
        const cambios = {
            visitDate: fecha.toISOString(),
            nextVisitDate: new Date(fecha.getTime() + diasDe(datos) * DIA_MS).toISOString(),
            visitType: datos.visitType,
            isHomeVisit: datos.isHomeVisit,
            weightKg: nulo(datos.weightKg),
            heightM: nulo(datos.heightM),
            systolicManual: nulo(datos.systolicManual),
            diastolicManual: nulo(datos.diastolicManual),
            systolicAuto: nulo(datos.systolicAuto),
            diastolicAuto: nulo(datos.diastolicAuto),
            heartRate: nulo(datos.heartRate),
            oxygenSaturation: nulo(datos.oxygenSaturation),
            temperature: nulo(datos.temperature),
            reason: datos.reason || null,
            notes: datos.notes || null,
            prescriptionText: datos.prescriptionText || null,
            ...(medicos && datos.doctorId && Number(datos.doctorId) !== v.doctorId && { doctorId: Number(datos.doctorId) }),
        };
        // Los medicamentos solo se mandan si cambiaron: mueven el inventario.
        const nuevas = datos.recetas.map((r) => ({
            ...(r.id && { id: r.id }),
            medicationId: Number(r.medicationId),
            dailyDose: r.dailyDose,
            bufferDays: r.bufferDays,
            patientSupplyRemaining: r.patientSupplyRemaining ?? 0,
            entregadas: r.entregadas ?? 0,
        }));
        const antes = (v.prescriptions ?? []).map((r) => ({ id: r.id, medicationId: r.medicationId, dailyDose: r.dailyDose, bufferDays: r.bufferDays, patientSupplyRemaining: r.patientSupplyRemaining, entregadas: r.quantityDispensed }));
        if (JSON.stringify(nuevas) !== JSON.stringify(antes)) {
            // Un dedo de más (89 → 8960) sacaría miles de pastillas: se confirma antes.
            const dias = diasDe(datos);
            const raras = datos.recetas.some((r) => {
                const debe = Math.max(0, r.dailyDose * dias + r.bufferDays - (r.patientSupplyRemaining ?? 0));
                return (r.entregadas ?? 0) > Math.max(debe * 1.5, debe + 30);
            });
            if (raras &&
                !(await confirmar({
                    titulo: '¿Seguro de esas cantidades?',
                    mensaje: `Las entregadas son mucho más de lo que le corresponde${v.importada ? '' : ' y salen del inventario'}. Revisa que no sobre un número.`,
                    confirmar: 'Sí, guardar',
                    peligro: true,
                })))
                return;
            cambios.recetas = nuevas;
        }
        try {
            await editarVisita(v.id, cambios);
            for (const k of [['visitas'], ['visita'], ['paciente'], ['pacientes'], ['jornada'], ['stats'], ['medicos'], ['auditoria'], ['medicamentos'], ['entregas']])
                cliente.invalidateQueries({ queryKey: k });
            toast.success('Visita corregida. El cambio quedó registrado en Auditoría.');
            alGuardar();
        }
        catch (err) {
            const m = err instanceof Error ? err.message : '';
            setError(m.includes('No BP Configuration') ? 'Esos valores de presión no caen en ningún rango de la clasificación. Revisa la toma.' : mensajeEntrega(m) || 'No se pudo guardar la corrección.');
        }
    };
    const enviar = handleSubmit(async (datos) => {
        setError(null);
        if (edicion)
            return corregir(datos);
        const fecha = conHora(datos.visitDate, new Date());
        const dias = diasDe(datos);
        const visita = {
            // Mismo id si se reenvía (sin internet o tras un corte): el servidor no la duplica.
            clienteId: nuevoId(),
            patientId: paciente.id,
            doctorId: usuario.id,
            visitDate: fecha.toISOString(),
            nextVisitDate: new Date(fecha.getTime() + dias * DIA_MS).toISOString(),
            visitType: datos.visitType,
            isHomeVisit: datos.isHomeVisit,
            weightKg: datos.weightKg,
            heightM: datos.heightM,
            systolicManual: datos.systolicManual,
            diastolicManual: datos.diastolicManual,
            systolicAuto: datos.systolicAuto,
            diastolicAuto: datos.diastolicAuto,
            heartRate: datos.heartRate,
            oxygenSaturation: datos.oxygenSaturation,
            temperature: datos.temperature,
            reason: datos.reason || undefined,
            notes: datos.notes || undefined,
            prescriptionText: datos.prescriptionText || undefined,
            prescriptions: datos.recetas.map(({ id: _id, entregadas: _e, ...r }) => ({ ...r, medicationId: Number(r.medicationId), patientSupplyRemaining: r.patientSupplyRemaining ?? 0, daysUntilNextVisit: dias })),
            entregar: datos.entregar,
        };
        // Sin internet: se guarda en el dispositivo y se envía sola al volver la conexión.
        const guardarSinInternet = async () => {
            await agregarPendiente({
                id: visita.clienteId,
                tipo: 'visita',
                ruta: '/visits',
                metodo: 'POST',
                cuerpo: visita,
                resumen: { pacienteId: paciente.id, paciente: `${nombreCompleto(paciente)} · ${paciente.patientCode}`, detalle: `Visita del ${fecha.toLocaleDateString('es-DO')} · PA ${s ?? '—'}/${d ?? '—'}` },
            });
            toast.success('Sin conexión: la visita quedó guardada en este dispositivo y se enviará sola al volver la señal.');
            alGuardar();
        };
        if (!navigator.onLine)
            return guardarSinInternet();
        try {
            const v = await crearVisita(visita);
            for (const k of [['paciente', paciente.id], ['pacientes'], ['visitas'], ['stats'], ['jornada'], ['medicamentos'], ['entregas']]) {
                cliente.invalidateQueries({ queryKey: k });
            }
            if (v.pendientes?.length) {
                toast.warning(`Visita registrada. No alcanzó el inventario: quedan pendientes ${v.pendientes.map((p) => `${p.indicada - p.entregada} de ${p.medicamento}`).join(', ')}.`, { duration: 10_000 });
            }
            else if (datos.recetas.length && v.entregada === false) {
                toast.success('Visita registrada. Los medicamentos quedaron para la mesa de farmacia.');
            }
            else
                toast.success('Visita registrada');
            alGuardar(v);
        }
        catch (err) {
            if (esFaltaDeConexion(err))
                return guardarSinInternet();
            const m = err instanceof Error ? err.message : '';
            const sinStock = m.match(/^Insufficient stock for (.+)\. Required: (\d+), Available: (\d+)/);
            setError(sinStock
                ? `No hay suficiente ${sinStock[1]}: hacen falta ${sinStock[2]} y quedan ${sinStock[3]}. No se guardó nada.`
                : m.includes('No BP Configuration')
                    ? 'Esos valores de presión no caen en ningún rango de la clasificación. Revisa la toma.'
                    : m || 'No se pudo guardar la visita.');
        }
    });
    const campoNum = (nombre, etiqueta, extra = {}) => (_jsx(Campo, { etiqueta: etiqueta, error: e[nombre]?.message, children: _jsx(Entrada, { type: "number", inputMode: "decimal", enterKeyHint: "next", ...extra, ...register(nombre, comoNumero), "aria-invalid": !!e[nombre] }) }));
    // La toma: números grandes, fáciles de leer y tocar en la tablet.
    const cifra = (nombre, etiqueta, grande = true) => (_jsxs("label", { className: "flex min-w-0 flex-1 flex-col gap-1.5", children: [_jsx("span", { className: "text-[13px] font-medium text-tinta/80", children: etiqueta }), _jsx(Entrada, { placeholder: "\u2014", enterKeyHint: "next", autoFocus: !edicion && nombre === 'systolicManual', onFocus: (ev) => ev.currentTarget.select(), className: cn('text-center font-mono font-semibold tracking-tight placeholder:font-normal placeholder:text-tenue/40', grande ? 'h-16 text-3xl' : 'h-12 text-2xl'), ...digitos(register, nombre, 3), "aria-invalid": !!e[nombre] }), e[nombre] && e[nombre]?.type !== 'custom' && _jsx("span", { className: "text-xs text-red-600", children: e[nombre]?.message })] }));
    // Última toma válida, para comparar mientras se escribe la de hoy.
    const conToma = historial.find((v) => (v.systolicManual ?? v.systolicAuto) && (v.diastolicManual ?? v.diastolicAuto));
    const anterior = conToma ? { s: (conToma.systolicManual ?? conToma.systolicAuto), d: (conToma.diastolicManual ?? conToma.diastolicAuto) } : null;
    const signo = (x) => (x > 0 ? `+${x}` : String(x));
    const comparacion = s && d && anterior && (_jsxs("span", { className: "text-xs text-tenue", children: [edicion ? 'Anterior' : 'Última', ": ", _jsxs("span", { className: "font-mono", children: [anterior.s, "/", anterior.d] }), ' ', _jsxs("span", { className: cn('font-medium', s - anterior.s > 0 ? 'text-red-600' : s - anterior.s < 0 ? 'text-green-700' : ''), children: ["(", signo(s - anterior.s), "/", signo(d - anterior.d), ")"] })] }));
    const tomaInvertida = !!((sm && dm && dm >= sm) || (sa && da && da >= sa));
    // Lo que falta para poder guardar, en palabras (al corregir, lo vacío se permite).
    const falta = [
        !edicion && !(s && d) && 'la toma de presión',
        !edicion && !(peso && Number.isFinite(peso)) && 'el peso',
        !edicion && !(talla && Number.isFinite(talla)) && 'la estatura',
        recetasHoy.some((r) => !r.medicationId) && 'elegir el medicamento',
    ].filter(Boolean);
    const sinCambios = edicion && !formState.isDirty;
    const listo = falta.length === 0;
    const textoFalta = sinCambios ? 'Sin cambios todavía' : listo ? (edicion ? 'Listo para guardar la corrección' : 'Listo para guardar') : `Falta: ${falta.join(', ')}`;
    const pesoAnterior = historial.find((v) => v.weightKg)?.weightKg;
    const errorGeneral = error ?? (e.systolicManual?.type === 'custom' ? e.systolicManual.message : undefined) ?? e.recetas?.message;
    const textoGuardar = edicion ? 'Guardar corrección' : 'Guardar visita';
    const resumen = (_jsxs(Tarjeta, { titulo: "Resumen", children: [_jsxs("dl", { className: "space-y-4 p-5", children: [_jsxs("div", { children: [_jsx("dt", { className: "text-xs text-tenue", children: "Presi\u00F3n" }), _jsx("dd", { className: "tabular mt-1 font-mono text-2xl font-medium", children: s && d ? `${s}/${d}` : '—/—' }), comparacion && _jsx("dd", { className: "mt-0.5", children: comparacion })] }), _jsxs("div", { children: [_jsx("dt", { className: "mb-1 text-xs text-tenue", children: "Clasificaci\u00F3n" }), _jsx("dd", { children: s && d ? _jsx(InsigniaCategoria, { config: categoria }) : _jsx("span", { className: "text-sm text-tenue", children: edicion ? 'Sin toma: quedará sin clasificar' : 'Falta la toma' }) })] }), _jsxs("div", { children: [_jsx("dt", { className: "text-xs text-tenue", children: "IMC" }), _jsx("dd", { className: "tabular mt-1 font-mono text-lg", children: imc && Number.isFinite(imc) ? imc.toFixed(1) : '—' })] })] }), alertas.length > 0 && _jsx(ListaAlertas, { alertas: alertas, className: "mx-5 mb-4" }), _jsxs("p", { className: cn('mx-5 mb-4 flex gap-2 rounded-lg px-3 py-2 text-sm', sinCambios ? 'bg-fondo text-tenue' : listo ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900'), children: [listo ? _jsx(CheckCircle2, { className: "mt-0.5 size-4 shrink-0" }) : _jsx(AlertCircle, { className: "mt-0.5 size-4 shrink-0" }), textoFalta] }), errorGeneral && _jsx("p", { className: "mx-5 mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700", children: errorGeneral }), _jsx("div", { className: "border-t border-borde p-5", children: _jsx(Boton, { type: "submit", className: "h-11 w-full", cargando: formState.isSubmitting, disabled: sinCambios, icono: _jsx(Save, { className: "size-4" }), children: textoGuardar }) })] }));
    const agregarMedicamento = () => {
        const dias = diasDe({ intervalo, diasOtro });
        recetas.append({ medicationId: '', dailyDose: 1, bufferDays: 5, patientSupplyRemaining: undefined, ...(edicion && { entregadas: dias + 5 }) });
    };
    return (_jsxs("form", { onSubmit: enviar, onKeyDown: siguienteCampo, noValidate: true, className: cn('grid grid-cols-1 gap-4', !enModal && 'xl:grid-cols-[minmax(0,1fr)_300px]'), children: [_jsxs("div", { className: "min-w-0 space-y-4", children: [_jsx(Tarjeta, { titulo: "Presi\u00F3n arterial", accion: _jsx("span", { className: "hidden text-xs text-tenue sm:inline", children: edicion ? 'mmHg · deja vacío para borrar un valor mal anotado' : 'mmHg · la manual manda sobre la automática' }), children: _jsxs("div", { className: "flex flex-wrap items-stretch gap-x-6 gap-y-4 p-5", children: [_jsxs("div", { className: "min-w-0 flex-[3_1_22rem] space-y-4", children: [_jsxs("div", { children: [_jsx("p", { className: "mb-2 text-xs font-semibold tracking-wide text-tenue uppercase", children: "Manual" }), _jsxs("div", { className: "flex items-end gap-3", children: [cifra('systolicManual', 'Sistólica'), _jsx("span", { className: "pb-3 text-3xl text-tenue/50", "aria-hidden": true, children: "/" }), cifra('diastolicManual', 'Diastólica')] })] }), _jsxs("div", { children: [_jsxs("p", { className: "mb-2 text-xs font-semibold tracking-wide text-tenue uppercase", children: ["Autom\u00E1tica ", _jsx("span", { className: "font-normal tracking-normal normal-case", children: "\u00B7 tensi\u00F3metro digital, opcional" })] }), _jsxs("div", { className: "flex items-end gap-3", children: [cifra('systolicAuto', 'Sistólica', false), _jsx("span", { className: "pb-2 text-2xl text-tenue/50", "aria-hidden": true, children: "/" }), cifra('diastolicAuto', 'Diastólica', false)] })] })] }), _jsxs("div", { className: cn('flex min-w-44 flex-1 flex-col items-start justify-center gap-1.5 rounded-lg bg-fondo px-4 py-3', !enModal && 'xl:hidden'), children: [_jsx("span", { className: "text-xs text-tenue", children: sm && dm ? 'Toma manual' : sa && da ? 'Toma automática' : 'Clasificación' }), tomaInvertida ? (_jsx("span", { className: "text-sm font-medium text-red-700", children: "La diast\u00F3lica debe ser menor que la sist\u00F3lica. Revisa la toma." })) : s && d ? (_jsxs(_Fragment, { children: [_jsxs("span", { className: "tabular font-mono text-3xl font-semibold", children: [s, "/", d] }), _jsx(InsigniaCategoria, { config: categoria }), comparacion] })) : (_jsx("span", { className: "text-sm text-tenue", children: anterior ? `La ${edicion ? 'anterior' : 'última'} fue ${anterior.s}/${anterior.d}` : 'Primera toma del paciente' }))] }), tomaInvertida && !enModal && _jsx("p", { className: "hidden w-full text-sm font-medium text-red-700 xl:block", children: "La diast\u00F3lica debe ser menor que la sist\u00F3lica. Revisa la toma." })] }) }), !enModal && alertas.length > 0 && _jsx(ListaAlertas, { alertas: alertas, className: "xl:hidden" }), _jsx(Tarjeta, { titulo: "Peso y estatura", children: _jsxs("div", { className: "grid grid-cols-2 gap-4 p-5 sm:grid-cols-3", children: [_jsx(Campo, { etiqueta: "Peso (kg)", error: e.weightKg?.message, children: _jsx(Entrada, { type: "number", inputMode: "decimal", step: "0.1", enterKeyHint: "next", placeholder: pesoAnterior ? `${edicion ? 'Anterior' : 'Último'}: ${Number(pesoAnterior)} kg` : undefined, className: "h-11 text-base", ...register('weightKg', comoNumero), "aria-invalid": !!e.weightKg }) }), _jsx(Campo, { etiqueta: "Estatura (m)", error: e.heightM?.message, ayuda: !edicion && historial.some((v) => v.heightM) ? 'De la última visita' : 'En metros, p. ej. 1.62', children: _jsx(Entrada, { type: "number", inputMode: "decimal", step: "0.01", enterKeyHint: "next", className: "h-11 text-base", ...register('heightM', comoNumero), "aria-invalid": !!e.heightM }) }), _jsxs("div", { className: "col-span-2 flex flex-col gap-1.5 sm:col-span-1", children: [_jsx("span", { className: "text-[13px] font-medium text-tinta/80", children: "IMC" }), _jsx("span", { className: "tabular flex h-11 items-center font-mono text-lg", children: imc && Number.isFinite(imc) ? (_jsxs(_Fragment, { children: [imc.toFixed(1), _jsx("span", { className: "ml-2 font-sans text-sm text-tenue", children: imc < 18.5 ? 'bajo peso' : imc < 25 ? 'normal' : imc < 30 ? 'sobrepeso' : 'obesidad' })] })) : (_jsx("span", { className: "text-tenue", children: "\u2014" })) })] })] }) }), _jsxs(Tarjeta, { titulo: edicion ? 'Medicamentos entregados' : 'Medicamentos', accion: _jsxs("div", { className: "flex items-center gap-3", children: [edicion && _jsx("span", { className: "hidden text-xs text-tenue sm:inline", children: editada.importada ? 'Visita del Excel: no mueve el inventario' : 'Al guardar se ajusta el inventario' }), _jsx(Boton, { variante: "fantasma", className: "h-8", icono: _jsx(Plus, { className: "size-4" }), onClick: agregarMedicamento, children: "Agregar" })] }), children: [recetas.fields.length === 0 ? (_jsx("p", { className: "px-5 py-4 text-sm text-tenue", children: "Sin medicamentos en esta visita." })) : (_jsxs(_Fragment, { children: [_jsx("ul", { className: "divide-y divide-borde", children: recetas.fields.map((f, i) => (_jsx(FilaReceta, { indice: i, control: control, register: register, setValue: setValue, medicamentos: medicamentos, historial: historial, alQuitar: () => recetas.remove(i), errores: e.recetas?.[i], correccion: editada ? { antes: editada.prescriptions ?? [], importada: !!editada.importada } : undefined }, f.id))) }), !edicion && (_jsxs("div", { className: "border-t border-borde px-5 py-3", children: [_jsx(Casilla, { etiqueta: "Entregar los medicamentos ahora", ...register('entregar') }), _jsx("p", { className: "mt-1 ml-6 text-xs text-tenue", children: "Si lo desmarcas, quedan pendientes y se entregan en la mesa de farmacia (Entregas)." })] }))] })), edicion && !editada.importada && (() => {
                                const quitados = (editada.prescriptions ?? []).filter((r) => r.quantityDispensed > 0 && !recetasHoy.some((x) => x.id === r.id && Number(x.medicationId) === r.medicationId));
                                return quitados.length > 0 ? (_jsx("p", { className: "border-t border-borde bg-green-50 px-5 py-2.5 text-xs text-green-800", children: quitados.map((r) => `${r.medication?.name ?? 'Medicamento'} ${r.medication?.concentration ?? ''}: vuelven ${r.quantityDispensed} al inventario`).join(' · ') })) : null;
                            })()] }), _jsx(Tarjeta, { titulo: "Fecha y pr\u00F3xima visita", children: _jsxs("div", { className: "grid gap-4 p-5 sm:grid-cols-2", children: [_jsx(Campo, { etiqueta: "Fecha de la visita", error: e.visitDate?.message, children: _jsx(Controller, { control: control, name: "visitDate", render: ({ field }) => _jsx(SelectorFecha, { className: "h-10", value: field.value, onChange: field.onChange, max: ymd(new Date()), "aria-invalid": !!e.visitDate, "aria-label": "Fecha de la visita" }) }) }), _jsx(Campo, { etiqueta: "D\u00F3nde", grupo: true, children: _jsx(Controller, { control: control, name: "isHomeVisit", render: ({ field }) => (_jsx(Segmentos, { etiqueta: "D\u00F3nde fue la visita", valor: field.value ? 'casa' : 'batey', alCambiar: (v) => field.onChange(v === 'casa'), opciones: [
                                                { value: 'batey', label: 'En la jornada' },
                                                { value: 'casa', label: 'En su casa' },
                                            ] })) }) }), _jsxs(Campo, { etiqueta: "Pr\u00F3xima visita", error: e.diasOtro?.message, grupo: true, ayuda: proxima && `Le toca volver el ${proxima}`, children: [_jsx("input", { type: "hidden", ...register('intervalo') }), _jsx(Segmentos, { etiqueta: "Pr\u00F3xima visita", valor: intervalo, alCambiar: (v) => setValue('intervalo', v, { shouldDirty: true, shouldValidate: true }), opciones: [
                                                { value: '90', label: 'En 3 meses' },
                                                { value: '30', label: 'En 1 mes' },
                                                { value: 'otro', label: 'Otro' },
                                            ] }), intervalo === 'otro' && _jsx(Entrada, { type: "number", inputMode: "numeric", min: 7, enterKeyHint: "next", placeholder: "D\u00EDas hasta la pr\u00F3xima visita", className: "mt-1 h-10", ...register('diasOtro', comoNumero) })] }), _jsxs(Campo, { etiqueta: "Tipo de visita", grupo: true, children: [_jsx("input", { type: "hidden", ...register('visitType') }), _jsx(Segmentos, { etiqueta: "Tipo de visita", valor: tipo, alCambiar: (v) => setValue('visitType', v, { shouldDirty: true }), opciones: opciones(TIPOS_VISITA).map((o) => ({ value: String(o.value), label: o.label })) })] }), medicos && (_jsx(Campo, { etiqueta: "Atendi\u00F3", ayuda: "Solo administraci\u00F3n", className: "sm:col-span-2", children: _jsx(Selector, { className: "h-10", ...register('doctorId'), opciones: medicos }) }))] }) }), _jsx(Tarjeta, { titulo: "Comentario", children: _jsxs("div", { className: "space-y-4 p-5", children: [_jsx(AreaTexto, { ...register('notes'), placeholder: "Adherencia, s\u00EDntomas, observaciones para la pr\u00F3xima cl\u00EDnica\u2026" }), _jsxs("details", { className: "group", open: edicion && !!(editada.reason || editada.prescriptionText || editada.heartRate || editada.oxygenSaturation || editada.temperature), children: [_jsxs("summary", { className: "flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-tenue hover:text-tinta", children: [_jsx(ChevronDown, { className: "size-4 transition-transform group-open:rotate-180" }), " M\u00E1s datos (motivo, signos vitales, indicaciones)"] }), _jsxs("div", { className: "mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3", children: [_jsx(Campo, { etiqueta: "Motivo de consulta", className: "col-span-2 sm:col-span-3", children: _jsx(Entrada, { enterKeyHint: "next", ...register('reason') }) }), campoNum('heartRate', 'Frec. cardíaca (lpm)'), campoNum('oxygenSaturation', 'Saturación O₂ (%)'), campoNum('temperature', 'Temperatura (°C)', { step: '0.1' }), _jsx(Campo, { etiqueta: "Indicaciones para el paciente", className: "col-span-2 sm:col-span-3", children: _jsx(AreaTexto, { ...register('prescriptionText') }) })] })] })] }) }), !enModal && (_jsxs("div", { className: "sticky bottom-0 z-20 -mx-4 border-t border-borde bg-superficie/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10 xl:hidden", children: [errorGeneral && _jsx("p", { className: "mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700", children: errorGeneral }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "tabular font-mono text-xl font-semibold", children: s && d ? `${s}/${d}` : '—/—' }), s && d && _jsx(InsigniaCategoria, { config: categoria })] }), _jsx("p", { className: cn('truncate text-xs', sinCambios ? 'text-tenue' : listo ? 'text-green-700' : 'text-amber-800'), children: textoFalta })] }), _jsx(Boton, { type: "submit", className: "h-11 shrink-0 px-5", cargando: formState.isSubmitting, disabled: sinCambios, icono: _jsx(Save, { className: "size-4" }), children: textoGuardar })] })] }))] }), _jsxs("aside", { className: cn('space-y-4', !enModal && 'xl:sticky xl:top-6 xl:max-h-[calc(100dvh-3rem)] xl:self-start xl:overflow-y-auto'), children: [_jsx("div", { className: cn(!enModal && 'hidden xl:block'), children: resumen }), _jsx(HistorialVisitas, { visitas: historial })] })] }));
}
