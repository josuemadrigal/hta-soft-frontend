import { CheckCircle2, ClipboardPlus, CloudDownload, MapPin, Pill, Search, UserPlus, UserX } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router';
import { useAsistenciaJornadas, useComunidades, useConfiguracion, useJornada, useJornadas, useResponsables } from '../api/consultas';
import { hoyYmd } from './Jornadas';
import { marcarNoVino, quitarNoVino, type DatosNoVino } from '../api/recursos';
import type { Inasistencia, MotivoInasistencia, PacienteJornada } from '../api/tipos';
import { conQuien, MOTIVOS_INASISTENCIA } from '../lib/etiquetas';
import { DejarTratamiento } from '../components/DejarTratamiento';
import { useSesion } from '../auth/sesion';
import { agregarPendiente, descartarPendiente, esFaltaDeConexion, nuevoId, usePendientes } from '../offline/cola';
import { descargarJornada, jornadasDescargadas, useEnLinea } from '../offline/datos';
import { Avatar, Boton, Cargando, EncabezadoPagina, Entrada, ErrorCarga, Insignia, InsigniaCategoria, Selector, Tarjeta, Vacio } from '../components/ui';
import { asistencia } from '../lib/asistencia';
import { mensajeEntrega } from '../lib/entregas';
import { cn, edad, edadTexto, fecha, fechaYHora, nombreCompleto, tensionDe } from '../lib/formato';
import { ymd } from '../components/SelectorFecha';
import { corteRegulares, esRegular, VISITAS_SIN_VENIR_REGULAR } from '../lib/regulares';
import { coincide, grupoDe, puntaje } from '../lib/busqueda';

type Estado = 'hoy' | 'ronda' | 'tratamiento' | 'pendiente' | 'sinVenir' | 'nuevo' | 'noVino' | 'yaNoViene';

/** Asistencia (lib/asistencia.ts): "Pendiente" aún no viene en esta ronda; "No asiste desde…" lleva más de 6 meses sin venir. */
const ESTADOS: Record<Estado, { texto: string; color?: string; orden: number }> = {
  pendiente: { texto: 'Pendiente', color: '#a16207', orden: 0 },
  sinVenir: { texto: 'No asiste', color: '#9a3412', orden: 1 },
  nuevo: { texto: 'Sin visitas', color: '#6b665e', orden: 2 },
  hoy: { texto: 'Visto hoy', color: '#15803d', orden: 3 },
  ronda: { texto: 'Visto en la ronda', color: '#7a5c00', orden: 4 },
  // No vino a consulta, pero se le dejó el tratamiento en esta ronda: cuenta como atendido.
  tratamiento: { texto: 'Tratamiento dejado', color: '#7a5c00', orden: 4 },
  noVino: { texto: 'No vino', color: '#6b665e', orden: 5 },
  // Se perdió más visitas de las que se aceptan (Configuración): no cuenta como "por ver".
  yaNoViene: { texto: 'Ya no viene', color: '#6b665e', orden: 6 },
};

const FILTROS = [
  { valor: 'pendientes', texto: 'Por ver' },
  { valor: 'hoy', texto: 'Vistos' },
  { valor: 'novino', texto: 'No vinieron' },
  { valor: 'todos', texto: 'Todos' },
] as const;

/** Vistos: hoy, o en una ronda (trimestre) de este año. */
type Cuando = 'hoy' | 1 | 2 | 3 | 4;
const trimestreDe = (ymd: string) => Math.floor((Number(ymd.slice(5, 7)) - 1) / 3) + 1;

const PRESIONES = [
  { value: 'controlados', label: 'Controlados (< 140/90)' },
  { value: 'noControlados', label: 'No controlados (≥ 140/90)' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'ELEVATED', label: 'Elevada' },
  { value: 'GRADE_1', label: 'HTA grado 1' },
  { value: 'GRADE_2', label: 'HTA grado 2' },
  { value: 'CRISIS', label: 'Crisis hipertensiva' },
  { value: 'sinToma', label: 'Sin toma' },
];
const EDADES = [
  { value: '0-39', label: 'Menos de 40' },
  { value: '40-59', label: '40 a 59' },
  { value: '60-74', label: '60 a 74' },
  { value: '75-200', label: '75 o más' },
];

function inicioRonda() {
  const h = new Date();
  return new Date(h.getFullYear(), Math.floor(h.getMonth() / 3) * 3, 1);
}

/** Pendientes en este dispositivo (sin enviar): visitas y "No vino" de hoy. */
type Locales = { visitas: Set<number>; noVino: Map<number, MotivoInasistencia>; tratamiento: Map<number, NonNullable<DatosNoVino['tratamiento']>> };

/** "No vino · estaba trabajando · tratamiento dejado con Rosa (hijo/a)" */
function textoNoVino(p: PacienteJornada, locales: Locales) {
  const marca = p.inasistencias?.find((i) => i.fecha.slice(0, 10) === hoyYmd());
  const motivo = locales.noVino.get(p.id) ?? marca?.motivo ?? 'NO_ESTABA';
  const local = locales.tratamiento.get(p.id);
  const t = local ? { recibioNombre: local.recibioNombre, recibioParentesco: local.recibioParentesco } : marca?.entrega;
  return `No vino · ${MOTIVOS_INASISTENCIA[motivo].toLowerCase()}${t ? ` · tratamiento dejado con ${conQuien(t.recibioNombre, t.recibioParentesco)}` : ''}`;
}

function estadoDe(p: PacienteJornada, ronda: Date, hoy: Date, locales: Locales, corte: Date): Estado {
  if (locales.visitas.has(p.id)) return 'hoy';
  const u = p.clinicalVisits[0];
  if (!(u && new Date(u.visitDate) >= hoy) && (locales.noVino.has(p.id) || p.inasistencias?.some((i) => i.fecha.slice(0, 10) === hoyYmd()))) return 'noVino';
  if (!esRegular(u?.visitDate, p.registrationDate, corte)) return 'yaNoViene';
  if (!u) return p.tratamientoRonda ? 'tratamiento' : 'nuevo';
  const visita = new Date(u.visitDate);
  if (visita >= hoy) return 'hoy';
  if (visita >= ronda) return 'ronda';
  if (p.tratamientoRonda) return 'tratamiento';
  return asistencia(u.visitDate).clave === 'sin-venir' ? 'sinVenir' : 'pendiente';
}

const FECHA_CORTA = new Intl.DateTimeFormat('es-DO', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fechaCorta = (ymd: string) => FECHA_CORTA.format(new Date(`${ymd}T00:00:00Z`));

const CLAVE_BATEY = 'hta:ultimoBatey';
const leerUltimoBatey = () => {
  try {
    return localStorage.getItem(CLAVE_BATEY);
  } catch {
    return null;
  }
};
const guardarUltimoBatey = (id: string) => {
  try {
    localStorage.setItem(CLAVE_BATEY, id);
  } catch {
    /* sin almacenamiento: no se recuerda */
  }
};

export function Jornada() {
  const [params, setParams] = useSearchParams();
  const idPedido = Number(params.get('batey')) || undefined;
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]['valor']>('pendientes');
  const [medico, setMedico] = useState<number | ''>('');
  const [cuando, setCuando] = useState<Cuando>('hoy');
  const [presion, setPresion] = useState('');
  const [sexo, setSexo] = useState('');
  const [rangoEdad, setRangoEdad] = useState('');
  const navegar = useNavigate();

  const comunidades = useComunidades();
  // Un enlace viejo puede traer un batey que ya no existe: se trata como sin elegir.
  const comunidadId = comunidades.data?.some((c) => c.id === idPedido) ? idPedido : undefined;
  const lista = useJornada(comunidadId);
  const configuracion = useConfiguracion();
  const asistenciaJ = useAsistenciaJornadas();
  const usuariosActivos = useResponsables();
  const visitasSinVenir = configuracion.data?.visitasSinVenirRegular ?? VISITAS_SIN_VENIR_REGULAR;
  const hoyPlan = useJornadas({ desde: hoyYmd(), hasta: hoyYmd(), estado: 'PLANIFICADA' });
  // Jornadas de hoy y de mañana: esos bateyes se descargan solos para trabajar sin señal.
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  const pronto = useJornadas({ desde: hoyYmd(), hasta: ymd(manana), estado: 'PLANIFICADA' });
  const planHoy = hoyPlan.data?.find((j) => j.communityId === comunidadId);

  // Al entrar sin batey elegido se pone solo el de la jornada de hoy (una sola vez: si después lo
  // cambian o lo quitan, se respeta). Sin internet, el último batey usado en este dispositivo.
  const autoElegido = useRef(false);
  const [elegidoSolo, setElegidoSolo] = useState(false);
  useEffect(() => {
    if (autoElegido.current || idPedido || !comunidades.data) return;
    const activo = (id: number | undefined) => !!id && comunidades.data!.some((c) => c.id === id && c.isActive);
    let id: number | undefined;
    if (hoyPlan.data) {
      const deHoy = [...new Set(hoyPlan.data.map((j) => j.communityId))];
      if (deHoy.length === 1 && activo(deHoy[0])) id = deHoy[0];
    } else if (hoyPlan.isError || !navigator.onLine) {
      const ultimo = Number(leerUltimoBatey());
      if (activo(ultimo)) id = ultimo;
    } else return; // todavía cargando la jornada de hoy
    autoElegido.current = true;
    if (id) {
      setElegidoSolo(true);
      setParams({ batey: String(id) }, { replace: true });
    }
  }, [idPedido, comunidades.data, hoyPlan.data, hoyPlan.isError, setParams]);
  // Recordar el batey para la próxima vez (sobre todo sin internet)
  useEffect(() => {
    if (comunidadId) guardarUltimoBatey(String(comunidadId));
  }, [comunidadId]);

  // Lo registrado en este dispositivo que aún no se envía (sin internet)
  const pendientes = usePendientes();
  const enLinea = useEnLinea();
  const locales = useMemo<Locales>(() => {
    const visitas = new Set<number>();
    const noVino = new Map<number, MotivoInasistencia>();
    const tratamiento = new Map<number, NonNullable<DatosNoVino['tratamiento']>>();
    for (const x of pendientes) {
      if (x.tipo === 'visita') visitas.add(x.resumen.pacienteId);
      if (x.tipo === 'no-vino') {
        const d = x.cuerpo as DatosNoVino;
        noVino.set(x.resumen.pacienteId, d.motivo);
        if (d.tratamiento) tratamiento.set(x.resumen.pacienteId, d.tratamiento);
      }
    }
    return { visitas, noVino, tratamiento };
  }, [pendientes]);
  const cliente = useQueryClient();
  const { tiene } = useSesion();
  // Paciente al que se le está preguntando si se le deja el tratamiento (ventana abierta)
  const [dejar, setDejar] = useState<{ p: PacienteJornada; motivo: MotivoInasistencia } | null>(null);

  /** Cambia la marca de "No vino" en la lista guardada (se ve al instante, también sin internet). */
  const ajustarLista = (pacienteId: number, marca: Inasistencia | null) =>
    cliente.setQueryData<PacienteJornada[]>(['jornada', comunidadId], (l) =>
      l?.map((p) => (p.id === pacienteId ? { ...p, inasistencias: marca ? [marca] : (p.inasistencias ?? []).filter((i) => i.fecha.slice(0, 10) !== hoyYmd()) } : p)),
    );

  const marcarNoVinoEn = async (p: PacienteJornada, motivo: MotivoInasistencia, tratamiento?: DatosNoVino['tratamiento']) => {
    const datos: DatosNoVino = { fecha: hoyYmd(), motivo, clienteId: nuevoId(), tratamiento };
    const dejado = tratamiento ? ` · se le dejó el tratamiento con ${conQuien(tratamiento.recibioNombre, tratamiento.recibioParentesco)}` : '';
    ajustarLista(p.id, { fecha: datos.fecha, motivo, entrega: tratamiento ? { recibioNombre: tratamiento.recibioNombre ?? null, recibioParentesco: tratamiento.recibioParentesco } : null });
    const enCola = () =>
      agregarPendiente({
        id: datos.clienteId!,
        tipo: 'no-vino',
        ruta: `/patients/${p.id}/no-vino`,
        metodo: 'POST',
        cuerpo: datos,
        resumen: { pacienteId: p.id, paciente: `${nombreCompleto(p)} · ${p.patientCode}`, detalle: `No vino (${MOTIVOS_INASISTENCIA[motivo].toLowerCase()}) el ${fecha(`${datos.fecha}T12:00:00`)}${dejado}` },
      });
    try {
      if (!navigator.onLine) await enCola();
      else await marcarNoVino(p.id, datos);
      if (tratamiento) cliente.invalidateQueries({ queryKey: ['medicamentos'] });
      toast.success(`${nombreCompleto(p)}: no vino (${MOTIVOS_INASISTENCIA[motivo].toLowerCase()})${dejado}`, {
        action: { label: 'Deshacer', onClick: () => void deshacerNoVino(p) },
      });
    } catch (e) {
      if (esFaltaDeConexion(e)) {
        await enCola();
        toast.success(`${nombreCompleto(p)}: no vino${dejado}. Se enviará al volver la señal.`);
      } else {
        ajustarLista(p.id, null);
        toast.error(e instanceof Error ? mensajeEntrega(e.message) : 'No se pudo marcar');
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
    const corte = corteRegulares(visitasSinVenir);
    return (lista.data ?? [])
      .map((p) => ({ p, estado: estadoDe(p, ronda, hoy, locales, corte) }))
      // Por nombre: así se busca a la persona que llega a la mesa.
      .sort((a, b) => nombreCompleto(a.p).localeCompare(nombreCompleto(b.p), 'es', { sensitivity: 'base' }));
  }, [lista.data, locales, visitasSinVenir]);

  // Médicos que figuran como último en atender a alguien de este batey. Solo los usuarios activos van por
  // nombre; los demás (cuentas borradas o desactivadas, iniciales del Excel) se juntan como "Otros" (id 0).
  const activos = new Set((usuariosActivos.data ?? []).map((u) => u.id));
  const esOtro = (id: number) => usuariosActivos.data !== undefined && !activos.has(id);
  const porMedico = filas.reduce((m, { p }) => {
    if (!p.lastDoctorId) return m;
    const id = esOtro(p.lastDoctorId) ? 0 : p.lastDoctorId;
    m.set(id, { id, nombre: id === 0 ? 'Otros' : (p.lastDoctorNombre ?? `#${id}`), n: (m.get(id)?.n ?? 0) + 1 });
    return m;
  }, new Map<number, { id: number; nombre: string; n: number }>());
  const medicosDelBatey = [...porMedico.values()].sort((a, b) => Number(a.id === 0) - Number(b.id === 0) || a.nombre.localeCompare(b.nombre));

  const vistos = filas.filter((f) => f.estado === 'hoy' || f.estado === 'ronda').length;
  const conTratamiento = filas.filter((f) => f.estado === 'tratamiento').length;
  // Atendidos en la ronda: los que vinieron a consulta y a los que solo se les dejó el tratamiento.
  const atendidos = vistos + conTratamiento;
  const vistosHoy = filas.filter((f) => f.estado === 'hoy').length;
  const noVinieron = filas.filter((f) => f.estado === 'noVino').length;
  const yaNoVienen = filas.filter((f) => f.estado === 'yaNoViene').length;
  // Vistos en una ronda de este año (los de hoy sin enviar cuentan en la ronda actual).
  const trimestreHoy = trimestreDe(hoyYmd());
  const vinoEn = (p: PacienteJornada, estado: Estado, t: Cuando) =>
    t === 'hoy' ? estado === 'hoy' : (t === trimestreHoy && (estado === 'hoy' || estado === 'tratamiento')) || (p.visitasAnio ?? []).some((d) => trimestreDe(d) === t);
  const vistosEn = (t: Cuando) => filas.filter(({ p, estado }) => vinoEn(p, estado, t)).length;
  // Los regulares: la ronda se mide contra ellos, no contra todos los registrados desde 2017.
  const regulares = filas.length - yaNoVienen;
  const porVer = filas.filter((f) => f.estado !== 'hoy' && f.estado !== 'ronda' && f.estado !== 'tratamiento' && f.estado !== 'noVino' && f.estado !== 'yaNoViene').length;
  const q = busqueda.trim().toLowerCase();
  const masFiltros = !!(presion || sexo || rangoEdad || medico !== '');
  const visibles = filas.filter(({ p, estado }) => {
    if (medico === 0 && !(p.lastDoctorId && esOtro(p.lastDoctorId))) return false;
    if (medico && p.lastDoctorId !== medico) return false;
    if (sexo && p.gender !== sexo) return false;
    if (rangoEdad) {
      const [de, a] = rangoEdad.split('-').map(Number);
      const e = edad(p.birthDate);
      if (e < de || e > a) return false;
    }
    if (presion) {
      const c = p.clinicalVisits[0]?.bpClassification?.categoryName;
      const fuera =
        presion === 'controlados'
          ? !(c === 'NORMAL' || c === 'ELEVATED')
          : presion === 'noControlados'
            ? !(c === 'GRADE_1' || c === 'GRADE_2' || c === 'CRISIS')
            : presion === 'sinToma'
              ? !!c
              : c !== presion;
      if (fuera) return false;
    }
    if (q) return coincide(q, p);
    if (filtro === 'pendientes') return estado !== 'hoy' && estado !== 'ronda' && estado !== 'tratamiento' && estado !== 'noVino' && estado !== 'yaNoViene';
    if (filtro === 'hoy') return vinoEn(p, estado, cuando);
    if (filtro === 'novino') return estado === 'noVino';
    return true;
  });
  // Buscando: primero lo que coincide exacto o por el inicio, luego lo aproximado (cada grupo por nombre).
  if (q) visibles.sort((a, b) => grupoDe(puntaje(q, b.p) ?? 0) - grupoDe(puntaje(q, a.p) ?? 0));
  const limpiarFiltros = () => {
    setMedico('');
    setPresion('');
    setSexo('');
    setRangoEdad('');
  };

  return (
    <>
      {dejar && (
        <DejarTratamiento
          key={dejar.p.id}
          paciente={dejar.p}
          motivo={dejar.motivo}
          alSoloNoVino={() => {
            void marcarNoVinoEn(dejar.p, dejar.motivo);
            setDejar(null);
          }}
          alDejar={(t) => {
            void marcarNoVinoEn(dejar.p, dejar.motivo, t);
            setDejar(null);
          }}
          alCancelar={() => setDejar(null)}
        />
      )}
      <EncabezadoPagina titulo="Registro en jornada" />

      {!comunidadId && !!hoyPlan.data?.length && (
        <p className="mb-4 text-sm text-tenue">
          Hoy hay jornada en:{' '}
          {hoyPlan.data.map((j, i) => (
            <span key={j.id}>
              {i > 0 && ', '}
              <button
                className="font-medium text-tinta underline"
                onClick={() => {
                  autoElegido.current = true;
                  setParams({ batey: String(j.communityId) }, { replace: true });
                }}
              >
                {j.community.name}
              </button>
            </span>
          ))}
        </p>
      )}

      {/* Barra de la jornada: dónde se trabaja, cuánto falta y lo que se prepara antes de salir */}
      <section className="mb-4 rounded-xl border border-borde bg-superficie p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <label className="flex w-full flex-col gap-1 sm:w-64">
            <span className="text-[13px] font-medium text-tinta/80">Batey</span>
            <Selector
              vacio="Elegir batey…"
              className="h-10"
              value={comunidadId ?? ''}
              onChange={(e) => {
                autoElegido.current = true;
                setElegidoSolo(false);
                setParams(e.target.value ? { batey: e.target.value } : {}, { replace: true });
              }}
              opciones={(comunidades.data ?? []).filter((c) => c.isActive).map((c) => ({ value: c.id, label: c.name }))}
            />
            {elegidoSolo && comunidadId && <span className="text-xs text-tenue">{planHoy ? 'Jornada de hoy. Puedes cambiarlo.' : 'El último que usaste. Puedes cambiarlo.'}</span>}
          </label>

          {comunidadId && lista.data && (() => {
            // Lo esperado en la ronda es la media alta de las últimas jornadas (las de más pacientes; ver Configuración), no todos
            // los regulares: nunca vienen todos. Sin jornadas anteriores, los regulares.
            const a = asistenciaJ.data?.find((x) => x.communityId === comunidadId);
            const esperados = a?.promedio ?? regulares;
            const detalle = a ? `Media alta de las últimas ${a.jornadas.length} (las ${a.mejores ?? 3} con más pacientes)${a.media !== undefined ? `; promedio simple ~${a.media}` : ''}: ${a.jornadas.map((j) => `${fechaCorta(j.fecha)}: ${j.pacientes}`).join(' · ')}` : undefined;
            const superado = atendidos >= esperados && esperados > 0;
            return (
              <div className="min-w-56 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="tabular text-2xl font-semibold tracking-tight">{atendidos}</span>
                  <span className="text-sm text-tenue" title={detalle}>
                    de {a ? '~' : ''}
                    {esperados} esperados en la ronda
                  </span>
                  <span className="tabular ml-auto text-sm text-tenue">
                    <strong className="font-semibold text-tinta">{vistosHoy}</strong> hoy
                    {noVinieron > 0 && (
                      <>
                        {' · '}
                        <strong className="font-semibold text-tinta">{noVinieron}</strong> no vinieron
                      </>
                    )}
                  </span>
                </p>
                <div
                  className="mt-2 h-2 overflow-hidden rounded-full bg-black/[0.06]"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={esperados}
                  aria-valuenow={Math.min(atendidos, esperados)}
                  aria-label="Vistos de los esperados en la ronda"
                >
                  <div
                    className={cn('h-full rounded-full transition-[width] duration-300 ease-out', superado ? 'bg-green-600' : 'bg-marca-500')}
                    style={{ width: `${esperados ? Math.min(100, (atendidos / esperados) * 100) : 0}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-tenue" title={`Regulares: los que se han perdido como mucho ${visitasSinVenir} visitas. Se cambia en Configuración.`}>
                  {a ? (
                    <>
                      Esperados: lo que viene en un buen día <span className="hidden sm:inline">(media alta de las últimas {a.jornadas.length === 1 ? 'jornada' : `${a.jornadas.length} jornadas`})</span> ·{' '}
                    </>
                  ) : null}
                  {regulares} pacientes regulares
                  {conTratamiento > 0 && ` · ${conTratamiento} con tratamiento dejado (sin consulta)`}
                  {superado && <span className="font-medium text-green-700"> · ya se superó lo esperado</span>}
                </p>
              </div>
            );
          })()}

          {comunidadId && (
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <DescargarBatey comunidadId={comunidadId} total={lista.data?.length} enLinea={enLinea} automatica={!!pronto.data?.some((j) => j.communityId === comunidadId)} />
              <Boton variante="secundario" className="h-10" icono={<UserPlus className="size-4" />} onClick={() => navegar(`/pacientes/nuevo?batey=${comunidadId}`)}>
                Paciente nuevo
              </Boton>
            </div>
          )}
        </div>
      </section>

      {!comunidadId ? (
        <Tarjeta>
          <Vacio icono={<MapPin className="size-8" />} titulo="Elige el batey de la jornada">
            Verás a sus pacientes activos y quién falta por ver en esta ronda.
          </Vacio>
        </Tarjeta>
      ) : (
        <Tarjeta>
          <div className="flex flex-wrap items-center gap-3 border-b border-borde p-4">
            {/* Lo primero es en qué grupo se está: cada pestaña dice cuántos hay */}
            <div className="grid w-full grid-cols-2 gap-0.5 rounded-lg bg-black/5 p-0.5 text-sm sm:flex lg:w-auto" role="tablist" aria-label="Qué pacientes ver">
              {FILTROS.map((f) => {
                const n = f.valor === 'pendientes' ? porVer : f.valor === 'hoy' ? vistosEn(cuando) : f.valor === 'novino' ? noVinieron : filas.length;
                const activo = filtro === f.valor && !q;
                return (
                  <button
                    key={f.valor}
                    role="tab"
                    aria-selected={activo}
                    onClick={() => setFiltro(f.valor)}
                    className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 whitespace-nowrap transition-colors', activo ? 'bg-superficie font-medium shadow-sm' : 'text-tenue hover:text-tinta')}
                  >
                    {f.texto}
                    <span className={cn('tabular rounded-full px-1.5 text-xs', activo ? 'bg-marca-100 text-marca-700' : 'bg-black/5')}>{n}</span>
                  </button>
                );
              })}
            </div>
            <div className="relative min-w-52 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tenue" />
              <Entrada value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre, código o casa" className="h-10 pl-9" aria-label="Buscar paciente" />
            </div>
            <Selector
              className="h-10 w-full min-w-48 sm:w-auto"
              vacio="Lo atendió: cualquiera"
              value={medico}
              onChange={(e) => setMedico(e.target.value === '' ? '' : Number(e.target.value))}
              opciones={medicosDelBatey.map((m) => ({ value: m.id, label: `${m.nombre} (${m.n})` }))}
              aria-label="Último que lo atendió"
            />
            {/* Vistos: hoy o en una ronda de este año */}
            {filtro === 'hoy' && !q && (
              <div className="flex w-full flex-wrap items-center gap-1.5 text-sm">
                <span className="mr-1 text-tenue">Vistos:</span>
                {(['hoy', 1, 2, 3, 4] as const)
                  .filter((t) => t === 'hoy' || t <= trimestreHoy)
                  .map((t) => (
                    <button
                      key={t}
                      onClick={() => setCuando(t)}
                      className={cn('rounded-full border px-3 py-1', cuando === t ? 'border-tinta bg-marca-500 font-medium' : 'border-borde text-tenue hover:text-tinta')}
                    >
                      {t === 'hoy' ? 'Hoy' : `T${t}${t === trimestreHoy ? ' · esta ronda' : ''}`} <span className="tabular text-xs">{vistosEn(t)}</span>
                    </button>
                  ))}
              </div>
            )}
            <div className="grid w-full grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
              <Selector className="col-span-2 h-10 w-full sm:w-56" vacio="Presión: cualquiera" value={presion} onChange={(e) => setPresion(e.target.value)} opciones={PRESIONES} aria-label="Presión en la última visita" />
              <Selector
                className="h-10 w-full min-w-0 sm:w-44"
                vacio="Sexo: cualquiera"
                value={sexo}
                onChange={(e) => setSexo(e.target.value)}
                opciones={[
                  { value: 'FEMALE', label: 'Mujeres' },
                  { value: 'MALE', label: 'Hombres' },
                ]}
                aria-label="Sexo"
              />
              <Selector className="h-10 w-full min-w-0 sm:w-44" vacio="Edad: cualquiera" value={rangoEdad} onChange={(e) => setRangoEdad(e.target.value)} opciones={EDADES} aria-label="Edad" />
              {masFiltros && (
                <Boton variante="fantasma" className="h-10" onClick={limpiarFiltros}>
                  Quitar filtros
                </Boton>
              )}
              {(masFiltros || q) && (
                <span className="text-xs text-tenue">
                  {visibles.length} {visibles.length === 1 ? 'paciente' : 'pacientes'}
                </span>
              )}
            </div>
          </div>

          {lista.isPending ? (
            <Cargando />
          ) : lista.isError ? (
            <ErrorCarga error={lista.error} />
          ) : visibles.length === 0 ? (
            <Vacio icono={<CheckCircle2 className="size-8" />} titulo={q ? 'Sin coincidencias' : filtro === 'pendientes' ? 'No falta nadie por ver' : 'Nadie todavía'}>
              {q ? 'Revisa cómo está escrito o busca por el código o la casa.' : filtro === 'pendientes' ? 'Todos los pacientes de este batey ya se vieron en la ronda.' : undefined}
            </Vacio>
          ) : (
            <ul className="divide-y divide-borde">
              {visibles.map(({ p, estado }) => {
                const u = p.clinicalVisits[0];
                const e = ESTADOS[estado];
                const sinEnviar = locales.visitas.has(p.id);
                // El estado solo se muestra cuando dice algo: en "Por ver" todos están pendientes.
                const aviso = sinEnviar
                  ? { texto: 'Registrada · sin enviar', color: '#a16207' }
                  : estado === 'noVino'
                    ? { texto: textoNoVino(p, locales), color: e.color }
                    : (estado === 'sinVenir' || estado === 'yaNoViene') && u
                      ? { texto: asistencia(u.visitDate).texto, color: asistencia(u.visitDate).masDeUnAno ? '#6b665e' : e.color }
                      : estado === 'pendiente'
                        ? null
                        : { texto: e.texto, color: e.color };
                return (
                  <li
                    key={p.id}
                    onClick={() => navegar(`/pacientes/${p.id}?volver=${encodeURIComponent(`/jornada?batey=${comunidadId}`)}`)}
                    className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-fondo sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:px-5 xl:grid-cols-[auto_5.5rem_minmax(0,1fr)_13rem_17.5rem]"
                  >
                    <Avatar persona={p} foto={p.photoUrl} tamano="size-10" />
                    {/* El código en su columna (en pantallas anchas); en el teléfono va debajo del nombre */}
                    <span className="tabular hidden font-mono text-sm text-tinta/80 xl:block">{p.patientCode}</span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="truncate font-medium">{nombreCompleto(p)}</span>
                        {aviso && <Insignia color={aviso.color}>{aviso.texto}</Insignia>}
                      </p>
                      <p className="truncate text-xs text-tenue">
                        <span className="font-mono text-tinta/70 xl:hidden">{p.patientCode} · </span>
                        {edadTexto(p)}
                        {p.address && ` · Casa ${p.address}`}
                      </p>
                    </div>
                    {/* La última toma: lo que el médico quiere ver antes de registrar la de hoy */}
                    <div className="col-span-2 col-start-1 row-start-2 pl-14 text-xs text-tenue sm:col-span-3 xl:col-span-1 xl:col-start-auto xl:row-start-auto xl:pl-0">
                      {u ? (
                        <>
                          <p className="flex items-center gap-2">
                            <span className="tabular font-mono text-sm font-medium text-tinta">{tensionDe(u)}</span>
                            <InsigniaCategoria config={u.bpClassification} />
                          </p>
                          <p className="mt-0.5 truncate">
                            {fecha(u.visitDate)}
                            {p.lastDoctorNombre && ` · ${p.lastDoctorNombre}`}
                          </p>
                        </>
                      ) : (
                        <p>Primera visita</p>
                      )}
                    </div>
                    <div className="col-span-2 flex items-center gap-2 pl-14 sm:col-span-1 sm:justify-end sm:pl-0" onClick={(ev) => ev.stopPropagation()}>
                      {estado === 'noVino' ? (
                        <Boton variante="fantasma" className="h-10 px-3 text-sm" onClick={() => void deshacerNoVino(p)}>
                          Deshacer
                        </Boton>
                      ) : (
                        // Con permiso de entregar, al elegir el motivo se pregunta si se le deja el tratamiento con alguien.
                        estado !== 'hoy' && estado !== 'ronda' && estado !== 'tratamiento' && <MenuNoVino dejar={tiene('entregas.registrar')} alElegir={(m) => (tiene('entregas.registrar') ? setDejar({ p, motivo: m }) : void marcarNoVinoEn(p, m))} />
                      )}
                      <Boton
                        variante={estado === 'hoy' || estado === 'ronda' || estado === 'tratamiento' ? 'secundario' : 'primario'}
                        className="h-10 px-4"
                        icono={<ClipboardPlus className="size-4" />}
                        onClick={() => navegar(`/pacientes/${p.id}/visita?volver=${encodeURIComponent(`/jornada?batey=${comunidadId}`)}`)}
                      >
                        {estado === 'hoy' ? 'Otra' : 'Registrar'}
                      </Boton>
                    </div>
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
/**
 * Con permiso de entregar, el botón dice "Dejar TX" (dejar tratamiento: lo que casi siempre se hace cuando no
 * vino); sin permiso, "No vino". En los dos casos primero se elige por qué no vino.
 */
function MenuNoVino({ alElegir, dejar }: { alElegir: (m: MotivoInasistencia) => void; dejar: boolean }) {
  const [abierto, setAbierto] = useState(false);
  // Si abajo no cabe (filas al final de la pantalla), el menú se abre hacia arriba.
  const [haciaArriba, setHaciaArriba] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const alternar = () => {
    if (!abierto && ref.current) {
      const r = ref.current.getBoundingClientRect();
      const alto = 48 + Object.keys(MOTIVOS_INASISTENCIA).length * 36;
      const abajo = window.innerHeight - r.bottom;
      setHaciaArriba(abajo < alto + 8 && r.top > abajo);
    }
    setAbierto((a) => !a);
  };
  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setAbierto(false);
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, [abierto]);
  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <Boton
        variante="secundario"
        // El mismo tono que la etiqueta "Tratamiento dejado": se distingue de Registrar sin competir con él.
        className={cn('h-10 px-3 text-sm whitespace-nowrap', dejar && 'border-[#e6d3a8] bg-[#f6ecd6] text-[#6b4f00] hover:border-[#d6b978] hover:bg-[#ecd9ab]')}
        icono={dejar ? <Pill className="size-3.5" /> : <UserX className="size-3.5" />}
        onClick={alternar}
        aria-expanded={abierto}
        title={dejar ? 'Dejar tratamiento' : undefined}
        aria-label={dejar ? 'Dejar tratamiento' : undefined}
      >
        {/* "TX": así lo escriben en la fundación (tratamiento); el título completo queda al pasar el cursor */}
        {dejar ? 'Dejar TX' : 'No vino'}
      </Boton>
      {abierto && (
        <ul className={cn('absolute right-0 z-20 w-56 overflow-hidden rounded-lg border border-borde bg-superficie py-1 text-sm shadow-lg', haciaArriba ? 'bottom-full mb-1' : 'top-full mt-1')}>
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
/** Más de esto desde la última descarga: se vuelve a bajar sola (los datos pudieron cambiar). */
const VIGENCIA_DESCARGA_MS = 12 * 60 * 60 * 1000;

function DescargarBatey({ comunidadId, total, enLinea, automatica }: { comunidadId: number; total?: number; enLinea: boolean; automatica: boolean }) {
  const cliente = useQueryClient();
  const [avance, setAvance] = useState<{ hechos: number; total: number } | null>(null);
  const [cuando, setCuando] = useState(() => jornadasDescargadas()[comunidadId] ?? null);
  useEffect(() => setCuando(jornadasDescargadas()[comunidadId] ?? null), [comunidadId]);
  const descargar = async (sola = false) => {
    try {
      const n = await descargarJornada(cliente, comunidadId, (hechos, t) => setAvance({ hechos, total: t }));
      setCuando(new Date().toISOString());
      toast.success(sola ? `Jornada descargada sola: ${n} pacientes disponibles sin internet.` : `Listo: ${n} pacientes disponibles sin internet en este dispositivo.`);
    } catch (e) {
      // La descarga automática no molesta si falla: queda el botón para intentarlo a mano.
      if (!sola) toast.error(`No se pudo descargar: ${e instanceof Error ? e.message : 'error'}`);
    } finally {
      setAvance(null);
    }
  };
  // Batey con jornada hoy o mañana: se descarga solo al abrirlo (con internet), si no estaba o tiene más de 12 horas.
  const intentado = useRef<number | null>(null);
  useEffect(() => {
    if (!automatica || !enLinea || avance || intentado.current === comunidadId) return;
    const previa = jornadasDescargadas()[comunidadId];
    if (previa && Date.now() - new Date(previa).getTime() < VIGENCIA_DESCARGA_MS) return;
    intentado.current = comunidadId;
    void descargar(true);
  }, [automatica, enLinea, comunidadId]); // eslint-disable-line react-hooks/exhaustive-deps
  // Un solo botón en la barra: dice si ya está listo para trabajar sin señal y lo actualiza.
  return (
    <Boton
      variante="secundario"
      className={cn('h-10', cuando && !avance && 'border-green-200 text-green-800')}
      icono={cuando && !avance ? <CheckCircle2 className="size-4" /> : <CloudDownload className="size-4" />}
      cargando={!!avance}
      disabled={!enLinea && !avance}
      title={
        cuando
          ? `Disponible sin internet · descargado el ${fechaYHora(cuando)}. Toca para actualizar.`
          : `Para trabajar sin señal en el batey, descárgalo antes de salir${total ? ` (${total} pacientes)` : ''}.`
      }
      onClick={() => void descargar()}
    >
      {avance ? `Descargando ${avance.hechos} de ${avance.total}` : cuando ? `Sin internet: listo · ${fechaYHora(cuando).split(',')[0]}` : `Descargar para usar sin internet`}
    </Boton>
  );
}
