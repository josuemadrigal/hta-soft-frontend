import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { usePlanilla } from '../api/consultas';
import { destinatariosPlanilla, enviarPlanilla } from '../api/recursos';
import { useSesion } from '../auth/sesion';
import { AreaTexto, Boton, Campo, Cargando, EncabezadoPagina, ErrorCarga, Insignia, Tarjeta } from '../components/ui';
import { cn } from '../lib/formato';
import { usePeriodoPanel } from '../lib/periodo-panel';
import { useEnLinea } from '../offline/datos';
import { useVolver } from '../lib/navegacion';
/** Separa lo que se escribió en "Otros correos": por comas, punto y coma, espacios o renglones. */
const separar = (s) => s
    .split(/[\s,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);
const valido = (c) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c);
/** /reportes/planilla/enviar?desde=&hasta= — la planilla por correo a quien se elija. Nunca sale sola. */
export function EnviarPlanilla() {
    const periodo = usePeriodoPanel();
    const filtro = { from: `${periodo.desde}T00:00:00-04:00`, to: `${periodo.hasta}T23:59:59-04:00` };
    const planilla = usePlanilla(filtro);
    const lista = useQuery({ queryKey: ['reportes', 'planilla', 'destinatarios'], queryFn: destinatariosPlanilla });
    const { usuario } = useSesion();
    const enLinea = useEnLinea();
    const volverA = useVolver();
    const cliente = useQueryClient();
    const volver = `/reportes/planilla?desde=${periodo.desde}${periodo.hasta !== periodo.desde ? `&hasta=${periodo.hasta}` : ''}`;
    const [elegidos, setElegidos] = useState(new Set());
    const [otros, setOtros] = useState('');
    const [nota, setNota] = useState('');
    // Los otros correos de la última vez (los donantes suelen ser los mismos).
    useEffect(() => {
        if (lista.data?.otrosCorreos.length && !otros)
            setOtros(lista.data.otrosCorreos.join(', '));
    }, [lista.data]); // eslint-disable-line react-hooks/exhaustive-deps
    const correos = separar(otros);
    const malos = correos.filter((c) => !valido(c));
    const total = elegidos.size + correos.length - malos.length;
    const enviar = useMutation({
        mutationFn: () => enviarPlanilla({ ...filtro, periodo: periodo.texto, destinatarios: [...elegidos], correos, nota: nota.trim() || undefined }),
        onSuccess: (r) => {
            cliente.invalidateQueries({ queryKey: ['auditoria'] });
            cliente.invalidateQueries({ queryKey: ['reportes', 'planilla', 'destinatarios'] });
            toast.success(r.simulado ? 'Planilla generada. El servidor no tiene correo configurado: quedó en la consola del backend.' : `Planilla enviada a ${r.para.join(', ')}.`);
            volverA(volver);
        },
        onError: (e) => toast.error(e.message),
    });
    if (lista.isPending)
        return _jsx(Cargando, { forma: "lista" });
    if (lista.isError)
        return _jsx(ErrorCarga, { error: lista.error });
    const usuarios = lista.data.usuarios;
    const confirmados = usuarios.filter((u) => u.confirmado);
    const alternar = (id) => setElegidos((s) => {
        const n = new Set(s);
        if (n.has(id))
            n.delete(id);
        else
            n.add(id);
        return n;
    });
    const t = planilla.data?.total;
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: "Enviar la planilla por correo", descripcion: `Periodo: ${periodo.texto}`, volver: { a: volver, texto: 'Planilla de la jornada' } }), _jsxs("div", { className: "grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]", children: [_jsxs("div", { className: "space-y-4", children: [_jsxs(Tarjeta, { titulo: "Usuarios", accion: confirmados.length > 1 && (_jsx("button", { type: "button", className: "text-sm text-tenue hover:text-tinta", onClick: () => setElegidos(elegidos.size === confirmados.length ? new Set() : new Set(confirmados.map((u) => u.id))), children: elegidos.size === confirmados.length ? 'Quitar todos' : 'Elegir todos' })), children: [_jsx("ul", { className: "max-h-96 divide-y divide-borde overflow-y-auto", children: usuarios.map((u) => (_jsx("li", { children: _jsxs("label", { className: cn('flex items-center gap-3 px-5 py-3 text-sm', u.confirmado ? 'cursor-pointer hover:bg-fondo' : 'opacity-60'), children: [_jsx("input", { type: "checkbox", className: "size-5 accent-tinta", disabled: !u.confirmado, checked: elegidos.has(u.id), onChange: () => alternar(u.id) }), _jsxs("span", { className: "min-w-0 flex-1", children: [_jsxs("span", { className: "block font-medium", children: [u.nombre, " ", u.id === usuario?.id && _jsx("span", { className: "font-normal text-tenue", children: "(t\u00FA)" })] }), _jsxs("span", { className: "block truncate text-xs text-tenue", children: [u.email, " \u00B7 ", u.rol] })] }), !u.confirmado && _jsx(Insignia, { color: "#a16207", children: "Correo sin confirmar" })] }) }, u.id))) }), confirmados.length < usuarios.length && (_jsxs("p", { className: "border-t border-borde px-5 py-3 text-sm text-tenue", children: ["Solo se manda a usuarios con el correo confirmado. Cada persona confirma el suyo desde", ' ', _jsx(Link, { to: "/cuenta", className: "underline", children: "Mi cuenta" }), "."] }))] }), _jsx(Tarjeta, { titulo: "Otros correos", children: _jsx("div", { className: "space-y-2 p-5", children: _jsx(Campo, { etiqueta: "Donantes, la directora u otras personas que no usan la app (opcional)", error: malos.length ? `Revisa: ${malos.join(', ')}` : undefined, ayuda: "Sep\u00E1ralos con comas. La planilla solo lleva cifras por batey, sin nombres ni datos de pacientes. Se recuerdan para la pr\u00F3xima vez.", children: _jsx(AreaTexto, { rows: 2, value: otros, onChange: (e) => setOtros(e.target.value), placeholder: "nombre@ejemplo.org, otra@ejemplo.org", "aria-invalid": malos.length > 0 }) }) }) }), _jsx(Tarjeta, { titulo: "Nota (opcional)", children: _jsx("div", { className: "p-5", children: _jsx(AreaTexto, { rows: 3, maxLength: 1000, value: nota, onChange: (e) => setNota(e.target.value), placeholder: "Va arriba de la planilla: un saludo, lo que pas\u00F3 en la jornada\u2026", "aria-label": "Nota" }) }) }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Boton, { variante: "secundario", onClick: () => volverA(volver), children: "Cancelar" }), _jsx(Boton, { icono: _jsx(Send, { className: "size-4" }), disabled: !total || malos.length > 0 || !enLinea || correos.length > 15, title: !enLinea ? 'Sin conexión' : undefined, cargando: enviar.isPending, onClick: () => enviar.mutate(), children: total > 1 ? `Enviar a ${total} personas` : 'Enviar' })] })] }), _jsx("aside", { className: "lg:sticky lg:top-6 lg:self-start", children: _jsxs(Tarjeta, { titulo: "Lo que lleva el correo", children: [planilla.isPending ? (_jsx(Cargando, { forma: "linea" })) : t ? (_jsx("ul", { className: "space-y-2 p-5 text-sm", children: [
                                        ['Bateyes con visitas', planilla.data.filas.filter((f) => f.evaluados > 0).length],
                                        ['Pacientes evaluados', t.evaluados],
                                        ['Controlados', t.controlados],
                                        ['No controlados', t.noControlados],
                                        ['Pacientes nuevos', t.nuevos],
                                    ].map(([k, v]) => (_jsxs("li", { className: "flex justify-between gap-3", children: [_jsx("span", { className: "text-tenue", children: k }), _jsx("strong", { className: "tabular", children: v.toLocaleString('es-DO') })] }, k))) })) : null, _jsxs("p", { className: "flex gap-2 border-t border-borde px-5 py-3 text-sm text-tenue", children: [_jsx(Mail, { className: "mt-0.5 size-4 shrink-0" }), "La tabla por batey en espa\u00F1ol e ingl\u00E9s, y la planilla completa adjunta en CSV para abrir con Excel."] }), !lista.data.correoConfigurado && (_jsx("p", { className: "border-t border-borde bg-amber-50 px-5 py-3 text-sm text-amber-800", children: "El servidor no tiene correo configurado: la planilla no saldr\u00E1 (en desarrollo se escribe en la consola)." }))] }) })] })] }));
}
