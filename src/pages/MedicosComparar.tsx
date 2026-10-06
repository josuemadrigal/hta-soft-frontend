import { Crown, Plus, X } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useComparacion, useMedicos } from '../api/consultas';
import type { ComparacionMedicos } from '../api/tipos';
import { FiltroPeriodo, useFiltroPeriodo } from '../components/FiltroPeriodo';
import { EJE, LEYENDA, REJILLA, TOOLTIP } from '../components/graficas';
import { Cargando, EncabezadoPagina, ErrorCarga, Selector, Tarjeta, Vacio } from '../components/ui';
import { CATEGORIAS, colorCategoria } from '../lib/etiquetas';
import { cn } from '../lib/formato';

/** Un color por médico (el amarillo de marca no se usa en líneas: no se lee sobre blanco). */
const COLORES = ['#1d1b18', '#d97706', '#2563eb', '#db2777'];
const miles = (n: number) => n.toLocaleString('es-DO');
const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v)}%`);

type Medico = ComparacionMedicos['medicos'][number];
const FILAS: { texto: string; valor: (m: Medico) => number | null; mostrar: (m: Medico) => string; menorEsMejor?: boolean }[] = [
  { texto: 'Visitas', valor: (m) => m.visitas, mostrar: (m) => miles(m.visitas) },
  { texto: 'Pacientes atendidos', valor: (m) => m.pacientes, mostrar: (m) => miles(m.pacientes) },
  { texto: 'Jornadas', valor: (m) => m.logros.jornadas, mostrar: (m) => miles(m.logros.jornadas) },
  { texto: 'Bateyes', valor: (m) => m.logros.bateyes, mostrar: (m) => miles(m.logros.bateyes) },
  { texto: 'Pacientes controlados', valor: (m) => m.controladosPct, mostrar: (m) => pct(m.controladosPct) },
  { texto: 'Llevó a control', valor: (m) => m.logros.llevoAControl, mostrar: (m) => miles(m.logros.llevoAControl) },
  { texto: 'Mejoraron de categoría', valor: (m) => m.logros.mejoraron, mostrar: (m) => miles(m.logros.mejoraron) },
  { texto: 'PA sistólica promedio', valor: (m) => m.sistolicaPromedio, mostrar: (m) => (m.sistolicaPromedio ? `${Math.round(m.sistolicaPromedio)}/${Math.round(m.diastolicaPromedio ?? 0)}` : '—'), menorEsMejor: true },
  { texto: 'Cumplimiento promedio', valor: (m) => m.cumplimientoPromedio, mostrar: (m) => pct(m.cumplimientoPromedio) },
  { texto: 'Pacientes nuevos', valor: (m) => m.logros.nuevos, mostrar: (m) => miles(m.logros.nuevos) },
  { texto: 'Domiciliarias', valor: (m) => m.logros.domiciliarias, mostrar: (m) => miles(m.logros.domiciliarias) },
];

export function MedicosComparar() {
  const [params, setParams] = useSearchParams();
  const ids = (params.get('ids') ?? '')
    .split(',')
    .map(Number)
    .filter((n) => n > 0);
  const filtro = useFiltroPeriodo();
  const todos = useMedicos(filtro);
  const consulta = useComparacion(ids, filtro);
  const cambiarIds = (nuevos: number[]) =>
    setParams(
      (p) => {
        p.set('ids', nuevos.join(','));
        return p;
      },
      { replace: true },
    );

  const medicos = consulta.data?.medicos ?? [];
  // Todos los trimestres que aparezcan en alguno, una columna por médico.
  const trimestres = [...new Map(medicos.flatMap((m) => m.porTrimestre.map((t) => [t.clave, t.trimestre] as const))).entries()].sort(([a], [b]) => a.localeCompare(b));
  const serie = (campo: 'controladosPct' | 'visitas') =>
    trimestres.map(([clave, trimestre]) => ({
      trimestre,
      ...Object.fromEntries(medicos.map((m) => [m.nombre, m.porTrimestre.find((t) => t.clave === clave)?.[campo] ?? null])),
    }));
  const disponibles = (todos.data?.medicos ?? []).filter((m) => m.visitas > 0 && !ids.includes(m.id));

  return (
    <>
      <EncabezadoPagina titulo="Comparar médicos" descripcion="Mismo periodo y batey para todos. La corona marca el mejor valor de cada fila." volver={{ a: `/medicos?${new URLSearchParams([...params].filter(([k]) => k !== 'ids')).toString()}`, texto: 'Médicos' }} />
      <FiltroPeriodo />

      <Tarjeta className="mb-4">
        <div className="flex flex-wrap items-center gap-2 p-4">
          {ids.map((id, i) => {
            const m = medicos.find((x) => x.id === id) ?? todos.data?.medicos.find((x) => x.id === id);
            return (
              <span key={id} className="flex items-center gap-2 rounded-full border border-borde py-1 pr-1 pl-3 text-sm">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: COLORES[i] }} />
                {m?.nombre ?? `#${id}`}
                <button onClick={() => cambiarIds(ids.filter((x) => x !== id))} className="rounded-full p-1 text-tenue hover:bg-black/5 hover:text-tinta" aria-label="Quitar">
                  <X className="size-3.5" />
                </button>
              </span>
            );
          })}
          {ids.length < 4 && (
            <label className="flex items-center gap-2 text-sm text-tenue">
              <Plus className="size-4" />
              <Selector
                className="w-auto min-w-56"
                vacio="Agregar médico…"
                value=""
                onChange={(e) => e.target.value && cambiarIds([...ids, Number(e.target.value)])}
                opciones={disponibles.map((m) => ({ value: m.id, label: `${m.nombre} (${miles(m.visitas)} visitas)` }))}
              />
            </label>
          )}
        </div>
      </Tarjeta>

      {ids.length < 2 ? (
        <Tarjeta>
          <Vacio titulo="Elige al menos dos médicos">Agrégalos con el selector de arriba.</Vacio>
        </Tarjeta>
      ) : consulta.isPending ? (
        <Cargando texto="Comparando…" />
      ) : consulta.isError ? (
        <ErrorCarga error={consulta.error} />
      ) : (
        <div className={cn('space-y-4 transition-opacity', consulta.isPlaceholderData && 'opacity-60')}>
          <Tarjeta titulo="Resumen" copiable>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-borde">
                    <th className="px-5 py-3 text-left text-xs font-medium tracking-wide text-tenue uppercase">Indicador</th>
                    {medicos.map((m, i) => (
                      <th key={m.id} className="px-5 py-3 text-right font-semibold whitespace-nowrap">
                        <span className="inline-flex items-center gap-2">
                          <span className="size-2.5 rounded-full" style={{ backgroundColor: COLORES[i] }} />
                          {m.nombre}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-borde">
                  {FILAS.map((f) => {
                    const valores = medicos.map((m) => f.valor(m)).filter((v): v is number => v !== null);
                    const mejor = valores.length > 1 ? (f.menorEsMejor ? Math.min(...valores) : Math.max(...valores)) : null;
                    return (
                      <tr key={f.texto}>
                        <td className="px-5 py-2.5 text-tenue">{f.texto}</td>
                        {medicos.map((m) => {
                          const gana = mejor !== null && f.valor(m) === mejor;
                          return (
                            <td key={m.id} className={cn('tabular px-5 py-2.5 text-right', gana && 'bg-marca-50 font-semibold')}>
                              {gana && <Crown className="mr-1.5 inline size-3.5 text-marca-700" />}
                              {f.mostrar(m)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Tarjeta>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Tarjeta titulo="% de pacientes controlados por trimestre" copiable>
              <div className="h-72 px-2 pt-4 pb-2">
                <ResponsiveContainer>
                  <LineChart data={serie('controladosPct')} margin={{ left: -16, right: 12 }}>
                    <CartesianGrid {...REJILLA} />
                    <XAxis dataKey="trimestre" {...EJE} />
                    <YAxis domain={[0, 100]} unit="%" {...EJE} />
                    <Tooltip {...TOOLTIP} formatter={(v) => (v === null ? '—' : `${v}%`)} />
                    <Legend {...LEYENDA} />
                    {medicos.map((m, i) => (
                      <Line key={m.id} dataKey={m.nombre} stroke={COLORES[i]} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Tarjeta>
            <Tarjeta titulo="Visitas por trimestre" copiable>
              <div className="h-72 px-2 pt-4 pb-2">
                <ResponsiveContainer>
                  <BarChart data={serie('visitas')} margin={{ left: -16, right: 12 }}>
                    <CartesianGrid {...REJILLA} />
                    <XAxis dataKey="trimestre" {...EJE} />
                    <YAxis allowDecimals={false} {...EJE} />
                    <Tooltip {...TOOLTIP} />
                    <Legend {...LEYENDA} />
                    {medicos.map((m, i) => (
                      <Bar key={m.id} dataKey={m.nombre} fill={COLORES[i]} radius={[3, 3, 0, 0]} maxBarSize={22} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Tarjeta>
          </div>

          <Tarjeta titulo="Cómo terminaron sus pacientes" copiable accion={<span className="text-xs text-tenue">% según la última toma con cada médico</span>}>
            <div className="space-y-3 p-5">
              {medicos.map((m) => {
                const total = m.categorias.reduce((a, c) => a + c.pacientes, 0);
                return (
                  <div key={m.id} className="grid grid-cols-[10rem_1fr] items-center gap-3 text-sm">
                    <span className="truncate font-medium">{m.nombre}</span>
                    <div className="flex h-5 overflow-hidden rounded-md">
                      {m.categorias
                        .filter((c) => c.pacientes > 0)
                        .map((c) => (
                          <span
                            key={c.categoria}
                            title={`${CATEGORIAS[c.categoria]}: ${c.pacientes} (${Math.round((c.pacientes / total) * 100)}%)`}
                            style={{ width: `${(c.pacientes / total) * 100}%`, backgroundColor: colorCategoria(c.categoria) }}
                          />
                        ))}
                    </div>
                  </div>
                );
              })}
              <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-xs text-tenue">
                {(['NORMAL', 'ELEVATED', 'GRADE_1', 'GRADE_2', 'CRISIS'] as const).map((c) => (
                  <span key={c} className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm" style={{ backgroundColor: colorCategoria(c) }} />
                    {CATEGORIAS[c]}
                  </span>
                ))}
              </div>
            </div>
          </Tarjeta>
        </div>
      )}
    </>
  );
}
