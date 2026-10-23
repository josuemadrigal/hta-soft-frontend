/**
 * Búsqueda de pacientes por nombre, código, cédula o casa, tolerante a cómo se escribe en los
 * bateyes. Es copia de la del backend (src/common/busqueda.ts), para que sin internet se encuentre lo
 * mismo que en el servidor: si se cambia allá, se cambia aquí.
 *
 *  - Por palabras y en cualquier orden: "altagracia juan" encuentra a "Juan Altagracia".
 *    Cada palabra buscada tiene que coincidir con algo; si una no coincide, el paciente no sale.
 *  - Sin acentos ni mayúsculas: "jose" = "José".
 *  - Por cómo suena: "altagrasia", "bladimir", "yeni", "ernandez" encuentran "Altagracia", "Vladimir", "Jenny", "Hernández".
 *  - Errores de tecleo: una letra de más, de menos, cambiada o dos letras al revés ("jaun" → "Juan").
 *  - El inicio basta: "alta" encuentra "Altagracia"; "bn10" encuentra el código BN1019.
 */

export const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim();

export const palabras = (s: string) => normalizar(s).split(' ').filter(Boolean);

/** Cómo suena en español del Caribe: las letras que se confunden al escribir un nombre dictado. */
export function sonido(p: string) {
  return p
    .replace(/ñ/g, 'n')
    .replace(/ch/g, 'x')
    .replace(/ll/g, 'y')
    .replace(/qu/g, 'k')
    .replace(/c([ei])/g, 's$1')
    .replace(/c/g, 'k')
    .replace(/z/g, 's')
    .replace(/v/g, 'b')
    .replace(/w/g, 'u')
    .replace(/g([ei])/g, 'j$1')
    .replace(/h/g, '')
    .replace(/i/g, 'y')
    .replace(/(.)\1+/g, '$1');
}

/** Distancia de edición con trasposiciones (Damerau, versión simple). Corta en cuanto pasa del tope. */
export function distancia(a: string, b: string, tope: number) {
  if (Math.abs(a.length - b.length) > tope) return tope + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let minimo = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + costo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      minimo = Math.min(minimo, d[i][j]);
    }
    if (minimo > tope) return tope + 1;
  }
  return d[a.length][b.length];
}

/** Cuántos errores se aceptan según el largo: las palabras cortas tienen que estar bien escritas. */
const tolerancia = (largo: number) => (largo <= 3 ? 0 : largo <= 6 ? 1 : 2);

/** Qué tan bien coincide una palabra buscada con una palabra del paciente (0 = no coincide). */
function coincidenciaPalabra(buscada: string, palabra: string) {
  if (palabra === buscada) return 10;
  if (palabra.startsWith(buscada)) return 8;
  const sb = sonido(buscada);
  const sp = sonido(palabra);
  if (sb && sp === sb) return 7;
  if (sb.length >= 3 && sp.startsWith(sb)) return 6;
  if (buscada.length >= 3 && palabra.includes(buscada)) return 5;
  const tope = tolerancia(buscada.length);
  if (tope && distancia(sb, sp, tope) <= tope) return 4;
  // Escribió solo el inicio, con un error ("altagr" → "altagracia")
  if (tope && buscada.length >= 5 && distancia(sb, sp.slice(0, sb.length), 1) <= 1) return 3;
  return 0;
}

export type Buscable = { firstName: string; lastName: string; patientCode: string; nationalId?: string | null; address?: string | null };

/**
 * Puntaje del paciente para lo que se buscó: null si no coincide. Más alto = mejor coincidencia.
 * El código, la cédula y la casa se comparan tal cual (sin tolerancia: un número equivocado es otro paciente).
 */
export function puntaje(busqueda: string | string[], p: Buscable): number | null {
  const buscadas = Array.isArray(busqueda) ? busqueda : palabras(busqueda);
  if (!buscadas.length) return 0;
  const nombre = palabras(`${p.firstName} ${p.lastName}`);
  const codigo = normalizar(p.patientCode).replace(/ /g, '');
  const cedula = normalizar(p.nationalId ?? '').replace(/ /g, '');
  const casa = normalizar(p.address ?? '');
  let total = 0;
  for (const b of buscadas) {
    let mejor = Math.max(0, ...nombre.map((w) => coincidenciaPalabra(b, w)));
    if (codigo === b) mejor = 12;
    else if (b.length >= 2 && codigo.startsWith(b)) mejor = Math.max(mejor, 9);
    if (cedula && b.length >= 4 && cedula.includes(b)) mejor = Math.max(mejor, 9);
    if (casa && casa === b) mejor = Math.max(mejor, 6);
    if (!mejor) return null;
    total += mejor;
  }
  return total / buscadas.length;
}

/** Grupo de relevancia: lo exacto, luego el inicio o el código, después lo que suena igual, al final lo aproximado. */
export const grupoDe = (p: number) => (p >= 10 ? 3 : p >= 8 ? 2 : p >= 5 ? 1 : 0);

/**
 * Los pacientes que coinciden, en orden: primero por grupo de relevancia y, dentro de cada grupo,
 * en el orden en que vienen (el que eligió quien busca). Se puntúa en memoria: son pocos miles.
 */
export function ordenarPorBusqueda<T extends Buscable & { id: number }>(q: string, candidatos: T[]) {
  const buscadas = palabras(q);
  return candidatos
    .map((c, i) => ({ c, i, p: puntaje(buscadas, c) }))
    .filter((x): x is { c: T; i: number; p: number } => x.p !== null)
    .sort((a, b) => grupoDe(b.p) - grupoDe(a.p) || a.i - b.i)
    .map((x) => x.c);
}

/** ¿Coincide el paciente con lo que se escribió? (vacío = sí). */
export const coincide = (q: string, p: Buscable) => !q.trim() || puntaje(q, p) !== null;
