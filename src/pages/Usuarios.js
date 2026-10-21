import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Check, KeyRound, LockOpen, LogOut, MailCheck, MailWarning, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { useCatalogoPermisos, useRoles, useUsuario, useUsuarios } from '../api/consultas';
import { borrarUsuario, cerrarSesionesUsuario, crearUsuario, desbloquearUsuario, editarUsuario, reenviarConfirmacion, subirFotoUsuario } from '../api/recursos';
import { useSesion } from '../auth/sesion';
import { useConfirmar } from '../components/confirmar';
import { Avatar, Boton, Campo, Cargando, Casilla, EncabezadoPagina, Entrada, ErrorCarga, Insignia, Selector, Tabla, Tarjeta, Vacio } from '../components/ui';
import { cn, fecha, fechaYHora, nombreCompleto } from '../lib/formato';
import { useVolver } from '../lib/navegacion';
export function Usuarios() {
    const consulta = useUsuarios();
    const { usuario: yo, tiene } = useSesion();
    const cliente = useQueryClient();
    const navegar = useNavigate();
    const confirmar = useConfirmar();
    const borrar = useMutation({
        mutationFn: borrarUsuario,
        onSuccess: (r) => {
            for (const k of [['usuarios'], ['visitas'], ['medicos'], ['auditoria']])
                cliente.invalidateQueries({ queryKey: k });
            toast.success(r.visitasReasignadas ? `Usuario eliminado. ${r.visitasReasignadas.toLocaleString('es-DO')} visitas reasignadas a ${r.reasignadasA.firstName}, con su historial intacto.` : 'Usuario eliminado');
        },
        onError: (e) => toast.error(e.message),
    });
    const desbloquear = useMutation({
        mutationFn: (u) => desbloquearUsuario(u.id),
        onSuccess: (_, u) => {
            for (const k of [['usuarios'], ['auditoria']])
                cliente.invalidateQueries({ queryKey: k });
            toast.success(`${nombreCompleto(u)} ya puede volver a entrar`);
        },
        onError: (e) => toast.error(e.message),
    });
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: "Usuarios", descripcion: "Personal con acceso al sistema. Lo que cada quien puede hacer depende de su rol.", acciones: _jsxs(_Fragment, { children: [tiene('roles.gestionar') && (_jsx(Boton, { variante: "secundario", icono: _jsx(KeyRound, { className: "size-4" }), onClick: () => navegar('/roles'), children: "Roles y permisos" })), _jsx(Boton, { icono: _jsx(Plus, { className: "size-4" }), onClick: () => navegar('/usuarios/nuevo'), children: "Nuevo usuario" })] }) }), _jsx(Tarjeta, { children: consulta.isPending ? (_jsx(Cargando, {})) : consulta.isError ? (_jsx(ErrorCarga, { error: consulta.error })) : (_jsx(Tabla, { columnas: ['Usuario', 'Rol', 'Estado', 'Conexión', 'Alta', { texto: '', className: 'w-24' }], children: consulta.data.data.map((u) => {
                        // Bloqueado por intentos fallidos: se le quita el bloqueo sin esperar los 15 minutos.
                        const bloqueado = !!u.bloqueadoHasta && new Date(u.bloqueadoHasta) > new Date();
                        return (_jsxs("tr", { className: "hover:bg-fondo", children: [_jsx("td", { className: "px-5 py-3", children: _jsxs(Link, { to: `/usuarios/${u.id}`, className: "flex items-center gap-3", children: [_jsx(Avatar, { persona: u, foto: u.photoUrl, tamano: "size-8" }), _jsxs("div", { children: [_jsxs("p", { className: "font-medium", children: [nombreCompleto(u), " ", u.id === yo?.id && _jsx("span", { className: "text-xs font-normal text-tenue", children: "(t\u00FA)" })] }), _jsxs("p", { className: "text-xs text-tenue", children: [u.usuario && _jsxs("span", { className: "font-mono text-tinta/70", children: [u.usuario, " \u00B7 "] }), u.email, !u.emailVerificadoEn && _jsx("span", { className: "ml-1.5 text-amber-700", children: "\u00B7 sin confirmar" })] })] })] }) }), _jsx("td", { className: "px-5 py-3", children: u.role.name }), _jsx("td", { className: "px-5 py-3", children: bloqueado ? (_jsxs("div", { className: "flex flex-col items-start gap-1", children: [_jsx(Insignia, { color: "#dc2626", children: "Bloqueado" }), _jsxs("span", { className: "text-xs whitespace-nowrap text-tenue", children: ["Intentos fallidos \u00B7 hasta las ", new Date(u.bloqueadoHasta).toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit' })] })] })) : (_jsx(Insignia, { color: u.isActive ? '#15803d' : undefined, children: u.isActive ? 'Activo' : 'Inactivo' })) }), _jsx("td", { className: "px-5 py-3", children: _jsx(Conexion, { u: u }) }), _jsx("td", { className: "px-5 py-3 text-tenue", children: fecha(u.createdAt) }), _jsxs("td", { className: "px-5 py-2 text-right whitespace-nowrap", children: [bloqueado && (_jsx(Boton, { variante: "secundario", className: "mr-1 h-8 px-2.5 text-sm", icono: _jsx(LockOpen, { className: "size-4" }), cargando: desbloquear.isPending && desbloquear.variables?.id === u.id, onClick: () => desbloquear.mutate(u), children: "Desbloquear" })), _jsx(Boton, { variante: "fantasma", className: "h-8 px-2", "aria-label": "Editar", onClick: () => navegar(`/usuarios/${u.id}`), children: _jsx(Pencil, { className: "size-4" }) }), u.id !== yo?.id && (_jsx(Boton, { variante: "fantasma", className: "h-8 px-2 hover:text-red-600", "aria-label": "Eliminar", onClick: async () => (await confirmar({
                                                titulo: `¿Eliminar a ${nombreCompleto(u)}?`,
                                                mensaje: (_jsxs(_Fragment, { children: [_jsx("p", { children: "La cuenta se borra y no podr\u00E1 volver a entrar." }), _jsxs("p", { className: "mt-2", children: ["Si atendi\u00F3 visitas, pasan a tu cuenta de administrador, pero ", _jsxs("strong", { className: "text-tinta", children: ["cada visita seguir\u00E1 diciendo que la atendi\u00F3 ", nombreCompleto(u)] }), ' ', "y sus estad\u00EDsticas siguen en M\u00E9dicos. Queda registrado en Auditor\u00EDa."] }), _jsx("p", { className: "mt-2", children: "Si solo quieres que no entre, mejor desact\u00EDvalo." })] })),
                                            })) && borrar.mutate(u.id), children: _jsx(Trash2, { className: "size-4" }) }))] })] }, u.id));
                    }) })) })] }));
}
const HACE = new Intl.RelativeTimeFormat('es-DO', { numeric: 'auto' });
/** "hace 3 minutos", "ayer", "hace 5 días"… */
function hace(iso) {
    const s = (new Date(iso).getTime() - Date.now()) / 1000;
    const pasos = [
        ['minute', 60],
        ['hour', 3600],
        ['day', 86_400],
        ['month', 2_592_000],
    ];
    if (Math.abs(s) < 60)
        return 'hace un momento';
    for (let i = pasos.length - 1; i >= 0; i--)
        if (Math.abs(s) >= pasos[i][1])
            return HACE.format(Math.round(s / pasos[i][1]), pasos[i][0]);
    return HACE.format(Math.round(s / 60), 'minute');
}
/** En línea (usó la app hace menos de 5 minutos) o cuándo fue la última vez, y cuándo inició sesión. */
function Conexion({ u }) {
    const actividad = u.ultimaActividad ?? u.ultimoAcceso ?? null;
    const enLinea = !!u.ultimaActividad && Date.now() - new Date(u.ultimaActividad).getTime() < 5 * 60_000;
    return (_jsxs("div", { className: "text-sm whitespace-nowrap", children: [enLinea ? (_jsxs("span", { className: "flex items-center gap-1.5 font-medium text-green-700", children: [_jsxs("span", { className: "relative flex size-2", children: [_jsx("span", { className: "absolute inline-flex size-full rounded-full bg-green-500 opacity-60 motion-safe:animate-ping" }), _jsx("span", { className: "relative inline-flex size-2 rounded-full bg-green-600" })] }), "En l\u00EDnea"] })) : (_jsx("span", { className: "text-tenue", title: actividad ? fechaYHora(actividad) : undefined, children: actividad ? `Última vez ${hace(actividad)}` : 'Nunca ha entrado' })), u.ultimoAcceso && _jsxs("span", { className: "block text-xs text-tenue", children: ["Entr\u00F3: ", fechaYHora(u.ultimoAcceso)] })] }));
}
/** /usuarios/nuevo y /usuarios/:id */
export function UsuarioEditor() {
    const id = Number(useParams().id) || undefined;
    const consulta = useUsuario(id);
    // El <select> de rol necesita sus opciones al montarse; si no, muestra el primero (Administrador).
    const roles = useRoles();
    if ((id && consulta.isPending) || !roles.data)
        return _jsx(Cargando, {});
    if (id && !consulta.data)
        return _jsx(Vacio, { titulo: "Usuario no encontrado" });
    return _jsx(FormularioUsuario, { usuario: consulta.data ?? undefined });
}
function FormularioUsuario({ usuario }) {
    const cliente = useQueryClient();
    const navegar = useNavigate();
    const volverA = useVolver();
    const sesion = useSesion();
    const roles = useRoles();
    const catalogo = useCatalogoPermisos();
    const esYo = usuario?.id === sesion.usuario?.id;
    const { register, handleSubmit, formState, watch, getValues } = useForm({
        defaultValues: usuario
            ? { email: usuario.email, usuario: usuario.usuario ?? '', firstName: usuario.firstName, lastName: usuario.lastName, roleId: String(usuario.role.id), isActive: usuario.isActive, password: '', confirmar: '' }
            : { email: '', usuario: '', firstName: '', lastName: '', roleId: '', isActive: true, password: '', confirmar: '' },
    });
    const e = formState.errors;
    // La misma regla que el servidor: primer nombre.primer apellido, sin tildes.
    const limpio = (s) => (s.trim().split(/\s+/)[0] ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    const sugerencia = [limpio(watch('firstName') ?? ''), limpio(watch('lastName') ?? '')].filter(Boolean).join('.');
    const rolElegido = roles.data?.find((r) => r.id === Number(watch('roleId')));
    const guardar = useMutation({
        mutationFn: ({ confirmar: _c, ...d }) => {
            const datos = { ...d, roleId: Number(d.roleId), firstName: d.firstName.trim(), lastName: d.lastName.trim(), email: d.email.trim(), usuario: d.usuario?.trim().toLowerCase() };
            // Vacío al crear: el servidor lo arma con el nombre. Vacío al editar: se deja el que tenía.
            if (!datos.usuario)
                delete datos.usuario;
            if (!datos.password)
                delete datos.password; // vacío = no se cambia
            return usuario ? editarUsuario(usuario.id, datos) : crearUsuario(datos);
        },
        onSuccess: (u) => {
            // Un cambio de nombre se propaga a sus visitas y pacientes: se refresca todo lo que lo muestra.
            for (const k of [['usuarios'], ['pacientes'], ['paciente'], ['visitas'], ['jornada'], ['medicos'], ['auditoria']])
                cliente.invalidateQueries({ queryKey: k });
            if (u.id === sesion.usuario?.id)
                sesion.actualizarUsuario(u);
            const r = u;
            if (!usuario)
                toast.success(r.confirmacionEnviada ? `Usuario creado. Le enviamos un enlace a ${u.email} para confirmar su correo.` : 'Usuario creado. No se pudo enviar el correo de confirmación: reenvíalo desde su ficha.');
            else
                toast.success(u.email !== usuario.email ? `Usuario actualizado. Le enviamos un enlace a ${u.email} para confirmar el correo nuevo.` : 'Usuario actualizado');
            volverA('/usuarios');
        },
        onError: (err) => toast.error(err.message === 'User with this email already exists' ? 'Ya existe un usuario con ese correo.' : err.message),
    });
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: usuario ? nombreCompleto(usuario) : 'Nuevo usuario', volver: { a: '/usuarios', texto: 'Usuarios' } }), _jsxs("form", { onSubmit: handleSubmit((d) => guardar.mutate(d)), className: "grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]", noValidate: true, children: [_jsxs("div", { className: "space-y-4", children: [_jsx(Tarjeta, { titulo: "Datos personales", children: _jsxs("div", { className: "grid gap-4 p-5 sm:grid-cols-2", children: [_jsx(Campo, { etiqueta: "Nombres", error: e.firstName && 'Requerido', children: _jsx(Entrada, { ...register('firstName', { required: true, validate: (v) => !!v.trim() }), "aria-invalid": !!e.firstName }) }), _jsx(Campo, { etiqueta: "Apellidos", error: e.lastName && 'Requerido', children: _jsx(Entrada, { ...register('lastName', { required: true, validate: (v) => !!v.trim() }), "aria-invalid": !!e.lastName }) }), _jsx(Campo, { etiqueta: "Usuario para entrar", error: e.usuario && 'De 3 a 30 letras sin tilde, números, punto o guion', ayuda: usuario ? 'Puede entrar con este usuario o con su correo.' : `Si lo dejas vacío: ${sugerencia || 'nombre.apellido'}`, children: _jsx(Entrada, { autoComplete: "off", autoCapitalize: "none", spellCheck: false, placeholder: sugerencia || 'nombre.apellido', className: "font-mono", ...register('usuario', { pattern: /^[a-zA-Z0-9._-]{3,30}$/ }), "aria-invalid": !!e.usuario }) }), _jsx(Campo, { etiqueta: "Correo", error: e.email && 'Correo no válido', ayuda: "Para recuperar la contrase\u00F1a. Tambi\u00E9n sirve para entrar.", children: _jsx(Entrada, { type: "email", autoComplete: "off", ...register('email', { required: true, pattern: /^\S+@\S+\.\S+$/ }), "aria-invalid": !!e.email }) })] }) }), _jsx(Tarjeta, { titulo: usuario ? 'Cambiar contraseña' : 'Contraseña', children: _jsxs("div", { className: "grid gap-4 p-5 sm:grid-cols-2", children: [_jsx(Campo, { etiqueta: usuario ? 'Nueva contraseña' : 'Contraseña', error: e.password && 'Entre 8 y 72 caracteres', ayuda: usuario ? 'Déjala vacía para no cambiarla. Se cerrarán sus sesiones abiertas.' : 'Al menos 8 caracteres.', children: _jsx(Entrada, { type: "password", autoComplete: "new-password", ...register('password', { required: !usuario, validate: (v) => !v || (v.length >= 8 && v.length <= 72) }), "aria-invalid": !!e.password }) }), _jsx(Campo, { etiqueta: "Repetir contrase\u00F1a", error: e.confirmar && 'No coincide', children: _jsx(Entrada, { type: "password", autoComplete: "new-password", ...register('confirmar', { validate: (v) => (v ?? '') === (getValues('password') ?? '') }), "aria-invalid": !!e.confirmar }) })] }) }), _jsxs(Tarjeta, { titulo: "Acceso", children: [_jsxs("div", { className: "grid gap-4 p-5 sm:grid-cols-2", children: [_jsx(Campo, { etiqueta: "Rol", error: e.roleId && 'Elige un rol', ayuda: esYo ? 'No puedes cambiar tu propio rol.' : rolElegido?.description ?? undefined, children: _jsx(Selector, { vacio: usuario ? undefined : 'Elegir…', disabled: esYo, opciones: (roles.data ?? []).map((r) => ({ value: r.id, label: r.name })), ...register('roleId', { required: true }), "aria-invalid": !!e.roleId }) }), _jsx("div", { className: "flex items-end pb-2", children: _jsx(Casilla, { etiqueta: "Activo (puede iniciar sesi\u00F3n)", disabled: esYo, ...register('isActive') }) })] }), rolElegido && catalogo.data && (_jsxs("div", { className: "border-t border-borde px-5 py-4", children: [_jsxs("p", { className: "mb-3 text-xs font-medium tracking-wide text-tenue uppercase", children: ["Lo que podr\u00E1 hacer como ", rolElegido.name] }), _jsx("ul", { className: "grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2", children: catalogo.data.flatMap((g) => g.permisos).map((p) => {
                                                    const si = rolElegido.permissions.includes(p.clave);
                                                    return (_jsxs("li", { className: cn('flex items-start gap-2', !si && 'text-tenue/60 line-through'), children: [_jsx(Check, { className: cn('mt-0.5 size-4 shrink-0', si ? 'text-marca-600' : 'opacity-0') }), p.nombre] }, p.clave));
                                                }) })] }))] }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Boton, { variante: "secundario", onClick: () => navegar('/usuarios'), children: "Cancelar" }), _jsx(Boton, { type: "submit", cargando: guardar.isPending, children: usuario ? 'Guardar cambios' : 'Crear usuario' })] })] }), _jsx("aside", { className: "lg:sticky lg:top-6 lg:self-start", children: usuario ? (_jsxs("div", { className: "space-y-4", children: [_jsx(FotoUsuario, { usuario: usuario }), _jsx(CorreoUsuario, { usuario: usuario }), !esYo && _jsx(SesionesUsuario, { usuario: usuario })] })) : (_jsx(Tarjeta, { titulo: "Foto", children: _jsx("p", { className: "p-5 text-sm text-tenue", children: "Podr\u00E1s subir la foto despu\u00E9s de crear el usuario." }) })) })] })] }));
}
function CorreoUsuario({ usuario }) {
    const reenviar = useMutation({
        mutationFn: () => reenviarConfirmacion(usuario.id),
        onSuccess: (r) => toast.success(r.simulado ? 'Enlace generado: el servidor no tiene correo configurado (está en la consola del backend).' : `Enlace enviado a ${r.email}.`),
        onError: (e) => toast.error(e.message),
    });
    return (_jsx(Tarjeta, { titulo: "Correo", children: _jsx("div", { className: "space-y-3 p-5 text-sm", children: usuario.emailVerificadoEn ? (_jsxs("p", { className: "flex items-center gap-2 text-green-800", children: [_jsx(MailCheck, { className: "size-4" }), " Confirmado el ", fecha(usuario.emailVerificadoEn)] })) : (_jsxs(_Fragment, { children: [_jsxs("p", { className: "flex items-center gap-2 text-amber-800", children: [_jsx(MailWarning, { className: "size-4" }), " Sin confirmar"] }), _jsx("p", { className: "text-tenue", children: "Hasta que lo confirme no puede recibir los res\u00FAmenes de las jornadas." }), _jsx(Boton, { variante: "secundario", icono: _jsx(Send, { className: "size-4" }), cargando: reenviar.isPending, onClick: () => reenviar.mutate(), children: "Reenviar enlace" })] })) }) }));
}
/** Cerrar todas sus sesiones: si se perdió o se robaron una tablet, o dejó una sesión abierta en otra computadora. */
function SesionesUsuario({ usuario }) {
    const cliente = useQueryClient();
    const confirmar = useConfirmar();
    const cerrar = useMutation({
        mutationFn: () => cerrarSesionesUsuario(usuario.id),
        onSuccess: () => {
            for (const k of [['usuarios'], ['usuario', usuario.id], ['auditoria']])
                cliente.invalidateQueries({ queryKey: k });
            toast.success(`Listo: a ${nombreCompleto(usuario)} se le cierra la app en todos sus dispositivos en unos segundos.`);
        },
        onError: (e) => toast.error(e.message),
    });
    return (_jsx(Tarjeta, { titulo: "Sesiones", children: _jsxs("div", { className: "space-y-3 p-5 text-sm", children: [_jsxs("p", { className: "text-tenue", children: ["\u00DAltimo inicio de sesi\u00F3n: ", _jsx("span", { className: "text-tinta", children: usuario.ultimoAcceso ? fechaYHora(usuario.ultimoAcceso) : 'nunca' })] }), _jsx(Boton, { variante: "secundario", className: "w-full", icono: _jsx(LogOut, { className: "size-4" }), cargando: cerrar.isPending, onClick: async () => (await confirmar({
                        titulo: `¿Cerrar todas las sesiones de ${nombreCompleto(usuario)}?`,
                        mensaje: (_jsxs(_Fragment, { children: [_jsx("p", { children: "En cada tableta, tel\u00E9fono o computadora donde tenga la app abierta se le cierra en unos segundos, y tendr\u00E1 que volver a entrar con su contrase\u00F1a." }), _jsx("p", { className: "mt-2", children: "\u00DAsalo si se perdi\u00F3 una tableta o dej\u00F3 una sesi\u00F3n abierta en otro equipo. Lo que haya guardado sin internet no se pierde: se env\u00EDa cuando vuelva a entrar." })] })),
                        confirmar: 'Cerrar sesiones',
                    })) && cerrar.mutate(), children: "Cerrar todas sus sesiones" })] }) }));
}
function FotoUsuario({ usuario }) {
    const input = useRef(null);
    const cliente = useQueryClient();
    const sesion = useSesion();
    const subir = useMutation({
        mutationFn: (f) => subirFotoUsuario(usuario.id, f),
        onSuccess: (u) => {
            cliente.invalidateQueries({ queryKey: ['usuarios'] });
            if (u.id === sesion.usuario?.id)
                sesion.actualizarUsuario({ photoUrl: u.photoUrl });
            toast.success('Foto actualizada');
        },
        onError: (e) => toast.error(e.message),
    });
    const foto = subir.data?.photoUrl ?? usuario.photoUrl;
    return (_jsx(Tarjeta, { titulo: "Foto", children: _jsxs("div", { className: "flex flex-col items-center gap-4 p-5", children: [_jsx(Avatar, { persona: usuario, foto: foto, tamano: "size-28 text-2xl" }), _jsx(Boton, { variante: "secundario", icono: _jsx(Camera, { className: "size-4" }), cargando: subir.isPending, onClick: () => input.current?.click(), children: foto ? 'Cambiar foto' : 'Subir foto' }), _jsx("input", { ref: input, type: "file", accept: "image/png,image/jpeg", hidden: true, onChange: (e) => {
                        const f = e.target.files?.[0];
                        if (f)
                            subir.mutate(f);
                        e.target.value = '';
                    } })] }) }));
}
