import { Home } from 'lucide-react';
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Visita } from '../api/tipos';
import { CATEGORIAS, colorCategoria } from '../lib/etiquetas';
import { atendio, cn, colorCumplimiento, decimal, fecha } from '../lib/formato';
import { COLOR, TOOLTIP } from './graficas';
import { Tarjeta } from './ui';

const corta = new Intl.DateTimeFormat('es-DO', { month: 'short', year: '2-digit' });
const toma = (v: Visita) => ({ s: v.systolicManual ?? v.systolicAuto, d: v.diastolicManual ?? v.diastolicAuto });

/** Lo que el médico necesita a la vista para comparar mientras registra la visita de hoy. */
export function HistorialVisitas({ visitas, cuantas = 5 }: { visitas: Visita[]; cuantas?: number }) {
  if (visitas.length === 0) {
    return (
      <Tarjeta titulo="Visitas anteriores">
        <p className="p-5 text-sm text-tenue">Es su primera visita.</p>
      </Tarjeta>
    );
  }
  // visitas viene de la más reciente a la más antigua
  const serie = visitas
    .slice(0, 8)
    .map((v) => ({ ...toma(v), fecha: corta.format(new Date(v.visitDate)) }))
    .filter((p) => p.s && p.d)
    .reverse();

  return (
    <Tarjeta titulo={`Visitas anteriores (${visitas.length})`}>
      {serie.length > 1 && (
        <div className="h-28 border-b border-borde px-2 pt-3">
          <ResponsiveContainer>
            <LineChart data={serie} margin={{ left: -28, right: 8, top: 4, bottom: 0 }}>
              <XAxis dataKey="fecha" tickLine={false} axisLine={false} fontSize={10} stroke="#6b665e" interval="preserveStartEnd" />
              <YAxis domain={[60, 'auto']} tickLine={false} axisLine={false} fontSize={10} stroke="#6b665e" />
              <ReferenceLine y={140} stroke="#dc2626" strokeDasharray="3 3" strokeOpacity={0.4} />
              <ReferenceLine y={90} stroke="#ea580c" strokeDasharray="3 3" strokeOpacity={0.4} />
              <Tooltip {...TOOLTIP} />
              <Line dataKey="s" name="Sistólica" stroke={COLOR.tinta} strokeWidth={2} dot={{ r: 2.5 }} isAnimationActive={false} />
              <Line dataKey="d" name="Diastólica" stroke={COLOR.amarilloOscuro} strokeWidth={2} dot={{ r: 2.5 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <ol className="divide-y divide-borde">
        {visitas.slice(0, cuantas).map((v, i) => {
          const { s, d } = toma(v);
          const color = v.bpClassification ? colorCategoria(v.bpClassification) : undefined;
          return (
            <li key={v.id} className={cn('px-4 py-3 text-sm', i === 0 && 'bg-marca-50/60')}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">
                  {fecha(v.visitDate)}
                  {i === 0 && <span className="ml-1.5 text-xs font-normal text-tenue">· última</span>}
                  {v.isHomeVisit && <Home className="ml-1 inline size-3 text-tenue" />}
                </span>
                <span className="tabular font-mono font-medium">{s && d ? `${s}/${d}` : '—'}</span>
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-tenue">
                <span className="flex items-center gap-1.5">
                  {color && <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />}
                  {v.bpClassification ? CATEGORIAS[v.bpClassification.categoryName] : 'Sin toma válida'}
                </span>
                <span className="tabular">
                  {v.weightKg ? `${decimal(v.weightKg)} kg` : ''}
                  {v.weightKg && v.bmi ? ' · ' : ''}
                  {v.bmi ? `IMC ${decimal(v.bmi)}` : ''}
                </span>
              </div>
              {!!v.prescriptions?.length && (
                <ul className="mt-1.5 space-y-0.5 text-xs">
                  {v.prescriptions.map((r) => (
                    <li key={r.id} className="flex justify-between gap-2">
                      <span className="truncate">
                        {r.medication?.name} {r.medication?.concentration}
                        <span className="text-tenue"> · {r.dailyDose}/día · {r.quantityDispensed} entregadas</span>
                      </span>
                      {r.adherencePercentage !== null && (
                        <span className={cn('tabular shrink-0 font-medium', colorCumplimiento(Number(r.adherencePercentage)))}>{Math.round(Number(r.adherencePercentage))}%</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-1 text-[11px] text-tenue">Atendió {atendio(v)}</p>
              {v.notes && <p className="mt-1.5 line-clamp-3 text-xs text-tinta/70 italic">“{v.notes}”</p>}
            </li>
          );
        })}
      </ol>
    </Tarjeta>
  );
}
