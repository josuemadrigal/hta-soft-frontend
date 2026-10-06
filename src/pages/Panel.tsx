import { AlertTriangle, ArrowRight, CalendarCheck, CalendarPlus, Tent, HeartPulse, SearchX, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { MiPanelVista } from '../components/MiPanel';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAlertasInventario, useComunidades, useEstadisticasPanel, useJornadas, useRonda, useTendencia } from '../api/consultas';
import { useSesion } from '../auth/sesion';
import { COLOR, EJE, REJILLA, TOOLTIP, LEYENDA } from '../components/graficas';
import { Cargando, EncabezadoPagina, ErrorCarga, Insignia, Selector, Tarjeta, Vacio } from '../components/ui';
import { CATEGORIAS, colorCategoria } from '../lib/etiquetas';
import { cn, fecha, nombreCompleto } from '../lib/formato';
import { diaJornada, hoyYmd } from './Jornadas';
import { asistencia } from '../lib/asistencia';

const miles = (n: number) => n.toLocaleString('es-DO');
const ORDEN = ['NORMAL', 'ELEVATED', 'GRADE_1', 'GRADE_2', 'CRISIS'] as const;

function Indicador({
  titulo,
  valor,
  detalle,
  icono,
  progreso,
  a,
  tono,
}: {
  titulo: string;
  valor: ReactNode;
  detalle: ReactNode;
  icono: ReactNode;
  progreso?: number;
  a?: string;
  tono?: 'alerta';
}) {
  const cuerpo = (
    <>
      <div className="flex items-center justify-between text-sm text-tenue">
        {titulo}
        <span className={tono === 'alerta' ? 'text-red-600' : 'text-tinta/40'}>{icono}</span>
      </div>
      <p className="tabular mt-2 text-3xl font-semibold tracking-tight">{valor}</p>
      {progreso !== undefined && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
          <div className="h-full rounded-full bg-marca-500" style={{ width: `${Math.min(100, progreso)}%` }} />
        </div>
      )}
      <p className="mt-2 text-xs leading-snug text-tenue">{detalle}</p>
    </>
  );
  const clase = 'block rounded-xl border border-borde bg-superficie p-5';
  return a ? (
    <Link to={a} className={`${clase} transition-colors hover:border-tinta/30`}>
      {cuerpo}
    </Link>
  ) : (
    <div className={clase}>{cuerpo}</div>
  );
}


/** Panel: vista general (filtrable por batey) o "Mi panel" del médico. Ambas en la URL. */
export function Panel() {
  const { usuario, tiene } = useSesion();
  const [params, setParams] = useSearchParams();
  const comunidades = useComunidades();
  const puedeMio = tiene('visitas.registrar');
  // Quien registra visitas pero no ve reportes (médico, enfermería) entra a su propio panel.
  const porDefecto = puedeMio && !tiene('reportes.ver') ? 'mio' : 'general';
  const vista = puedeMio ? (params.get('vista') ?? porDefecto) : 'general';
  const batey = Number(params.get('batey')) || undefined;
  const cambiar = (c: Record<string, string | undefined>) =>
    setParams(
      (p) => {
        for (const [k, v] of Object.entries(c)) (v ? p.set(k, v) : p.delete(k));
        return p;
      },
      { replace: true },
    );

  return (
    <>
      <EncabezadoPagina
        titulo={`Hola, ${usuario?.firstName ?? ''}`}
        descripcion={new Intl.DateTimeFormat('es-DO', { dateStyle: 'full' }).format(new Date())}
        acciones={
          <>
            {vista === 'general' && (
              <Selector
                aria-label="Batey"
                className="w-56"
                vacio="Todos los bateyes"
                value={batey ?? ''}
                onChange={(e) => cambiar({ batey: e.target.value || undefined })}
                opciones={(comunidades.data ?? []).filter((c) => c.isActive).map((c) => ({ value: c.id, label: c.name }))}
              />
            )}
            {puedeMio && (
              <div className="flex rounded-lg border border-borde bg-superficie p-0.5 text-sm" role="tablist">
                {(
                  [
                    ['mio', 'Mi panel'],
                    ['general', 'General'],
                  ] as const
                ).map(([v, texto]) => (
                  <button
                    key={v}
                    role="tab"
                    aria-selected={vista === v}
                    onClick={() => cambiar({ vista: v === porDefecto ? undefined : v })}
                    className={cn('rounded-md px-3 py-1.5', vista === v ? 'bg-marca-500 font-medium' : 'text-tenue hover:text-tinta')}
                  >
                    {texto}
                  </button>
                ))}
              </div>
            )}
          </>
        }
      />
      {vista === 'mio' ? <MiPanelVista /> : <PanelGeneral batey={batey} nombreBatey={comunidades.data?.find((c) => c.id === batey)?.name} />}
    </>
  );
}

/** Un pendiente de "Para hacer": una línea con ícono, texto y a dónde lleva. */
type Pendiente = { icono: ReactNode; texto: ReactNode; a: string; tono?: 'aviso' | 'normal' };

/** Encabezado de sección: título y una línea de contexto. */
function Seccion({ titulo, detalle, children }: { titulo: string; detalle?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 className="text-lg font-semibold tracking-tight">{titulo}</h2>
        {detalle && <p className="text-sm text-tenue">{detalle}</p>}
      </div>
      {children}
    </section>
  );
}

function PanelGeneral({ batey, nombreBatey: nombreDelBatey }: { batey?: number; nombreBatey?: string }) {
  const { tiene } = useSesion();
  const stats = useEstadisticasPanel(batey);
  const alertas = useAlertasInventario();
  const proximas = useJornadas({ desde: hoyYmd(), estado: 'PLANIFICADA', communityId: batey });
  const ronda = useRonda(batey);
  const tendencia = useTendencia(batey);
  const comunidades = useComunidades();

  if (stats.isPending || ronda.isPending) return <Cargando />;
  if (stats.isError) return <ErrorCarga error={stats.error} />;
  if (ronda.isError) return <ErrorCarga error={ronda.error} />;
  const s = stats.data;
  const r = ronda.data;
  const t = r.totals;
  const nombreBatey = (id: number) => comunidades.data?.find((c) => c.id === id)?.name ?? '';
  const finRonda = new Date(r.round.end);
  const diasParaCerrar = Math.max(0, Math.ceil((finRonda.getTime() - Date.now()) / 86_400_000));

  // En seguimiento = vinieron en los últimos 6 meses. La ronda se mide contra ellos.
  const enSeguimiento = t.seen + t.pending;
  const pctRonda = enSeguimiento ? Math.round((t.seen / enSeguimiento) * 100) : 0;

  // Tendencia del control
  const trimestres = tendencia.data?.trimestres ?? [];
  const ultimoConDatos = [...trimestres].reverse().find((q) => q.controladosPct !== null);
  const anterior = ultimoConDatos ? trimestres[trimestres.indexOf(ultimoConDatos) - 1] : undefined;
  const cambio = ultimoConDatos && anterior?.controladosPct != null ? Math.round(ultimoConDatos.controladosPct! - anterior.controladosPct) : null;

  // Clasificación de la última toma de los pacientes en seguimiento
  const hoy = tendencia.data?.hoy ?? [];
  const totalHoy = hoy.reduce((a, h) => a + h.pacientes, 0);
  const rebanadas = [
    ...ORDEN.map((c) => {
      const h = hoy.find((x) => x.categoria === c);
      return { nombre: CATEGORIAS[c], valor: h?.pacientes ?? 0, color: colorCategoria(c), configId: h?.configId ?? null };
    }),
    { nombre: 'Sin toma válida', valor: hoy.find((x) => x.categoria === null)?.pacientes ?? 0, color: COLOR.gris, configId: null as number | null },
  ].filter((x) => x.valor > 0);
  const altoRiesgo = rebanadas.filter((x) => x.nombre === CATEGORIAS.GRADE_2 || x.nombre === CATEGORIAS.CRISIS).reduce((a, x) => a + x.valor, 0);

  // Para hacer
  const conJornada = new Set((proximas.data ?? []).map((j) => j.communityId));
  const sinJornada = r.byCommunity.filter((c) => !conJornada.has(c.communityId) && c.pending > 0).sort((a, b) => b.pending - a.pending);
  const pendientes: Pendiente[] = [];
  const proxima = proximas.data?.[0];
  if (proxima) {
    const esHoy = proxima.fecha.slice(0, 10) === hoyYmd();
    pendientes.push({
      icono: <Tent className="size-4" />,
      texto: (
        <>
          {esHoy ? 'Hoy hay jornada en ' : 'Próxima jornada: '}
          <strong>{proxima.community.name}</strong>
          {!esHoy && `, ${diaJornada(proxima.fecha, true).toLowerCase()}`}. Revisa qué llevar.
        </>
      ),
      a: `/jornadas/${proxima.id}`,
    });
  }
  if (sinJornada.length && tiene('jornadas.planificar')) {
    pendientes.push({
      icono: <CalendarPlus className="size-4" />,
      texto: (
        <>
          <strong>{sinJornada.length === 1 ? '1 batey' : `${sinJornada.length} bateyes`}</strong> sin jornada planificada esta ronda; el de más pendientes es{' '}
          <strong>{sinJornada[0].name}</strong> ({miles(sinJornada[0].pending)}).
        </>
      ),
      a: `/jornadas/nueva?batey=${sinJornada[0].communityId}`,
    });
  }
  if (r.priority.total) {
    pendientes.push({
      icono: <HeartPulse className="size-4" />,
      texto: (
        <>
          <strong>{miles(r.priority.total)} pacientes en crisis o grado 2</strong> aún no vistos esta ronda: atiéndelos primero.
        </>
      ),
      a: '#prioridad',
      tono: 'aviso',
    });
  }
  const inv = alertas.data;
  const inventario = [
    inv?.vencidos.length && `${inv.vencidos.length} ${inv.vencidos.length === 1 ? 'lote vencido' : 'lotes vencidos'}`,
    inv?.porVencer.length && `${inv.porVencer.length} por vencer`,
    s.lowStockMedications.length && `${s.lowStockMedications.map((m) => `${m.name} ${m.concentration}`).join(', ')} bajo el mínimo`,
  ].filter(Boolean);
  if (inventario.length) pendientes.push({ icono: <AlertTriangle className="size-4" />, texto: <>Inventario: {inventario.join(' · ')}.</>, a: '/medicamentos', tono: 'aviso' });

  return (
    <>
      {batey && (
        <p className="mb-4 rounded-lg bg-marca-50 px-4 py-2.5 text-sm">
          Mostrando solo <strong>{nombreDelBatey}</strong>. El inventario es el de toda la fundación.
        </p>
      )}

      {/* 1 · Para hacer */}
      {pendientes.length > 0 && (
        <Tarjeta titulo="Para hacer" className="mb-6">
          <ul className="divide-y divide-borde">
            {pendientes.map((p, i) => {
              const contenido = (
                <>
                  <span className={cn('grid size-8 shrink-0 place-items-center rounded-full', p.tono === 'aviso' ? 'bg-amber-100 text-amber-800' : 'bg-marca-100 text-tinta')}>{p.icono}</span>
                  <span className="flex-1 text-sm">{p.texto}</span>
                  <ArrowRight className="size-4 shrink-0 text-tenue" />
                </>
              );
              const clase = 'flex items-center gap-3 px-5 py-3 hover:bg-fondo';
              return (
                <li key={i}>
                  {p.a.startsWith('#') ? (
                    <a href={p.a} className={clase}>
                      {contenido}
                    </a>
                  ) : (
                    <Link to={p.a} className={clase}>
                      {contenido}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </Tarjeta>
      )}

      {/* 2 · Cifras */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          titulo="En seguimiento"
          valor={miles(enSeguimiento)}
          detalle={`Vinieron en los últimos 6 meses · ${miles(t.active)} registrados`}
          icono={<Users className="size-4" />}
          a="/pacientes?situacion=le-toca"
        />
        <Indicador
          titulo={`Ronda ${r.round.label}`}
          valor={`${pctRonda}%`}
          progreso={pctRonda}
          detalle={`${miles(t.seen)} de ${miles(enSeguimiento)} vistos · cierra en ${diasParaCerrar} días`}
          icono={<CalendarCheck className="size-4" />}
          a="/jornadas"
        />
        <Indicador
          titulo="Presión controlada"
          valor={`${Math.round(s.bpControl.controlledPercentage)}%`}
          progreso={s.bpControl.controlledPercentage}
          detalle={
            <>
              Última toma por debajo de 140/90
              {cambio !== null && (
                <span className={cn('ml-1 font-medium', cambio >= 0 ? 'text-green-700' : 'text-red-600')}>
                  · {cambio >= 0 ? '+' : ''}
                  {cambio} pts vs. trimestre anterior
                </span>
              )}
            </>
          }
          icono={<HeartPulse className="size-4" />}
        />
        <Indicador
          titulo="Dejaron de venir"
          valor={miles(t.absent)}
          detalle={`Más de 6 meses sin venir · ${miles(t.absentYear)} hace más de un año`}
          icono={<SearchX className="size-4" />}
          a="/pacientes?situacion=sin-venir&orden=ausencia"
        />
      </div>

      {/* 3 · Salud de los pacientes */}
      <Seccion
        titulo="Salud de los pacientes"
        detalle={
          ultimoConDatos
            ? `En ${ultimoConDatos.trimestre}, el ${Math.round(ultimoConDatos.controladosPct!)}% salió controlado · hoy ${miles(altoRiesgo)} están en grado 2 o crisis`
            : undefined
        }
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Tarjeta titulo="Control de la presión por trimestre" copiable accion={<span className="text-xs text-tenue">Últimos 8 trimestres</span>}>
            {tendencia.isPending ? (
              <Cargando />
            ) : (
              <div className="h-72 px-2 pt-4 pb-2">
                <ResponsiveContainer>
                  <ComposedChart data={trimestres} margin={{ left: -8, right: 4 }}>
                    <CartesianGrid {...REJILLA} />
                    <XAxis dataKey="trimestre" {...EJE} />
                    <YAxis yAxisId="n" allowDecimals={false} {...EJE} />
                    <YAxis yAxisId="p" orientation="right" domain={[0, 100]} unit="%" {...EJE} />
                    <Tooltip {...TOOLTIP} formatter={(v, n) => (n === '% controlados' ? [`${v}%`, n] : [miles(Number(v)), n])} />
                    <Legend {...LEYENDA} />
                    <Bar yAxisId="n" dataKey="pacientes" name="Pacientes vistos" fill={COLOR.amarillo} radius={[4, 4, 0, 0]} maxBarSize={44} />
                    <Line yAxisId="p" dataKey="controladosPct" name="% controlados" stroke={COLOR.tinta} strokeWidth={2.5} dot={{ r: 4, fill: COLOR.tinta }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </Tarjeta>

          <Tarjeta titulo="Cómo están hoy" copiable accion={<span className="text-xs text-tenue">Última toma · en seguimiento</span>}>
            {tendencia.isPending ? (
              <Cargando />
            ) : totalHoy === 0 ? (
              <Vacio titulo="Sin datos" />
            ) : (
              <ul className="space-y-1 p-4">
                {rebanadas.map((x) => {
                  const fila = (
                    <>
                      <span className="w-36 shrink-0">{x.nombre}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
                        <span className="block h-full rounded-full" style={{ width: `${(x.valor / totalHoy) * 100}%`, backgroundColor: x.color }} />
                      </span>
                      <span className="tabular w-12 text-right font-medium">{miles(x.valor)}</span>
                      <span className="tabular w-10 text-right text-xs text-tenue">{Math.round((x.valor / totalHoy) * 100)}%</span>
                    </>
                  );
                  const filtro = x.configId ? `clasificacion=${x.configId}` : 'clasificacion=ninguna';
                  return (
                    <li key={x.nombre}>
                      {tiene('pacientes.ver') ? (
                        <Link to={`/pacientes?${filtro}&orden=presion`} className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-fondo" title="Ver estos pacientes">
                          {fila}
                        </Link>
                      ) : (
                        <div className="flex items-center gap-3 px-2 py-2 text-sm">{fila}</div>
                      )}
                    </li>
                  );
                })}
                <li className="px-2 pt-2 text-xs text-tenue">{miles(totalHoy)} pacientes que vinieron en los últimos 6 meses.</li>
              </ul>
            )}
          </Tarjeta>
        </div>
      </Seccion>

      {/* 4 · Esta ronda */}
      <Seccion titulo="Esta ronda" detalle={`Del ${fecha(r.round.start)} al ${fecha(r.round.end)}`}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Tarjeta
            titulo="Agenda de jornadas"
            accion={
              <Link to="/jornadas" className="flex items-center gap-1 text-xs font-medium text-marca-700 hover:underline">
                Calendario <ArrowRight className="size-3" />
              </Link>
            }
          >
            {(proximas.data ?? []).length > 0 && (
              <ul className="divide-y divide-borde border-b border-borde">
                {proximas.data!.slice(0, 4).map((j) => {
                  const pendientesBatey = r.byCommunity.find((c) => c.communityId === j.communityId)?.pending ?? 0;
                  return (
                    <li key={j.id}>
                      <Link to={`/jornadas/${j.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-fondo">
                        <span className="w-24 shrink-0 text-sm font-medium">{diaJornada(j.fecha)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{j.community.name}</span>
                          <span className="block truncate text-xs text-tenue">{j.responsable ? `Responsable: ${nombreCompleto(j.responsable)}` : 'Sin responsable'}</span>
                        </span>
                        <span className="shrink-0 text-right text-xs text-tenue">
                          <span className="tabular block text-base font-semibold text-tinta">{miles(pendientesBatey)}</span>
                          pendientes
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            {sinJornada.length > 0 ? (
              <div className="px-5 py-3">
                <p className="mb-2 text-xs font-medium text-tenue">Sin jornada planificada</p>
                <ul className="space-y-2">
                  {sinJornada.slice(0, (proximas.data ?? []).length ? 4 : 7).map((c) => (
                    <li key={c.communityId} className="flex items-center gap-3 text-sm">
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      <span className="tabular text-xs text-tenue">
                        {miles(c.pending)} pendientes · última visita {fecha(c.lastVisit)}
                      </span>
                      {tiene('jornadas.planificar') && (
                        <Link to={`/jornadas/nueva?batey=${c.communityId}`} className="rounded-md border border-borde px-2 py-1 text-xs font-medium hover:bg-fondo">
                          Planificar
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              !(proximas.data ?? []).length && <Vacio titulo="Nada pendiente de planificar" />
            )}
          </Tarjeta>

          <div id="prioridad" className="scroll-mt-6">
            <Tarjeta
              titulo={`Prioridad para la próxima jornada (${miles(r.priority.total)})`}
              accion={<span className="text-xs text-tenue">Última toma en grado 2 o crisis · aún no vistos esta ronda</span>}
            >
              {r.priority.lista.length === 0 ? (
                <Vacio titulo="Nadie en grado 2 o crisis pendiente de venir" />
              ) : (
                <ul className="divide-y divide-borde">
                  {r.priority.lista.map((p) => (
                    <li key={p.id}>
                      <Link to={`/pacientes/${p.id}`} className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-fondo">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{nombreCompleto(p)}</span>
                          <span className="block truncate text-xs text-tenue">
                            <span className="font-mono">{p.patientCode}</span> · {nombreBatey(p.communityId)}
                            {p.address && ` · Casa ${p.address}`} · vino el {fecha(p.lastVisitDate)}
                          </span>
                        </span>
                        <span className="tabular font-mono">{p.presion}</span>
                        <Insignia color={colorCategoria(p.categoria)}>{CATEGORIAS[p.categoria]}</Insignia>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Tarjeta>
          </div>
        </div>
      </Seccion>

      {/* 5 · Dejaron de venir */}
      <Seccion titulo="Dejaron de venir" detalle="Primero los que faltan desde hace menos: son los más fáciles de recuperar">
        <Tarjeta
          titulo={`${miles(t.absent)} pacientes con más de 6 meses sin venir`}
          accion={
            <Link to="/pacientes?situacion=sin-venir&orden=ausencia" className="flex items-center gap-1 text-xs font-medium text-marca-700 hover:underline">
              Ver todos <ArrowRight className="size-3" />
            </Link>
          }
        >
          {r.absentPatients.length === 0 ? (
            <Vacio titulo="Todos han venido en los últimos 6 meses" />
          ) : (
            <ul className="grid md:grid-cols-2">
              {r.absentPatients.slice(0, 8).map((p) => (
                <li key={p.id} className="border-b border-borde md:odd:border-r">
                  <Link to={`/pacientes/${p.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-fondo">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{nombreCompleto(p)}</p>
                      <p className="truncate text-xs text-tenue">
                        <span className="font-mono">{p.patientCode}</span> · {nombreBatey(p.communityId)}
                        {p.address && ` · Casa ${p.address}`}
                        {p.phoneNumber && ` · ${p.phoneNumber}`}
                      </p>
                    </div>
                    <span className="shrink-0 text-right text-xs text-tenue">{asistencia(p.lastVisitDate).texto}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </Seccion>
    </>
  );
}
