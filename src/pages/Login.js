import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import { useSesion } from '../auth/sesion';
import { PantallaAcceso } from '../components/PantallaAcceso';
import { Boton, Campo, Entrada } from '../components/ui';
const esquema = z.object({
    email: z.string().trim().min(1, 'Escribe tu usuario o tu correo'),
    password: z.string().min(1, 'Escribe la contraseña'),
});
export function Login() {
    const { usuario, entrar } = useSesion();
    const navegar = useNavigate();
    const estado = useLocation().state;
    const desde = estado?.desde ?? '/';
    const [error, setError] = useState(null);
    const { register, handleSubmit, formState, watch } = useForm({ resolver: zodResolver(esquema), defaultValues: { email: estado?.email ?? '', password: '' } });
    if (usuario)
        return _jsx(Navigate, { to: desde, replace: true });
    const alEnviar = handleSubmit(async ({ email, password }) => {
        setError(null);
        try {
            await entrar(email, password);
            navegar(desde, { replace: true });
        }
        catch (e) {
            setError(e instanceof Error && e.message !== 'Invalid credentials' ? e.message : 'Usuario o contraseña incorrectos.');
        }
    });
    return (_jsx(PantallaAcceso, { children: _jsxs("form", { onSubmit: alEnviar, className: "space-y-5", noValidate: true, children: [_jsx("h1", { className: "text-2xl font-semibold tracking-tight", children: "Iniciar sesi\u00F3n" }), estado?.aviso && !error && _jsx("p", { className: "rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800", children: estado.aviso }), _jsx(Campo, { etiqueta: "Usuario o correo", error: formState.errors.email?.message, children: _jsx(Entrada, { autoComplete: "username", autoCapitalize: "none", autoCorrect: "off", spellCheck: false, autoFocus: !estado?.email, ...register('email'), className: "h-11", "aria-invalid": !!formState.errors.email }) }), _jsx(Campo, { etiqueta: "Contrase\u00F1a", error: formState.errors.password?.message, children: _jsx(Entrada, { type: "password", autoComplete: "current-password", autoFocus: !!estado?.email, ...register('password'), className: "h-11", "aria-invalid": !!formState.errors.password }) }), error && _jsx("p", { className: "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700", children: error }), _jsx(Boton, { type: "submit", className: "h-11 w-full", cargando: formState.isSubmitting, children: "Entrar" }), _jsx("p", { className: "text-center", children: _jsx(Link, { to: "/olvide-contrasena", state: { email: watch('email').includes('@') ? watch('email') : '' }, className: "text-sm text-tenue underline-offset-4 hover:text-tinta hover:underline", children: "\u00BFOlvidaste tu contrase\u00F1a?" }) })] }) }));
}
