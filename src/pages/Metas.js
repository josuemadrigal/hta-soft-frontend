import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Pencil, Save, Target } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Bar, BarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { useComunidades, useMetas } from '../api/consultas';
import { guardarMetas } from '../api/recursos';
import { useSesion } from '../auth/sesion';
import { COLOR, EJE, TOOLTIP } from '../components/graficas';
import { Boton, Cargando, EncabezadoPagina, Entrada, ErrorCarga, Insignia, Selector, Tarjeta } from '../components/ui';
import { MOTIVOS_BAJA } from '../lib/etiquetas';
import { cn, fecha } from '../lib/formato';
import { AYUDA } from '../lib/ayuda-graficas';
const ESTADOS = {
    cumplida: { texto: 'Cumplida', color: '#15803d' },
    'en-camino': { texto: 'En camino', color: '#a16207' },
    atrasada: { texto: 'Atrasada', color: '#dc2626' },
    'sin-meta': { texto: 'Sin meta' },
    'sin-datos': { texto: 'Sin datos' },
};
export const formatoIndicador = (tipo, v) => (v === null ? '—' : tipo === 'pct' ? `${Math.round(v)}%` : v.toLocaleString('es-DO'));
/** /metas?anio= — metas anuales contra lo logrado, por trimestre y frente al año anterior. */
export function Metas() {
    const [params, setParams] = useSearchParams();
    const actual = new Date().getFullYear();
    const anio = Number(params.get('anio')) || actual;
    // Sin batey: las metas de toda la fundación; con batey, las de ese batey.
    const batey = Number(params.get('batey')) || undefined;
    const comunidades = useComunidades();
    const nombreBatey = comunidades.data?.find((c) => c.id === batey)?.name;
    const consulta = useMetas(anio, batey);
    const puedeEditar = useSesion().tiene('metas.gestionar');
    const [editando, setEditando] = useState(false);
    const cambiar = (c) => {
        setEditando(false);
        setParams((p) => {
            if (c.anio !== undefined)
                (c.anio === actual ? p.delete('anio') : p.set('anio', String(c.anio)));
            if (c.batey !== undefined)
                (c.batey ? p.set('batey', String(c.batey)) : p.delete('batey'));
            return p;
        }, { replace: true });
    };
    const cambiarAnio = (a) => cambiar({ anio: a });
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: "Metas e indicadores", descripcion: "Lo que la fundaci\u00F3n se propone cada a\u00F1o y c\u00F3mo va. Los porcentajes se comparan con la meta; los conteos, con lo que corresponde a la parte del a\u00F1o transcurrida.", acciones: _jsxs(_Fragment, { children: [_jsx(Selector, { "aria-label": "Batey", className: "w-56", vacio: "Toda la fundaci\u00F3n", value: batey ?? '', onChange: (e) => cambiar({ batey: Number(e.target.value) || null }), opciones: (comunidades.data ?? []).filter((c) => c.isActive || c.id === batey).map((c) => ({ value: c.id, label: c.name })) }), _jsxs("div", { className: "flex items-center rounded-lg border border-borde bg-superficie", children: [_jsx(Boton, { variante: "fantasma", className: "h-9 px-2", onClick: () => cambiarAnio(anio - 1), "aria-label": "A\u00F1o anterior", children: _jsx(ChevronLeft, { className: "size-4" }) }), _jsx("span", { className: "tabular px-2 font-semibold", children: anio }), _jsx(Boton, { variante: "fantasma", className: "h-9 px-2", disabled: anio >= actual + 1, onClick: () => cambiarAnio(anio + 1), "aria-label": "A\u00F1o siguiente", children: _jsx(ChevronRight, { className: "size-4" }) })] }), puedeEditar && !editando && (_jsxs(Boton, { icono: _jsx(Pencil, { className: "size-4" }), onClick: () => setEditando(true), children: ["Fijar metas ", anio, nombreBatey ? ` · ${nombreBatey}` : ''] }))] }) }), consulta.isPending ? (_jsx(Cargando, { forma: "pagina", texto: "Calculando indicadores\u2026" })) : consulta.isError ? (_jsx(ErrorCarga, { error: consulta.error })) : editando ? (_jsx(EditarMetas, { anio: anio, batey: batey, nombreBatey: nombreBatey, indicadores: consulta.data.indicadores, alTerminar: () => setEditando(false) })) : (_jsxs("div", { className: cn('space-y-4 transition-opacity', consulta.isPlaceholderData && 'opacity-60'), children: [anio === actual && (_jsxs("div", { className: "rounded-xl border border-borde bg-superficie p-4", children: [_jsxs("div", { className: "mb-1.5 flex justify-between text-sm", children: [_jsx("span", { className: "font-medium", children: "Avance del a\u00F1o" }), _jsxs("span", { className: "tabular text-tenue", children: [Math.round(consulta.data.fraccionAnio * 100), "%"] })] }), _jsx("div", { className: "h-2 overflow-hidden rounded-full bg-black/[0.06]", children: _jsx("div", { className: "h-full rounded-full bg-tinta/70", style: { width: `${consulta.data.fraccionAnio * 100}%` } }) })] })), !consulta.data.indicadores.some((i) => i.meta !== null) && (_jsxs("p", { className: "rounded-lg bg-marca-50 px-4 py-3 text-sm", children: [_jsx(Target, { className: "mr-1.5 inline size-4" }), " A\u00FAn no hay metas para ", anio, nombreBatey ? ` en ${nombreBatey}` : '', ".", puedeEditar ? ' Usa "Fijar metas" para definirlas; mientras tanto se muestran los valores logrados.' : ''] })), _jsx("div", { className: "grid gap-4 md:grid-cols-2 xl:grid-cols-4", children: consulta.data.indicadores.map((i) => (_jsx(TarjetaIndicador, { i: i, anio: anio, fraccion: consulta.data.fraccionAnio }, i.clave))) }), _jsx(Tarjeta, { titulo: `Bajas registradas en ${anio}`, children: _jsx("div", { className: "flex flex-wrap gap-6 p-5 text-sm", children: Object.keys(consulta.data.bajas).length === 0 ? (_jsx("span", { className: "text-tenue", children: "Ninguna baja con fecha en este a\u00F1o." })) : (Object.entries(consulta.data.bajas).map(([m, n]) => (_jsxs("div", { children: [_jsx("p", { className: "tabular text-2xl font-semibold", children: n }), _jsx("p", { className: "text-tenue", children: MOTIVOS_BAJA[m] })] }, m)))) }) })] }))] }));
}
function TarjetaIndicador({ i, anio, fraccion }) {
    const e = ESTADOS[i.estado];
    const fmt = (v) => formatoIndicador(i.tipo, v);
    // Avance hacia la meta: porcentaje alcanzado (para "menos es mejor", qué tan cerca está de bajar a la meta).
    const avance = i.meta !== null && i.valor !== null ? (i.mayorEsMejor ? Math.min(1, i.valor / (i.meta || 1)) : Math.min(1, (i.meta || 0.1) / Math.max(i.valor, 0.1))) : null;
    const cambio = i.valor !== null && i.anterior !== null ? i.valor - i.anterior : null;
    const mejora = cambio !== null && cambio !== 0 ? (cambio > 0) === i.mayorEsMejor : null;
    const esperado = i.tipo === 'conteo' && i.meta !== null && fraccion < 1 ? Math.round(i.meta * fraccion) : null;
    return (_jsx(Tarjeta, { titulo: i.nombre, copiable: true, ayuda: AYUDA.meta, accion: _jsx(Insignia, { color: e.color, children: e.texto }), children: _jsxs("div", { className: "space-y-3 p-5", children: [_jsx("p", { className: "text-xs text-tenue", children: i.descripcion }), _jsxs("div", { className: "flex items-end justify-between gap-2", children: [_jsx("p", { className: "tabular text-3xl font-semibold tracking-tight", children: fmt(i.valor) }), i.meta !== null && _jsxs("p", { className: "tabular pb-1 text-sm text-tenue", children: ["meta ", fmt(i.meta)] })] }), avance !== null && (_jsx("div", { className: "h-2 overflow-hidden rounded-full bg-black/[0.06]", children: _jsx("div", { className: "h-full rounded-full", style: { width: `${avance * 100}%`, backgroundColor: e.color ?? COLOR.amarillo } }) })), _jsxs("div", { className: "flex flex-wrap justify-between gap-x-3 text-xs text-tenue", children: [_jsxs("span", { className: "flex items-center gap-1", children: [anio - 1, ": ", fmt(i.anterior), mejora !== null && (mejora ? _jsx(ArrowUpRight, { className: "size-3.5 text-green-700" }) : _jsx(ArrowDownRight, { className: "size-3.5 text-red-600" }))] }), esperado !== null && _jsxs("span", { children: ["a esta altura: ", fmt(esperado)] })] }), i.trimestres.length > 0 && (_jsx("div", { className: "h-24", children: _jsx(ResponsiveContainer, { children: _jsxs(BarChart, { data: i.trimestres.map((t) => ({ ...t, etiqueta: t.etiqueta.split(' ')[0] })), margin: { top: 6, right: 0, left: 0, bottom: 0 }, children: [_jsx(XAxis, { dataKey: "etiqueta", ...EJE, fontSize: 11 }), _jsx(YAxis, { hide: true, domain: [0, i.tipo === 'pct' ? 100 : 'auto'] }), _jsx(Tooltip, { ...TOOLTIP, formatter: (v) => fmt(Number(v)) }), i.meta !== null && i.tipo === 'pct' && _jsx(ReferenceLine, { y: i.meta, stroke: COLOR.tinta, strokeDasharray: "4 3" }), _jsx(Bar, { dataKey: "valor", name: i.nombre, fill: COLOR.amarillo, radius: [3, 3, 0, 0], maxBarSize: 28 })] }) }) })), i.metaActualizada && _jsxs("p", { className: "text-[11px] text-tenue", children: ["Meta fijada por ", i.metaActualizada.por ?? '—', " el ", fecha(i.metaActualizada.fecha)] })] }) }));
}
function EditarMetas({ anio, batey, nombreBatey, indicadores, alTerminar }) {
    const cliente = useQueryClient();
    const [valores, setValores] = useState(Object.fromEntries(indicadores.map((i) => [i.clave, i.meta === null ? '' : String(i.meta)])));
    const guardar = useMutation({
        mutationFn: () => {
            const cambios = {};
            for (const i of indicadores) {
                const v = valores[i.clave].trim();
                const nuevo = v === '' ? null : Number(v);
                if (nuevo !== i.meta)
                    cambios[i.clave] = nuevo;
            }
            return guardarMetas(anio, cambios, batey);
        },
        onSuccess: (r) => {
            cliente.setQueryData(['metas', anio, batey ?? 0], r);
            cliente.invalidateQueries({ queryKey: ['donantes'] });
            toast.success(`Metas de ${anio}${nombreBatey ? ` para ${nombreBatey}` : ''} guardadas. El cambio quedó en Auditoría.`);
            alTerminar();
        },
        onError: (e) => toast.error(e.message),
    });
    const invalido = (i) => {
        const v = valores[i.clave].trim();
        if (v === '')
            return false;
        const n = Number(v);
        return Number.isNaN(n) || n < 0 || (i.tipo === 'pct' && n > 100);
    };
    return (_jsxs(Tarjeta, { titulo: `Metas para ${anio}${nombreBatey ? ` · ${nombreBatey}` : ' · toda la fundación'}`, className: "max-w-3xl", children: [_jsx("div", { className: "divide-y divide-borde", children: indicadores.map((i) => (_jsxs("div", { className: "grid items-center gap-3 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_140px]", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium", children: i.nombre }), _jsxs("p", { className: "text-xs text-tenue", children: [i.descripcion, " \u00B7 ", anio - 1, ": ", formatoIndicador(i.tipo, i.anterior), i.metaAnterior !== null && ` (meta ${formatoIndicador(i.tipo, i.metaAnterior)})`] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Entrada, { type: "number", min: 0, max: i.tipo === 'pct' ? 100 : undefined, placeholder: "Sin meta", value: valores[i.clave], onChange: (e) => setValores({ ...valores, [i.clave]: e.target.value }), "aria-invalid": invalido(i) }), _jsx("span", { className: "w-4 text-sm text-tenue", children: i.unidad })] })] }, i.clave))) }), _jsxs("div", { className: "flex justify-end gap-2 border-t border-borde p-5", children: [_jsx(Boton, { variante: "secundario", onClick: alTerminar, children: "Cancelar" }), _jsx(Boton, { icono: _jsx(Save, { className: "size-4" }), cargando: guardar.isPending, disabled: indicadores.some(invalido), onClick: () => guardar.mutate(), children: "Guardar metas" })] })] }));
}
