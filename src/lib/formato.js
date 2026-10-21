import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
export const cn = (...c) => twMerge(clsx(c));
const fechaCorta = new Intl.DateTimeFormat('es-DO', { day: '2-digit', month: 'short', year: 'numeric' });
const fechaHora = new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium', timeStyle: 'short' });
export const fecha = (iso) => (iso ? fechaCorta.format(new Date(iso)) : '—');
/** Fechas sin hora (vencimientos, jornadas): se guardan a medianoche UTC y se muestran sin correr de día. */
const fechaCortaUTC = new Intl.DateTimeFormat('es-DO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const fechaDia = (iso) => (iso ? fechaCortaUTC.format(new Date(iso)) : '—');
/** Días desde hoy (local) hasta una fecha sin hora; negativo si ya pasó. */
export const diasHasta = (iso) => {
    const h = new Date();
    return Math.round((Date.parse(iso.slice(0, 10)) - Date.UTC(h.getFullYear(), h.getMonth(), h.getDate())) / 86_400_000);
};
export const fechaYHora = (iso) => (iso ? fechaHora.format(new Date(iso)) : '—');
/** Las fechas de nacimiento llegan a medianoche UTC; se leen en UTC para no correr un día. */
export const soloFecha = (iso) => iso.slice(0, 10);
export function edad(iso) {
    const n = new Date(iso);
    const hoy = new Date();
    let a = hoy.getFullYear() - n.getUTCFullYear();
    const m = hoy.getMonth() - n.getUTCMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < n.getUTCDate()))
        a--;
    return a;
}
/** "62 años", o "~62 años" si solo se conocía la edad. */
export const edadTexto = (p) => `${p.birthDateIsEstimated ? '~' : ''}${edad(p.birthDate)} años`;
export const DIA_MS = 24 * 60 * 60 * 1000;
export const nombreCompleto = (p) => `${p.firstName} ${p.lastName}`.trim();
export const iniciales = (p) => (p.lastName.trim() ? `${p.firstName[0] ?? ''}${p.lastName[0]}` : p.firstName.slice(0, 2)).toUpperCase();
/** Prisma serializa Decimal como texto. */
export const num = (v) => (v === null || v === undefined ? null : Number(v));
export const decimal = (v, digitos = 1) => {
    const n = num(v);
    return n === null || Number.isNaN(n) ? '—' : n.toFixed(digitos);
};
/** Igual que el backend: la toma manual manda sobre la automática. */
export function tensionDe(v) {
    const s = v.systolicManual ?? v.systolicAuto;
    const d = v.diastolicManual ?? v.diastolicAuto;
    return s && d ? `${s}/${d}` : '—';
}
/** Réplica de BloodPressureConfigService.classify para anticipar la categoría en el formulario. */
export function clasificar(configs, sistolica, diastolica) {
    // Cada cifra por separado (como el backend); gana la categoría más grave de las dos.
    const de = (v, min, max) => {
        const dentro = configs.filter((c) => v >= c[min] && v <= c[max]);
        // Por encima de todos los rangos: las categorías ya superadas.
        return dentro.length ? dentro : configs.filter((c) => v >= c[min]);
    };
    return [...de(sistolica, 'systolicMin', 'systolicMax'), ...de(diastolica, 'diastolicMin', 'diastolicMax')].reduce((a, c) => (!a || c.priority > a.priority ? c : a), null);
}
/** Verde ≥ 90 %, ámbar ≥ 75 %, rojo por debajo. */
export const colorCumplimiento = (p) => (p >= 90 ? 'text-green-700' : p >= 75 ? 'text-amber-700' : 'text-red-600');
/** Quién atendió la visita: el nombre guardado; si no hay, el de la cuenta actual. */
export const atendio = (v) => v.doctorNombre ?? (v.doctor ? nombreCompleto(v.doctor) : '—');
