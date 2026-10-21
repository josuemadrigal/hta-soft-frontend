import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { useConfigPA, useConfigPAUna } from '../api/consultas';
import { borrarConfigPA, crearConfigPA, editarConfigPA } from '../api/recursos';
import { useConfirmar } from '../components/confirmar';
import { Boton, Campo, Cargando, EncabezadoPagina, Entrada, ErrorCarga, InsigniaCategoria, Selector, Tabla, Tarjeta, Vacio } from '../components/ui';
import { CATEGORIAS, colorCategoria, opciones } from '../lib/etiquetas';
import { useVolver } from '../lib/navegacion';
export function ClasificacionPA() {
    const consulta = useConfigPA();
    const cliente = useQueryClient();
    const navegar = useNavigate();
    const confirmar = useConfirmar();
    const borrar = useMutation({
        mutationFn: borrarConfigPA,
        onSuccess: () => {
            cliente.invalidateQueries({ queryKey: ['config-pa'] });
            toast.success('Rango eliminado');
        },
        onError: () => toast.error('No se puede eliminar: hay visitas clasificadas con este rango.'),
    });
    const lista = [...(consulta.data ?? [])].sort((a, b) => a.priority - b.priority);
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: "Clasificaci\u00F3n de la presi\u00F3n arterial", descripcion: "Rangos (ESH) que usa el sistema para clasificar cada toma. Si la sist\u00F3lica y la diast\u00F3lica caen en categor\u00EDas distintas, gana la m\u00E1s alta.", acciones: _jsx(Boton, { icono: _jsx(Plus, { className: "size-4" }), onClick: () => navegar('/clasificacion/nueva'), children: "Nuevo rango" }) }), _jsx(Tarjeta, { children: consulta.isPending ? (_jsx(Cargando, {})) : consulta.isError ? (_jsx(ErrorCarga, { error: consulta.error })) : (_jsx(Tabla, { columnas: ['Categoría', 'Sistólica', 'Diastólica', 'Prioridad', { texto: '', className: 'w-24' }], children: lista.map((c) => (_jsxs("tr", { className: "hover:bg-fondo", children: [_jsx("td", { className: "px-5 py-3", children: _jsx(InsigniaCategoria, { config: c }) }), _jsxs("td", { className: "tabular px-5 py-3 font-mono", children: [c.systolicMin, "\u2013", c.systolicMax] }), _jsxs("td", { className: "tabular px-5 py-3 font-mono", children: [c.diastolicMin, "\u2013", c.diastolicMax] }), _jsx("td", { className: "tabular px-5 py-3", children: c.priority }), _jsxs("td", { className: "px-5 py-2 text-right whitespace-nowrap", children: [_jsx(Boton, { variante: "fantasma", className: "h-8 px-2", "aria-label": "Editar", onClick: () => navegar(`/clasificacion/${c.id}`), children: _jsx(Pencil, { className: "size-4" }) }), _jsx(Boton, { variante: "fantasma", className: "h-8 px-2 hover:text-red-600", "aria-label": "Eliminar", onClick: async () => (await confirmar({ titulo: `¿Eliminar el rango ${CATEGORIAS[c.categoryName]}?`, mensaje: 'Las tomas nuevas que caigan en estos valores ya no tendrán esta clasificación.' })) &&
                                            borrar.mutate(c.id), children: _jsx(Trash2, { className: "size-4" }) })] })] }, c.id))) })) })] }));
}
/** /clasificacion/nueva y /clasificacion/:id */
export function ClasificacionEditor() {
    const id = Number(useParams().id) || undefined;
    const consulta = useConfigPAUna(id);
    if (id && consulta.isPending)
        return _jsx(Cargando, {});
    if (id && !consulta.data)
        return _jsx(Vacio, { titulo: "Rango no encontrado" });
    return _jsx(FormularioConfig, { config: consulta.data ?? undefined });
}
function FormularioConfig({ config }) {
    const cliente = useQueryClient();
    const volverA = useVolver();
    const { register, handleSubmit, formState, getValues } = useForm({
        defaultValues: config
            ? { ...config, colorHex: colorCategoria(config) }
            : { categoryName: 'NORMAL', systolicMin: 0, systolicMax: 0, diastolicMin: 0, diastolicMax: 0, priority: 1, colorHex: '#15803d' },
    });
    const guardar = useMutation({
        mutationFn: (d) => (config ? editarConfigPA(config.id, d) : crearConfigPA(d)),
        onSuccess: () => {
            cliente.invalidateQueries({ queryKey: ['config-pa'] });
            toast.success('Rango guardado');
            volverA('/clasificacion');
        },
        onError: (e) => toast.error(e.message),
    });
    const e = formState.errors;
    const n = { valueAsNumber: true, required: true, min: 0 };
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: config ? `Rango ${CATEGORIAS[config.categoryName]}` : 'Nuevo rango', volver: { a: '/clasificacion', texto: 'Clasificación PA' } }), _jsxs("form", { onSubmit: handleSubmit((d) => guardar.mutate(d)), className: "max-w-2xl space-y-4", children: [_jsx(Tarjeta, { titulo: "Rango", children: _jsxs("div", { className: "grid gap-4 p-5 sm:grid-cols-2", children: [_jsx(Campo, { etiqueta: "Categor\u00EDa", children: _jsx(Selector, { opciones: opciones(CATEGORIAS), ...register('categoryName') }) }), _jsx(Campo, { etiqueta: "Prioridad", ayuda: "Mayor n\u00FAmero = m\u00E1s grave. Decide cuando una toma cae en dos rangos.", error: e.priority && 'Requerida', children: _jsx(Entrada, { type: "number", ...register('priority', { valueAsNumber: true, required: true }) }) }), _jsx(Campo, { etiqueta: "Sist\u00F3lica m\u00EDnima", error: e.systolicMin && 'Valor no válido', children: _jsx(Entrada, { type: "number", ...register('systolicMin', n) }) }), _jsx(Campo, { etiqueta: "Sist\u00F3lica m\u00E1xima", error: e.systolicMax && 'Debe ser ≥ a la mínima', children: _jsx(Entrada, { type: "number", ...register('systolicMax', { ...n, validate: (v) => v >= getValues('systolicMin') }) }) }), _jsx(Campo, { etiqueta: "Diast\u00F3lica m\u00EDnima", error: e.diastolicMin && 'Valor no válido', children: _jsx(Entrada, { type: "number", ...register('diastolicMin', n) }) }), _jsx(Campo, { etiqueta: "Diast\u00F3lica m\u00E1xima", error: e.diastolicMax && 'Debe ser ≥ a la mínima', children: _jsx(Entrada, { type: "number", ...register('diastolicMax', { ...n, validate: (v) => v >= getValues('diastolicMin') }) }) }), _jsx(Campo, { etiqueta: "Color", children: _jsx(Entrada, { type: "color", className: "h-9 p-1", ...register('colorHex') }) })] }) }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Boton, { variante: "secundario", onClick: () => volverA('/clasificacion'), children: "Cancelar" }), _jsx(Boton, { type: "submit", cargando: guardar.isPending, children: "Guardar" })] })] })] }));
}
