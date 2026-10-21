import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Send } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { useDetalleJornada } from '../api/consultas';
import { destinatariosResumen, enviarResumenJornada } from '../api/recursos';
import { useSesion } from '../auth/sesion';
import { AreaTexto, Boton, Campo, Cargando, Casilla, EncabezadoPagina, ErrorCarga, Insignia, Tarjeta, Vacio } from '../components/ui';
import { useEnLinea } from '../offline/datos';
import { cn } from '../lib/formato';
import { diaJornada } from './Jornadas';
import { useVolver } from '../lib/navegacion';
/** /jornadas/:id/enviar-resumen — manda el resumen por correo a quien se elija. Nunca sale solo. */
export function EnviarResumen() {
    const id = Number(useParams().id);
    const jornada = useDetalleJornada(id);
    const lista = useQuery({ queryKey: ['jornadas', 'destinatarios'], queryFn: destinatariosResumen });
    const { usuario } = useSesion();
    const enLinea = useEnLinea();
    const volverA = useVolver();
    const cliente = useQueryClient();
    const [elegidos, setElegidos] = useState(new Set());
    const [nombres, setNombres] = useState(false);
    const [nota, setNota] = useState('');
    const enviar = useMutation({
        mutationFn: () => enviarResumenJornada(id, { destinatarios: [...elegidos], nombres, nota: nota.trim() || undefined }),
        onSuccess: (r) => {
            cliente.invalidateQueries({ queryKey: ['auditoria'] });
            toast.success(r.simulado
                ? 'Resumen generado. El servidor no tiene correo configurado: quedó en la consola del backend.'
                : `Resumen enviado a ${r.para?.join(', ')}.`);
            volverA(`/jornadas/${id}`);
        },
        onError: (e) => toast.error(e.message),
    });
    if (jornada.isPending || lista.isPending)
        return _jsx(Cargando, {});
    if (jornada.isError)
        return _jsx(ErrorCarga, { error: jornada.error });
    if (lista.isError)
        return _jsx(ErrorCarga, { error: lista.error });
    const j = jornada.data.jornada;
    if (j.estado === 'CANCELADA')
        return _jsx(Vacio, { titulo: "La jornada est\u00E1 cancelada", children: "No hay resumen que enviar." });
    const t = j.estado === 'CERRADA' && j.resumen ? j.resumen : jornada.data.totales;
    const usuarios = lista.data.usuarios;
    const confirmados = usuarios.filter((u) => u.confirmado);
    const sinConfirmar = usuarios.length - confirmados.length;
    const alternar = (uid) => setElegidos((s) => {
        const n = new Set(s);
        if (n.has(uid))
            n.delete(uid);
        else
            n.add(uid);
        return n;
    });
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: "Enviar resumen por correo", descripcion: `${j.community.name} · ${diaJornada(j.fecha, true)}`, volver: { a: `/jornadas/${id}`, texto: j.community.name } }), _jsxs("div", { className: "grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]", children: [_jsxs("div", { className: "space-y-4", children: [_jsxs(Tarjeta, { titulo: "Para", accion: confirmados.length > 1 && (_jsx("button", { type: "button", className: "text-sm text-tenue hover:text-tinta", onClick: () => setElegidos(elegidos.size === confirmados.length ? new Set() : new Set(confirmados.map((u) => u.id))), children: elegidos.size === confirmados.length ? 'Quitar todos' : 'Elegir todos' })), children: [usuarios.length === 0 ? (_jsx(Vacio, { titulo: "No hay usuarios que puedan recibirlo" })) : (_jsx("ul", { className: "divide-y divide-borde", children: usuarios.map((u) => (_jsx("li", { children: _jsxs("label", { className: cn('flex items-center gap-3 px-5 py-3 text-sm', u.confirmado ? 'cursor-pointer hover:bg-fondo' : 'opacity-60'), children: [_jsx("input", { type: "checkbox", className: "size-5 accent-tinta", disabled: !u.confirmado, checked: elegidos.has(u.id), onChange: () => alternar(u.id) }), _jsxs("span", { className: "min-w-0 flex-1", children: [_jsxs("span", { className: "block font-medium", children: [u.nombre, " ", u.id === usuario?.id && _jsx("span", { className: "font-normal text-tenue", children: "(t\u00FA)" })] }), _jsxs("span", { className: "block truncate text-xs text-tenue", children: [u.email, " \u00B7 ", u.rol] })] }), !u.confirmado && _jsx(Insignia, { color: "#a16207", children: "Correo sin confirmar" })] }) }, u.id))) })), sinConfirmar > 0 && (_jsxs("p", { className: "border-t border-borde px-5 py-3 text-sm text-tenue", children: ["El resumen lleva datos de salud: solo se manda a correos confirmados. Cada persona confirma el suyo desde", ' ', _jsx(Link, { to: "/cuenta", className: "underline", children: "Mi cuenta" }), "."] }))] }), _jsx(Tarjeta, { titulo: "Contenido", children: _jsxs("div", { className: "space-y-4 p-5", children: [_jsx(Casilla, { etiqueta: "Incluir los nombres de los pacientes (si no, solo el c\u00F3digo)", checked: nombres, onChange: (e) => setNombres(e.target.checked) }), _jsx(Campo, { etiqueta: "Nota (opcional)", ayuda: "Aparece arriba del resumen: lo que falt\u00F3, lo que hay que llevar la pr\u00F3xima vez\u2026", children: _jsx(AreaTexto, { rows: 3, maxLength: 1000, value: nota, onChange: (e) => setNota(e.target.value) }) })] }) }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Boton, { variante: "secundario", onClick: () => volverA(`/jornadas/${id}`), children: "Cancelar" }), _jsx(Boton, { icono: _jsx(Send, { className: "size-4" }), disabled: !elegidos.size || !enLinea, title: !enLinea ? 'Sin conexión' : undefined, cargando: enviar.isPending, onClick: () => enviar.mutate(), children: elegidos.size > 1 ? `Enviar a ${elegidos.size} personas` : 'Enviar' })] })] }), _jsx("aside", { className: "lg:sticky lg:top-6 lg:self-start", children: _jsxs(Tarjeta, { titulo: "Lo que lleva el correo", children: [_jsxs("ul", { className: "space-y-2 p-5 text-sm", children: [_jsxs("li", { className: "flex justify-between gap-3", children: [_jsx("span", { className: "text-tenue", children: "Atendidos" }), _jsx("strong", { children: t.atendidos })] }), _jsxs("li", { className: "flex justify-between gap-3", children: [_jsx("span", { className: "text-tenue", children: "Faltan por ver" }), _jsx("strong", { children: t.faltan })] }), _jsxs("li", { className: "flex justify-between gap-3", children: [_jsx("span", { className: "text-tenue", children: "Marcados \"No vino\"" }), _jsx("strong", { children: t.noVinieron ?? 0 })] }), _jsxs("li", { className: "flex justify-between gap-3", children: [_jsx("span", { className: "text-tenue", children: "Controlados" }), _jsx("strong", { children: t.controlados })] })] }), _jsxs("p", { className: "flex gap-2 border-t border-borde px-5 py-3 text-sm text-tenue", children: [_jsx(Mail, { className: "mt-0.5 size-4 shrink-0" }), "Adem\u00E1s: medicamentos entregados, pacientes con HTA grado 2 o crisis y la lista de los que faltan, con el motivo si se marc\u00F3 \"No vino\"."] }), !lista.data.correoConfigurado && (_jsx("p", { className: "border-t border-borde bg-amber-50 px-5 py-3 text-sm text-amber-800", children: "El servidor no tiene correo configurado: el resumen no saldr\u00E1 (en desarrollo se escribe en la consola)." }))] }) })] })] }));
}
