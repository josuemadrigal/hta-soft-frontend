import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { useCatalogoPermisos, useRol, useRoles } from '../api/consultas';
import { borrarRol, crearRol, editarRol } from '../api/recursos';
import { useConfirmar } from '../components/confirmar';
import { Boton, Campo, Cargando, EncabezadoPagina, Entrada, ErrorCarga, Insignia, Tabla, Tarjeta, Vacio } from '../components/ui';
import { cn } from '../lib/formato';
import { useVolver } from '../lib/navegacion';
export function Roles() {
    const consulta = useRoles();
    const catalogo = useCatalogoPermisos();
    const cliente = useQueryClient();
    const navegar = useNavigate();
    const confirmar = useConfirmar();
    const total = catalogo.data?.reduce((a, g) => a + g.permisos.length, 0);
    const borrar = useMutation({
        mutationFn: borrarRol,
        onSuccess: () => {
            cliente.invalidateQueries({ queryKey: ['roles'] });
            toast.success('Rol eliminado');
        },
        onError: (e) => toast.error(e.message),
    });
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: "Roles y permisos", descripcion: "Cada usuario tiene un rol; el rol define qu\u00E9 puede ver y hacer.", volver: { a: '/usuarios', texto: 'Usuarios' }, acciones: _jsx(Boton, { icono: _jsx(Plus, { className: "size-4" }), onClick: () => navegar('/roles/nuevo'), children: "Nuevo rol" }) }), _jsx(Tarjeta, { children: consulta.isPending ? (_jsx(Cargando, {})) : consulta.isError ? (_jsx(ErrorCarga, { error: consulta.error })) : (_jsx(Tabla, { columnas: ['Rol', 'Permisos', 'Usuarios', { texto: '', className: 'w-24' }], children: consulta.data.map((r) => (_jsxs("tr", { className: "hover:bg-fondo", children: [_jsxs("td", { className: "px-5 py-3", children: [_jsxs("p", { className: "flex items-center gap-1.5 font-medium", children: [r.name, " ", r.isSystem && _jsx(Lock, { className: "size-3.5 text-tenue" })] }), r.description && _jsx("p", { className: "text-xs text-tenue", children: r.description })] }), _jsxs("td", { className: "tabular px-5 py-3", children: [r.permissions.length, total && _jsxs("span", { className: "text-tenue", children: [" de ", total] })] }), _jsx("td", { className: "tabular px-5 py-3", children: r._count?.users ?? 0 }), _jsxs("td", { className: "px-5 py-2 text-right whitespace-nowrap", children: [_jsx(Boton, { variante: "fantasma", className: "h-8 px-2", "aria-label": "Editar", onClick: () => navegar(`/roles/${r.id}`), children: _jsx(Pencil, { className: "size-4" }) }), !r.isSystem && (_jsx(Boton, { variante: "fantasma", className: "h-8 px-2 hover:text-red-600", "aria-label": "Eliminar", onClick: async () => (await confirmar({
                                            titulo: `¿Eliminar el rol ${r.name}?`,
                                            mensaje: r._count?.users ? `Tiene ${r._count.users} usuario(s): cámbialos de rol antes de eliminarlo.` : 'Nadie tiene este rol asignado.',
                                        })) && borrar.mutate(r.id), children: _jsx(Trash2, { className: "size-4" }) }))] })] }, r.id))) })) })] }));
}
/** /roles/nuevo y /roles/:id */
export function RolEditor() {
    const id = Number(useParams().id) || undefined;
    const consulta = useRol(id);
    if (id && consulta.isPending)
        return _jsx(Cargando, {});
    if (id && !consulta.data)
        return _jsx(Vacio, { titulo: "Rol no encontrado" });
    return _jsx(FormularioRol, { rol: consulta.data });
}
function FormularioRol({ rol }) {
    const cliente = useQueryClient();
    const volverA = useVolver();
    const catalogo = useCatalogoPermisos();
    const bloqueado = !!rol?.isSystem;
    const { register, handleSubmit, formState, watch, setValue } = useForm({
        defaultValues: rol ? { name: rol.name, description: rol.description ?? '', permissions: rol.permissions } : { name: '', description: '', permissions: [] },
    });
    const permisos = watch('permissions');
    const guardar = useMutation({
        mutationFn: (d) => {
            const datos = { ...d, name: d.name.trim(), description: d.description?.trim() || undefined };
            // El Administrador solo admite cambiar la descripción.
            return rol ? editarRol(rol.id, bloqueado ? { description: datos.description } : datos) : crearRol(datos);
        },
        onSuccess: () => {
            cliente.invalidateQueries({ queryKey: ['roles'] });
            cliente.invalidateQueries({ queryKey: ['usuarios'] });
            toast.success(rol ? 'Rol actualizado' : 'Rol creado');
            volverA('/roles');
        },
        onError: (e) => toast.error(e.message),
    });
    const alternarGrupo = (claves, marcar) => setValue('permissions', marcar ? [...new Set([...permisos, ...claves])] : permisos.filter((p) => !claves.includes(p)), { shouldDirty: true });
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: rol ? `Rol ${rol.name}` : 'Nuevo rol', volver: { a: '/roles', texto: 'Roles y permisos' } }), _jsxs("form", { onSubmit: handleSubmit((d) => guardar.mutate(d)), className: "max-w-3xl space-y-4", children: [_jsxs(Tarjeta, { titulo: "Rol", children: [_jsxs("div", { className: "grid gap-4 p-5 sm:grid-cols-2", children: [_jsx(Campo, { etiqueta: "Nombre", error: formState.errors.name && 'Requerido', children: _jsx(Entrada, { disabled: bloqueado, ...register('name', { required: true, validate: (v) => !!v.trim() }), placeholder: "Promotor de salud" }) }), _jsx(Campo, { etiqueta: "Descripci\u00F3n", ayuda: "Opcional", children: _jsx(Entrada, { ...register('description') }) })] }), bloqueado && (_jsxs("p", { className: "flex items-center gap-2 border-t border-borde px-5 py-3 text-sm text-tenue", children: [_jsx(Lock, { className: "size-4" }), " El Administrador siempre tiene todos los permisos, para que nunca se pierda el acceso a la configuraci\u00F3n."] }))] }), _jsx(Tarjeta, { titulo: "Permisos", accion: _jsxs(Insignia, { children: [permisos.length, " marcados"] }), children: !catalogo.data ? (_jsx(Cargando, {})) : (_jsx("div", { className: "divide-y divide-borde", children: catalogo.data.map((g) => {
                                const claves = g.permisos.map((p) => p.clave);
                                const todos = claves.every((c) => permisos.includes(c));
                                return (_jsxs("fieldset", { disabled: bloqueado, className: "px-5 py-4", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsx("legend", { className: "text-xs font-semibold tracking-wider text-tenue uppercase", children: g.grupo }), !bloqueado && (_jsx("button", { type: "button", onClick: () => alternarGrupo(claves, !todos), className: "text-xs font-medium text-marca-700 hover:underline", children: todos ? 'Quitar todos' : 'Marcar todos' }))] }), _jsx("div", { className: "grid gap-2 sm:grid-cols-2", children: g.permisos.map((p) => (_jsxs("label", { className: cn('flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors', permisos.includes(p.clave) ? 'border-marca-200 bg-marca-50' : 'border-borde hover:bg-fondo', bloqueado && 'cursor-default'), children: [_jsx("input", { type: "checkbox", value: p.clave, ...register('permissions'), className: "mt-0.5 size-4 accent-marca-600" }), _jsxs("span", { children: [p.nombre, _jsx("span", { className: "block font-mono text-[11px] text-tenue", children: p.clave })] })] }, p.clave))) })] }, g.grupo));
                            }) })) }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Boton, { variante: "secundario", onClick: () => volverA('/roles'), children: "Cancelar" }), _jsx(Boton, { type: "submit", cargando: guardar.isPending, children: rol ? 'Guardar cambios' : 'Crear rol' })] })] })] }));
}
