import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, ClipboardList, Download, FileSpreadsheet, HeartHandshake, PieChart, Pill, Users, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { descargar } from '../api/client';
import { useComunidades, usePlanilla, useResumenReporte, useRonda } from '../api/consultas';
import { enlaceCifra, TablaPlanilla } from '../components/TablaPlanilla';
import { RondaPorBatey } from '../components/RondaPorBatey';
import type { CategoriaPA, FiltroReporte, Genero, ResumenReporte } from '../api/tipos';
import { Barras, EJE, REJILLA, SERIES, TOOLTIP, LEYENDA } from '../components/graficas';
import { Boton, Cargando, EncabezadoPagina, Entrada, ErrorCarga, Insignia, Selector, Tabla, Tarjeta, Vacio } from '../components/ui';
import { descargarCsv } from '../lib/copiar';
import { BotonesTrimestre } from '../components/Periodo';
import { CATEGORIAS, colorCategoria, GENEROS, opciones } from '../lib/etiquetas';
import { cn, fecha } from '../lib/formato';
import { AYUDA } from '../lib/ayuda-graficas';
import { enlaceResumen, type Cifra } from '../lib/cifras';
import { SelectorFecha, ymd } from '../components/SelectorFecha';

// Fecha local (no UTC): después de las 8 p. m. en RD, toISOString ya daría mañana.
const iso = (d: Date) => ymd(d);
const hoy = new Date();
const PRESETS = [
  { texto: 'Últimos 12 meses', desde: iso(new Date(hoy.getFullYear() - 1, hoy.getMonth(), hoy.getDate())), hasta: iso(hoy) },
  { texto: 'Este año', desde: `${hoy.getFullYear()}-01-01`, hasta: iso(hoy) },
  { texto: 'Año pasado', desde: `${hoy.getFullYear() - 1}-01-01`, hasta: `${hoy.getFullYear() - 1}-12-31` },
  { texto: 'Desde 2017', desde: '2017-01-01', hasta: iso(hoy) },
];

const ORDEN_CATEGORIAS: CategoriaPA[] = ['NORMAL', 'ELEVATED', 'GRADE_1', 'GRADE_2', 'CRISIS'];
const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v)}%`);
const miles = (v: number) => v.toLocaleString('es-DO');

function Kpi({ titulo, valor, detalle, className, a }: { titulo: string; valor: ReactNode; detalle?: ReactNode; className?: string; a?: string }) {
  const navegar = useNavigate();
  return (
    // Un div (no un enlace): el detalle puede traer sus propios enlaces.
    <div
      role={a ? 'link' : undefined}
      tabIndex={a ? 0 : undefined}
      title={a ? 'Ver los pacientes' : undefined}
      onClick={a ? () => navegar(a) : undefined}
      onKeyDown={a ? (e) => e.key === 'Enter' && navegar(a) : undefined}
      className={cn('rounded-xl border border-borde bg-superficie p-4', a && 'cursor-pointer transition-colors hover:border-tinta/25 hover:bg-fondo', className)}
    >
      <p className="text-xs text-tenue">{titulo}</p>
      <p className="tabular mt-1.5 text-2xl font-semibold tracking-tight">{valor}</p>
      {detalle && <div className="mt-0.5 text-xs text-tenue">{detalle}</div>}
    </div>
  );
}

function BotonCsv({ onClick }: { onClick: () => void }) {
  return (
    <button data-no-copiar onClick={onClick} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-marca-700 hover:bg-marca-50">
      <Download className="size-3.5" /> CSV
    </button>
  );
}

function Contenido({ r, filtro }: { r: ResumenReporte; filtro: FiltroReporte }) {
  const s = r.resumen;
  const [params] = useSearchParams();
  const navegar = useNavigate();
  // Cada cifra abre los pacientes que la forman, con el mismo periodo y filtros.
  const base = new URLSearchParams(params);
  if (!base.get('desde') && filtro.from) base.set('desde', filtro.from);
  const a = (c: Cifra) => enlaceResumen(c, base);
  const ir = (c: Cifra) => navegar(a(c));
  // Clic en un trimestre de las gráficas de recharts (activeIndex es la posición en los datos).
  const enTrimestre = (extra: Cifra) => (e: { activeIndex?: number | string | null } | null) => {
    const t = r.porTrimestre[Number(e?.activeIndex)];
    if (t && e?.activeIndex != null) ir({ ...extra, trimestre: t.clave });
  };
  const sufijo = `${filtro.from ?? ''}_${filtro.to ?? ''}`;
  if (s.visitas === 0) return <Tarjeta><Vacio icono={<PieChart className="size-8" />} titulo="Sin visitas en este periodo">Cambia las fechas o quita filtros.</Vacio></Tarjeta>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-7">
        <Kpi titulo="Pacientes atendidos" a={a({})} valor={miles(s.pacientes)} detalle={<Link to={a({ tipo: 'nuevos' })} onClick={(e) => e.stopPropagation()} className="hover:underline">{miles(s.nuevos)} visitas de primera vez</Link>} />
        <Kpi titulo="Visitas" a={a({})} valor={miles(s.visitas)} detalle={<Link to={a({ tipo: 'domiciliarias' })} onClick={(e) => e.stopPropagation()} className="hover:underline">{miles(s.domiciliarias)} domiciliarias</Link>} />
        <Kpi titulo="Controlados" a={a({ estado: 'controlados' })} valor={pct(s.controladosPct)} detalle="Última toma < 140/90" />
        <Kpi titulo="PA promedio" a={a({ tipo: 'conToma' })} valor={s.sistolicaPromedio ? `${Math.round(s.sistolicaPromedio)}/${Math.round(s.diastolicaPromedio ?? 0)}` : '—'} detalle="mmHg, todas las tomas" />
        <Kpi titulo="Cumplimiento" a={a({ tipo: 'conReceta' })} valor={pct(s.cumplimientoPromedio)} detalle="Promedio de recetas" />
        <Kpi
          titulo="Pastillas entregadas"
          a={a({ pastillas: true })}
          valor={miles(s.pastillas)}
          className="col-span-2 md:col-span-1 xl:col-span-2"
          detalle={
            r.medicamentos.length > 0 && (
              <ul className="mt-2 space-y-1 border-t border-borde pt-2">
                {r.medicamentos.map((m) => (
                  <li key={m.medicamento}>
                    <Link to={a({ medicamento: m.medicamento, pastillas: true })} onClick={(e) => e.stopPropagation()} className="-mx-1 flex items-baseline justify-between gap-3 rounded px-1 hover:bg-black/[0.04]">
                      <span className="truncate">{m.medicamento}</span>
                      <span className="tabular shrink-0 font-medium text-tinta">{miles(m.pastillas)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Tarjeta titulo="Visitas y control por trimestre" copiable ayuda={AYUDA.visitasYControl}>
          <div className="h-72 px-2 pt-4 pb-2">
            <ResponsiveContainer>
              <ComposedChart data={r.porTrimestre} margin={{ left: -8, right: 4 }} onClick={enTrimestre({})} style={{ cursor: 'pointer' }}>
                <CartesianGrid {...REJILLA} />
                <XAxis dataKey="trimestre" {...EJE} />
                <YAxis yAxisId="v" allowDecimals={false} {...EJE} />
                <YAxis yAxisId="p" orientation="right" domain={[0, 100]} unit="%" {...EJE} />
                <Tooltip {...TOOLTIP} formatter={(v, n) => (n === '% controlados' ? `${v}%` : v)} />
                <Legend {...LEYENDA} />
                <Bar yAxisId="v" dataKey="visitas" name="Visitas" fill="#fed801" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Line yAxisId="p" dataKey="controladosPct" name="% controlados" stroke="#1d1b18" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Tarjeta>

        <Tarjeta titulo="Clasificación al cierre del periodo" copiable ayuda={AYUDA.clasificacionCierre} accion={<span className="text-xs text-tenue">Última toma de cada paciente</span>}>
          <div className="p-5">
            <Barras
              filas={r.categorias.map((c) => ({
                etiqueta: CATEGORIAS[c.categoria],
                valor: c.pacientes,
                color: colorCategoria(c.categoria),
                detalle: s.pacientes ? `${Math.round((c.pacientes / s.pacientes) * 100)}%` : undefined,
                enlace: c.pacientes ? a({ categoria: c.categoria }) : undefined,
              }))}
            />
          </div>
        </Tarjeta>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Columna izquierda: dos gráficas apiladas, para acompañar la lista larga de bateyes. */}
        <div className="flex flex-col gap-4">
          <Tarjeta titulo="Presión arterial promedio por trimestre" copiable ayuda={AYUDA.presionPromedio}>
            <div className="h-64 px-2 pt-4 pb-2">
              <ResponsiveContainer>
                <LineChart data={r.porTrimestre} margin={{ left: -16, right: 12 }} onClick={enTrimestre({ tipo: 'conToma' })} style={{ cursor: 'pointer' }}>
                  <CartesianGrid {...REJILLA} />
                  <XAxis dataKey="trimestre" {...EJE} />
                  <YAxis domain={[60, 'auto']} {...EJE} />
                  <Tooltip {...TOOLTIP} />
                  <Legend {...LEYENDA} />
                  <Line dataKey="sistolicaPromedio" name="Sistólica" stroke="#1d1b18" strokeWidth={2} dot={{ r: 3 }} />
                  <Line dataKey="diastolicaPromedio" name="Diastólica" stroke="#c9a400" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Tarjeta>
          <Tarjeta titulo="Clasificación por trimestre" copiable ayuda={AYUDA.clasificacionTrimestre} className="flex flex-1 flex-col" accion={<span className="text-xs text-tenue">% de pacientes vistos</span>}>
            <div className="min-h-64 flex-1 px-2 pt-4 pb-2">
              <ResponsiveContainer>
                <BarChart data={r.porTrimestre.map((t) => ({ trimestre: t.trimestre, clave: t.clave, ...t.categorias }))} stackOffset="expand" margin={{ left: -8, right: 12 }} style={{ cursor: 'pointer' }}>
                  <CartesianGrid {...REJILLA} />
                  <XAxis dataKey="trimestre" {...EJE} />
                  <YAxis {...EJE} tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`} />
                  <Tooltip {...TOOLTIP} formatter={(v, n) => [`${miles(Number(v))} pacientes`, n]} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                  <Legend {...LEYENDA} itemSorter={(i) => ORDEN_CATEGORIAS.indexOf(i.dataKey as CategoriaPA)} />
                  {ORDEN_CATEGORIAS.map((c) => (
                    <Bar key={c} dataKey={c} name={CATEGORIAS[c]} stackId="c" fill={colorCategoria(c)} maxBarSize={44} onClick={(d) => ir({ trimestre: (d.payload as { clave: string }).clave, categoria: c })} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Tarjeta>
        </div>

        <Tarjeta titulo="Control por batey" copiable ayuda={AYUDA.controlPorBatey} accion={<span className="text-xs text-tenue">% con última toma &lt; 140/90</span>}>
          <div className="p-5">
            <Barras
              max={100}
              formato={(v) => `${Math.round(v)}%`}
              filas={[...r.porBatey]
                .sort((a, b) => (b.controladosPct ?? 0) - (a.controladosPct ?? 0))
                .map((b) => ({ etiqueta: b.batey, valor: b.controladosPct ?? 0, detalle: `de ${b.pacientes}`, enlace: a({ batey: b.communityId, estado: 'controlados' }) }))}
            />
          </div>
        </Tarjeta>
      </div>

      <Tarjeta
        titulo="Resumen por batey"
        accion={
          <BotonCsv
            onClick={() =>
              descargarCsv(
                r.porBatey.map((b) => ({ ...b, ...Object.fromEntries(r.medicamentosNombres.map((m) => [m, b.pastillasPorMed[m] ?? 0])) }) as Record<string, unknown>),
                [
                  { clave: 'batey', titulo: 'Batey' },
                  { clave: 'pacientes', titulo: 'Pacientes' },
                  { clave: 'visitas', titulo: 'Visitas' },
                  { clave: 'controladosPct', titulo: '% controlados' },
                  { clave: 'sistolicaPromedio', titulo: 'Sistólica prom.' },
                  { clave: 'diastolicaPromedio', titulo: 'Diastólica prom.' },
                  { clave: 'cumplimientoPromedio', titulo: 'Cumplimiento prom. %' },
                  ...r.medicamentosNombres.map((m) => ({ clave: m, titulo: `Pastillas ${m}` })),
                  { clave: 'pastillas', titulo: 'Total pastillas' },
                ],
                `reporte-bateyes_${sufijo}`,
              )
            }
          />
        }
      >
        <TablaBateyes r={r} a={a} />
      </Tarjeta>

      {r.medicamentos.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Tarjeta titulo="Cumplimiento por medicamento" copiable ayuda={AYUDA.cumplimientoMedicamento} accion={<span className="text-xs text-tenue">Promedio de recetas con dato</span>}>
              <div className="p-5">
                <Barras
                  max={100}
                  formato={(v) => `${Math.round(v)}%`}
                  filas={r.medicamentos.map((m) => ({ etiqueta: m.medicamento, valor: m.cumplimientoPromedio ?? 0, detalle: `${m.pacientes} pac.`, enlace: m.pacientes ? a({ medicamento: m.medicamento }) : undefined }))}
                />
              </div>
            </Tarjeta>
            <Tarjeta titulo="Distribución del cumplimiento" copiable ayuda={AYUDA.distribucionCumplimiento} accion={<span className="text-xs text-tenue">Recetas</span>}>
              <div className="p-5">
                <Barras
                  filas={r.cumplimientoTramos.map((t, i) => ({ etiqueta: t.tramo, valor: t.recetas, color: ['#dc2626', '#ea580c', '#ca8a04', '#15803d'][i], enlace: t.recetas ? a({ tramo: i }) : undefined }))}
                  formato={miles}
                />
              </div>
            </Tarjeta>
          </div>

          <Tarjeta
            titulo="Pastillas entregadas por trimestre"
            copiable ayuda={AYUDA.pastillasTrimestre}
            accion={
              <BotonCsv
                onClick={() =>
                  descargarCsv(r.medicamentos, [
                    { clave: 'medicamento', titulo: 'Medicamento' },
                    { clave: 'pacientes', titulo: 'Pacientes' },
                    { clave: 'recetas', titulo: 'Recetas' },
                    { clave: 'pastillas', titulo: 'Pastillas entregadas' },
                    { clave: 'cumplimientoPromedio', titulo: 'Cumplimiento prom. %' },
                  ], `reporte-medicamentos_${sufijo}`)
                }
              />
            }
          >
            <div className="h-72 px-2 pt-4 pb-2">
              <ResponsiveContainer>
                <BarChart data={r.pastillasPorTrimestre.map((f, i) => ({ ...f, clave: r.porTrimestre[i]?.clave }))} margin={{ left: 0, right: 12 }} style={{ cursor: 'pointer' }}>
                  <CartesianGrid {...REJILLA} />
                  <XAxis dataKey="trimestre" {...EJE} />
                  <YAxis {...EJE} tickFormatter={miles} />
                  <Tooltip {...TOOLTIP} formatter={(v) => miles(Number(v))} />
                  <Legend {...LEYENDA} />
                  {r.medicamentosNombres.map((m, i) => (
                    <Bar key={m} dataKey={m} stackId="p" fill={SERIES[i % SERIES.length]} maxBarSize={44} onClick={(d) => ir({ trimestre: (d.payload as { clave: string }).clave, medicamento: m, pastillas: true })} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Tarjeta>
        </>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Tarjeta titulo="Pacientes por edad" copiable ayuda={AYUDA.edad}>
          <div className="p-5">
            <Barras filas={r.demografia.edad.map((g) => ({ etiqueta: `${g.grupo} años`, valor: g.pacientes, enlace: g.pacientes ? a({ edad: g.grupo }) : undefined }))} formato={miles} />
          </div>
        </Tarjeta>
        <Tarjeta titulo="Pacientes por género" copiable ayuda={AYUDA.genero}>
          <div className="p-5">
            <Barras
              filas={(Object.entries(r.demografia.genero) as [Genero, number][]).map(([g, n], i) => ({
                etiqueta: GENEROS[g],
                valor: n,
                color: SERIES[i],
                detalle: `${Math.round((n / r.demografia.total) * 100)}%`,
                enlace: a({ genero: g }),
              }))}
              formato={miles}
            />
          </div>
        </Tarjeta>
        <Tarjeta titulo="Hábitos y antecedentes" copiable ayuda={AYUDA.habitos} accion={<span className="text-xs text-tenue">% de pacientes</span>}>
          <div className="p-5">
            <Barras
              max={100}
              formato={(v) => `${Math.round(v)}%`}
              filas={r.demografia.habitos.map((h, i) => ({ etiqueta: h.habito, valor: (h.pacientes / Math.max(1, r.demografia.total)) * 100, color: '#b45309', detalle: `(${h.pacientes})`, enlace: h.pacientes ? a({ habito: i }) : undefined }))}
            />
          </div>
        </Tarjeta>
      </div>

      <Tarjeta
        titulo={
          <span className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-red-600" /> Pacientes sin control al cierre ({miles(r.noControlados.length)})
          </span>
        }
        accion={
          r.noControlados.length > 0 && (
            <BotonCsv
              onClick={() =>
                descargarCsv(
                  r.noControlados.map((p) => ({ ...p, categoria: CATEGORIAS[p.categoria], fecha: fecha(p.fecha) })),
                  [
                    { clave: 'codigo', titulo: 'Código' },
                    { clave: 'nombre', titulo: 'Paciente' },
                    { clave: 'batey', titulo: 'Batey' },
                    { clave: 'presion', titulo: 'Última PA' },
                    { clave: 'categoria', titulo: 'Clasificación' },
                    { clave: 'fecha', titulo: 'Fecha' },
                    { clave: 'telefono', titulo: 'Teléfono' },
                  ],
                  `pacientes-sin-control_${sufijo}`,
                )
              }
            />
          )
        }
      >
        {r.noControlados.length === 0 ? (
          <Vacio titulo="Todos los pacientes terminaron el periodo controlados" />
        ) : (
          <div className="max-h-[28rem] overflow-y-auto">
            <Tabla columnas={['Paciente', 'Batey', 'Última PA', 'Clasificación', 'Fecha']}>
              {r.noControlados.map((p) => (
                <tr key={p.id} className="hover:bg-fondo">
                  <td className="px-5 py-2.5">
                    <Link to={`/pacientes/${p.id}`} className="font-medium hover:underline">
                      {p.nombre}
                    </Link>
                    <span className="ml-2 font-mono text-xs text-tenue">{p.codigo}</span>
                  </td>
                  <td className="px-5 py-2.5">{p.batey}</td>
                  <td className="tabular px-5 py-2.5 font-mono">{p.presion}</td>
                  <td className="px-5 py-2.5">
                    <Insignia color={colorCategoria(p.categoria)}>{CATEGORIAS[p.categoria]}</Insignia>
                  </td>
                  <td className="px-5 py-2.5 whitespace-nowrap text-tenue">{fecha(p.fecha)}</td>
                </tr>
              ))}
            </Tabla>
          </div>
        )}
      </Tarjeta>
    </div>
  );
}

const EXPORTACIONES = [
  { ruta: '/reports/patients/export', archivo: 'pacientes.csv', titulo: 'Listado de pacientes', icono: <Users className="size-4" /> },
  { ruta: '/reports/patients/high-risk', archivo: 'pacientes-alto-riesgo.csv', titulo: 'Pacientes de alto riesgo', icono: <AlertTriangle className="size-4" /> },
  { ruta: '/reports/demographics', archivo: 'demografia.csv', titulo: 'Demografía', icono: <PieChart className="size-4" /> },
];

function Exportacion({ ruta, archivo, titulo, icono }: (typeof EXPORTACIONES)[number]) {
  const bajar = useMutation({ mutationFn: () => descargar(ruta, archivo), onError: (e) => toast.error(`No se pudo generar: ${e.message}`) });
  return (
    <Boton variante="secundario" icono={icono} cargando={bajar.isPending} onClick={() => bajar.mutate()}>
      {titulo}
    </Boton>
  );
}

export function Reportes() {
  const [params, setParams] = useSearchParams();
  const comunidades = useComunidades();
  const filtro: FiltroReporte = {
    from: params.get('desde') ?? PRESETS[0].desde,
    to: params.get('hasta') ?? undefined,
    communityId: Number(params.get('batey')) || undefined,
    gender: (params.get('genero') as Genero) || undefined,
    ageMin: params.get('edadMin') ? Number(params.get('edadMin')) : undefined,
    ageMax: params.get('edadMax') ? Number(params.get('edadMax')) : undefined,
  };
  const consulta = useResumenReporte(filtro);
  const ronda = useRonda();
  const navegar = useNavigate();
  // Excel con formato: el mismo periodo y filtros de la pantalla, más el listado de pacientes.
  const excel = useMutation({
    mutationFn: () => {
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(filtro)) if (v !== undefined && v !== '') q.set(k, String(v));
      return descargar(`/reports/excel?${q}`, `reporte-hta_${filtro.from ?? ''}_${params.get('hasta') ?? ymd(new Date())}.xlsx`);
    },
    onError: (e) => toast.error(`No se pudo generar el Excel: ${e.message}`),
  });
  const cambiar = (c: Record<string, string | undefined>) =>
    setParams(
      (p) => {
        for (const [k, v] of Object.entries(c)) v ? p.set(k, v) : p.delete(k);
        return p;
      },
      { replace: true },
    );
  const desde = params.get('desde') ?? PRESETS[0].desde;
  const hasta = params.get('hasta') ?? PRESETS[0].hasta;

  return (
    <>
      <EncabezadoPagina
        titulo="Reportes"
        descripcion="Control, cobertura, cumplimiento y medicamentos según el periodo y los filtros. Cada gráfica se puede copiar como imagen."
        acciones={
          <>
            <Boton variante="secundario" icono={<ClipboardList className="size-4" />} onClick={() => navegar('/reportes/planilla')}>
              Planilla de la jornada
            </Boton>
            <Boton variante="secundario" icono={<HeartHandshake className="size-4" />} onClick={() => navegar('/reportes/donantes')}>
              Informe para donantes
            </Boton>
            <Boton variante="secundario" icono={<Pill className="size-4" />} onClick={() => navegar('/reportes/entregas')}>
              Entregas de medicamentos
            </Boton>
            <Boton icono={<FileSpreadsheet className="size-4" />} cargando={excel.isPending} onClick={() => excel.mutate()}>
              Descargar Excel
            </Boton>
          </>
        }
      />

      <Tarjeta className="mb-4">
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.texto}
                onClick={() => cambiar({ desde: p.desde, hasta: p.hasta })}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm',
                  desde === p.desde && hasta === p.hasta ? 'border-marca-500 bg-marca-50 font-medium text-marca-700' : 'border-borde text-tenue hover:text-tinta',
                )}
              >
                {p.texto}
              </button>
            ))}
            <span className="mx-2 hidden h-6 w-px bg-borde sm:block" />
            <BotonesTrimestre desde={desde} hasta={hasta} onCambiar={(r) => cambiar(r)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[auto_auto_minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
            <div className="flex items-center gap-2 text-sm text-tenue">
              Desde
              <SelectorFecha corto vacio="Cualquier fecha" aria-label="Desde" value={desde} max={hasta || undefined} onChange={(v) => cambiar({ desde: v })} />
            </div>
            <div className="flex items-center gap-2 text-sm text-tenue">
              Hasta
              <SelectorFecha corto vacio="Cualquier fecha" aria-label="Hasta" value={hasta} min={desde || undefined} onChange={(v) => cambiar({ hasta: v })} />
            </div>
            <Selector vacio="Todos los bateyes" value={filtro.communityId ?? ''} onChange={(e) => cambiar({ batey: e.target.value })} opciones={(comunidades.data ?? []).map((c) => ({ value: c.id, label: c.name }))} />
            <Selector vacio="Todos los géneros" value={filtro.gender ?? ''} onChange={(e) => cambiar({ genero: e.target.value })} opciones={opciones(GENEROS)} />
            <label className="flex items-center gap-2 text-sm text-tenue">
              Edad
              <Entrada type="number" min={0} max={120} placeholder="de" className="w-16" value={params.get('edadMin') ?? ''} onChange={(e) => cambiar({ edadMin: e.target.value })} />
              <Entrada type="number" min={0} max={120} placeholder="a" className="w-16" value={params.get('edadMax') ?? ''} onChange={(e) => cambiar({ edadMax: e.target.value })} />
            </label>
            {[...params.keys()].length > 0 && (
              <Boton variante="fantasma" icono={<X className="size-4" />} onClick={() => setParams({}, { replace: true })}>
                Limpiar
              </Boton>
            )}
          </div>
        </div>
      </Tarjeta>

      {consulta.isPending ? (
        <Cargando forma="pagina" texto="Calculando reporte…" />
      ) : consulta.isError ? (
        <ErrorCarga error={consulta.error} />
      ) : (
        <div className={cn('transition-opacity', consulta.isPlaceholderData && 'opacity-60')}>
          <Contenido r={consulta.data} filtro={filtro} />
        </div>
      )}

      <PlanillaReporte desde={desde} hasta={hasta} batey={filtro.communityId} />

      {ronda.data && (
        <div className="mt-4">
          <RondaPorBatey ronda={ronda.data} />
        </div>
      )}

      <Tarjeta titulo={<span className="flex items-center gap-2"><FileSpreadsheet className="size-4" /> Exportaciones completas</span>} className="mt-4">
        <div className="flex flex-wrap gap-2 p-5">
          {EXPORTACIONES.map((e) => (
            <Exportacion key={e.ruta} {...e} />
          ))}
        </div>
      </Tarjeta>
    </>
  );
}

/** La planilla de papel dentro de Reportes, con el mismo periodo y batey de los filtros de arriba. */
function PlanillaReporte({ desde, hasta, batey }: { desde: string; hasta: string; batey?: number }) {
  const hastaReal = hasta || ymd(new Date());
  const consulta = usePlanilla({ from: `${desde || '2017-01-01'}T00:00:00-04:00`, to: `${hastaReal}T23:59:59-04:00` });
  const navegar = useNavigate();
  const filas = (consulta.data?.filas ?? []).filter((f) => (batey ? f.communityId === batey : true));
  const total = batey ? undefined : consulta.data?.total;
  return (
    <Tarjeta
      className="mt-4"
      titulo={<span className="flex items-center gap-2"><ClipboardList className="size-4" /> Planilla de la jornada</span>}
      ayuda={AYUDA.planilla}
      accion={
        <Boton variante="secundario" className="h-8 text-xs" onClick={() => navegar(`/reportes/planilla?desde=${desde || '2017-01-01'}&hasta=${hastaReal}`)}>
          Imprimir o enviar
        </Boton>
      }
    >
      {consulta.isPending ? (
        <Cargando forma="lista" texto="Llenando la planilla…" />
      ) : consulta.isError ? (
        <ErrorCarga error={consulta.error} />
      ) : (
        <div className={cn('overflow-x-auto transition-opacity', consulta.isPlaceholderData && 'opacity-60')}>
          <TablaPlanilla filas={filas} total={total} vacio="No hubo visitas en este periodo." enlace={(columna, b) => enlaceCifra(columna, b ?? batey ?? null, desde || '2017-01-01', hastaReal)} />
        </div>
      )}
    </Tarjeta>
  );
}

/** Color del % controlado: verde si llega a 60, ámbar desde 40, rojo por debajo. */
const colorControl = (v: number | null) => (v === null ? 'text-tenue' : v >= 60 ? 'text-green-700' : v >= 40 ? 'text-amber-700' : 'text-red-600');

/**
 * Resumen por batey con encabezado agrupado: atención, control y pastillas entregadas por
 * medicamento y concentración. La columna del batey queda fija al desplazar a los lados.
 */
function TablaBateyes({ r, a }: { r: ResumenReporte; a: (c: Cifra) => string }) {
  // Cada número de la tabla abre sus pacientes.
  const celda = (c: Cifra, contenido: ReactNode) => (
    <Link to={a(c)} className="-mx-1 rounded px-1 hover:bg-marca-50 hover:underline" title="Ver los pacientes">
      {contenido}
    </Link>
  );
  const s = r.resumen;
  // Medicamentos agrupados: { Amlodipina: ['Amlodipina 5 mg', 'Amlodipina 10 mg'], … }
  const grupos = new Map<string, string[]>();
  for (const m of r.medicamentosNombres) {
    const nombre = m.split(' ')[0];
    grupos.set(nombre, [...(grupos.get(nombre) ?? []), m]);
  }
  const totalMed = (m: string) => r.porBatey.reduce((a, b) => a + (b.pastillasPorMed[m] ?? 0), 0);
  const fijo = 'sticky left-0 z-10 bg-superficie';
  const separador = 'border-l border-borde';
  const th = 'px-3 py-2 text-right font-medium whitespace-nowrap';
  const td = 'px-3 py-2.5 text-right tabular-nums';
  const cantidad = (n: number) => (n ? miles(n) : <span className="text-tenue/50">—</span>);
  const primeroDelGrupo = new Set<string>([...grupos.values()].map((ms) => ms[0]));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-tenue">
          <tr className="border-b border-borde/60 uppercase tracking-wide">
            <th rowSpan={2} className={cn(fijo, 'px-5 py-2 text-left font-medium')}>
              Batey
            </th>
            <th colSpan={2} className={cn(separador, 'px-3 pt-2.5 pb-1 text-center font-semibold text-tinta/70')}>
              Atención
            </th>
            <th colSpan={3} className={cn(separador, 'px-3 pt-2.5 pb-1 text-center font-semibold text-tinta/70')}>
              Control
            </th>
            {[...grupos.keys()].map((g) => (
              <th key={g} colSpan={grupos.get(g)!.length} className={cn(separador, 'bg-marca-50/60 px-3 pt-2.5 pb-1 text-center font-semibold text-tinta/70')}>
                {g}
              </th>
            ))}
            <th rowSpan={2} className={cn(separador, th, 'bg-marca-50/60 text-tinta/70')}>
              Total
              <br />
              pastillas
            </th>
          </tr>
          <tr className="border-b border-borde">
            <th className={cn(separador, th)}>Pacientes</th>
            <th className={th}>Visitas</th>
            <th className={cn(separador, th)}>Controlados</th>
            <th className={th}>PA prom.</th>
            <th className={th}>Cumplim.</th>
            {r.medicamentosNombres.map((m) => (
              <th key={m} className={cn(th, 'bg-marca-50/60', primeroDelGrupo.has(m) && separador)}>
                {m.split(' ').slice(1).join(' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-borde">
          {r.porBatey.map((b) => (
            <tr key={b.communityId} className="group hover:bg-fondo">
              <td className={cn(fijo, 'px-5 py-2.5 font-medium whitespace-nowrap group-hover:bg-fondo')}>{b.batey}</td>
              <td className={cn(td, separador)}>{celda({ batey: b.communityId }, miles(b.pacientes))}</td>
              <td className={td}>{celda({ batey: b.communityId }, miles(b.visitas))}</td>
              <td className={cn(td, separador, 'font-medium', colorControl(b.controladosPct))}>{celda({ batey: b.communityId, estado: 'controlados' }, pct(b.controladosPct))}</td>
              <td className={cn(td, 'font-mono text-[13px]')}>{b.sistolicaPromedio ? celda({ batey: b.communityId, tipo: 'conToma' }, `${Math.round(b.sistolicaPromedio)}/${Math.round(b.diastolicaPromedio ?? 0)}`) : '—'}</td>
              <td className={td}>{b.cumplimientoPromedio === null ? '—' : celda({ batey: b.communityId, tipo: 'conReceta' }, pct(b.cumplimientoPromedio))}</td>
              {r.medicamentosNombres.map((m) => (
                <td key={m} className={cn(td, primeroDelGrupo.has(m) && separador)}>
                  {b.pastillasPorMed[m] ? celda({ batey: b.communityId, medicamento: m, pastillas: true }, miles(b.pastillasPorMed[m])) : cantidad(0)}
                </td>
              ))}
              <td className={cn(td, separador, 'font-semibold')}>{celda({ batey: b.communityId, pastillas: true }, miles(b.pastillas))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-tinta/15 bg-fondo font-semibold">
            <td className={cn(fijo, 'bg-fondo px-5 py-3')}>Total · {r.porBatey.length} bateyes</td>
            <td className={cn(td, separador)}>{celda({}, miles(s.pacientes))}</td>
            <td className={td}>{celda({}, miles(s.visitas))}</td>
            <td className={cn(td, separador, colorControl(s.controladosPct))}>{celda({ estado: 'controlados' }, pct(s.controladosPct))}</td>
            <td className={cn(td, 'font-mono text-[13px]')}>{s.sistolicaPromedio ? celda({ tipo: 'conToma' }, `${Math.round(s.sistolicaPromedio)}/${Math.round(s.diastolicaPromedio ?? 0)}`) : '—'}</td>
            <td className={td}>{s.cumplimientoPromedio === null ? '—' : celda({ tipo: 'conReceta' }, pct(s.cumplimientoPromedio))}</td>
            {r.medicamentosNombres.map((m) => (
              <td key={m} className={cn(td, primeroDelGrupo.has(m) && separador)}>
                {celda({ medicamento: m, pastillas: true }, miles(totalMed(m)))}
              </td>
            ))}
            <td className={cn(td, separador)}>{celda({ pastillas: true }, miles(s.pastillas))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
