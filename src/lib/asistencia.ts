/**
 * Asistencia del paciente según su última visita (misma regla que el backend, common/asistencia.ts).
 * Reemplaza "atrasado": con 4 visitas al año, casi todos quedaban atrasados y no decía nada.
 */
export const MESES_SIN_VENIR = 6;

export type Asistencia = 'visto' | 'le-toca' | 'sin-venir' | 'sin-visitas';

const mesAnio = new Intl.DateTimeFormat('es-DO', { month: 'short', year: 'numeric' });

export function asistencia(ultimaVisita: string | null | undefined, ahora = new Date()): { clave: Asistencia; texto: string; color?: string; masDeUnAno?: boolean } {
  if (!ultimaVisita) return { clave: 'sin-visitas', texto: 'Sin visitas' };
  const u = new Date(ultimaVisita);
  const inicioRonda = new Date(ahora.getFullYear(), Math.floor(ahora.getMonth() / 3) * 3, 1);
  const corte = new Date(ahora.getFullYear(), ahora.getMonth() - MESES_SIN_VENIR, ahora.getDate());
  if (u >= inicioRonda) return { clave: 'visto', texto: 'Visto en la ronda', color: '#15803d' };
  if (u >= corte) return { clave: 'le-toca', texto: 'Pendiente', color: '#a16207' };
  const masDeUnAno = u < new Date(ahora.getFullYear() - 1, ahora.getMonth(), ahora.getDate());
  return { clave: 'sin-venir', texto: `No asiste desde ${mesAnio.format(u)}`, color: masDeUnAno ? '#6b665e' : '#9a3412', masDeUnAno };
}

/** Opciones del filtro de pacientes (valores de ?situacion=). */
export const SITUACIONES_ASISTENCIA = [
  { value: 'visto', label: 'Vistos en la ronda' },
  { value: 'le-toca', label: 'Pendientes de esta ronda' },
  { value: 'sin-venir', label: 'No asisten hace más de 6 meses' },
  { value: 'sin-venir-ano', label: 'No asisten hace más de un año' },
  { value: 'sin-visitas', label: 'Sin visitas' },
];
