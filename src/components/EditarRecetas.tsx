import { Pill, Plus, X } from 'lucide-react';
import { useMedicamentos } from '../api/consultas';
import type { Receta } from '../api/tipos';
import { margenDe } from '../lib/entregas';
import { cn } from '../lib/formato';
import { Boton, Campo, Entrada, Selector, Tarjeta } from './ui';

export type FilaReceta = {
  clave: string;
  /** La receta que ya existía (sin id: medicamento agregado al corregir). */
  id?: number;
  medicationId: number | '';
  dailyDose: string;
  bufferDays: string;
  patientSupplyRemaining: string;
  entregadas: string;
  /** Si no la tocó, en un medicamento nuevo "Entregadas" sigue a lo que le corresponde. */
  entregadasTocadas: boolean;
};

export const filasDe = (recetas: Receta[] = []): FilaReceta[] =>
  recetas.map((r) => ({
    clave: `r${r.id}`,
    id: r.id,
    medicationId: r.medicationId,
    dailyDose: String(r.dailyDose),
    bufferDays: String(r.bufferDays),
    patientSupplyRemaining: String(r.patientSupplyRemaining),
    entregadas: String(r.quantityDispensed),
    entregadasTocadas: true,
  }));

const n = (v: string) => (v.trim() === '' ? NaN : Number(v));
const corresponden = (f: FilaReceta, dias: number) => Math.max(0, n(f.dailyDose) * dias + n(f.bufferDays) - n(f.patientSupplyRemaining));

/** Lo que se manda al servidor; null si algo está incompleto. */
export function recetasParaGuardar(filas: FilaReceta[]) {
  const listas = filas.map((f) => ({
    ...(f.id && { id: f.id }),
    medicationId: Number(f.medicationId),
    dailyDose: n(f.dailyDose),
    bufferDays: n(f.bufferDays),
    patientSupplyRemaining: n(f.patientSupplyRemaining),
    entregadas: n(f.entregadas),
  }));
  const ok = filas.every((f) => f.medicationId !== '') && listas.every((r) => r.dailyDose >= 1 && [r.bufferDays, r.patientSupplyRemaining, r.entregadas].every((x) => Number.isInteger(x) && x >= 0));
  return ok ? listas : null;
}

/** ¿Cambió algo respecto a lo guardado? */
export const recetasCambiaron = (filas: FilaReceta[], recetas: Receta[] = []) => JSON.stringify(filas.map(({ clave: _c, entregadasTocadas: _t, ...f }) => f)) !== JSON.stringify(filasDe(recetas).map(({ clave: _c, entregadasTocadas: _t, ...f }) => f));

/**
 * Los medicamentos de la visita al corregirla. Cada fila dice cuánto le corresponde y qué pasa con el
 * inventario al guardar (salen o vuelven pastillas). Si no alcanza la existencia, lo marca en rojo.
 */
export function EditarRecetas({
  recetas = [],
  filas,
  alCambiar,
  dias,
  importada,
}: {
  recetas?: Receta[];
  filas: FilaReceta[];
  alCambiar: (f: FilaReceta[]) => void;
  /** Días hasta la próxima visita (de las fechas del formulario). */
  dias: number;
  /** Visita del Excel: se corrige sin mover el inventario. */
  importada: boolean;
}) {
  const medicamentos = useMedicamentos().data ?? [];
  const catalogo = medicamentos.filter((m) => m.activo);
  const hayDe = (id: number) => {
    const m = medicamentos.find((x) => x.id === id);
    return m ? (m.vigente ?? m.currentStock) : undefined;
  };
  // Lo que ya estaba entregado de ese medicamento en esta visita (si se mantiene la misma receta).
  const yaEntregadas = (f: FilaReceta) => recetas.find((r) => r.id === f.id && r.medicationId === f.medicationId)?.quantityDispensed ?? 0;

  const cambiar = (clave: string, c: Partial<FilaReceta>) =>
    alCambiar(
      filas.map((f) => {
        if (f.clave !== clave) return f;
        const nueva = { ...f, ...c };
        // En uno nuevo, "Entregadas" sigue a lo que le corresponde mientras no la escriba a mano.
        if (!nueva.entregadasTocadas && !('entregadas' in c)) {
          const v = corresponden(nueva, dias);
          if (Number.isFinite(v)) nueva.entregadas = String(v);
        }
        return nueva;
      }),
    );

  const agregar = () => {
    const nueva: FilaReceta = { clave: `n${Date.now()}`, medicationId: '', dailyDose: '1', bufferDays: String(margenDe({})), patientSupplyRemaining: '0', entregadas: '', entregadasTocadas: false };
    alCambiar([...filas, { ...nueva, entregadas: String(corresponden(nueva, dias)) }]);
  };

  return (
    <Tarjeta
      titulo="Medicamentos entregados"
      accion={<span className="text-xs text-tenue">{importada ? 'Visita del Excel: no mueve el inventario' : 'Al guardar se ajusta el inventario'}</span>}
    >
      {filas.length === 0 ? (
        <p className="px-5 py-4 text-sm text-tenue">Sin medicamentos.</p>
      ) : (
        <ul className="divide-y divide-borde">
          {filas.map((f) => {
            const usados = new Set(filas.filter((x) => x.clave !== f.clave).map((x) => x.medicationId));
            const debe = corresponden(f, dias);
            const entregadas = n(f.entregadas);
            const diferencia = Number.isFinite(entregadas) && f.medicationId !== '' ? entregadas - yaEntregadas(f) : 0;
            const hay = f.medicationId === '' ? undefined : hayDe(f.medicationId);
            const noAlcanza = !importada && diferencia > 0 && hay !== undefined && diferencia > hay;
            return (
              <li key={f.clave} className="grid grid-cols-2 items-end gap-3 px-5 py-4 sm:grid-cols-[minmax(0,2.2fr)_repeat(4,minmax(0,1fr))_auto]">
                <Campo etiqueta="Medicamento" className="col-span-2 sm:col-span-1">
                  <Selector
                    vacio="Elegir…"
                    value={f.medicationId}
                    onChange={(e) => cambiar(f.clave, { medicationId: e.target.value ? Number(e.target.value) : '' })}
                    opciones={catalogo.filter((m) => !usados.has(m.id) || m.id === f.medicationId).map((m) => ({ value: m.id, label: `${m.name} ${m.concentration}` }))}
                  />
                </Campo>
                <Campo etiqueta="Al día">
                  <Entrada type="number" inputMode="numeric" min={1} value={f.dailyDose} onChange={(e) => cambiar(f.clave, { dailyDose: e.target.value })} />
                </Campo>
                <Campo etiqueta="Margen">
                  <Entrada type="number" inputMode="numeric" min={0} value={f.bufferDays} onChange={(e) => cambiar(f.clave, { bufferDays: e.target.value })} />
                </Campo>
                <Campo etiqueta="Le quedaban">
                  <Entrada type="number" inputMode="numeric" min={0} value={f.patientSupplyRemaining} onChange={(e) => cambiar(f.clave, { patientSupplyRemaining: e.target.value })} />
                </Campo>
                <Campo etiqueta="Entregadas" error={noAlcanza ? `Hay ${hay} en inventario` : undefined}>
                  <Entrada
                    type="number"
                    inputMode="numeric"
                    min={0}
                    className="font-medium"
                    value={f.entregadas}
                    onChange={(e) => cambiar(f.clave, { entregadas: e.target.value, entregadasTocadas: true })}
                    aria-invalid={noAlcanza}
                  />
                </Campo>
                <button
                  type="button"
                  onClick={() => alCambiar(filas.filter((x) => x.clave !== f.clave))}
                  className="mb-1 grid size-9 place-items-center rounded-lg text-tenue hover:bg-red-50 hover:text-red-600"
                  aria-label="Quitar este medicamento"
                  title="Quitar este medicamento"
                >
                  <X className="size-4" />
                </button>
                <p className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-tenue sm:col-span-6">
                  <span className="inline-flex items-center gap-1">
                    <Pill className="size-3.5" />
                    {Number.isFinite(debe) ? `Le corresponden ${debe} (${dias} días + ${f.bufferDays || 0} de margen − ${f.patientSupplyRemaining || 0} que le quedaban)` : 'Completa los datos'}
                  </span>
                  {!importada && diferencia !== 0 && (
                    <span className={cn('font-medium', diferencia > 0 ? (noAlcanza ? 'text-red-600' : 'text-amber-800') : 'text-green-700')}>
                      {diferencia > 0 ? `Salen ${diferencia} más del inventario` : `Vuelven ${-diferencia} al inventario`}
                    </span>
                  )}
                  {!importada && hay !== undefined && !noAlcanza && <span>hay {hay}</span>}
                  {exagerada(f, dias) && <span className="font-medium text-amber-800">Es mucho más de lo que le corresponde: revisa la cantidad</span>}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      {/* Quitar uno que ya existía devuelve todo lo que se le entregó */}
      {recetas.some((r) => !filas.some((f) => f.id === r.id && f.medicationId === r.medicationId)) && !importada && (
        <p className="border-t border-borde bg-green-50 px-5 py-2.5 text-xs text-green-800">
          {recetas
            .filter((r) => !filas.some((f) => f.id === r.id && f.medicationId === r.medicationId) && r.quantityDispensed > 0)
            .map((r) => `${r.medication?.name ?? 'Medicamento'} ${r.medication?.concentration ?? ''}: vuelven ${r.quantityDispensed} al inventario`)
            .join(' · ') || 'Se quita sin mover el inventario.'}
        </p>
      )}
      <div className="border-t border-borde px-5 py-3">
        <Boton variante="secundario" className="h-9" icono={<Plus className="size-4" />} onClick={agregar} disabled={filas.length >= catalogo.length}>
          Agregar medicamento
        </Boton>
      </div>
    </Tarjeta>
  );
}

/** Mucho más de lo que le corresponde: casi siempre es un dedo de más (89 → 8960). */
const exagerada = (f: FilaReceta, dias: number) => {
  const debe = corresponden(f, dias);
  const e = n(f.entregadas);
  return Number.isFinite(debe) && Number.isFinite(e) && e > Math.max(debe * 1.5, debe + 30);
};

/** Medicamentos con muchas más entregadas de lo que les corresponde, para confirmar antes de guardar. */
export function filasExageradas(filas: FilaReceta[], dias: number, medicamentos: { id: number; name: string; concentration: string }[]) {
  return filas
    .filter((f) => exagerada(f, dias))
    .map((f) => {
      const m = medicamentos.find((x) => x.id === f.medicationId);
      return `${m ? `${m.name} ${m.concentration}` : 'Medicamento'}: ${f.entregadas} (le corresponden ${corresponden(f, dias)})`;
    });
}

/** ¿Alguna fila pide más de lo que hay? */
export function faltaInventario(filas: FilaReceta[], recetas: Receta[], medicamentos: { id: number; vigente?: number; currentStock: number }[]) {
  return filas.some((f) => {
    if (f.medicationId === '') return false;
    const ya = recetas.find((r) => r.id === f.id && r.medicationId === f.medicationId)?.quantityDispensed ?? 0;
    const m = medicamentos.find((x) => x.id === f.medicationId);
    const hay = m ? (m.vigente ?? m.currentStock) : Infinity;
    return n(f.entregadas) - ya > hay;
  });
}
