import { useSearchParams } from 'react-router';
import { useComunidades } from '../api/consultas';
import type { FiltroReporte } from '../api/tipos';
import { cn } from '../lib/formato';
import { BotonesTrimestre } from './Periodo';
import { Entrada, Selector, Tarjeta } from './ui';

const iso = (d: Date) => d.toISOString().slice(0, 10);

function presets() {
  const hoy = new Date();
  return [
    { texto: 'Últimos 12 meses', desde: iso(new Date(hoy.getFullYear() - 1, hoy.getMonth(), hoy.getDate())), hasta: iso(hoy) },
    { texto: 'Este año', desde: `${hoy.getFullYear()}-01-01`, hasta: iso(hoy) },
    { texto: 'Año pasado', desde: `${hoy.getFullYear() - 1}-01-01`, hasta: `${hoy.getFullYear() - 1}-12-31` },
    { texto: 'Todo el historial', desde: '2017-01-01', hasta: iso(hoy) },
  ];
}

/** Periodo y batey en la URL (?desde=&hasta=&batey=). Devuelve el filtro listo para la API. */
export function useFiltroPeriodo(): FiltroReporte & { desde: string; hasta: string } {
  const [params] = useSearchParams();
  const [porDefecto] = presets();
  const desde = params.get('desde') ?? porDefecto.desde;
  const hasta = params.get('hasta') ?? porDefecto.hasta;
  return { desde, hasta, from: desde, to: `${hasta}T23:59:59`, communityId: Number(params.get('batey')) || undefined };
}

export function FiltroPeriodo({ conBatey = true }: { conBatey?: boolean }) {
  const [params, setParams] = useSearchParams();
  const comunidades = useComunidades();
  const { desde, hasta, communityId } = useFiltroPeriodo();
  const cambiar = (c: Record<string, string | undefined>) =>
    setParams(
      (p) => {
        for (const [k, v] of Object.entries(c)) v ? p.set(k, v) : p.delete(k);
        return p;
      },
      { replace: true },
    );

  return (
    <Tarjeta className="mb-4">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <div className="flex flex-wrap gap-1.5">
          {presets().map((p) => (
            <button
              key={p.texto}
              onClick={() => cambiar({ desde: p.desde, hasta: p.hasta })}
              className={cn(
                'rounded-full border px-3 py-1 text-sm',
                desde === p.desde && hasta === p.hasta ? 'border-tinta bg-marca-500 font-medium text-tinta' : 'border-borde text-tenue hover:text-tinta',
              )}
            >
              {p.texto}
            </button>
          ))}
        </div>
        <span className="hidden h-6 w-px bg-borde sm:block" />
        <BotonesTrimestre desde={desde} hasta={hasta} onCambiar={(r) => cambiar(r)} />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-tenue">
            Desde
            <Entrada type="date" className="w-auto" value={desde} onChange={(e) => cambiar({ desde: e.target.value })} />
          </label>
          <label className="flex items-center gap-2 text-sm text-tenue">
            Hasta
            <Entrada type="date" className="w-auto" value={hasta} onChange={(e) => cambiar({ hasta: e.target.value })} />
          </label>
        </div>
        {conBatey && (
          <Selector
            className="w-auto min-w-44"
            vacio="Todos los bateyes"
            value={communityId ?? ''}
            onChange={(e) => cambiar({ batey: e.target.value })}
            opciones={(comunidades.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
          />
        )}
        {[...params.keys()].some((k) => ['desde', 'hasta', 'batey'].includes(k)) && (
          <button onClick={() => cambiar({ desde: undefined, hasta: undefined, batey: undefined })} className="text-sm font-medium text-marca-700 hover:underline">
            Restablecer
          </button>
        )}
      </div>
    </Tarjeta>
  );
}
