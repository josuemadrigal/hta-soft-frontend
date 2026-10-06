import 'leaflet/dist/leaflet.css';
import type { LatLngBoundsExpression, LatLngExpression } from 'leaflet';
import { useEffect, type ReactNode } from 'react';
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { cn } from '../lib/formato';

/** La Romana (centro aproximado de la provincia, donde están los bateyes). */
export const CENTRO_LA_ROMANA: LatLngExpression = [18.47, -68.97];

export function MapaBase({ children, className, centro = CENTRO_LA_ROMANA, zoom = 11 }: { children?: ReactNode; className?: string; centro?: LatLngExpression; zoom?: number }) {
  return (
    <MapContainer center={centro} zoom={zoom} scrollWheelZoom className={cn('z-0 h-full w-full rounded-xl', className)}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {children}
    </MapContainer>
  );
}

/** Ajusta la vista para que se vean todos los puntos (una sola vez, al cargar). */
export function Encuadrar({ puntos }: { puntos: [number, number][] }) {
  const mapa = useMap();
  const clave = puntos.map((p) => p.join(',')).join('|');
  useEffect(() => {
    if (puntos.length === 1) mapa.setView(puntos[0], 13);
    else if (puntos.length > 1) mapa.fitBounds(puntos as LatLngBoundsExpression, { padding: [40, 40], maxZoom: 13 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);
  return null;
}

function AlHacerClic({ alClic }: { alClic: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => alClic(Math.round(e.latlng.lat * 1e6) / 1e6, Math.round(e.latlng.lng * 1e6) / 1e6) });
  return null;
}

/** Elegir la ubicación de un batey tocando el mapa. */
export function SelectorUbicacion({ valor, alCambiar }: { valor: { lat: number; lng: number } | null; alCambiar: (v: { lat: number; lng: number } | null) => void }) {
  return (
    <div className="h-72">
      <MapaBase centro={valor ? [valor.lat, valor.lng] : CENTRO_LA_ROMANA} zoom={valor ? 14 : 11}>
        <AlHacerClic alClic={(lat, lng) => alCambiar({ lat, lng })} />
        {valor && <CircleMarker center={[valor.lat, valor.lng]} radius={10} pathOptions={{ color: '#1d1b18', weight: 2, fillColor: '#fed801', fillOpacity: 0.9 }} />}
      </MapaBase>
    </div>
  );
}
