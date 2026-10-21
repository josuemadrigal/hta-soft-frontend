import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
/**
 * Marco de las pantallas sin sesión (iniciar sesión, olvidé mi contraseña, restablecerla):
 * foto apagada con el mensaje de la fundación a la izquierda en escritorio, o como franja arriba
 * en tablet y teléfono, y el formulario en una hoja clara.
 */
export function PantallaAcceso({ children }) {
    // La barra del sistema (teléfono, tablet, PWA) se pinta del negro de la franja y no del amarillo.
    useEffect(() => {
        const meta = document.querySelector('meta[name="theme-color"]');
        if (!meta)
            return;
        const antes = meta.content;
        meta.content = '#14120f';
        return () => {
            meta.content = antes;
        };
    }, []);
    return (_jsxs("div", { className: "grid min-h-dvh grid-rows-[auto_1fr] bg-marca-900 lg:grid-cols-[1.1fr_1fr] lg:grid-rows-1", children: [_jsxs("div", { className: "relative flex min-h-[38dvh] flex-col justify-end overflow-hidden bg-marca-900 px-6 pt-28 pb-14 sm:min-h-0 text-white sm:px-10 sm:pt-44 sm:pb-20 lg:p-12", children: [_jsx("img", { src: "/login-fondo.webp", alt: "", className: "absolute inset-0 size-full object-cover opacity-60 grayscale-[35%]", "aria-hidden": true }), _jsx("div", { className: "absolute inset-0 bg-gradient-to-t from-marca-900 via-marca-900/75 to-marca-900/35", "aria-hidden": true }), _jsx("div", { className: "absolute inset-0 bg-gradient-to-r from-marca-900/60 to-transparent", "aria-hidden": true }), _jsx("svg", { viewBox: "0 0 600 120", className: "absolute inset-x-0 top-12 w-full -translate-y-1/2 text-marca-500/40 sm:top-16 lg:top-1/2", fill: "none", "aria-hidden": true, children: _jsx("path", { d: "M0 70h170l18-40 26 78 22-58 14 20h350", stroke: "currentColor", strokeWidth: "3", strokeLinecap: "round", strokeLinejoin: "round" }) }), _jsxs("div", { className: "relative mx-auto w-full max-w-sm sm:max-w-md lg:mx-0 lg:max-w-lg", children: [_jsx("p", { className: "hidden text-sm font-semibold tracking-widest text-marca-500 uppercase lg:block", children: "Light a Candle \u00B7 Dominican Republic" }), _jsx("p", { className: "text-[1.75rem] leading-[1.15] font-semibold tracking-tight text-balance sm:text-4xl lg:mt-4", children: "Cuidamos la presi\u00F3n arterial de cada paciente." }), _jsx("p", { className: "mt-3 hidden leading-relaxed text-white/70 text-pretty sm:block lg:mt-4 lg:text-lg", children: "Registra las visitas de la jornada, entrega los medicamentos y detecta a tiempo a quien necesita atenci\u00F3n, aunque no haya se\u00F1al." })] })] }), _jsx("div", { className: "relative -mt-6 flex justify-center rounded-t-3xl bg-fondo px-6 pt-10 pb-12 sm:items-center sm:pt-12 lg:mt-0 lg:rounded-none lg:py-12", children: _jsxs("div", { className: "w-full max-w-sm sm:max-w-md lg:max-w-sm", children: [_jsx("img", { src: "/logo.webp", alt: "Light a Candle \u00B7 Dominican Republic", className: "mb-6 w-52 sm:w-60 lg:mb-8 lg:w-64" }), children] }) })] }));
}
