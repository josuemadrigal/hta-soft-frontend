import { CalendarDays, CheckCircle2, ClipboardPlus, MapPin, Search, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useComunidades, useJornada, useJornadas } from '../api/consultas';
import { hoyYmd } from './Jornadas';
import type { PacienteJornada } from '../api/tipos';
import { Avatar, Boton, Cargando, EncabezadoPagina, Entrada, ErrorCarga, Insignia, InsigniaCategoria, Selector, Tarjeta, Vacio } from '../components/ui';
import { asistencia } from '../lib/asistencia';
import { cn, edadTexto, fecha, nombreCompleto, tensionDe } from '../lib/formato';

type Estado = 'hoy' | 'ronda' | 'pendiente' | 'sinVenir' | 'nuevo';

/** Asistencia (lib/asistencia.ts): "Pendiente" aún no viene en esta ronda; "No asiste desde…" lleva más de 6 meses sin venir. */
const ESTADOS: Record<Estado, { texto: string; color?: string; orden: number }> = {
  pendiente: { texto: 'Pendiente', color: '#a16207', orden: 0 },
  sinVenir: { texto: 'No asiste', color: '#9a3412', orden: 1 },
  nuevo: { texto: 'Sin visitas', color: '#6b665e', orden: 2 },
  hoy: { texto: 'Visto hoy', color: '#15803d', orden: 3 },
  ronda: { texto: 'Visto en la ronda', color: '#7a5c00', orden: 4 },
};

const FILTROS = [
  { valor: 'pendientes', texto: 'Por ver' },
  { valor: 'hoy', texto: 'Vistos hoy' },
  { valor: 'todos', texto: 'Todos' },
] as const;

function inicioRonda() {
  const h = new Date();
  return new Date(h.getFullYear(), Math.floor(h.getMonth() / 3) * 3, 1);
}

function estadoDe(p: PacienteJornada, ronda: Date, hoy: Date): Estado {
  const u = p.clinicalVisits[0];
  if (!u) return 'nuevo';
  const visita = new Date(u.visitDate);
  if (visita >= hoy) return 'hoy';
  if (visita >= ronda) return 'ronda';
  return asistencia(u.visitDate).clave === 'sin-venir' ? 'sinVenir' : 'pendiente';
}

export function Jornada() {
  const [params, setParams] = useSearchParams();
  const idPedido = Number(params.get('batey')) || undefined;
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]['valor']>('pendientes');
  const [medico, setMedico] = useState<number | ''>('');
  const navegar = useNavigate();

  const comunidades = useComunidades();
  // Un enlace viejo puede traer un batey que ya no existe: se trata como sin elegir.
  const comunidadId = comunidades.data?.some((c) => c.id === idPedido) ? idPedido : undefined;
  const lista = useJornada(comunidadId);
  const hoyPlan = useJornadas({ desde: hoyYmd(), hasta: hoyYmd(), estado: 'PLANIFICADA' });
  const planHoy = hoyPlan.data?.find((j) => j.communityId === comunidadId);

  const filas = useMemo(() => {
    const ronda = inicioRonda();
    const hoy = new Date(new Date().setHours(0, 0, 0, 0));
    return (lista.data ?? [])
      .map((p) => ({ p, estado: estadoDe(p, ronda, hoy) }))
      // Dentro de cada estado, la visita más reciente primero (los que faltan desde hace poco se recuperan más fácil).
      .sort(
        (a, b) =>
          ESTADOS[a.estado].orden - ESTADOS[b.estado].orden ||
          new Date(b.p.clinicalVisits[0]?.visitDate ?? 0).getTime() - new Date(a.p.clinicalVisits[0]?.visitDate ?? 0).getTime(),
      );
  }, [lista.data]);

  // Médicos que figuran como último en atender a alguien de este batey
  const medicosDelBatey = [
    ...filas
      .reduce((m, { p }) => {
        if (p.lastDoctorId) m.set(p.lastDoctorId, { id: p.lastDoctorId, nombre: p.lastDoctorNombre ?? `#${p.lastDoctorId}`, n: (m.get(p.lastDoctorId)?.n ?? 0) + 1 });
        return m;
      }, new Map<number, { id: number; nombre: string; n: number }>())
      .values(),
  ].sort((a, b) => a.nombre.localeCompare(b.nombre));

  const vistos = filas.filter((f) => f.estado === 'hoy' || f.estado === 'ronda').length;
  const vistosHoy = filas.filter((f) => f.estado === 'hoy').length;
  const q = busqueda.trim().toLowerCase();
  const visibles = filas.filter(({ p, estado }) => {
    if (medico && p.lastDoctorId !== medico) return false;
    if (q) return `${p.firstName} ${p.lastName} ${p.patientCode} ${p.address ?? ''}`.toLowerCase().includes(q);
    if (filtro === 'pendientes') return estado !== 'hoy' && estado !== 'ronda';
    if (filtro === 'hoy') return estado === 'hoy';
    return true;
  });

  return (
    <>
      <EncabezadoPagina
        titulo="Registro en jornada"
        descripcion="Registro rápido de visitas en el batey."
        acciones={
          comunidadId && (
            <Boton variante="secundario" icono={<UserPlus className="size-4" />} onClick={() => navegar(`/pacientes/nuevo?batey=${comunidadId}`)}>
              Paciente nuevo
            </Boton>
          )
        }
      />

      {planHoy && (
        <Link to={`/jornadas/${planHoy.id}`} className="mb-4 flex items-center gap-3 rounded-xl border border-amber-300 bg-marca-50 px-5 py-3 text-sm hover:border-amber-400">
          <CalendarDays className="size-4 shrink-0" />
          <span>
            Jornada planificada de hoy en <strong>{planHoy.community.name}</strong>
            {planHoy.responsable && ` · responsable ${planHoy.responsable.firstName} ${planHoy.responsable.lastName}`}. Ver qué llevar, faltantes y cerrarla.
          </span>
        </Link>
      )}
      {!comunidadId && !!hoyPlan.data?.length && (
        <p className="mb-4 text-sm text-tenue">
          Hoy hay jornada en:{' '}
          {hoyPlan.data.map((j, i) => (
            <span key={j.id}>
              {i > 0 && ', '}
              <button className="font-medium text-tinta underline" onClick={() => setParams({ batey: String(j.communityId) }, { replace: true })}>
                {j.community.name}
              </button>
            </span>
          ))}
        </p>
      )}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex min-w-60 flex-col gap-1.5">
          <span className="text-[13px] font-medium text-tinta/80">Batey</span>
          <Selector
            vacio="Elegir batey…"
            value={comunidadId ?? ''}
            onChange={(e) => setParams(e.target.value ? { batey: e.target.value } : {}, { replace: true })}
            opciones={(comunidades.data ?? []).filter((c) => c.isActive).map((c) => ({ value: c.id, label: c.name }))}
          />
        </label>
        {comunidadId && lista.data && (
          <div className="min-w-60 flex-1">
            <div className="mb-1.5 flex justify-between text-[13px]">
              <span className="font-medium">
                {vistos} de {filas.length} vistos en la ronda
              </span>
              <span className="text-tenue">{vistosHoy} hoy</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
              <div className="h-full rounded-full bg-marca-500 transition-all" style={{ width: `${filas.length ? (vistos / filas.length) * 100 : 0}%` }} />
            </div>
          </div>
        )}
      </div>

      {!comunidadId ? (
        <Tarjeta>
          <Vacio icono={<MapPin className="size-8" />} titulo="Elige el batey de la jornada">
            Verás a sus pacientes activos y quién falta por ver en esta ronda.
          </Vacio>
        </Tarjeta>
      ) : (
        <Tarjeta>
          <div className="flex flex-wrap items-center gap-3 border-b border-borde p-4">
            <div className="relative min-w-52 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tenue" />
              <Entrada value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre, código o casa" className="pl-9" />
            </div>
            <Selector
              className="w-auto min-w-48"
              vacio="Lo atendió: cualquiera"
              value={medico}
              onChange={(e) => setMedico(e.target.value ? Number(e.target.value) : '')}
              opciones={medicosDelBatey.map((m) => ({ value: m.id, label: `${m.nombre} (${m.n})` }))}
              aria-label="Último que lo atendió"
            />
            <div className="flex rounded-lg bg-black/5 p-0.5 text-sm">
              {FILTROS.map((f) => (
                <button
                  key={f.valor}
                  onClick={() => setFiltro(f.valor)}
                  className={cn('rounded-md px-3 py-1.5', filtro === f.valor && !q ? 'bg-superficie font-medium shadow-sm' : 'text-tenue hover:text-tinta')}
                >
                  {f.texto}
                </button>
              ))}
            </div>
          </div>

          {lista.isPending ? (
            <Cargando />
          ) : lista.isError ? (
            <ErrorCarga error={lista.error} />
          ) : visibles.length === 0 ? (
            <Vacio icono={<CheckCircle2 className="size-8" />} titulo={q ? 'Sin coincidencias' : filtro === 'pendientes' ? 'No falta nadie por ver' : 'Nadie todavía'} />
          ) : (
            <ul className="divide-y divide-borde">
              {visibles.map(({ p, estado }) => {
                const u = p.clinicalVisits[0];
                const e = ESTADOS[estado];
                return (
                  <li
                    key={p.id}
                    onClick={() => navegar(`/pacientes/${p.id}?volver=${encodeURIComponent(`/jornada?batey=${comunidadId}`)}`)}
                    className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 hover:bg-fondo sm:flex-nowrap"
                  >
                    <Avatar persona={p} foto={p.photoUrl} />
                    {/* En móvil el nombre ocupa su línea; estado y botón bajan a la siguiente. */}
                    <div className="min-w-0 flex-1 basis-[calc(100%-3.5rem)] sm:basis-0">
                      <p className="truncate font-medium">{nombreCompleto(p)}</p>
                      <p className="truncate text-xs text-tenue">
                        <span className="font-mono">{p.patientCode}</span> · {edadTexto(p)}
                        {p.address && ` · Casa ${p.address}`}
                      </p>
                    </div>
                    <div className="hidden w-52 text-right text-xs text-tenue md:block">
                      {u ? (
                        <>
                          <span className="tabular font-mono text-sm text-tinta">{tensionDe(u)}</span> <InsigniaCategoria config={u.bpClassification} />
                          <p className="mt-0.5">
                            {fecha(u.visitDate)}
                            {p.lastDoctorNombre && <span className="block truncate">Atendió {p.lastDoctorNombre}</span>}
                          </p>
                        </>
                      ) : (
                        '—'
                      )}
                    </div>
                    <Insignia color={estado === 'sinVenir' && asistencia(u?.visitDate).masDeUnAno ? '#6b665e' : e.color} className="ml-13 justify-center sm:ml-0 sm:w-40">
                      {estado === 'sinVenir' && u ? asistencia(u.visitDate).texto : e.texto}
                    </Insignia>
                    <Boton
                      variante={estado === 'hoy' ? 'secundario' : 'primario'}
                      className="ml-auto h-8 sm:ml-0"
                      icono={<ClipboardPlus className="size-4" />}
                      onClick={(e) => {
                        e.stopPropagation(); // el botón registra; el resto de la fila abre la ficha
                        navegar(`/pacientes/${p.id}/visita?volver=${encodeURIComponent(`/jornada?batey=${comunidadId}`)}`);
                      }}
                    >
                      {estado === 'hoy' ? 'Otra' : 'Registrar'}
                    </Boton>
                  </li>
                );
              })}
            </ul>
          )}
        </Tarjeta>
      )}

    </>
  );
}
