/** Error de la API con el mensaje ya listo para mostrar. */
export class ErrorApi extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}
const CLAVE_SESION = 'hta.sesion';
export const EVENTO_SESION_EXPIRADA = 'hta:sesion-expirada';
export function leerSesion() {
    try {
        const crudo = localStorage.getItem(CLAVE_SESION);
        return crudo ? JSON.parse(crudo) : null;
    }
    catch {
        return null;
    }
}
export function guardarSesion(sesion) {
    try {
        if (sesion)
            localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
        else
            localStorage.removeItem(CLAVE_SESION);
    }
    catch {
        /* sin almacenamiento: la sesión dura lo que la pestaña */
    }
}
/** El access token vive 15 min; se renueva una sola vez aunque fallen varias peticiones a la vez. */
let renovando = null;
function renovarToken() {
    renovando ??= (async () => {
        const sesion = leerSesion();
        if (!sesion)
            return null;
        const res = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { authorization: `Bearer ${sesion.refresh_token}` },
        });
        if (!res.ok)
            return null;
        const { access_token } = (await res.json());
        guardarSesion({ ...sesion, access_token });
        return access_token;
    })().finally(() => {
        renovando = null;
    });
    return renovando;
}
async function pedir(ruta, init = {}, reintento = true) {
    const token = leerSesion()?.access_token;
    const esJson = init.body && !(init.body instanceof FormData);
    const res = await fetch(`/api${ruta}`, {
        ...init,
        headers: {
            ...(esJson ? { 'content-type': 'application/json' } : {}),
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            ...init.headers,
        },
    });
    if (res.status === 401 && token && reintento) {
        if (await renovarToken())
            return pedir(ruta, init, false);
        guardarSesion(null);
        window.dispatchEvent(new Event(EVENTO_SESION_EXPIRADA));
    }
    return res;
}
async function mensajeDeError(res) {
    const cuerpo = await res.json().catch(() => null);
    const m = cuerpo?.message;
    if (Array.isArray(m))
        return m.join(' · ');
    if (typeof m === 'string')
        return m;
    return `Error ${res.status}`;
}
export async function api(ruta, init) {
    const res = await pedir(ruta, init);
    if (!res.ok)
        throw new ErrorApi(await mensajeDeError(res), res.status);
    if (res.status === 204)
        return undefined;
    const texto = await res.text();
    // Nest responde vacío cuando el servicio devuelve null (p. ej. un id que no existe).
    return (texto ? JSON.parse(texto) : null);
}
export const enviar = (ruta, metodo, cuerpo) => api(ruta, {
    method: metodo,
    body: cuerpo instanceof FormData ? cuerpo : cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
});
/** Los reportes CSV necesitan el token, así que no sirve un <a href> directo. */
export async function descargar(ruta, nombre) {
    const res = await pedir(ruta);
    if (!res.ok)
        throw new ErrorApi(await mensajeDeError(res), res.status);
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
    a.click();
    URL.revokeObjectURL(url);
}
