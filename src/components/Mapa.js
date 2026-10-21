import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { cn } from '../lib/formato';
/** La Romana (centro aproximado de la provincia, donde están los bateyes). */
export const CENTRO_LA_ROMANA = [18.47, -68.97];
export function MapaBase({ children, className, centro = CENTRO_LA_ROMANA, zoom = 11 }) {
    return (_jsxs(MapContainer, { center: centro, zoom: zoom, scrollWheelZoom: true, className: cn('z-0 h-full w-full rounded-xl', className), children: [_jsx(TileLayer, { attribution: '\u00A9 <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" }), children] }));
}
/** Ajusta la vista para que se vean todos los puntos (una sola vez, al cargar). */
export function Encuadrar({ puntos }) {
    const mapa = useMap();
    const clave = puntos.map((p) => p.join(',')).join('|');
    useEffect(() => {
        if (puntos.length === 1)
            mapa.setView(puntos[0], 13);
        else if (puntos.length > 1)
            mapa.fitBounds(puntos, { padding: [40, 40], maxZoom: 13 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clave]);
    return null;
}
function AlHacerClic({ alClic }) {
    useMapEvents({ click: (e) => alClic(Math.round(e.latlng.lat * 1e6) / 1e6, Math.round(e.latlng.lng * 1e6) / 1e6) });
    return null;
}
/** Elegir la ubicación de un batey tocando el mapa. */
export function SelectorUbicacion({ valor, alCambiar }) {
    return (_jsx("div", { className: "h-72", children: _jsxs(MapaBase, { centro: valor ? [valor.lat, valor.lng] : CENTRO_LA_ROMANA, zoom: valor ? 14 : 11, children: [_jsx(AlHacerClic, { alClic: (lat, lng) => alCambiar({ lat, lng }) }), valor && _jsx(CircleMarker, { center: [valor.lat, valor.lng], radius: 10, pathOptions: { color: '#1d1b18', weight: 2, fillColor: '#fed801', fillOpacity: 0.9 } })] }) }));
}
