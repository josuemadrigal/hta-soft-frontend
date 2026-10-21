import { useQuery } from '@tanstack/react-query';
import { Check, Search, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useAsistenciaJornadas, useComunidades } from '../api/consultas';
import { pacientesDePlanilla, pacientesDeRonda, type PacienteDeCifra } from '../api/recursos';
import { COLUMNAS_PLANILLA } from '../components/TablaPlanilla';
import { Cargando, EncabezadoPagina, Entrada, ErrorCarga, Insignia, Tabla, Tarjeta, Vacio } from '../components/ui';
import { CATEGORIAS, colorCategoria } from '../lib/etiquetas';
import { cn, edadTexto, fecha, fechaDia, nombreCompleto } from '../lib/formato';

/** Qué es cada cifra de la ronda y cómo se cuenta (la misma regla que la tabla). */
const RONDA: Record<string, { titulo: string; explica: string }> = {
  regulares: { titulo: 'Regulares', explica: 'Pacientes activos que se han perdido como mucho las visitas que se fijan en Configuración. Los que nunca han venido cuentan si se registraron en ese tiempo.' },
  vistos: { titulo: 'Vistos en la ronda', explica: 'Regulares que ya vinieron en este trimestre.' },
  faltan: { titulo: 'Todavía no vienen en esta ronda', explica: 'Regulares que no han venido este trimestre. "Faltan" en la tabla es cuántos de ellos hacen falta para llegar a lo esperado; aquí están todos, primero a los que les toca.' },
  dejaron: { titulo: 'Dejaron de venir', explica: 'Regulares que llevan más de 6 meses sin venir: todavía se pueden recuperar.' },
  yaNoVienen: { titulo: 'Ya no vienen', explica: 'Se perdieron más visitas de las que se fijan en Configuración: no cuentan en la ronda.' },
};

const ESTADOS: Record<NonNullable<PacienteDeCifra['estado']>, { texto: string; color?: string }> = {
  visto: { texto: 'Vino en la ronda', color: '#15803d' },
  'le-toca': { texto: 'Le toca' },
  'sin-venir': { texto: 'Más de 6 meses sin venir', color: '#b45309' },
  'sin-visitas': { texto: 'Nunca ha venido', color: '#b45309' },
  'ya-no-viene': { texto: 'Ya no viene', color: '#b91c1c' },
};
const ORDEN_ESTADO = ['le-toca', 'sin-visitas', 'sin-venir', 'visto', 'ya-no-viene'];

const EXPLICA_PLANILLA: Record<string, string> = {
  evaluados: 'Pacientes con al menos una visita en el periodo.',
  enPrograma: 'Pacientes regulares del batey, hayan venido o no (la misma regla que en la ronda).',
  conToma: 'Evaluados a los que se les tomó la presión.',
  existentesConMedicamento: 'Pacientes que ya venían y recibieron receta en el periodo.',
  controlados: 'De los que ya venían con receta, su última toma del periodo quedó por debajo de 140/90.',
  noControlados: 'De los que ya venían con receta, su última toma del periodo quedó en 140/90 o más.',
  datosDudosos: 'Pacientes que ya venían cuya última visita no tiene toma o tiene números que no cuadran.',
  nuevos: 'Su primera visita de siempre fue en este periodo.',
  nuevosConMedicamento: 'Pacientes nuevos que recibieron receta.',
};

const CORTO = new Intl.DateTimeFormat('es-DO', { day: 'numeric', month: 'short', year: 'numeric' });
const textoPeriodo = (desde: string, hasta: string) => {
  const d = (s: string) => CORTO.format(new Date(`${s}T12:00:00`));
  return desde === hasta ? d(desde) : `${d(desde)} – ${d(hasta)}`;
};

/**
 * /reportes/pacientes — los pacientes detrás de una cifra de la planilla o de la ronda.
 * ?fuente=planilla|ronda &columna= &batey= (sin batey, todos) &desde= &hasta= (solo planilla)
 */
export function PacientesDeCifra() {
  const [params] = useSearchParams();
  const fuente = params.get('fuente') === 'ronda' ? 'ronda' : 'planilla';
  const columna = params.get('columna') ?? '';
  const batey = Number(params.get('batey')) || undefined;
  const desde = params.get('desde') ?? '';
  const hasta = params.get('hasta') || desde;
  const comunidades = useComunidades();
  const nombreBatey = batey ? (comunidades.data?.find((c) => c.id === batey)?.name ?? '…') : 'Todos los bateyes';

  if (fuente === 'ronda' && columna === 'esperados') return <Esperados batey={batey} nombreBatey={nombreBatey} />;

  const col = fuente === 'planilla' ? COLUMNAS_PLANILLA.find((c) => c.clave === columna) : null;
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

function Listado({ fuente, columna, batey, desde, hasta }: { fuente: 'planilla' | 'ronda'; columna: string; batey?: number; desde: string; hasta: string }) {
  const consulta = useQuery({
    queryKey: ['reportes', 'cifra', fuente, columna, batey, desde, hasta],
    queryFn: () =>
      fuente === 'planilla'
        ? pacientesDePlanilla({ from: `${desde}T00:00:00-04:00`, to: `${hasta}T23:59:59-04:00`, columna, communityId: batey })
        : pacientesDeRonda({ columna, communityId: batey }),
  });
  const [buscar, setBuscar] = useState('');

  if (consulta.isPending) return <Cargando forma="lista" texto="Buscando los pacientes…" />;
  if (consulta.isError) return <ErrorCarga error={consulta.error} />;

  const q = buscar.trim().toLowerCase();
  const filas = consulta.data
    .filter((p) => !q || `${nombreCompleto(p)} ${p.patientCode}`.toLowerCase().includes(q))
    .sort((a, b) => (fuente === 'ronda' ? ORDEN_ESTADO.indexOf(a.estado ?? '') - ORDEN_ESTADO.indexOf(b.estado ?? '') : 0));
  const variosBateyes = new Set(consulta.data.map((p) => p.community.id)).size > 1;
  const conEstado = fuente === 'ronda' && columna !== 'vistos' && columna !== 'yaNoVienen' && columna !== 'dejaron';

  return (
    <Tarjeta
      titulo={
        <span className="flex items-center gap-2">
          <Users className="size-4" /> {consulta.data.length.toLocaleString('es-DO')} {consulta.data.length === 1 ? 'paciente' : 'pacientes'}
        </span>
      }
      accion={
        consulta.data.length > 8 && (
          <div className="relative w-56">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-tenue" />
            <Entrada placeholder="Buscar nombre o código" className="h-8 pl-8 text-sm" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
          </div>
        )
      }
    >
      {consulta.data.length === 0 ? (
        <Vacio titulo="No hay pacientes en esta cifra" />
      ) : (
        <Tabla
          columnas={[
            'Paciente',
            ...(variosBateyes ? ['Batey'] : []),
            'Edad',
            fuente === 'planilla' && columna !== 'enPrograma' ? 'Visita contada' : 'Última visita',
            { texto: 'Presión', className: 'text-right' },
            'Clasificación',
            ...(conEstado ? ['Asistencia'] : []),
            'Teléfono',
          ]}
        >
          {filas.map((p) => (
            <tr key={p.id} className="hover:bg-fondo">
              <td className="px-5 py-2.5">
                <Link to={`/pacientes/${p.id}`} className="font-medium hover:underline">
                  {nombreCompleto(p)}
                </Link>
                <span className="block font-mono text-xs text-tenue">{p.patientCode}</span>
              </td>
              {variosBateyes && <td className="px-5 py-2.5 whitespace-nowrap">{p.community.name}</td>}
              <td className="px-5 py-2.5 whitespace-nowrap text-tenue">{edadTexto(p)}</td>
              <td className="px-5 py-2.5 whitespace-nowrap text-tenue">{p.visita ? fecha(p.visita) : 'Nunca ha venido'}</td>
              <td className="tabular px-5 py-2.5 text-right font-mono">{p.presion ?? <span className="text-tenue">—</span>}</td>
              <td className="px-5 py-2.5">
                {p.categoria ? (
                  <Insignia color={colorCategoria(p.categoria)}>
                    <span className="size-1.5 rounded-full" style={{ backgroundColor: colorCategoria(p.categoria) }} />
                    {CATEGORIAS[p.categoria]}
                  </Insignia>
                ) : (
                  <span className="text-xs text-tenue">Sin clasificar</span>
                )}
              </td>
              {conEstado && <td className="px-5 py-2.5">{p.estado && <Insignia color={ESTADOS[p.estado].color}>{ESTADOS[p.estado].texto}</Insignia>}</td>}
              <td className="px-5 py-2.5 whitespace-nowrap text-tenue">{p.phoneNumber || '—'}</td>
            </tr>
          ))}
          {filas.length === 0 && (
            <tr>
              <td colSpan={8} className="px-5 py-8 text-center text-tenue">
                Nadie coincide con "{buscar}".
              </td>
            </tr>
          )}
        </Tabla>
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
