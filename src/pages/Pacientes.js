import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Plus, Search, SlidersHorizontal, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useComunidades, useConfigPA, usePacientes, useUltimosMedicos } from '../api/consultas';
import { useSesion } from '../auth/sesion';
import { Avatar, Boton, Cargando, EncabezadoPagina, Entrada, ErrorCarga, Insignia, InsigniaCategoria, Paginacion, porPaginaDe, recordarPorPagina, Selector, Tabla, Tarjeta, Vacio } from '../components/ui';
import { CATEGORIAS, ESTADOS, GENEROS, opciones } from '../lib/etiquetas';
import { asistencia, SITUACIONES_ASISTENCIA } from '../lib/asistencia';
import { cn, edadTexto, fecha, nombreCompleto } from '../lib/formato';
import { SelectorFecha } from '../components/SelectorFecha';
const ORDENES = [
    { value: 'nombre', label: 'Nombre (A–Z)' },
    { value: 'codigo', label: 'Código' },
    { value: 'ultima-visita', label: 'Última visita (reciente primero)' },
    { value: 'ausencia', label: 'Más tiempo sin venir primero' },
    { value: 'presion', label: 'Presión más alta primero' },
    { value: 'visitas', label: 'Más visitas primero' },
];
export function Pacientes() {
    const navegar = useNavigate();
    const puedeEditar = useSesion().tiene('pacientes.editar');
    // Filtros en la URL: "atrás" desde la ficha vuelve al mismo listado, y se pueden compartir.
    const [params, setParams] = useSearchParams();
    const num = (k) => (params.get(k) ? Number(params.get(k)) : undefined);
    const filtro = {
        page: num('pagina') ?? 1,
        limit: porPaginaDe(params, 'pacientes', 15),
        search: params.get('q') ?? undefined,
        communityId: num('batey'),
        gender: params.get('genero') ?? undefined,
        status: params.get('estado') ?? undefined,
        clasificacion: params.get('clasificacion') ?? undefined,
        situacion: params.get('situacion') ?? undefined,
        ageMin: num('edadMin'),
        ageMax: num('edadMax'),
        medico: num('medico'),
        visitaDesde: params.get('desde') ?? undefined,
        visitaHasta: params.get('hasta') ?? undefined,
        orden: params.get('orden') ?? 'nombre',
    };
    const [texto, setTexto] = useState(filtro.search ?? '');
    const filtrosExtra = ['genero', 'estado', 'clasificacion', 'situacion', 'edadMin', 'edadMax', 'medico', 'desde', 'hasta'].filter((k) => params.get(k)).length;
    const porFecha = !!(filtro.visitaDesde || filtro.visitaHasta);
    const [masFiltros, setMasFiltros] = useState(filtrosExtra > 0);
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
    const comunidades = useComunidades();
    const configs = useConfigPA();
    const medicos = useUltimosMedicos();
    const consulta = usePacientes(filtro);
    const hayFiltros = [...params.keys()].some((k) => !['pagina', 'orden'].includes(k));
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: "Pacientes", descripcion: consulta.data ? `${consulta.data.meta.total.toLocaleString('es-DO')} pacientes${hayFiltros ? ' con estos filtros' : ''}.` : 'Registro de pacientes por batey.', acciones: puedeEditar && (_jsx(Boton, { icono: _jsx(Plus, { className: "size-4" }), onClick: () => navegar('/pacientes/nuevo'), children: "Nuevo paciente" })) }), _jsxs(Tarjeta, { children: [_jsxs("div", { className: "space-y-3 border-b border-borde p-4", children: [_jsxs("div", { className: "flex flex-wrap gap-3", children: [_jsxs("div", { className: "relative min-w-60 flex-1", children: [_jsx(Search, { className: "pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tenue" }), _jsx(Entrada, { value: texto, onChange: (e) => setTexto(e.target.value), placeholder: "Nombre, c\u00F3digo o n\u00FAmero de casa", className: "pl-9" })] }), _jsx(Selector, { className: "w-auto min-w-44", vacio: "Todos los bateyes", value: filtro.communityId ?? '', onChange: (e) => cambiar({ batey: e.target.value }), opciones: (comunidades.data ?? []).map((c) => ({ value: c.id, label: c.name })) }), _jsx(Selector, { className: "w-auto", value: filtro.orden, onChange: (e) => cambiar({ orden: e.target.value === 'nombre' ? undefined : e.target.value }), opciones: ORDENES, "aria-label": "Ordenar" }), _jsxs(Boton, { variante: "secundario", icono: _jsx(SlidersHorizontal, { className: "size-4" }), onClick: () => setMasFiltros(!masFiltros), "aria-expanded": masFiltros, children: ["Filtros", filtrosExtra > 0 && _jsx(Insignia, { className: "ml-0.5 bg-marca-500 text-tinta", children: filtrosExtra })] })] }), masFiltros && (_jsxs("div", { className: "grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-3", children: [_jsx(Selector, { vacio: "Toda clasificaci\u00F3n", value: filtro.clasificacion ?? '', onChange: (e) => cambiar({ clasificacion: e.target.value }), opciones: [
                                            ...[...(configs.data ?? [])].sort((a, b) => a.priority - b.priority).map((c) => ({ value: c.id, label: CATEGORIAS[c.categoryName] })),
                                            { value: 'ninguna', label: 'Sin toma válida' },
                                        ], "aria-label": "Clasificaci\u00F3n de la \u00FAltima toma" }), _jsx(Selector, { vacio: "Lo atendi\u00F3 (cualquiera)", value: filtro.medico ?? '', onChange: (e) => cambiar({ medico: e.target.value }), 
                                        // Con fechas, el médico es quien lo atendió en esas fechas: el número (de su última visita) ya no aplica.
                                        // Solo los usuarios activos por nombre; los demás (cuentas borradas, iniciales del Excel) juntos como "Otros".
                                        opciones: [
                                            ...(medicos.data ?? []).filter((m) => m.activo !== false).map((m) => ({ value: m.id, label: porFecha ? m.nombre : `${m.nombre} (${m.pacientes})` })),
                                            ...((medicos.data ?? []).some((m) => m.activo === false)
                                                ? [{ value: 0, label: porFecha ? 'Otros' : `Otros (${(medicos.data ?? []).filter((m) => m.activo === false).reduce((a, m) => a + m.pacientes, 0)})` }]
                                                : []),
                                        ], "aria-label": porFecha ? 'Lo atendió en esas fechas' : 'Último que lo atendió' }), _jsx(Selector, { vacio: "Cualquier asistencia", value: filtro.situacion ?? '', onChange: (e) => cambiar({ situacion: e.target.value }), opciones: SITUACIONES_ASISTENCIA, "aria-label": "Asistencia" }), _jsx(Selector, { vacio: "Todos los g\u00E9neros", value: filtro.gender ?? '', onChange: (e) => cambiar({ genero: e.target.value }), opciones: opciones(GENEROS), "aria-label": "G\u00E9nero" }), _jsx(Selector, { vacio: "Cualquier estado", value: filtro.status ?? '', onChange: (e) => cambiar({ estado: e.target.value }), opciones: opciones(ESTADOS), "aria-label": "Estado" }), _jsxs("div", { className: "col-span-full flex flex-wrap items-center gap-2 text-sm text-tenue sm:col-span-2", children: [_jsx("span", { className: "whitespace-nowrap", children: "Con visita" }), _jsx(SelectorFecha, { corto: true, vacio: "desde\u2026", className: "w-auto min-w-36 flex-1", "aria-label": "Con visita desde", value: filtro.visitaDesde, max: filtro.visitaHasta, onChange: (v) => cambiar({ desde: v }) }), _jsx(SelectorFecha, { corto: true, vacio: "hasta\u2026", className: "w-auto min-w-36 flex-1", "aria-label": "Con visita hasta", value: filtro.visitaHasta, min: filtro.visitaDesde, onChange: (v) => cambiar({ hasta: v }) })] }), _jsxs("div", { className: "flex items-center gap-2 text-sm whitespace-nowrap text-tenue", children: ["Edad", _jsx(Entrada, { type: "number", min: 0, max: 120, placeholder: "de", value: params.get('edadMin') ?? '', onChange: (e) => cambiar({ edadMin: e.target.value }) }), _jsx(Entrada, { type: "number", min: 0, max: 120, placeholder: "a", value: params.get('edadMax') ?? '', onChange: (e) => cambiar({ edadMax: e.target.value }) })] })] })), hayFiltros && (_jsxs("button", { onClick: () => {
                                    setTexto('');
                                    setParams(filtro.orden !== 'nombre' ? { orden: filtro.orden } : {}, { replace: true });
                                }, className: "flex items-center gap-1 text-sm font-medium text-marca-700 hover:underline", children: [_jsx(X, { className: "size-3.5" }), " Quitar filtros"] }))] }), consulta.isPending ? (_jsx(Cargando, {})) : consulta.isError ? (_jsx(ErrorCarga, { error: consulta.error })) : consulta.data.data.length === 0 ? (_jsx(Vacio, { icono: _jsx(Users, { className: "size-8" }), titulo: hayFiltros ? 'Ningún paciente coincide' : 'Todavía no hay pacientes', children: hayFiltros && 'Prueba quitando algún filtro.' })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: cn('transition-opacity', consulta.isPlaceholderData && 'opacity-60'), children: _jsx(Tabla, { columnas: ['Paciente', 'Código', 'Edad', 'Batey', { texto: 'Visitas', className: 'text-right' }, 'Última PA', 'Última visita', 'Lo atendió'], children: consulta.data.data.map((p) => {
                                        const a = p.status === 'ACTIVE' ? asistencia(p.lastVisitDate) : null;
                                        return (_jsxs("tr", { onClick: () => navegar(`/pacientes/${p.id}`), className: "cursor-pointer hover:bg-fondo", children: [_jsx("td", { className: "px-5 py-3", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Avatar, { persona: p, foto: p.photoUrl, tamano: "size-8" }), _jsxs("div", { className: "min-w-0", children: [_jsxs("p", { className: "flex items-center gap-2 font-medium whitespace-nowrap", children: [nombreCompleto(p), p.status !== 'ACTIVE' && _jsx(Insignia, { children: ESTADOS[p.status] })] }), _jsxs("p", { className: "text-xs whitespace-nowrap text-tenue", children: [GENEROS[p.gender], p.address && ` · Casa ${p.address}`] })] })] }) }), _jsx("td", { className: "px-5 py-3 font-mono text-[13px]", children: p.patientCode }), _jsx("td", { className: "tabular px-5 py-3 whitespace-nowrap", children: edadTexto(p) }), _jsx("td", { className: "px-5 py-3 whitespace-nowrap", children: p.community?.name }), _jsx("td", { className: cn('tabular px-5 py-3 text-right', !p._count?.clinicalVisits && 'text-tenue'), children: p._count?.clinicalVisits ?? '—' }), _jsx("td", { className: "px-5 py-3 whitespace-nowrap", children: p.lastSystolic && p.lastDiastolic ? (_jsxs("div", { className: "flex flex-col items-start gap-1", children: [_jsxs("span", { className: "tabular font-mono font-medium", children: [p.lastSystolic, "/", p.lastDiastolic] }), _jsx(InsigniaCategoria, { config: p.lastBpClassification })] })) : p.lastVisitDate ? (_jsx(InsigniaCategoria, { config: p.lastBpClassification })) : (_jsx("span", { className: "text-tenue", children: "\u2014" })) }), _jsxs("td", { className: "px-5 py-3 whitespace-nowrap", children: [fecha(p.lastVisitDate), a && (a.clave === 'visto' || a.clave === 'sin-venir') && (_jsx("span", { className: "block text-xs", style: { color: a.color }, children: a.clave === 'sin-venir' ? 'No asiste desde entonces' : a.texto }))] }), _jsx("td", { className: "px-5 py-3 whitespace-nowrap text-tenue", children: p.lastDoctorNombre ?? '—' })] }, p.id));
                                    }) }) }), _jsx(Paginacion, { pagina: filtro.page, ultima: consulta.data.meta.lastPage, total: consulta.data.meta.total, alCambiar: (p) => cambiar({ pagina: p }), porPagina: filtro.limit, alCambiarPorPagina: (n) => {
                                    recordarPorPagina('pacientes', n);
                                    cambiar({ por: n });
                                } })] }))] })] }));
}
