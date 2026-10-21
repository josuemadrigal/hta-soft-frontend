import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AlertTriangle } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Boton } from './ui';
const Contexto = createContext(null);
/**
 * Reemplaza window.confirm por un diálogo propio: `if (await confirmar({...})) borrar()`.
 * Usa <dialog> nativo: Esc cancela y el foco queda atrapado mientras está abierto.
 */
export function ProveedorConfirmar({ children }) {
    const [pendiente, setPendiente] = useState(null);
    const ref = useRef(null);
    const confirmar = useCallback((o) => new Promise((resolver) => setPendiente({ ...o, resolver })), []);
    useEffect(() => {
        const d = ref.current;
        if (pendiente && d && !d.open)
            d.showModal();
    }, [pendiente]);
    const cerrar = (ok) => {
        pendiente?.resolver(ok);
        ref.current?.close();
        setPendiente(null);
    };
    const peligro = pendiente?.peligro ?? true;
    return (_jsxs(Contexto.Provider, { value: confirmar, children: [children, _jsx("dialog", { ref: ref, onCancel: (e) => {
                    e.preventDefault();
                    cerrar(false);
                }, onClick: (e) => e.target === e.currentTarget && cerrar(false), className: "m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-borde bg-superficie p-0 text-tinta shadow-2xl backdrop:bg-tinta/40 backdrop:backdrop-blur-[2px]", "aria-labelledby": "confirmar-titulo", children: pendiente && (_jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "flex gap-4", children: [_jsx("span", { className: `grid size-10 shrink-0 place-items-center rounded-full ${peligro ? 'bg-red-50 text-red-600' : 'bg-marca-100 text-marca-700'}`, children: pendiente.icono ?? _jsx(AlertTriangle, { className: "size-5" }) }), _jsxs("div", { className: "min-w-0", children: [_jsx("h2", { id: "confirmar-titulo", className: "font-semibold", children: pendiente.titulo }), _jsx("div", { className: "mt-1.5 text-sm text-tenue", children: pendiente.mensaje })] })] }), _jsxs("div", { className: "mt-6 flex justify-end gap-2", children: [_jsx(Boton, { variante: "secundario", onClick: () => cerrar(false), autoFocus: true, children: pendiente.cancelar ?? 'Cancelar' }), _jsx(Boton, { variante: peligro ? 'peligro' : 'primario', onClick: () => cerrar(true), children: pendiente.confirmar ?? 'Eliminar' })] })] })) })] }));
}
export function useConfirmar() {
    const c = useContext(Contexto);
    if (!c)
        throw new Error('useConfirmar fuera de ProveedorConfirmar');
    return c;
}
