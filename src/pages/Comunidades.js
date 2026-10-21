import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { useComunidad, useComunidades } from '../api/consultas';
import { crearComunidad, editarComunidad } from '../api/recursos';
import { useSesion } from '../auth/sesion';
import { useConfirmar } from '../components/confirmar';
import { SelectorUbicacion } from '../components/Mapa';
import { Boton, Campo, Cargando, Casilla, EncabezadoPagina, Entrada, ErrorCarga, Insignia, Tabla, Tarjeta, Vacio } from '../components/ui';
import { useVolver } from '../lib/navegacion';
export function Comunidades() {
    const consulta = useComunidades();
    const navegar = useNavigate();
    const puedeGestionar = useSesion().tiene('comunidades.gestionar');
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: "Bateyes", descripcion: "Cada batey tiene su propia secuencia de c\u00F3digos de paciente.", acciones: puedeGestionar && (_jsx(Boton, { icono: _jsx(Plus, { className: "size-4" }), onClick: () => navegar('/comunidades/nueva'), children: "Nuevo batey" })) }), _jsx(Tarjeta, { children: consulta.isPending ? (_jsx(Cargando, {})) : consulta.isError ? (_jsx(ErrorCarga, { error: consulta.error })) : consulta.data.length === 0 ? (_jsx(Vacio, { icono: _jsx(MapPin, { className: "size-8" }), titulo: "Sin bateyes" })) : (_jsx(Tabla, { columnas: ['Batey', 'Prefijo', 'Municipio', 'Provincia', 'Próximo código', 'Estado', { texto: '', className: 'w-14' }], children: consulta.data.map((c) => (_jsxs("tr", { className: "hover:bg-fondo", children: [_jsx("td", { className: "px-5 py-3 font-medium", children: c.name }), _jsx("td", { className: "px-5 py-3 font-mono text-[13px]", children: c.abbreviation }), _jsx("td", { className: "px-5 py-3", children: c.municipality }), _jsx("td", { className: "px-5 py-3", children: c.province }), _jsxs("td", { className: "px-5 py-3 font-mono text-[13px] text-tenue", children: [c.abbreviation, c.sequenceCounter + 1] }), _jsx("td", { className: "px-5 py-3", children: _jsx(Insignia, { color: c.isActive ? '#15803d' : undefined, children: c.isActive ? 'Activo' : 'Inactivo' }) }), _jsx("td", { className: "px-5 py-2 text-right", children: puedeGestionar && (_jsx(Boton, { variante: "fantasma", className: "h-8 px-2", "aria-label": "Editar", onClick: () => navegar(`/comunidades/${c.id}`), children: _jsx(Pencil, { className: "size-4" }) })) })] }, c.id))) })) })] }));
}
/** /comunidades/nueva y /comunidades/:id */
export function ComunidadEditor() {
    const id = Number(useParams().id) || undefined;
    const consulta = useComunidad(id);
    if (id && consulta.isPending)
        return _jsx(Cargando, {});
    if (id && !consulta.data)
        return _jsx(Vacio, { titulo: "Batey no encontrado" });
    return _jsx(FormularioComunidad, { comunidad: consulta.data ?? undefined });
}
function FormularioComunidad({ comunidad }) {
    const cliente = useQueryClient();
    const volverA = useVolver();
    const { register, handleSubmit, watch, formState } = useForm({
        defaultValues: comunidad ?? { name: '', abbreviation: '', municipality: '', province: '', sequenceCounter: 1000, isActive: true },
    });
    const [ubicacion, setUbicacion] = useState(comunidad?.latitud != null && comunidad.longitud != null ? { lat: comunidad.latitud, lng: comunidad.longitud } : null);
    const guardar = useMutation({
        mutationFn: (d) => {
            const base = {
                name: d.name.trim(),
                municipality: d.municipality.trim(),
                province: d.province.trim(),
                isActive: d.isActive,
                latitud: ubicacion?.lat ?? null,
                longitud: ubicacion?.lng ?? null,
            };
            const prefijo = d.abbreviation.trim().toUpperCase();
            return comunidad
                ? editarComunidad(comunidad.id, prefijo !== comunidad.abbreviation ? { ...base, abbreviation: prefijo } : base)
                : crearComunidad({ ...base, abbreviation: d.abbreviation.trim().toUpperCase(), sequenceCounter: Number(d.sequenceCounter) });
        },
        onSuccess: () => {
            cliente.invalidateQueries({ queryKey: ['comunidades'] });
            cliente.invalidateQueries({ queryKey: ['bateyes-indicadores'] });
            toast.success(comunidad ? 'Batey actualizado' : 'Batey creado');
            volverA('/comunidades');
        },
        onError: (e) => toast.error(e.message === 'Abbreviation already exists' ? 'Ya existe un batey con ese prefijo.' : e.message),
    });
    const e = formState.errors;
    const requerido = { required: true, validate: (v) => typeof v === 'string' && !!v.trim() };
    const [abrev, seq] = watch(['abbreviation', 'sequenceCounter']);
    const confirmar = useConfirmar();
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: comunidad ? comunidad.name : 'Nuevo batey', volver: { a: '/comunidades', texto: 'Bateyes' } }), _jsxs("form", { onSubmit: handleSubmit(async (d) => {
                    const prefijo = d.abbreviation.trim().toUpperCase();
                    if (comunidad &&
                        prefijo !== comunidad.abbreviation &&
                        !(await confirmar({
                            titulo: `¿Cambiar el prefijo de ${comunidad.abbreviation} a ${prefijo}?`,
                            mensaje: `Los códigos que ya tienen los pacientes no cambian. Los pacientes nuevos de ${comunidad.name} recibirán códigos ${prefijo}, siguiendo la numeración que ya exista con ese prefijo. A un paciente con código de otro batey se le puede regenerar desde su ficha. El cambio queda en Auditoría.`,
                            confirmar: 'Cambiar prefijo',
                            peligro: false,
                        })))
                        return;
                    guardar.mutate(d);
                }), className: "max-w-2xl space-y-4", children: [_jsx(Tarjeta, { titulo: "Batey", children: _jsxs("div", { className: "grid gap-4 p-5 sm:grid-cols-2", children: [_jsx(Campo, { etiqueta: "Nombre", error: e.name && 'Requerido', className: "sm:col-span-2", children: _jsx(Entrada, { ...register('name', requerido), "aria-invalid": !!e.name }) }), _jsx(Campo, { etiqueta: "Municipio", error: e.municipality && 'Requerido', children: _jsx(Entrada, { ...register('municipality', requerido), "aria-invalid": !!e.municipality }) }), _jsx(Campo, { etiqueta: "Provincia", error: e.province && 'Requerida', children: _jsx(Entrada, { ...register('province', requerido), "aria-invalid": !!e.province }) }), _jsx(Campo, { etiqueta: "Prefijo de c\u00F3digos", error: e.abbreviation && 'De 2 a 6 letras o números', ayuda: comunidad ? 'Si lo cambias, los códigos ya emitidos se quedan como están; los nuevos usarán este prefijo.' : 'Ej.: MG para Magdalena', children: _jsx(Entrada, { className: "uppercase", maxLength: 6, ...register('abbreviation', { required: true, pattern: /^[A-Za-z0-9]{2,6}$/ }), "aria-invalid": !!e.abbreviation }) }), !comunidad && (_jsx(Campo, { etiqueta: "Secuencia inicial", ayuda: `Primer código: ${(abrev || 'XX').toUpperCase()}${Number(seq || 0) + 1}`, children: _jsx(Entrada, { type: "number", min: 0, ...register('sequenceCounter', { valueAsNumber: true, min: 0 }) }) })), _jsx(Casilla, { etiqueta: "Activo (aparece en la jornada y en los formularios)", className: "sm:col-span-2", ...register('isActive') })] }) }), _jsxs(Tarjeta, { titulo: "Ubicaci\u00F3n en el mapa", accion: ubicacion ? (_jsx("button", { type: "button", onClick: () => setUbicacion(null), className: "text-xs text-tenue hover:text-red-600", children: "Quitar ubicaci\u00F3n" })) : (_jsx("span", { className: "text-xs text-tenue", children: "Toca el mapa donde est\u00E1 el batey" })), children: [_jsx("div", { className: "p-3", children: _jsx(SelectorUbicacion, { valor: ubicacion, alCambiar: setUbicacion }) }), _jsx("p", { className: "border-t border-borde px-5 py-2.5 text-xs text-tenue", children: ubicacion ? `${ubicacion.lat}, ${ubicacion.lng} · toca otro punto para moverlo` : 'Sin ubicación: no aparece en el mapa de bateyes.' })] }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Boton, { variante: "secundario", onClick: () => volverA('/comunidades'), children: "Cancelar" }), _jsx(Boton, { type: "submit", cargando: guardar.isPending, children: comunidad ? 'Guardar cambios' : 'Crear batey' })] })] })] }));
}
