import { toBlob } from 'html-to-image';

/**
 * Copia un elemento (tarjeta con su gráfica) como imagen PNG al portapapeles, para pegarla
 * en WhatsApp, Word o una presentación. Si el navegador no deja escribir imágenes en el
 * portapapeles, se descarga el PNG.
 */
export async function copiarComoImagen(nodo: HTMLElement, nombre: string): Promise<'copiada' | 'descargada'> {
  const blob = await toBlob(nodo, {
    pixelRatio: 2,
    backgroundColor: '#ffffff',
    // Los botones de la tarjeta no van en la imagen.
    filter: (n) => !(n instanceof HTMLElement && n.dataset.noCopiar !== undefined),
  });
  if (!blob) throw new Error('No se pudo generar la imagen');
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return 'copiada';
  } catch {
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: `${nombre}.png` }).click();
    URL.revokeObjectURL(url);
    return 'descargada';
  }
}

/** Exporta filas a CSV (con BOM para que Excel respete las tildes). */
export function descargarCsv<T extends Record<string, unknown>>(filas: T[], columnas: { clave: keyof T; titulo: string }[], nombre: string) {
  const celda = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [columnas.map((c) => celda(c.titulo)).join(','), ...filas.map((f) => columnas.map((c) => celda(f[c.clave])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  Object.assign(document.createElement('a'), { href: url, download: `${nombre}.csv` }).click();
  URL.revokeObjectURL(url);
}
