import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { CloudOff, RefreshCw, Trash2, Wifi } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { useConfirmar } from '../components/confirmar';
import { Boton, EncabezadoPagina, Insignia, Tarjeta, Vacio } from '../components/ui';
import { fechaYHora } from '../lib/formato';
import { descartarPendiente, reintentarPendiente, sincronizar, useEstadoSincronizacion, usePendientes } from '../offline/cola';
import { useEnLinea } from '../offline/datos';
const TIPOS = { visita: 'Visita', 'no-vino': 'No vino', 'quitar-no-vino': 'Deshacer "No vino"', entrega: 'Entrega', reposicion: 'Reposición' };
/** /sincronizacion — lo registrado sin internet que falta por enviar, y lo que el servidor rechazó. */
export function Sincronizacion() {
    const pendientes = usePendientes();
    const estado = useEstadoSincronizacion();
    const enLinea = useEnLinea();
    const confirmar = useConfirmar();
    const conError = pendientes.filter((p) => p.error);
    const enviarAhora = async () => {
        const r = await sincronizar();
        if (r.enviados)
            toast.success(`${r.enviados} ${r.enviados === 1 ? 'registro enviado' : 'registros enviados'}`);
        if (r.conError)
            toast.error(`${r.conError} ${r.conError === 1 ? 'registro fue rechazado' : 'registros fueron rechazados'}: revísalos abajo`);
    };
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: "Sin conexi\u00F3n y pendientes", descripcion: "Lo que se registra sin internet queda guardado en este dispositivo y se env\u00EDa solo cuando vuelve la se\u00F1al.", acciones: _jsx(Boton, { icono: _jsx(RefreshCw, { className: "size-4" }), disabled: !enLinea || !pendientes.length, cargando: estado.sincronizando, onClick: () => void enviarAhora(), children: "Enviar ahora" }) }), _jsxs("div", { className: "mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-borde bg-superficie px-5 py-3 text-sm", children: [enLinea ? _jsx(Wifi, { className: "size-4 text-green-700" }) : _jsx(CloudOff, { className: "size-4 text-amber-700" }), _jsxs("span", { className: "flex-1", children: [enLinea ? 'Hay conexión.' : 'Sin conexión: puedes seguir registrando visitas y "No vino" en los bateyes que descargaste.', estado.ultimo && _jsxs("span", { className: "text-tenue", children: [" \u00DAltimo intento de env\u00EDo: ", fechaYHora(estado.ultimo), "."] })] })] }), _jsx(Tarjeta, { titulo: `Pendientes de enviar (${pendientes.length})`, children: pendientes.length === 0 ? (_jsx(Vacio, { titulo: "Todo est\u00E1 enviado", children: "Nada esperando en este dispositivo." })) : (_jsx("ul", { className: "divide-y divide-borde", children: pendientes.map((p) => (_jsxs("li", { className: "flex flex-wrap items-center gap-3 px-5 py-3 text-sm", children: [_jsx(Insignia, { color: p.error ? '#dc2626' : '#a16207', children: TIPOS[p.tipo] }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx(Link, { to: `/pacientes/${p.resumen.pacienteId}`, className: "font-medium hover:underline", children: p.resumen.paciente }), _jsxs("p", { className: "text-xs text-tenue", children: [p.resumen.detalle, " \u00B7 registrado ", fechaYHora(p.creado)] }), p.error && _jsxs("p", { className: "mt-1 text-xs text-red-600", children: ["El servidor lo rechaz\u00F3: ", p.error] })] }), p.error && (_jsx(Boton, { variante: "secundario", className: "h-8 text-xs", disabled: !enLinea, onClick: () => void reintentarPendiente(p.id), children: "Reintentar" })), _jsx(Boton, { variante: "fantasma", className: "h-8 px-2 hover:text-red-600", "aria-label": "Descartar", onClick: async () => {
                                    if (await confirmar({
                                        titulo: '¿Descartar este registro?',
                                        mensaje: 'Se borra de este dispositivo y no se enviará. Si es una visita, habrá que registrarla de nuevo.',
                                        confirmar: 'Descartar',
                                    }))
                                        void descartarPendiente(p.id);
                                }, children: _jsx(Trash2, { className: "size-4" }) })] }, p.id))) })) }), conError.length > 0 && (_jsx("p", { className: "mt-3 text-sm text-tenue", children: "Un registro rechazado no se reintenta solo. Lo m\u00E1s com\u00FAn es que falte inventario: carga la entrada del medicamento y pulsa \"Reintentar\"." }))] }));
}
