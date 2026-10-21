export const CATEGORIAS = {
    NORMAL: 'Normal',
    ELEVATED: 'Elevada',
    GRADE_1: 'HTA grado 1',
    GRADE_2: 'HTA grado 2',
    CRISIS: 'Crisis hipertensiva',
};
export const GENEROS = { MALE: 'Masculino', FEMALE: 'Femenino', OTHER: 'Otro' };
export const ESTADOS = { ACTIVE: 'Activo', INACTIVE: 'De baja', DECEASED: 'Fallecido' };
export const MOTIVOS_BAJA = {
    FALLECIDO: 'Falleció',
    MUDANZA: 'Se mudó',
    ABANDONO: 'Abandonó el programa',
    TRASLADO: 'Pasó a otro programa o médico',
    OTRO: 'Otro motivo',
};
export const SAL = { YES: 'Sí', NO: 'No', REDUCED: 'Reducido' };
export const ALCOHOL = { NO: 'No', OCCASIONAL: 'Ocasional', FREQUENT: 'Frecuente' };
export const TABACO = { NO: 'No fuma', EX_SMOKER: 'Exfumador', ACTIVE: 'Fumador activo' };
export const TIPOS_VISITA = { NEW: 'Primera vez', FOLLOW_UP: 'Seguimiento' };
/** Colores por defecto; el seed guarda #000000 en todas las categorías y eso no distingue nada. */
const COLOR_CATEGORIA = {
    NORMAL: '#15803d',
    ELEVATED: '#ca8a04',
    GRADE_1: '#ea580c',
    GRADE_2: '#dc2626',
    CRISIS: '#7f1d1d',
};
export function colorCategoria(c) {
    if (!c)
        return '#a8a29e';
    if (typeof c === 'string')
        return COLOR_CATEGORIA[c] ?? '#a8a29e';
    const propio = c.colorHex?.toLowerCase();
    return propio && propio !== '#000000' && propio !== '#000' ? c.colorHex : COLOR_CATEGORIA[c.categoryName];
}
export const opciones = (mapa) => Object.entries(mapa).map(([value, label]) => ({ value, label }));
export const MOTIVOS_INASISTENCIA = {
    NO_ESTABA: 'No estaba en casa',
    TRABAJANDO: 'Estaba trabajando',
    VIAJE: 'De viaje',
    ENFERMO: 'Enfermo u hospitalizado',
    NO_QUISO: 'No quiso venir',
    SE_MUDO: 'Se mudó',
    OTRO: 'Otro motivo',
};
export const MOTIVOS_REPOSICION = {
    FAMILIAR_RECOGE: 'Un familiar las recoge',
    SE_LE_ACABARON: 'Se le acabaron antes de la jornada',
    SE_DEJO_CON_ALGUIEN: 'No estaba: se le dejó con alguien',
    // Ya no se ofrece (se confundía con la visita domiciliaria); queda para leer lo viejo.
    DOMICILIO: 'Entrega a domicilio',
    OTRO: 'Otro motivo',
};
export const RECIBIO_ENTREGA = {
    PACIENTE: 'El paciente',
    FAMILIAR: 'Un familiar',
    OTRO: 'Otra persona',
};
export const MOTIVOS_DEVOLUCION = {
    CORRECCION: { texto: 'Se registró de más', ayuda: 'Las pastillas no llegaron a salir: vuelven al inventario y lo que faltaba queda pendiente otra vez.' },
    PACIENTE_DEVOLVIO: { texto: 'El paciente las devolvió', ayuda: 'Cambio de tratamiento, fallecimiento, le sobraron… No queda nada pendiente.' },
};
export const DESTINOS_DEVOLUCION = {
    INVENTARIO: { texto: 'Vuelven al inventario', ayuda: 'Al mismo lote del que salieron.' },
    DESCARTE: { texto: 'Se descartan', ayuda: 'Dañadas, vencidas o en mal estado. Queda en el kárdex.' },
};
export const PARENTESCOS = {
    HIJO: 'Hijo/a',
    PAREJA: 'Esposo/a',
    HERMANO: 'Hermano/a',
    PADRE: 'Padre/Madre',
    VECINO: 'Vecino/a',
    OTRO: 'Otro',
};
/** Los que se ofrecen al dejar el tratamiento. PADRE queda solo para mostrar registros anteriores. */
export const PARENTESCOS_OPCIONES = ['HIJO', 'PAREJA', 'HERMANO', 'VECINO', 'OTRO'];
/** Sin nombre, solo el parentesco: "su hijo/a", "un vecino/a", "otra persona". */
const sinNombre = (p) => (p === 'OTRO' ? 'otra persona' : p === 'VECINO' ? 'un vecino/a' : `su ${PARENTESCOS[p].toLowerCase()}`);
/** "Rosa (hijo/a)" / "su hijo/a" / "alguien" */
export const conQuien = (nombre, parentesco) => nombre ? `${nombre}${parentesco ? ` (${PARENTESCOS[parentesco].toLowerCase()})` : ''}` : parentesco ? sinNombre(parentesco) : 'alguien';
