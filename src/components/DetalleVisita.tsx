import { ChevronLeft, ChevronRight, Home, X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import type { Visita } from '../api/tipos';
import { TIPOS_VISITA } from '../lib/etiquetas';
import { atendio, cn, colorCumplimiento, decimal, fecha, fechaYHora } from '../lib/formato';
import { InsigniaCategoria } from './ui';

function Dato({ etiqueta, children, className }: { etiqueta: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs text-tenue">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

const par = (s: number | null, d: number | null) => (s && d ? `${s}/${d}` : '—');
const o = (v: unknown, sufijo = '') => (v === null || v === undefined || v === '' ? '—' : `${v}${sufijo}`);

/**
 * Todos los datos de una visita anterior, para consultarla sin salir del registro de la de hoy.
 * Las flechas (y ← →) pasan a la visita más antigua o a la más reciente.
 */
export function DetalleVisita({ visitas, indice, alCambiar, alCerrar }: { visitas: Visita[]; indice: number; alCambiar: (i: number) => void; alCerrar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const v = visitas[indice];
  // visitas va de la más reciente a la más antigua
  const masAntigua = indice < visitas.length - 1 ? indice + 1 : null;
  const masReciente = indice > 0 ? indice - 1 : null;

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && masAntigua !== null) alCambiar(masAntigua);
      if (e.key === 'ArrowRight' && masReciente !== null) alCambiar(masReciente);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [masAntigua, masReciente, alCambiar]);

  const cerrar = () => {
    ref.current?.close();
    alCerrar();
  };
  const flecha = 'grid size-10 place-items-center rounded-lg border border-borde bg-superficie text-tinta hover:bg-fondo disabled:opacity-30';
  const automatica = v.systolicAuto || v.diastolicAuto;

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        cerrar();
      }}
      onClick={(e) => e.target === e.currentTarget && cerrar()}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-borde bg-superficie p-0 text-tinta shadow-2xl backdrop:bg-tinta/40 backdrop:backdrop-blur-[2px]"
      aria-labelledby="detalle-visita-titulo"
    >
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-borde bg-superficie px-5 py-4">
        <button type="button" className={flecha} onClick={() => masAntigua !== null && alCambiar(masAntigua)} disabled={masAntigua === null} aria-label="Visita anterior (más antigua)" title="Más antigua (←)">
          <ChevronLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <h2 id="detalle-visita-titulo" className="font-semibold">
            Visita del {fecha(v.visitDate)}
            {v.isHomeVisit && <Home className="ml-1.5 inline size-4 text-tenue" aria-label="Domiciliaria" />}
          </h2>
          <p className="text-xs text-tenue">
            {indice === 0 ? 'La última · ' : ''}
            {indice + 1} de {visitas.length}
          </p>
        </div>
        <button type="button" className={flecha} onClick={() => masReciente !== null && alCambiar(masReciente)} disabled={masReciente === null} aria-label="Visita siguiente (más reciente)" title="Más reciente (→)">
          <ChevronRight className="size-5" />
        </button>
        <button type="button" className="grid size-10 place-items-center rounded-lg text-tenue hover:bg-fondo hover:text-tinta" onClick={cerrar} aria-label="Cerrar">
          <X className="size-5" />
        </button>
      </div>

      <div className="space-y-5 px-5 py-5">
        {/* Presión */}
        <section className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl bg-fondo px-4 py-4">
          <div>
            <p className="text-xs text-tenue">{v.systolicManual && v.diastolicManual ? 'Manual' : automatica ? 'Automática' : 'Presión'}</p>
            <p className="tabular font-mono text-3xl font-semibold">{par(v.systolicManual ?? v.systolicAuto, v.diastolicManual ?? v.diastolicAuto)}</p>
          </div>
          <div className="space-y-1">
            {v.bpClassification ? <InsigniaCategoria config={v.bpClassification} /> : <span className="text-sm text-tenue">Sin toma válida</span>}
            {v.systolicManual && v.diastolicManual && automatica && <p className="text-xs text-tenue">Automática: {par(v.systolicAuto, v.diastolicAuto)}</p>}
          </div>
        </section>

        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Dato etiqueta="Peso">{v.weightKg ? `${decimal(v.weightKg)} kg` : '—'}</Dato>
          <Dato etiqueta="Estatura">{v.heightM ? `${decimal(v.heightM, 2)} m` : '—'}</Dato>
          <Dato etiqueta="IMC">{v.bmi ? decimal(v.bmi) : '—'}</Dato>
          <Dato etiqueta="Tipo">{TIPOS_VISITA[v.visitType]}</Dato>
          <Dato etiqueta="Frec. cardíaca">{o(v.heartRate, ' lpm')}</Dato>
          <Dato etiqueta="Saturación O₂">{o(v.oxygenSaturation, ' %')}</Dato>
          <Dato etiqueta="Temperatura">{v.temperature ? `${decimal(v.temperature)} °C` : '—'}</Dato>
          <Dato etiqueta="Próxima visita">{fecha(v.nextVisitDate)}</Dato>
          <Dato etiqueta="Atendió" className="col-span-2">
            {atendio(v)}
          </Dato>
          <Dato etiqueta="Registrada" className="col-span-2">
            {fechaYHora(v.createdAt ?? v.visitDate)}
            {v.importada && <span className="text-tenue"> · importada del Excel</span>}
          </Dato>
        </dl>

        <section>
          <h3 className="mb-2 text-sm font-semibold">Medicamentos</h3>
          {v.prescriptions?.length ? (
            <div className="overflow-x-auto rounded-lg border border-borde">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-borde bg-fondo text-left text-xs text-tenue">
                    <th className="px-3 py-2 font-medium">Medicamento</th>
                    <th className="px-3 py-2 text-right font-medium">Al día</th>
                    <th className="px-3 py-2 text-right font-medium">Le quedaban</th>
                    <th className="px-3 py-2 text-right font-medium">Entregadas</th>
                    <th className="px-3 py-2 text-right font-medium">Cumplimiento</th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {v.prescriptions.map((r) => {
                    const pendiente = r.cantidadIndicada !== undefined && r.quantityDispensed < r.cantidadIndicada;
                    return (
                      <tr key={r.id} className="border-b border-borde last:border-0">
                        <td className="px-3 py-2">
                          {r.medication?.name} <span className="text-tenue">{r.medication?.concentration}</span>
                        </td>
                        <td className="px-3 py-2 text-right">{r.dailyDose}</td>
                        <td className="px-3 py-2 text-right">{r.patientSupplyRemaining}</td>
                        <td className={cn('px-3 py-2 text-right', pendiente && 'text-amber-800')}>
                          {pendiente ? `${r.quantityDispensed} de ${r.cantidadIndicada}` : r.quantityDispensed}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.adherencePercentage !== null ? (
                            <span className={cn('font-medium', colorCumplimiento(Number(r.adherencePercentage)))}>{Math.round(Number(r.adherencePercentage))}%</span>
                          ) : (
                            <span className="text-tenue">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-tenue">Sin medicamentos.</p>
          )}
        </section>

        {(v.reason || v.notes || v.prescriptionText) && (
          <dl className="space-y-3">
            {v.reason && <Dato etiqueta="Motivo de consulta">{v.reason}</Dato>}
            {v.notes && (
              <Dato etiqueta="Comentario">
                <span className="whitespace-pre-line">{v.notes}</span>
              </Dato>
            )}
            {v.prescriptionText && (
              <Dato etiqueta="Indicaciones">
                <span className="whitespace-pre-line">{v.prescriptionText}</span>
              </Dato>
            )}
          </dl>
        )}
      </div>
    </dialog>
  );
}
