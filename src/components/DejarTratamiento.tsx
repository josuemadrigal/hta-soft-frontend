import { AlertTriangle, Pill } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useConfiguracion, useMedicamentos } from '../api/consultas';
import type { DatosNoVino } from '../api/recursos';
import type { MotivoInasistencia, PacienteJornada, Parentesco } from '../api/tipos';
import { MOTIVOS_INASISTENCIA, PARENTESCOS, PARENTESCOS_OPCIONES } from '../lib/etiquetas';
import { cn, fecha, nombreCompleto } from '../lib/formato';
import { cantidadPorDias, margenDe } from '../lib/entregas';
import { Boton, Entrada } from './ui';

type Tratamiento = NonNullable<DatosNoVino['tratamiento']>;
const DIAS = [30, 60, 90];

/**
 * Después de elegir el motivo de "No vino": ¿se le deja el tratamiento con alguien?
 * Es una ventana (no una página) para no perder la lista en plena jornada. Usa la última receta que ya
 * trae la lista del batey, así funciona sin internet.
 */
export function DejarTratamiento({
  paciente: p,
  motivo,
  alSoloNoVino,
  alDejar,
  alCancelar,
}: {
  paciente: PacienteJornada;
  motivo: MotivoInasistencia;
  alSoloNoVino: () => void;
  alDejar: (t: Tratamiento) => void;
  alCancelar: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const medicamentos = useMedicamentos().data ?? [];
  const meses = useConfiguracion().data?.reposicionMesesMaximo ?? 6;
  const ultima = p.clinicalVisits?.[0];
  const receta = useMemo(() => (ultima?.prescriptions ?? []).filter((r) => r.medicationId), [ultima]);

  const [nombre, setNombre] = useState('');
  const [parentesco, setParentesco] = useState<Parentesco | null>(null);
  const [dias, setDias] = useState(90);
  const [cantidades, setCantidades] = useState<Record<number, number | ''>>(() => Object.fromEntries(receta.map((r) => [r.medicationId, cantidadPorDias(r.dailyDose, 90, margenDe(r))])));
  const [nota, setNota] = useState('');

  const elegirDias = (d: number) => {
    setDias(d);
    setCantidades(Object.fromEntries(receta.map((r) => [r.medicationId, cantidadPorDias(r.dailyDose, d, margenDe(r))])));
  };

  // Más del plazo sin consulta: se permite (no se le niega la medicina), pero se avisa.
  const limite = new Date();
  limite.setMonth(limite.getMonth() - meses);
  const ultimaFecha = ultima?.visitDate ? new Date(ultima.visitDate) : null;
  const sinConsultaHaceMucho = !ultimaFecha || ultimaFecha < limite;
  const mesesSinConsulta = ultimaFecha ? Math.floor((Date.now() - ultimaFecha.getTime()) / (30.44 * 86_400_000)) : null;

  const items = receta.map((r) => ({ medicationId: r.medicationId, cantidad: Number(cantidades[r.medicationId]) || 0 })).filter((i) => i.cantidad > 0);
  // Lo que se puede entregar: sin vencer (si no se conoce, la existencia total).
  const hayDe = (id: number) => {
    const m = medicamentos.find((x) => x.id === id);
    return m ? (m.vigente ?? m.currentStock) : undefined;
  };
  const sinStock = items.filter((i) => i.cantidad > (hayDe(i.medicationId) ?? Infinity));
  const listo = parentesco !== null && items.length > 0 && sinStock.length === 0;

  const cerrar = (accion: () => void) => {
    ref.current?.close();
    accion();
  };

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        cerrar(alCancelar);
      }}
      onClick={(e) => e.target === e.currentTarget && cerrar(alCancelar)}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-borde bg-superficie p-0 text-tinta shadow-2xl backdrop:bg-tinta/40 backdrop:backdrop-blur-[2px]"
      aria-labelledby="dejar-titulo"
    >
      <div className="border-b border-borde px-6 py-4">
        <h2 id="dejar-titulo" className="font-semibold">
          {nombreCompleto(p)} no vino
        </h2>
        <p className="text-sm text-tenue">
          {MOTIVOS_INASISTENCIA[motivo]} · ¿Se le deja el tratamiento con alguien?
        </p>
      </div>

      {receta.length === 0 ? (
        <p className="px-6 py-5 text-sm text-tenue">No tiene una receta anterior: no hay tratamiento que dejarle. Que venga a la próxima jornada.</p>
      ) : (
        <div className="space-y-5 px-6 py-5">
          {sinConsultaHaceMucho && (
            <p className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                {ultimaFecha ? `Lleva ${mesesSinConsulta} meses sin consulta (desde el ${fecha(ultima!.visitDate)}).` : 'Nunca ha tenido una consulta.'} Se le puede dejar, pero que venga a la
                próxima jornada.
              </span>
            </p>
          )}

          <div className="space-y-2">
            <label className="block text-[13px] font-medium text-tinta/80" htmlFor="dejar-nombre">
              ¿Con quién?
            </label>
            <Entrada id="dejar-nombre" className="h-11" maxLength={120} placeholder="Nombre (opcional)" autoComplete="off" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Parentesco">
              {PARENTESCOS_OPCIONES.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={parentesco === k}
                  onClick={() => setParentesco(k)}
                  className={cn('h-10 rounded-lg border text-sm', parentesco === k ? 'border-tinta bg-marca-50 font-medium' : 'border-borde hover:bg-fondo')}
                >
                  {PARENTESCOS[k]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-tinta/80">¿Cuántas pastillas?</span>
              <div className="flex rounded-lg bg-black/5 p-0.5 text-sm" role="radiogroup" aria-label="Días a cubrir">
                {DIAS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={dias === d}
                    onClick={() => elegirDias(d)}
                    className={cn('rounded-md px-3 py-1.5', dias === d ? 'bg-superficie font-medium shadow-sm' : 'text-tenue hover:text-tinta')}
                  >
                    {d} días
                  </button>
                ))}
              </div>
            </div>
            <ul className="divide-y divide-borde rounded-lg border border-borde">
              {receta.map((r) => {
                const valor = cantidades[r.medicationId] ?? '';
                const hay = hayDe(r.medicationId);
                const falta = hay !== undefined && Number(valor) > hay;
                return (
                  <li key={r.medicationId} className="flex items-center gap-3 px-3 py-2.5">
                    <Pill className="size-4 shrink-0 text-tenue" />
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="block font-medium">
                        {r.medication?.name} {r.medication?.concentration}
                      </span>
                      <span className={cn('block text-xs', falta ? 'text-red-600' : 'text-tenue')}>
                        {r.dailyDose} al día · {dias} días + {margenDe(r)} de margen{hay !== undefined && ` · hay ${hay}`}
                      </span>
                    </span>
                    <Entrada
                      type="number"
                      inputMode="numeric"
                      min={0}
                      aria-label={`Pastillas de ${r.medication?.name ?? 'medicamento'}`}
                      className="h-10 w-24 text-right"
                      value={valor}
                      onChange={(e) => setCantidades((c) => ({ ...c, [r.medicationId]: e.target.value === '' ? '' : Math.max(0, Math.floor(Number(e.target.value))) }))}
                    />
                  </li>
                );
              })}
            </ul>
          </div>

          {sinStock.length > 0 && (
            <p className="flex gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                No hay suficiente en inventario para dejarle el tratamiento. Baja la cantidad o marca solo que no vino.
              </span>
            </p>
          )}

          <Entrada className="h-10" maxLength={500} placeholder="Nota (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} />
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2 border-t border-borde px-6 py-4">
        <Boton variante="secundario" className="h-10" onClick={() => cerrar(alSoloNoVino)}>
          Solo marcar que no vino
        </Boton>
        {receta.length > 0 && (
          <Boton
            className="h-10"
            icono={<Pill className="size-4" />}
            disabled={!listo}
            title={sinStock.length > 0 ? 'No hay suficiente en inventario' : !listo ? 'Falta el parentesco o la cantidad' : undefined}
            onClick={() => cerrar(() => alDejar({ recibioNombre: nombre.trim() || undefined, recibioParentesco: parentesco!, items, nota: nota.trim() || undefined }))}
          >
            Dejar tratamiento
          </Boton>
        )}
      </div>
    </dialog>
  );
}
