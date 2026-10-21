import { Download, Printer, Send } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useState } from 'react';
import { usePlanilla } from '../api/consultas';
import { BarraPeriodo } from '../components/BarraPeriodo';
import { COLUMNAS_PLANILLA, TablaPlanilla } from '../components/TablaPlanilla';
import { Boton, Cargando, Casilla, EncabezadoPagina, ErrorCarga, Tarjeta } from '../components/ui';
import { descargarCsv } from '../lib/copiar';
import { cn } from '../lib/formato';
import { usePeriodoPanel } from '../lib/periodo-panel';

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
      [{ clave: 'batey', titulo: 'Batey Name / Nombre del batey' }, { clave: 'fechas', titulo: 'Date / Fecha' }, ...COLUMNAS_PLANILLA.map((c) => ({ clave: c.clave, titulo: `${c.en} / ${c.es}` }))],
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
            <TablaPlanilla filas={filas} total={total} vacio={`No hubo visitas ${periodo.frase}.`} />
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
