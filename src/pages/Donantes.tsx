import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDownRight, ArrowUpRight, Check, FileDown, HeartHandshake, Pencil } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { useReporteDonantes } from '../api/consultas';
import { descargarPdfDonantes, guardarTextoDonantes } from '../api/recursos';
import type { ClaveIndicador, MotivoBaja, ReporteDonantes } from '../api/tipos';
import { trimestreActual } from '../components/Periodo';
import { Barras, COLOR, EJE, LEYENDA, REJILLA, TOOLTIP } from '../components/graficas';
import { AreaTexto, Boton, Cargando, ErrorCarga, Selector, Tarjeta } from '../components/ui';
import { CATEGORIAS, colorCategoria, MOTIVOS_BAJA } from '../lib/etiquetas';
import { cn, fecha } from '../lib/formato';
import { formatoIndicador } from './Metas';

const PRIMER_ANIO = 2017;
const MESES = ['enero – marzo', 'abril – junio', 'julio – septiembre', 'octubre – diciembre'];
const mesAnio = new Intl.DateTimeFormat('es-DO', { month: 'long', year: 'numeric' });
/** "Amlodipina 10 mg" → "AML 10 mg" */
export const abreviar = (m: string) => {
  const [nombre, ...resto] = m.split(' ');
  return `${nombre.slice(0, 3).toUpperCase()} ${resto.join(' ')}`;
};
const miles = (n: number | null) => (n === null ? '—' : n.toLocaleString('es-DO'));

/** /reportes/donantes?anio=&t= — informe trimestral listo para imprimir o guardar como PDF. */
export function Donantes() {
  const [params, setParams] = useSearchParams();
  const hoy = new Date();
  // Por defecto, el último trimestre cerrado.
  const tCerrado = trimestreActual() === 1 ? 4 : trimestreActual() - 1;
  const aCerrado = trimestreActual() === 1 ? hoy.getFullYear() - 1 : hoy.getFullYear();
  const anio = Number(params.get('anio')) || aCerrado;
  // t = null: año completo
  const t = params.get('t') === 'anual' ? null : Number(params.get('t')) || tCerrado;
  const consulta = useReporteDonantes(anio, t);
  const ultimoT = anio === hoy.getFullYear() ? trimestreActual() : 4;
  const pdf = useMutation({
    mutationFn: () => descargarPdfDonantes(anio, t),
    onSuccess: () => toast.success('PDF descargado: listo para enviar.'),
    onError: (e) => toast.error(`No se pudo generar el PDF: ${e.message}`),
  });

  return (
    <>
      <div className="no-imprimir mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Informe para donantes</h1>
          <p className="mt-1 text-sm text-tenue">
            Resumen del impacto por trimestre o por año, sin datos personales de los pacientes. Escribe el mensaje de la fundación y descarga el PDF para enviarlo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Selector
            className="w-28"
            value={anio}
            onChange={(e) =>
              setParams({ anio: e.target.value, t: t === null ? 'anual' : String(Math.min(t, Number(e.target.value) === hoy.getFullYear() ? trimestreActual() : 4)) }, { replace: true })
            }
            opciones={Array.from({ length: hoy.getFullYear() - PRIMER_ANIO + 1 }, (_, i) => ({ value: hoy.getFullYear() - i, label: String(hoy.getFullYear() - i) }))}
          />
          <Selector
            className="w-52"
            value={t ?? 'anual'}
            onChange={(e) => setParams({ anio: String(anio), t: e.target.value }, { replace: true })}
            opciones={[
              ...Array.from({ length: ultimoT }, (_, i) => ({ value: String(i + 1), label: `T${i + 1} · ${MESES[i]}` })),
              { value: 'anual', label: anio === hoy.getFullYear() ? 'Año completo (hasta hoy)' : 'Año completo' },
            ]}
          />
          <Boton icono={<FileDown className="size-4" />} disabled={!consulta.data} cargando={pdf.isPending} onClick={() => pdf.mutate()}>
            Descargar PDF
          </Boton>
        </div>
      </div>
      {consulta.isPending ? (
        <Cargando texto="Preparando el informe…" />
      ) : consulta.isError ? (
        <ErrorCarga error={consulta.error} />
      ) : (
        <div className={cn('transition-opacity', consulta.isPlaceholderData && 'opacity-60')}>
          <Informe r={consulta.data} />
        </div>
      )}
    </>
  );
}

function Comparacion({ actual, antes, etiqueta, mayorEsMejor = true, pct }: { actual: number | null; antes: number | null; etiqueta: string; mayorEsMejor?: boolean; pct?: boolean }) {
  if (actual === null || antes === null) return <span className="text-tenue">sin dato de {etiqueta}</span>;
  const d = actual - antes;
  if (Math.abs(d) < (pct ? 0.5 : 1)) return <span className="text-tenue">igual que {etiqueta}</span>;
  const bueno = d > 0 === mayorEsMejor;
  const Icono = d > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn('inline-flex items-center gap-0.5', bueno ? 'text-green-700' : 'text-red-600')}>
      <Icono className="size-3.5" />
      {pct ? `${d > 0 ? '+' : ''}${Math.round(d)} pts` : `${d > 0 ? '+' : ''}${miles(d)}`} vs {etiqueta}
    </span>
  );
}

function Cifra({ titulo, valor, children }: { titulo: string; valor: ReactNode; children?: ReactNode }) {
  return (
    <div className="sin-cortar rounded-xl border border-borde bg-superficie p-4">
      <p className="text-xs text-tenue">{titulo}</p>
      <p className="tabular mt-1 text-3xl font-semibold tracking-tight">{valor}</p>
      {children && <p className="mt-1 text-xs">{children}</p>}
    </div>
  );
}

function Informe({ r }: { r: ReporteDonantes }) {
  const a = r.actual;
  const p = r.previo;
  const total = r.categorias.reduce((x, c) => x + c.pacientes, 0);
  const fallecidos = r.bajas.FALLECIDO ?? 0;
  const otrasBajas = (Object.entries(r.bajas) as [MotivoBaja, number][]).filter(([m]) => m !== 'FALLECIDO');
  const bateyes = r.porBatey.length;
  const periodo = r.periodo.anual ? 'año' : 'trimestre';

  return (
    <article className="space-y-5">
      {/* Portada */}
      <header className="sin-cortar flex flex-wrap items-center justify-between gap-4 rounded-xl border border-borde bg-superficie p-6">
        <div>
          <img src="/logo.webp" alt="Light a Candle · Dominican Republic" className="h-14 w-auto" />
          <p className="mt-3 text-xs font-semibold tracking-wider text-tenue uppercase">Programa de control de la hipertensión · bateyes de La Romana</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">{r.periodo.anual ? `Informe anual ${r.periodo.anio}` : `Informe trimestral ${r.periodo.etiqueta}`}</h2>
          <p className="mt-1 text-sm text-tenue">
            Del {fecha(r.periodo.desde)} al {fecha(r.periodo.hasta)}
            {r.periodo.enCurso && ' · periodo en curso: cifras parciales'}
          </p>
        </div>
        <div className="rounded-xl bg-marca-500 px-6 py-4 text-center">
          <p className="tabular text-4xl font-bold">{miles(a.pacientes_atendidos)}</p>
          <p className="text-sm font-medium">pacientes atendidos</p>
          <p className="text-xs">en {bateyes} bateyes</p>
        </div>
      </header>

      <Mensaje r={r} />

      <section className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Cifra titulo="Pacientes con la presión controlada" valor={formatoIndicador('pct', a.controlados_pct)}>
          <Comparacion actual={a.controlados_pct} antes={p.controlados_pct} etiqueta={p.etiqueta} pct />
        </Cifra>
        <Cifra titulo="Consultas realizadas" valor={miles(a.visitas)}>
          <Comparacion actual={a.visitas} antes={p.visitas} etiqueta={p.etiqueta} />
        </Cifra>
        <Cifra titulo="Pastillas entregadas gratis" valor={miles(r.pastillasTotal)}>
          <span className="text-tenue">{[...new Set(r.medicamentos.map((m) => m.medicamento.split(' ')[0]))].join(', ') || '—'} · {r.medicamentos.length} presentaciones</span>
        </Cifra>
        <Cifra titulo="Días de jornada en los bateyes" valor={miles(a.dias_jornada)}>
          <Comparacion actual={a.dias_jornada} antes={p.dias_jornada} etiqueta={p.etiqueta} />
        </Cifra>
        <Cifra titulo="Pacientes nuevos" valor={miles(a.pacientes_nuevos)}>
          <Comparacion actual={a.pacientes_nuevos} antes={p.pacientes_nuevos} etiqueta={p.etiqueta} />
        </Cifra>
        <Cifra titulo="Toman su tratamiento" valor={formatoIndicador('pct', a.cumplimiento_pct)}>
          <span className="text-tenue">cumplimiento promedio</span>
        </Cifra>
      </section>

      <p className="sin-cortar rounded-xl border border-borde bg-superficie px-5 py-4 text-sm leading-relaxed">
        Atendimos a <strong>{miles(r.demografia.mujeres)} mujeres</strong> y <strong>{miles(r.demografia.hombres)} hombres</strong>
        {r.demografia.edadPromedio !== null && <>, con una edad promedio de <strong>{r.demografia.edadPromedio} años</strong></>}; {miles(r.demografia.mayores60)} tienen 60 años o
        más. {r.periodo.anual ? `Frente a ${r.previo.etiqueta}` : `Comparado con el mismo trimestre del año pasado (${r.mismoAnterior.etiqueta})`}, el control de la presión pasó de{' '}
        <strong>{formatoIndicador('pct', r.mismoAnterior.controlados_pct)}</strong> a <strong>{formatoIndicador('pct', a.controlados_pct)}</strong>.
      </p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Tarjeta titulo="Evolución en los últimos dos años" copiable className="sin-cortar">
          <div className="h-64 px-2 pt-4 pb-2">
            <ResponsiveContainer>
              <ComposedChart data={r.evolucion} margin={{ left: -8, right: 4 }}>
                <CartesianGrid {...REJILLA} />
                <XAxis dataKey="etiqueta" {...EJE} fontSize={11} />
                <YAxis yAxisId="n" allowDecimals={false} {...EJE} />
                <YAxis yAxisId="p" orientation="right" domain={[0, 100]} unit="%" {...EJE} />
                <Tooltip {...TOOLTIP} formatter={(v, n) => (n === '% controlados' ? `${v}%` : miles(Number(v)))} />
                <Legend {...LEYENDA} />
                <Bar yAxisId="n" dataKey="pacientes" name="Pacientes atendidos" fill={COLOR.amarillo} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
                <Line yAxisId="p" dataKey="controlados" name="% controlados" stroke={COLOR.tinta} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Tarjeta>
        <Tarjeta titulo={`Cómo terminaron el ${periodo}`} copiable className="sin-cortar" accion={<span className="text-xs text-tenue">Última toma de cada paciente</span>}>
          <div className="p-5">
            <Barras
              filas={r.categorias.map((c) => ({ etiqueta: CATEGORIAS[c.categoria], valor: c.pacientes, color: colorCategoria(c.categoria), detalle: total ? `${Math.round((c.pacientes / total) * 100)}%` : undefined }))}
            />
          </div>
        </Tarjeta>
      </div>

      {r.casos.length > 0 && (
        <section className="sin-cortar">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <HeartHandshake className="size-4" /> Historias del {periodo}
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {r.casos.map((c, i) => (
              <div key={i} className="rounded-xl border border-borde bg-superficie p-4 text-sm leading-relaxed">
                <p>
                  <strong>
                    {c.iniciales}, {c.sexo} de {c.edad} años
                  </strong>{' '}
                  de {c.batey}. En {mesAnio.format(new Date(c.fechaAntes))} llegó con la presión en <strong className="text-red-600">{c.antes}</strong>; con el tratamiento y el
                  seguimiento de cada jornada, el {fecha(c.fechaAhora)} la tenía en <strong className="text-green-700">{c.ahora}</strong>.
                </p>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-tenue">Para proteger su privacidad solo se muestran las iniciales.</p>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Por batey" className="sin-cortar overflow-x-auto lg:col-span-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-borde text-left text-xs text-tenue">
                <th className="px-5 py-2 font-medium">Batey</th>
                <th className="px-3 py-2 text-right font-medium">Pacientes</th>
                <th className="px-3 py-2 text-right font-medium">Controlados</th>
                {r.medicamentosNombres.map((m) => (
                  <th key={m} className="px-3 py-2 text-right font-medium whitespace-nowrap" title={m}>
                    {abreviar(m)}
                  </th>
                ))}
                <th className="px-5 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {r.porBatey.map((b) => (
                <tr key={b.batey} className="border-b border-borde last:border-0">
                  <td className="px-5 py-1.5 whitespace-nowrap">{b.batey}</td>
                  <td className="px-3 py-1.5 text-right">{miles(b.pacientes)}</td>
                  <td className="px-3 py-1.5 text-right">{formatoIndicador('pct', b.controladosPct)}</td>
                  {r.medicamentosNombres.map((m) => (
                    <td key={m} className="px-3 py-1.5 text-right">
                      {miles(b.pastillasPorMed[m] ?? 0)}
                    </td>
                  ))}
                  <td className="px-5 py-1.5 text-right font-medium">{miles(b.pastillas)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Tarjeta>
        <div className="space-y-4">
          {r.metas.length > 0 && (
            <Tarjeta titulo={`Metas ${r.periodo.anio} (en lo que va del año)`} className="sin-cortar">
              <ul className="space-y-3 p-5">
                {r.metas.map((m) => {
                  const avance = m.valor === null ? 0 : m.mayorEsMejor ? Math.min(1, m.valor / (m.meta || 1)) : Math.min(1, (m.meta || 0.1) / Math.max(m.valor, 0.1));
                  return (
                    <li key={m.clave as ClaveIndicador} className="text-sm">
                      <div className="mb-1 flex justify-between">
                        <span>{m.nombre}</span>
                        <span className="tabular text-tenue">
                          <strong className="text-tinta">{formatoIndicador(m.tipo, m.valor)}</strong> de {formatoIndicador(m.tipo, m.meta)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
                        <div className="h-full rounded-full bg-marca-500" style={{ width: `${avance * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Tarjeta>
          )}
          {(fallecidos > 0 || otrasBajas.length > 0) && (
            <Tarjeta titulo={`Bajas del ${periodo}`} className="sin-cortar">
              <p className="p-5 text-sm leading-relaxed">
                {fallecidos > 0 && (
                  <>
                    Recordamos a <strong>{fallecidos}</strong> {fallecidos === 1 ? 'paciente que falleció' : 'pacientes que fallecieron'} en este {periodo}.{' '}
                  </>
                )}
                {otrasBajas.length > 0 && <>Otras bajas: {otrasBajas.map(([m, n]) => `${MOTIVOS_BAJA[m].toLowerCase()} (${n})`).join(', ')}.</>}
              </p>
            </Tarjeta>
          )}
        </div>
      </div>

      <footer className="pt-2 text-center text-xs text-tenue">
        Light a Candle · Dominican Republic — informe generado con HTA-Soft el {fecha(new Date().toISOString())}. Controlado = última toma por debajo de 140/90 mmHg.
      </footer>
    </article>
  );
}

/** Mensaje de la fundación para el trimestre: se edita aquí y se imprime como texto. */
function Mensaje({ r }: { r: ReporteDonantes }) {
  const cliente = useQueryClient();
  const [texto, setTexto] = useState(r.texto);
  const [editando, setEditando] = useState(false);
  useEffect(() => {
    setTexto(r.texto);
    setEditando(false);
  }, [r.texto, r.periodo.etiqueta]);
  const guardar = useMutation({
    mutationFn: () => guardarTextoDonantes(r.periodo.anio, r.periodo.trimestre, texto.trim()),
    onSuccess: () => {
      cliente.invalidateQueries({ queryKey: ['donantes', r.periodo.anio, r.periodo.trimestre] });
      setEditando(false);
      toast.success('Mensaje guardado');
    },
    onError: (e) => toast.error(e.message),
  });

  if (editando) {
    return (
      <div className="no-imprimir space-y-2 rounded-xl border border-borde bg-superficie p-4">
        <AreaTexto autoFocus rows={5} maxLength={4000} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Gracias a su apoyo… Este trimestre visitamos… Lo que viene…" />
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={() => (setTexto(r.texto), setEditando(false))}>
            Cancelar
          </Boton>
          <Boton icono={<Check className="size-4" />} cargando={guardar.isPending} onClick={() => guardar.mutate()}>
            Guardar mensaje
          </Boton>
        </div>
      </div>
    );
  }
  if (!r.texto) {
    return (
      <button onClick={() => setEditando(true)} className="no-imprimir flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-borde p-4 text-sm text-tenue hover:text-tinta">
        <Pencil className="size-4" /> Escribir el mensaje de la fundación para este {r.periodo.anual ? 'año' : 'trimestre'}
      </button>
    );
  }
  return (
    <section className="group sin-cortar relative rounded-xl border-l-4 border-marca-500 bg-superficie px-6 py-4">
      <p className="text-[15px] leading-relaxed whitespace-pre-line">{r.texto}</p>
      <button onClick={() => setEditando(true)} className="no-imprimir absolute top-3 right-3 rounded-md p-1.5 text-tenue opacity-0 group-hover:opacity-100 hover:bg-black/5" aria-label="Editar mensaje">
        <Pencil className="size-4" />
      </button>
    </section>
  );
}
