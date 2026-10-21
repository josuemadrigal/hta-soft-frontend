import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { obtenerYo, confirmarCorreo } from '../api/recursos';
import { useSesion } from '../auth/sesion';
// El enlace es de un solo uso: si React monta la página dos veces, se reutiliza la misma petición.
const pedidos = new Map();
/** /confirmar-correo?token=… — el enlace del correo. No pide sesión: se puede abrir en el teléfono. */
export function ConfirmarCorreo() {
    const token = useSearchParams()[0].get('token') ?? '';
    const { usuario, actualizarUsuario } = useSesion();
    const [estado, setEstado] = useState(token ? null : { ok: false, error: 'Falta el código del enlace.' });
    useEffect(() => {
        if (!token)
            return;
        if (!pedidos.has(token))
            pedidos.set(token, confirmarCorreo(token));
        pedidos
            .get(token)
            .then((r) => {
            setEstado({ ok: true, email: r.email });
            // Si hay sesión abierta en este navegador, que "Mi cuenta" lo muestre ya confirmado.
            if (usuario)
                obtenerYo().then(actualizarUsuario, () => undefined);
        })
            .catch((e) => setEstado({ ok: false, error: e.message }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);
    return (_jsx("div", { className: "grid min-h-dvh place-items-center bg-fondo px-4", children: _jsxs("div", { className: "w-full max-w-md rounded-2xl border border-borde bg-superficie p-8 text-center shadow-sm", children: [_jsx("img", { src: "/logo-mapa.png", alt: "", className: "mx-auto mb-6 w-16" }), !estado ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "mx-auto size-10 animate-spin text-tenue" }), _jsx("p", { className: "mt-4 text-tenue", children: "Confirmando tu correo\u2026" })] })) : estado.ok ? (_jsxs(_Fragment, { children: [_jsx(CheckCircle2, { className: "mx-auto size-12 text-green-700" }), _jsx("h1", { className: "mt-4 text-xl font-semibold", children: "Correo confirmado" }), _jsxs("p", { className: "mt-2 text-sm text-tenue", children: [_jsx("span", { className: "font-medium text-tinta break-all", children: estado.email }), " ya puede recibir los res\u00FAmenes de las jornadas."] })] })) : (_jsxs(_Fragment, { children: [_jsx(XCircle, { className: "mx-auto size-12 text-red-600" }), _jsx("h1", { className: "mt-4 text-xl font-semibold", children: "No se pudo confirmar" }), _jsx("p", { className: "mt-2 text-sm text-tenue", children: estado.error })] })), estado && (_jsx(Link, { to: usuario ? '/cuenta' : '/login', className: "mt-6 inline-flex h-9 items-center rounded-lg bg-marca-500 px-4 text-sm font-semibold text-tinta hover:bg-marca-600", children: usuario ? 'Ir a Mi cuenta' : 'Iniciar sesión' }))] }) }));
}
