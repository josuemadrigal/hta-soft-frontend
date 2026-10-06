import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, Download, FileSpreadsheet, HeartHandshake, PieChart, Users, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { descargar } from '../api/client';
import { useComunidades, useResumenReporte, useRonda } from '../api/consultas';
import { RondaPorBatey } from '../components/RondaPorBatey';
import type { FiltroReporte, Genero, ResumenReporte } from '../api/tipos';
import { Barras, EJE, REJILLA, SERIES, TOOLTIP, LEYENDA } from '../components/graficas';
import { Boton, Cargando, EncabezadoPagina, Entrada, ErrorCarga, Insignia, Selector, Tabla, Tarjeta, Vacio } from '../components/ui';
import { descargarCsv } from '../lib/copiar';
import { BotonesTrimestre } from '../components/Periodo';
import { CATEGORIAS, colorCategoria, GENEROS, opciones } from '../lib/etiquetas';
import { cn, fecha } from '../lib/formato';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const hoy = new Date();
const PRESETS = [
  { texto: 'Últimos 12 meses', desde: iso(new Date(hoy.getFullYear() - 1, hoy.getMonth(), hoy.getDate())), hasta: iso(hoy) },
  { texto: 'Este año', desde: `${hoy.getFullYear()}-01-01`, hasta: iso(hoy) },
  { texto: 'Año pasado', desde: `${hoy.getFullYear() - 1}-01-01`, hasta: `${hoy.getFullYear() - 1}-12-31` },
  { texto: 'Desde 2017', desde: '2017-01-01', hasta: iso(hoy) },
];

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v)}%`);
const miles = (v: number) => v.toLocaleString('es-DO');

function Kpi({ titulo, valor, detalle }: { titulo: string; valor: ReactNode; detalle?: ReactNode }) {
  return (
    <div className="rounded-xl border border-borde bg-superficie p-4">
      <p className="text-xs text-tenue">{titulo}</p>
      <p className="tabular mt-1.5 text-2xl font-semibold tracking-tight">{valor}</p>
      {detalle && <p className="mt-0.5 text-xs text-tenue">{detalle}</p>}
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
  const sufijo = `${filtro.from ?? ''}_${filtro.to ?? ''}`;
  if (s.visitas === 0) return <Tarjeta><Vacio icono={<PieChart className="size-8" />} titulo="Sin visitas en este periodo">Cambia las fechas o quita filtros.</Vacio></Tarjeta>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Kpi titulo="Pacientes atendidos" valor={miles(s.pacientes)} detalle={`${miles(s.nuevos)} visitas de primera vez`} />
        <Kpi titulo="Visitas" valor={miles(s.visitas)} detalle={`${miles(s.domiciliarias)} domiciliarias`} />
        <Kpi titulo="Controlados" valor={pct(s.controladosPct)} detalle="Última toma < 140/90" />
        <Kpi titulo="PA promedio" valor={s.sistolicaPromedio ? `${Math.round(s.sistolicaPromedio)}/${Math.round(s.diastolicaPromedio ?? 0)}` : '—'} detalle="mmHg, todas las tomas" />
        <Kpi titulo="Cumplimiento" valor={pct(s.cumplimientoPromedio)} detalle="Promedio de recetas" />
        <Kpi titulo="Pastillas entregadas" valor={miles(s.pastillas)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Tarjeta titulo="Visitas y control por trimestre" copiable>
          <div className="h-72 px-2 pt-4 pb-2">
            <ResponsiveContainer>
              <ComposedChart data={r.porTrimestre} margin={{ left: -8, right: 4 }}>
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

        <Tarjeta titulo="Clasificación al cierre del periodo" copiable accion={<span className="text-xs text-tenue">Última toma de cada paciente</span>}>
          <div className="p-5">
            <Barras
              filas={r.categorias.map((c) => ({
                etiqueta: CATEGORIAS[c.categoria],
                valor: c.pacientes,
                color: colorCategoria(c.categoria),
                detalle: s.pacientes ? `${Math.round((c.pacientes / s.pacientes) * 100)}%` : undefined,
              }))}
            />
          </div>
        </Tarjeta>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Presión arterial promedio por trimestre" copiable>
          <div className="h-64 px-2 pt-4 pb-2">
            <ResponsiveContainer>
              <LineChart data={r.porTrimestre} margin={{ left: -16, right: 12 }}>
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

        <Tarjeta titulo="Control por batey" copiable accion={<span className="text-xs text-tenue">% con última toma &lt; 140/90</span>}>
          <div className="p-5">
            <Barras
              max={100}
              formato={(v) => `${Math.round(v)}%`}
              filas={[...r.porBatey]
                .sort((a, b) => (b.controladosPct ?? 0) - (a.controladosPct ?? 0))
                .map((b) => ({ etiqueta: b.batey, valor: b.controladosPct ?? 0, detalle: `de ${b.pacientes}` }))}
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
        <TablaBateyes r={r} />
      </Tarjeta>

      {r.medicamentos.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Tarjeta titulo="Cumplimiento por medicamento" copiable accion={<span className="text-xs text-tenue">Promedio de recetas con dato</span>}>
              <div className="p-5">
                <Barras
                  max={100}
                  formato={(v) => `${Math.round(v)}%`}
                  filas={r.medicamentos.map((m) => ({ etiqueta: m.medicamento, valor: m.cumplimientoPromedio ?? 0, detalle: `${m.pacientes} pac.` }))}
                />
              </div>
            </Tarjeta>
            <Tarjeta titulo="Distribución del cumplimiento" copiable accion={<span className="text-xs text-tenue">Recetas</span>}>
              <div className="p-5">
                <Barras
                  filas={r.cumplimientoTramos.map((t, i) => ({ etiqueta: t.tramo, valor: t.recetas, color: ['#dc2626', '#ea580c', '#ca8a04', '#15803d'][i] }))}
                  formato={miles}
                />
              </div>
            </Tarjeta>
          </div>

          <Tarjeta
            titulo="Pastillas entregadas por trimestre"
            copiable
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
                <BarChart data={r.pastillasPorTrimestre} margin={{ left: 0, right: 12 }}>
                  <CartesianGrid {...REJILLA} />
                  <XAxis dataKey="trimestre" {...EJE} />
                  <YAxis {...EJE} tickFormatter={miles} />
                  <Tooltip {...TOOLTIP} formatter={(v) => miles(Number(v))} />
                  <Legend {...LEYENDA} />
                  {r.medicamentosNombres.map((m, i) => (
                    <Bar key={m} dataKey={m} stackId="p" fill={SERIES[i % SERIES.length]} maxBarSize={44} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Tarjeta>
        </>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Tarjeta titulo="Pacientes por edad" copiable>
          <div className="p-5">
            <Barras filas={r.demografia.edad.map((g) => ({ etiqueta: `${g.grupo} años`, valor: g.pacientes }))} formato={miles} />
          </div>
        </Tarjeta>
        <Tarjeta titulo="Pacientes por género" copiable>
          <div className="p-5">
            <Barras
              filas={(Object.entries(r.demografia.genero) as [Genero, number][]).map(([g, n], i) => ({
                etiqueta: GENEROS[g],
                valor: n,
                color: SERIES[i],
                detalle: `${Math.round((n / r.demografia.total) * 100)}%`,
              }))}
              formato={miles}
            />
          </div>
        </Tarjeta>
        <Tarjeta titulo="Hábitos y antecedentes" copiable accion={<span className="text-xs text-tenue">% de pacientes</span>}>
          <div className="p-5">
            <Barras
              max={100}
              formato={(v) => `${Math.round(v)}%`}
              filas={r.demografia.habitos.map((h) => ({ etiqueta: h.habito, valor: (h.pacientes / Math.max(1, r.demografia.total)) * 100, color: '#b45309', detalle: `(${h.pacientes})` }))}
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
    to: params.get('hasta') ? `${params.get('hasta')}T23:59:59` : undefined,
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
      return descargar(`/reports/excel?${q}`, `reporte-hta_${filtro.from ?? ''}_${params.get('hasta') ?? new Date().toISOString().slice(0, 10)}.xlsx`);
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
            <Boton variante="secundario" icono={<HeartHandshake className="size-4" />} onClick={() => navegar('/reportes/donantes')}>
              Informe para donantes
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[auto_auto_minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
            <label className="flex items-center gap-2 text-sm text-tenue">
              Desde
              <Entrada type="date" value={desde} onChange={(e) => cambiar({ desde: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-sm text-tenue">
              Hasta
              <Entrada type="date" value={hasta} onChange={(e) => cambiar({ hasta: e.target.value })} />
            </label>
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
        <Cargando texto="Calculando reporte…" />
      ) : consulta.isError ? (
        <ErrorCarga error={consulta.error} />
      ) : (
        <div className={cn('transition-opacity', consulta.isPlaceholderData && 'opacity-60')}>
          <Contenido r={consulta.data} filtro={filtro} />
        </div>
      )}

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

/** Color del % controlado: verde si llega a 60, ámbar desde 40, rojo por debajo. */
const colorControl = (v: number | null) => (v === null ? 'text-tenue' : v >= 60 ? 'text-green-700' : v >= 40 ? 'text-amber-700' : 'text-red-600');

/**
 * Resumen por batey con encabezado agrupado: atención, control y pastillas entregadas por
 * medicamento y concentración. La columna del batey queda fija al desplazar a los lados.
 */
function TablaBateyes({ r }: { r: ResumenReporte }) {
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
              <td className={cn(td, separador)}>{miles(b.pacientes)}</td>
              <td className={td}>{miles(b.visitas)}</td>
              <td className={cn(td, separador, 'font-medium', colorControl(b.controladosPct))}>{pct(b.controladosPct)}</td>
              <td className={cn(td, 'font-mono text-[13px]')}>{b.sistolicaPromedio ? `${Math.round(b.sistolicaPromedio)}/${Math.round(b.diastolicaPromedio ?? 0)}` : '—'}</td>
              <td className={td}>{pct(b.cumplimientoPromedio)}</td>
              {r.medicamentosNombres.map((m) => (
                <td key={m} className={cn(td, primeroDelGrupo.has(m) && separador)}>
                  {cantidad(b.pastillasPorMed[m] ?? 0)}
                </td>
              ))}
              <td className={cn(td, separador, 'font-semibold')}>{miles(b.pastillas)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-tinta/15 bg-fondo font-semibold">
            <td className={cn(fijo, 'bg-fondo px-5 py-3')}>Total · {r.porBatey.length} bateyes</td>
            <td className={cn(td, separador)}>{miles(s.pacientes)}</td>
            <td className={td}>{miles(s.visitas)}</td>
            <td className={cn(td, separador, colorControl(s.controladosPct))}>{pct(s.controladosPct)}</td>
            <td className={cn(td, 'font-mono text-[13px]')}>{s.sistolicaPromedio ? `${Math.round(s.sistolicaPromedio)}/${Math.round(s.diastolicaPromedio ?? 0)}` : '—'}</td>
            <td className={td}>{pct(s.cumplimientoPromedio)}</td>
            {r.medicamentosNombres.map((m) => (
              <td key={m} className={cn(td, primeroDelGrupo.has(m) && separador)}>
                {miles(totalMed(m))}
              </td>
            ))}
            <td className={cn(td, separador)}>{miles(s.pastillas)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
