import { CalendarPlus, Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { useIndicadoresBateyes } from '../api/consultas';
import type { EstadisticasRonda } from '../api/tipos';
import { useSesion } from '../auth/sesion';
import { fecha } from '../lib/formato';
import { diaJornada } from '../pages/Jornadas';
import { Tarjeta } from './ui';
import { AYUDA } from '../lib/ayuda-graficas';

const miles = (n: number) => n.toLocaleString('es-DO');

/** Una cifra de la ronda que abre la lista de sus pacientes (sin abrir la jornada de la fila). */
function Cifra({ columna, batey, children }: { columna: string; batey: number; children: ReactNode }) {
  return (
    <Link
      to={`/reportes/pacientes?fuente=ronda&columna=${columna}&batey=${batey}`}
      onClick={(e) => e.stopPropagation()}
      className="-mx-1.5 -my-1 rounded px-1.5 py-1 underline decoration-tinta/20 underline-offset-4 hover:bg-tinta/5 hover:decoration-tinta"
      title="Ver los pacientes"
    >
      {children}
    </Link>
  );
}

/**
 * Ronda actual por batey en una tabla: cuánto se ha visto, cuántos están pendientes, cuántos dejaron
 * de venir (más de 6 meses), la última visita y la próxima jornada. Tocar una fila abre su jornada.
 */
export function RondaPorBatey({ ronda }: { ronda: EstadisticasRonda }) {
  const navegar = useNavigate();
  const { tiene } = useSesion();
  const indicadores = useIndicadoresBateyes();
  // Primero donde más faltan para llegar a lo esperado: ahí hace falta la próxima jornada.
  const faltan = (c: (typeof ronda.byCommunity)[number]) => c.missing ?? c.pending;
  const filas = [...ronda.byCommunity].sort((a, b) => faltan(b) - faltan(a) || b.active - a.active);
  const th = 'px-3 py-2.5 text-right font-medium whitespace-nowrap';
  const td = 'px-3 py-2.5 text-right tabular-nums';

  return (
    <Tarjeta titulo={`Ronda ${ronda.round.label} por batey`} copiable ayuda={AYUDA.rondaPorBatey} accion={<span className="text-xs text-tenue">Toca un número para ver los pacientes; el batey abre su jornada</span>}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-borde text-xs text-tenue">
              <th className="px-5 py-2.5 text-left font-medium">Batey</th>
              <th className={th} title="Los que se han perdido como mucho las visitas que se fijan en Configuración">
                Regulares
              </th>
              <th className={th} title="Media alta de las últimas jornadas del batey: el promedio de las que tuvieron más pacientes (se ajusta en Configuración)">
                Esperados
              </th>
              <th className="w-56 px-3 py-2.5 text-left font-medium">Vistos en la ronda</th>
              <th className={th} title="Los que faltan para llegar a lo esperado">
                Faltan
              </th>
              <th className={th} title="Más de 6 meses sin venir">
                Dejaron de venir
              </th>
              <th className={th}>Última visita</th>
              <th className="px-5 py-2.5 text-left font-medium">Próxima jornada</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {filas.map((c) => {
              // Contra lo esperado (media alta de las últimas jornadas); se puede pasar del 100 %.
              const esperados = c.expected ?? c.active;
              // Atendidos: los que vinieron a consulta y a los que solo se les dejó el tratamiento.
              const tratamiento = c.treatmentLeft ?? 0;
              const pct = esperados ? Math.round(((c.seen + tratamiento) / esperados) * 100) : 0;
              const proxima = indicadores.data?.find((b) => b.id === c.communityId)?.proximaJornada ?? null;
              return (
                <tr key={c.communityId} onClick={() => navegar(`/jornada?batey=${c.communityId}`)} className="cursor-pointer hover:bg-fondo">
                  <td className="px-5 py-2.5 font-medium whitespace-nowrap">{c.name}</td>
                  <td className={`${td} text-tenue`} title={c.retired ? `${c.retired} más ya no vienen` : undefined}>
                    <Cifra columna="regulares" batey={c.communityId}>
                      {miles(c.active)}
                    </Cifra>
                  </td>
                  <td className={td}>
                    <Cifra columna="esperados" batey={c.communityId}>
                      ~{miles(esperados)}
                    </Cifra>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
                        <div className={pct >= 100 ? 'h-full rounded-full bg-green-600' : 'h-full rounded-full bg-tinta'} style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                      <span className="w-28 text-right text-xs text-tenue tabular-nums">
                        {c.seen ? (
                          <Cifra columna="vistos" batey={c.communityId}>
                            {miles(c.seen)}
                          </Cifra>
                        ) : (
                          0
                        )}
                        {tratamiento > 0 && (
                          <>
                            {' + '}
                            <span title="Solo se les dejó el tratamiento (sin consulta)">
                              <Cifra columna="tratamiento" batey={c.communityId}>
                                {miles(tratamiento)}
                              </Cifra>
                            </span>
                          </>
                        )}{' '}
                        · {pct}%
                      </span>
                    </div>
                  </td>
                  <td className={td}>{faltan(c) ? <Cifra columna="faltan" batey={c.communityId}>{miles(faltan(c))}</Cifra> : <Check className="ml-auto size-4 text-green-700" aria-label="Ya se llegó a lo esperado" />}</td>
                  <td className={`${td} text-tenue`} title={c.absentYear ? `${c.absentYear} de ellos hace más de un año` : undefined}>
                    {c.absent ? (
                      <Cifra columna="dejaron" batey={c.communityId}>
                        {miles(c.absent)}
                      </Cifra>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={`${td} whitespace-nowrap text-tenue`}>{fecha(c.lastVisit)}</td>
                  <td className="px-5 py-2.5 whitespace-nowrap">
                    {proxima ? (
                      <span className="text-green-700">{diaJornada(proxima)}</span>
                    ) : tiene('jornadas.planificar') ? (
                      <Link to={`/jornadas/nueva?batey=${c.communityId}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-xs text-tenue hover:text-tinta hover:underline">
                        <CalendarPlus className="size-3.5" /> Planificar
                      </Link>
                    ) : (
                      <span className="text-xs text-tenue">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Tarjeta>
  );
}
