import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { MapPinOff } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { CircleMarker, Popup, Tooltip } from 'react-leaflet';
import { useIndicadoresBateyes } from '../api/consultas';
import { useSesion } from '../auth/sesion';
import { Encuadrar, MapaBase } from '../components/Mapa';
import { Cargando, EncabezadoPagina, ErrorCarga, Tarjeta } from '../components/ui';
import { cn, fecha } from '../lib/formato';
import { diaJornada } from './Jornadas';
/** Cada indicador sabe leerse, formatearse y colorearse (verde = bien, rojo = mal). */
const INDICADORES = {
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
    const clave = params.get('ver') in INDICADORES ? params.get('ver') : 'controladosPct';
    const [resaltado, setResaltado] = useState(null);
    const navegar = useNavigate();
    const { tiene } = useSesion();
    const ind = INDICADORES[clave];
    if (consulta.isPending)
        return _jsx(Cargando, {});
    if (consulta.isError)
        return _jsx(ErrorCarga, { error: consulta.error });
    const bateyes = consulta.data.filter((b) => b.activo || b.pacientes > 0);
    const ubicados = bateyes.filter((b) => b.latitud !== null && b.longitud !== null);
    const sinUbicar = bateyes.filter((b) => b.latitud === null || b.longitud === null);
    const max = Math.max(...bateyes.map((b) => ind.valor(b) ?? 0));
    const maxPacientes = Math.max(...bateyes.map((b) => b.pacientes), 1);
    const radio = (b) => 8 + Math.sqrt(b.pacientes / maxPacientes) * 22;
    const ordenados = [...bateyes].sort((a, b) => {
        const x = ind.valor(a);
        const y = ind.valor(b);
        if (x === null)
            return 1;
        if (y === null)
            return -1;
        // Primero los que peor están (los que hay que atender)
        return clave === 'controladosPct' || clave === 'vistosRondaPct' ? x - y : y - x;
    });
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: "Mapa de bateyes", descripcion: "El tama\u00F1o del c\u00EDrculo es la cantidad de pacientes; el color, c\u00F3mo va el indicador elegido." }), _jsx("div", { className: "mb-4 flex flex-wrap gap-1.5", children: Object.keys(INDICADORES).map((k) => (_jsx("button", { onClick: () => setParams(k === 'controladosPct' ? {} : { ver: k }, { replace: true }), className: cn('rounded-full border px-3 py-1.5 text-sm', clave === k ? 'border-tinta bg-marca-500 font-medium' : 'border-borde bg-superficie text-tenue hover:text-tinta'), title: INDICADORES[k].ayuda, children: INDICADORES[k].texto }, k))) }), _jsxs("div", { className: "grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]", children: [_jsxs("div", { className: "relative h-[560px] overflow-hidden rounded-xl border border-borde", children: [_jsxs(MapaBase, { children: [_jsx(Encuadrar, { puntos: ubicados.map((b) => [b.latitud, b.longitud]) }), ubicados.map((b) => {
                                        const v = ind.valor(b);
                                        const color = ind.color(v, max);
                                        return (_jsxs(CircleMarker, { center: [b.latitud, b.longitud], radius: radio(b), pathOptions: { color: resaltado === b.id ? '#1d1b18' : '#ffffff', weight: resaltado === b.id ? 3 : 2, fillColor: color, fillOpacity: 0.75 }, eventHandlers: { mouseover: () => setResaltado(b.id), mouseout: () => setResaltado(null) }, children: [_jsxs(Tooltip, { direction: "top", offset: [0, -radio(b)], children: [_jsx("strong", { children: b.nombre }), " \u00B7 ", ind.formato(v)] }), _jsx(Popup, { children: _jsxs("div", { className: "min-w-52 space-y-0.5 text-[13px] leading-snug [&_p]:!my-0", children: [_jsx("p", { className: "mb-1 text-sm font-semibold", children: b.nombre }), _jsxs("p", { children: [b.pacientes, " pacientes activos"] }), _jsxs("p", { children: ["Controlados: ", INDICADORES.controladosPct.formato(b.controladosPct)] }), _jsxs("p", { children: ["Vistos en la ronda: ", INDICADORES.vistosRondaPct.formato(b.vistosRondaPct)] }), _jsxs("p", { children: ["No asisten hace +6 meses: ", b.sinVenir] }), _jsxs("p", { children: ["PA promedio: ", b.sistolica ? `${b.sistolica}/${b.diastolica}` : '—'] }), _jsxs("p", { children: ["\u00DAltima visita: ", fecha(b.ultimaVisita)] }), _jsxs("p", { children: ["Pr\u00F3xima jornada: ", b.proximaJornada ? diaJornada(b.proximaJornada) : 'sin planificar'] }), _jsxs("p", { className: "mt-2 flex gap-3", children: [_jsx(Link, { to: `/pacientes?batey=${b.id}`, children: "Pacientes" }), !b.proximaJornada && tiene('jornadas.planificar') && _jsx(Link, { to: `/jornadas/nueva?batey=${b.id}`, children: "Planificar jornada" })] })] }) })] }, b.id));
                                    })] }), ubicados.length === 0 && (_jsxs("div", { className: "absolute top-4 right-4 left-14 z-[500] rounded-lg bg-superficie/95 px-4 py-3 text-sm shadow", children: ["Todav\u00EDa no hay bateyes ubicados. ", tiene('comunidades.gestionar') ? 'Abre cada batey de la lista y toca el mapa donde está.' : 'Pide a quien gestiona los bateyes que los ubique.'] })), clave !== 'pacientes' && (_jsxs("div", { className: "absolute bottom-4 left-4 z-[500] rounded-lg bg-superficie/95 px-3 py-2 text-xs shadow", children: [_jsx("p", { className: "mb-1 font-medium", children: ind.texto }), _jsx("p", { className: "flex items-center gap-3", children: [
                                            ['#15803d', 'Bien'],
                                            ['#ca8a04', 'Regular'],
                                            ['#dc2626', 'Atender'],
                                            ['#a8a29e', 'Sin dato'],
                                        ].map(([c, t]) => (_jsxs("span", { className: "flex items-center gap-1", children: [_jsx("span", { className: "size-2.5 rounded-full", style: { backgroundColor: c } }), " ", t] }, t))) })] }))] }), _jsxs(Tarjeta, { titulo: `${ind.texto} por batey`, accion: _jsx("span", { className: "text-xs text-tenue", children: ind.ayuda }), children: [_jsx("ul", { className: "max-h-[505px] divide-y divide-borde overflow-y-auto", children: ordenados.map((b) => {
                                    const v = ind.valor(b);
                                    const ubicado = b.latitud !== null && b.longitud !== null;
                                    return (_jsxs("li", { onMouseEnter: () => setResaltado(b.id), onMouseLeave: () => setResaltado(null), onClick: () => navegar(ubicado ? `/pacientes?batey=${b.id}` : tiene('comunidades.gestionar') ? `/comunidades/${b.id}` : `/pacientes?batey=${b.id}`), className: cn('flex cursor-pointer items-center gap-3 px-5 py-2.5 text-sm hover:bg-fondo', resaltado === b.id && 'bg-marca-50'), children: [_jsx("span", { className: "size-3 shrink-0 rounded-full", style: { backgroundColor: ind.color(v, max) } }), _jsxs("span", { className: "min-w-0 flex-1", children: [_jsx("span", { className: "block truncate font-medium", children: b.nombre }), _jsxs("span", { className: "text-xs text-tenue", children: [b.pacientes, " pacientes", !ubicado && (_jsxs("span", { className: "ml-1.5 inline-flex items-center gap-0.5 text-amber-700", children: [_jsx(MapPinOff, { className: "size-3" }), " sin ubicar"] }))] })] }), _jsx("span", { className: "tabular font-semibold", children: ind.formato(v) })] }, b.id));
                                }) }), sinUbicar.length > 0 && tiene('comunidades.gestionar') && (_jsxs("p", { className: "border-t border-borde px-5 py-2.5 text-xs text-tenue", children: [sinUbicar.length, " bateyes sin ubicar: t\u00F3calos para marcarlos en el mapa."] }))] })] })] }));
}
