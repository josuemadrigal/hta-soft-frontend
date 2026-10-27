import { useQuery } from '@tanstack/react-query';
import { Check, Search, Users, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useAsistenciaJornadas, useComunidades, useMedico, useMetas } from '../api/consultas';
import { pacientesDeDonantes, pacientesDeEntregas, pacientesDeMeta, pacientesDeMedico, pacientesDePlanilla, pacientesDeResumen, pacientesDeRonda, type PacienteDeCifra } from '../api/recursos';
import type { FiltroReporte, Genero } from '../api/tipos';
import { describirCifra, explicarCifra, leerCifra } from '../lib/cifras';
import { useFiltroPeriodo } from '../components/FiltroPeriodo';
import { COLUMNAS_PLANILLA } from '../components/TablaPlanilla';
import { Boton, Cargando, EncabezadoPagina, Entrada, ErrorCarga, Insignia, Selector, Tabla, Tarjeta, Vacio } from '../components/ui';
import { CATEGORIAS, colorCategoria, MOTIVOS_REPOSICION } from '../lib/etiquetas';
import { cn, edadTexto, fecha, fechaDia, nombreCompleto } from '../lib/formato';
import { coincide } from '../lib/busqueda';

/** Qué es cada cifra de la ronda y cómo se cuenta (la misma regla que la tabla). */
const RONDA: Record<string, { titulo: string; explica: string }> = {
  regulares: { titulo: 'Regulares', explica: 'Pacientes activos que se han perdido como mucho las visitas que se fijan en Configuración. Los que nunca han venido cuentan si se registraron en ese tiempo.' },
  vistos: { titulo: 'Vistos en la ronda', explica: 'Regulares que ya vinieron a consulta en este trimestre.' },
  tratamiento: { titulo: 'Con tratamiento dejado', explica: 'No vinieron a consulta en este trimestre, pero se les dejó el tratamiento (reposición sin consulta). Cuentan como atendidos en la ronda; no tienen toma de presión.' },
  atendidos: { titulo: 'Atendidos en la ronda', explica: 'Regulares que vinieron a consulta en este trimestre o a los que se les dejó el tratamiento. Es lo que avanza la ronda en el panel.' },
  seguimiento: { titulo: 'En seguimiento', explica: 'Regulares que vinieron en los últimos 6 meses: los vistos en esta ronda y los que todavía no vienen en ella. No cuenta a quienes solo se les dejó el tratamiento.' },
  faltan: { titulo: 'Todavía no vienen en esta ronda', explica: 'Regulares que no han venido este trimestre. "Faltan" en la tabla es cuántos de ellos hacen falta para llegar a lo esperado; aquí están todos, primero a los que les toca.' },
  dejaron: { titulo: 'Dejaron de venir', explica: 'Regulares que llevan más de 6 meses sin venir: todavía se pueden recuperar.' },
  yaNoVienen: { titulo: 'Ya no vienen', explica: 'Se perdieron más visitas de las que se fijan en Configuración: no cuentan en la ronda.' },
};

const ESTADOS: Record<NonNullable<PacienteDeCifra['estado']>, { texto: string; color?: string }> = {
  visto: { texto: 'Vino en la ronda', color: '#15803d' },
  tratamiento: { texto: 'Tratamiento dejado', color: '#7a5c00' },
  'le-toca': { texto: 'Le toca' },
  'sin-venir': { texto: 'Más de 6 meses sin venir', color: '#b45309' },
  'sin-visitas': { texto: 'Nunca ha venido', color: '#b45309' },
  'ya-no-viene': { texto: 'Ya no viene', color: '#b91c1c' },
};
const ORDEN_ESTADO = ['le-toca', 'sin-visitas', 'sin-venir', 'tratamiento', 'visto', 'ya-no-viene'];

const EXPLICA_PLANILLA: Record<string, string> = {
  evaluados: 'Pacientes con al menos una visita en el periodo.',
  enPrograma: 'Los regulares del batey, de donde salen los existentes: la planilla usa la media alta de sus jornadas.',
  conToma: 'Evaluados a los que se les tomó la presión.',
  existentesConMedicamento: 'Evaluados que recibieron receta en el periodo, nuevos incluidos.',
  controlados: 'De los que recibieron receta (nuevos incluidos), su última toma del periodo quedó por debajo de 140/90.',
  noControlados: 'De los que recibieron receta (nuevos incluidos), su última toma del periodo quedó en 140/90 o más.',
  datosDudosos: 'Evaluados (nuevos incluidos) cuya última visita no tiene toma o tiene números que no cuadran.',
  nuevos: 'Su primera visita de siempre fue en este periodo. También cuentan en las demás columnas.',
  nuevosConMedicamento: 'Pacientes nuevos que recibieron receta. También cuentan en "con medicamentos".',
};

const CORTO = new Intl.DateTimeFormat('es-DO', { day: 'numeric', month: 'short', year: 'numeric' });
const textoPeriodo = (desde: string, hasta: string) => {
  const d = (s: string) => CORTO.format(new Date(`${s}T12:00:00`));
  return desde === hasta ? d(desde) : `${d(desde)} – ${d(hasta)}`;
};

/**
 * /reportes/pacientes — los pacientes detrás de una cifra de la planilla o de la ronda.
 * ?fuente=planilla|ronda|donantes &columna= &batey= (sin batey, todos) &desde= &hasta= (solo planilla)
 * &anio= &t= (solo donantes: trimestre 1–4 o "anual")
 */
export function PacientesDeCifra() {
  const [params] = useSearchParams();
  const fuente = (['ronda', 'donantes', 'resumen', 'metas', 'entregas'].includes(params.get('fuente') ?? '') ? params.get('fuente') : 'planilla') as Fuente;
  const anio = Number(params.get('anio')) || new Date().getFullYear();
  const t = params.get('t') === 'anual' ? undefined : Number(params.get('t')) || undefined;
  const columna = params.get('columna') ?? '';
  const batey = Number(params.get('batey')) || undefined;
  const desde = params.get('desde') ?? '';
  const hasta = params.get('hasta') || desde;
  const comunidades = useComunidades();
  const nombreBatey = batey ? (comunidades.data?.find((c) => c.id === batey)?.name ?? '…') : 'Todos los bateyes';

  if (fuente === 'ronda' && columna === 'esperados') return <Esperados batey={batey} nombreBatey={nombreBatey} />;
  if (fuente === 'entregas') {
    const cifra = params.get('cifra') ?? '';
    const atras = new URLSearchParams(params);
    for (const k of ['fuente', 'cifra']) atras.delete(k);
    return (
      <>
        <EncabezadoPagina
          titulo={describirEntregas(cifra, (id) => comunidades.data?.find((x) => x.id === id)?.name ?? '…')}
          descripcion={`Entregas de medicamentos · ${cifra.includes('pendientes') ? 'pendiente hoy' : textoPeriodo(desde, hasta)}${batey ? ` · ${nombreBatey}` : ''}`}
          volver={{ a: `/reportes/entregas?${atras}`, texto: 'Entregas de medicamentos' }}
        />
        <p className="-mt-2 mb-4 max-w-3xl text-sm text-tenue">
          {cifra.includes('pendientes')
            ? 'Recetas con pastillas que todavía no se han entregado (no depende de las fechas). "Aporte" trae las pastillas que se le deben.'
            : 'Cada paciente con las entregas y pastillas netas que suma (ya restadas las devueltas). La visita que se muestra es la de su última entrega, si la tuvo.'}
        </p>
        <Listado fuente="entregas" columna={cifra} filtro={{ from: desde, to: hasta, communityId: batey }} desde="" hasta="" />
      </>
    );
  }
  if (fuente === 'metas')
    return <PacientesDeMetas anio={anio} t={t} batey={batey} indicador={columna} nombreBatey={batey ? nombreBatey : undefined} deDonantes={params.get('de') === 'donantes'} nombreDe={(id) => comunidades.data?.find((x) => x.id === id)?.name ?? '…'} />;
  if (fuente === 'resumen') {
    const cifra = params.get('cifra') ?? '';
    const c = leerCifra(cifra);
    const nombre = (id: number) => comunidades.data?.find((x) => x.id === id)?.name ?? '…';
    const filtro: FiltroReporte = {
      from: desde || undefined,
      to: params.get('hasta') || undefined,
      communityId: batey,
      gender: (params.get('genero') as Genero) || undefined,
      ageMin: params.get('edadMin') ? Number(params.get('edadMin')) : undefined,
      ageMax: params.get('edadMax') ? Number(params.get('edadMax')) : undefined,
    };
    const atras = new URLSearchParams(params);
    for (const k of ['fuente', 'cifra']) atras.delete(k);
    return (
      <>
        <EncabezadoPagina
          titulo={describirCifra(c, nombre)}
          descripcion={`Reportes · ${desde ? textoPeriodo(desde, hasta) : 'últimos 12 meses'}${batey && !c.batey ? ` · ${nombreBatey}` : ''}`}
          volver={{ a: `/reportes?${atras}`, texto: 'Reportes' }}
        />
        <p className="-mt-2 mb-4 max-w-3xl text-sm text-tenue">{explicarCifra(c)}</p>
        <Listado fuente="resumen" columna={cifra} filtro={filtro} desde="" hasta="" />
      </>
    );
  }

  const col = fuente === 'planilla' ? COLUMNAS_PLANILLA.find((c) => c.clave === columna) : null;
  if (fuente === 'donantes') {
    const [grupo, valor] = columna.includes(':') ? columna.split(':') : [columna, ''];
    const d = DONANTES[grupo];
    const etiqueta = t ? `T${t} ${anio}` : `Año ${anio}`;
    return (
      <>
        <EncabezadoPagina
          titulo={valor ? `${d?.titulo ?? ''}: ${valor}` : (d?.titulo ?? 'Informe para donantes')}
          descripcion={`Informe para donantes · ${etiqueta}`}
          volver={{ a: `/reportes/donantes?anio=${anio}&t=${t ?? 'anual'}`, texto: 'Informe para donantes' }}
        />
        {d?.explica && <p className="-mt-2 mb-4 max-w-3xl text-sm text-tenue">{d.explica}</p>}
        <Listado fuente={fuente} columna={columna} desde="" hasta="" anio={anio} t={t} />
      </>
    );
  }

  const titulo = fuente === 'planilla' ? (col ? col.es.replace(/^# de /, '').replace(/^pacientes /, '').replace(/^./, (l) => l.toUpperCase()) : 'Planilla') : (RONDA[columna]?.titulo ?? 'Ronda');
  const explica = fuente === 'planilla' ? EXPLICA_PLANILLA[columna] : RONDA[columna]?.explica;
  const contexto = fuente === 'planilla' ? `Planilla de la jornada · ${textoPeriodo(desde, hasta)}` : 'Ronda de este trimestre';

  return (
    <>
      <EncabezadoPagina titulo={titulo} descripcion={`${nombreBatey} · ${contexto}`} volver={{ a: '/reportes', texto: 'Reportes' }} />
      {explica && <p className="-mt-2 mb-4 max-w-3xl text-sm text-tenue">{explica}</p>}
      <Listado fuente={fuente} columna={columna} batey={batey} desde={desde} hasta={hasta} />
    </>
  );
}

type Fuente = 'planilla' | 'ronda' | 'donantes' | 'medico' | 'resumen' | 'metas' | 'entregas';

/** Las cifras del análisis del informe para donantes: "grupo" o "grupo:valor" (tiempo:Primera vez). */
const DONANTES: Record<string, { titulo: string; explica: string }> = {
  conToma: { titulo: 'Pacientes con toma en el periodo', explica: 'Los que entran en la presión promedio del grupo: su última toma del periodo.' },
  volvieron: { titulo: 'Volvieron a su consulta', explica: 'Se vieron en el periodo anterior y volvieron en este.' },
  noVolvieron: { titulo: 'No volvieron', explica: 'Se vieron en el periodo anterior y no han vuelto en este. Se muestra su última visita.' },
  siguen: { titulo: 'Los que siguen en el programa', explica: 'Tienen toma en el periodo y en los 12 meses anteriores: con ellos se mide si mejoran.' },
  mejoraron: { titulo: 'Mejoraron su clasificación', explica: 'Su última toma del periodo es mejor que la última de los 12 meses anteriores.' },
  igual: { titulo: 'Siguieron igual', explica: 'Su última toma del periodo tiene la misma clasificación que la última de los 12 meses anteriores.' },
  empeoraron: { titulo: 'Empeoraron su clasificación', explica: 'Su última toma del periodo es peor que la última de los 12 meses anteriores.' },
  tiempo: { titulo: 'Tiempo en el programa', explica: 'Desde su primera consulta hasta su última toma del periodo.' },
  edad: { titulo: 'Edad', explica: 'Pacientes de ese grupo de edad con toma en el periodo.' },
  sexo: { titulo: 'Sexo', explica: 'Pacientes con toma en el periodo.' },
};

function Listado({
  fuente,
  columna,
  batey,
  desde,
  hasta,
  anio,
  t,
  medicoId,
  filtro,
}: {
  fuente: Fuente;
  columna: string;
  batey?: number;
  desde: string;
  hasta: string;
  anio?: number;
  t?: number;
  medicoId?: number;
  filtro?: FiltroReporte;
}) {
  const consulta = useQuery({
    queryKey: ['reportes', 'cifra', fuente, columna, batey, desde, hasta, anio, t, medicoId, filtro],
    queryFn: () =>
      fuente === 'entregas'
        ? pacientesDeEntregas({ desde: filtro?.from, hasta: filtro?.to, communityId: filtro?.communityId, cifra: columna })
        : fuente === 'metas'
        ? pacientesDeMeta(anio!, { indicador: columna, t, batey })
        : fuente === 'resumen'
        ? pacientesDeResumen({ ...filtro, cifra: columna })
        : fuente === 'medico'
        ? pacientesDeMedico(medicoId!, { from: desde, to: hasta, communityId: batey, columna })
        : fuente === 'planilla'
        ? pacientesDePlanilla({ from: `${desde}T00:00:00-04:00`, to: `${hasta}T23:59:59-04:00`, columna, communityId: batey })
        : fuente === 'donantes'
          ? pacientesDeDonantes({ anio: anio!, trimestre: t, columna })
          : pacientesDeRonda({ columna, communityId: batey }),
  });
  const [buscar, setBuscar] = useState('');
  const [medico, setMedico] = useState('');
  const [presion, setPresion] = useState('');
  const [medicamento, setMedicamento] = useState('');
  const navegar = useNavigate();

  if (consulta.isPending) return <Cargando forma="lista" texto="Buscando los pacientes…" />;
  if (consulta.isError) return <ErrorCarga error={consulta.error} />;

  const todos = consulta.data;
  const q = buscar.trim().toLowerCase();
  const filas = todos
    .filter((p) => {
      if (q && !coincide(q, p)) return false;
      if (medico && p.atendio !== medico) return false;
      if (medicamento === 'sin' ? p.tratamiento.length > 0 : medicamento && !p.tratamiento.some((t) => t.medicamento === medicamento)) return false;
      const c = p.categoria;
      if (presion === 'controlados' && !(c === 'NORMAL' || c === 'ELEVATED')) return false;
      if (presion === 'noControlados' && !(c === 'GRADE_1' || c === 'GRADE_2' || c === 'CRISIS')) return false;
      if (presion === 'sinToma' && c) return false;
      if (presion && !['controlados', 'noControlados', 'sinToma'].includes(presion) && c !== presion) return false;
      return true;
    })
    .sort((a, b) => (fuente === 'ronda' ? ORDEN_ESTADO.indexOf(a.estado ?? '') - ORDEN_ESTADO.indexOf(b.estado ?? '') : 0));
  const variosBateyes = new Set(todos.map((p) => p.community.id)).size > 1;
  const conEstado = (fuente === 'ronda' && columna !== 'vistos' && columna !== 'yaNoVienen' && columna !== 'dejaron') || (fuente === 'metas' && columna === 'cobertura_pct');
  // Las opciones salen de la lista misma, con cuántos tiene cada una.
  const contar = (xs: string[]) => [...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  // En la lista de un médico, todos los atendió él: no hace falta ni el filtro ni la columna.
  const conMedico = fuente !== 'medico';
  const medicos = conMedico ? contar(todos.flatMap((p) => (p.atendio ? [p.atendio] : []))) : [];
  const medicamentos = contar(todos.flatMap((p) => [...new Set(p.tratamiento.map((t) => t.medicamento))]));
  const hayFiltros = !!(q || medico || presion || medicamento);
  const limpiar = () => {
    setBuscar('');
    setMedico('');
    setPresion('');
    setMedicamento('');
  };
  const visitaTexto = (fuente === 'planilla' && columna !== 'enPrograma') || (fuente === 'donantes' && columna !== 'volvieron' && columna !== 'noVolvieron') || fuente === 'medico' || fuente === 'resumen' || (fuente === 'metas' && columna !== 'pacientes_nuevos') ? 'Visita contada' : 'Última visita';
  // Lo que suma la lista (con los filtros puestos), para cotejarlo con la cifra.
  const conAporte = todos.some((p) => p.aporte);
  const sumar = (k: 'visitas' | 'pastillas' | 'entregas') => filas.reduce((a, p) => a + (p.aporte?.[k] ?? 0), 0);
  const deEntregas = fuente === 'entregas';

  return (
    <Tarjeta
      titulo={
        <span className="flex items-center gap-2">
          <Users className="size-4" /> {hayFiltros ? `${filas.length} de ${todos.length}` : todos.length.toLocaleString('es-DO')} {todos.length === 1 ? 'paciente' : 'pacientes'}
          {conAporte && (
            <span className="font-normal text-tenue">
              · {deEntregas ? `${sumar('entregas').toLocaleString('es-DO')} entregas` : `${sumar('visitas').toLocaleString('es-DO')} visitas`} · {sumar('pastillas').toLocaleString('es-DO')} pastillas
            </span>
          )}
        </span>
      }
    >
      {todos.length === 0 ? (
        <Vacio titulo="No hay pacientes en esta cifra" />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b border-borde px-5 py-3">
            <div className="relative min-w-48 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-tenue" />
              <Entrada placeholder="Buscar nombre o código" aria-label="Buscar paciente" className="pl-8" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
            </div>
            {medicos.length > 0 && (
              <Selector className="w-52" aria-label="Lo atendió" vacio="Cualquier médico" value={medico} onChange={(e) => setMedico(e.target.value)} opciones={medicos.map(([m, n]) => ({ value: m, label: `${m} (${n})` }))} />
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
            {medicamentos.length > 0 && (
              <Selector
                className="w-56"
                aria-label="Medicamento"
                vacio="Cualquier tratamiento"
                value={medicamento}
                onChange={(e) => setMedicamento(e.target.value)}
                opciones={[...medicamentos.map(([m, n]) => ({ value: m, label: `${m} (${n})` })), { value: 'sin', label: 'Sin tratamiento' }]}
              />
            )}
            {hayFiltros && (
              <Boton variante="fantasma" icono={<X className="size-4" />} onClick={limpiar}>
                Limpiar
              </Boton>
            )}
          </div>
          <Tabla
            columnas={[
              'Paciente',
              visitaTexto,
              'Presión',
              ...(conMedico ? ['Atendió'] : []),
              'Tratamiento',
              ...(conEstado ? ['Asistencia'] : []),
              ...(conAporte ? [{ texto: 'Aporte', className: 'text-right' }] : []),
            ]}
          >
            {filas.map((p) => (
              <tr key={p.id} onClick={() => navegar(`/pacientes/${p.id}`)} className="cursor-pointer align-top hover:bg-fondo">
                <td className="px-5 py-2.5">
                  <span className="font-medium whitespace-nowrap">{nombreCompleto(p)}</span>
                  <span className="block text-xs whitespace-nowrap text-tenue">
                    <span className="font-mono">{p.patientCode}</span> · {edadTexto(p)}
                    {variosBateyes && ` · ${p.community.name}`}
                  </span>
                </td>
                <td className="px-5 py-2.5 whitespace-nowrap text-tenue">{p.visita ? fecha(p.visita) : 'Nunca ha venido'}</td>
                <td className="px-5 py-2.5 whitespace-nowrap">
                  <span className="tabular mr-2 font-mono">{p.presion ?? '—'}</span>
                  {p.categoria ? (
                    <Insignia color={colorCategoria(p.categoria)}>
                      <span className="size-1.5 rounded-full" style={{ backgroundColor: colorCategoria(p.categoria) }} />
                      {CATEGORIAS[p.categoria]}
                    </Insignia>
                  ) : (
                    <span className="text-xs text-tenue">Sin clasificar</span>
                  )}
                </td>
                {conMedico && <td className="px-5 py-2.5 whitespace-nowrap">{p.atendio ?? <span className="text-tenue">—</span>}</td>}
                <td className="px-5 py-2.5">
                  {p.tratamiento.length ? (
                    <ul className="space-y-0.5">
                      {p.tratamiento.map((t, i) => (
                        <li key={i} className="min-w-44">
                          <span className="whitespace-nowrap">{t.medicamento}</span>{' '}
                          <span className="text-xs whitespace-nowrap text-tenue" title={`${t.dosis} al día · ${t.pastillas} pastillas entregadas`}>
                            {t.dosis}/día · {t.pastillas.toLocaleString('es-DO')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-xs text-tenue">Sin tratamiento</span>
                  )}
                </td>
                {conEstado && <td className="px-5 py-2.5">{p.estado && <Insignia color={ESTADOS[p.estado].color}>{ESTADOS[p.estado].texto}</Insignia>}</td>}
                {conAporte && (
                  <td className="tabular px-5 py-2.5 text-right text-xs whitespace-nowrap text-tenue">
                    {p.aporte && (
                      <>
                        {p.aporte.entregas !== undefined ? (
                          p.aporte.entregas > 0 && (
                            <span className="block">
                              {p.aporte.entregas} {p.aporte.entregas === 1 ? 'entrega' : 'entregas'}
                            </span>
                          )
                        ) : (
                          <span className="block">
                            {p.aporte.visitas} {p.aporte.visitas === 1 ? 'visita' : 'visitas'}
                            {p.aporte.visitas === 0 && ' (reposición)'}
                          </span>
                        )}
                        <span className="block">{p.aporte.pastillas.toLocaleString('es-DO')} pastillas</span>
                        {p.aporte.cumplimiento !== null && <span className="block">{Math.round(p.aporte.cumplimiento)}% cumplim.</span>}
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {filas.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-tenue">
                  Nadie coincide con los filtros.
                </td>
              </tr>
            )}
          </Tabla>
        </>
      )}
    </Tarjeta>
  );
}

/** Los logros del médico que abren su lista. */
const MEDICO: Record<string, { titulo: string; explica: string }> = {
  llevoAControl: { titulo: 'Llevó a control', explica: 'Venían sin control en su visita anterior y salieron controlados (< 140/90) con este médico. Se muestra esa visita.' },
  mejoraron: { titulo: 'Mejoraron', explica: 'Su presión bajó de categoría frente a su visita anterior. Se muestra la visita con este médico.' },
  atendidos: { titulo: 'Pacientes atendidos', explica: 'Todos los que atendió en el periodo. Se muestra la última visita con este médico.' },
  controlados: { titulo: 'Controlados', explica: 'Su última toma con este médico en el periodo quedó por debajo de 140/90.' },
  conReceta: { titulo: 'Con receta', explica: 'Pacientes a los que les recetó: de sus recetas sale el cumplimiento promedio.' },
  nuevos: { titulo: 'Pacientes nuevos', explica: 'Su visita de primera vez fue con este médico en el periodo.' },
  domiciliarias: { titulo: 'Visitas domiciliarias', explica: 'Pacientes que atendió en su casa en el periodo.' },
};

/** /medicos/:id/pacientes — los pacientes detrás de un logro del médico o de una de sus jornadas. ?columna= &desde= &hasta= &batey= */
export function PacientesDeMedico() {
  const id = Number(useParams().id);
  const [params] = useSearchParams();
  const columna = params.get('columna') ?? '';
  // El mismo periodo que la ficha del médico (sin fechas en la dirección, el de por defecto).
  const filtro = useFiltroPeriodo();
  const { desde, hasta, communityId: batey } = filtro;
  const medico = useMedico(id, filtro);
  const comunidades = useComunidades();
  const nombre = medico.data?.perfil.nombre ?? '…';
  // Para volver a la ficha del médico con el mismo periodo.
  const atras = new URLSearchParams(params);
  atras.delete('columna');
  const jornada = columna.startsWith('jornada:');

  let titulo = MEDICO[columna]?.titulo ?? 'Pacientes';
  let explica = MEDICO[columna]?.explica;
  if (!jornada && columna.includes(':')) {
    const c = leerCifra(columna);
    titulo = describirCifra(c, (b) => comunidades.data?.find((x) => x.id === b)?.name ?? '…');
    explica = explicarCifra(c);
  }
  if (jornada) {
    const [dia, bateyId] = columna.slice(8).split('|');
    titulo = `Jornada en ${comunidades.data?.find((c) => c.id === Number(bateyId))?.name ?? '…'}`;
    explica = `Los pacientes que atendió el ${CORTO.format(new Date(`${dia}T12:00:00`))}.`;
  }

  return (
    <>
      <EncabezadoPagina titulo={titulo} descripcion={jornada ? nombre : `${nombre} · ${textoPeriodo(desde, hasta)}`} volver={{ a: `/medicos/${id}?${atras.toString()}`, texto: nombre }} />
      {explica && <p className="-mt-2 mb-4 max-w-3xl text-sm text-tenue">{explica}</p>}
      <Listado fuente="medico" medicoId={id} columna={columna} batey={batey} desde={desde} hasta={hasta} />
    </>
  );
}

const VIAS_ENTREGA: Record<string, string> = { visita: 'Entregadas en la visita', mesa: 'Entregadas en la mesa', reposicion: 'Reposición sin consulta' };
/** Título de una cifra del reporte de entregas. */
function describirEntregas(cifra: string, nombreBatey: (id: number) => string) {
  const c = Object.fromEntries(cifra.split(',').filter(Boolean).map((p) => (p.includes(':') ? [p.slice(0, p.indexOf(':')), p.slice(p.indexOf(':') + 1)] : [p, '1'])));
  const partes = [
    c.pendientes && 'Pendientes de entregar',
    c.devueltas && 'Devueltas al inventario',
    c.descartadas && 'Descartadas',
    c.via && VIAS_ENTREGA[c.via],
    c.motivo && `Reposición: ${MOTIVOS_REPOSICION[c.motivo as keyof typeof MOTIVOS_REPOSICION] ?? c.motivo}`,
    c.persona && `Entregó ${c.persona}`,
    c.medicamento,
    c.batey && nombreBatey(Number(c.batey)),
  ].filter(Boolean);
  return partes.length ? partes.join(' · ') : 'Pastillas entregadas';
}

/** Los pacientes de un indicador de Metas: el año o uno de sus trimestres. */
function PacientesDeMetas({
  anio,
  t,
  batey,
  indicador,
  nombreBatey,
  deDonantes,
  nombreDe,
}: {
  anio: number;
  t?: number;
  batey?: number;
  indicador: string;
  nombreBatey?: string;
  /** Abierta desde el informe para donantes: vuelve allá. */
  deDonantes?: boolean;
  nombreDe: (id: number) => string;
}) {
  const metas = useMetas(anio, batey);
  const i = metas.data?.indicadores.find((x) => x.clave === indicador);
  // Las cifras del informe que no son indicadores (pastillas, una categoría, un batey…) usan la regla del resumen.
  const cifra = !i && (indicador.includes(':') || indicador === 'pastillas') ? leerCifra(indicador) : null;
  const notas: Record<string, string> = {
    controlados_pct: 'Los que su última toma del periodo quedó por debajo de 140/90. El % es sobre los que tienen toma.',
    riesgo_pct: 'Los que su última toma del periodo quedó en grado 2 o crisis (≥ 160/100). El % es sobre los que tienen toma.',
    cobertura_pct: 'Los que estaban en seguimiento en los trimestres que se promedian; "Vino en la ronda" si volvió en el trimestre. El % del año es el promedio de los trimestres.',
    cumplimiento_pct: 'Pacientes con recetas que tienen el dato de cumplimiento; la columna "Aporte" trae su promedio.',
    dias_jornada: 'Los días de jornada son días con visitas en un batey (sin domiciliarias). Aquí están los pacientes de esas visitas.',
  };
  return (
    <>
      <EncabezadoPagina
        titulo={cifra ? describirCifra(cifra, nombreDe) : (i?.nombre ?? (metas.isPending ? '…' : 'Pacientes'))}
        descripcion={`${deDonantes ? 'Informe para donantes' : 'Metas'} · ${t ? `T${t} ${anio}` : `Año ${anio}`}${nombreBatey ? ` · ${nombreBatey}` : ''}`}
        volver={deDonantes ? { a: `/reportes/donantes?anio=${anio}&t=${t ?? 'anual'}`, texto: 'Informe para donantes' } : { a: `/metas?anio=${anio}${batey ? `&batey=${batey}` : ''}`, texto: 'Metas' }}
      />
      <p className="-mt-2 mb-4 max-w-3xl text-sm text-tenue">{cifra ? explicarCifra(cifra) : (notas[indicador] ?? i?.descripcion)}</p>
      <Listado fuente="metas" columna={indicador} anio={anio} t={t} batey={batey} desde="" hasta="" />
    </>
  );
}

/** Esperados no son pacientes: son las jornadas recientes del batey y cuáles se promedian. */
function Esperados({ batey, nombreBatey }: { batey?: number; nombreBatey: string }) {
  const asistencia = useAsistenciaJornadas();
  const comunidades = useComunidades();
  if (asistencia.isPending) return <Cargando forma="lista" />;
  if (asistencia.isError) return <ErrorCarga error={asistencia.error} />;
  const bateyes = asistencia.data.filter((a) => !batey || a.communityId === batey);
  const nombre = (id: number) => comunidades.data?.find((c) => c.id === id)?.name ?? '';

  return (
    <>
      <EncabezadoPagina titulo="Esperados" descripcion={`${nombreBatey} · Ronda de este trimestre`} volver={{ a: '/reportes', texto: 'Reportes' }} />
      <p className="-mt-2 mb-4 max-w-3xl text-sm text-tenue">
        Lo que se espera en una jornada es la <strong className="text-tinta">media alta</strong> de las últimas jornadas del batey: el promedio de las que tuvieron más pacientes (marcadas abajo). Cuántas se miran y cuántas se promedian se cambia en Configuración. Una
        jornada es un día con al menos 3 pacientes, sin contar las visitas a domicilio ni la de hoy.
      </p>
      {bateyes.length === 0 && (
        <Tarjeta>
          <Vacio titulo="Este batey todavía no tiene jornadas">Mientras tanto, se esperan todos sus regulares.</Vacio>
        </Tarjeta>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {bateyes.map((a) => {
          // Las mejores (las que se promedian): las de más pacientes.
          const mejores = new Set([...a.jornadas].sort((x, y) => y.pacientes - x.pacientes).slice(0, a.mejores ?? a.jornadas.length).map((j) => j.fecha));
          return (
            <Tarjeta
              key={a.communityId}
              titulo={batey ? `~${a.promedio} pacientes` : nombre(a.communityId)}
              accion={!batey && <span className="tabular text-sm font-semibold">~{a.promedio}</span>}
            >
              <ul className="divide-y divide-borde text-sm">
                {a.jornadas.map((j) => (
                  <li key={j.fecha} className={cn('flex items-center justify-between gap-3 px-5 py-2', !mejores.has(j.fecha) && 'text-tenue')}>
                    <span className="flex items-center gap-2">
                      {mejores.has(j.fecha) ? <Check className="size-4 text-green-700" aria-label="Se promedia" /> : <span className="size-4" />}
                      {fechaDia(j.fecha)}
                    </span>
                    <span className="tabular">{j.pacientes}</span>
                  </li>
                ))}
              </ul>
              <p className="border-t border-borde px-5 py-2.5 text-xs text-tenue">
                Promedio de las {mejores.size} mejores: ~{a.promedio}
                {a.media !== undefined && ` · promedio de todas: ${a.media}`}
              </p>
            </Tarjeta>
          );
        })}
      </div>
    </>
  );
}
