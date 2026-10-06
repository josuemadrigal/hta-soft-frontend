import { ArrowDown, ArrowUp, GitCompareArrows, Stethoscope } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useMedicos } from '../api/consultas';
import type { FilaMedico } from '../api/tipos';
import { FiltroPeriodo, useFiltroPeriodo } from '../components/FiltroPeriodo';
import { COLOR, EJE, LEYENDA, REJILLA, TOOLTIP } from '../components/graficas';
import { Avatar, Boton, Cargando, EncabezadoPagina, ErrorCarga, Insignia, Tarjeta, Vacio } from '../components/ui';
import { cn, fecha } from '../lib/formato';

const miles = (n: number) => n.toLocaleString('es-DO');
const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v)}%`);

type Columna = { clave: string; texto: string; valor: (m: FilaMedico) => number | null; mostrar: (m: FilaMedico) => string; ayuda?: string };

const COLUMNAS: Columna[] = [
  { clave: 'visitas', texto: 'Visitas', valor: (m) => m.visitas, mostrar: (m) => miles(m.visitas) },
  { clave: 'pacientes', texto: 'Pacientes', valor: (m) => m.pacientes, mostrar: (m) => miles(m.pacientes) },
  { clave: 'jornadas', texto: 'Jornadas', valor: (m) => m.logros.jornadas, mostrar: (m) => miles(m.logros.jornadas), ayuda: 'Días de trabajo en un batey' },
  { clave: 'control', texto: 'Controlados', valor: (m) => m.controladosPct, mostrar: (m) => pct(m.controladosPct), ayuda: 'Pacientes cuya última toma con este médico fue < 140/90' },
  { clave: 'aControl', texto: 'Llevó a control', valor: (m) => m.logros.llevoAControl, mostrar: (m) => miles(m.logros.llevoAControl), ayuda: 'Venían sin control y en su visita salieron controlados' },
  { clave: 'mejoraron', texto: 'Mejoraron', valor: (m) => m.logros.mejoraron, mostrar: (m) => miles(m.logros.mejoraron), ayuda: 'Bajaron de categoría respecto a la visita anterior' },
  { clave: 'cumplimiento', texto: 'Cumplimiento', valor: (m) => m.cumplimientoPromedio, mostrar: (m) => pct(m.cumplimientoPromedio) },
];

export function Medicos() {
  const filtro = useFiltroPeriodo();
  const [conEliminados, setConEliminados] = useState(false);
  const consulta = useMedicos(filtro, conEliminados);
  const navegar = useNavigate();
  const [orden, setOrden] = useState<{ clave: string; desc: boolean }>({ clave: 'visitas', desc: true });
  const [elegidos, setElegidos] = useState<number[]>([]);
  const [soloConVisitas, setSoloConVisitas] = useState(true);

  const lista = [...(consulta.data?.medicos ?? [])]
    .filter((m) => !soloConVisitas || m.visitas > 0)
    .sort((a, b) => {
      const col = COLUMNAS.find((c) => c.clave === orden.clave)!;
      const d = (col.valor(a) ?? -1) - (col.valor(b) ?? -1);
      return orden.desc ? -d : d;
    });
  const alternar = (id: number) => setElegidos((e) => (e.includes(id) ? e.filter((x) => x !== id) : e.length >= 4 ? e : [...e, id]));
  const grafica = lista.filter((m) => m.visitas > 0).slice(0, 12).map((m) => ({ nombre: m.nombre.split(' ').slice(0, 2).join(' '), visitas: m.visitas, controlados: m.controladosPct }));
  const consultaFiltro = `desde=${filtro.desde}&hasta=${filtro.hasta}${filtro.communityId ? `&batey=${filtro.communityId}` : ''}`;

  return (
    <>
      <EncabezadoPagina
        titulo="Médicos"
        descripcion="Lo que ha hecho cada médico en el periodo: visitas, pacientes, jornadas y resultados. Marca de 2 a 4 para compararlos."
        acciones={
          <Boton
            icono={<GitCompareArrows className="size-4" />}
            disabled={elegidos.length < 2}
            onClick={() => navegar(`/medicos/comparar?ids=${elegidos.join(',')}&${consultaFiltro}`)}
          >
            Comparar{elegidos.length ? ` (${elegidos.length})` : ''}
          </Boton>
        }
      />
      <FiltroPeriodo />

      {consulta.isPending ? (
        <Cargando texto="Calculando estadísticas…" />
      ) : consulta.isError ? (
        <ErrorCarga error={consulta.error} />
      ) : (
        <div className={cn('space-y-4 transition-opacity', consulta.isPlaceholderData && 'opacity-60')}>
          {grafica.length > 0 && (
            <Tarjeta titulo="Visitas y control por médico" copiable accion={<span className="text-xs text-tenue">Los 12 con más visitas</span>}>
              <div className="h-72 px-2 pt-4 pb-2">
                <ResponsiveContainer>
                  <ComposedChart data={grafica} margin={{ left: -8, right: 4, bottom: 8 }}>
                    <CartesianGrid {...REJILLA} />
                    <XAxis dataKey="nombre" {...EJE} interval={0} angle={-25} textAnchor="end" height={56} fontSize={11} />
                    <YAxis yAxisId="v" {...EJE} tickFormatter={miles} />
                    <YAxis yAxisId="p" orientation="right" domain={[0, 100]} unit="%" {...EJE} />
                    <Tooltip {...TOOLTIP} formatter={(v, n) => (n === '% controlados' ? [`${v}%`, n] : [miles(Number(v)), n])} />
                    <Legend {...LEYENDA} />
                    <Bar yAxisId="v" dataKey="visitas" name="Visitas" fill={COLOR.amarillo} radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Line yAxisId="p" dataKey="controlados" name="% controlados" stroke={COLOR.tinta} strokeWidth={0} dot={{ r: 5, fill: COLOR.tinta }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Tarjeta>
          )}

          <Tarjeta
            titulo={`${lista.length} médicos`}
            accion={
              <div className="flex flex-wrap items-center gap-4 text-xs text-tenue">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={soloConVisitas} onChange={(e) => setSoloConVisitas(e.target.checked)} className="accent-tinta" />
                  Solo con visitas en el periodo
                </label>
                <label className="flex items-center gap-2" title="Su historial se conserva en las visitas y en Auditoría">
                  <input type="checkbox" checked={conEliminados} onChange={(e) => setConEliminados(e.target.checked)} className="accent-tinta" />
                  Incluir cuentas eliminadas
                </label>
              </div>
            }
          >
            {lista.length === 0 ? (
              <Vacio icono={<Stethoscope className="size-8" />} titulo="Nadie atendió en este periodo" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-borde text-left text-xs tracking-wide text-tenue uppercase">
                      <th className="w-10 px-4 py-2.5" aria-label="Comparar" />
                      <th className="px-3 py-2.5 font-medium">Médico</th>
                      {COLUMNAS.map((c) => (
                        <th key={c.clave} className="px-3 py-2.5 text-right font-medium whitespace-nowrap" title={c.ayuda}>
                          <button
                            className="inline-flex items-center gap-1 uppercase hover:text-tinta"
                            onClick={() => setOrden((o) => ({ clave: c.clave, desc: o.clave === c.clave ? !o.desc : true }))}
                          >
                            {c.texto}
                            {orden.clave === c.clave && (orden.desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
                          </button>
                        </th>
                      ))}
                      <th className="px-3 py-2.5 font-medium whitespace-nowrap">Última visita</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borde">
                    {lista.map((m) => (
                      <tr key={m.id} onClick={() => navegar(`/medicos/${m.id}?${consultaFiltro}`)} className={cn('cursor-pointer hover:bg-fondo', elegidos.includes(m.id) && 'bg-marca-50')}>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={elegidos.includes(m.id)}
                            disabled={!elegidos.includes(m.id) && elegidos.length >= 4}
                            onChange={() => alternar(m.id)}
                            className="size-4 accent-tinta"
                            aria-label={`Comparar a ${m.nombre}`}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar persona={{ firstName: m.nombre.split(' ')[0] ?? '', lastName: m.nombre.split(' ')[1] ?? '' }} foto={m.photoUrl} tamano="size-8" />
                            <div>
                              <p className="font-medium whitespace-nowrap">{m.nombre}</p>
                              <p className="text-xs text-tenue">
                                {m.estado === 'Activo' ? m.rol : <Insignia color={m.estado === 'Eliminado' ? '#dc2626' : undefined}>{m.estado === 'Eliminado' ? 'Cuenta eliminada' : 'Inactivo'}</Insignia>}
                              </p>
                            </div>
                          </div>
                        </td>
                        {COLUMNAS.map((c) => (
                          <td key={c.clave} className="tabular px-3 py-3 text-right">
                            {c.mostrar(m)}
                          </td>
                        ))}
                        <td className="px-3 py-3 whitespace-nowrap text-tenue">{fecha(m.logros.ultima)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Tarjeta>
        </div>
      )}
    </>
  );
}
