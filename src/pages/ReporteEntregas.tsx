import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Download, PackageOpen, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useComunidades } from '../api/consultas';
import { pacientesSinConsulta, reporteEntregas } from '../api/recursos';
import type { ReporteEntregas } from '../api/tipos';
import { COLOR, EJE, LEYENDA, REJILLA, TOOLTIP } from '../components/graficas';
import { BotonesTrimestre } from '../components/Periodo';
import { Boton, Cargando, EncabezadoPagina, ErrorCarga, Selector, Tabla, Tarjeta, Vacio } from '../components/ui';
import { descargarCsv } from '../lib/copiar';
import { MOTIVOS_REPOSICION } from '../lib/etiquetas';
import { cn, fecha } from '../lib/formato';
import { SelectorFecha } from '../components/SelectorFecha';
import { AYUDA } from '../lib/ayuda-graficas';

// Fechas locales: toISOString correría el día después de las 8 p. m. en RD (UTC-4).
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function presets() {
  const hoy = new Date();
  return [
    // Mismo periodo que usa el servidor por defecto: así el atajo queda marcado al entrar.
    { texto: 'Últimos 3 meses', desde: iso(new Date(hoy.getFullYear(), hoy.getMonth() - 3, hoy.getDate())), hasta: iso(hoy) },
    { texto: 'Este año', desde: `${hoy.getFullYear()}-01-01`, hasta: iso(hoy) },
    { texto: 'Año pasado', desde: `${hoy.getFullYear() - 1}-01-01`, hasta: `${hoy.getFullYear() - 1}-12-31` },
  ];
}

const miles = (v: number) => v.toLocaleString('es-DO');
/** Los ceros se atenúan para que resalten las cifras que sí importan. */
const cantidad = (n: number) => (n ? miles(n) : <span className="text-tenue/50">—</span>);

/** Tres vías de salida de las pastillas, siempre con el mismo color en gráfica y tablas. */
const VIAS = [
  { clave: 'visita', nombre: 'En la visita', color: COLOR.tinta },
  { clave: 'mesa', nombre: 'En la mesa de farmacia', color: COLOR.amarillo },
  { clave: 'reposicion', nombre: 'Reposición sin consulta', color: '#6366f1' },
] as const;

function Kpi({ titulo, valor, detalle, color, a }: { titulo: string; valor: ReactNode; detalle?: ReactNode; color?: string; a?: string }) {
  const navegar = useNavigate();
  return (
    // Un div (no un enlace): el detalle puede traer sus propios enlaces.
    <div
      role={a ? 'link' : undefined}
      tabIndex={a ? 0 : undefined}
      title={a ? 'Ver los pacientes' : undefined}
      onClick={a ? () => navegar(a) : undefined}
      onKeyDown={a ? (e) => e.key === 'Enter' && navegar(a) : undefined}
      className={cn('rounded-xl border border-borde bg-superficie p-4', a && 'cursor-pointer transition-colors hover:border-tinta/25 hover:bg-fondo')}
    >
      <p className="flex items-center gap-1.5 text-xs text-tenue">
        {color && <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
        {titulo}
      </p>
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

const td = 'px-5 py-2.5 text-right tabular-nums whitespace-nowrap';
const der = 'text-right';

/** Un número de las tablas que abre sus pacientes. */
function Cifra({ a, children }: { a: string; children: ReactNode }) {
  return (
    <Link to={a} className="-mx-1 rounded px-1 hover:bg-marca-50 hover:underline" title="Ver los pacientes">
      {children}
    </Link>
  );
}

function Contenido({ r, sufijo, filtros }: { r: ReporteEntregas; sufijo: string; filtros: URLSearchParams }) {
  const t = r.totales;
  // Cada cifra abre los pacientes que la forman (misma regla del reporte, mismo periodo y batey).
  const a = (c: Record<string, string | number | boolean | undefined>) => {
    const q = new URLSearchParams(filtros);
    q.set('fuente', 'entregas');
    q.set('cifra', Object.entries(c).filter(([, v]) => v !== undefined && v !== false).map(([k, v]) => (v === true ? k : `${k}:${v}`)).join(','));
    return `/reportes/pacientes?${q}`;
  };
  const navegar = useNavigate();
  const n = (c: Record<string, string | number | boolean | undefined>, v: number, texto: ReactNode = miles(v)) => (v ? <Cifra a={a(c)}>{texto}</Cifra> : cantidad(0));
  const pendientes = (
    <Kpi
      titulo="Pendientes hoy"
      a={t.pendientesPacientes ? a({ pendientes: true }) : undefined}
      valor={miles(t.pendientesPacientes)}
      detalle={
        <>
          {t.pendientesPacientes === 1 ? 'paciente' : 'pacientes'} · {miles(t.pendientesPastillas)} pastillas{' '}
          {t.pendientesPacientes > 0 && (
            <Link to="/entregas" onClick={(e) => e.stopPropagation()} className="font-medium text-marca-700 hover:underline">
              Ir a la mesa
            </Link>
          )}
        </>
      }
    />
  );

  // Sin entregas en el periodo igual se muestra lo pendiente de hoy: no depende de las fechas.
  if (t.entregas === 0)
    return (
      <div className="space-y-4">
        <Tarjeta>
          <Vacio icono={<PackageOpen className="size-8" />} titulo="Sin entregas en este periodo">
            Cambia las fechas o el batey.
          </Vacio>
        </Tarjeta>
        {t.pendientesPacientes > 0 && <div className="grid grid-cols-2 gap-4 md:grid-cols-3">{pendientes}</div>}
      </div>
    );

  const bateys = r.porBatey.filter((b) => b.entregas > 0 || b.pendientesPacientes > 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Kpi
          titulo="Pastillas entregadas"
          a={a({})}
          valor={miles(t.pastillas)}
          detalle={`${miles(t.entregas)} entregas · ${miles(t.pacientes)} ${t.pacientes === 1 ? 'paciente' : 'pacientes'}`}
        />
        {VIAS.map((v) => (
          <Kpi key={v.clave} titulo={v.nombre} color={v.color} a={t[v.clave] ? a({ via: v.clave }) : undefined} valor={miles(t[v.clave])} detalle={t.pastillas ? `${Math.round((t[v.clave] / t.pastillas) * 100)}% de las pastillas` : undefined} />
        ))}
        <Kpi titulo="Devueltas" a={t.devueltas ? a({ devueltas: true }) : undefined} valor={miles(t.devueltas)} detalle={`al inventario · ${miles(t.descartadas)} descartadas`} />
        {pendientes}
      </div>

      <Tarjeta titulo="Pastillas por batey" copiable ayuda={AYUDA.pastillasPorBatey} accion={<span className="text-xs text-tenue">Según dónde se entregaron</span>}>
        {/* Alto según la cantidad de bateyes: barras horizontales para que los nombres se lean en tableta. */}
        <div className="px-2 pt-4 pb-2" style={{ height: Math.max(220, bateys.length * 34 + 70) }}>
          <ResponsiveContainer>
            <BarChart data={bateys} layout="vertical" margin={{ left: 8, right: 16 }} style={{ cursor: 'pointer' }}>
              <CartesianGrid {...REJILLA} vertical horizontal={false} />
              <XAxis type="number" {...EJE} tickFormatter={miles} />
              <YAxis type="category" dataKey="batey" width={110} {...EJE} />
              <Tooltip {...TOOLTIP} formatter={(v) => miles(Number(v))} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Legend {...LEYENDA} />
              {VIAS.map((v, i) => (
                <Bar key={v.clave} dataKey={v.clave} name={v.nombre} stackId="v" fill={v.color} maxBarSize={22} onClick={(d) => navegar(a({ batey: (d.payload as { communityId: number }).communityId, via: v.clave }))} radius={i === VIAS.length - 1 ? [0, 4, 4, 0] : undefined} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Tarjeta>

      <Tarjeta
        titulo="Por batey"
        accion={
          <BotonCsv
            onClick={() =>
              descargarCsv(
                r.porBatey,
                [
                  { clave: 'batey', titulo: 'Batey' },
                  { clave: 'entregas', titulo: 'Entregas' },
                  { clave: 'pastillas', titulo: 'Pastillas' },
                  { clave: 'visita', titulo: 'En visita' },
                  { clave: 'mesa', titulo: 'En mesa' },
                  { clave: 'reposicion', titulo: 'Reposición' },
                  { clave: 'pendientesPacientes', titulo: 'Pacientes pendientes hoy' },
                  { clave: 'pendientesPastillas', titulo: 'Pastillas pendientes hoy' },
                ],
                `entregas-por-batey_${sufijo}`,
              )
            }
          />
        }
      >
        <Tabla
          columnas={[
            'Batey',
            { texto: 'Entregas', className: der },
            { texto: 'Pastillas', className: der },
            { texto: 'En visita', className: der },
            { texto: 'En mesa', className: der },
            { texto: 'Reposición', className: der },
            { texto: 'Pendientes hoy', className: der },
          ]}
        >
          {r.porBatey.map((b) => (
            <tr key={b.communityId} className="hover:bg-fondo">
              <td className="px-5 py-2.5 font-medium whitespace-nowrap">{b.batey}</td>
              <td className={td}>{n({ batey: b.communityId }, b.entregas)}</td>
              <td className={cn(td, 'font-semibold')}>{n({ batey: b.communityId }, b.pastillas)}</td>
              <td className={td}>{n({ batey: b.communityId, via: 'visita' }, b.visita)}</td>
              <td className={td}>{n({ batey: b.communityId, via: 'mesa' }, b.mesa)}</td>
              <td className={td}>{n({ batey: b.communityId, via: 'reposicion' }, b.reposicion)}</td>
              <td className={td}>
                {b.pendientesPacientes ? (
                  <span className="text-amber-700">{n({ batey: b.communityId, pendientes: true }, b.pendientesPacientes, `${miles(b.pendientesPacientes)} pac. · ${miles(b.pendientesPastillas)}`)}</span>
                ) : (
                  cantidad(0)
                )}
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-tinta/15 bg-fondo font-semibold">
            <td className="px-5 py-3">Total</td>
            <td className={td}>{n({}, t.entregas)}</td>
            <td className={td}>{n({}, t.pastillas)}</td>
            <td className={td}>{n({ via: 'visita' }, t.visita)}</td>
            <td className={td}>{n({ via: 'mesa' }, t.mesa)}</td>
            <td className={td}>{n({ via: 'reposicion' }, t.reposicion)}</td>
            <td className={td}>{n({ pendientes: true }, t.pendientesPacientes, `${miles(t.pendientesPacientes)} pac. · ${miles(t.pendientesPastillas)}`)}</td>
          </tr>
        </Tabla>
      </Tarjeta>

      <Tarjeta
        titulo="Por medicamento"
        accion={
          <BotonCsv
            onClick={() =>
              descargarCsv(
                r.porMedicamento,
                [
                  { clave: 'medicamento', titulo: 'Medicamento' },
                  { clave: 'pastillas', titulo: 'Pastillas (netas)' },
                  { clave: 'visita', titulo: 'En visita' },
                  { clave: 'mesa', titulo: 'En mesa' },
                  { clave: 'reposicion', titulo: 'Reposición' },
                  { clave: 'devueltas', titulo: 'Devueltas' },
                  { clave: 'descartadas', titulo: 'Descartadas' },
                ],
                `entregas-por-medicamento_${sufijo}`,
              )
            }
          />
        }
      >
        <Tabla
          columnas={[
            'Medicamento',
            { texto: 'Pastillas', className: der },
            { texto: 'En visita', className: der },
            { texto: 'En mesa', className: der },
            { texto: 'Reposición', className: der },
            { texto: 'Devueltas', className: der },
            { texto: 'Descartadas', className: der },
          ]}
        >
          {r.porMedicamento.map((m) => (
            <tr key={m.medicamento} className="hover:bg-fondo">
              <td className="px-5 py-2.5 font-medium whitespace-nowrap">{m.medicamento}</td>
              <td className={cn(td, 'font-semibold')}>{n({ medicamento: m.medicamento }, m.pastillas)}</td>
              <td className={td}>{n({ medicamento: m.medicamento, via: 'visita' }, m.visita)}</td>
              <td className={td}>{n({ medicamento: m.medicamento, via: 'mesa' }, m.mesa)}</td>
              <td className={td}>{n({ medicamento: m.medicamento, via: 'reposicion' }, m.reposicion)}</td>
              <td className={td}>{n({ medicamento: m.medicamento, devueltas: true }, m.devueltas)}</td>
              <td className={td}>{n({ medicamento: m.medicamento, descartadas: true }, m.descartadas)}</td>
            </tr>
          ))}
        </Tabla>
        <p className="border-t border-borde px-5 py-2.5 text-xs text-tenue">Pastillas netas: ya se restaron las devueltas y las descartadas.</p>
      </Tarjeta>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Quién entregó">
          {r.porPersona.length === 0 ? (
            <Vacio titulo="Sin datos de quién entregó" />
          ) : (
            <Tabla columnas={['Persona', { texto: 'Entregas', className: der }, { texto: 'Pastillas', className: der }]}>
              {r.porPersona.map((p) => (
                <tr key={p.nombre} className="hover:bg-fondo">
                  <td className="px-5 py-2.5 font-medium">{p.nombre}</td>
                  <td className={td}>{n({ persona: p.nombre }, p.entregas)}</td>
                  <td className={td}>{n({ persona: p.nombre }, p.pastillas)}</td>
                </tr>
              ))}
            </Tabla>
          )}
        </Tarjeta>

        <Tarjeta titulo="Reposiciones por motivo">
          {r.reposicionesPorMotivo.length === 0 ? (
            <Vacio titulo="Sin reposiciones en este periodo" />
          ) : (
            <Tabla columnas={['Motivo', { texto: 'Entregas', className: der }, { texto: 'Pastillas', className: der }]}>
              {r.reposicionesPorMotivo.map((m) => (
                <tr key={m.motivo} className="hover:bg-fondo">
                  <td className="px-5 py-2.5">{MOTIVOS_REPOSICION[m.motivo] ?? m.motivo}</td>
                  <td className={td}>{n({ motivo: m.motivo }, m.entregas)}</td>
                  <td className={td}>{n({ motivo: m.motivo }, m.pastillas)}</td>
                </tr>
              ))}
            </Tabla>
          )}
        </Tarjeta>
      </div>
    </div>
  );
}

/** /reportes/entregas — cuántas pastillas salieron, por qué vía, en qué batey y quién las entregó. */
export function PantallaReporteEntregas() {
  const [params, setParams] = useSearchParams();
  const comunidades = useComunidades();
  const [porDefecto] = presets();
  const desde = params.get('desde') ?? porDefecto.desde;
  const hasta = params.get('hasta') ?? porDefecto.hasta;
  const communityId = Number(params.get('batey')) || undefined;

  const consulta = useQuery({
    queryKey: ['entregas', 'reporte', desde, hasta, communityId ?? null],
    queryFn: () => reporteEntregas({ desde, hasta, communityId }),
    // Al cambiar filtros se mantiene el reporte anterior (atenuado) en vez de parpadear.
    placeholderData: keepPreviousData,
  });

  const cambiar = (c: Record<string, string | undefined>) =>
    setParams(
      (p) => {
        for (const [k, v] of Object.entries(c)) v ? p.set(k, v) : p.delete(k);
        return p;
      },
      { replace: true },
    );

  return (
    <>
      <EncabezadoPagina titulo="Entregas de medicamentos" descripcion="Cuántas pastillas salieron, por dónde y quién las entregó." volver={{ a: '/reportes', texto: 'Reportes' }} />

      <Tarjeta className="mb-4">
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {presets().map((p) => (
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
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-tenue">
              Desde
              <SelectorFecha corto vacio="Cualquier fecha" className="w-auto" aria-label="Desde" value={desde} max={hasta || undefined} onChange={(v) => cambiar({ desde: v })} />
            </div>
            <div className="flex items-center gap-2 text-sm text-tenue">
              Hasta
              <SelectorFecha corto vacio="Cualquier fecha" className="w-auto" aria-label="Hasta" value={hasta} min={desde || undefined} onChange={(v) => cambiar({ hasta: v })} />
            </div>
            <Selector
              className="w-auto min-w-44"
              vacio="Todos los bateyes"
              value={communityId ?? ''}
              onChange={(e) => cambiar({ batey: e.target.value })}
              opciones={(comunidades.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
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
          <Contenido r={consulta.data} sufijo={`${desde}_${hasta}`} filtros={new URLSearchParams({ desde, hasta, ...(communityId ? { batey: String(communityId) } : {}) })} />
        </div>
      )}
      <SinConsulta />
    </>
  );
}

/** Quienes llevan 2 rondas o más recibiendo el tratamiento sin que los vea un médico (no depende del periodo). */
function SinConsulta() {
  const consulta = useQuery({ queryKey: ['entregas', 'sin-consulta'], queryFn: pacientesSinConsulta });
  const lista = consulta.data ?? [];
  if (!lista.length) return null;
  return (
    <div id="sin-consulta" className="mt-4 scroll-mt-6">
      <Tarjeta titulo={`Reciben tratamiento sin consulta (${lista.length})`} accion={<span className="text-xs text-tenue">2 rondas o más sin que los vea un médico</span>}>
        <Tabla columnas={['Paciente', 'Batey', 'Rondas', 'Última consulta', 'Última entrega', 'Con quién']}>
          {lista.map((x) => (
            <tr key={x.paciente.id} className="hover:bg-fondo">
              <td className="px-5 py-2.5">
                <Link to={`/pacientes/${x.paciente.id}`} className="font-medium hover:underline">
                  {x.paciente.firstName} {x.paciente.lastName}
                </Link>{' '}
                <span className="font-mono text-xs text-tenue">{x.paciente.patientCode}</span>
              </td>
              <td className="px-5 py-2.5">{x.paciente.batey}</td>
              <td className="tabular px-5 py-2.5 font-medium text-amber-800">{x.rondas}</td>
              <td className="tabular px-5 py-2.5 text-tenue">{x.ultimaConsulta ? fecha(x.ultimaConsulta) : 'Nunca'}</td>
              <td className="tabular px-5 py-2.5 text-tenue">{fecha(x.ultimaEntrega)}</td>
              <td className="px-5 py-2.5 text-tenue">{x.con ?? '—'}</td>
            </tr>
          ))}
        </Tabla>
      </Tarjeta>
    </div>
  );
}
