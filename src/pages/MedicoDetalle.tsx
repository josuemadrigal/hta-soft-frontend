import { Award, CalendarDays, GitCompareArrows, HeartPulse, Home, MapPin, TrendingDown, UserPlus, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useMedico } from '../api/consultas';
import { FiltroPeriodo, useFiltroPeriodo } from '../components/FiltroPeriodo';
import { Barras, COLOR, EJE, LEYENDA, REJILLA, TOOLTIP } from '../components/graficas';
import { Avatar, Boton, Cargando, EncabezadoPagina, ErrorCarga, Insignia, Tabla, Tarjeta, Vacio } from '../components/ui';
import { CATEGORIAS, colorCategoria } from '../lib/etiquetas';
import { cn, fecha } from '../lib/formato';

const miles = (n: number) => n.toLocaleString('es-DO');
const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v)}%`);

function Logro({ icono, valor, titulo, detalle, destacado }: { icono: ReactNode; valor: ReactNode; titulo: string; detalle?: string; destacado?: boolean }) {
  return (
    <div className={cn('rounded-xl border p-4', destacado ? 'border-marca-500 bg-marca-50' : 'border-borde bg-superficie')}>
      <div className="flex items-center gap-2 text-sm text-tenue">
        <span className={destacado ? 'text-marca-700' : 'text-tinta/40'}>{icono}</span>
        {titulo}
      </div>
      <p className="tabular mt-2 text-2xl font-semibold tracking-tight">{valor}</p>
      {detalle && <p className="mt-0.5 text-xs text-tenue">{detalle}</p>}
    </div>
  );
}

export function MedicoDetalle() {
  const id = Number(useParams().id);
  const filtro = useFiltroPeriodo();
  const consulta = useMedico(id, filtro);
  const navegar = useNavigate();
  const [params] = useSearchParams();

  if (consulta.isPending) return <Cargando texto="Calculando estadísticas…" />;
  if (consulta.isError) return <ErrorCarga error={consulta.error} />;
  const d = consulta.data;
  const r = d.resumen;
  const l = d.logros;
  const [nombre, ...apellido] = d.perfil.nombre.split(' ');

  return (
    <>
      <EncabezadoPagina
        titulo={d.perfil.nombre}
        volver={{ a: `/medicos?${params.toString()}`, texto: 'Médicos' }}
        descripcion={
          <span className="flex flex-wrap items-center gap-2">
            {d.perfil.rol ?? 'Médico'}
            {d.perfil.estado !== 'Activo' && <Insignia color={d.perfil.estado === 'Eliminado' ? '#dc2626' : undefined}>{d.perfil.estado === 'Eliminado' ? 'Cuenta eliminada' : 'Inactivo'}</Insignia>}
            {l.primera && (
              <span>
                · atendió del {fecha(l.primera)} al {fecha(l.ultima)}
              </span>
            )}
          </span>
        }
        acciones={
          <Boton variante="secundario" icono={<GitCompareArrows className="size-4" />} onClick={() => navegar(`/medicos/comparar?ids=${id}&${params.toString()}`)}>
            Comparar con otro
          </Boton>
        }
      />
      <div className="mb-4 flex items-center gap-4">
        <Avatar persona={{ firstName: nombre ?? '', lastName: apellido.join(' ') }} foto={d.perfil.photoUrl} tamano="size-14 text-lg" />
        {d.perfil.estado === 'Eliminado' && (
          <p className="max-w-xl text-sm text-tenue">
            Su cuenta fue eliminada: las visitas pasaron al administrador, pero cada una conserva que la atendió {d.perfil.nombre}. El detalle está en Auditoría.
          </p>
        )}
      </div>
      <FiltroPeriodo />

      {r.visitas === 0 ? (
        <Tarjeta>
          <Vacio icono={<CalendarDays className="size-8" />} titulo="Sin visitas en este periodo">
            Prueba con "Todo el historial".
          </Vacio>
        </Tarjeta>
      ) : (
        <div className={cn('space-y-4 transition-opacity', consulta.isPlaceholderData && 'opacity-60')}>
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold tracking-tight">
              <Award className="size-5 text-marca-700" /> Logros
            </h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Logro destacado icono={<HeartPulse className="size-4" />} titulo="Llevó a control" valor={miles(l.llevoAControl)} detalle="Pacientes que venían sin control y salieron controlados" />
              <Logro destacado icono={<TrendingDown className="size-4" />} titulo="Mejoraron" valor={miles(l.mejoraron)} detalle="Bajaron de categoría frente a su visita anterior" />
              <Logro icono={<Users className="size-4" />} titulo="Pacientes atendidos" valor={miles(r.pacientes)} detalle={`${miles(r.visitas)} visitas`} />
              <Logro icono={<CalendarDays className="size-4" />} titulo="Jornadas" valor={miles(l.jornadas)} detalle={`En ${l.bateyes} bateyes`} />
              <Logro icono={<HeartPulse className="size-4" />} titulo="Controlados" valor={pct(r.controladosPct)} detalle="Última toma con este médico < 140/90" />
              <Logro icono={<Award className="size-4" />} titulo="Cumplimiento" valor={pct(r.cumplimientoPromedio)} detalle="Promedio de sus recetas" />
              <Logro icono={<UserPlus className="size-4" />} titulo="Pacientes nuevos" valor={miles(l.nuevos)} detalle="Visitas de primera vez" />
              <Logro icono={<Home className="size-4" />} titulo="Domiciliarias" valor={miles(l.domiciliarias)} detalle={`${miles(r.pastillas)} pastillas entregadas`} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <Tarjeta titulo="Visitas y control por trimestre" copiable>
              <div className="h-72 px-2 pt-4 pb-2">
                <ResponsiveContainer>
                  <ComposedChart data={d.porTrimestre} margin={{ left: -8, right: 4 }}>
                    <CartesianGrid {...REJILLA} />
                    <XAxis dataKey="trimestre" {...EJE} />
                    <YAxis yAxisId="v" allowDecimals={false} {...EJE} />
                    <YAxis yAxisId="p" orientation="right" domain={[0, 100]} unit="%" {...EJE} />
                    <Tooltip {...TOOLTIP} formatter={(v, n) => (n === '% controlados' ? [`${v}%`, n] : [miles(Number(v)), n])} />
                    <Legend {...LEYENDA} />
                    <Bar yAxisId="v" dataKey="visitas" name="Visitas" fill={COLOR.amarillo} radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Line yAxisId="p" dataKey="controladosPct" name="% controlados" stroke={COLOR.tinta} strokeWidth={2.5} dot={{ r: 3.5, fill: COLOR.tinta }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Tarjeta>
            <Tarjeta titulo="Cómo terminaron sus pacientes" copiable accion={<span className="text-xs text-tenue">Última toma con este médico</span>}>
              <div className="p-5">
                <Barras
                  filas={d.categorias.map((c) => ({
                    etiqueta: CATEGORIAS[c.categoria],
                    valor: c.pacientes,
                    color: colorCategoria(c.categoria),
                    detalle: r.pacientes ? `${Math.round((c.pacientes / r.pacientes) * 100)}%` : undefined,
                  }))}
                  formato={miles}
                />
              </div>
            </Tarjeta>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Tarjeta titulo="Bateyes donde atendió" copiable>
              <div className="p-5">
                <Barras filas={d.porBatey.map((b) => ({ etiqueta: b.batey, valor: b.pacientes, detalle: `${pct(b.controladosPct)} ctrl.` }))} formato={miles} />
              </div>
            </Tarjeta>
            <Tarjeta titulo="Medicamentos que recetó" copiable accion={<span className="text-xs text-tenue">Cumplimiento promedio</span>}>
              <div className="p-5">
                {d.medicamentos.length === 0 ? (
                  <p className="text-sm text-tenue">Sin recetas en el periodo.</p>
                ) : (
                  <Barras
                    max={100}
                    formato={(v) => `${Math.round(v)}%`}
                    filas={d.medicamentos.map((m) => ({ etiqueta: m.medicamento, valor: m.cumplimientoPromedio ?? 0, detalle: `${miles(m.pacientes)} pac.` }))}
                  />
                )}
              </div>
            </Tarjeta>
          </div>

          <Tarjeta titulo="Jornadas recientes">
            <Tabla columnas={['Fecha', 'Batey', { texto: 'Pacientes', className: 'text-right' }, { texto: 'Controlados', className: 'text-right' }]}>
              {d.jornadas.map((j) => (
                <tr key={`${j.fecha}-${j.batey}`}>
                  <td className="px-5 py-2.5 whitespace-nowrap">{fecha(j.fecha)}</td>
                  <td className="px-5 py-2.5">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-tenue" />
                      {j.batey}
                    </span>
                  </td>
                  <td className="tabular px-5 py-2.5 text-right">{j.pacientes}</td>
                  <td className="tabular px-5 py-2.5 text-right">
                    {j.controlados} <span className="text-xs text-tenue">({Math.round((j.controlados / j.pacientes) * 100)}%)</span>
                  </td>
                </tr>
              ))}
            </Tabla>
          </Tarjeta>
        </div>
      )}
    </>
  );
}
