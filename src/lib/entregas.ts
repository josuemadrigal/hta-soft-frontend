/** Pastillas para cubrir N días. Se redondea hacia arriba: con media pastilla al día no puede faltar la última. */
/** Pastillas para cubrir esos días, más los días de margen (como en la visita: 90 días + 5 = 95). */
export const cantidadPorDias = (dosisDiaria: number, dias: number, margen = 0) => (dosisDiaria > 0 && dias > 0 ? Math.ceil(dosisDiaria * dias) + Math.max(0, margen) : 0);

/** Margen de la receta; si no lo trae o es 0 (como casi todas las importadas del Excel), los 5 días de siempre. */
export const MARGEN_POR_DEFECTO = 5;
export const margenDe = (r: { bufferDays?: number | null }) => r.bufferDays || MARGEN_POR_DEFECTO;

/** Lo que se ofrece entregar de entrada: lo que falta, sin pasarse de lo que hay. */
export const cantidadSugerida = (pendiente: number, existencia: number | undefined) => Math.max(0, Math.min(pendiente, existencia ?? pendiente));

/** El inventario responde en inglés cuando no alcanza; aquí se traduce. */
export function mensajeEntrega(m: string) {
  const sinStock = m.match(/^Insufficient stock for (.+)\. Required: (\d+), Available: (\d+)/);
  return sinStock ? `No hay suficiente ${sinStock[1]}: hacen falta ${sinStock[2]} y quedan ${sinStock[3]}. No se entregó nada.` : m;
}
