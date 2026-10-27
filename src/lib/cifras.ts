import { CATEGORIAS, GENEROS } from './etiquetas';
import type { CategoriaPA, Genero } from '../api/tipos';

/**
 * Las cifras del resumen (Reportes, ficha del médico) se abren como lista de pacientes con
 * "cifra": "trimestre:2026-4,categoria:GRADE_1". El servidor usa la misma regla que la cifra.
 */
export type Cifra = {
  trimestre?: string;
  batey?: number;
  medicamento?: string;
  tipo?: 'nuevos' | 'domiciliarias' | 'conReceta' | 'conToma';
  tramo?: number;
  categoria?: CategoriaPA;
  estado?: 'controlados' | 'noControlados' | 'conToma';
  edad?: string;
  genero?: Genero;
  habito?: number;
  pastillas?: boolean;
};

export const textoCifra = (c: Cifra) =>
  Object.entries(c)
    .filter(([, v]) => v !== undefined && v !== false)
    .map(([k, v]) => (v === true ? k : `${k}:${v}`))
    .join(',');

export function leerCifra(texto: string): Cifra {
  const c: Record<string, unknown> = {};
  for (const parte of texto.split(',').filter(Boolean)) {
    const i = parte.indexOf(':');
    const k = i < 0 ? parte : parte.slice(0, i);
    const v = i < 0 ? '' : parte.slice(i + 1);
    c[k] = k === 'pastillas' ? true : k === 'batey' || k === 'tramo' || k === 'habito' ? Number(v) : v;
  }
  return c as Cifra;
}

const TRAMOS = ['Menos de 50%', '50–79%', '80–94%', '95–100%'];
const HABITOS = ['Consume sal', 'Consume alcohol', 'Fuma', 'Antecedentes familiares'];
const TIPOS = { nuevos: 'Visitas de primera vez', domiciliarias: 'Visitas domiciliarias', conReceta: 'Con receta', conToma: 'Con toma de presión' };
const ESTADOS = { controlados: 'Controlados (< 140/90)', noControlados: 'Sin control (≥ 140/90)', conToma: 'Con toma de presión' };

/** "2026-4" → "T4 2026" */
export const etiquetaTrimestre = (clave: string) => {
  const [a, t] = clave.split('-');
  return `T${t} ${a}`;
};

/** Título de la lista: lo que cuenta la cifra, en palabras. */
export function describirCifra(c: Cifra, nombreBatey?: (id: number) => string): string {
  const partes = [
    c.estado && ESTADOS[c.estado],
    c.categoria && CATEGORIAS[c.categoria],
    c.tipo && TIPOS[c.tipo],
    c.medicamento,
    c.tramo !== undefined && `Cumplimiento ${TRAMOS[c.tramo]}`,
    c.edad && `${c.edad} años`,
    c.genero && GENEROS[c.genero],
    c.habito !== undefined && HABITOS[c.habito],
    c.pastillas && !c.medicamento && 'Pastillas entregadas',
    c.batey && nombreBatey?.(c.batey),
    c.trimestre && etiquetaTrimestre(c.trimestre),
  ].filter(Boolean);
  return partes.length ? partes.join(' · ') : 'Pacientes atendidos';
}

/** Qué cuenta cada tipo de cifra, para la nota bajo el título. */
export function explicarCifra(c: Cifra): string {
  if (c.categoria || c.estado || c.edad || c.genero || c.habito !== undefined) return 'Se mira la última toma de cada paciente en el periodo (o en ese trimestre o batey). Se muestra esa visita.';
  if (c.pastillas) return 'Las pastillas que recibió cada paciente en el periodo, en sus visitas y en las reposiciones sin consulta. La columna "Aporte" suma la cifra.';
  if (c.tramo !== undefined) return 'Pacientes con al menos una receta en ese tramo de cumplimiento. La columna "Aporte" trae el cumplimiento promedio de esas recetas.';
  return 'Cada paciente con su última visita contada. La columna "Aporte" dice cuántas visitas y pastillas suma a la cifra.';
}

/** Enlace a la lista de una cifra de Reportes, con los filtros de la pantalla (desde, hasta, batey, género, edad). */
export function enlaceResumen(c: Cifra, filtros: URLSearchParams) {
  const q = new URLSearchParams(filtros);
  q.set('fuente', 'resumen');
  q.set('cifra', textoCifra(c));
  return `/reportes/pacientes?${q}`;
}

/** Enlace a la lista de una cifra de la ficha del médico, con su mismo periodo y batey. */
export function enlaceMedico(id: number, c: Cifra | string, filtros: URLSearchParams) {
  const q = new URLSearchParams(filtros);
  q.set('columna', typeof c === 'string' ? c : textoCifra(c));
  return `/medicos/${id}/pacientes?${q}`;
}
