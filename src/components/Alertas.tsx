import { AlertOctagon, AlertTriangle, Info } from 'lucide-react';
import { useConfiguracion } from '../api/consultas';
import { type Alerta, UMBRALES_POR_DEFECTO, type Umbrales } from '../lib/alertas';
import { cn } from '../lib/formato';

const ESTILO = {
  urgente: { caja: 'border-red-300 bg-red-50 text-red-900', icono: <AlertOctagon className="size-4 shrink-0 text-red-600" /> },
  aviso: { caja: 'border-amber-300 bg-marca-50 text-amber-950', icono: <AlertTriangle className="size-4 shrink-0 text-amber-700" /> },
  info: { caja: 'border-borde bg-fondo text-tinta', icono: <Info className="size-4 shrink-0 text-tenue" /> },
};

/** Umbrales configurados (o los de por defecto mientras cargan). */
export function useUmbrales(): Umbrales {
  return useConfiguracion().data ?? UMBRALES_POR_DEFECTO;
}

export function ListaAlertas({ alertas, compacta, className }: { alertas: Alerta[]; compacta?: boolean; className?: string }) {
  if (!alertas.length) return null;
  return (
    <ul className={cn('space-y-2', className)} role="list" aria-label="Alertas clínicas">
      {alertas.map((a) => (
        <li key={a.clave} className={cn('flex gap-2.5 rounded-lg border px-3 py-2.5 text-sm', ESTILO[a.nivel].caja)}>
          <span className="mt-0.5">{ESTILO[a.nivel].icono}</span>
          <div className="min-w-0">
            <p className="font-medium">{a.titulo}</p>
            {!compacta && <p className="mt-0.5 text-[13px] opacity-80">{a.detalle}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}
