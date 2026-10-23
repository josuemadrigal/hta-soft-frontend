import { useQuery } from '@tanstack/react-query';
import { Check, Search, Users, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useAsistenciaJornadas, useComunidades } from '../api/consultas';
import { pacientesDeDonantes, pacientesDePlanilla, pacientesDeRonda, type PacienteDeCifra } from '../api/recursos';
import { COLUMNAS_PLANILLA } from '../components/TablaPlanilla';
import { Boton, Cargando, EncabezadoPagina, Entrada, ErrorCarga, Insignia, Selector, Tabla, Tarjeta, Vacio } from '../components/ui';
import { CATEGORIAS, colorCategoria } from '../lib/etiquetas';
import { cn, edadTexto, fecha, fechaDia, nombreCompleto } from '../lib/formato';

/** Qué es cada cifra de la ronda y cómo se cuenta (la misma regla que la tabla). */
const RONDA: Record<string, { titulo: string; explica: string }> = {
  regulares: { titulo: 'Regulares', explica: 'Pacientes activos que se han perdido como mucho las visitas que se fijan en Configuración. Los que nunca han venido cuentan si se registraron en ese tiempo.' },
  vistos: { titulo: 'Vistos en la ronda', explica: 'Regulares que ya vinieron a consulta en este trimestre.' },
  tratamiento: { titulo: 'Con tratamiento dejado', explica: 'No vinieron a consulta en este trimestre, pero se les dejó el tratamiento (reposición sin consulta). Cuentan como atendidos en la ronda; no tienen toma de presión.' },
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
  const fuente: Fuente = params.get('fuente') === 'ronda' ? 'ronda' : params.get('fuente') === 'donantes' ? 'donantes' : 'planilla';
  const anio = Number(params.get('anio')) || new Date().getFullYear();
  const t = params.get('t') === 'anual' ? undefined : Number(params.get('t')) || undefined;
  const columna = params.get('columna') ?? '';
  const batey = Number(params.get('batey')) || undefined;
  const desde = params.get('desde') ?? '';
  const hasta = params.get('hasta') || desde;
  const comunidades = useComunidades();
  const nombreBatey = batey ? (comunidades.data?.find((c) => c.id === batey)?.name ?? '…') : 'Todos los bateyes';

  if (fuente === 'ronda' && columna === 'esperados') return <Esperados batey={batey} nombreBatey={nombreBatey} />;

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

type Fuente = 'planilla' | 'ronda' | 'donantes';

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

function Listado({ fuente, columna, batey, desde, hasta, anio, t }: { fuente: Fuente; columna: string; batey?: number; desde: string; hasta: string; anio?: number; t?: number }) {
  const consulta = useQuery({
    queryKey: ['reportes', 'cifra', fuente, columna, batey, desde, hasta, anio, t],
    queryFn: () =>
      fuente === 'planilla'
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
      if (q && !`${nombreCompleto(p)} ${p.patientCode}`.toLowerCase().includes(q)) return false;
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
  const conEstado = fuente === 'ronda' && columna !== 'vistos' && columna !== 'yaNoVienen' && columna !== 'dejaron';
  // Las opciones salen de la lista misma, con cuántos tiene cada una.
  const contar = (xs: string[]) => [...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  const medicos = contar(todos.flatMap((p) => (p.atendio ? [p.atendio] : [])));
  const medicamentos = contar(todos.flatMap((p) => [...new Set(p.tratamiento.map((t) => t.medicamento))]));
  const hayFiltros = !!(q || medico || presion || medicamento);
  const limpiar = () => {
    setBuscar('');
    setMedico('');
    setPresion('');
    setMedicamento('');
  };
  const visitaTexto = (fuente === 'planilla' && columna !== 'enPrograma') || (fuente === 'donantes' && columna !== 'volvieron' && columna !== 'noVolvieron') ? 'Visita contada' : 'Última visita';

  return (
    <Tarjeta
      titulo={
        <span className="flex items-center gap-2">
          <Users className="size-4" /> {hayFiltros ? `${filas.length} de ${todos.length}` : todos.length.toLocaleString('es-DO')} {todos.length === 1 ? 'paciente' : 'pacientes'}
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
              'Atendió',
              'Tratamiento',
              ...(conEstado ? ['Asistencia'] : []),
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
                <td className="px-5 py-2.5 whitespace-nowrap">{p.atendio ?? <span className="text-tenue">—</span>}</td>
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
              </tr>
            ))}
            {filas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-tenue">
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
