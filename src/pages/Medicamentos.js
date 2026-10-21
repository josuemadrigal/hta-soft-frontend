import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarX, Download, PackagePlus, Pill, Plus, ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { useAlertasInventario, useConsumoMedicamentos, useMedicamento, useMedicamentos } from '../api/consultas';
import { crearMedicamento, editarMedicamento } from '../api/recursos';
import { useSesion } from '../auth/sesion';
import { Boton, Campo, Cargando, Casilla, EncabezadoPagina, Entrada, ErrorCarga, Insignia, Segmentos, Tabla, Tarjeta, Vacio } from '../components/ui';
import { descargarCsv } from '../lib/copiar';
import { cn, diasHasta, fechaDia } from '../lib/formato';
const miles = (n) => n.toLocaleString('es-DO');
/** Estado del medicamento para la tabla. */
function estado(m) {
    if (!m.activo)
        return { texto: 'Inactivo' };
    if ((m.vigente ?? m.currentStock) === 0)
        return { texto: 'Agotado', color: '#dc2626' };
    if ((m.vigente ?? m.currentStock) < m.stockMinimo)
        return { texto: 'Bajo el mínimo', color: '#dc2626' };
    if (m.proximoVencimiento && diasHasta(m.proximoVencimiento) <= 90)
        return { texto: 'Lote por vencer', color: '#b45309' };
    return { texto: 'En orden', color: '#15803d' };
}
/** Redondea hacia arriba a la decena: los pedidos se hacen en cantidades redondas. */
const redondear = (n) => Math.ceil(n / 10) * 10;
/**
 * Cuánto pedir de cada medicamento para cubrir los próximos meses: lo que se entrega por mes × los meses,
 * más el mínimo de reserva, menos lo que hay vigente (sin contar lo vencido).
 */
function PedidoSugerido({ medicamentos }) {
    const consumo = useConsumoMedicamentos();
    const [meses, setMeses] = useState('6');
    const h = Number(meses);
    const filas = medicamentos
        .filter((m) => m.activo)
        .map((m) => {
        const porMes = consumo.data?.medicamentos.find((c) => c.medicationId === m.id)?.porMes ?? 0;
        const hay = m.vigente ?? m.currentStock;
        const pedir = Math.max(0, redondear(porMes * h + m.stockMinimo - hay));
        const alcanza = porMes > 0 ? hay / porMes : null;
        return { m, porMes, hay, pedir, alcanza };
    })
        .sort((a, b) => (a.alcanza ?? Infinity) - (b.alcanza ?? Infinity));
    const totalPedir = filas.reduce((a, f) => a + f.pedir, 0);
    const exportar = () => descargarCsv(filas.map((f) => ({ medicamento: `${f.m.name} ${f.m.concentration}`, porMes: f.porMes, hay: f.hay, minimo: f.m.stockMinimo, alcanza: f.alcanza === null ? '' : f.alcanza.toFixed(1), pedir: f.pedir })), [
        { clave: 'medicamento', titulo: 'Medicamento' },
        { clave: 'porMes', titulo: 'Se entregan al mes' },
        { clave: 'hay', titulo: 'Existencia vigente' },
        { clave: 'minimo', titulo: 'Mínimo de reserva' },
        { clave: 'alcanza', titulo: 'Alcanza para (meses)' },
        { clave: 'pedir', titulo: `Pedir para ${h} meses` },
    ], `pedido-sugerido_${h}-meses`);
    return (_jsx(Tarjeta, { className: "mt-4", titulo: _jsxs("span", { className: "flex items-center gap-2", children: [_jsx(ShoppingCart, { className: "size-4" }), " Pedido sugerido"] }), accion: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Segmentos, { etiqueta: "Cubrir los pr\u00F3ximos", valor: meses, alCambiar: setMeses, className: "w-64", opciones: [
                        { value: '3', label: '3 meses' },
                        { value: '6', label: '6 meses' },
                        { value: '12', label: '12 meses' },
                    ] }), _jsxs("button", { type: "button", onClick: exportar, className: "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-marca-700 hover:bg-marca-50", children: [_jsx(Download, { className: "size-3.5" }), " CSV"] })] }), children: consumo.isPending ? (_jsx(Cargando, { forma: "lista", texto: "Calculando el consumo\u2026" })) : consumo.isError ? (_jsx(ErrorCarga, { error: consumo.error })) : (_jsxs(_Fragment, { children: [_jsx(Tabla, { columnas: [
                        'Medicamento',
                        { texto: 'Se entregan al mes', className: 'text-right' },
                        { texto: 'Hay vigente', className: 'text-right' },
                        { texto: 'Alcanza para', className: 'text-right' },
                        { texto: `Pedir para ${h} meses`, className: 'text-right' },
                    ], children: filas.map((f) => {
                        const corto = f.alcanza !== null && f.alcanza < h;
                        return (_jsxs("tr", { children: [_jsxs("td", { className: "px-5 py-3", children: [_jsx("span", { className: "font-medium", children: f.m.name }), " ", _jsx("span", { className: "text-tenue", children: f.m.concentration })] }), _jsx("td", { className: "tabular px-5 py-3 text-right", children: f.porMes ? miles(f.porMes) : _jsx("span", { className: "text-tenue", children: "\u2014" }) }), _jsx("td", { className: "tabular px-5 py-3 text-right", children: miles(f.hay) }), _jsx("td", { className: cn('tabular px-5 py-3 text-right whitespace-nowrap', corto && 'font-medium text-red-600'), children: f.alcanza === null ? _jsx("span", { className: "text-tenue", children: "sin consumo" }) : f.alcanza >= 24 ? 'más de 2 años' : f.alcanza < 1 ? `${Math.round(f.alcanza * 30)} días` : `${f.alcanza.toFixed(1)} meses` }), _jsx("td", { className: "tabular px-5 py-3 text-right text-base font-semibold", children: f.pedir ? miles(f.pedir) : _jsx("span", { className: "text-sm font-normal text-tenue", children: "No hace falta" }) })] }, f.m.id));
                    }) }), _jsxs("p", { className: "border-t border-borde px-5 py-3 text-xs text-tenue", children: ["Total a pedir: ", _jsxs("strong", { className: "text-tinta", children: [miles(totalPedir), " pastillas"] }), ". Se calcula con lo entregado en los \u00FAltimos ", consumo.data.meses >= 12 ? '12 meses' : `${consumo.data.meses} meses`, " (visitas y reposiciones): lo de cada mes \u00D7 ", h, " meses, m\u00E1s el m\u00EDnimo de reserva, menos lo que hay vigente. Redondeado a la decena."] })] })) }));
}
export function Medicamentos() {
    const consulta = useMedicamentos();
    const alertas = useAlertasInventario();
    const navegar = useNavigate();
    const puedeGestionar = useSesion().tiene('inventario.gestionar');
    const a = alertas.data;
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: "Inventario de medicamentos", descripcion: "Existencias por lote. Al dispensar sale primero el lote que vence antes.", acciones: puedeGestionar && (_jsxs(_Fragment, { children: [_jsx(Boton, { variante: "secundario", icono: _jsx(Plus, { className: "size-4" }), onClick: () => navegar('/medicamentos/nuevo'), children: "Nuevo medicamento" }), _jsx(Boton, { icono: _jsx(PackagePlus, { className: "size-4" }), onClick: () => navegar('/medicamentos/entrada'), children: "Registrar entrada" })] })) }), a && (a.vencidos.length > 0 || a.porVencer.length > 0) && (_jsxs("div", { className: "mb-4 grid gap-3 md:grid-cols-2", children: [a.vencidos.length > 0 && (_jsxs("div", { className: "rounded-xl border border-red-200 bg-red-50 p-4 text-sm", children: [_jsxs("p", { className: "mb-2 flex items-center gap-2 font-semibold text-red-700", children: [_jsx(CalendarX, { className: "size-4" }), " ", a.vencidos.length, " ", a.vencidos.length === 1 ? 'lote vencido' : 'lotes vencidos', " con existencia"] }), _jsx("ul", { className: "space-y-1 text-red-900", children: a.vencidos.map((l) => (_jsx("li", { children: _jsxs(Link, { to: `/medicamentos/${l.medicationId}`, className: "hover:underline", children: [l.medication?.name, " ", l.medication?.concentration, " \u00B7 lote ", l.numero ?? `#${l.id}`, " \u00B7 ", miles(l.cantidadActual), " u. \u00B7 venci\u00F3 el ", fechaDia(l.vencimiento)] }) }, l.id))) }), _jsx("p", { className: "mt-2 text-xs text-red-700", children: "No se dispensan. Ret\u00EDralos con un ajuste \"Vencido\"." })] })), a.porVencer.length > 0 && (_jsxs("div", { className: "rounded-xl border border-amber-200 bg-marca-50 p-4 text-sm", children: [_jsxs("p", { className: "mb-2 flex items-center gap-2 font-semibold text-amber-800", children: [_jsx(AlertTriangle, { className: "size-4" }), " ", a.porVencer.length, " ", a.porVencer.length === 1 ? 'lote vence' : 'lotes vencen', " en los pr\u00F3ximos ", a.diasAviso, " d\u00EDas"] }), _jsx("ul", { className: "space-y-1", children: a.porVencer.map((l) => (_jsx("li", { children: _jsxs(Link, { to: `/medicamentos/${l.medicationId}`, className: "hover:underline", children: [l.medication?.name, " ", l.medication?.concentration, " \u00B7 ", miles(l.cantidadActual), " u. \u00B7 vence el ", fechaDia(l.vencimiento), " (", diasHasta(l.vencimiento), " d\u00EDas)"] }) }, l.id))) })] }))] })), _jsx(Tarjeta, { children: consulta.isPending ? (_jsx(Cargando, {})) : consulta.isError ? (_jsx(ErrorCarga, { error: consulta.error })) : consulta.data.length === 0 ? (_jsx(Vacio, { icono: _jsx(Pill, { className: "size-8" }), titulo: "Sin medicamentos", children: "Agrega los medicamentos que se entregan a los pacientes." })) : (_jsx(Tabla, { columnas: [
                        'Medicamento',
                        { texto: 'Existencia vigente', className: 'text-right' },
                        { texto: 'Mínimo', className: 'text-right' },
                        'Próximo vencimiento',
                        { texto: 'Lotes', className: 'text-right' },
                        'Estado',
                    ], children: consulta.data.map((m) => {
                        const e = estado(m);
                        const bajo = (m.vigente ?? m.currentStock) < m.stockMinimo;
                        return (_jsxs("tr", { onClick: () => navegar(`/medicamentos/${m.id}`), className: cn('cursor-pointer hover:bg-fondo', !m.activo && 'opacity-60'), children: [_jsxs("td", { className: "px-5 py-3", children: [_jsx("span", { className: "font-medium", children: m.name }), " ", _jsx("span", { className: "text-tenue", children: m.concentration })] }), _jsxs("td", { className: cn('tabular px-5 py-3 text-right font-medium', bajo && 'text-red-600'), children: [miles(m.vigente ?? m.currentStock), !!m.vencido && _jsxs("span", { className: "block text-xs font-normal text-red-600", children: ["+", miles(m.vencido), " vencidas"] })] }), _jsx("td", { className: "tabular px-5 py-3 text-right text-tenue", children: miles(m.stockMinimo) }), _jsx("td", { className: "px-5 py-3 whitespace-nowrap", children: m.proximoVencimiento ? (_jsxs(_Fragment, { children: [fechaDia(m.proximoVencimiento), " ", _jsxs("span", { className: "text-xs text-tenue", children: ["(", diasHasta(m.proximoVencimiento), " d\u00EDas)"] })] })) : (_jsx("span", { className: "text-tenue", children: "\u2014" })) }), _jsx("td", { className: "tabular px-5 py-3 text-right", children: m.lotesActivos ?? 0 }), _jsx("td", { className: "px-5 py-3", children: _jsx(Insignia, { color: e.color, children: e.texto }) })] }, m.id));
                    }) })) }), puedeGestionar && consulta.data && consulta.data.length > 0 && _jsx(PedidoSugerido, { medicamentos: consulta.data })] }));
}
/** /medicamentos/nuevo y /medicamentos/:id/editar (datos; la existencia se mueve con entradas y ajustes) */
export function MedicamentoEditor() {
    const id = Number(useParams().id) || undefined;
    const consulta = useMedicamento(id);
    if (id && consulta.isPending)
        return _jsx(Cargando, {});
    if (id && !consulta.data)
        return _jsx(Vacio, { titulo: "Medicamento no encontrado" });
    return _jsx(FormularioMedicamento, { medicamento: consulta.data ?? undefined });
}
function FormularioMedicamento({ medicamento }) {
    const cliente = useQueryClient();
    const navegar = useNavigate();
    const { register, handleSubmit, formState } = useForm({
        defaultValues: medicamento
            ? { name: medicamento.name, concentration: medicamento.concentration, stockMinimo: medicamento.stockMinimo, activo: medicamento.activo }
            : { name: '', concentration: '', stockMinimo: 20, activo: true },
    });
    const guardar = useMutation({
        mutationFn: (d) => {
            const datos = { ...d, name: d.name.trim(), concentration: d.concentration.trim(), stockMinimo: Number(d.stockMinimo) };
            return medicamento ? editarMedicamento(medicamento.id, datos) : crearMedicamento(datos);
        },
        onSuccess: (m) => {
            cliente.invalidateQueries({ queryKey: ['medicamentos'] });
            cliente.invalidateQueries({ queryKey: ['stats'] });
            toast.success(medicamento ? 'Medicamento actualizado' : 'Medicamento creado. Registra su primera entrada.');
            navegar(medicamento ? `/medicamentos/${m.id}` : `/medicamentos/entrada?med=${m.id}`, { replace: true });
        },
        onError: (e) => toast.error(e.message),
    });
    const e = formState.errors;
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: medicamento ? `${medicamento.name} ${medicamento.concentration}` : 'Nuevo medicamento', volver: medicamento ? { a: `/medicamentos/${medicamento.id}`, texto: 'Inventario' } : { a: '/medicamentos', texto: 'Inventario' } }), _jsxs("form", { onSubmit: handleSubmit((d) => guardar.mutate(d)), className: "max-w-2xl space-y-4", children: [_jsxs(Tarjeta, { titulo: "Medicamento", children: [_jsxs("div", { className: "grid gap-4 p-5 sm:grid-cols-2", children: [_jsx(Campo, { etiqueta: "Nombre", error: e.name && 'Requerido', className: "sm:col-span-2", children: _jsx(Entrada, { ...register('name', { required: true, validate: (v) => !!v.trim() }), placeholder: "Amlodipina", "aria-invalid": !!e.name }) }), _jsx(Campo, { etiqueta: "Concentraci\u00F3n", error: e.concentration && 'Requerida', children: _jsx(Entrada, { ...register('concentration', { required: true, validate: (v) => !!v.trim() }), placeholder: "5 mg", "aria-invalid": !!e.concentration }) }), _jsx(Campo, { etiqueta: "Existencia m\u00EDnima", ayuda: "Por debajo se avisa en el panel y en inventario.", error: e.stockMinimo && 'Debe ser 0 o más', children: _jsx(Entrada, { type: "number", min: 0, ...register('stockMinimo', { required: true, min: 0, valueAsNumber: true }) }) }), _jsx(Casilla, { etiqueta: "Activo (se puede recetar)", className: "sm:col-span-2", ...register('activo') })] }), !medicamento && _jsx("p", { className: "border-t border-borde px-5 py-3 text-sm text-tenue", children: "La existencia empieza en 0: despu\u00E9s de crearlo registras su primera entrada (lote)." })] }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Boton, { variante: "secundario", onClick: () => navegar(-1), children: "Cancelar" }), _jsx(Boton, { type: "submit", cargando: guardar.isPending, children: "Guardar" })] })] })] }));
}
