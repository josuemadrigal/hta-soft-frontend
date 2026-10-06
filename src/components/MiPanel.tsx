import { ArrowRight, CalendarDays, ClipboardList, HeartPulse, SearchX, Stethoscope, Tent, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMiPanel } from '../api/consultas';
import { useSesion } from '../auth/sesion';
import { asistencia } from '../lib/asistencia';
import { cn, fechaYHora, nombreCompleto } from '../lib/formato';
import { diaJornada } from '../pages/Jornadas';
import { Boton, Cargando, ErrorCarga, Insignia, InsigniaCategoria, Tarjeta, Vacio } from './ui';

const miles = (n: number) => n.toLocaleString('es-DO');

function Cifra({ titulo, valor, detalle, icono, a, alerta }: { titulo: string; valor: ReactNode; detalle?: ReactNode; icono: ReactNode; a?: string; alerta?: boolean }) {
  const contenido = (
    <>
      <div className="flex items-start justify-between">
        <p className="text-sm text-tenue">{titulo}</p>
        <span className={cn('text-tenue', alerta && 'text-red-600')}>{icono}</span>
      </div>
      <p className={cn('tabular mt-2 text-3xl font-semibold tracking-tight', alerta && 'text-red-600')}>{valor}</p>
      {detalle && <p className="mt-1 text-xs text-tenue">{detalle}</p>}
    </>
  );
  const clase = 'block rounded-xl border border-borde bg-superficie p-5';
  return a ? (
    <Link to={a} className={cn(clase, 'hover:border-tinta/30')}>
      {contenido}
    </Link>
  ) : (
    <div className={clase}>{contenido}</div>
  );
}

/** "Mi panel": lo del médico que entra — sus pacientes, quiénes dejaron de venir y su jornada de hoy. */
export function MiPanelVista() {
  const { usuario } = useSesion();
  const consulta = useMiPanel();
  const navegar = useNavigate();
  if (consulta.isPending) return <Cargando />;
  if (consulta.isError) return <ErrorCarga error={consulta.error} />;
  const d = consulta.data;
  const mios = `/pacientes?medico=${usuario?.id}`;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Cifra titulo="Mis pacientes" valor={miles(d.pacientes)} detalle="Los que atendí en su última visita" icono={<Users className="size-4" />} a={mios} />
        <Cifra
          titulo="Mis pacientes controlados"
          valor={d.controladosPct === null ? '—' : `${Math.round(d.controladosPct)}%`}
          detalle="Última toma por debajo de 140/90"
          icono={<HeartPulse className="size-4" />}
        />
        <Cifra
          titulo="Pendientes de esta ronda"
          valor={miles(d.leToca)}
          detalle={`${miles(d.sinVenir.total)} no asisten hace más de 6 meses`}
          icono={<SearchX className="size-4" />}
          a={`${mios}&situacion=le-toca`}
        />
        <Cifra titulo="Atendidos hoy" valor={miles(d.hoy.length)} detalle={`${miles(d.visitasMes)} visitas este mes`} icono={<Stethoscope className="size-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo={<span className="flex items-center gap-2"><Tent className="size-4" /> Mi jornada de hoy</span>}>
          {d.jornadasHoy.length === 0 ? (
            <div className="p-5 text-sm">
              <p className="text-tenue">No hay jornada planificada para hoy.</p>
              {d.proximaJornada && (
                <Link to={`/jornadas/${d.proximaJornada.id}`} className="mt-3 flex items-center gap-2 rounded-lg bg-fondo px-4 py-3 hover:bg-marca-50">
                  <CalendarDays className="size-4" />
                  <span className="flex-1">
                    Tu próxima jornada como responsable: <strong>{d.proximaJornada.community.name}</strong>, {diaJornada(d.proximaJornada.fecha, true).toLowerCase()}
                  </span>
                  <ArrowRight className="size-4" />
                </Link>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-borde">
              {d.jornadasHoy.map((j) => (
                <li key={j.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-medium">
                      {j.community.name} {j.soyResponsable && <Insignia color="#15803d">Eres responsable</Insignia>}
                    </p>
                    <p className="text-xs text-tenue">{j.responsable ? `Responsable: ${nombreCompleto(j.responsable)}` : 'Sin responsable'}</p>
                  </div>
                  <Boton variante="secundario" className="h-9" onClick={() => navegar(`/jornadas/${j.id}`)}>
                    Qué llevar
                  </Boton>
                  <Boton className="h-9" icono={<ClipboardList className="size-4" />} onClick={() => navegar(`/jornada?batey=${j.communityId}`)}>
                    Registrar
                  </Boton>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta titulo="Atendidos hoy" accion={<span className="text-xs text-tenue">Visitas que registré hoy</span>}>
          {d.hoy.length === 0 ? (
            <Vacio titulo="Todavía nadie hoy" />
          ) : (
            <ul className="max-h-80 divide-y divide-borde overflow-y-auto">
              {d.hoy.map((v) => (
                <li key={v.id}>
                  <Link to={`/pacientes/${v.patient.id}`} className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-fondo">
                    <span className="w-12 text-xs text-tenue">{fechaYHora(v.visitDate).split(', ').pop()}</span>
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{nombreCompleto(v.patient)}</span>
                      <span className="ml-2 font-mono text-xs text-tenue">{v.patient.patientCode}</span>
                      <span className="block text-xs text-tenue">{v.patient.community.name}</span>
                    </span>
                    <span className="tabular font-mono">
                      {v.systolicManual ?? v.systolicAuto ?? '—'}/{v.diastolicManual ?? v.diastolicAuto ?? '—'}
                    </span>
                    {v.bpClassification && <InsigniaCategoria config={v.bpClassification} />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>

      <Tarjeta
        titulo={`Dejaron de venir (${miles(d.sinVenir.total)})`}
        accion={
          d.sinVenir.total > d.sinVenir.lista.length && (
            <Link to={`${mios}&situacion=sin-venir&orden=ausencia`} className="text-xs font-medium text-marca-700 hover:underline">
              Ver todos
            </Link>
          )
        }
      >
        {d.sinVenir.lista.length === 0 ? (
          <Vacio titulo="Todos tus pacientes han venido en los últimos 6 meses" />
        ) : (
          <ul className="divide-y divide-borde">
            {d.sinVenir.lista.map((p) => {
              return (
                <li key={p.id}>
                  <Link to={`/pacientes/${p.id}`} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm hover:bg-fondo">
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{nombreCompleto(p)}</span>
                      <span className="ml-2 font-mono text-xs text-tenue">{p.patientCode}</span>
                      <span className="block text-xs text-tenue">
                        {p.community.name}
                        {p.address && ` · casa ${p.address}`}
                        {p.phoneNumber && ` · ${p.phoneNumber}`}
                      </span>
                    </span>
                    {p.lastSystolic && <span className="tabular font-mono">{p.lastSystolic}/{p.lastDiastolic}</span>}
                    {p.lastBpClassification && <InsigniaCategoria config={p.lastBpClassification} />}
                    <span className="text-xs text-tenue">{asistencia(p.lastVisitDate).texto}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Tarjeta>
    </div>
  );
}
