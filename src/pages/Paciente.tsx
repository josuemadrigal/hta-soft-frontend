import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Camera, ChevronDown, ClipboardPlus, GitMerge, Home, Pencil, Split, Stethoscope, Trash2, UserX } from 'lucide-react';
import { reactivarPaciente } from '../api/recursos';
import { useConfirmar } from '../components/confirmar';
import { useSesion } from '../auth/sesion';
import { ListaAlertas, useUmbrales } from '../components/Alertas';
import { alertasClinicas, tomaDe } from '../lib/alertas';
import { asistencia } from '../lib/asistencia';
import { usePermisosVisita } from '../auth/permisosVisita';
import { useEliminarVisita } from '../components/eliminarVisita';
import { useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { useAnaliticaPaciente, usePaciente, useTensionPaciente } from '../api/consultas';
import { subirFotoPaciente } from '../api/recursos';
import type { Paciente as TPaciente, Visita } from '../api/tipos';
import { LEYENDA } from '../components/graficas';
import { Avatar, Boton, Cargando, Entrada, ErrorCarga, Insignia, InsigniaCategoria, Tarjeta, Vacio } from '../components/ui';
import { ALCOHOL, ESTADOS, GENEROS, MOTIVOS_BAJA, SAL, TABACO, TIPOS_VISITA } from '../lib/etiquetas';
import { atendio, cn, colorCumplimiento, decimal, DIA_MS, edadTexto, fecha, fechaYHora, nombreCompleto, num, tensionDe } from '../lib/formato';

const ejeFecha = new Intl.DateTimeFormat('es-DO', { day: 'numeric', month: 'short', year: '2-digit' });

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-tenue">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

function FotoPaciente({ paciente }: { paciente: TPaciente }) {
  const input = useRef<HTMLInputElement>(null);
  const cliente = useQueryClient();
  const subir = useMutation({
    mutationFn: (f: File) => subirFotoPaciente(paciente.id, f),
    onSuccess: () => {
      cliente.invalidateQueries({ queryKey: ['paciente', paciente.id] });
      cliente.invalidateQueries({ queryKey: ['pacientes'] });
      toast.success('Foto actualizada');
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <button
      onClick={() => input.current?.click()}
      className="group relative shrink-0 rounded-full"
      title="Cambiar foto"
      disabled={subir.isPending}
    >
      <Avatar persona={paciente} foto={paciente.photoUrl} tamano="size-20 text-xl" />
      <span className={cn('absolute inset-0 grid place-items-center rounded-full bg-tinta/50 text-white opacity-0 transition group-hover:opacity-100', subir.isPending && 'opacity-100')}>
        <Camera className="size-5" />
      </span>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) subir.mutate(f);
          e.target.value = '';
        }}
      />
    </button>
  );
}

const RANGOS = [
  { valor: 'todo', texto: 'Todo' },
  { valor: '5', texto: '5 años' },
  { valor: '2', texto: '2 años' },
  { valor: '1', texto: '1 año' },
  { valor: 'fechas', texto: 'Fechas' },
] as const;

function GraficoTension({ id }: { id: number }) {
  const { data } = useTensionPaciente(id);
  const [rango, setRango] = useState<(typeof RANGOS)[number]['valor']>('todo');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  if (!data) return <Cargando />;
  const hoy = new Date();
  const inicio =
    rango === 'fechas' ? (desde ? new Date(`${desde}T00:00:00`) : null) : rango === 'todo' ? null : new Date(hoy.getFullYear() - Number(rango), hoy.getMonth(), hoy.getDate());
  const fin = rango === 'fechas' && hasta ? new Date(`${hasta}T23:59:59`) : null;
  const tomas = data.filter((p) => p.systolic && p.diastolic);
  const puntos = tomas
    .filter((p) => (!inicio || new Date(p.date) >= inicio) && (!fin || new Date(p.date) <= fin))
    .map((p) => ({ ...p, fecha: ejeFecha.format(new Date(p.date)) }));
  if (tomas.length === 0) return <Vacio titulo="Sin tomas registradas" />;
  return (
    <div className="px-2 pt-3 pb-2">
      <div data-no-copiar className="flex flex-wrap items-center gap-2 px-3 pb-2">
        <div className="flex rounded-lg bg-black/5 p-0.5 text-xs">
          {RANGOS.map((r) => (
            <button key={r.valor} type="button" onClick={() => setRango(r.valor)} className={cn('rounded-md px-2.5 py-1', rango === r.valor ? 'bg-superficie font-medium shadow-sm' : 'text-tenue hover:text-tinta')}>
              {r.texto}
            </button>
          ))}
        </div>
        {rango === 'fechas' && (
          <div className="flex items-center gap-2 text-xs text-tenue">
            <Entrada type="date" className="h-8 w-auto text-xs" aria-label="Desde" value={desde} onChange={(e) => setDesde(e.target.value)} />a
            <Entrada type="date" className="h-8 w-auto text-xs" aria-label="Hasta" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
        )}
        <span className="ml-auto text-xs text-tenue">
          {puntos.length} de {tomas.length} tomas
        </span>
      </div>
      {puntos.length === 0 ? (
        <Vacio titulo="Sin tomas en ese rango" />
      ) : (
    <div className="h-72">
      <ResponsiveContainer>
        <LineChart data={puntos} margin={{ left: -16, right: 16 }}>
          <CartesianGrid vertical={false} stroke="#e5e2dc" />
          <XAxis dataKey="fecha" tickLine={false} axisLine={false} fontSize={12} stroke="#6b665e" minTickGap={24} />
          <YAxis domain={[40, 'auto']} tickLine={false} axisLine={false} fontSize={12} stroke="#6b665e" />
          <Tooltip contentStyle={{ borderRadius: 8, borderColor: '#e5e2dc', fontSize: 13 }} />
          <Legend {...LEYENDA} />
          {/* Umbrales habituales de HTA como referencia visual */}
          <ReferenceLine y={140} stroke="#dc2626" strokeDasharray="4 4" strokeOpacity={0.5} />
          <ReferenceLine y={90} stroke="#ea580c" strokeDasharray="4 4" strokeOpacity={0.5} />
          <Line type="monotone" dataKey="systolic" name="Sistólica" stroke="#1d1b18" strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="diastolic" name="Diastólica" stroke="#c9a400" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
      )}
    </div>
  );
}

function FilaVisita({ visita }: { visita: Visita }) {
  const [abierta, setAbierta] = useState(false);
  const permisos = usePermisosVisita();
  const eliminar = useEliminarVisita();
  const navegar = useNavigate();
  const signos = [
    ['Peso', visita.weightKg ? `${decimal(visita.weightKg)} kg` : '—'],
    ['Talla', visita.heightM ? `${decimal(visita.heightM, 2)} m` : '—'],
    ['IMC', decimal(visita.bmi)],
    ['Frecuencia cardíaca', visita.heartRate ? `${visita.heartRate} lpm` : '—'],
    ['Saturación O₂', visita.oxygenSaturation ? `${visita.oxygenSaturation}%` : '—'],
    ['Temperatura', visita.temperature ? `${decimal(visita.temperature)} °C` : '—'],
    ['PA manual', visita.systolicManual ? `${visita.systolicManual}/${visita.diastolicManual}` : '—'],
    ['PA automática', visita.systolicAuto ? `${visita.systolicAuto}/${visita.diastolicAuto}` : '—'],
  ];
  return (
    <li>
      <button onClick={() => setAbierta(!abierta)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 text-left hover:bg-fondo sm:flex-nowrap" aria-expanded={abierta}>
        <div className="w-44 shrink-0">
          <p className="text-sm font-medium">{fecha(visita.visitDate)}</p>
          <p className="truncate text-xs text-tenue" title={`Atendió ${atendio(visita)}`}>
            {TIPOS_VISITA[visita.visitType]} · {atendio(visita)}
          </p>
        </div>
        <span className="tabular w-20 font-mono text-sm">{tensionDe(visita)}</span>
        <InsigniaCategoria config={visita.bpClassification} />
        {visita.isHomeVisit && (
          <Insignia>
            <Home className="size-3" /> Domicilio
          </Insignia>
        )}
        <span className="ml-auto hidden truncate text-sm text-tenue sm:block">{visita.reason}</span>
        <ChevronDown className={cn('ml-auto size-4 shrink-0 text-tenue transition-transform sm:ml-0', abierta && 'rotate-180')} />
      </button>
      {abierta && (
        <div className="space-y-4 bg-fondo/60 px-5 py-4">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {signos.map(([e, v]) => (
              <Dato key={e} etiqueta={e}>
                <span className="tabular">{v}</span>
              </Dato>
            ))}
          </dl>
          <Dato etiqueta="Atendió">
            {atendio(visita)}
            {visita.originalDoctorId && <span className="text-tenue"> · cuenta eliminada (visita reasignada al administrador)</span>}
          </Dato>
          {visita.nextVisitDate && <Dato etiqueta="Próxima visita">{fecha(visita.nextVisitDate)}</Dato>}
          {visita.reason && <Dato etiqueta="Motivo">{visita.reason}</Dato>}
          {visita.notes && <Dato etiqueta="Notas">{<span className="whitespace-pre-line">{visita.notes}</span>}</Dato>}
          {visita.prescriptionText && <Dato etiqueta="Indicaciones">{<span className="whitespace-pre-line">{visita.prescriptionText}</span>}</Dato>}
          {!!visita.prescriptions?.length && (
            <div>
              <p className="mb-2 text-xs text-tenue">Medicamentos dispensados</p>
              <ul className="divide-y divide-borde rounded-lg border border-borde bg-superficie">
                {visita.prescriptions.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <span className="font-medium">
                      {r.medication?.name} <span className="font-normal text-tenue">{r.medication?.concentration}</span>
                    </span>
                    <span className="tabular text-tenue">
                      {r.dailyDose}/día · {r.daysUntilNextVisit} días · <span className="font-medium text-tinta">{r.quantityDispensed} entregadas</span>
                      {r.adherencePercentage !== null && (
                        <>
                          {' · '}
                          <span className={cn('font-medium', colorCumplimiento(Number(r.adherencePercentage)))}>{Number(r.adherencePercentage).toFixed(0)}% cumplimiento</span>
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(permisos.puedeEditar(visita) || permisos.puedeEliminar) && (
            <div className="flex flex-wrap items-center gap-2 border-t border-borde pt-4">
              {permisos.puedeEditar(visita) && (
                <Boton variante="secundario" className="h-8" icono={<Pencil className="size-4" />} onClick={() => navegar(`/visitas/${visita.id}/editar?volver=${encodeURIComponent(`/pacientes/${visita.patientId}`)}`)}>
                  Editar visita
                </Boton>
              )}
              {permisos.puedeEliminar && (
                <Boton variante="secundario" className="h-8 hover:text-red-600" icono={<Trash2 className="size-4" />} onClick={() => eliminar(visita)}>
                  Eliminar
                </Boton>
              )}
              {permisos.editableHasta(visita) && (
                <span className="text-xs text-tenue">Puedes corregirla hasta el {fechaYHora(permisos.editableHasta(visita)!.toISOString())}</span>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function Paciente() {
  const id = Number(useParams().id);
  // Desde la jornada se vuelve a la jornada (solo rutas internas).
  const pedido = useSearchParams()[0].get('volver');
  const volver = pedido?.startsWith('/') && !pedido.startsWith('//') ? pedido : '/pacientes';
  const navegar = useNavigate();
  const consulta = usePaciente(id);
  const analitica = useAnaliticaPaciente(id);
  const { tiene } = useSesion();
  const puedeRevisar = tiene('datos.revisar');
  const confirmar = useConfirmar();
  const cliente = useQueryClient();
  const reactivar = useMutation({
    mutationFn: () => reactivarPaciente(id),
    onSuccess: () => {
      for (const k of [['paciente'], ['pacientes'], ['jornada'], ['stats'], ['auditoria']]) cliente.invalidateQueries({ queryKey: k });
      toast.success('Paciente reactivado. La baja anterior quedó en Auditoría.');
    },
    onError: (e) => toast.error(e.message),
  });
  const umbrales = useUmbrales();

  if (consulta.isPending) return <Cargando />;
  if (consulta.isError) return <ErrorCarga error={consulta.error} />;
  const p = consulta.data;
  if (!p) return <Vacio titulo="Paciente no encontrado"><Link to="/pacientes" className="text-marca-700 hover:underline">Volver al listado</Link></Vacio>;

  const a = analitica.data && 'bpStats' in analitica.data ? analitica.data : null;
  const ultima = p.clinicalVisits?.[0];
  const alertas = ultima ? alertasClinicas(tomaDe(ultima), p.clinicalVisits!.slice(1), umbrales) : [];
  // Visitas viejas no tienen nextVisitDate: se asume la ronda trimestral.
  const proxima = ultima ? new Date(ultima.nextVisitDate ?? new Date(ultima.visitDate).getTime() + 90 * DIA_MS) : null;
  const pendiente = !!proxima && proxima.getTime() < new Date().setHours(0, 0, 0, 0);
  const asiste = asistencia(ultima?.visitDate);
  const habitos = [
    p.hasFamilyHistory && 'Antecedentes familiares',
    p.smokingStatus !== 'NO' && TABACO[p.smokingStatus],
    p.alcoholIntake !== 'NO' && `Alcohol ${ALCOHOL[p.alcoholIntake].toLowerCase()}`,
    p.saltIntake === 'YES' && 'Consume sal',
  ].filter(Boolean) as string[];

  return (
    <>
      <Link to={volver} className="mb-4 inline-flex items-center gap-1.5 text-sm text-tenue hover:text-tinta">
        <ArrowLeft className="size-4" /> {volver.startsWith('/jornada') ? 'Jornada' : 'Pacientes'}
      </Link>

      <div className="mb-6 flex flex-wrap items-start gap-5">
        <FotoPaciente paciente={p} />
        <div className="min-w-72 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{nombreCompleto(p)}</h1>
            <Insignia color={p.status === 'ACTIVE' ? '#15803d' : undefined}>{ESTADOS[p.status]}</Insignia>
            {!p.consentimientoDatos && (
              <Link to={`/pacientes/${p.id}/editar`} title="Falta registrar su autorización para el uso de sus datos de salud">
                <Insignia color="#b45309">Sin consentimiento</Insignia>
              </Link>
            )}
            {tiene('auditoria.ver') && (
              <Link to={`/auditoria?registro=Patient&id=${p.id}`} className="text-xs text-tenue hover:text-tinta hover:underline">
                Quién la ha visto o cambiado
              </Link>
            )}
          </div>
          <p className="mt-1 text-sm text-tenue">
            <span className="font-mono text-tinta">{p.patientCode}</span> · {GENEROS[p.gender]}, {edadTexto(p)} · {p.community?.name}
          </p>
          {proxima && p.status === 'ACTIVE' && (
            <p className="mt-1 text-sm" style={pendiente && asiste.clave === 'sin-venir' ? { color: asiste.color } : undefined}>
              {!pendiente ? (
                <span className="text-tenue">Próxima visita: {fecha(proxima.toISOString())}</span>
              ) : asiste.clave === 'sin-venir' ? (
                <>
                  <span className="font-medium">{asiste.texto}</span>
                  <span className="text-tenue"> · última visita el {fecha(ultima!.visitDate)}</span>
                </>
              ) : (
                <span className="text-tenue">Última visita el {fecha(ultima!.visitDate)}</span>
              )}
            </p>
          )}
          {habitos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {habitos.map((h) => (
                <Insignia key={h} color="#b45309">{h}</Insignia>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {puedeRevisar && (
            <>
              <Boton variante="fantasma" className="px-2.5" title="Unir con otra ficha de la misma persona" aria-label="Unir con otra ficha" onClick={() => navegar(`/revision/unir?a=${p.id}`)}>
                <GitMerge className="size-4" />
              </Boton>
              {(p.clinicalVisits?.length ?? 0) > 1 && (
                <Boton variante="fantasma" className="px-2.5" title="Separar visitas que son de otra persona" aria-label="Separar visitas de otra persona" onClick={() => navegar(`/revision/separar/${p.id}`)}>
                  <Split className="size-4" />
                </Boton>
              )}
            </>
          )}
          <Boton variante="secundario" icono={<Pencil className="size-4" />} onClick={() => navegar(`/pacientes/${p.id}/editar`)}>
            Editar
          </Boton>
          {p.status === 'ACTIVE' && tiene('pacientes.editar') && (
            <Boton
              variante="secundario"
              className="border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50"
              icono={<UserX className="size-4" />}
              title="Fallecimiento, mudanza, abandono…"
              onClick={() => navegar(`/pacientes/${p.id}/baja`)}
            >
              Dar de baja
            </Boton>
          )}
          {p.status !== 'DECEASED' && <Boton icono={<ClipboardPlus className="size-4" />} onClick={() => navegar(`/pacientes/${p.id}/visita${volver !== '/pacientes' ? `?volver=${encodeURIComponent(volver)}` : ''}`)}>
            Nueva visita
          </Boton>}
        </div>
      </div>

      {p.status !== 'ACTIVE' && (
        <div className={cn('mb-4 flex flex-wrap items-center gap-3 rounded-xl border px-5 py-3 text-sm', p.status === 'DECEASED' ? 'border-borde bg-black/[0.04]' : 'border-amber-300 bg-marca-50')}>
          <UserX className="size-4 shrink-0" />
          <span className="flex-1">
            <strong>{p.motivoBaja ? MOTIVOS_BAJA[p.motivoBaja] : ESTADOS[p.status]}</strong>
            {p.fechaBaja && ` el ${fecha(p.fechaBaja)}`}
            {p.detalleBaja && ` · ${p.detalleBaja}`}
            {p.bajaRegistradaPor && <span className="text-tenue"> · registrado por {p.bajaRegistradaPor}</span>}
          </span>
          {tiene('pacientes.editar') && (
            <Boton
              variante="secundario"
              className="h-8 text-xs"
              cargando={reactivar.isPending}
              onClick={async () => {
                if (await confirmar({ titulo: `¿Reactivar a ${nombreCompleto(p)}?`, mensaje: 'Vuelve a las listas de jornada y de la ronda. La baja queda registrada en Auditoría.', confirmar: 'Reactivar', peligro: false })) reactivar.mutate();
              }}
            >
              Reactivar
            </Boton>
          )}
        </div>
      )}

      {p.status === 'ACTIVE' && alertas.length > 0 && (
        <section className="mb-4">
          <h2 className="mb-2 text-sm font-semibold">
            Alertas de la última visita <span className="font-normal text-tenue">({fecha(ultima!.visitDate)})</span>
          </h2>
          <ListaAlertas alertas={alertas} className="grid gap-2 space-y-0 md:grid-cols-2" />
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {[
              ['Última PA', ultima ? tensionDe(ultima) : '—', ultima && <InsigniaCategoria config={ultima.bpClassification} />],
              ['Promedio', a ? `${a.bpStats.systolic.avg}/${a.bpStats.diastolic.avg}` : '—', a && `${a.totalVisits} tomas manuales`],
              ['Máxima', a ? `${a.bpStats.systolic.max}/${a.bpStats.diastolic.max}` : '—', null],
              ['IMC actual', ultima ? decimal(ultima.bmi) : '—', ultima && `${decimal(ultima.weightKg)} kg`],
            ].map(([t, v, d]) => (
              <div key={t as string} className="rounded-xl border border-borde bg-superficie p-4">
                <p className="text-xs text-tenue">{t}</p>
                <p className="tabular mt-1.5 font-mono text-xl font-medium">{v}</p>
                <div className="mt-1 text-xs text-tenue">{d}</div>
              </div>
            ))}
          </div>

          <Tarjeta titulo="Evolución de la presión arterial" copiable accion={<span className="text-xs text-tenue">Líneas: 140 y 90 mmHg</span>}>
            <GraficoTension id={id} />
          </Tarjeta>

          <Tarjeta titulo={`Visitas (${p.clinicalVisits?.length ?? 0})`}>
            {p.clinicalVisits?.length ? (
              <ul className="divide-y divide-borde">
                {p.clinicalVisits.map((v) => (
                  <FilaVisita key={v.id} visita={v} />
                ))}
              </ul>
            ) : (
              <Vacio icono={<Stethoscope className="size-8" />} titulo="Sin visitas">
                Registra la primera visita para empezar el seguimiento.
              </Vacio>
            )}
          </Tarjeta>
        </div>

        <aside className="space-y-4">
          <Tarjeta titulo="Ficha">
            <dl className="grid gap-4 p-5">
              <Dato etiqueta="Cédula">{p.nationalId || '—'}</Dato>
              <Dato etiqueta="Nacimiento">{p.birthDateIsEstimated ? `Aprox. ${new Date(p.birthDate).getUTCFullYear()}` : fecha(p.birthDate)}</Dato>
              <Dato etiqueta="Teléfono">{p.phoneNumber || '—'}</Dato>
              <Dato etiqueta="Dirección">{p.address || '—'}</Dato>
              <Dato etiqueta="Comunidad">
                {p.community?.name} <span className="text-tenue">· {p.community?.municipality}, {p.community?.province}</span>
              </Dato>
              <Dato etiqueta="Registrado">{fecha(p.registrationDate)}</Dato>
            </dl>
          </Tarjeta>
          <Tarjeta titulo="Hábitos">
            <dl className="grid grid-cols-2 gap-4 p-5">
              <Dato etiqueta="Sal">{SAL[p.saltIntake]}</Dato>
              <Dato etiqueta="Alcohol">{ALCOHOL[p.alcoholIntake]}</Dato>
              <Dato etiqueta="Tabaco">{TABACO[p.smokingStatus]}</Dato>
              <Dato etiqueta="Antecedentes">{p.hasFamilyHistory ? 'Sí' : 'No'}</Dato>
            </dl>
          </Tarjeta>
          {a && a.weightTrend.length > 1 && (
            <Tarjeta titulo="Peso">
              <ul className="divide-y divide-borde text-sm">
                {a.weightTrend.slice(-5).reverse().map((w) => (
                  <li key={w.date} className="tabular flex justify-between px-5 py-2">
                    <span className="text-tenue">{fecha(w.date)}</span>
                    <span>
                      {decimal(w.weight)} kg <span className="text-tenue">· IMC {num(w.bmi)?.toFixed(1)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Tarjeta>
          )}
        </aside>
      </div>

    </>
  );
}
