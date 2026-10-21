import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, KeyRound, MailCheck, MailWarning, Send } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { cambiarContrasena, pedirConfirmacionCorreo } from '../api/recursos';
import { useSesion } from '../auth/sesion';
import { Avatar, Boton, Campo, EncabezadoPagina, Entrada, Tarjeta } from '../components/ui';
import { fechaYHora, nombreCompleto } from '../lib/formato';
/** /cuenta — datos propios, confirmar el correo y cambiar la contraseña. */
export function MiCuenta() {
    const { usuario, reemplazarSesion } = useSesion();
    const { register, handleSubmit, formState, getValues, reset, setError } = useForm({ defaultValues: { actual: '', nueva: '', confirmar: '' } });
    const e = formState.errors;
    const enlace = useMutation({
        mutationFn: pedirConfirmacionCorreo,
        onSuccess: (r) => toast.success(r.simulado ? 'Enlace generado. El servidor no tiene correo configurado: está en la consola del backend.' : `Te enviamos un enlace a ${r.email}. Revisa también la carpeta de spam.`),
        onError: (err) => toast.error(err.message),
    });
    const guardar = useMutation({
        mutationFn: (d) => cambiarContrasena(d.actual, d.nueva),
        onSuccess: (sesion) => {
            reemplazarSesion(sesion);
            reset();
            toast.success('Contraseña cambiada. Se cerraron tus sesiones en otros dispositivos.');
        },
        onError: (err) => {
            if (err.message.includes('actual'))
                setError('actual', { message: err.message });
            else if (err.message.includes('contraseña'))
                setError('nueva', { message: err.message });
            else
                toast.error(err.message);
        },
    });
    if (!usuario)
        return null;
    const confirmado = !!usuario.emailVerificadoEn;
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: "Mi cuenta", descripcion: "Tu correo y tu contrase\u00F1a." }), _jsxs("div", { className: "max-w-2xl space-y-4", children: [_jsxs(Tarjeta, { titulo: "Datos", children: [_jsxs("div", { className: "flex items-center gap-4 p-5", children: [_jsx(Avatar, { persona: usuario, foto: usuario.photoUrl, tamano: "size-12" }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "font-medium", children: nombreCompleto(usuario) }), _jsx("p", { className: "text-sm text-tenue", children: usuario.role?.name })] })] }), usuario.usuario && (_jsxs("div", { className: "flex flex-wrap items-baseline justify-between gap-2 border-t border-borde px-5 py-3", children: [_jsx("span", { className: "text-sm text-tenue", children: "Usuario para entrar" }), _jsx("span", { className: "font-mono font-medium", children: usuario.usuario })] })), _jsx("p", { className: "border-t border-borde px-5 py-3 text-sm text-tenue", children: "Para cambiar tu nombre, tu usuario, tu rol o tu correo, p\u00EDdeselo a quien administra los usuarios." })] }), _jsx(Tarjeta, { titulo: "Correo", children: _jsxs("div", { className: "flex flex-wrap items-center gap-4 p-5", children: [confirmado ? _jsx(MailCheck, { className: "size-6 shrink-0 text-green-700" }) : _jsx(MailWarning, { className: "size-6 shrink-0 text-amber-600" }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "font-medium break-all", children: usuario.email }), _jsx("p", { className: "text-sm text-tenue", children: confirmado
                                                ? `Confirmado el ${fechaYHora(usuario.emailVerificadoEn)}.`
                                                : 'Sin confirmar. Hasta que lo confirmes no puedes recibir los resúmenes de las jornadas.' })] }), !confirmado && (_jsx(Boton, { icono: _jsx(Send, { className: "size-4" }), cargando: enlace.isPending, onClick: () => enlace.mutate(), children: "Enviarme el enlace" }))] }) }), _jsx(Tarjeta, { titulo: "Cambiar contrase\u00F1a", children: _jsxs("form", { onSubmit: handleSubmit((d) => guardar.mutate(d)), noValidate: true, children: [_jsxs("div", { className: "grid gap-4 p-5 sm:grid-cols-2", children: [_jsx(Campo, { etiqueta: "Contrase\u00F1a actual", error: e.actual?.message, className: "sm:col-span-2 sm:max-w-[calc(50%-0.5rem)]", children: _jsx(Entrada, { type: "password", autoComplete: "current-password", ...register('actual', { required: 'Escribe tu contraseña actual' }), "aria-invalid": !!e.actual }) }), _jsx(Campo, { etiqueta: "Contrase\u00F1a nueva", error: e.nueva?.message, ayuda: "Al menos 8 caracteres. Mejor una frase que una palabra.", children: _jsx(Entrada, { type: "password", autoComplete: "new-password", ...register('nueva', {
                                                    required: 'Escribe la contraseña nueva',
                                                    minLength: { value: 8, message: 'Al menos 8 caracteres' },
                                                    maxLength: { value: 72, message: 'Máximo 72 caracteres' },
                                                    validate: (v) => v !== getValues('actual') || 'Debe ser distinta de la actual',
                                                }), "aria-invalid": !!e.nueva }) }), _jsx(Campo, { etiqueta: "Repetir la contrase\u00F1a nueva", error: e.confirmar?.message, children: _jsx(Entrada, { type: "password", autoComplete: "new-password", ...register('confirmar', { validate: (v) => v === getValues('nueva') || 'No coincide' }), "aria-invalid": !!e.confirmar }) })] }), _jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 border-t border-borde px-5 py-3", children: [_jsx("p", { className: "text-sm text-tenue", children: usuario.contrasenaCambiadaEn ? (_jsxs("span", { className: "inline-flex items-center gap-1.5", children: [_jsx(CheckCircle2, { className: "size-4" }), " \u00DAltimo cambio: ", fechaYHora(usuario.contrasenaCambiadaEn)] })) : ('Al cambiarla se cierran tus sesiones en otros dispositivos.') }), _jsx(Boton, { type: "submit", icono: _jsx(KeyRound, { className: "size-4" }), cargando: guardar.isPending, children: "Cambiar contrase\u00F1a" })] })] }) })] })] }));
}
