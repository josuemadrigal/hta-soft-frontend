import { Download, Printer, Send } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useState } from 'react';
import { usePlanilla } from '../api/consultas';
import type { FilaPlanilla } from '../api/tipos';
import { BarraPeriodo } from '../components/BarraPeriodo';
import { Boton, Cargando, Casilla, EncabezadoPagina, ErrorCarga, Tarjeta } from '../components/ui';
import { descargarCsv } from '../lib/copiar';
import { cn } from '../lib/formato';
import { usePeriodoPanel } from '../lib/periodo-panel';

type Clave = keyof Omit<FilaPlanilla, 'communityId' | 'batey' | 'fechas'>;

/** Las columnas de la planilla de papel, con su texto en español y en inglés (va a los donantes). */
const COLUMNAS: { clave: Clave; es: string; en: string; grupo?: 'existentes' | 'nuevos' }[] = [
  { clave: 'evaluados', es: 'Pacientes evaluados', en: '# of evaluated patients' },
  { clave: 'enPrograma', es: 'Pacientes en el programa', en: '# of existing patients' },
  { clave: 'conToma', es: 'Con toma de presión', en: '# of BP checks' },
  { clave: 'existentesConMedicamento', es: 'Con medicamentos para HTA', en: 'on HTN meds', grupo: 'existentes' },
  { clave: 'controlados', es: 'Controlados < 140/90', en: 'controlled BP', grupo: 'existentes' },
  { clave: 'noControlados', es: 'No controlados ≥ 140/90', en: 'uncontrolled BP', grupo: 'existentes' },
  { clave: 'datosDudosos', es: 'Datos ausentes o dudosos', en: 'absent or questionable data', grupo: 'existentes' },
  { clave: 'nuevos', es: 'Pacientes nuevos', en: '# of new patients', grupo: 'nuevos' },
  { clave: 'nuevosConMedicamento', es: 'Nuevos con medicamentos', en: 'placed on HTN meds', grupo: 'nuevos' },
];

const CORTA = new Intl.DateTimeFormat('es-DO', { day: 'numeric', month: 'short' });
const fechaDe = (s: string) => {
  const [a, m, d] = s.split('-').map(Number);
  return new Date(a, m - 1, d);
};
/** "9 oct", "9 y 16 oct", o "5 días" si son muchas. */
function textoFechas(fechas: string[]) {
  if (!fechas.length) return '—';
  if (fechas.length > 3) return `${fechas.length} días`;
  return fechas.map((f) => CORTA.format(fechaDe(f))).join(' · ');
}

/** /reportes/planilla — la planilla que se llenaba a mano después de cada jornada, ahora sola. */
export function Planilla() {
  const periodo = usePeriodoPanel();
  const consulta = usePlanilla({ from: `${periodo.desde}T00:00:00-04:00`, to: `${periodo.hasta}T23:59:59-04:00` });
  const [soloConVisitas, setSoloConVisitas] = useState(false);
  const navegar = useNavigate();

  const filas = (consulta.data?.filas ?? []).filter((f) => !soloConVisitas || f.evaluados > 0);
  const total = consulta.data?.total;
  const exportar = () =>
    descargarCsv(
      [...filas, ...(total ? [total] : [])].map((f) => ({ ...f, fechas: f.fechas.join(' ') })) as unknown as Record<string, unknown>[],
      [{ clave: 'fechas', titulo: 'Fecha / Date' }, { clave: 'batey', titulo: 'Batey' }, ...COLUMNAS.map((c) => ({ clave: c.clave, titulo: `${c.es} / ${c.en}` }))],
      `planilla-jornada_${periodo.desde}_${periodo.hasta}`,
    );

  return (
    <>
      {/* Al imprimir: hoja horizontal, como la de papel */}
      <style>{'@media print { @page { size: landscape; margin: 8mm; } th, td { padding-left: 6px !important; padding-right: 6px !important; } }'}</style>
      <EncabezadoPagina
        titulo="Planilla de la jornada"
        descripcion="La planilla que se llenaba a mano, ahora sola con lo que se registra en cada visita."
        volver={{ a: '/reportes', texto: 'Reportes' }}
        acciones={
          <div className="flex gap-2 print:hidden">
            <Boton variante="secundario" icono={<Download className="size-4" />} onClick={exportar} disabled={!consulta.data}>
              CSV
            </Boton>
            <Boton variante="secundario" icono={<Printer className="size-4" />} onClick={() => window.print()} disabled={!consulta.data}>
              Imprimir
            </Boton>
            <Boton icono={<Send className="size-4" />} onClick={() => navegar(`/reportes/planilla/enviar?desde=${periodo.desde}${periodo.hasta !== periodo.desde ? `&hasta=${periodo.hasta}` : ''}`)}>
              Enviar por correo
            </Boton>
          </div>
        }
      />
      <div className="print:hidden">
        <BarraPeriodo periodo={periodo} cambiar={periodo.cambiar} />
      </div>
      <p className="mb-3 hidden text-sm print:block">
        Light a Candle · Dominican Republic — Periodo / Period: <strong>{periodo.texto}</strong>
      </p>

      <Tarjeta
        titulo={`Por batey · ${periodo.texto}`}
        accion={<Casilla etiqueta="Solo bateyes con visitas" className="text-xs print:hidden" checked={soloConVisitas} onChange={(e) => setSoloConVisitas(e.target.checked)} />}
      >
        {consulta.isPending ? (
          <Cargando forma="lista" texto="Llenando la planilla…" />
        ) : consulta.isError ? (
          <ErrorCarga error={consulta.error} />
        ) : (
          <div className={cn('overflow-x-auto transition-opacity print:overflow-visible', consulta.isPlaceholderData && 'opacity-60')}>
            <table className="w-full min-w-[980px] border-collapse text-sm print:min-w-0 print:text-[11px]">
              <thead>
                <tr className="text-[11px] font-semibold tracking-wide text-tenue uppercase">
                  <th colSpan={5} />
                  <th colSpan={4} className="border-b border-l border-borde bg-fondo px-3 py-1.5 text-center">
                    Pacientes que ya venían · existing patients
                  </th>
                  <th colSpan={2} className="border-b border-l border-borde bg-marca-50 px-3 py-1.5 text-center">
                    Nuevos · new
                  </th>
                </tr>
                <tr className="border-b border-borde align-bottom">
                  <th className="px-4 py-2.5 text-left">
                    <span className="block text-xs font-medium">Fecha</span>
                    <span className="block text-[11px] font-normal text-tenue">Date</span>
                  </th>
                  <th className="px-4 py-2.5 text-left">
                    <span className="block text-xs font-medium">Batey</span>
                    <span className="block text-[11px] font-normal text-tenue">Batey name</span>
                  </th>
                  {COLUMNAS.map((c) => (
                    <th key={c.clave} className={cn('w-[8.5%] px-3 py-2.5 text-right', c.grupo === 'existentes' && 'bg-fondo', c.grupo === 'nuevos' && 'bg-marca-50', (c.clave === 'existentesConMedicamento' || c.clave === 'nuevos') && 'border-l border-borde')}>
                      <span className="block text-xs leading-tight font-medium text-balance">{c.es}</span>
                      <span className="mt-0.5 block text-[11px] leading-tight font-normal text-tenue">{c.en}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {filas.map((f) => (
                  <Fila key={f.communityId} f={f} />
                ))}
                {filas.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-5 py-10 text-center text-tenue">
                      No hubo visitas {periodo.frase}.
                    </td>
                  </tr>
                )}
              </tbody>
              {total && (
                <tfoot>
                  <Fila f={total} total />
                </tfoot>
              )}
            </table>
          </div>
        )}
      </Tarjeta>

      <details className="mt-4 rounded-xl border border-borde bg-superficie px-5 py-4 text-sm print:hidden">
        <summary className="cursor-pointer font-medium">Cómo se cuenta cada columna</summary>
        <ul className="mt-3 space-y-1.5 text-tenue">
          <li>
            Se cuenta <strong className="text-tinta">por paciente</strong>, no por visita: si vino dos veces en el periodo cuenta una vez, y para saber si está controlado vale su <strong className="text-tinta">última toma</strong> del periodo.
          </li>
          <li><strong className="text-tinta">Evaluados:</strong> pacientes con al menos una visita en el periodo.</li>
          <li><strong className="text-tinta">En el programa:</strong> pacientes activos registrados en el batey (hayan venido o no).</li>
          <li><strong className="text-tinta">Con toma de presión:</strong> evaluados a los que se les tomó la presión.</li>
          <li><strong className="text-tinta">Nuevos:</strong> su primera visita de siempre fue en este periodo. Los demás evaluados son los que ya venían.</li>
          <li><strong className="text-tinta">Con medicamentos:</strong> recibieron receta en el periodo. De ellos, controlados (por debajo de 140/90) y no controlados.</li>
          <li><strong className="text-tinta">Datos ausentes o dudosos:</strong> su última visita no tiene toma, o los números no cuadran (la diastólica mayor que la sistólica, o valores imposibles).</li>
        </ul>
      </details>
    </>
  );
}

function Fila({ f, total }: { f: FilaPlanilla; total?: boolean }) {
  const vacio = f.evaluados === 0 && !total;
  return (
    <tr className={cn(total ? 'border-t-2 border-tinta/20 bg-fondo font-semibold' : 'hover:bg-fondo/60', vacio && 'text-tenue')}>
      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-tenue">{total ? '' : textoFechas(f.fechas)}</td>
      <td className="px-4 py-2.5 font-medium whitespace-nowrap">{f.batey}</td>
      {COLUMNAS.map((c) => {
        const v = f[c.clave];
        // Lo que no aplica (batey sin visitas) queda en blanco, como en el papel; en el programa siempre se muestra.
        const mostrar = !vacio || c.clave === 'enPrograma';
        return (
          <td
            key={c.clave}
            className={cn(
              'tabular px-3 py-2.5 text-right',
              c.grupo === 'existentes' && 'bg-fondo/60',
              c.grupo === 'nuevos' && 'bg-marca-50/60',
              (c.clave === 'existentesConMedicamento' || c.clave === 'nuevos') && 'border-l border-borde',
              c.clave === 'noControlados' && v > 0 && !vacio && 'text-red-700',
              c.clave === 'controlados' && v > 0 && !vacio && 'text-green-700',
            )}
          >
            {mostrar ? v.toLocaleString('es-DO') : ''}
          </td>
        );
      })}
    </tr>
  );
}
