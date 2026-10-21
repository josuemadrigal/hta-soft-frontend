import { useSearchParams } from 'react-router';
import { ymd } from '../components/SelectorFecha';
/** Atajos del panel. Se calculan al usarse: "hoy" cambia si la pestaña queda abierta de un día a otro. */
export function atajosPeriodo(ahora = new Date()) {
    const a = ahora.getFullYear();
    const m = ahora.getMonth();
    const d = ahora.getDate();
    const hoy = ymd(ahora);
    return [
        { clave: 'hoy', texto: 'Hoy', frase: 'hoy', desde: hoy, hasta: hoy },
        { clave: 'ayer', texto: 'Ayer', frase: 'ayer', desde: ymd(new Date(a, m, d - 1)), hasta: ymd(new Date(a, m, d - 1)) },
        { clave: '7d', texto: 'Últimos 7 días', frase: 'en los últimos 7 días', desde: ymd(new Date(a, m, d - 6)), hasta: hoy },
        { clave: 'mes', texto: 'Este mes', frase: 'este mes', desde: ymd(new Date(a, m, 1)), hasta: hoy },
        { clave: 'mes-pasado', texto: 'Mes pasado', frase: 'el mes pasado', desde: ymd(new Date(a, m - 1, 1)), hasta: ymd(new Date(a, m, 0)) },
        { clave: 'anio', texto: 'Este año', frase: 'este año', desde: `${a}-01-01`, hasta: hoy },
    ];
}
const DIA = new Intl.DateTimeFormat('es-DO', { day: 'numeric', month: 'short', year: 'numeric' });
const DIA_SIN_ANIO = new Intl.DateTimeFormat('es-DO', { day: 'numeric', month: 'short' });
const fechaDe = (s) => {
    const [y, mo, da] = s.split('-').map(Number);
    return new Date(y, mo - 1, da);
};
/**
 * El periodo del panel en la URL (?desde=&hasta=). Una sola fecha = ese día; las dos = el rango.
 * Sin nada, hoy.
 */
export function usePeriodoPanel() {
    const [params, setParams] = useSearchParams();
    const atajos = atajosPeriodo();
    let desde = params.get('desde') ?? '';
    let hasta = params.get('hasta') || desde;
    if (!desde)
        [desde, hasta] = [atajos[0].desde, atajos[0].hasta];
    if (hasta < desde)
        [desde, hasta] = [hasta, desde];
    const atajo = atajos.find((x) => x.desde === desde && x.hasta === hasta) ?? null;
    const unDia = desde === hasta;
    const mismoAnio = desde.slice(0, 4) === hasta.slice(0, 4);
    const rango = `${(mismoAnio ? DIA_SIN_ANIO : DIA).format(fechaDe(desde))} – ${DIA.format(fechaDe(hasta))}`;
    const texto = atajo?.texto ?? (unDia ? DIA.format(fechaDe(desde)) : rango);
    const frase = atajo?.frase ?? (unDia ? `el ${DIA.format(fechaDe(desde))}` : `del ${(mismoAnio ? DIA_SIN_ANIO : DIA).format(fechaDe(desde))} al ${DIA.format(fechaDe(hasta))}`);
    const cambiar = (r) => setParams((p) => {
        // Hoy es lo que se ve sin nada: no ensucia la URL.
        const esHoy = r.desde === atajos[0].desde && (!r.hasta || r.hasta === r.desde);
        for (const [k, v] of Object.entries({ desde: esHoy ? undefined : r.desde, hasta: esHoy || r.hasta === r.desde ? undefined : r.hasta }))
            v ? p.set(k, v) : p.delete(k);
        return p;
    }, { replace: true });
    return { desde, hasta, texto, frase, atajo: atajo?.clave ?? null, cambiar };
}
