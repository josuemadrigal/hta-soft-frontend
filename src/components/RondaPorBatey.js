import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CalendarPlus, Check } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useIndicadoresBateyes } from '../api/consultas';
import { useSesion } from '../auth/sesion';
import { fecha } from '../lib/formato';
import { diaJornada } from '../pages/Jornadas';
import { Tarjeta } from './ui';
import { AYUDA } from '../lib/ayuda-graficas';
const miles = (n) => n.toLocaleString('es-DO');
/**
 * Ronda actual por batey en una tabla: cuánto se ha visto, cuántos están pendientes, cuántos dejaron
 * de venir (más de 6 meses), la última visita y la próxima jornada. Tocar una fila abre su jornada.
 */
export function RondaPorBatey({ ronda }) {
    const navegar = useNavigate();
    const { tiene } = useSesion();
    const indicadores = useIndicadoresBateyes();
    // Primero donde más faltan para llegar a lo esperado: ahí hace falta la próxima jornada.
    const faltan = (c) => c.missing ?? c.pending;
    const filas = [...ronda.byCommunity].sort((a, b) => faltan(b) - faltan(a) || b.active - a.active);
    const th = 'px-3 py-2.5 text-right font-medium whitespace-nowrap';
    const td = 'px-3 py-2.5 text-right tabular-nums';
    return (_jsx(Tarjeta, { titulo: `Ronda ${ronda.round.label} por batey`, copiable: true, ayuda: AYUDA.rondaPorBatey, accion: _jsx("span", { className: "text-xs text-tenue", children: "Toca un batey para abrir su jornada" }), children: _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-borde text-xs text-tenue", children: [_jsx("th", { className: "px-5 py-2.5 text-left font-medium", children: "Batey" }), _jsx("th", { className: th, title: "Los que se han perdido como mucho las visitas que se fijan en Configuraci\u00F3n", children: "Regulares" }), _jsx("th", { className: th, title: "Media alta de las \u00FAltimas jornadas del batey: el promedio de las que tuvieron m\u00E1s pacientes (se ajusta en Configuraci\u00F3n)", children: "Esperados" }), _jsx("th", { className: "w-56 px-3 py-2.5 text-left font-medium", children: "Vistos en la ronda" }), _jsx("th", { className: th, title: "Los que faltan para llegar a lo esperado", children: "Faltan" }), _jsx("th", { className: th, title: "M\u00E1s de 6 meses sin venir", children: "Dejaron de venir" }), _jsx("th", { className: th, children: "\u00DAltima visita" }), _jsx("th", { className: "px-5 py-2.5 text-left font-medium", children: "Pr\u00F3xima jornada" })] }) }), _jsx("tbody", { className: "divide-y divide-borde", children: filas.map((c) => {
                            // Contra lo esperado (media alta de las últimas jornadas); se puede pasar del 100 %.
                            const esperados = c.expected ?? c.active;
                            const pct = esperados ? Math.round((c.seen / esperados) * 100) : 0;
                            const proxima = indicadores.data?.find((b) => b.id === c.communityId)?.proximaJornada ?? null;
                            return (_jsxs("tr", { onClick: () => navegar(`/jornada?batey=${c.communityId}`), className: "cursor-pointer hover:bg-fondo", children: [_jsx("td", { className: "px-5 py-2.5 font-medium whitespace-nowrap", children: c.name }), _jsx("td", { className: `${td} text-tenue`, title: c.retired ? `${c.retired} más ya no vienen` : undefined, children: miles(c.active) }), _jsxs("td", { className: td, children: ["~", miles(esperados)] }), _jsx("td", { className: "px-3 py-2.5", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]", children: _jsx("div", { className: pct >= 100 ? 'h-full rounded-full bg-green-600' : 'h-full rounded-full bg-tinta', style: { width: `${Math.min(100, pct)}%` } }) }), _jsxs("span", { className: "w-20 text-right text-xs text-tenue tabular-nums", children: [miles(c.seen), " \u00B7 ", pct, "%"] })] }) }), _jsx("td", { className: td, children: faltan(c) ? miles(faltan(c)) : _jsx(Check, { className: "ml-auto size-4 text-green-700", "aria-label": "Ya se lleg\u00F3 a lo esperado" }) }), _jsx("td", { className: `${td} text-tenue`, title: c.absentYear ? `${c.absentYear} de ellos hace más de un año` : undefined, children: c.absent ? miles(c.absent) : '—' }), _jsx("td", { className: `${td} whitespace-nowrap text-tenue`, children: fecha(c.lastVisit) }), _jsx("td", { className: "px-5 py-2.5 whitespace-nowrap", children: proxima ? (_jsx("span", { className: "text-green-700", children: diaJornada(proxima) })) : tiene('jornadas.planificar') ? (_jsxs(Link, { to: `/jornadas/nueva?batey=${c.communityId}`, onClick: (e) => e.stopPropagation(), className: "inline-flex items-center gap-1 text-xs text-tenue hover:text-tinta hover:underline", children: [_jsx(CalendarPlus, { className: "size-3.5" }), " Planificar"] })) : (_jsx("span", { className: "text-xs text-tenue", children: "\u2014" })) })] }, c.communityId));
                        }) })] }) }) }));
}
