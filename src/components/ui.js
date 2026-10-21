import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Copy, Info, Loader2 } from 'lucide-react';
import { forwardRef, useEffect, useId, useRef, useState, } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { copiarComoImagen } from '../lib/copiar';
import { CATEGORIAS, colorCategoria } from '../lib/etiquetas';
import { cn, iniciales } from '../lib/formato';
import { hayAnterior, useVolver } from '../lib/navegacion';
const VARIANTES = {
    primario: 'bg-marca-500 text-tinta font-semibold hover:bg-marca-600 shadow-sm',
    secundario: 'bg-superficie text-tinta border border-borde hover:bg-fondo',
    fantasma: 'text-tenue hover:text-tinta hover:bg-black/5',
    peligro: 'bg-red-600 text-white hover:bg-red-700',
};
export function Boton({ variante = 'primario', cargando, icono, className, children, disabled, ...props }) {
    return (_jsxs("button", { type: "button", ...props, disabled: disabled || cargando, className: cn('inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50', VARIANTES[variante], className), children: [cargando ? _jsx(Loader2, { className: "size-4 animate-spin" }) : icono, children] }));
}
/* Campos de formulario */
export function Campo({ etiqueta, error, ayuda, grupo, className, children, }) {
    const id = useId();
    const Contenedor = grupo ? 'div' : 'label';
    return (_jsxs(Contenedor, { className: cn('flex flex-col gap-1.5', className), ...(grupo && { role: 'group', 'aria-labelledby': id }), children: [_jsx("span", { id: id, className: "text-[13px] font-medium text-tinta/80", children: etiqueta }), children, error ? _jsx("span", { className: "text-xs text-red-600", children: error }) : ayuda && _jsx("span", { className: "text-xs text-tenue", children: ayuda })] }));
}
const BASE_CAMPO = 'h-9 w-full rounded-lg border border-borde bg-superficie px-3 text-sm outline-none transition placeholder:text-tenue/70 focus:border-tinta/60 focus:ring-3 focus:ring-marca-200 aria-invalid:border-red-400';
export const Entrada = forwardRef(({ className, ...p }, ref) => _jsx("input", { ref: ref, ...p, className: cn(BASE_CAMPO, className) }));
export { Selector } from './Selector';
export const AreaTexto = forwardRef(({ className, ...p }, ref) => (_jsx("textarea", { ref: ref, rows: 3, ...p, className: cn(BASE_CAMPO, 'h-auto py-2', className) })));
export const Casilla = forwardRef(({ etiqueta, className, ...p }, ref) => (_jsxs("label", { className: cn('flex cursor-pointer items-center gap-2 text-sm', className), children: [_jsx("input", { ref: ref, type: "checkbox", ...p, className: "size-4 rounded accent-tinta" }), etiqueta] })));
/**
 * Opciones de una sola elección como botones (en la tablet es un toque, no abrir una lista).
 * Sin valor, ninguna queda marcada. Flechas ← → cambian la elección, como un grupo de radios.
 */
export function Segmentos({ valor, opciones, alCambiar, etiqueta, invalido, className, }) {
    const actual = opciones.findIndex((o) => o.value === valor);
    const tecla = (e) => {
        const paso = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (!paso)
            return;
        e.preventDefault();
        const i = (Math.max(actual, 0) + paso + opciones.length) % opciones.length;
        alCambiar(opciones[i].value);
        e.currentTarget.children[i]?.focus();
    };
    return (_jsx("div", { className: cn('flex rounded-lg bg-black/5 p-0.5', invalido && 'ring-1 ring-red-400', className), role: "radiogroup", "aria-label": etiqueta, "aria-invalid": invalido, onKeyDown: tecla, children: opciones.map((o, i) => (_jsx("button", { type: "button", role: "radio", "aria-checked": valor === o.value, tabIndex: i === (actual < 0 ? 0 : actual) ? 0 : -1, onClick: () => alCambiar(o.value), className: cn('h-9 min-w-0 flex-1 truncate rounded-md px-2 text-sm whitespace-nowrap transition sm:px-3', valor === o.value ? 'bg-superficie font-medium text-tinta shadow-sm' : 'text-tenue hover:text-tinta'), children: o.label }, o.value))) }));
}
/** react-hook-form: los inputs numéricos vacíos quedan como undefined en lugar de NaN. */
export const comoNumero = { setValueAs: (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)) };
/* Contenedores */
/**
 * Botón (i) de una gráfica: explica cómo se lee y qué significa. No sale en la imagen copiada.
 * Se abre al tocarlo (en tableta no hay "pasar el mouse") y se cierra tocando fuera o con Escape.
 */
function BotonAyuda({ ayuda }) {
    const [abierto, setAbierto] = useState(false);
    const ref = useRef(null);
    const id = useId();
    useEffect(() => {
        if (!abierto)
            return;
        const fuera = (e) => !ref.current?.contains(e.target) && setAbierto(false);
        const tecla = (e) => e.key === 'Escape' && setAbierto(false);
        document.addEventListener('mousedown', fuera);
        document.addEventListener('keydown', tecla);
        return () => {
            document.removeEventListener('mousedown', fuera);
            document.removeEventListener('keydown', tecla);
        };
    }, [abierto]);
    return (_jsxs("div", { ref: ref, "data-no-copiar": true, className: "relative", children: [_jsx("button", { type: "button", onClick: () => setAbierto((a) => !a), className: cn('rounded-md p-1.5 text-tenue hover:bg-black/5 hover:text-tinta', abierto && 'bg-black/5 text-tinta'), "aria-label": "C\u00F3mo se lee esta gr\u00E1fica", "aria-expanded": abierto, "aria-controls": id, title: "C\u00F3mo se lee", children: _jsx(Info, { className: "size-4" }) }), abierto && (_jsxs("div", { id: id, role: "dialog", "aria-label": "C\u00F3mo se lee esta gr\u00E1fica", className: "absolute top-full right-0 z-30 mt-1.5 w-80 max-w-[calc(100vw-2rem)] space-y-3 rounded-xl border border-borde bg-superficie p-4 text-left text-sm font-normal shadow-xl", children: [_jsxs("div", { children: [_jsx("p", { className: "mb-1 text-xs font-semibold tracking-wide text-tenue uppercase", children: "C\u00F3mo se lee" }), _jsx("p", { className: "leading-relaxed", children: ayuda.lee })] }), _jsxs("div", { children: [_jsx("p", { className: "mb-1 text-xs font-semibold tracking-wide text-tenue uppercase", children: "Qu\u00E9 significa" }), _jsx("p", { className: "leading-relaxed", children: ayuda.significa })] })] }))] }));
}
export function Tarjeta({ titulo, accion, copiable, ayuda, className, children, }) {
    const ref = useRef(null);
    const [copiando, setCopiando] = useState(false);
    const copiar = async () => {
        if (!ref.current)
            return;
        setCopiando(true);
        try {
            const nombre = (typeof titulo === 'string' ? titulo : 'grafica').toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, '-');
            const r = await copiarComoImagen(ref.current, nombre);
            toast.success(r === 'copiada' ? 'Gráfica copiada: pégala donde la necesites' : 'Se descargó la gráfica como imagen');
        }
        catch {
            toast.error('No se pudo copiar la gráfica');
        }
        finally {
            setCopiando(false);
        }
    };
    return (_jsxs("section", { ref: ref, className: cn('rounded-xl border border-borde bg-superficie', className), children: [titulo && (_jsxs("header", { className: "flex items-center justify-between gap-3 border-b border-borde px-5 py-3.5", children: [_jsx("h2", { className: "text-sm font-semibold", children: titulo }), _jsxs("div", { className: "flex items-center gap-2", children: [accion, ayuda && _jsx(BotonAyuda, { ayuda: ayuda }), copiable && (_jsx("button", { "data-no-copiar": true, onClick: copiar, disabled: copiando, className: "rounded-md p-1.5 text-tenue hover:bg-black/5 hover:text-tinta disabled:opacity-50", title: "Copiar como imagen", "aria-label": "Copiar gr\u00E1fica como imagen", children: copiando ? _jsx(Loader2, { className: "size-4 animate-spin" }) : _jsx(Copy, { className: "size-4" }) }))] })] })), children] }));
}
/**
 * "← Volver": a la pantalla anterior, como el botón Atrás. Si no hay una (se abrió el enlace directo),
 * va a `a` y dice su nombre (`texto`). Con Ctrl/Cmd se abre en otra pestaña, como cualquier enlace.
 */
export function EnlaceVolver({ a, texto, className }) {
    const irAtras = useVolver();
    const anterior = hayAnterior();
    return (_jsxs(Link, { to: a, onClick: (e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0)
                return;
            e.preventDefault();
            irAtras(a);
        }, className: cn('inline-flex items-center gap-1.5 text-sm text-tenue hover:text-tinta', className), children: [_jsx(ArrowLeft, { className: "size-4" }), " ", anterior ? 'Volver' : texto] }));
}
export function EncabezadoPagina({ titulo, descripcion, acciones, volver, }) {
    return (_jsxs("div", { className: "mb-6 flex flex-wrap items-end justify-between gap-4", children: [volver && _jsx(EnlaceVolver, { a: volver.a, texto: volver.texto, className: "-mb-2 w-full" }), _jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold tracking-tight", children: titulo }), descripcion && _jsx("p", { className: "mt-1 text-sm text-tenue", children: descripcion })] }), acciones && _jsx("div", { className: "flex flex-wrap gap-2", children: acciones })] }));
}
/* Indicadores */
export function Insignia({ color, className, children }) {
    return (_jsx("span", { className: cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', !color && 'bg-black/5 text-tenue', className), style: color ? { backgroundColor: `${color}1a`, color } : undefined, children: children }));
}
export function InsigniaCategoria({ config }) {
    if (!config)
        return _jsx(Insignia, { children: "Sin clasificar" });
    const color = colorCategoria(config);
    return (_jsxs(Insignia, { color: color, children: [_jsx("span", { className: "size-1.5 rounded-full", style: { backgroundColor: color } }), CATEGORIAS[config.categoryName]] }));
}
export function Avatar({ persona, foto, tamano = 'size-9', }) {
    return foto ? (_jsx("img", { src: foto, alt: "", className: cn('shrink-0 rounded-full object-cover', tamano) })) : (_jsx("span", { className: cn('grid shrink-0 place-items-center rounded-full bg-marca-100 text-xs font-semibold text-marca-700', tamano), children: iniciales(persona) }));
}
/** Un bloque gris que late mientras llega el dato real (sin animación si se pidió reducir el movimiento). */
export function Hueso({ className, style }) {
    return _jsx("span", { "aria-hidden": true, style: style, className: cn('block rounded-md bg-black/[0.07] motion-safe:animate-pulse', className) });
}
/**
 * Mientras carga: la forma de lo que viene (un esqueleto), no un texto en una pantalla vacía.
 * `forma` elige el dibujo; por defecto, una lista de filas, que es lo más común en la app.
 */
export function Cargando({ texto = 'Cargando…', forma = 'lista' }) {
    const fila = (i) => (_jsxs("div", { className: "flex items-center gap-3 px-5 py-3.5", children: [_jsx(Hueso, { className: "size-9 shrink-0 rounded-full" }), _jsxs("div", { className: "min-w-0 flex-1 space-y-2", children: [_jsx(Hueso, { className: cn('h-3.5', ['w-2/5', 'w-1/3', 'w-1/2', 'w-1/4'][i % 4]) }), _jsx(Hueso, { className: cn('h-3', ['w-1/4', 'w-1/5', 'w-1/3', 'w-1/6'][i % 4]) })] }), _jsx(Hueso, { className: "hidden h-6 w-20 sm:block" })] }, i));
    return (_jsxs("div", { role: "status", "aria-live": "polite", "aria-busy": "true", children: [_jsx("span", { className: "sr-only", children: texto }), forma === 'linea' ? (_jsxs("div", { className: "space-y-2 p-5", children: [_jsx(Hueso, { className: "h-4 w-1/2" }), _jsx(Hueso, { className: "h-4 w-1/3" })] })) : forma === 'grafica' ? (_jsx("div", { className: "flex h-60 items-end gap-3 px-6 pt-6 pb-8", children: [55, 80, 65, 90, 45, 70, 85, 60].map((h, i) => (_jsx(Hueso, { className: "flex-1 rounded-b-none", style: { height: `${h}%` } }, i))) })) : forma === 'pagina' ? (_jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "grid grid-cols-2 gap-4 xl:grid-cols-4", children: [0, 1, 2, 3].map((i) => (_jsxs("div", { className: "space-y-3 rounded-xl border border-borde bg-superficie p-5", children: [_jsx(Hueso, { className: "h-3.5 w-1/2" }), _jsx(Hueso, { className: "h-8 w-2/5" }), _jsx(Hueso, { className: "h-3 w-3/4" })] }, i))) }), _jsx("div", { className: "divide-y divide-borde rounded-xl border border-borde bg-superficie", children: [0, 1, 2, 3, 4].map(fila) })] })) : (_jsx("div", { className: "divide-y divide-borde", children: [0, 1, 2, 3, 4, 5].map(fila) }))] }));
}
export function Vacio({ icono, titulo, children }) {
    return (_jsxs("div", { className: "flex flex-col items-center gap-2 px-6 py-14 text-center", children: [icono && _jsx("div", { className: "mb-1 text-tenue/60", children: icono }), _jsx("p", { className: "font-medium", children: titulo }), children && _jsx("div", { className: "max-w-sm text-sm text-tenue", children: children })] }));
}
export function ErrorCarga({ error }) {
    return (_jsxs("div", { className: "m-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700", children: ["No se pudo cargar: ", error instanceof Error ? error.message : 'error desconocido'] }));
}
/** Páginas a mostrar: la primera, la última y las vecinas de la actual; "…" donde se saltan. */
export function paginasVisibles(pagina, ultima) {
    const set = new Set([1, ultima, pagina - 1, pagina, pagina + 1].filter((n) => n >= 1 && n <= ultima));
    // Cerca de los extremos se muestran unas más, para no poner "…" en lugar de un solo número.
    if (pagina <= 3)
        [2, 3, 4].forEach((n) => n <= ultima && set.add(n));
    if (pagina >= ultima - 2)
        [ultima - 1, ultima - 2, ultima - 3].forEach((n) => n >= 1 && set.add(n));
    const orden = [...set].sort((x, y) => x - y);
    const r = [];
    orden.forEach((n, i) => {
        if (i > 0 && n - orden[i - 1] > 1)
            r.push(n - orden[i - 1] === 2 ? n - 1 : '…');
        r.push(n);
    });
    return r;
}
export const OPCIONES_POR_PAGINA = [15, 25, 50, 100];
export function Paginacion({ pagina, ultima, total, alCambiar, porPagina, alCambiarPorPagina, }) {
    const ref = useRef(null);
    const ultimaP = Math.max(ultima, 1);
    // Al cambiar de página se vuelve al inicio de la tabla (si no, se queda mirando el pie).
    const ir = (p) => {
        alCambiar(Math.min(Math.max(1, p), ultimaP));
        ref.current?.closest('section')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    };
    const desde = porPagina ? (pagina - 1) * porPagina + 1 : null;
    const hasta = porPagina ? Math.min(pagina * porPagina, total) : null;
    const flecha = 'h-8 px-2';
    return (_jsxs("div", { ref: ref, className: "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-borde px-5 py-3 text-sm text-tenue", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-x-4 gap-y-2", children: [_jsx("span", { className: "tabular", children: desde && hasta && total > 0 ? (_jsxs(_Fragment, { children: [_jsxs("span", { className: "font-medium text-tinta", children: [desde.toLocaleString('es-DO'), "\u2013", hasta.toLocaleString('es-DO')] }), ' ', "de ", total.toLocaleString('es-DO')] })) : (_jsxs(_Fragment, { children: [total.toLocaleString('es-DO'), " ", total === 1 ? 'registro' : 'registros'] })) }), porPagina && alCambiarPorPagina && (_jsxs("label", { className: "flex items-center gap-2", children: ["Mostrar", _jsx("select", { value: porPagina, onChange: (e) => alCambiarPorPagina(Number(e.target.value)), className: "h-8 rounded-lg border border-borde bg-superficie px-2 text-sm text-tinta outline-none focus:border-tinta/60 focus:ring-3 focus:ring-marca-200", children: [...new Set([...OPCIONES_POR_PAGINA, porPagina])].sort((x, y) => x - y).map((n) => (_jsx("option", { value: n, children: n }, n))) }), "por p\u00E1gina"] }))] }), ultimaP > 1 && (_jsxs("nav", { className: "flex items-center gap-1", "aria-label": "P\u00E1ginas", children: [_jsx(Boton, { variante: "fantasma", className: cn(flecha, 'hidden sm:inline-flex'), disabled: pagina <= 1, onClick: () => ir(1), "aria-label": "Primera p\u00E1gina", title: "Primera p\u00E1gina", children: _jsx(ChevronsLeft, { className: "size-4" }) }), _jsx(Boton, { variante: "fantasma", className: flecha, disabled: pagina <= 1, onClick: () => ir(pagina - 1), "aria-label": "Anterior", title: "Anterior", children: _jsx(ChevronLeft, { className: "size-4" }) }), _jsxs("span", { className: "tabular px-2 sm:hidden", children: [pagina, " / ", ultimaP] }), _jsx("span", { className: "hidden items-center gap-1 sm:flex", children: paginasVisibles(pagina, ultimaP).map((n, i) => n === '…' ? (_jsx("span", { className: "px-1 text-tenue/70", children: "\u2026" }, `e${i}`)) : (_jsx("button", { type: "button", onClick: () => ir(n), "aria-current": n === pagina ? 'page' : undefined, className: cn('tabular h-8 min-w-8 rounded-lg px-2 text-sm transition', n === pagina ? 'bg-marca-500 font-semibold text-tinta' : 'text-tinta/80 hover:bg-black/5'), children: n }, n))) }), _jsx(Boton, { variante: "fantasma", className: flecha, disabled: pagina >= ultimaP, onClick: () => ir(pagina + 1), "aria-label": "Siguiente", title: "Siguiente", children: _jsx(ChevronRight, { className: "size-4" }) }), _jsx(Boton, { variante: "fantasma", className: cn(flecha, 'hidden sm:inline-flex'), disabled: pagina >= ultimaP, onClick: () => ir(ultimaP), "aria-label": "\u00DAltima p\u00E1gina", title: "\u00DAltima p\u00E1gina", children: _jsx(ChevronsRight, { className: "size-4" }) })] }))] }));
}
/** Cuántos por página: el de la dirección, si no el último elegido en este dispositivo, si no el de siempre. */
export function porPaginaDe(params, clave, defecto) {
    const url = Number(params.get('por'));
    if (url >= 1 && url <= 200)
        return url;
    try {
        const guardado = Number(localStorage.getItem(`hta:porPagina:${clave}`));
        if (guardado >= 1 && guardado <= 200)
            return guardado;
    }
    catch {
        /* sin almacenamiento local: el de siempre */
    }
    return defecto;
}
export function recordarPorPagina(clave, n) {
    try {
        localStorage.setItem(`hta:porPagina:${clave}`, String(n));
    }
    catch {
        /* sin almacenamiento local: solo queda en la dirección */
    }
}
/** Tabla con encabezado fijo de estilo; las filas las pone cada pantalla. */
export function Tabla({ columnas, children }) {
    return (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsx("tr", { className: "border-b border-borde text-left text-xs tracking-wide text-tenue uppercase", children: columnas.map((c) => {
                            const col = typeof c === 'string' ? { texto: c } : c;
                            return (_jsx("th", { className: cn('px-5 py-2.5 font-medium whitespace-nowrap', col.className), children: col.texto }, col.texto));
                        }) }) }), _jsx("tbody", { className: "divide-y divide-borde", children: children })] }) }));
}
