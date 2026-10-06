import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Pencil, Save, Target } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Bar, BarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { useMetas } from '../api/consultas';
import { guardarMetas } from '../api/recursos';
import type { ClaveIndicador, EstadoMeta, IndicadorAnual, MotivoBaja } from '../api/tipos';
import { useSesion } from '../auth/sesion';
import { COLOR, EJE, TOOLTIP } from '../components/graficas';
import { Boton, Cargando, EncabezadoPagina, Entrada, ErrorCarga, Insignia, Tarjeta } from '../components/ui';
import { MOTIVOS_BAJA } from '../lib/etiquetas';
import { cn, fecha } from '../lib/formato';

const ESTADOS: Record<EstadoMeta, { texto: string; color?: string }> = {
  cumplida: { texto: 'Cumplida', color: '#15803d' },
  'en-camino': { texto: 'En camino', color: '#a16207' },
  atrasada: { texto: 'Atrasada', color: '#dc2626' },
  'sin-meta': { texto: 'Sin meta' },
  'sin-datos': { texto: 'Sin datos' },
};

export const formatoIndicador = (tipo: 'pct' | 'conteo', v: number | null) => (v === null ? '—' : tipo === 'pct' ? `${Math.round(v)}%` : v.toLocaleString('es-DO'));

/** /metas?anio= — metas anuales contra lo logrado, por trimestre y frente al año anterior. */
export function Metas() {
  const [params, setParams] = useSearchParams();
  const actual = new Date().getFullYear();
  const anio = Number(params.get('anio')) || actual;
  const consulta = useMetas(anio);
  const puedeEditar = useSesion().tiene('metas.gestionar');
  const [editando, setEditando] = useState(false);
  const cambiarAnio = (a: number) => {
    setEditando(false);
    setParams(a === actual ? {} : { anio: String(a) }, { replace: true });
  };

  return (
    <>
      <EncabezadoPagina
        titulo="Metas e indicadores"
        descripcion="Lo que la fundación se propone cada año y cómo va. Los porcentajes se comparan con la meta; los conteos, con lo que corresponde a la parte del año transcurrida."
        acciones={
          <>
            <div className="flex items-center rounded-lg border border-borde bg-superficie">
              <Boton variante="fantasma" className="h-9 px-2" onClick={() => cambiarAnio(anio - 1)} aria-label="Año anterior">
                <ChevronLeft className="size-4" />
              </Boton>
              <span className="tabular px-2 font-semibold">{anio}</span>
              <Boton variante="fantasma" className="h-9 px-2" disabled={anio >= actual + 1} onClick={() => cambiarAnio(anio + 1)} aria-label="Año siguiente">
                <ChevronRight className="size-4" />
              </Boton>
            </div>
            {puedeEditar && !editando && (
              <Boton icono={<Pencil className="size-4" />} onClick={() => setEditando(true)}>
                Fijar metas {anio}
              </Boton>
            )}
          </>
        }
      />
      {consulta.isPending ? (
        <Cargando texto="Calculando indicadores…" />
      ) : consulta.isError ? (
        <ErrorCarga error={consulta.error} />
      ) : editando ? (
        <EditarMetas anio={anio} indicadores={consulta.data.indicadores} alTerminar={() => setEditando(false)} />
      ) : (
        <div className={cn('space-y-4 transition-opacity', consulta.isPlaceholderData && 'opacity-60')}>
          {anio === actual && (
            <div className="rounded-xl border border-borde bg-superficie p-4">
              <div className="mb-1.5 flex justify-between text-sm">
                <span className="font-medium">Avance del año</span>
                <span className="tabular text-tenue">{Math.round(consulta.data.fraccionAnio * 100)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
                <div className="h-full rounded-full bg-tinta/70" style={{ width: `${consulta.data.fraccionAnio * 100}%` }} />
              </div>
            </div>
          )}
          {!consulta.data.indicadores.some((i) => i.meta !== null) && (
            <p className="rounded-lg bg-marca-50 px-4 py-3 text-sm">
              <Target className="mr-1.5 inline size-4" /> Aún no hay metas para {anio}.{puedeEditar ? ' Usa "Fijar metas" para definirlas; mientras tanto se muestran los valores logrados.' : ''}
            </p>
          )}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {consulta.data.indicadores.map((i) => (
              <TarjetaIndicador key={i.clave} i={i} anio={anio} fraccion={consulta.data.fraccionAnio} />
            ))}
          </div>
          <Tarjeta titulo={`Bajas registradas en ${anio}`}>
            <div className="flex flex-wrap gap-6 p-5 text-sm">
              {Object.keys(consulta.data.bajas).length === 0 ? (
                <span className="text-tenue">Ninguna baja con fecha en este año.</span>
              ) : (
                (Object.entries(consulta.data.bajas) as [MotivoBaja, number][]).map(([m, n]) => (
                  <div key={m}>
                    <p className="tabular text-2xl font-semibold">{n}</p>
                    <p className="text-tenue">{MOTIVOS_BAJA[m]}</p>
                  </div>
                ))
              )}
            </div>
          </Tarjeta>
        </div>
      )}
    </>
  );
}

function TarjetaIndicador({ i, anio, fraccion }: { i: IndicadorAnual; anio: number; fraccion: number }) {
  const e = ESTADOS[i.estado];
  const fmt = (v: number | null) => formatoIndicador(i.tipo, v);
  // Avance hacia la meta: porcentaje alcanzado (para "menos es mejor", qué tan cerca está de bajar a la meta).
  const avance = i.meta !== null && i.valor !== null ? (i.mayorEsMejor ? Math.min(1, i.valor / (i.meta || 1)) : Math.min(1, (i.meta || 0.1) / Math.max(i.valor, 0.1))) : null;
  const cambio = i.valor !== null && i.anterior !== null ? i.valor - i.anterior : null;
  const mejora = cambio !== null && cambio !== 0 ? (cambio > 0) === i.mayorEsMejor : null;
  const esperado = i.tipo === 'conteo' && i.meta !== null && fraccion < 1 ? Math.round(i.meta * fraccion) : null;

  return (
    <Tarjeta titulo={i.nombre} copiable accion={<Insignia color={e.color}>{e.texto}</Insignia>}>
      <div className="space-y-3 p-5">
        <p className="text-xs text-tenue">{i.descripcion}</p>
        <div className="flex items-end justify-between gap-2">
          <p className="tabular text-3xl font-semibold tracking-tight">{fmt(i.valor)}</p>
          {i.meta !== null && <p className="tabular pb-1 text-sm text-tenue">meta {fmt(i.meta)}</p>}
        </div>
        {avance !== null && (
          <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
            <div className="h-full rounded-full" style={{ width: `${avance * 100}%`, backgroundColor: e.color ?? COLOR.amarillo }} />
          </div>
        )}
        <div className="flex flex-wrap justify-between gap-x-3 text-xs text-tenue">
          <span className="flex items-center gap-1">
            {anio - 1}: {fmt(i.anterior)}
            {mejora !== null && (mejora ? <ArrowUpRight className="size-3.5 text-green-700" /> : <ArrowDownRight className="size-3.5 text-red-600" />)}
          </span>
          {esperado !== null && <span>a esta altura: {fmt(esperado)}</span>}
        </div>
        {i.trimestres.length > 0 && (
          <div className="h-24">
            <ResponsiveContainer>
              <BarChart data={i.trimestres.map((t) => ({ ...t, etiqueta: t.etiqueta.split(' ')[0] }))} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="etiqueta" {...EJE} fontSize={11} />
                <YAxis hide domain={[0, i.tipo === 'pct' ? 100 : 'auto']} />
                <Tooltip {...TOOLTIP} formatter={(v) => fmt(Number(v))} />
                {i.meta !== null && i.tipo === 'pct' && <ReferenceLine y={i.meta} stroke={COLOR.tinta} strokeDasharray="4 3" />}
                <Bar dataKey="valor" name={i.nombre} fill={COLOR.amarillo} radius={[3, 3, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {i.metaActualizada && <p className="text-[11px] text-tenue">Meta fijada por {i.metaActualizada.por ?? '—'} el {fecha(i.metaActualizada.fecha)}</p>}
      </div>
    </Tarjeta>
  );
}

function EditarMetas({ anio, indicadores, alTerminar }: { anio: number; indicadores: IndicadorAnual[]; alTerminar: () => void }) {
  const cliente = useQueryClient();
  const [valores, setValores] = useState<Record<string, string>>(Object.fromEntries(indicadores.map((i) => [i.clave, i.meta === null ? '' : String(i.meta)])));
  const guardar = useMutation({
    mutationFn: () => {
      const cambios: Partial<Record<ClaveIndicador, number | null>> = {};
      for (const i of indicadores) {
        const v = valores[i.clave].trim();
        const nuevo = v === '' ? null : Number(v);
        if (nuevo !== i.meta) cambios[i.clave] = nuevo;
      }
      return guardarMetas(anio, cambios);
    },
    onSuccess: (r) => {
      cliente.setQueryData(['metas', anio], r);
      cliente.invalidateQueries({ queryKey: ['donantes'] });
      toast.success(`Metas de ${anio} guardadas. El cambio quedó en Auditoría.`);
      alTerminar();
    },
    onError: (e) => toast.error(e.message),
  });
  const invalido = (i: IndicadorAnual) => {
    const v = valores[i.clave].trim();
    if (v === '') return false;
    const n = Number(v);
    return Number.isNaN(n) || n < 0 || (i.tipo === 'pct' && n > 100);
  };

  return (
    <Tarjeta titulo={`Metas para ${anio}`} className="max-w-3xl">
      <div className="divide-y divide-borde">
        {indicadores.map((i) => (
          <div key={i.clave} className="grid items-center gap-3 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_140px]">
            <div>
              <p className="text-sm font-medium">{i.nombre}</p>
              <p className="text-xs text-tenue">
                {i.descripcion} · {anio - 1}: {formatoIndicador(i.tipo, i.anterior)}
                {i.metaAnterior !== null && ` (meta ${formatoIndicador(i.tipo, i.metaAnterior)})`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Entrada type="number" min={0} max={i.tipo === 'pct' ? 100 : undefined} placeholder="Sin meta" value={valores[i.clave]} onChange={(e) => setValores({ ...valores, [i.clave]: e.target.value })} aria-invalid={invalido(i)} />
              <span className="w-4 text-sm text-tenue">{i.unidad}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 border-t border-borde p-5">
        <Boton variante="secundario" onClick={alTerminar}>
          Cancelar
        </Boton>
        <Boton icono={<Save className="size-4" />} cargando={guardar.isPending} disabled={indicadores.some(invalido)} onClick={() => guardar.mutate()}>
          Guardar metas
        </Boton>
      </div>
    </Tarjeta>
  );
}
