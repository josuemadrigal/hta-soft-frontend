/**
 * Pacientes regulares (lo mismo que el servidor, common/regulares.ts): los que se han perdido como mucho
 * N visitas, una cada 3 meses. N se cambia en Configuración (por defecto 8, unos 2 años).
 */
export const VISITAS_SIN_VENIR_REGULAR = 8;
const DIAS_POR_VISITA = 90;

export function corteRegulares(visitasSinVenir = VISITAS_SIN_VENIR_REGULAR, ahora = new Date()) {
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  return new Date(hoy.getTime() - (visitasSinVenir + 1) * DIAS_POR_VISITA * 86_400_000);
}

/** Con su última visita (o, si nunca vino, la fecha en que se registró). */
export const esRegular = (ultimaVisita: string | null | undefined, registro: string, corte: Date) => new Date(ultimaVisita ?? registro) >= corte;

/** "8 visitas" → "unos 2 años y 3 meses": para explicarlo en pantalla. */
export function tiempoSinVenir(visitas: number) {
  const meses = (visitas + 1) * 3;
  const a = Math.floor(meses / 12);
  const m = meses % 12;
  return [a && `${a} ${a === 1 ? 'año' : 'años'}`, m && `${m} meses`].filter(Boolean).join(' y ');
}
