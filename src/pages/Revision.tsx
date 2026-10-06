import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, GitMerge, RotateCcw, Search, ShieldCheck, Split, Trash2, UserPen } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useCasosRevision, useComunidades, usePaciente, usePacientes, useRevisionPaciente } from '../api/consultas';
import { corregirPaciente, decidirCaso, reabrirCaso, separarPaciente, unirPacientes } from '../api/recursos';
import type { CasoRevision, Genero, Paciente, RevisionPaciente, TipoCaso, Visita } from '../api/tipos';
import { useSesion } from '../auth/sesion';
import { useConfirmar } from '../components/confirmar';
import { useEliminarVisita } from '../components/eliminarVisita';
import { Boton, Campo, Cargando, EncabezadoPagina, Entrada, ErrorCarga, Insignia, InsigniaCategoria, Selector, Tabla, Tarjeta, Vacio } from '../components/ui';
import { GENEROS, opciones } from '../lib/etiquetas';
import { cn, edad, edadTexto, fecha, fechaDia, nombreCompleto, soloFecha } from '../lib/formato';

const TIPOS: { tipo: TipoCaso; texto: string; ayuda: string }[] = [
  { tipo: 'COMPARTIDO', texto: 'Código compartido', ayuda: 'Un mismo código con visitas a nombre de personas distintas. Separa las visitas de la otra persona en una ficha nueva.' },
  { tipo: 'DUPLICADO', texto: 'Posibles duplicados', ayuda: 'Dos fichas que parecen la misma persona (nombre parecido, misma edad y sexo, nunca vinieron el mismo día). Únelas en una.' },
  { tipo: 'VARIANTES', texto: 'Nombre escrito distinto', ayuda: 'La misma persona con el nombre (o el sexo) anotado de varias formas. Elige cómo debe quedar.' },
  { tipo: 'MISMO_DIA', texto: 'Visitas el mismo día', ayuda: 'Más de una visita del mismo paciente el mismo día. Suele ser una fila repetida: elimina la que sobra o márcalas como correctas.' },
  { tipo: 'SIN_EDAD', texto: 'Sin edad', ayuda: 'El Excel no tenía la edad y quedó 1960 por defecto. Escribe la edad o la fecha de nacimiento.' },
];
const COLORES = ['#2563eb', '#db2777', '#059669', '#d97706', '#7c3aed', '#0891b2'];
const POR_PAGINA = 30;

function useInvalidar() {
  const cliente = useQueryClient();
  return () => {
    for (const k of [['revision'], ['paciente'], ['pacientes'], ['visitas'], ['jornada'], ['stats'], ['auditoria']]) cliente.invalidateQueries({ queryKey: k });
  };
}

/** Descarta un caso ("está bien así") con confirmación. */
function useDescartar(alTerminar?: () => void) {
  const confirmar = useConfirmar();
  const invalidar = useInvalidar();
  const m = useMutation({
    mutationFn: decidirCaso,
    onSuccess: () => {
      invalidar();
      toast.success('Caso descartado. Puedes reabrirlo desde "Ver descartados".');
      alTerminar?.();
    },
    onError: (e) => toast.error(e.message),
  });
  return async (clave: string, titulo: string, mensaje: string) => {
    if (await confirmar({ titulo, mensaje, confirmar: 'Descartar', peligro: false })) m.mutate({ clave, estado: 'DESCARTADO' });
  };
}

/* ───────────── Lista: /revision ───────────── */

export function RevisionDatos() {
  const [params, setParams] = useSearchParams();
  const tipo = (params.get('tipo') as TipoCaso) || 'COMPARTIDO';
  const descartados = params.get('ver') === 'descartados';
  const consulta = useCasosRevision({ tipo, descartados });
  const [mostrar, setMostrar] = useState(POR_PAGINA);
  const info = TIPOS.find((t) => t.tipo === tipo)!;
  const total = Object.values(consulta.data?.totales ?? {}).reduce((a, n) => a + (n ?? 0), 0);

  const cambiar = (cambios: Record<string, string | null>) => {
    setMostrar(POR_PAGINA);
    setParams(
      (p) => {
        for (const [k, v] of Object.entries(cambios)) (v ? p.set(k, v) : p.delete(k));
        return p;
      },
      { replace: true },
    );
  };

  return (
    <>
      <EncabezadoPagina
        titulo="Revisión de datos"
        descripcion={consulta.data ? `${total.toLocaleString('es-DO')} casos por revisar · ${consulta.data.decididos} ya resueltos o descartados. Todo cambio queda en Auditoría y se puede deshacer.` : 'Casos detectados en los datos, sobre todo los que dejó la importación del Excel.'}
      />
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {TIPOS.map((t) => (
          <button
            key={t.tipo}
            onClick={() => cambiar({ tipo: t.tipo })}
            className={cn('rounded-full border px-3 py-1.5 text-sm', tipo === t.tipo ? 'border-tinta bg-marca-500 font-medium' : 'border-borde bg-superficie text-tenue hover:text-tinta')}
          >
            {t.texto} <span className="tabular ml-1 text-xs opacity-70">{consulta.data?.totales[t.tipo] ?? 0}</span>
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-sm text-tenue">
          <input type="checkbox" className="accent-tinta" checked={descartados} onChange={(e) => cambiar({ ver: e.target.checked ? 'descartados' : null })} /> Ver resueltos y descartados
        </label>
      </div>
      <p className="mb-4 text-sm text-tenue">{info.ayuda}</p>

      <Tarjeta>
        {consulta.isPending ? (
          <Cargando texto="Revisando los datos…" />
        ) : consulta.isError ? (
          <ErrorCarga error={consulta.error} />
        ) : !consulta.data.casos.length ? (
          <Vacio icono={<ShieldCheck className="size-8" />} titulo={descartados ? 'Nada descartado aquí' : 'Sin casos pendientes'}>
            {descartados ? undefined : 'No queda nada por revisar en este grupo.'}
          </Vacio>
        ) : (
          <>
            <ul className="divide-y divide-borde">
              {consulta.data.casos.slice(0, mostrar).map((c) => (
                <FilaCaso key={c.clave} caso={c} />
              ))}
            </ul>
            {consulta.data.casos.length > mostrar && (
              <div className="border-t border-borde p-3 text-center">
                <Boton variante="fantasma" onClick={() => setMostrar((n) => n + POR_PAGINA)}>
                  Ver más ({consulta.data.casos.length - mostrar} restantes)
                </Boton>
              </div>
            )}
          </>
        )}
      </Tarjeta>
    </>
  );
}

function FichaCorta({ p }: { p: CasoRevision['pacientes'][number] }) {
  return (
    <Link to={`/pacientes/${p.id}`} className="group block min-w-0">
      <span className="font-medium group-hover:underline">{p.nombre}</span> <span className="font-mono text-xs text-tenue">{p.codigo}</span>
      <span className="block text-xs text-tenue">
        {p.batey} · {GENEROS[p.sexo]} · {p.estimado ? `~${new Date(p.nacimiento).getUTCFullYear()}` : fechaDia(p.nacimiento)} · {p.visitas} visitas
      </span>
    </Link>
  );
}

function FilaCaso({ caso: c }: { caso: CasoRevision }) {
  const navegar = useNavigate();
  const { tiene } = useSesion();
  const invalidar = useInvalidar();
  const descartar = useDescartar();
  const eliminar = useEliminarVisita(invalidar);
  const reabrir = useMutation({
    mutationFn: () => reabrirCaso(c.decision!.id),
    onSuccess: () => {
      invalidar();
      toast.success('Caso reabierto');
    },
    onError: (e) => toast.error(e.message),
  });
  const p = c.pacientes[0];
  const caso = encodeURIComponent(c.clave);
  const accion = {
    COMPARTIDO: { texto: 'Separar', icono: <Split className="size-4" />, a: `/revision/separar/${p.id}?caso=${caso}` },
    VARIANTES: { texto: 'Corregir', icono: <UserPen className="size-4" />, a: `/revision/corregir/${p.id}?caso=${caso}` },
    SIN_EDAD: { texto: 'Poner edad', icono: <UserPen className="size-4" />, a: `/revision/corregir/${p.id}?caso=${caso}` },
    DUPLICADO: { texto: 'Comparar', icono: <GitMerge className="size-4" />, a: `/revision/unir?a=${p.id}&b=${c.pacientes[1]?.id}&caso=${caso}` },
    MISMO_DIA: null,
  }[c.tipo];

  return (
    <li className="flex flex-wrap items-start gap-x-6 gap-y-3 px-5 py-4">
      <div className="grid min-w-64 flex-1 gap-3 sm:grid-cols-2">
        {c.pacientes.map((x) => (
          <FichaCorta key={x.id} p={x} />
        ))}
        <div className={cn('text-sm', c.pacientes.length === 1 && 'sm:col-span-1', c.pacientes.length === 2 && 'sm:col-span-2')}>
          <p>{c.resumen}</p>
          {!!c.motivos?.length && (
            <p className="mt-1 flex flex-wrap gap-1">
              {c.motivos.map((m) => (
                <Insignia key={m}>{m}</Insignia>
              ))}
            </p>
          )}
          {c.tipo === 'MISMO_DIA' && c.visitas && (
            <ul className="mt-2 space-y-1">
              {c.visitas.map((v) => (
                <li key={v.id} className="flex items-center gap-3 text-xs">
                  <span className="tabular w-16 font-mono text-[13px]">{v.presion}</span>
                  <span className="w-16 text-tenue">{v.peso ? `${v.peso} kg` : '—'}</span>
                  <span className="flex-1 text-tenue">{v.atendio ?? '—'}</span>
                  {tiene('visitas.administrar') && !c.decision && (
                    <button
                      className="rounded p-1 text-tenue hover:bg-red-50 hover:text-red-600"
                      title="Eliminar esta visita"
                      onClick={() => eliminar({ id: v.id, visitDate: `${c.fecha}T16:00:00Z`, doctorNombre: v.atendio, importada: true, patient: { firstName: p.nombre, lastName: '' } } as unknown as Visita)}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {c.decision ? (
          <>
            <span className="text-xs text-tenue">
              {c.decision.estado === 'RESUELTO' ? 'Resuelto' : 'Descartado'} por {c.decision.userName ?? '—'} el {fecha(c.decision.createdAt)}
            </span>
            <Boton variante="secundario" className="h-8 text-xs" icono={<RotateCcw className="size-3.5" />} cargando={reabrir.isPending} onClick={() => reabrir.mutate()}>
              Reabrir
            </Boton>
          </>
        ) : (
          <>
            <Boton
              variante="fantasma"
              className="h-8 text-xs"
              onClick={() =>
                descartar(
                  c.clave,
                  c.tipo === 'MISMO_DIA' ? '¿Las visitas son correctas?' : 'Descartar el caso',
                  c.tipo === 'DUPLICADO' ? 'Son dos personas distintas: no volverá a aparecer.' : c.tipo === 'MISMO_DIA' ? 'Se conservan todas y el caso no vuelve a aparecer.' : 'Está bien así: el caso no volverá a aparecer.',
                )
              }
            >
              {c.tipo === 'MISMO_DIA' ? 'Son correctas' : c.tipo === 'DUPLICADO' ? 'Son distintas' : 'Descartar'}
            </Boton>
            {accion && (
              <Boton className="h-8 text-xs" icono={accion.icono} onClick={() => navegar(accion.a)}>
                {accion.texto}
              </Boton>
            )}
          </>
        )}
      </div>
    </li>
  );
}

/* ───────────── Nacimiento: edad ↔ fecha ───────────── */

type Nacimiento = { fecha: string; estimada: boolean };

function CamposNacimiento({ valor, alCambiar }: { valor: Nacimiento; alCambiar: (n: Nacimiento) => void }) {
  const anios = valor.fecha ? edad(`${valor.fecha}T00:00:00Z`) : '';
  return (
    <>
      <Campo etiqueta="Edad" ayuda={valor.estimada ? 'Fecha calculada: 1 de enero' : 'Años cumplidos'}>
        <Entrada
          type="number"
          min={0}
          max={120}
          value={anios}
          onChange={(e) => {
            const n = e.target.value;
            if (/^\d{1,3}$/.test(n)) alCambiar({ fecha: `${new Date().getFullYear() - Number(n)}-01-01`, estimada: true });
            else if (!n) alCambiar({ fecha: '', estimada: true });
          }}
        />
      </Campo>
      <Campo etiqueta="Fecha de nacimiento" ayuda={valor.estimada ? 'Aproximada' : undefined}>
        <Entrada type="date" value={valor.fecha} onChange={(e) => alCambiar({ fecha: e.target.value, estimada: false })} />
      </Campo>
    </>
  );
}

/** Lo más repetido de una lista. */
const moda = <T,>(xs: T[]) => {
  const c = new Map<T, number>();
  for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
};
const presionDe = (v: RevisionPaciente['visitas'][number]) => `${v.systolicManual ?? v.systolicAuto ?? '—'}/${v.diastolicManual ?? v.diastolicAuto ?? '—'}`;

function EncabezadoPaciente({ p, titulo }: { p: RevisionPaciente['paciente']; titulo: string }) {
  return (
    <EncabezadoPagina
      titulo={titulo}
      descripcion={
        <>
          <Link to={`/pacientes/${p.id}`} className="font-medium text-tinta hover:underline">
            {nombreCompleto(p)}
          </Link>{' '}
          · <span className="font-mono">{p.patientCode}</span> · {p.community.name} · {GENEROS[p.gender]} · {edadTexto(p)}
        </>
      }
      volver={{ a: '/revision', texto: 'Revisión de datos' }}
    />
  );
}

/* ───────────── Separar: /revision/separar/:id ───────────── */

export function SepararPaciente() {
  const id = Number(useParams().id);
  const consulta = useRevisionPaciente(id);
  const comunidades = useComunidades();
  if (consulta.isPending || comunidades.isPending) return <Cargando />;
  if (consulta.isError) return <ErrorCarga error={consulta.error} />;
  return <Separar datos={consulta.data} />;
}

function Separar({ datos }: { datos: RevisionPaciente }) {
  const { paciente: p, grupos, visitas } = datos;
  const [params] = useSearchParams();
  const caso = params.get('caso');
  const navegar = useNavigate();
  const invalidar = useInvalidar();
  const comunidades = useComunidades();
  const descartar = useDescartar(() => navegar('/revision?tipo=COMPARTIDO'));
  const [elegidas, setElegidas] = useState<Set<number>>(new Set());
  const [form, setForm] = useState({ firstName: '', lastName: '', gender: 'FEMALE' as Genero, communityId: String(p.communityId), address: '' });
  const [nacimiento, setNacimiento] = useState<Nacimiento>({ fecha: '', estimada: true });

  /** Elige las visitas de un grupo y llena la ficha nueva con lo que dicen sus filas. */
  const elegirGrupo = (i: number) => {
    const g = grupos[i];
    setElegidas(new Set(g.ids));
    const filas = visitas.filter((v) => g.ids.includes(v.id) && v.origen).map((v) => v.origen!);
    setForm((f) => ({
      ...f,
      firstName: moda(filas.map((o) => o.nombre ?? '').filter(Boolean)) ?? '',
      lastName: moda(filas.map((o) => o.apellido ?? '').filter(Boolean)) ?? '',
      gender: g.sexo ?? f.gender,
      address: moda(filas.map((o) => o.casa ?? '').filter(Boolean)) ?? '',
    }));
    if (g.nacimiento) setNacimiento({ fecha: `${Math.round((g.nacimiento[0] + g.nacimiento[1]) / 2)}-01-01`, estimada: true });
  };

  const separar = useMutation({
    mutationFn: () =>
      separarPaciente(p.id, {
        visitIds: [...elegidas],
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        gender: form.gender,
        birthDate: new Date(`${nacimiento.fecha}T00:00:00Z`).toISOString(),
        birthDateIsEstimated: nacimiento.estimada,
        communityId: Number(form.communityId),
        address: form.address.trim() || undefined,
      }),
    onSuccess: (r) => {
      invalidar();
      toast.success(`Ficha nueva ${r.nuevo.codigo} · ${r.nuevo.nombre} con ${elegidas.size} visitas`, {
        action: { label: 'Ver ficha', onClick: () => navegar(`/pacientes/${r.nuevo.id}`) },
      });
      setElegidas(new Set());
      // Si ya no quedan dos personas mezcladas, el caso se cierra solo.
      if (grupos.length <= 2) navegar('/revision?tipo=COMPARTIDO');
    },
    onError: (e) => toast.error(e.message),
  });

  const listo = elegidas.size > 0 && elegidas.size < visitas.length && form.firstName.trim() && nacimiento.fecha;
  const actual = normal(`${p.firstName} ${p.lastName}`);

  return (
    <>
      <EncabezadoPaciente p={p} titulo="Separar visitas de otra persona" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {grupos.map((g, i) => {
              const esLaFicha = normal(g.nombre) === actual || g.variantes.some((v) => normal(v.nombre) === actual);
              return (
                <div key={i} className="rounded-xl border border-borde bg-superficie p-4" style={{ borderLeft: `4px solid ${COLORES[i % COLORES.length]}` }}>
                  <p className="font-medium">{g.nombre}</p>
                  <p className="mt-1 text-xs text-tenue">
                    {g.visitas} visitas · {g.sexo ? GENEROS[g.sexo] : 'sexo sin dato'} · {g.nacimiento ? `nacido hacia ${g.nacimiento[0] === g.nacimiento[1] ? g.nacimiento[0] : `${g.nacimiento[0]}–${g.nacimiento[1]}`}` : 'sin edad'}
                    <br />
                    {fecha(g.desde)} → {fecha(g.hasta)}
                  </p>
                  {g.variantes.length > 1 && <p className="mt-1 text-xs text-tenue">También: {g.variantes.slice(1).map((v) => v.nombre).join(', ')}</p>}
                  {esLaFicha ? (
                    <p className="mt-3 text-xs font-medium text-green-700">Es el nombre de esta ficha: se queda aquí</p>
                  ) : (
                    <Boton variante="secundario" className="mt-3 h-8 text-xs" onClick={() => elegirGrupo(i)}>
                      Pasar a ficha nueva
                    </Boton>
                  )}
                </div>
              );
            })}
          </div>

          <Tarjeta titulo="Visitas" accion={<span className="text-xs text-tenue">Marca las que son de la otra persona</span>}>
            <Tabla columnas={['', 'Fecha', 'Nombre anotado', 'Sexo', 'Edad', 'Casa', 'PA', 'Atendió', 'Medicamentos']}>
              {visitas.map((v) => {
                const marcada = elegidas.has(v.id);
                return (
                  <tr
                    key={v.id}
                    onClick={() => setElegidas((s) => (s.has(v.id) ? new Set([...s].filter((x) => x !== v.id)) : new Set([...s, v.id])))}
                    className={cn('cursor-pointer hover:bg-fondo', marcada && 'bg-marca-50')}
                  >
                    <td className="px-5 py-2.5">
                      <span className="flex items-center gap-2">
                        <input type="checkbox" readOnly checked={marcada} className="accent-tinta" />
                        <span className="size-2.5 rounded-full" style={{ backgroundColor: v.grupo >= 0 ? COLORES[v.grupo % COLORES.length] : '#d6d3d1' }} />
                      </span>
                    </td>
                    <td className="px-5 py-2.5 whitespace-nowrap">{fecha(v.visitDate)}</td>
                    <td className="px-5 py-2.5 whitespace-nowrap">{v.origen ? `${v.origen.nombre ?? ''} ${v.origen.apellido ?? ''}` : <span className="text-tenue">(registrada en la app)</span>}</td>
                    <td className="px-5 py-2.5">{v.origen?.sexo ? GENEROS[v.origen.sexo][0] : '—'}</td>
                    <td className="px-5 py-2.5 whitespace-nowrap">{v.origen?.edad ?? '—'}</td>
                    <td className="px-5 py-2.5">{v.origen?.casa ?? '—'}</td>
                    <td className="px-5 py-2.5 whitespace-nowrap">
                      <span className="tabular mr-1.5 font-mono">{presionDe(v)}</span>
                      {v.bpClassification && <InsigniaCategoria config={v.bpClassification} />}
                    </td>
                    <td className="px-5 py-2.5 whitespace-nowrap text-tenue">{v.doctorNombre ?? '—'}</td>
                    <td className="px-5 py-2.5 text-xs text-tenue">{v.prescriptions.map((r) => `${r.medication.name} ${r.medication.concentration}`).join(', ') || '—'}</td>
                  </tr>
                );
              })}
            </Tabla>
          </Tarjeta>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Tarjeta titulo="Ficha nueva">
            <div className="grid grid-cols-2 gap-4 p-5">
              <Campo etiqueta="Nombre">
                <Entrada value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </Campo>
              <Campo etiqueta="Apellido">
                <Entrada value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </Campo>
              <Campo etiqueta="Sexo">
                <Selector opciones={opciones(GENEROS)} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as Genero })} />
              </Campo>
              <Campo etiqueta="Casa">
                <Entrada value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </Campo>
              <CamposNacimiento valor={nacimiento} alCambiar={setNacimiento} />
              <Campo etiqueta="Batey" className="col-span-2" ayuda="Recibe el siguiente código libre de este batey.">
                <Selector
                  opciones={(comunidades.data ?? []).filter((c) => c.isActive || c.id === p.communityId).map((c) => ({ value: c.id, label: c.name }))}
                  value={form.communityId}
                  onChange={(e) => setForm({ ...form, communityId: e.target.value })}
                />
              </Campo>
            </div>
            <div className="space-y-2 border-t border-borde p-5">
              <Boton className="w-full" icono={<Split className="size-4" />} disabled={!listo} cargando={separar.isPending} onClick={() => separar.mutate()}>
                Separar {elegidas.size || ''} {elegidas.size === 1 ? 'visita' : 'visitas'}
              </Boton>
              {elegidas.size === visitas.length && <p className="text-xs text-red-600">Deja al menos una visita en {p.patientCode}.</p>}
              {caso && (
                <Boton
                  variante="fantasma"
                  className="w-full text-xs"
                  onClick={() => descartar(caso, 'Es la misma persona', 'Todas las visitas son de la misma persona: el caso no volverá a aparecer.')}
                >
                  Todas son de la misma persona
                </Boton>
              )}
            </div>
          </Tarjeta>
        </aside>
      </div>
    </>
  );
}

const normal = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/* ───────────── Corregir nombre, sexo o edad: /revision/corregir/:id ───────────── */

export function CorregirPaciente() {
  const id = Number(useParams().id);
  const consulta = useRevisionPaciente(id);
  if (consulta.isPending) return <Cargando />;
  if (consulta.isError) return <ErrorCarga error={consulta.error} />;
  return <Corregir datos={consulta.data} />;
}

function Corregir({ datos }: { datos: RevisionPaciente }) {
  const { paciente: p, visitas } = datos;
  const [params] = useSearchParams();
  const clave = params.get('caso') ?? `VARIANTES:${p.id}`;
  const navegar = useNavigate();
  const invalidar = useInvalidar();
  const descartar = useDescartar(() => navegar(`/revision?tipo=${clave.split(':')[0]}`));
  const [form, setForm] = useState({ firstName: p.firstName, lastName: p.lastName, gender: p.gender });
  const [nacimiento, setNacimiento] = useState<Nacimiento>({ fecha: soloFecha(p.birthDate), estimada: p.birthDateIsEstimated });

  // Formas en que se anotó, con cuántas visitas cada una
  const { formas, sexos, edades } = useMemo(() => {
    const formas = new Map<string, { nombre: string; apellido: string; n: number }>();
    const sexos = new Map<Genero, number>();
    const edades = new Map<string, number>();
    for (const v of visitas) {
      if (!v.origen) continue;
      const k = `${v.origen.nombre ?? ''}|${v.origen.apellido ?? ''}`;
      formas.set(k, { nombre: v.origen.nombre ?? '', apellido: v.origen.apellido ?? '', n: (formas.get(k)?.n ?? 0) + 1 });
      if (v.origen.sexo) sexos.set(v.origen.sexo, (sexos.get(v.origen.sexo) ?? 0) + 1);
      if (v.origen.edad) edades.set(v.origen.edad, (edades.get(v.origen.edad) ?? 0) + 1);
    }
    return { formas: [...formas.values()].sort((a, b) => b.n - a.n), sexos: [...sexos.entries()], edades: [...edades.entries()].sort((a, b) => b[1] - a[1]) };
  }, [visitas]);

  const guardar = useMutation({
    mutationFn: () => {
      const nacio = nacimiento.fecha ? new Date(`${nacimiento.fecha}T00:00:00Z`).toISOString() : undefined;
      return corregirPaciente(p.id, {
        clave,
        ...(form.firstName.trim() !== p.firstName && { firstName: form.firstName.trim() }),
        ...(form.lastName.trim() !== p.lastName && { lastName: form.lastName.trim() }),
        ...(form.gender !== p.gender && { gender: form.gender }),
        ...(nacio && soloFecha(nacio) !== soloFecha(p.birthDate) && { birthDate: nacio, birthDateIsEstimated: nacimiento.estimada }),
      });
    },
    onSuccess: () => {
      invalidar();
      toast.success('Ficha corregida. El cambio quedó en Auditoría.');
      navegar(`/revision?tipo=${clave.split(':')[0]}`);
    },
    onError: (e) => toast.error(e.message === 'No hay nada que corregir' ? 'No cambiaste nada. Si está bien así, usa "Está bien así".' : e.message),
  });

  return (
    <>
      <EncabezadoPaciente p={p} titulo="Corregir datos del paciente" />
      <div className="grid max-w-5xl gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          {formas.length > 0 && (
            <Tarjeta titulo="Cómo se anotó el nombre" accion={<span className="text-xs text-tenue">Toca una para usarla</span>}>
              <ul className="divide-y divide-borde">
                {formas.map((f) => {
                  const igual = f.nombre === form.firstName && f.apellido === form.lastName;
                  return (
                    <li key={`${f.nombre}|${f.apellido}`}>
                      <button
                        onClick={() => setForm({ ...form, firstName: f.nombre, lastName: f.apellido })}
                        className={cn('flex w-full items-center justify-between px-5 py-2.5 text-left text-sm hover:bg-fondo', igual && 'bg-marca-50 font-medium')}
                      >
                        <span>
                          {f.nombre} <span className="text-tenue">{f.apellido}</span>
                        </span>
                        <span className="tabular flex items-center gap-2 text-xs text-tenue">
                          {f.n} {f.n === 1 ? 'visita' : 'visitas'} {igual && <Check className="size-4 text-green-700" />}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Tarjeta>
          )}
          {(sexos.length > 0 || edades.length > 0) && (
            <Tarjeta titulo="Otros datos anotados">
              <dl className="space-y-3 p-5 text-sm">
                {sexos.length > 0 && (
                  <div>
                    <dt className="text-xs text-tenue">Sexo</dt>
                    <dd>{sexos.map(([s, n]) => `${GENEROS[s]} (${n})`).join(' · ')}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-tenue">Edad</dt>
                  <dd>{edades.length ? edades.slice(0, 8).map(([e, n]) => `${e} (${n})`).join(' · ') : 'Nunca se anotó'}</dd>
                </div>
              </dl>
            </Tarjeta>
          )}
        </div>

        <Tarjeta titulo="Cómo debe quedar">
          <div className="grid grid-cols-2 gap-4 p-5">
            <Campo etiqueta="Nombre">
              <Entrada value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </Campo>
            <Campo etiqueta="Apellido">
              <Entrada value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </Campo>
            <Campo etiqueta="Sexo" className="col-span-2">
              <Selector opciones={opciones(GENEROS)} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as Genero })} />
            </Campo>
            <CamposNacimiento valor={nacimiento} alCambiar={setNacimiento} />
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-borde p-5">
            <Boton variante="fantasma" onClick={() => descartar(clave, 'Está bien así', 'Los datos de la ficha se quedan como están y el caso no vuelve a aparecer.')}>
              Está bien así
            </Boton>
            <Boton cargando={guardar.isPending} disabled={!form.firstName.trim()} onClick={() => guardar.mutate()}>
              Guardar corrección
            </Boton>
          </div>
        </Tarjeta>
      </div>
    </>
  );
}

/* ───────────── Unir: /revision/unir?a=&b= ───────────── */

export function UnirPacientes() {
  const [params, setParams] = useSearchParams();
  const a = Number(params.get('a')) || undefined;
  const b = Number(params.get('b')) || undefined;
  const pa = usePaciente(a);
  const pb = usePaciente(b);
  if (!a) return <Vacio titulo="Falta el paciente">Abre esta pantalla desde la ficha de un paciente o desde Revisión de datos.</Vacio>;
  if (pa.isPending || (b && pb.isPending)) return <Cargando />;
  if (!pa.data) return <Vacio titulo="Paciente no encontrado" />;
  if (!b || !pb.data) return <ElegirOtro a={pa.data} alElegir={(id) => setParams((p) => (p.set('b', String(id)), p), { replace: true })} />;
  return <Unir a={pa.data} b={pb.data} caso={params.get('caso')} />;
}

function ElegirOtro({ a, alElegir }: { a: Paciente; alElegir: (id: number) => void }) {
  const [busqueda, setBusqueda] = useState(a.lastName || a.firstName);
  const lista = usePacientes({ page: 1, limit: 10, search: busqueda.trim() || undefined });
  return (
    <>
      <EncabezadoPagina titulo={`Unir a ${nombreCompleto(a)} con…`} descripcion="Busca la otra ficha de la misma persona." volver={{ a: `/pacientes/${a.id}`, texto: nombreCompleto(a) }} />
      <Tarjeta className="max-w-3xl">
        <div className="relative border-b border-borde p-4">
          <Search className="absolute top-1/2 left-7 size-4 -translate-y-1/2 text-tenue" />
          <Entrada autoFocus className="pl-9" placeholder="Nombre o código" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
        {lista.isPending ? (
          <Cargando />
        ) : (
          <ul className="divide-y divide-borde">
            {(lista.data?.data ?? [])
              .filter((x) => x.id !== a.id)
              .map((x) => (
                <li key={x.id}>
                  <button onClick={() => alElegir(x.id)} className="flex w-full items-center gap-4 px-5 py-3 text-left hover:bg-fondo">
                    <span className="w-20 font-mono text-xs text-tenue">{x.patientCode}</span>
                    <span className="flex-1 font-medium">{nombreCompleto(x)}</span>
                    <span className="text-xs text-tenue">
                      {x.community?.name} · {edadTexto(x)} · {GENEROS[x.gender]}
                    </span>
                    <ArrowRight className="size-4 text-tenue" />
                  </button>
                </li>
              ))}
          </ul>
        )}
      </Tarjeta>
    </>
  );
}

function Unir({ a, b, caso }: { a: Paciente; b: Paciente; caso: string | null }) {
  const navegar = useNavigate();
  const confirmar = useConfirmar();
  const invalidar = useInvalidar();
  const descartar = useDescartar(() => navegar('/revision?tipo=DUPLICADO'));
  const va = a.clinicalVisits ?? [];
  const vb = b.clinicalVisits ?? [];
  // Por defecto se conserva la ficha con más visitas (o la más antigua).
  const [conservar, setConservar] = useState(vb.length > va.length ? b.id : a.id);
  const [keep, drop] = conservar === a.id ? [a, b] : [b, a];

  const unir = useMutation({
    mutationFn: () => unirPacientes(keep.id, drop.id),
    onSuccess: () => {
      invalidar();
      toast.success(`${drop.patientCode} se unió a ${keep.patientCode}. Se puede deshacer desde Auditoría.`);
      navegar(`/pacientes/${keep.id}`);
    },
    onError: (e) => toast.error(e.message),
  });
  const pedir = async () => {
    const ok = await confirmar({
      titulo: `¿Unir ${drop.patientCode} dentro de ${keep.patientCode}?`,
      mensaje: `Las ${(drop === a ? va : vb).length} visitas de ${drop.patientCode} pasan a ${keep.patientCode} y la ficha ${drop.patientCode} se elimina. Teléfono, cédula y casa se copian si ${keep.patientCode} no los tiene. Se puede deshacer desde Auditoría.`,
      confirmar: 'Unir fichas',
      peligro: false,
    });
    if (ok) unir.mutate();
  };

  const filas: [string, (p: Paciente, v: Visita[]) => string][] = [
    ['Código', (p) => p.patientCode],
    ['Nombre', (p) => nombreCompleto(p)],
    ['Batey', (p) => p.community?.name ?? '—'],
    ['Sexo', (p) => GENEROS[p.gender]],
    ['Edad', (p) => edadTexto(p)],
    ['Casa', (p) => p.address ?? '—'],
    ['Teléfono', (p) => p.phoneNumber ?? '—'],
    ['Visitas', (_, v) => String(v.length)],
    ['Primera visita', (_, v) => fecha(v[v.length - 1]?.visitDate)],
    ['Última visita', (_, v) => fecha(v[0]?.visitDate)],
    ['Última PA', (p) => (p.lastSystolic ? `${p.lastSystolic}/${p.lastDiastolic}` : '—')],
    ['Último que atendió', (p) => p.lastDoctorNombre ?? '—'],
  ];
  // Si los dos tienen visitas el mismo día, casi seguro son dos personas.
  const diasA = new Set(va.map((v) => soloFecha(v.visitDate)));
  const coinciden = vb.filter((v) => diasA.has(soloFecha(v.visitDate))).length;

  return (
    <>
      <EncabezadoPagina titulo="¿Es la misma persona?" descripcion="Compara las dos fichas. Si son la misma persona, elige cuál se conserva." volver={{ a: '/revision?tipo=DUPLICADO', texto: 'Revisión de datos' }} />
      {coinciden > 0 && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
          Ojo: las dos fichas tienen visitas el mismo día ({coinciden}). Lo más probable es que sean dos personas.
        </p>
      )}
      <Tarjeta className="max-w-4xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-borde">
                <th className="w-40 px-5 py-3" />
                {[a, b].map((p) => (
                  <th key={p.id} className="px-5 py-3 text-left">
                    <label className={cn('flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2', conservar === p.id ? 'border-tinta bg-marca-50' : 'border-borde')}>
                      <input type="radio" className="accent-tinta" checked={conservar === p.id} onChange={() => setConservar(p.id)} />
                      <span className="font-medium">{conservar === p.id ? 'Se conserva' : 'Se une y desaparece'}</span>
                    </label>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map(([t, f]) => {
                const x = f(a, va);
                const y = f(b, vb);
                return (
                  <tr key={t} className="border-b border-borde last:border-0">
                    <td className="px-5 py-2.5 text-xs text-tenue">{t}</td>
                    <td className={cn('px-5 py-2.5', x !== y && 'font-medium')}>{t === 'Código' ? <Link to={`/pacientes/${a.id}`} className="font-mono hover:underline">{x}</Link> : x}</td>
                    <td className={cn('px-5 py-2.5', x !== y && 'font-medium')}>{t === 'Código' ? <Link to={`/pacientes/${b.id}`} className="font-mono hover:underline">{y}</Link> : y}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-borde p-5">
          {caso && (
            <Boton variante="fantasma" onClick={() => descartar(caso, 'Son dos personas distintas', 'El par no volverá a aparecer como posible duplicado.')}>
              Son personas distintas
            </Boton>
          )}
          <Boton icono={<GitMerge className="size-4" />} cargando={unir.isPending} onClick={pedir}>
            Unir en {keep.patientCode}
          </Boton>
        </div>
      </Tarjeta>
    </>
  );
}
