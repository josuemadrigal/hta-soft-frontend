import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { ClipboardList, Download, Home, Pencil, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { usePermisosVisita } from '../auth/permisosVisita';
import { useEliminarVisita } from '../components/eliminarVisita';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useComunidades, useConfigPA, useQuienesAtienden, useVisitas } from '../api/consultas';
import { listarVisitas } from '../api/recursos';
import { Boton, Campo, Cargando, EncabezadoPagina, Entrada, ErrorCarga, Insignia, InsigniaCategoria, Paginacion, porPaginaDe, recordarPorPagina, Selector, Tabla, Tarjeta, Vacio } from '../components/ui';
import { descargarCsv } from '../lib/copiar';
import { CATEGORIAS, opciones, TIPOS_VISITA } from '../lib/etiquetas';
import { atendio, cn, decimal, fechaYHora, nombreCompleto, tensionDe } from '../lib/formato';
import { Periodo } from '../components/Periodo';
const num = (v) => (v ? Number(v) : undefined);
export function Visitas() {
    const navegar = useNavigate();
    // Filtros en la URL: se pueden compartir y "atrás" desde la ficha vuelve al mismo listado.
    const [params, setParams] = useSearchParams();
    const filtro = {
        page: Number(params.get('pagina')) || 1,
        limit: porPaginaDe(params, 'visitas', 25),
        search: params.get('q') ?? undefined,
        communityId: num(params.get('batey')),
        from: params.get('desde') ?? undefined,
        // Hasta el final del día elegido.
        to: params.get('hasta') ?? undefined,
        doctorId: num(params.get('atendio')),
        bpClassificationId: num(params.get('categoria')),
        visitType: params.get('tipo') ?? undefined,
    };
    const [texto, setTexto] = useState(filtro.search ?? '');
    const [exportando, setExportando] = useState(false);
    const cambiar = (cambios) => setParams((p) => {
        for (const [k, v] of Object.entries(cambios))
            v ? p.set(k, String(v)) : p.delete(k);
        if (!('pagina' in cambios))
            p.delete('pagina');
        return p;
    }, { replace: true });
    useEffect(() => {
        const t = setTimeout(() => texto !== (filtro.search ?? '') && cambiar({ q: texto.trim() }), 300);
        return () => clearTimeout(t);
    }, [texto]);
    const consulta = useVisitas(filtro);
    const permisos = usePermisosVisita();
    const eliminar = useEliminarVisita();
    const comunidades = useComunidades();
    const configs = useConfigPA();
    const atienden = useQuienesAtienden();
    const hayFiltros = [...params.keys()].some((k) => k !== 'pagina');
    // Cuántos filtros del panel están puestos (el buscador va aparte).
    const activos = ['batey', 'categoria', 'atendio', 'tipo'].filter((k) => params.get(k)).length + (params.get('desde') || params.get('hasta') ? 1 : 0);
    const [masFiltros, setMasFiltros] = useState(activos > 0);
    // Exporta todas las páginas con los filtros actuales.
    const exportar = async () => {
        setExportando(true);
        try {
            const filas = [];
            for (let page = 1;; page++) {
                const r = await listarVisitas({ ...filtro, page, limit: 200 });
                filas.push(...r.data);
                if (page >= r.meta.lastPage)
                    break;
            }
            descargarCsv(filas.map((v) => ({
                fecha: fechaYHora(v.visitDate),
                codigo: v.patient?.patientCode,
                paciente: v.patient && nombreCompleto(v.patient),
                batey: v.patient?.community?.name,
                tipo: TIPOS_VISITA[v.visitType],
                pa: tensionDe(v),
                clasificacion: v.bpClassification && CATEGORIAS[v.bpClassification.categoryName],
                imc: decimal(v.bmi),
                medicamentos: v.prescriptions?.map((p) => `${p.medication?.name} ${p.medication?.concentration} (${p.quantityDispensed})`).join('; '),
                atendio: atendio(v),
                comentario: v.notes,
            })), [
                { clave: 'fecha', titulo: 'Fecha' },
                { clave: 'codigo', titulo: 'Código' },
                { clave: 'paciente', titulo: 'Paciente' },
                { clave: 'batey', titulo: 'Batey' },
                { clave: 'tipo', titulo: 'Tipo' },
                { clave: 'pa', titulo: 'PA' },
                { clave: 'clasificacion', titulo: 'Clasificación' },
                { clave: 'imc', titulo: 'IMC' },
                { clave: 'medicamentos', titulo: 'Medicamentos (entregadas)' },
                { clave: 'atendio', titulo: 'Atendió' },
                { clave: 'comentario', titulo: 'Comentario' },
            ], 'visitas');
        }
        finally {
            setExportando(false);
        }
    };
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: "Visitas", descripcion: "Todas las visitas cl\u00EDnicas, de la m\u00E1s reciente a la m\u00E1s antigua.", acciones: _jsx(Boton, { variante: "secundario", icono: _jsx(Download, { className: "size-4" }), cargando: exportando, onClick: exportar, disabled: !consulta.data?.meta.total, children: "Exportar CSV" }) }), _jsxs(Tarjeta, { children: [_jsxs("div", { className: "space-y-3 border-b border-borde p-4", children: [_jsxs("div", { className: "flex flex-wrap gap-3", children: [_jsxs("div", { className: "relative min-w-60 flex-1", children: [_jsx(Search, { className: "pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tenue" }), _jsx(Entrada, { value: texto, onChange: (e) => setTexto(e.target.value), placeholder: "Paciente o c\u00F3digo", className: "pl-9" })] }), _jsxs(Boton, { variante: "secundario", icono: _jsx(SlidersHorizontal, { className: "size-4" }), onClick: () => setMasFiltros(!masFiltros), "aria-expanded": masFiltros, children: ["Filtros", activos > 0 && _jsx(Insignia, { className: "ml-0.5 bg-marca-500 text-tinta", children: activos })] })] }), masFiltros && (_jsxs("div", { className: "space-y-3 rounded-xl bg-fondo p-4", children: [_jsxs("div", { className: "grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-3", children: [_jsx(Campo, { etiqueta: "Batey", children: _jsx(Selector, { vacio: "Todos", value: filtro.communityId ?? '', onChange: (e) => cambiar({ batey: e.target.value }), opciones: (comunidades.data ?? []).map((c) => ({ value: c.id, label: c.name })) }) }), _jsx(Campo, { etiqueta: "Clasificaci\u00F3n", children: _jsx(Selector, { vacio: "Toda clasificaci\u00F3n", value: filtro.bpClassificationId ?? '', onChange: (e) => cambiar({ categoria: e.target.value }), opciones: [...(configs.data ?? [])].sort((a, b) => a.priority - b.priority).map((c) => ({ value: c.id, label: CATEGORIAS[c.categoryName] })) }) }), _jsx(Campo, { etiqueta: "Atendi\u00F3", children: _jsx(Selector, { vacio: "Cualquiera", value: filtro.doctorId ?? '', onChange: (e) => cambiar({ atendio: e.target.value }), opciones: (atienden.data ?? []).map((u) => ({ value: u.id, label: nombreCompleto(u) })) }) }), _jsx(Campo, { etiqueta: "Tipo de visita", children: _jsx(Selector, { vacio: "Todo tipo", value: filtro.visitType ?? '', onChange: (e) => cambiar({ tipo: e.target.value }), opciones: opciones(TIPOS_VISITA) }) })] }), _jsxs("div", { children: [_jsx("p", { className: "mb-1.5 text-[13px] font-medium text-tinta/80", children: "Periodo" }), _jsx(Periodo, { desde: params.get('desde'), hasta: params.get('hasta'), onCambiar: (r) => cambiar({ desde: r.desde, hasta: r.hasta }) })] })] })), hayFiltros && (_jsxs("button", { onClick: () => {
                                    setTexto('');
                                    setParams({}, { replace: true });
                                }, className: "flex items-center gap-1 text-sm font-medium text-marca-700 hover:underline", children: [_jsx(X, { className: "size-3.5" }), " Quitar filtros"] }))] }), consulta.isPending ? (_jsx(Cargando, {})) : consulta.isError ? (_jsx(ErrorCarga, { error: consulta.error })) : consulta.data.data.length === 0 ? (_jsx(Vacio, { icono: _jsx(ClipboardList, { className: "size-8" }), titulo: hayFiltros ? 'Ninguna visita coincide' : 'Sin visitas registradas', children: hayFiltros ? 'Prueba quitando algún filtro.' : 'Las visitas se registran desde la ficha de cada paciente o desde la jornada.' })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: cn('transition-opacity', consulta.isPlaceholderData && 'opacity-60'), children: _jsx(Tabla, { columnas: ['Fecha', 'Paciente', 'Batey', 'Tipo', 'PA', 'Clasificación', 'IMC', 'Atendió', { texto: '', className: 'w-20' }], children: consulta.data.data.map((v) => (_jsxs("tr", { onClick: () => navegar(`/pacientes/${v.patientId}`), className: "cursor-pointer hover:bg-fondo", children: [_jsx("td", { className: "px-5 py-3 whitespace-nowrap", children: fechaYHora(v.visitDate) }), _jsxs("td", { className: "px-5 py-3", children: [_jsx("p", { className: "font-medium whitespace-nowrap", children: v.patient && nombreCompleto(v.patient) }), _jsx("p", { className: "font-mono text-xs text-tenue", children: v.patient?.patientCode })] }), _jsx("td", { className: "px-5 py-3 whitespace-nowrap", children: v.patient?.community?.name }), _jsx("td", { className: "px-5 py-3", children: _jsxs("span", { className: "flex items-center gap-1.5 whitespace-nowrap", children: [TIPOS_VISITA[v.visitType], v.isHomeVisit && (_jsx(Insignia, { children: _jsx(Home, { className: "size-3" }) }))] }) }), _jsx("td", { className: "tabular px-5 py-3 font-mono", children: tensionDe(v) }), _jsx("td", { className: "px-5 py-3", children: _jsx(InsigniaCategoria, { config: v.bpClassification }) }), _jsx("td", { className: "tabular px-5 py-3", children: decimal(v.bmi) }), _jsxs("td", { className: "px-5 py-3 whitespace-nowrap text-tenue", children: [atendio(v), v.originalDoctorId && _jsx("span", { className: "block text-[11px]", children: "cuenta eliminada" })] }), _jsxs("td", { className: "px-3 py-2 text-right whitespace-nowrap", onClick: (e) => e.stopPropagation(), children: [permisos.puedeEditar(v) && (_jsx(Boton, { variante: "fantasma", className: "h-8 px-2", "aria-label": "Editar visita", title: "Editar visita", onClick: () => navegar(`/visitas/${v.id}/editar?volver=${encodeURIComponent(`/visitas?${params.toString()}`)}`), children: _jsx(Pencil, { className: "size-4" }) })), permisos.puedeEliminar && (_jsx(Boton, { variante: "fantasma", className: "h-8 px-2 hover:text-red-600", "aria-label": "Eliminar visita", title: "Eliminar visita", onClick: () => eliminar(v), children: _jsx(Trash2, { className: "size-4" }) }))] })] }, v.id))) }) }), _jsx(Paginacion, { pagina: filtro.page, ultima: consulta.data.meta.lastPage, total: consulta.data.meta.total, alCambiar: (p) => cambiar({ pagina: p }), porPagina: filtro.limit, alCambiarPorPagina: (n) => {
                                    recordarPorPagina('visitas', n);
                                    cambiar({ por: n });
                                } })] }))] })] }));
}
