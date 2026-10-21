import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CheckCircle2, MailCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { olvideContrasena, restablecerContrasena } from '../api/recursos';
import { PantallaAcceso } from '../components/PantallaAcceso';
import { Boton, Campo, Entrada } from '../components/ui';
const volver = (_jsx("p", { className: "text-center", children: _jsx(Link, { to: "/login", className: "text-sm text-tenue underline-offset-4 hover:text-tinta hover:underline", children: "Volver a iniciar sesi\u00F3n" }) }));
/** /olvide-contrasena — pide el enlace para poner una contraseña nueva. */
export function OlvideContrasena() {
    const inicial = useLocation().state?.email ?? '';
    const [enviadoA, setEnviadoA] = useState(null);
    const [error, setError] = useState(null);
    const { register, handleSubmit, formState } = useForm({ defaultValues: { email: inicial } });
    const alEnviar = handleSubmit(async ({ email }) => {
        setError(null);
        try {
            await olvideContrasena(email.trim());
            setEnviadoA(email.trim());
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo enviar. Intenta de nuevo.');
        }
    });
    if (enviadoA)
        return (_jsx(PantallaAcceso, { children: _jsxs("div", { className: "space-y-5", children: [_jsx(MailCheck, { className: "size-10 text-green-700" }), _jsx("h1", { className: "text-2xl font-semibold tracking-tight", children: "Revisa tu correo" }), _jsxs("p", { className: "text-tenue", children: ["Si ", _jsx("span", { className: "font-medium break-all text-tinta", children: enviadoA }), " tiene una cuenta, te enviamos un enlace para poner una contrase\u00F1a nueva. Vence en 1 hora."] }), _jsx("p", { className: "text-sm text-tenue", children: "\u00BFNo llega? Revisa la carpeta de spam o pide otro enlace en unos minutos. Si sigue sin llegar, pide al administrador que te cambie la contrase\u00F1a." }), volver] }) }));
    return (_jsx(PantallaAcceso, { children: _jsxs("form", { onSubmit: alEnviar, className: "space-y-5", noValidate: true, children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold tracking-tight", children: "\u00BFOlvidaste tu contrase\u00F1a?" }), _jsx("p", { className: "mt-2 text-tenue", children: "Escribe el correo de tu cuenta y te enviaremos un enlace para poner una nueva." })] }), _jsx(Campo, { etiqueta: "Correo", error: formState.errors.email?.message, children: _jsx(Entrada, { type: "email", autoComplete: "username", autoFocus: true, className: "h-11", ...register('email', { required: 'Escribe tu correo', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Correo no válido' } }), "aria-invalid": !!formState.errors.email }) }), error && _jsx("p", { className: "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700", children: error }), _jsx(Boton, { type: "submit", className: "h-11 w-full", cargando: formState.isSubmitting, children: "Enviar enlace" }), volver] }) }));
}
/** /restablecer-contrasena?token=… — el enlace del correo: pone la contraseña nueva. */
export function RestablecerContrasena() {
    const token = useSearchParams()[0].get('token') ?? '';
    const navegar = useNavigate();
    const [error, setError] = useState(token ? null : 'El enlace está incompleto. Ábrelo de nuevo desde el correo o pide otro.');
    const { register, handleSubmit, formState, getValues } = useForm({ defaultValues: { nueva: '', confirmar: '' } });
    const e = formState.errors;
    const alEnviar = handleSubmit(async ({ nueva }) => {
        setError(null);
        try {
            const r = await restablecerContrasena(token, nueva);
            navegar('/login', { replace: true, state: { aviso: 'Contraseña cambiada. Ya puedes entrar con la nueva.', email: r.email } });
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo cambiar la contraseña.');
        }
    });
    // Enlace usado o vencido: no tiene sentido mostrar el formulario.
    const sinArreglo = !token || (error && /no es válido|venció/.test(error));
    return (_jsx(PantallaAcceso, { children: sinArreglo ? (_jsxs("div", { className: "space-y-5", children: [_jsx("h1", { className: "text-2xl font-semibold tracking-tight", children: "El enlace ya no sirve" }), _jsx("p", { className: "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700", children: error }), _jsx(Link, { to: "/olvide-contrasena", className: "flex h-11 w-full items-center justify-center rounded-lg bg-marca-500 text-sm font-semibold text-tinta hover:bg-marca-600", children: "Pedir otro enlace" }), volver] })) : (_jsxs("form", { onSubmit: alEnviar, className: "space-y-5", noValidate: true, children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold tracking-tight", children: "Pon una contrase\u00F1a nueva" }), _jsx("p", { className: "mt-2 text-tenue", children: "Al guardarla se cierra la sesi\u00F3n en los dem\u00E1s dispositivos." })] }), _jsx(Campo, { etiqueta: "Contrase\u00F1a nueva", error: e.nueva?.message, ayuda: "Al menos 8 caracteres. Mejor una frase que una palabra.", children: _jsx(Entrada, { type: "password", autoComplete: "new-password", autoFocus: true, className: "h-11", ...register('nueva', {
                            required: 'Escribe la contraseña nueva',
                            minLength: { value: 8, message: 'Al menos 8 caracteres' },
                            maxLength: { value: 72, message: 'No puede pasar de 72 caracteres' },
                        }), "aria-invalid": !!e.nueva }) }), _jsx(Campo, { etiqueta: "Repetir la contrase\u00F1a nueva", error: e.confirmar?.message, children: _jsx(Entrada, { type: "password", autoComplete: "new-password", className: "h-11", ...register('confirmar', { validate: (v) => v === getValues('nueva') || 'No coincide' }), "aria-invalid": !!e.confirmar }) }), error && _jsx("p", { className: "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700", children: error }), _jsx(Boton, { type: "submit", className: "h-11 w-full", icono: _jsx(CheckCircle2, { className: "size-4" }), cargando: formState.isSubmitting, children: "Guardar contrase\u00F1a" }), volver] })) }));
}
