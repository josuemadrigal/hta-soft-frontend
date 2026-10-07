import { CalendarDays, CheckCircle2, ClipboardPlus, CloudDownload, MapPin, Search, UserPlus, UserX } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useComunidades, useJornada, useJornadas } from '../api/consultas';
import { hoyYmd } from './Jornadas';
import { marcarNoVino, quitarNoVino, type DatosNoVino } from '../api/recursos';
import type { Inasistencia, MotivoInasistencia, PacienteJornada } from '../api/tipos';
import { MOTIVOS_INASISTENCIA } from '../lib/etiquetas';
import { agregarPendiente, descartarPendiente, esFaltaDeConexion, nuevoId, usePendientes } from '../offline/cola';
import { descargarJornada, jornadasDescargadas, useEnLinea } from '../offline/datos';
import { Avatar, Boton, Cargando, EncabezadoPagina, Entrada, ErrorCarga, Insignia, InsigniaCategoria, Selector, Tarjeta, Vacio } from '../components/ui';
import { asistencia } from '../lib/asistencia';
import { cn, edadTexto, fecha, fechaYHora, nombreCompleto, tensionDe } from '../lib/formato';

type Estado = 'hoy' | 'ronda' | 'pendiente' | 'sinVenir' | 'nuevo' | 'noVino';

/** Asistencia (lib/asistencia.ts): "Pendiente" aún no viene en esta ronda; "No asiste desde…" lleva más de 6 meses sin venir. */
const ESTADOS: Record<Estado, { texto: string; color?: string; orden: number }> = {
  pendiente: { texto: 'Pendiente', color: '#a16207', orden: 0 },
  sinVenir: { texto: 'No asiste', color: '#9a3412', orden: 1 },
  nuevo: { texto: 'Sin visitas', color: '#6b665e', orden: 2 },
  hoy: { texto: 'Visto hoy', color: '#15803d', orden: 3 },
  ronda: { texto: 'Visto en la ronda', color: '#7a5c00', orden: 4 },
  noVino: { texto: 'No vino', color: '#6b665e', orden: 5 },
};

const FILTROS = [
  { valor: 'pendientes', texto: 'Por ver' },
  { valor: 'hoy', texto: 'Vistos hoy' },
  { valor: 'novino', texto: 'No vinieron' },
  { valor: 'todos', texto: 'Todos' },
] as const;

function inicioRonda() {
  const h = new Date();
  return new Date(h.getFullYear(), Math.floor(h.getMonth() / 3) * 3, 1);
}

/** Pendientes en este dispositivo (sin enviar): visitas y "No vino" de hoy. */
type Locales = { visitas: Set<number>; noVino: Map<number, MotivoInasistencia> };

function estadoDe(p: PacienteJornada, ronda: Date, hoy: Date, locales: Locales): Estado {
  if (locales.visitas.has(p.id)) return 'hoy';
  const u = p.clinicalVisits[0];
  if (!(u && new Date(u.visitDate) >= hoy) && (locales.noVino.has(p.id) || p.inasistencias?.some((i) => i.fecha.slice(0, 10) === hoyYmd()))) return 'noVino';
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

  // Lo registrado en este dispositivo que aún no se envía (sin internet)
  const pendientes = usePendientes();
  const enLinea = useEnLinea();
  const locales = useMemo<Locales>(() => {
    const visitas = new Set<number>();
    const noVino = new Map<number, MotivoInasistencia>();
    for (const x of pendientes) {
      if (x.tipo === 'visita') visitas.add(x.resumen.pacienteId);
      if (x.tipo === 'no-vino') noVino.set(x.resumen.pacienteId, (x.cuerpo as DatosNoVino).motivo);
    }
    return { visitas, noVino };
  }, [pendientes]);
  const cliente = useQueryClient();

  /** Cambia la marca de "No vino" en la lista guardada (se ve al instante, también sin internet). */
  const ajustarLista = (pacienteId: number, marca: Inasistencia | null) =>
    cliente.setQueryData<PacienteJornada[]>(['jornada', comunidadId], (l) =>
      l?.map((p) => (p.id === pacienteId ? { ...p, inasistencias: marca ? [marca] : (p.inasistencias ?? []).filter((i) => i.fecha.slice(0, 10) !== hoyYmd()) } : p)),
    );

  const marcarNoVinoEn = async (p: PacienteJornada, motivo: MotivoInasistencia) => {
    const datos: DatosNoVino = { fecha: hoyYmd(), motivo, clienteId: nuevoId() };
    ajustarLista(p.id, { fecha: datos.fecha, motivo });
    const enCola = () =>
      agregarPendiente({
        id: datos.clienteId!,
        tipo: 'no-vino',
        ruta: `/patients/${p.id}/no-vino`,
        metodo: 'POST',
        cuerpo: datos,
        resumen: { pacienteId: p.id, paciente: `${nombreCompleto(p)} · ${p.patientCode}`, detalle: `No vino (${MOTIVOS_INASISTENCIA[motivo].toLowerCase()}) el ${fecha(`${datos.fecha}T12:00:00`)}` },
      });
    try {
      if (!navigator.onLine) await enCola();
      else await marcarNoVino(p.id, datos);
      toast.success(`${nombreCompleto(p)}: no vino (${MOTIVOS_INASISTENCIA[motivo].toLowerCase()})`, {
        action: { label: 'Deshacer', onClick: () => void deshacerNoVino(p) },
      });
    } catch (e) {
      if (esFaltaDeConexion(e)) {
        await enCola();
        toast.success(`${nombreCompleto(p)}: no vino. Se enviará al volver la señal.`);
      } else {
        ajustarLista(p.id, null);
        toast.error(e instanceof Error ? e.message : 'No se pudo marcar');
      }
    }
  };

  const deshacerNoVino = async (p: PacienteJornada) => {
    ajustarLista(p.id, null);
    // Si todavía no se había enviado, basta con sacarlo de la cola.
    const enCola = pendientes.find((x) => x.tipo === 'no-vino' && x.resumen.pacienteId === p.id);
    if (enCola) return descartarPendiente(enCola.id);
    const quitar = () =>
      agregarPendiente({
        id: nuevoId(),
        tipo: 'quitar-no-vino',
        ruta: `/patients/${p.id}/no-vino/${hoyYmd()}`,
        metodo: 'DELETE',
        resumen: { pacienteId: p.id, paciente: `${nombreCompleto(p)} · ${p.patientCode}`, detalle: 'Quitar "No vino" de hoy' },
      });
    try {
      if (!navigator.onLine) await quitar();
      else await quitarNoVino(p.id, hoyYmd());
    } catch (e) {
      if (esFaltaDeConexion(e)) await quitar();
      else toast.error(e instanceof Error ? e.message : 'No se pudo deshacer');
    }
  };

  const filas = useMemo(() => {
    const ronda = inicioRonda();
    const hoy = new Date(new Date().setHours(0, 0, 0, 0));
    return (lista.data ?? [])
      .map((p) => ({ p, estado: estadoDe(p, ronda, hoy, locales) }))
      // Dentro de cada estado, la visita más reciente primero (los que faltan desde hace poco se recuperan más fácil).
      .sort(
        (a, b) =>
          ESTADOS[a.estado].orden - ESTADOS[b.estado].orden ||
          new Date(b.p.clinicalVisits[0]?.visitDate ?? 0).getTime() - new Date(a.p.clinicalVisits[0]?.visitDate ?? 0).getTime(),
      );
  }, [lista.data, locales]);

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
  const noVinieron = filas.filter((f) => f.estado === 'noVino').length;
  const q = busqueda.trim().toLowerCase();
  const visibles = filas.filter(({ p, estado }) => {
    if (medico && p.lastDoctorId !== medico) return false;
    if (q) return `${p.firstName} ${p.lastName} ${p.patientCode} ${p.address ?? ''}`.toLowerCase().includes(q);
    if (filtro === 'pendientes') return estado !== 'hoy' && estado !== 'ronda' && estado !== 'noVino';
    if (filtro === 'hoy') return estado === 'hoy';
    if (filtro === 'novino') return estado === 'noVino';
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
              <span className="text-tenue">
                {vistosHoy} hoy{noVinieron > 0 && ` · ${noVinieron} no vinieron`}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
              <div className="h-full rounded-full bg-marca-500 transition-all" style={{ width: `${filas.length ? (vistos / filas.length) * 100 : 0}%` }} />
            </div>
          </div>
        )}
      </div>

      {comunidadId && <DescargarBatey comunidadId={comunidadId} total={lista.data?.length} enLinea={enLinea} />}

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
                    <Insignia
                      color={locales.visitas.has(p.id) ? '#a16207' : estado === 'sinVenir' && asistencia(u?.visitDate).masDeUnAno ? '#6b665e' : e.color}
                      className="ml-13 justify-center sm:ml-0 sm:w-40"
                    >
                      {locales.visitas.has(p.id)
                        ? 'Registrada · sin enviar'
                        : estado === 'noVino'
                          ? `No vino · ${MOTIVOS_INASISTENCIA[locales.noVino.get(p.id) ?? p.inasistencias?.find((i) => i.fecha.slice(0, 10) === hoyYmd())?.motivo ?? 'NO_ESTABA'].toLowerCase()}`
                          : estado === 'sinVenir' && u
                            ? asistencia(u.visitDate).texto
                            : e.texto}
                    </Insignia>
                    {estado === 'noVino' ? (
                      <Boton
                        variante="fantasma"
                        className="h-8 px-2 text-xs"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          void deshacerNoVino(p);
                        }}
                      >
                        Deshacer
                      </Boton>
                    ) : (
                      estado !== 'hoy' && estado !== 'ronda' && <MenuNoVino alElegir={(m) => void marcarNoVinoEn(p, m)} />
                    )}
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

/** Botón "No vino" con el motivo (menú pequeño, no un formulario: es un toque en la jornada). */
function MenuNoVino({ alElegir }: { alElegir: (m: MotivoInasistencia) => void }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setAbierto(false);
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, [abierto]);
  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <Boton variante="secundario" className="h-8 px-3 text-xs" icono={<UserX className="size-3.5" />} onClick={() => setAbierto((a) => !a)} aria-expanded={abierto}>
        No vino
      </Boton>
      {abierto && (
        <ul className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-lg border border-borde bg-superficie py-1 text-sm shadow-lg">
          <li className="px-3 py-1.5 text-xs text-tenue">¿Por qué no vino?</li>
          {(Object.keys(MOTIVOS_INASISTENCIA) as MotivoInasistencia[]).map((m) => (
            <li key={m}>
              <button
                className="w-full px-3 py-2 text-left hover:bg-fondo"
                onClick={() => {
                  setAbierto(false);
                  alElegir(m);
                }}
              >
                {MOTIVOS_INASISTENCIA[m]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Deja el batey en el dispositivo para trabajar sin internet (lista, fichas y catálogos). */
function DescargarBatey({ comunidadId, total, enLinea }: { comunidadId: number; total?: number; enLinea: boolean }) {
  const cliente = useQueryClient();
  const [avance, setAvance] = useState<{ hechos: number; total: number } | null>(null);
  const [cuando, setCuando] = useState(() => jornadasDescargadas()[comunidadId] ?? null);
  useEffect(() => setCuando(jornadasDescargadas()[comunidadId] ?? null), [comunidadId]);
  const descargar = async () => {
    try {
      const n = await descargarJornada(cliente, comunidadId, (hechos, t) => setAvance({ hechos, total: t }));
      setCuando(new Date().toISOString());
      toast.success(`Listo: ${n} pacientes disponibles sin internet en este dispositivo.`);
    } catch (e) {
      toast.error(`No se pudo descargar: ${e instanceof Error ? e.message : 'error'}`);
    } finally {
      setAvance(null);
    }
  };
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-borde bg-superficie px-4 py-3 text-sm">
      <CloudDownload className="size-4 shrink-0 text-tenue" />
      <span className="flex-1 text-tenue">
        {avance ? (
          <>
            Descargando fichas… <strong className="text-tinta">{avance.hechos}</strong> de {avance.total}
          </>
        ) : cuando ? (
          <>
            Disponible sin internet · descargado el <strong className="text-tinta">{fechaYHora(cuando)}</strong>
          </>
        ) : (
          <>Para trabajar sin señal en el batey, descárgalo antes de salir{total ? ` (${total} pacientes)` : ''}.</>
        )}
      </span>
      <Boton variante="secundario" className="h-8 text-xs" cargando={!!avance} disabled={!enLinea} onClick={() => void descargar()}>
        {cuando ? 'Actualizar' : 'Descargar para usar sin internet'}
      </Boton>
    </div>
  );
}
