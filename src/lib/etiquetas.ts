import type {
  MotivoBaja,
  MotivoInasistencia,
  CategoriaPA,
  ConfigPA,
  ConsumoAlcohol,
  ConsumoSal,
  EstadoPaciente,
  Genero,
  Tabaquismo,
  TipoVisita,
} from '../api/tipos';

export const CATEGORIAS: Record<CategoriaPA, string> = {
  NORMAL: 'Normal',
  ELEVATED: 'Elevada',
  GRADE_1: 'HTA grado 1',
  GRADE_2: 'HTA grado 2',
  CRISIS: 'Crisis hipertensiva',
};

export const GENEROS: Record<Genero, string> = { MALE: 'Masculino', FEMALE: 'Femenino', OTHER: 'Otro' };
export const ESTADOS: Record<EstadoPaciente, string> = { ACTIVE: 'Activo', INACTIVE: 'De baja', DECEASED: 'Fallecido' };
export const MOTIVOS_BAJA: Record<MotivoBaja, string> = {
  FALLECIDO: 'Falleció',
  MUDANZA: 'Se mudó',
  ABANDONO: 'Abandonó el programa',
  TRASLADO: 'Pasó a otro programa o médico',
  OTRO: 'Otro motivo',
};
export const SAL: Record<ConsumoSal, string> = { YES: 'Sí', NO: 'No', REDUCED: 'Reducido' };
export const ALCOHOL: Record<ConsumoAlcohol, string> = { NO: 'No', OCCASIONAL: 'Ocasional', FREQUENT: 'Frecuente' };
export const TABACO: Record<Tabaquismo, string> = { NO: 'No fuma', EX_SMOKER: 'Exfumador', ACTIVE: 'Fumador activo' };
export const TIPOS_VISITA: Record<TipoVisita, string> = { NEW: 'Primera vez', FOLLOW_UP: 'Seguimiento' };

/** Colores por defecto; el seed guarda #000000 en todas las categorías y eso no distingue nada. */
const COLOR_CATEGORIA: Record<CategoriaPA, string> = {
  NORMAL: '#15803d',
  ELEVATED: '#ca8a04',
  GRADE_1: '#ea580c',
  GRADE_2: '#dc2626',
  CRISIS: '#7f1d1d',
};

export function colorCategoria(c: Pick<ConfigPA, 'categoryName' | 'colorHex'> | CategoriaPA | undefined | null) {
  if (!c) return '#a8a29e';
  if (typeof c === 'string') return COLOR_CATEGORIA[c] ?? '#a8a29e';
  const propio = c.colorHex?.toLowerCase();
  return propio && propio !== '#000000' && propio !== '#000' ? c.colorHex : COLOR_CATEGORIA[c.categoryName];
}

export const opciones = <K extends string>(mapa: Record<K, string>) =>
  (Object.entries(mapa) as [K, string][]).map(([value, label]) => ({ value, label }));

export const MOTIVOS_INASISTENCIA: Record<MotivoInasistencia, string> = {
  NO_ESTABA: 'No estaba en casa',
  TRABAJANDO: 'Estaba trabajando',
  VIAJE: 'De viaje',
  ENFERMO: 'Enfermo u hospitalizado',
  NO_QUISO: 'No quiso venir',
  SE_MUDO: 'Se mudó',
  OTRO: 'Otro motivo',
};
