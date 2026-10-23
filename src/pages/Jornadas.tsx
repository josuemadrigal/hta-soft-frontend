import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarPlus, Search, Stethoscope, X, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Lock, Mail, MapPin, Package, Pencil, Printer, Tent, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useAsistenciaJornadas, useComunidades, useDetalleJornada, useJornadas, useResponsables, useSugerenciasJornadas } from '../api/consultas';
import { cancelarJornada, cerrarJornada, crearJornada, editarJornada } from '../api/recursos';
import type { DetalleJornada, EstadoJornada, Jornada } from '../api/tipos';
import { useSesion } from '../auth/sesion';
import { CATEGORIAS, conQuien, MOTIVOS_INASISTENCIA } from '../lib/etiquetas';
import { useConfirmar } from '../components/confirmar';
import { AreaTexto, Boton, Campo, Cargando, EncabezadoPagina, Entrada, ErrorCarga, Insignia, InsigniaCategoria, Selector, Tabla, Tarjeta, Vacio } from '../components/ui';
import { cn, edadTexto, fecha, fechaYHora, nombreCompleto } from '../lib/formato';
import { SelectorFecha } from '../components/SelectorFecha';
import { coincide } from '../lib/busqueda';

/* Las jornadas son fechas "puras" (medianoche UTC): se muestran sin correr de día. */
const fmtDia = new Intl.DateTimeFormat('es-DO', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fmtLargo = new Intl.DateTimeFormat('es-DO', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtMes = new Intl.DateTimeFormat('es-DO', { month: 'long', year: 'numeric' });
export const diaJornada = (iso: string, largo = false) => {
  const t = (largo ? fmtLargo : fmtDia).format(new Date(iso));
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const hoyYmd = () => ymd(new Date());
const miles = (n: number) => n.toLocaleString('es-DO');

const ESTADOS: Record<EstadoJornada, { texto: string; color: string }> = {
  PLANIFICADA: { texto: 'Planificada', color: '#a16207' },
  CERRADA: { texto: 'Cerrada', color: '#15803d' },
  CANCELADA: { texto: 'Cancelada', color: '#6b665e' },
};

function invalidar(cliente: ReturnType<typeof useQueryClient>) {
  for (const k of [['jornadas'], ['auditoria']]) cliente.invalidateQueries({ queryKey: k });
}

/* ───────────── Lista: próximas, sugerencias por batey y calendario ───────────── */

export function Jornadas() {
  const navegar = useNavigate();
  const puedePlanificar = useSesion().tiene('jornadas.planificar');
  const hoy = hoyYmd();
  const proximas = useJornadas({ desde: hoy, estado: 'PLANIFICADA' });
  const sugerencias = useSugerenciasJornadas();

  return (
    <>
      <EncabezadoPagina
        titulo="Jornadas"
        descripcion="Planificación de las visitas a cada batey: qué día, quién va y qué llevar."
        acciones={
          puedePlanificar && (
            <Boton icono={<CalendarPlus className="size-4" />} onClick={() => navegar('/jornadas/nueva')}>
              Planificar jornada
            </Boton>
          )
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-4">
          <Tarjeta titulo="Próximas jornadas">
            {proximas.isPending ? (
              <Cargando />
            ) : !proximas.data?.length ? (
              <Vacio icono={<Tent className="size-8" />} titulo="Nada planificado">
                Usa las sugerencias por batey para planificar la próxima ronda.
              </Vacio>
            ) : (
              <ul className="divide-y divide-borde">
                {proximas.data.map((j) => (
                  <li key={j.id}>
                    <Link to={`/jornadas/${j.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-fondo">
                      <FechaCaja iso={j.fecha} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{j.community.name}</p>
                        <p className="text-xs text-tenue">{j.responsable ? `Responsable: ${nombreCompleto(j.responsable)}` : 'Sin responsable'}</p>
                      </div>
                      {j.fecha.slice(0, 10) === hoy && <Insignia color="#15803d">Hoy</Insignia>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>

          <Tarjeta titulo="Sugerencias por batey" accion={<span className="text-xs text-tenue">Cada ~3 meses desde la última visita</span>}>
            {sugerencias.isPending ? (
              <Cargando />
            ) : sugerencias.isError ? (
              <ErrorCarga error={sugerencias.error} />
            ) : (
              <ul className="divide-y divide-borde">
                {sugerencias.data.map((s) => (
                  <li key={s.communityId} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 font-medium">
                        {s.batey} {s.atrasada && !s.proxima && <Insignia color="#a16207">Jornada pendiente</Insignia>}
                      </p>
                      <p className="text-xs text-tenue">
                        {miles(s.pacientes)} pacientes activos · última visita {s.ultimaVisita ? fecha(s.ultimaVisita) : 'nunca'}
                      </p>
                    </div>
                    {s.proxima ? (
                      <Link to={`/jornadas/${s.proxima.id}`} className="text-sm text-tenue hover:text-tinta">
                        Planificada: <span className="font-medium text-tinta">{diaJornada(s.proxima.fecha)}</span>
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-tenue">Sugerida: {diaJornada(s.sugerida)}</span>
                        {puedePlanificar && (
                          <Boton variante="secundario" className="h-8 px-3 text-xs" onClick={() => navegar(`/jornadas/nueva?batey=${s.communityId}&fecha=${s.sugerida.slice(0, 10)}`)}>
                            Planificar
                          </Boton>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        </div>

        <Calendario puedePlanificar={puedePlanificar} />
      </div>
    </>
  );
}

function FechaCaja({ iso }: { iso: string }) {
  const d = new Date(iso);
  return (
    <div className="grid w-12 shrink-0 place-items-center rounded-lg border border-borde bg-marca-50 py-1 leading-tight">
      <span className="text-[10px] text-tenue uppercase">{new Intl.DateTimeFormat('es-DO', { timeZone: 'UTC', month: 'short' }).format(d)}</span>
      <span className="text-lg font-semibold">{d.getUTCDate()}</span>
    </div>
  );
}

function Calendario({ puedePlanificar }: { puedePlanificar: boolean }) {
  const [params, setParams] = useSearchParams();
  const navegar = useNavigate();
  const ahora = new Date();
  const [anio, mes] = (params.get('mes') ?? `${ahora.getFullYear()}-${ahora.getMonth() + 1}`).split('-').map(Number);
  const primero = new Date(anio, mes - 1, 1);
  const ultimo = new Date(anio, mes, 0);
  const consulta = useJornadas({ desde: ymd(primero), hasta: ymd(ultimo) });
  const hoy = hoyYmd();

  const cambiarMes = (delta: number) => {
    const d = new Date(anio, mes - 1 + delta, 1);
    setParams((p) => (p.set('mes', `${d.getFullYear()}-${d.getMonth() + 1}`), p), { replace: true });
  };

  const celdas = useMemo(() => {
    const inicio = (primero.getDay() + 6) % 7; // semana desde el lunes
    const dias: (Date | null)[] = Array.from({ length: inicio }, () => null);
    for (let d = 1; d <= ultimo.getDate(); d++) dias.push(new Date(anio, mes - 1, d));
    while (dias.length % 7) dias.push(null);
    return dias;
  }, [anio, mes]); // eslint-disable-line react-hooks/exhaustive-deps

  const porDia = new Map<string, Jornada[]>();
  for (const j of consulta.data ?? []) porDia.set(j.fecha.slice(0, 10), [...(porDia.get(j.fecha.slice(0, 10)) ?? []), j]);

  return (
    <Tarjeta
      titulo={fmtMes.format(primero).replace(/^./, (c) => c.toUpperCase())}
      accion={
        <div className="flex items-center gap-1">
          <Boton variante="fantasma" className="h-8 px-2" onClick={() => cambiarMes(-1)} aria-label="Mes anterior">
            <ChevronLeft className="size-4" />
          </Boton>
          <Boton variante="fantasma" className="h-8 px-2 text-xs" onClick={() => setParams((p) => (p.delete('mes'), p), { replace: true })}>
            Hoy
          </Boton>
          <Boton variante="fantasma" className="h-8 px-2" onClick={() => cambiarMes(1)} aria-label="Mes siguiente">
            <ChevronRight className="size-4" />
          </Boton>
        </div>
      }
    >
      <div className="grid grid-cols-7 border-b border-borde text-center text-[11px] text-tenue uppercase">
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {celdas.map((d, i) => {
          if (!d) return <div key={i} className="min-h-20 border-r border-b border-borde bg-fondo/50 [&:nth-child(7n)]:border-r-0" />;
          const clave = ymd(d);
          const js = porDia.get(clave) ?? [];
          const futuro = clave >= hoy;
          return (
            <div
              key={i}
              onClick={() => puedePlanificar && futuro && !js.length && navegar(`/jornadas/nueva?fecha=${clave}`)}
              className={cn(
                'group min-h-20 border-r border-b border-borde p-1.5 [&:nth-child(7n)]:border-r-0',
                puedePlanificar && futuro && !js.length && 'cursor-pointer hover:bg-marca-50',
              )}
            >
              <span className={cn('inline-grid size-6 place-items-center rounded-full text-xs', clave === hoy ? 'bg-tinta font-semibold text-white' : 'text-tenue')}>{d.getDate()}</span>
              <div className="mt-1 space-y-1">
                {js.map((j) => (
                  <Link
                    key={j.id}
                    to={`/jornadas/${j.id}`}
                    onClick={(e) => e.stopPropagation()}
                    title={`${j.community.name} · ${ESTADOS[j.estado].texto}`}
                    className={cn('block truncate rounded px-1.5 py-0.5 text-[11px] font-medium', j.estado === 'CANCELADA' && 'line-through')}
                    style={{ backgroundColor: `${ESTADOS[j.estado].color}1f`, color: ESTADOS[j.estado].color }}
                  >
                    {j.community.name}
                  </Link>
                ))}
                {puedePlanificar && futuro && !js.length && <span className="hidden text-[11px] text-tenue group-hover:block">+ Planificar</span>}
              </div>
            </div>
          );
        })}
      </div>
      {!!consulta.data?.length && (
        <ul className="divide-y divide-borde border-t border-borde text-sm">
          {consulta.data.map((j) => (
            <li key={j.id}>
              <Link to={`/jornadas/${j.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-fondo">
                <span className="w-36 shrink-0 text-tenue">{diaJornada(j.fecha)}</span>
                <span className="flex-1 font-medium">{j.community.name}</span>
                {j.resumen && (
                  <span className="tabular text-xs text-tenue">
                    {j.resumen.atendidos} atendidos · {j.resumen.faltan} faltaron
                  </span>
                )}
                <Insignia color={ESTADOS[j.estado].color}>{ESTADOS[j.estado].texto}</Insignia>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

/* ───────────── Formulario: /jornadas/nueva y /jornadas/:id/editar ───────────── */

export function JornadaEditor() {
  const id = Number(useParams().id) || undefined;
  const detalle = useDetalleJornada(id);
  const comunidades = useComunidades();
  const responsables = useResponsables();
  // Los selectores se montan con sus opciones ya cargadas, para que muestren el valor correcto.
  if ((id && detalle.isPending) || comunidades.isPending || responsables.isPending) return <Cargando />;
  if (id && !detalle.data) return <Vacio titulo="Jornada no encontrada" />;
  const j = detalle.data?.jornada;
  if (j && j.estado !== 'PLANIFICADA') {
    return (
      <Vacio icono={<Lock className="size-8" />} titulo="Esta jornada ya no se puede editar">
        Solo se editan las jornadas planificadas.
      </Vacio>
    );
  }
  return <FormularioJornada jornada={j} />;
}

type DatosForm = { communityId: string; fecha: string; responsableId: string; notas: string };

function FormularioJornada({ jornada }: { jornada?: Jornada }) {
  const [params] = useSearchParams();
  const navegar = useNavigate();
  const cliente = useQueryClient();
  const comunidades = useComunidades();
  const responsables = useResponsables();
  const { usuario } = useSesion();
  const { register, handleSubmit, formState, control } = useForm<DatosForm>({
    defaultValues: jornada
      ? { communityId: String(jornada.communityId), fecha: jornada.fecha.slice(0, 10), responsableId: jornada.responsableId ? String(jornada.responsableId) : '', notas: jornada.notas ?? '' }
      : { communityId: params.get('batey') ?? '', fecha: params.get('fecha') ?? '', responsableId: usuario ? String(usuario.id) : '', notas: '' },
  });
  const guardar = useMutation({
    mutationFn: (d: DatosForm) => {
      const datos = { fecha: d.fecha, responsableId: d.responsableId ? Number(d.responsableId) : null, notas: d.notas.trim() };
      return jornada ? editarJornada(jornada.id, datos) : crearJornada({ ...datos, communityId: Number(d.communityId) });
    },
    onSuccess: (j) => {
      invalidar(cliente);
      toast.success(jornada ? 'Jornada actualizada' : `Jornada planificada en ${j.community.name}`);
      navegar(`/jornadas/${j.id}`, { replace: true });
    },
    onError: (e) => toast.error(e.message),
  });
  const e = formState.errors;

  return (
    <>
      <EncabezadoPagina
        titulo={jornada ? `Editar jornada · ${jornada.community.name}` : 'Planificar jornada'}
        volver={jornada ? { a: `/jornadas/${jornada.id}`, texto: 'Jornada' } : { a: '/jornadas', texto: 'Jornadas' }}
      />
      <form onSubmit={handleSubmit((d) => guardar.mutate(d))} className="max-w-2xl space-y-4">
        <Tarjeta titulo="Jornada">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Campo etiqueta="Batey" error={e.communityId && 'Elige el batey'} className="sm:col-span-2" ayuda={jornada ? 'El batey no se cambia: cancela y planifica otra.' : undefined}>
              <Selector
                vacio="Elegir batey…"
                disabled={!!jornada}
                {...register('communityId', { required: true })}
                opciones={(comunidades.data ?? []).filter((c) => c.isActive || c.id === jornada?.communityId).map((c) => ({ value: c.id, label: c.name }))}
              />
            </Campo>
            <Campo etiqueta="Fecha" error={e.fecha && 'Elige la fecha'}>
              <Controller
                control={control}
                name="fecha"
                rules={{ required: true }}
                render={({ field }) => <SelectorFecha min={jornada ? undefined : hoyYmd()} value={field.value} onChange={field.onChange} aria-invalid={!!e.fecha} aria-label="Fecha de la jornada" />}
              />
            </Campo>
            <Campo etiqueta="Responsable">
              <Selector vacio="Sin asignar" {...register('responsableId')} opciones={(responsables.data ?? []).map((u) => ({ value: u.id, label: nombreCompleto(u) }))} />
            </Campo>
            <Campo etiqueta="Notas" className="sm:col-span-2" ayuda="Transporte, punto de encuentro, quiénes van…">
              <AreaTexto rows={3} {...register('notas')} />
            </Campo>
          </div>
          <p className="border-t border-borde px-5 py-3 text-sm text-tenue">Si la jornada dura varios días, planifica un día por cada uno.</p>
        </Tarjeta>
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={() => navegar(-1)}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={guardar.isPending}>
            {jornada ? 'Guardar' : 'Planificar'}
          </Boton>
        </div>
      </form>
    </>
  );
}

/* ───────────── Detalle: /jornadas/:id ───────────── */

export function JornadaDetalle() {
  const id = Number(useParams().id);
  const consulta = useDetalleJornada(id);
  if (consulta.isPending) return <Cargando />;
  if (consulta.isError) return <ErrorCarga error={consulta.error} />;
  return <Detalle d={consulta.data} />;
}

function Detalle({ d }: { d: DetalleJornada }) {
  const j = d.jornada;
  // Cuántos se esperan en las jornadas de este batey (media alta de las últimas jornadas): para saber cuánto llevar.
  const suelen = useAsistenciaJornadas().data?.find((x) => x.communityId === j.communityId);
  const navegar = useNavigate();
  const cliente = useQueryClient();
  const confirmar = useConfirmar();
  const { tiene } = useSesion();
  const [vista, setVista] = useState<'faltan' | 'atendidos' | 'todos'>(j.estado === 'PLANIFICADA' ? 'faltan' : 'atendidos');
  const planificada = j.estado === 'PLANIFICADA';
  const hoy = hoyYmd();
  const diaJ = j.fecha.slice(0, 10);
  const r = j.estado === 'CERRADA' && j.resumen ? j.resumen : d.totales;
  const entregadas = j.estado === 'CERRADA' && j.resumen?.entregadas ? j.resumen.entregadas : d.entregadas;

  const accion = useMutation({
    mutationFn: (a: 'cerrar' | 'cancelar') => (a === 'cerrar' ? cerrarJornada(j.id) : cancelarJornada(j.id)),
    onSuccess: (_, a) => {
      invalidar(cliente);
      toast.success(a === 'cerrar' ? 'Jornada cerrada. El resumen quedó guardado.' : 'Jornada cancelada');
    },
    onError: (e) => toast.error(e.message),
  });

  const cerrar = async () => {
    const ok = await confirmar({
      titulo: 'Cerrar la jornada',
      mensaje: (
        <>
          Se guardará el resumen: <strong>{d.totales.atendidos}</strong> atendidos y <strong>{d.totales.faltan}</strong> esperados que no vinieron. Después no se puede reabrir (las
          visitas se siguen pudiendo registrar).
        </>
      ),
      confirmar: 'Cerrar jornada',
      peligro: false,
    });
    if (ok) accion.mutate('cerrar');
  };
  const cancelar = async () => {
    if (await confirmar({ titulo: 'Cancelar la jornada', mensaje: `La jornada de ${j.community.name} del ${diaJornada(j.fecha)} quedará cancelada.`, confirmar: 'Cancelar jornada' })) accion.mutate('cancelar');
  };

  // Filtros de la lista: texto, quién lo atendió ese día, cómo está la presión y si es nuevo.
  const [buscar, setBuscar] = useState('');
  const [medico, setMedico] = useState('');
  const [presion, setPresion] = useState('');
  const [soloNuevos, setSoloNuevos] = useState(false);
  const elegirMedico = (m: string) => {
    setMedico(m);
    if (m) setVista('atendidos');
    document.getElementById('pacientes-jornada')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const q = buscar.trim().toLowerCase();
  const enVista = d.pacientes.filter((p) => (vista === 'faltan' ? p.esperado && !p.atendidoHoy : vista === 'atendidos' ? p.atendidoHoy : true));
  const pacientes = enVista.filter((p) => {
    if (q && !coincide(q, p)) return false;
    if (medico && !(p.atendidoHoy && p.atendio === medico)) return false;
    if (soloNuevos && !p.nuevo) return false;
    const c = p.categoria?.categoryName;
    if (presion === 'controlados' && !(c === 'NORMAL' || c === 'ELEVATED')) return false;
    if (presion === 'noControlados' && !(c === 'GRADE_1' || c === 'GRADE_2' || c === 'CRISIS')) return false;
    if (presion === 'sinToma' && c) return false;
    if (presion && !['controlados', 'noControlados', 'sinToma'].includes(presion) && c !== presion) return false;
    return true;
  });
  const hayFiltros = !!(q || medico || presion || soloNuevos);
  const limpiar = () => {
    setBuscar('');
    setMedico('');
    setPresion('');
    setSoloNuevos(false);
  };
  const medicos = d.porMedico ?? [];
  const faltaAlgo = d.llevar.some((m) => m.falta > 0);

  return (
    <>
      <EncabezadoPagina
        titulo={`${j.community.name}`}
        descripcion={
          <span className="flex flex-wrap items-center gap-2">
            <span>{diaJornada(j.fecha, true)}</span>
            <Insignia color={ESTADOS[j.estado].color}>{ESTADOS[j.estado].texto}</Insignia>
            {diaJ === hoy && planificada && <Insignia color="#15803d">Hoy</Insignia>}
            <span>· {j.responsable ? `Responsable: ${nombreCompleto(j.responsable)}` : 'Sin responsable'}</span>
          </span>
        }
        volver={{ a: '/jornadas', texto: 'Jornadas' }}
        acciones={
          <>
            {j.estado !== 'CANCELADA' && tiene('visitas.registrar') && (
              <Boton variante="secundario" icono={<Mail className="size-4" />} onClick={() => navegar(`/jornadas/${j.id}/enviar-resumen`)}>
                Enviar resumen
              </Boton>
            )}
            {planificada && tiene('entregas.registrar') && (
              <Boton variante="secundario" icono={<Printer className="size-4" />} onClick={() => navegar(`/jornadas/${j.id}/preparacion`)}>
                Hoja de preparación
              </Boton>
            )}
            {planificada && (
            <>
              {tiene('jornadas.planificar') && (
                <>
                  <Boton variante="secundario" icono={<XCircle className="size-4" />} className="hover:text-red-600" onClick={cancelar} disabled={accion.isPending}>
                    Cancelar
                  </Boton>
                  <Boton variante="secundario" icono={<Pencil className="size-4" />} onClick={() => navegar(`/jornadas/${j.id}/editar`)}>
                    Editar
                  </Boton>
                </>
              )}
              {tiene('visitas.registrar') && (
                <>
                  <Boton variante="secundario" icono={<CheckCircle2 className="size-4" />} onClick={cerrar} cargando={accion.isPending} disabled={diaJ > hoy} title={diaJ > hoy ? 'Se cierra el día de la jornada o después' : undefined}>
                    Cerrar jornada
                  </Boton>
                  <Boton icono={<ClipboardList className="size-4" />} onClick={() => navegar(`/jornada?batey=${j.communityId}`)}>
                    Abrir registro
                  </Boton>
                </>
              )}
            </>
            )}
          </>
        }
      />

      {j.notas && <p className="mb-4 rounded-lg bg-marca-50 px-4 py-2.5 text-sm whitespace-pre-line">{j.notas}</p>}
      {j.estado === 'CERRADA' && (
        <p className="mb-4 text-sm text-tenue">
          Cerrada por {j.cerradaPor ?? '—'} el {fechaYHora(j.cerradaEn)}. Las cifras son las del cierre.
        </p>
      )}

      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-5">
        {[
          // Esperados: media alta de las últimas jornadas del batey (ver Configuración); nunca vienen todos los regulares.
          { t: 'Esperados', v: suelen?.promedio ?? r.esperados, ayuda: suelen ? `media alta de las últimas ${suelen.jornadas.length} · ${r.esperados} regulares` : `de ${r.activos} regulares` },
          { t: 'Atendidos', v: r.atendidos, ayuda: r.atendidos - r.atendidosEsperados > 0 ? `${r.atendidos - r.atendidosEsperados} fuera de lista` : undefined },
          { t: planificada ? 'Faltan por ver' : 'No vinieron', v: r.faltan, color: r.faltan ? 'text-red-600' : '', ayuda: r.noVinieron ? `${r.noVinieron} marcados "No vino"` : undefined },
          { t: 'Controlados', v: r.controlados, ayuda: r.atendidos ? `${Math.round((r.controlados / r.atendidos) * 100)}% de los atendidos` : undefined },
          { t: 'Pacientes nuevos', v: r.nuevos },
        ].map((k) => (
          <div key={k.t} className="rounded-xl border border-borde bg-superficie p-4">
            <p className="text-xs text-tenue">{k.t}</p>
            <p className={cn('tabular mt-1 text-2xl font-semibold', k.color)}>{miles(k.v)}</p>
            {k.ayuda && <p className="text-xs text-tenue">{k.ayuda}</p>}
          </div>
        ))}
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        {planificada && (
          <Tarjeta
            titulo="Qué llevar"
            accion={<span className="text-right text-xs text-tenue">Según la última receta de quienes faltan</span>}
          >
            {!d.llevar.length ? (
              <Vacio icono={<Package className="size-8" />} titulo="Nada que llevar">
                Nadie de los que faltan tiene una receta anterior.
              </Vacio>
            ) : (
              <>
                {faltaAlgo && (
                  <p className="flex items-center gap-2 border-b border-borde bg-red-50 px-5 py-2.5 text-sm text-red-700">
                    <AlertTriangle className="size-4" /> No alcanza la existencia vigente para esa fecha.
                    {tiene('inventario.gestionar') && (
                      <Link to="/medicamentos/entrada" className="ml-auto font-medium underline">
                        Registrar entrada
                      </Link>
                    )}
                  </p>
                )}
                <Tabla columnas={['Medicamento', { texto: 'Pacientes', className: 'text-right' }, { texto: 'Llevar', className: 'text-right' }, { texto: 'Disponible', className: 'text-right' }, { texto: 'Falta', className: 'text-right' }]}>
                  {d.llevar.map((m) => (
                    <tr key={m.medicationId} className={cn(m.falta > 0 && 'bg-red-50/60')}>
                      <td className="px-5 py-2.5">
                        {tiene('inventario.gestionar') ? (
                          <Link to={`/medicamentos/${m.medicationId}`} className="hover:underline">
                            {m.medicamento}
                          </Link>
                        ) : (
                          m.medicamento
                        )}
                      </td>
                      <td className="tabular px-5 py-2.5 text-right">{m.pacientes}</td>
                      <td className="tabular px-5 py-2.5 text-right font-medium">{miles(m.pastillas)}</td>
                      <td className="tabular px-5 py-2.5 text-right text-tenue">{miles(m.disponible)}</td>
                      <td className={cn('tabular px-5 py-2.5 text-right font-medium', m.falta > 0 ? 'text-red-600' : 'text-green-700')}>{m.falta > 0 ? miles(m.falta) : 'OK'}</td>
                    </tr>
                  ))}
                </Tabla>
              </>
            )}
          </Tarjeta>
        )}
        <Tarjeta titulo="Pastillas entregadas">
          {!entregadas.length ? (
            <Vacio titulo="Aún no se ha entregado nada" />
          ) : (
            <Tabla columnas={['Medicamento', { texto: 'Pastillas', className: 'text-right' }]}>
              {entregadas.map((m) => (
                <tr key={m.medicamento}>
                  <td className="px-5 py-2.5">{m.medicamento}</td>
                  <td className="tabular px-5 py-2.5 text-right font-medium">{miles(m.pastillas)}</td>
                </tr>
              ))}
              <tr className="border-t border-borde font-semibold">
                <td className="px-5 py-2.5">Total</td>
                <td className="tabular px-5 py-2.5 text-right">{miles(entregadas.reduce((a, m) => a + m.pastillas, 0))}</td>
              </tr>
            </Tabla>
          )}
        </Tarjeta>
        {medicos.length > 0 && (
          <Tarjeta
            titulo={<span className="flex items-center gap-2"><Stethoscope className="size-4" /> Por médico</span>}
            accion={<span className="text-xs text-tenue">Toca un médico para ver sus pacientes</span>}
          >
            <Tabla
              columnas={[
                'Médico',
                { texto: 'Ya venían', className: 'text-right' },
                { texto: 'Nuevos', className: 'text-right' },
                { texto: 'Total', className: 'text-right' },
                { texto: 'Pastillas', className: 'text-right' },
                { texto: 'Controlados', className: 'text-right' },
              ]}
            >
              {medicos.map((m) => {
                const pct = m.conToma ? Math.round((m.controlados / m.conToma) * 100) : null;
                return (
                  <tr key={m.medico} onClick={() => elegirMedico(medico === m.medico ? '' : m.medico)} className={cn('cursor-pointer hover:bg-fondo', medico === m.medico && 'bg-marca-50')}>
                    <td className="px-5 py-2.5 font-medium whitespace-nowrap">{m.medico}</td>
                    <td className="tabular px-5 py-2.5 text-right text-tenue">{miles(m.pacientes - m.nuevos)}</td>
                    <td className="tabular px-5 py-2.5 text-right text-tenue">{miles(m.nuevos)}</td>
                    <td className="tabular px-5 py-2.5 text-right font-medium">{miles(m.pacientes)}</td>
                    <td className="tabular px-5 py-2.5 text-right">{miles(m.pastillas)}</td>
                    <td className="tabular px-5 py-2.5 text-right whitespace-nowrap">
                      {miles(m.controlados)}
                      {pct !== null && <span className={cn('ml-1.5 text-xs', pct >= 60 ? 'text-green-700' : pct >= 40 ? 'text-amber-700' : 'text-red-600')}>{pct}%</span>}
                    </td>
                  </tr>
                );
              })}
              {medicos.length > 1 && (
                <tr className="border-t border-borde font-semibold">
                  <td className="px-5 py-2.5">Total</td>
                  <td className="tabular px-5 py-2.5 text-right">{miles(medicos.reduce((a, m) => a + m.pacientes - m.nuevos, 0))}</td>
                  <td className="tabular px-5 py-2.5 text-right">{miles(medicos.reduce((a, m) => a + m.nuevos, 0))}</td>
                  <td className="tabular px-5 py-2.5 text-right">{miles(medicos.reduce((a, m) => a + m.pacientes, 0))}</td>
                  <td className="tabular px-5 py-2.5 text-right">{miles(medicos.reduce((a, m) => a + m.pastillas, 0))}</td>
                  <td className="tabular px-5 py-2.5 text-right whitespace-nowrap">
                    {miles(medicos.reduce((a, m) => a + m.controlados, 0))}
                    {(() => {
                      const conToma = medicos.reduce((a, m) => a + m.conToma, 0);
                      return conToma ? <span className="ml-1.5 text-xs font-normal text-tenue">{Math.round((medicos.reduce((a, m) => a + m.controlados, 0) / conToma) * 100)}%</span> : null;
                    })()}
                  </td>
                </tr>
              )}
            </Tabla>
            <p className="border-t border-borde px-5 py-2.5 text-xs text-tenue">Total = los que ya venían más los nuevos. El % de controlados es sobre los pacientes a los que se les tomó la presión ese día: por debajo de 140/90 (Normal o Elevada).</p>
          </Tarjeta>
        )}
        {j.estado === 'CERRADA' && (
          <Tarjeta titulo={`No vinieron (${j.resumen?.faltantes?.length ?? 0})`}>
            {!j.resumen?.faltantes?.length ? (
              <Vacio titulo="Vinieron todos los esperados" />
            ) : (
              <ul className="max-h-96 divide-y divide-borde overflow-y-auto text-sm">
                {j.resumen.faltantes.map((p) => (
                  <li key={p.id}>
                    <Link to={`/pacientes/${p.id}`} className="flex gap-3 px-5 py-2.5 hover:bg-fondo">
                      <span className="w-20 font-mono text-xs text-tenue">{p.codigo}</span>
                      <span className="flex-1">{p.nombre}</span>
                      {p.motivo && <span className="text-xs text-tenue">{MOTIVOS_INASISTENCIA[p.motivo]}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        )}
      </div>

      {j.estado !== 'CANCELADA' && (
        <Tarjeta
          titulo={<span id="pacientes-jornada" className="scroll-mt-4">Pacientes</span>}
          accion={
            <div className="flex gap-1">
              {(
                [
                  ['faltan', planificada ? 'Faltan' : 'No vinieron', d.totales.faltan],
                  ['atendidos', 'Atendidos', d.totales.atendidos],
                  ['todos', 'Todos', d.pacientes.length],
                ] as const
              ).map(([v, t, n]) => (
                <button
                  key={v}
                  onClick={() => setVista(v)}
                  className={cn('rounded-full border px-3 py-1 text-xs', vista === v ? 'border-tinta bg-marca-500 font-medium' : 'border-borde text-tenue hover:text-tinta')}
                >
                  {t} ({n})
                </button>
              ))}
            </div>
          }
        >
          <div className="flex flex-wrap items-center gap-2 border-b border-borde px-5 py-3">
            <div className="relative min-w-48 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-tenue" />
              <Entrada placeholder="Buscar nombre, código o casa" aria-label="Buscar paciente" className="pl-8" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
            </div>
            {medicos.length > 0 && (
              <Selector
                className="w-52"
                aria-label="Lo atendió"
                vacio="Cualquier médico"
                value={medico}
                onChange={(e) => elegirMedico(e.target.value)}
                opciones={medicos.map((m) => ({ value: m.medico, label: `${m.medico} (${m.pacientes})` }))}
              />
            )}
            <Selector
              className="w-52"
              aria-label="Presión"
              vacio="Cualquier presión"
              value={presion}
              onChange={(e) => setPresion(e.target.value)}
              opciones={[
                { value: 'controlados', label: 'Controlados (< 140/90)' },
                { value: 'noControlados', label: 'No controlados (≥ 140/90)' },
                ...(['NORMAL', 'ELEVATED', 'GRADE_1', 'GRADE_2', 'CRISIS'] as const).map((c) => ({ value: c, label: CATEGORIAS[c] })),
                { value: 'sinToma', label: 'Sin toma' },
              ]}
            />
            {d.pacientes.some((p) => p.nuevo) && (
              <button
                type="button"
                onClick={() => setSoloNuevos((v) => !v)}
                className={cn('h-10 rounded-lg border px-3 text-sm', soloNuevos ? 'border-tinta bg-marca-500 font-medium' : 'border-borde text-tenue hover:text-tinta')}
              >
                Solo nuevos
              </button>
            )}
            {hayFiltros && (
              <Boton variante="fantasma" icono={<X className="size-4" />} onClick={limpiar}>
                Limpiar
              </Boton>
            )}
            {hayFiltros && (
              <span className="w-full text-xs text-tenue">
                {pacientes.length} de {enVista.length}
              </span>
            )}
          </div>
          {!pacientes.length ? (
            <Vacio icono={<MapPin className="size-8" />} titulo={hayFiltros ? 'Nadie coincide con los filtros' : 'Nadie en esta lista'} />
          ) : (
            <Tabla columnas={['Paciente', 'Edad', 'Casa', 'Última visita', 'PA', 'Atendió', { texto: 'Pastillas', className: 'text-right' }, 'Estado']}>
              {pacientes.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => navegar(`/pacientes/${p.id}?volver=${encodeURIComponent(`/jornadas/${j.id}`)}`)}
                  className="cursor-pointer hover:bg-fondo"
                >
                  <td className="px-5 py-2.5">
                    <span className="font-medium whitespace-nowrap">{nombreCompleto(p)}</span>
                    <span className="block font-mono text-xs text-tenue">{p.patientCode}</span>
                  </td>
                  <td className="px-5 py-2.5 whitespace-nowrap">{edadTexto(p)}</td>
                  <td className="px-5 py-2.5 text-tenue">{p.address ?? '—'}</td>
                  <td className="px-5 py-2.5 whitespace-nowrap">{fecha(p.ultimaVisita)}</td>
                  <td className="px-5 py-2.5 whitespace-nowrap">
                    <span className="tabular mr-2 font-mono">{p.presion ?? '—'}</span>
                    {p.categoria && <InsigniaCategoria config={p.categoria} />}
                  </td>
                  <td className="px-5 py-2.5 whitespace-nowrap">
                    {p.atendidoHoy ? (
                      p.atendio ?? '—'
                    ) : p.atendio ? (
                      <span className="text-xs text-tenue" title="Quién lo vio la última vez">
                        La última vez: {p.atendio}
                      </span>
                    ) : (
                      <span className="text-tenue">—</span>
                    )}
                  </td>
                  <td className="tabular px-5 py-2.5 text-right">{p.pastillasHoy ? miles(p.pastillasHoy) : <span className="text-tenue">—</span>}</td>
                  <td className="px-5 py-2.5">
                    {p.atendidoHoy ? (
                      <Insignia color="#15803d">{p.nuevo ? 'Atendido · nuevo' : 'Atendido'}</Insignia>
                    ) : p.noVino ? (
                      <Insignia color="#6b665e">
                        No vino · {MOTIVOS_INASISTENCIA[p.noVino].toLowerCase()}
                        {p.tratamientoDejado && ` · tratamiento dejado con ${conQuien(p.tratamientoDejado.con, p.tratamientoDejado.parentesco)}`}
                      </Insignia>
                    ) : (
                      <Insignia color={planificada ? '#b45309' : '#6b665e'}>{planificada ? 'Por ver' : 'No vino'}</Insignia>
                    )}
                  </td>
                </tr>
              ))}
            </Tabla>
          )}
        </Tarjeta>
      )}
    </>
  );
}
