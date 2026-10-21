import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PackagePlus, Pencil, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useMedicamento, useMedicamentos, useMovimientos } from '../api/consultas';
import { registrarAjuste, registrarEntrada } from '../api/recursos';
import { useSesion } from '../auth/sesion';
import { AreaTexto, Boton, Campo, Cargando, EncabezadoPagina, Entrada, Insignia, Paginacion, Selector, Tabla, Tarjeta, Vacio } from '../components/ui';
import { cn, diasHasta, fechaDia, fechaYHora, nombreCompleto } from '../lib/formato';
import { SelectorFecha } from '../components/SelectorFecha';
import { ymd } from '../components/SelectorFecha';
import { useVolver } from '../lib/navegacion';
const miles = (n) => n.toLocaleString('es-DO');
const ORIGENES = { DONACION: 'Donación', COMPRA: 'Compra', INICIAL: 'Saldo inicial', AJUSTE: 'Ajuste' };
const TIPOS = {
    ENTRADA: { texto: 'Entrada', color: '#15803d' },
    SALIDA_VISITA: { texto: 'Dispensado', color: '#1d1b18' },
    SALIDA_REPOSICION: { texto: 'Reposición', color: '#1d1b18' },
    DEVOLUCION: { texto: 'Devolución', color: '#2563eb' },
    AJUSTE: { texto: 'Ajuste', color: '#a16207' },
    VENCIDO: { texto: 'Vencido', color: '#dc2626' },
};
function estadoLote(l) {
    if (l.cantidadActual === 0)
        return { texto: 'Agotado' };
    if (!l.vencimiento)
        return { texto: 'Sin vencimiento', color: '#6b665e' };
    const dias = diasHasta(l.vencimiento);
    if (dias < 0)
        return { texto: 'Vencido', color: '#dc2626' };
    if (dias <= 90)
        return { texto: `Vence en ${dias} días`, color: '#b45309' };
    return { texto: 'Vigente', color: '#15803d' };
}
/** /medicamentos/:id — lotes y kárdex */
export function MedicamentoDetalle() {
    const id = Number(useParams().id);
    const consulta = useMedicamento(id);
    const [pagina, setPagina] = useState(1);
    const movimientos = useMovimientos(id, pagina);
    const navegar = useNavigate();
    const puedeGestionar = useSesion().tiene('inventario.gestionar');
    const [verAgotados, setVerAgotados] = useState(false);
    if (consulta.isPending)
        return _jsx(Cargando, {});
    if (!consulta.data)
        return _jsx(Vacio, { titulo: "Medicamento no encontrado" });
    const m = consulta.data;
    const hoy = new Date(new Date().toDateString());
    const vigente = m.lotes.filter((l) => l.cantidadActual > 0 && (!l.vencimiento || new Date(l.vencimiento) >= hoy)).reduce((a, l) => a + l.cantidadActual, 0);
    const lotes = m.lotes.filter((l) => verAgotados || l.cantidadActual > 0);
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: `${m.name} ${m.concentration}`, volver: { a: '/medicamentos', texto: 'Inventario' }, descripcion: !m.activo ? 'Inactivo: no se puede recetar.' : undefined, acciones: puedeGestionar && (_jsxs(_Fragment, { children: [_jsx(Boton, { variante: "secundario", icono: _jsx(Pencil, { className: "size-4" }), onClick: () => navegar(`/medicamentos/${id}/editar`), children: "Editar" }), _jsx(Boton, { icono: _jsx(PackagePlus, { className: "size-4" }), onClick: () => navegar(`/medicamentos/entrada?med=${id}`), children: "Registrar entrada" })] })) }), _jsx("div", { className: "mb-4 grid grid-cols-2 gap-4 md:grid-cols-4", children: [
                    ['Existencia vigente', miles(vigente), vigente < m.stockMinimo ? 'text-red-600' : ''],
                    ['Total en bodega', miles(m.currentStock), ''],
                    ['Mínimo', miles(m.stockMinimo), 'text-tenue'],
                    ['Lotes con existencia', miles(m.lotes.filter((l) => l.cantidadActual > 0).length), ''],
                ].map(([t, v, c]) => (_jsxs("div", { className: "rounded-xl border border-borde bg-superficie p-4", children: [_jsx("p", { className: "text-xs text-tenue", children: t }), _jsx("p", { className: cn('tabular mt-1 text-2xl font-semibold', c), children: v })] }, t))) }), _jsx(Tarjeta, { titulo: "Lotes", className: "mb-4", accion: _jsxs("label", { className: "flex items-center gap-2 text-xs text-tenue", children: [_jsx("input", { type: "checkbox", checked: verAgotados, onChange: (e) => setVerAgotados(e.target.checked), className: "accent-tinta" }), " Ver agotados"] }), children: lotes.length === 0 ? (_jsx(Vacio, { titulo: "Sin lotes con existencia", children: "Registra una entrada para cargar existencia." })) : (_jsx(Tabla, { columnas: ['Lote', 'Origen', 'Entrada', 'Vence', { texto: 'Inicial', className: 'text-right' }, { texto: 'Queda', className: 'text-right' }, 'Estado', { texto: '', className: 'w-24' }], children: lotes.map((l) => {
                        const e = estadoLote(l);
                        return (_jsxs("tr", { className: cn(l.cantidadActual === 0 && 'opacity-50'), children: [_jsx("td", { className: "px-5 py-3 font-mono text-[13px] whitespace-nowrap", children: l.numero ?? `#${l.id}` }), _jsxs("td", { className: "px-5 py-3", children: [ORIGENES[l.origen], l.procedencia && _jsx("span", { className: "block text-xs text-tenue", children: l.procedencia })] }), _jsx("td", { className: "px-5 py-3 whitespace-nowrap", children: fechaDia(l.fechaEntrada) }), _jsx("td", { className: "px-5 py-3 whitespace-nowrap", children: fechaDia(l.vencimiento) }), _jsx("td", { className: "tabular px-5 py-3 text-right text-tenue", children: miles(l.cantidadInicial) }), _jsx("td", { className: "tabular px-5 py-3 text-right font-medium", children: miles(l.cantidadActual) }), _jsx("td", { className: "px-5 py-3", children: _jsx(Insignia, { color: e.color, children: e.texto }) }), _jsx("td", { className: "px-5 py-2 text-right", children: puedeGestionar && l.cantidadActual > 0 && (_jsx(Boton, { variante: "fantasma", className: "h-8 px-2 text-xs", icono: _jsx(SlidersHorizontal, { className: "size-3.5" }), onClick: () => navegar(`/medicamentos/${id}/ajuste?lote=${l.id}`), children: "Ajustar" })) })] }, l.id));
                    }) })) }), _jsx(Tarjeta, { titulo: "K\u00E1rdex (movimientos)", children: movimientos.isPending ? (_jsx(Cargando, {})) : !movimientos.data?.data.length ? (_jsx(Vacio, { titulo: "Sin movimientos" })) : (_jsxs(_Fragment, { children: [_jsx(Tabla, { columnas: ['Fecha', 'Movimiento', 'Lote', { texto: 'Cantidad', className: 'text-right' }, { texto: 'Saldo', className: 'text-right' }, 'Paciente · detalle', 'Usuario'], children: movimientos.data.data.map((mv) => (_jsxs("tr", { children: [_jsx("td", { className: "px-5 py-2.5 whitespace-nowrap", children: fechaYHora(mv.createdAt) }), _jsx("td", { className: "px-5 py-2.5", children: _jsx(Insignia, { color: TIPOS[mv.tipo].color, children: TIPOS[mv.tipo].texto }) }), _jsx("td", { className: "px-5 py-2.5 font-mono text-xs whitespace-nowrap", children: mv.lote?.numero ?? '—' }), _jsxs("td", { className: cn('tabular px-5 py-2.5 text-right font-medium', mv.cantidad > 0 ? 'text-green-700' : 'text-red-600'), children: [mv.cantidad > 0 ? '+' : '', miles(mv.cantidad)] }), _jsx("td", { className: "tabular px-5 py-2.5 text-right", children: miles(mv.saldo) }), _jsxs("td", { className: "px-5 py-2.5", children: [mv.patient && (_jsxs(Link, { to: `/pacientes/${mv.patient.id}`, className: "block font-medium whitespace-nowrap hover:underline", children: [nombreCompleto(mv.patient), _jsx("span", { className: "ml-1.5 text-xs font-normal text-tenue", children: mv.patient.community?.name ?? 'Sin batey' })] })), _jsx("span", { className: "text-xs text-tenue", children: mv.motivo ?? (mv.visitId ? `Visita #${mv.visitId}` : mv.patient ? '' : '—') })] }), _jsx("td", { className: "px-5 py-2.5 whitespace-nowrap text-tenue", children: mv.userName ?? '—' })] }, mv.id))) }), _jsx(Paginacion, { pagina: pagina, ultima: movimientos.data.meta.lastPage, total: movimientos.data.meta.total, alCambiar: setPagina })] })) })] }));
}
/** /medicamentos/entrada?med=ID — entrada de un lote */
export function EntradaInventario() {
    const [params] = useSearchParams();
    const medicamentos = useMedicamentos();
    const navegar = useNavigate();
    const cliente = useQueryClient();
    const hoy = ymd(new Date());
    const { register, handleSubmit, formState, watch, reset, control } = useForm({
        defaultValues: { medicationId: params.get('med') ?? '', origen: 'DONACION', fechaEntrada: hoy, numero: '', vencimiento: '', procedencia: '', nota: '' },
    });
    const origen = watch('origen');
    const guardar = useMutation({
        mutationFn: ({ medicationId, ...d }) => registrarEntrada(Number(medicationId), {
            ...d,
            cantidad: Number(d.cantidad),
            numero: d.numero?.trim() || undefined,
            vencimiento: d.vencimiento || undefined,
            procedencia: d.procedencia?.trim() || undefined,
            nota: d.nota?.trim() || undefined,
        }),
        onSuccess: (l, d) => {
            cliente.invalidateQueries({ queryKey: ['medicamentos'] });
            cliente.invalidateQueries({ queryKey: ['stats'] });
            cliente.invalidateQueries({ queryKey: ['jornadas'] });
            toast.success(`Entrada registrada: ${miles(l.cantidadInicial)} unidades.`, {
                action: { label: 'Ver medicamento', onClick: () => navegar(`/medicamentos/${d.medicationId}`) },
            });
            // Se queda en la pantalla para cargar la siguiente (una donación suele traer varios).
            reset({ ...d, cantidad: '', numero: '', vencimiento: '', nota: '' });
        },
        onError: (e) => toast.error(e.message),
    });
    const e = formState.errors;
    if (!medicamentos.data)
        return _jsx(Cargando, {});
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: "Registrar entrada", descripcion: "Cada entrada es un lote con su vencimiento. Despu\u00E9s de guardar puedes cargar la siguiente.", volver: { a: '/medicamentos', texto: 'Inventario' } }), _jsxs("form", { onSubmit: handleSubmit((d) => guardar.mutate(d)), className: "max-w-3xl space-y-4", noValidate: true, children: [_jsx(Tarjeta, { titulo: "Lote", children: _jsxs("div", { className: "grid gap-4 p-5 sm:grid-cols-2", children: [_jsx(Campo, { etiqueta: "Medicamento", error: e.medicationId && 'Elige uno', className: "sm:col-span-2", children: _jsx(Selector, { vacio: "Elegir\u2026", ...register('medicationId', { required: true }), opciones: medicamentos.data.filter((m) => m.activo).map((m) => ({ value: m.id, label: `${m.name} ${m.concentration} (hay ${miles(m.vigente ?? m.currentStock)})` })), "aria-invalid": !!e.medicationId }) }), _jsx(Campo, { etiqueta: "Cantidad (unidades)", error: e.cantidad && 'Mayor que 0', children: _jsx(Entrada, { type: "number", min: 1, ...register('cantidad', { required: true, min: 1, valueAsNumber: true }), "aria-invalid": !!e.cantidad }) }), _jsx(Campo, { etiqueta: "Vencimiento", ayuda: "Si no se conoce, d\u00E9jalo vac\u00EDo (se dispensar\u00E1 al final).", children: _jsx(Controller, { control: control, name: "vencimiento", render: ({ field }) => _jsx(SelectorFecha, { corto: true, vacio: "Sin vencimiento", min: hoy, value: field.value, onChange: field.onChange, "aria-label": "Vencimiento" }) }) }), _jsx(Campo, { etiqueta: "N\u00FAmero de lote", ayuda: "Opcional", children: _jsx(Entrada, { ...register('numero') }) }), _jsx(Campo, { etiqueta: "Fecha de entrada", children: _jsx(Controller, { control: control, name: "fechaEntrada", render: ({ field }) => _jsx(SelectorFecha, { corto: true, max: hoy, value: field.value, onChange: field.onChange, "aria-label": "Fecha de entrada" }) }) })] }) }), _jsx(Tarjeta, { titulo: "Procedencia", children: _jsxs("div", { className: "grid gap-4 p-5 sm:grid-cols-2", children: [_jsx(Campo, { etiqueta: "Origen", children: _jsx(Selector, { opciones: [{ value: 'DONACION', label: 'Donación' }, { value: 'COMPRA', label: 'Compra' }], ...register('origen') }) }), _jsx(Campo, { etiqueta: origen === 'COMPRA' ? 'Proveedor' : 'Donante', ayuda: "Opcional", children: _jsx(Entrada, { ...register('procedencia') }) }), _jsx(Campo, { etiqueta: "Nota", className: "sm:col-span-2", children: _jsx(AreaTexto, { rows: 2, ...register('nota') }) })] }) }), _jsx("div", { className: "flex justify-end", children: _jsx(Boton, { type: "submit", cargando: guardar.isPending, icono: _jsx(PackagePlus, { className: "size-4" }), children: "Registrar entrada" }) })] })] }));
}
const MOTIVOS = ['Conteo físico', 'Dañado', 'Perdido', 'Corrección de una entrada', 'Otro'];
/** /medicamentos/:id/ajuste?lote=ID */
export function AjusteInventario() {
    const id = Number(useParams().id);
    const [params] = useSearchParams();
    const consulta = useMedicamento(id);
    const navegar = useNavigate();
    const volverA = useVolver();
    const cliente = useQueryClient();
    const { register, handleSubmit, watch, formState } = useForm({
        defaultValues: { loteId: params.get('lote') ?? '', tipo: 'AJUSTE', sentido: 'resta', motivo: 'Conteo físico', detalle: '' },
    });
    const [loteId, tipo, sentido, cantidad] = watch(['loteId', 'tipo', 'sentido', 'cantidad']);
    const guardar = useMutation({
        mutationFn: (d) => registrarAjuste(id, {
            loteId: Number(d.loteId),
            tipo: d.tipo,
            cantidad: (d.tipo === 'VENCIDO' || d.sentido === 'resta' ? -1 : 1) * Number(d.cantidad),
            motivo: d.tipo === 'VENCIDO' ? `Retiro por vencimiento${d.detalle ? `: ${d.detalle}` : ''}` : `${d.motivo}${d.detalle ? `: ${d.detalle}` : ''}`,
        }),
        onSuccess: () => {
            cliente.invalidateQueries({ queryKey: ['medicamentos'] });
            cliente.invalidateQueries({ queryKey: ['stats'] });
            toast.success('Ajuste registrado en el kárdex');
            volverA(`/medicamentos/${id}`);
        },
        onError: (e) => toast.error(e.message),
    });
    if (consulta.isPending)
        return _jsx(Cargando, {});
    if (!consulta.data)
        return _jsx(Vacio, { titulo: "Medicamento no encontrado" });
    const m = consulta.data;
    const lote = m.lotes.find((l) => l.id === Number(loteId));
    const resta = tipo === 'VENCIDO' || sentido === 'resta';
    const queda = lote && cantidad ? lote.cantidadActual + (resta ? -cantidad : cantidad) : null;
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: `Ajustar ${m.name} ${m.concentration}`, descripcion: "Corrige la existencia de un lote. Queda en el k\u00E1rdex con el motivo y qui\u00E9n lo hizo.", volver: { a: `/medicamentos/${id}`, texto: `${m.name} ${m.concentration}` } }), _jsxs("form", { onSubmit: handleSubmit((d) => guardar.mutate(d)), className: "max-w-2xl space-y-4", children: [_jsx(Tarjeta, { titulo: "Ajuste", children: _jsxs("div", { className: "grid gap-4 p-5 sm:grid-cols-2", children: [_jsx(Campo, { etiqueta: "Lote", className: "sm:col-span-2", error: formState.errors.loteId && 'Elige un lote', children: _jsx(Selector, { vacio: "Elegir\u2026", ...register('loteId', { required: true }), opciones: m.lotes.filter((l) => l.cantidadActual > 0).map((l) => ({ value: l.id, label: `${l.numero ?? `#${l.id}`} · ${miles(l.cantidadActual)} u. · vence ${fechaDia(l.vencimiento)}` })) }) }), _jsx(Campo, { etiqueta: "Tipo", children: _jsx(Selector, { opciones: [{ value: 'AJUSTE', label: 'Ajuste' }, { value: 'VENCIDO', label: 'Retiro por vencimiento' }], ...register('tipo') }) }), tipo === 'AJUSTE' && (_jsx(Campo, { etiqueta: "Sentido", children: _jsx(Selector, { opciones: [{ value: 'resta', label: 'Restar (faltante, daño…)' }, { value: 'suma', label: 'Sumar (sobrante)' }], ...register('sentido') }) })), _jsx(Campo, { etiqueta: "Cantidad", error: formState.errors.cantidad && 'Mayor que 0', ayuda: queda !== null ? `Al lote le quedarán ${miles(queda)}` : undefined, children: _jsx(Entrada, { type: "number", min: 1, ...register('cantidad', { required: true, min: 1, valueAsNumber: true }) }) }), tipo === 'AJUSTE' && (_jsx(Campo, { etiqueta: "Motivo", children: _jsx(Selector, { opciones: MOTIVOS.map((x) => ({ value: x, label: x })), ...register('motivo') }) })), _jsx(Campo, { etiqueta: "Detalle", className: "sm:col-span-2", ayuda: "Opcional", children: _jsx(Entrada, { ...register('detalle') }) })] }) }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Boton, { variante: "secundario", onClick: () => navegar(`/medicamentos/${id}`), children: "Cancelar" }), _jsx(Boton, { type: "submit", cargando: guardar.isPending, disabled: queda !== null && queda < 0, children: "Registrar ajuste" })] })] })] }));
}
