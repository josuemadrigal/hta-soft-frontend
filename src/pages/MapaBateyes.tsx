import { MapPinOff } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { CircleMarker, Popup, Tooltip } from 'react-leaflet';
import { useIndicadoresBateyes } from '../api/consultas';
import type { IndicadorBatey } from '../api/tipos';
import { useSesion } from '../auth/sesion';
import { Encuadrar, MapaBase } from '../components/Mapa';
import { Cargando, EncabezadoPagina, ErrorCarga, Tarjeta } from '../components/ui';
import { cn, fecha } from '../lib/formato';
import { diaJornada } from './Jornadas';

type Clave = 'controladosPct' | 'vistosRondaPct' | 'riesgoPct' | 'sinVenir' | 'pacientes';

/** Cada indicador sabe leerse, formatearse y colorearse (verde = bien, rojo = mal). */
const INDICADORES: Record<Clave, { texto: string; ayuda: string; valor: (b: IndicadorBatey) => number | null; formato: (v: number | null) => string; color: (v: number | null, max: number) => string }> = {
  controladosPct: {
    texto: 'Controlados',
    ayuda: 'Última toma < 140/90',
    valor: (b) => b.controladosPct,
    formato: (v) => (v === null ? '—' : `${Math.round(v)}%`),
    color: (v) => (v === null ? '#a8a29e' : v >= 60 ? '#15803d' : v >= 40 ? '#ca8a04' : '#dc2626'),
  },
  vistosRondaPct: {
    texto: 'Vistos en la ronda',
    ayuda: 'Activos con visita este trimestre',
    valor: (b) => b.vistosRondaPct,
    formato: (v) => (v === null ? '—' : `${Math.round(v)}%`),
    color: (v) => (v === null ? '#a8a29e' : v >= 70 ? '#15803d' : v >= 30 ? '#ca8a04' : '#dc2626'),
  },
  riesgoPct: {
    texto: 'En grado 2 o crisis',
    ayuda: 'Última toma ≥ 160/100',
    valor: (b) => b.riesgoPct,
    formato: (v) => (v === null ? '—' : `${Math.round(v)}%`),
    color: (v) => (v === null ? '#a8a29e' : v <= 15 ? '#15803d' : v <= 30 ? '#ca8a04' : '#dc2626'),
  },
  sinVenir: {
    texto: 'Dejaron de venir',
    ayuda: 'No asisten hace más de 6 meses',
    valor: (b) => b.sinVenir,
    formato: (v) => (v === null ? '—' : v.toLocaleString('es-DO')),
    color: (v, max) => (v === null ? '#a8a29e' : v / Math.max(max, 1) <= 0.33 ? '#15803d' : v / Math.max(max, 1) <= 0.66 ? '#ca8a04' : '#dc2626'),
  },
  pacientes: {
    texto: 'Pacientes',
    ayuda: 'Activos en seguimiento',
    valor: (b) => b.pacientes,
    formato: (v) => (v === null ? '—' : v.toLocaleString('es-DO')),
    color: () => '#1d1b18',
  },
};

/** /mapa — los bateyes en el mapa, coloreados por el indicador elegido. */
export function MapaBateyes() {
  const consulta = useIndicadoresBateyes();
  const [params, setParams] = useSearchParams();
  const clave = (params.get('ver') as Clave) in INDICADORES ? (params.get('ver') as Clave) : 'controladosPct';
  const [resaltado, setResaltado] = useState<number | null>(null);
  const navegar = useNavigate();
  const { tiene } = useSesion();
  const ind = INDICADORES[clave];

  if (consulta.isPending) return <Cargando />;
  if (consulta.isError) return <ErrorCarga error={consulta.error} />;
  const bateyes = consulta.data.filter((b) => b.activo || b.pacientes > 0);
  const ubicados = bateyes.filter((b) => b.latitud !== null && b.longitud !== null);
  const sinUbicar = bateyes.filter((b) => b.latitud === null || b.longitud === null);
  const max = Math.max(...bateyes.map((b) => ind.valor(b) ?? 0));
  const maxPacientes = Math.max(...bateyes.map((b) => b.pacientes), 1);
  const radio = (b: IndicadorBatey) => 8 + Math.sqrt(b.pacientes / maxPacientes) * 22;
  const ordenados = [...bateyes].sort((a, b) => {
    const x = ind.valor(a);
    const y = ind.valor(b);
    if (x === null) return 1;
    if (y === null) return -1;
    // Primero los que peor están (los que hay que atender)
    return clave === 'controladosPct' || clave === 'vistosRondaPct' ? x - y : y - x;
  });

  return (
    <>
      <EncabezadoPagina titulo="Mapa de bateyes" descripcion="El tamaño del círculo es la cantidad de pacientes; el color, cómo va el indicador elegido." />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {(Object.keys(INDICADORES) as Clave[]).map((k) => (
          <button
            key={k}
            onClick={() => setParams(k === 'controladosPct' ? {} : { ver: k }, { replace: true })}
            className={cn('rounded-full border px-3 py-1.5 text-sm', clave === k ? 'border-tinta bg-marca-500 font-medium' : 'border-borde bg-superficie text-tenue hover:text-tinta')}
            title={INDICADORES[k].ayuda}
          >
            {INDICADORES[k].texto}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="relative h-[560px] overflow-hidden rounded-xl border border-borde">
          <MapaBase>
            <Encuadrar puntos={ubicados.map((b) => [b.latitud!, b.longitud!])} />
            {ubicados.map((b) => {
              const v = ind.valor(b);
              const color = ind.color(v, max);
              return (
                <CircleMarker
                  key={b.id}
                  center={[b.latitud!, b.longitud!]}
                  radius={radio(b)}
                  pathOptions={{ color: resaltado === b.id ? '#1d1b18' : '#ffffff', weight: resaltado === b.id ? 3 : 2, fillColor: color, fillOpacity: 0.75 }}
                  eventHandlers={{ mouseover: () => setResaltado(b.id), mouseout: () => setResaltado(null) }}
                >
                  <Tooltip direction="top" offset={[0, -radio(b)]}>
                    <strong>{b.nombre}</strong> · {ind.formato(v)}
                  </Tooltip>
                  <Popup>
                    <div className="min-w-52 space-y-0.5 text-[13px] leading-snug [&_p]:!my-0">
                      <p className="mb-1 text-sm font-semibold">{b.nombre}</p>
                      <p>{b.pacientes} pacientes activos</p>
                      <p>Controlados: {INDICADORES.controladosPct.formato(b.controladosPct)}</p>
                      <p>Vistos en la ronda: {INDICADORES.vistosRondaPct.formato(b.vistosRondaPct)}</p>
                      <p>No asisten hace +6 meses: {b.sinVenir}</p>
                      <p>PA promedio: {b.sistolica ? `${b.sistolica}/${b.diastolica}` : '—'}</p>
                      <p>Última visita: {fecha(b.ultimaVisita)}</p>
                      <p>Próxima jornada: {b.proximaJornada ? diaJornada(b.proximaJornada) : 'sin planificar'}</p>
                      <p className="mt-2 flex gap-3">
                        <Link to={`/pacientes?batey=${b.id}`}>Pacientes</Link>
                        {!b.proximaJornada && tiene('jornadas.planificar') && <Link to={`/jornadas/nueva?batey=${b.id}`}>Planificar jornada</Link>}
                      </p>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapaBase>
          {ubicados.length === 0 && (
            <div className="absolute top-4 right-4 left-14 z-[500] rounded-lg bg-superficie/95 px-4 py-3 text-sm shadow">
              Todavía no hay bateyes ubicados. {tiene('comunidades.gestionar') ? 'Abre cada batey de la lista y toca el mapa donde está.' : 'Pide a quien gestiona los bateyes que los ubique.'}
            </div>
          )}
          {clave !== 'pacientes' && (
            <div className="absolute bottom-4 left-4 z-[500] rounded-lg bg-superficie/95 px-3 py-2 text-xs shadow">
              <p className="mb-1 font-medium">{ind.texto}</p>
              <p className="flex items-center gap-3">
                {[
                  ['#15803d', 'Bien'],
                  ['#ca8a04', 'Regular'],
                  ['#dc2626', 'Atender'],
                  ['#a8a29e', 'Sin dato'],
                ].map(([c, t]) => (
                  <span key={t} className="flex items-center gap-1">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: c }} /> {t}
                  </span>
                ))}
              </p>
            </div>
          )}
        </div>

        <Tarjeta titulo={`${ind.texto} por batey`} accion={<span className="text-xs text-tenue">{ind.ayuda}</span>}>
          <ul className="max-h-[505px] divide-y divide-borde overflow-y-auto">
            {ordenados.map((b) => {
              const v = ind.valor(b);
              const ubicado = b.latitud !== null && b.longitud !== null;
              return (
                <li
                  key={b.id}
                  onMouseEnter={() => setResaltado(b.id)}
                  onMouseLeave={() => setResaltado(null)}
                  onClick={() => navegar(ubicado ? `/pacientes?batey=${b.id}` : tiene('comunidades.gestionar') ? `/comunidades/${b.id}` : `/pacientes?batey=${b.id}`)}
                  className={cn('flex cursor-pointer items-center gap-3 px-5 py-2.5 text-sm hover:bg-fondo', resaltado === b.id && 'bg-marca-50')}
                >
                  <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: ind.color(v, max) }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{b.nombre}</span>
                    <span className="text-xs text-tenue">
                      {b.pacientes} pacientes
                      {!ubicado && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 text-amber-700">
                          <MapPinOff className="size-3" /> sin ubicar
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="tabular font-semibold">{ind.formato(v)}</span>
                </li>
              );
            })}
          </ul>
          {sinUbicar.length > 0 && tiene('comunidades.gestionar') && (
            <p className="border-t border-borde px-5 py-2.5 text-xs text-tenue">{sinUbicar.length} bateyes sin ubicar: tócalos para marcarlos en el mapa.</p>
          )}
        </Tarjeta>
      </div>
    </>
  );
}
