import { CalendarPlus } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useIndicadoresBateyes } from '../api/consultas';
import type { EstadisticasRonda } from '../api/tipos';
import { useSesion } from '../auth/sesion';
import { fecha } from '../lib/formato';
import { diaJornada } from '../pages/Jornadas';
import { Tarjeta } from './ui';

const miles = (n: number) => n.toLocaleString('es-DO');

/**
 * Ronda actual por batey en una tabla: cuánto se ha visto, cuántos están pendientes, cuántos dejaron
 * de venir (más de 6 meses), la última visita y la próxima jornada. Tocar una fila abre su jornada.
 */
export function RondaPorBatey({ ronda }: { ronda: EstadisticasRonda }) {
  const navegar = useNavigate();
  const { tiene } = useSesion();
  const indicadores = useIndicadoresBateyes();
  // Primero donde hay más pendientes: ahí hace falta la próxima jornada.
  const filas = [...ronda.byCommunity].sort((a, b) => b.pending - a.pending || b.active - a.active);
  const th = 'px-3 py-2.5 text-right font-medium whitespace-nowrap';
  const td = 'px-3 py-2.5 text-right tabular-nums';

  return (
    <Tarjeta titulo={`Ronda ${ronda.round.label} por batey`} copiable accion={<span className="text-xs text-tenue">Toca un batey para abrir su jornada</span>}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-borde text-xs text-tenue">
              <th className="px-5 py-2.5 text-left font-medium">Batey</th>
              <th className={th}>Pacientes</th>
              <th className="w-56 px-3 py-2.5 text-left font-medium">Vistos en la ronda</th>
              <th className={th}>Pendientes</th>
              <th className={th} title="Más de 6 meses sin venir">
                Dejaron de venir
              </th>
              <th className={th}>Última visita</th>
              <th className="px-5 py-2.5 text-left font-medium">Próxima jornada</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {filas.map((c) => {
              const pct = c.active ? Math.round((c.seen / c.active) * 100) : 0;
              const proxima = indicadores.data?.find((b) => b.id === c.communityId)?.proximaJornada ?? null;
              return (
                <tr key={c.communityId} onClick={() => navegar(`/jornada?batey=${c.communityId}`)} className="cursor-pointer hover:bg-fondo">
                  <td className="px-5 py-2.5 font-medium whitespace-nowrap">{c.name}</td>
                  <td className={td}>{miles(c.active)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
                        <div className="h-full rounded-full bg-tinta" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-20 text-right text-xs text-tenue tabular-nums">
                        {miles(c.seen)} · {pct}%
                      </span>
                    </div>
                  </td>
                  <td className={td}>{miles(c.pending)}</td>
                  <td className={`${td} text-tenue`} title={c.absentYear ? `${c.absentYear} de ellos hace más de un año` : undefined}>
                    {c.absent ? miles(c.absent) : '—'}
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
