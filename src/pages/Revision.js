import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, GitMerge, RotateCcw, Search, ShieldCheck, Split, Trash2, UserPen } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useCasosRevision, useComunidades, usePaciente, usePacientes, useRevisionPaciente } from '../api/consultas';
import { corregirPaciente, decidirCaso, reabrirCaso, separarPaciente, unirPacientes } from '../api/recursos';
import { useSesion } from '../auth/sesion';
import { useConfirmar } from '../components/confirmar';
import { useEliminarVisita } from '../components/eliminarVisita';
import { Boton, Campo, Cargando, EncabezadoPagina, Entrada, ErrorCarga, Insignia, InsigniaCategoria, Selector, Tabla, Tarjeta, Vacio } from '../components/ui';
import { GENEROS, opciones } from '../lib/etiquetas';
import { cn, edad, edadTexto, fecha, fechaDia, nombreCompleto, soloFecha } from '../lib/formato';
import { SelectorFecha, ymd } from '../components/SelectorFecha';
const TIPOS = [
    { tipo: 'COMPARTIDO', texto: 'Código compartido', ayuda: 'Un mismo código con visitas a nombre de personas distintas. Separa las visitas de la otra persona en una ficha nueva.' },
    { tipo: 'DUPLICADO', texto: 'Posibles duplicados', ayuda: 'Dos fichas que parecen la misma persona (nombre parecido, misma edad y sexo, nunca vinieron el mismo día). Únelas en una.' },
    { tipo: 'VARIANTES', texto: 'Nombre escrito distinto', ayuda: 'La misma persona con el nombre (o el sexo) anotado de varias formas. Elige cómo debe quedar.' },
    { tipo: 'MISMO_DIA', texto: 'Visitas el mismo día', ayuda: 'Más de una visita del mismo paciente el mismo día. Suele ser una fila repetida: elimina la que sobra o márcalas como correctas.' },
    { tipo: 'SIN_EDAD', texto: 'Sin edad', ayuda: 'El Excel no tenía la edad y quedó 1960 por defecto. Escribe la edad o la fecha de nacimiento.' },
];
const COLORES = ['#2563eb', '#db2777', '#059669', '#d97706', '#7c3aed', '#0891b2'];
const POR_PAGINA = 30;
function useInvalidar() {
    const cliente = useQueryClient();
    return () => {
        for (const k of [['revision'], ['paciente'], ['pacientes'], ['visitas'], ['jornada'], ['stats'], ['auditoria']])
            cliente.invalidateQueries({ queryKey: k });
    };
}
/** Descarta un caso ("está bien así") con confirmación. */
function useDescartar(alTerminar) {
    const confirmar = useConfirmar();
    const invalidar = useInvalidar();
    const m = useMutation({
        mutationFn: decidirCaso,
        onSuccess: () => {
            invalidar();
            toast.success('Caso descartado. Puedes reabrirlo desde "Ver descartados".');
            alTerminar?.();
        },
        onError: (e) => toast.error(e.message),
    });
    return async (clave, titulo, mensaje) => {
        if (await confirmar({ titulo, mensaje, confirmar: 'Descartar', peligro: false }))
            m.mutate({ clave, estado: 'DESCARTADO' });
    };
}
/* ───────────── Lista: /revision ───────────── */
export function RevisionDatos() {
    const [params, setParams] = useSearchParams();
    const tipo = params.get('tipo') || 'COMPARTIDO';
    const descartados = params.get('ver') === 'descartados';
    const consulta = useCasosRevision({ tipo, descartados });
    const [mostrar, setMostrar] = useState(POR_PAGINA);
    const info = TIPOS.find((t) => t.tipo === tipo);
    const total = Object.values(consulta.data?.totales ?? {}).reduce((a, n) => a + (n ?? 0), 0);
    const cambiar = (cambios) => {
        setMostrar(POR_PAGINA);
        setParams((p) => {
            for (const [k, v] of Object.entries(cambios))
                (v ? p.set(k, v) : p.delete(k));
            return p;
        }, { replace: true });
    };
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: "Revisi\u00F3n de datos", descripcion: consulta.data ? `${total.toLocaleString('es-DO')} casos por revisar · ${consulta.data.decididos} ya resueltos o descartados. Todo cambio queda en Auditoría y se puede deshacer.` : 'Casos detectados en los datos, sobre todo los que dejó la importación del Excel.' }), _jsxs("div", { className: "mb-4 flex flex-wrap items-center gap-1.5", children: [TIPOS.map((t) => (_jsxs("button", { onClick: () => cambiar({ tipo: t.tipo }), className: cn('rounded-full border px-3 py-1.5 text-sm', tipo === t.tipo ? 'border-tinta bg-marca-500 font-medium' : 'border-borde bg-superficie text-tenue hover:text-tinta'), children: [t.texto, " ", _jsx("span", { className: "tabular ml-1 text-xs opacity-70", children: consulta.data?.totales[t.tipo] ?? 0 })] }, t.tipo))), _jsxs("label", { className: "ml-auto flex items-center gap-2 text-sm text-tenue", children: [_jsx("input", { type: "checkbox", className: "accent-tinta", checked: descartados, onChange: (e) => cambiar({ ver: e.target.checked ? 'descartados' : null }) }), " Ver resueltos y descartados"] })] }), _jsx("p", { className: "mb-4 text-sm text-tenue", children: info.ayuda }), _jsx(Tarjeta, { children: consulta.isPending ? (_jsx(Cargando, { texto: "Revisando los datos\u2026" })) : consulta.isError ? (_jsx(ErrorCarga, { error: consulta.error })) : !consulta.data.casos.length ? (_jsx(Vacio, { icono: _jsx(ShieldCheck, { className: "size-8" }), titulo: descartados ? 'Nada descartado aquí' : 'Sin casos pendientes', children: descartados ? undefined : 'No queda nada por revisar en este grupo.' })) : (_jsxs(_Fragment, { children: [_jsx("ul", { className: "divide-y divide-borde", children: consulta.data.casos.slice(0, mostrar).map((c) => (_jsx(FilaCaso, { caso: c }, c.clave))) }), consulta.data.casos.length > mostrar && (_jsx("div", { className: "border-t border-borde p-3 text-center", children: _jsxs(Boton, { variante: "fantasma", onClick: () => setMostrar((n) => n + POR_PAGINA), children: ["Ver m\u00E1s (", consulta.data.casos.length - mostrar, " restantes)"] }) }))] })) })] }));
}
function FichaCorta({ p }) {
    return (_jsxs(Link, { to: `/pacientes/${p.id}`, className: "group block min-w-0", children: [_jsx("span", { className: "font-medium group-hover:underline", children: p.nombre }), " ", _jsx("span", { className: "font-mono text-xs text-tenue", children: p.codigo }), _jsxs("span", { className: "block text-xs text-tenue", children: [p.batey, " \u00B7 ", GENEROS[p.sexo], " \u00B7 ", p.estimado ? `~${new Date(p.nacimiento).getUTCFullYear()}` : fechaDia(p.nacimiento), " \u00B7 ", p.visitas, " visitas"] })] }));
}
function FilaCaso({ caso: c }) {
    const navegar = useNavigate();
    const { tiene } = useSesion();
    const invalidar = useInvalidar();
    const descartar = useDescartar();
    const eliminar = useEliminarVisita(invalidar);
    const reabrir = useMutation({
        mutationFn: () => reabrirCaso(c.decision.id),
        onSuccess: () => {
            invalidar();
            toast.success('Caso reabierto');
        },
        onError: (e) => toast.error(e.message),
    });
    const p = c.pacientes[0];
    const caso = encodeURIComponent(c.clave);
    const accion = {
        COMPARTIDO: { texto: 'Separar', icono: _jsx(Split, { className: "size-4" }), a: `/revision/separar/${p.id}?caso=${caso}` },
        VARIANTES: { texto: 'Corregir', icono: _jsx(UserPen, { className: "size-4" }), a: `/revision/corregir/${p.id}?caso=${caso}` },
        SIN_EDAD: { texto: 'Poner edad', icono: _jsx(UserPen, { className: "size-4" }), a: `/revision/corregir/${p.id}?caso=${caso}` },
        DUPLICADO: { texto: 'Comparar', icono: _jsx(GitMerge, { className: "size-4" }), a: `/revision/unir?a=${p.id}&b=${c.pacientes[1]?.id}&caso=${caso}` },
        MISMO_DIA: null,
    }[c.tipo];
    return (_jsxs("li", { className: "flex flex-wrap items-start gap-x-6 gap-y-3 px-5 py-4", children: [_jsxs("div", { className: "grid min-w-64 flex-1 gap-3 sm:grid-cols-2", children: [c.pacientes.map((x) => (_jsx(FichaCorta, { p: x }, x.id))), _jsxs("div", { className: cn('text-sm', c.pacientes.length === 1 && 'sm:col-span-1', c.pacientes.length === 2 && 'sm:col-span-2'), children: [_jsx("p", { children: c.resumen }), !!c.motivos?.length && (_jsx("p", { className: "mt-1 flex flex-wrap gap-1", children: c.motivos.map((m) => (_jsx(Insignia, { children: m }, m))) })), c.tipo === 'MISMO_DIA' && c.visitas && (_jsx("ul", { className: "mt-2 space-y-1", children: c.visitas.map((v) => (_jsxs("li", { className: "flex items-center gap-3 text-xs", children: [_jsx("span", { className: "tabular w-16 font-mono text-[13px]", children: v.presion }), _jsx("span", { className: "w-16 text-tenue", children: v.peso ? `${v.peso} kg` : '—' }), _jsx("span", { className: "flex-1 text-tenue", children: v.atendio ?? '—' }), tiene('visitas.administrar') && !c.decision && (_jsx("button", { className: "rounded p-1 text-tenue hover:bg-red-50 hover:text-red-600", title: "Eliminar esta visita", onClick: () => eliminar({ id: v.id, visitDate: `${c.fecha}T16:00:00Z`, doctorNombre: v.atendio, importada: true, patient: { firstName: p.nombre, lastName: '' } }), children: _jsx(Trash2, { className: "size-3.5" }) }))] }, v.id))) }))] })] }), _jsx("div", { className: "flex shrink-0 flex-wrap items-center gap-2", children: c.decision ? (_jsxs(_Fragment, { children: [_jsxs("span", { className: "text-xs text-tenue", children: [c.decision.estado === 'RESUELTO' ? 'Resuelto' : 'Descartado', " por ", c.decision.userName ?? '—', " el ", fecha(c.decision.createdAt)] }), _jsx(Boton, { variante: "secundario", className: "h-8 text-xs", icono: _jsx(RotateCcw, { className: "size-3.5" }), cargando: reabrir.isPending, onClick: () => reabrir.mutate(), children: "Reabrir" })] })) : (_jsxs(_Fragment, { children: [_jsx(Boton, { variante: "fantasma", className: "h-8 text-xs", onClick: () => descartar(c.clave, c.tipo === 'MISMO_DIA' ? '¿Las visitas son correctas?' : 'Descartar el caso', c.tipo === 'DUPLICADO' ? 'Son dos personas distintas: no volverá a aparecer.' : c.tipo === 'MISMO_DIA' ? 'Se conservan todas y el caso no vuelve a aparecer.' : 'Está bien así: el caso no volverá a aparecer.'), children: c.tipo === 'MISMO_DIA' ? 'Son correctas' : c.tipo === 'DUPLICADO' ? 'Son distintas' : 'Descartar' }), accion && (_jsx(Boton, { className: "h-8 text-xs", icono: accion.icono, onClick: () => navegar(accion.a), children: accion.texto }))] })) })] }));
}
function CamposNacimiento({ valor, alCambiar }) {
    const anios = valor.fecha ? edad(`${valor.fecha}T00:00:00Z`) : '';
    return (_jsxs(_Fragment, { children: [_jsx(Campo, { etiqueta: "Edad", ayuda: valor.estimada ? 'Fecha calculada: 1 de enero' : 'Años cumplidos', children: _jsx(Entrada, { type: "number", min: 0, max: 120, value: anios, onChange: (e) => {
                        const n = e.target.value;
                        if (/^\d{1,3}$/.test(n))
                            alCambiar({ fecha: `${new Date().getFullYear() - Number(n)}-01-01`, estimada: true });
                        else if (!n)
                            alCambiar({ fecha: '', estimada: true });
                    } }) }), _jsx(Campo, { etiqueta: "Fecha de nacimiento", ayuda: valor.estimada ? 'Aproximada' : undefined, children: _jsx(SelectorFecha, { corto: true, empezarPorAnio: true, max: ymd(new Date()), value: valor.fecha, onChange: (v) => alCambiar({ fecha: v, estimada: false }) }) })] }));
}
/** Lo más repetido de una lista. */
const moda = (xs) => {
    const c = new Map();
    for (const x of xs)
        c.set(x, (c.get(x) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
};
const presionDe = (v) => `${v.systolicManual ?? v.systolicAuto ?? '—'}/${v.diastolicManual ?? v.diastolicAuto ?? '—'}`;
function EncabezadoPaciente({ p, titulo }) {
    return (_jsx(EncabezadoPagina, { titulo: titulo, descripcion: _jsxs(_Fragment, { children: [_jsx(Link, { to: `/pacientes/${p.id}`, className: "font-medium text-tinta hover:underline", children: nombreCompleto(p) }), ' ', "\u00B7 ", _jsx("span", { className: "font-mono", children: p.patientCode }), " \u00B7 ", p.community.name, " \u00B7 ", GENEROS[p.gender], " \u00B7 ", edadTexto(p)] }), volver: { a: '/revision', texto: 'Revisión de datos' } }));
}
/* ───────────── Separar: /revision/separar/:id ───────────── */
export function SepararPaciente() {
    const id = Number(useParams().id);
    const consulta = useRevisionPaciente(id);
    const comunidades = useComunidades();
    if (consulta.isPending || comunidades.isPending)
        return _jsx(Cargando, {});
    if (consulta.isError)
        return _jsx(ErrorCarga, { error: consulta.error });
    return _jsx(Separar, { datos: consulta.data });
}
function Separar({ datos }) {
    const { paciente: p, grupos, visitas } = datos;
    const [params] = useSearchParams();
    const caso = params.get('caso');
    const navegar = useNavigate();
    const invalidar = useInvalidar();
    const comunidades = useComunidades();
    const descartar = useDescartar(() => navegar('/revision?tipo=COMPARTIDO'));
    const [elegidas, setElegidas] = useState(new Set());
    const [form, setForm] = useState({ firstName: '', lastName: '', gender: 'FEMALE', communityId: String(p.communityId), address: '' });
    const [nacimiento, setNacimiento] = useState({ fecha: '', estimada: true });
    /** Elige las visitas de un grupo y llena la ficha nueva con lo que dicen sus filas. */
    const elegirGrupo = (i) => {
        const g = grupos[i];
        setElegidas(new Set(g.ids));
        const filas = visitas.filter((v) => g.ids.includes(v.id) && v.origen).map((v) => v.origen);
        setForm((f) => ({
            ...f,
            firstName: moda(filas.map((o) => o.nombre ?? '').filter(Boolean)) ?? '',
            lastName: moda(filas.map((o) => o.apellido ?? '').filter(Boolean)) ?? '',
            gender: g.sexo ?? f.gender,
            address: moda(filas.map((o) => o.casa ?? '').filter(Boolean)) ?? '',
        }));
        if (g.nacimiento)
            setNacimiento({ fecha: `${Math.round((g.nacimiento[0] + g.nacimiento[1]) / 2)}-01-01`, estimada: true });
    };
    const separar = useMutation({
        mutationFn: () => separarPaciente(p.id, {
            visitIds: [...elegidas],
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            gender: form.gender,
            birthDate: new Date(`${nacimiento.fecha}T00:00:00Z`).toISOString(),
            birthDateIsEstimated: nacimiento.estimada,
            communityId: Number(form.communityId),
            address: form.address.trim() || undefined,
        }),
        onSuccess: (r) => {
            invalidar();
            toast.success(`Ficha nueva ${r.nuevo.codigo} · ${r.nuevo.nombre} con ${elegidas.size} visitas`, {
                action: { label: 'Ver ficha', onClick: () => navegar(`/pacientes/${r.nuevo.id}`) },
            });
            setElegidas(new Set());
            // Si ya no quedan dos personas mezcladas, el caso se cierra solo.
            if (grupos.length <= 2)
                navegar('/revision?tipo=COMPARTIDO');
        },
        onError: (e) => toast.error(e.message),
    });
    const listo = elegidas.size > 0 && elegidas.size < visitas.length && form.firstName.trim() && nacimiento.fecha;
    const actual = normal(`${p.firstName} ${p.lastName}`);
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPaciente, { p: p, titulo: "Separar visitas de otra persona" }), _jsxs("div", { className: "grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]", children: [_jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "grid gap-3 sm:grid-cols-2 xl:grid-cols-3", children: grupos.map((g, i) => {
                                    const esLaFicha = normal(g.nombre) === actual || g.variantes.some((v) => normal(v.nombre) === actual);
                                    return (_jsxs("div", { className: "rounded-xl border border-borde bg-superficie p-4", style: { borderLeft: `4px solid ${COLORES[i % COLORES.length]}` }, children: [_jsx("p", { className: "font-medium", children: g.nombre }), _jsxs("p", { className: "mt-1 text-xs text-tenue", children: [g.visitas, " visitas \u00B7 ", g.sexo ? GENEROS[g.sexo] : 'sexo sin dato', " \u00B7 ", g.nacimiento ? `nacido hacia ${g.nacimiento[0] === g.nacimiento[1] ? g.nacimiento[0] : `${g.nacimiento[0]}–${g.nacimiento[1]}`}` : 'sin edad', _jsx("br", {}), fecha(g.desde), " \u2192 ", fecha(g.hasta)] }), g.variantes.length > 1 && _jsxs("p", { className: "mt-1 text-xs text-tenue", children: ["Tambi\u00E9n: ", g.variantes.slice(1).map((v) => v.nombre).join(', ')] }), esLaFicha ? (_jsx("p", { className: "mt-3 text-xs font-medium text-green-700", children: "Es el nombre de esta ficha: se queda aqu\u00ED" })) : (_jsx(Boton, { variante: "secundario", className: "mt-3 h-8 text-xs", onClick: () => elegirGrupo(i), children: "Pasar a ficha nueva" }))] }, i));
                                }) }), _jsx(Tarjeta, { titulo: "Visitas", accion: _jsx("span", { className: "text-xs text-tenue", children: "Marca las que son de la otra persona" }), children: _jsx(Tabla, { columnas: ['', 'Fecha', 'Nombre anotado', 'Sexo', 'Edad', 'Casa', 'PA', 'Atendió', 'Medicamentos'], children: visitas.map((v) => {
                                        const marcada = elegidas.has(v.id);
                                        return (_jsxs("tr", { onClick: () => setElegidas((s) => (s.has(v.id) ? new Set([...s].filter((x) => x !== v.id)) : new Set([...s, v.id]))), className: cn('cursor-pointer hover:bg-fondo', marcada && 'bg-marca-50'), children: [_jsx("td", { className: "px-5 py-2.5", children: _jsxs("span", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", readOnly: true, checked: marcada, className: "accent-tinta" }), _jsx("span", { className: "size-2.5 rounded-full", style: { backgroundColor: v.grupo >= 0 ? COLORES[v.grupo % COLORES.length] : '#d6d3d1' } })] }) }), _jsx("td", { className: "px-5 py-2.5 whitespace-nowrap", children: fecha(v.visitDate) }), _jsx("td", { className: "px-5 py-2.5 whitespace-nowrap", children: v.origen ? `${v.origen.nombre ?? ''} ${v.origen.apellido ?? ''}` : _jsx("span", { className: "text-tenue", children: "(registrada en la app)" }) }), _jsx("td", { className: "px-5 py-2.5", children: v.origen?.sexo ? GENEROS[v.origen.sexo][0] : '—' }), _jsx("td", { className: "px-5 py-2.5 whitespace-nowrap", children: v.origen?.edad ?? '—' }), _jsx("td", { className: "px-5 py-2.5", children: v.origen?.casa ?? '—' }), _jsxs("td", { className: "px-5 py-2.5 whitespace-nowrap", children: [_jsx("span", { className: "tabular mr-1.5 font-mono", children: presionDe(v) }), v.bpClassification && _jsx(InsigniaCategoria, { config: v.bpClassification })] }), _jsx("td", { className: "px-5 py-2.5 whitespace-nowrap text-tenue", children: v.doctorNombre ?? '—' }), _jsx("td", { className: "px-5 py-2.5 text-xs text-tenue", children: v.prescriptions.map((r) => `${r.medication.name} ${r.medication.concentration}`).join(', ') || '—' })] }, v.id));
                                    }) }) })] }), _jsx("aside", { className: "space-y-4 lg:sticky lg:top-6 lg:self-start", children: _jsxs(Tarjeta, { titulo: "Ficha nueva", children: [_jsxs("div", { className: "grid grid-cols-2 gap-4 p-5", children: [_jsx(Campo, { etiqueta: "Nombre", children: _jsx(Entrada, { value: form.firstName, onChange: (e) => setForm({ ...form, firstName: e.target.value }) }) }), _jsx(Campo, { etiqueta: "Apellido", children: _jsx(Entrada, { value: form.lastName, onChange: (e) => setForm({ ...form, lastName: e.target.value }) }) }), _jsx(Campo, { etiqueta: "Sexo", children: _jsx(Selector, { opciones: opciones(GENEROS), value: form.gender, onChange: (e) => setForm({ ...form, gender: e.target.value }) }) }), _jsx(Campo, { etiqueta: "Casa", children: _jsx(Entrada, { value: form.address, onChange: (e) => setForm({ ...form, address: e.target.value }) }) }), _jsx(CamposNacimiento, { valor: nacimiento, alCambiar: setNacimiento }), _jsx(Campo, { etiqueta: "Batey", className: "col-span-2", ayuda: "Recibe el siguiente c\u00F3digo libre de este batey.", children: _jsx(Selector, { opciones: (comunidades.data ?? []).filter((c) => c.isActive || c.id === p.communityId).map((c) => ({ value: c.id, label: c.name })), value: form.communityId, onChange: (e) => setForm({ ...form, communityId: e.target.value }) }) })] }), _jsxs("div", { className: "space-y-2 border-t border-borde p-5", children: [_jsxs(Boton, { className: "w-full", icono: _jsx(Split, { className: "size-4" }), disabled: !listo, cargando: separar.isPending, onClick: () => separar.mutate(), children: ["Separar ", elegidas.size || '', " ", elegidas.size === 1 ? 'visita' : 'visitas'] }), elegidas.size === visitas.length && _jsxs("p", { className: "text-xs text-red-600", children: ["Deja al menos una visita en ", p.patientCode, "."] }), caso && (_jsx(Boton, { variante: "fantasma", className: "w-full text-xs", onClick: () => descartar(caso, 'Es la misma persona', 'Todas las visitas son de la misma persona: el caso no volverá a aparecer.'), children: "Todas son de la misma persona" }))] })] }) })] })] }));
}
const normal = (s) => s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
/* ───────────── Corregir nombre, sexo o edad: /revision/corregir/:id ───────────── */
export function CorregirPaciente() {
    const id = Number(useParams().id);
    const consulta = useRevisionPaciente(id);
    if (consulta.isPending)
        return _jsx(Cargando, {});
    if (consulta.isError)
        return _jsx(ErrorCarga, { error: consulta.error });
    return _jsx(Corregir, { datos: consulta.data });
}
function Corregir({ datos }) {
    const { paciente: p, visitas } = datos;
    const [params] = useSearchParams();
    const clave = params.get('caso') ?? `VARIANTES:${p.id}`;
    const navegar = useNavigate();
    const invalidar = useInvalidar();
    const descartar = useDescartar(() => navegar(`/revision?tipo=${clave.split(':')[0]}`));
    const [form, setForm] = useState({ firstName: p.firstName, lastName: p.lastName, gender: p.gender });
    const [nacimiento, setNacimiento] = useState({ fecha: soloFecha(p.birthDate), estimada: p.birthDateIsEstimated });
    // Formas en que se anotó, con cuántas visitas cada una
    const { formas, sexos, edades } = useMemo(() => {
        const formas = new Map();
        const sexos = new Map();
        const edades = new Map();
        for (const v of visitas) {
            if (!v.origen)
                continue;
            const k = `${v.origen.nombre ?? ''}|${v.origen.apellido ?? ''}`;
            formas.set(k, { nombre: v.origen.nombre ?? '', apellido: v.origen.apellido ?? '', n: (formas.get(k)?.n ?? 0) + 1 });
            if (v.origen.sexo)
                sexos.set(v.origen.sexo, (sexos.get(v.origen.sexo) ?? 0) + 1);
            if (v.origen.edad)
                edades.set(v.origen.edad, (edades.get(v.origen.edad) ?? 0) + 1);
        }
        return { formas: [...formas.values()].sort((a, b) => b.n - a.n), sexos: [...sexos.entries()], edades: [...edades.entries()].sort((a, b) => b[1] - a[1]) };
    }, [visitas]);
    const guardar = useMutation({
        mutationFn: () => {
            const nacio = nacimiento.fecha ? new Date(`${nacimiento.fecha}T00:00:00Z`).toISOString() : undefined;
            return corregirPaciente(p.id, {
                clave,
                ...(form.firstName.trim() !== p.firstName && { firstName: form.firstName.trim() }),
                ...(form.lastName.trim() !== p.lastName && { lastName: form.lastName.trim() }),
                ...(form.gender !== p.gender && { gender: form.gender }),
                ...(nacio && soloFecha(nacio) !== soloFecha(p.birthDate) && { birthDate: nacio, birthDateIsEstimated: nacimiento.estimada }),
            });
        },
        onSuccess: () => {
            invalidar();
            toast.success('Ficha corregida. El cambio quedó en Auditoría.');
            navegar(`/revision?tipo=${clave.split(':')[0]}`);
        },
        onError: (e) => toast.error(e.message === 'No hay nada que corregir' ? 'No cambiaste nada. Si está bien así, usa "Está bien así".' : e.message),
    });
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPaciente, { p: p, titulo: "Corregir datos del paciente" }), _jsxs("div", { className: "grid max-w-5xl gap-4 lg:grid-cols-2", children: [_jsxs("div", { className: "space-y-4", children: [formas.length > 0 && (_jsx(Tarjeta, { titulo: "C\u00F3mo se anot\u00F3 el nombre", accion: _jsx("span", { className: "text-xs text-tenue", children: "Toca una para usarla" }), children: _jsx("ul", { className: "divide-y divide-borde", children: formas.map((f) => {
                                        const igual = f.nombre === form.firstName && f.apellido === form.lastName;
                                        return (_jsx("li", { children: _jsxs("button", { onClick: () => setForm({ ...form, firstName: f.nombre, lastName: f.apellido }), className: cn('flex w-full items-center justify-between px-5 py-2.5 text-left text-sm hover:bg-fondo', igual && 'bg-marca-50 font-medium'), children: [_jsxs("span", { children: [f.nombre, " ", _jsx("span", { className: "text-tenue", children: f.apellido })] }), _jsxs("span", { className: "tabular flex items-center gap-2 text-xs text-tenue", children: [f.n, " ", f.n === 1 ? 'visita' : 'visitas', " ", igual && _jsx(Check, { className: "size-4 text-green-700" })] })] }) }, `${f.nombre}|${f.apellido}`));
                                    }) }) })), (sexos.length > 0 || edades.length > 0) && (_jsx(Tarjeta, { titulo: "Otros datos anotados", children: _jsxs("dl", { className: "space-y-3 p-5 text-sm", children: [sexos.length > 0 && (_jsxs("div", { children: [_jsx("dt", { className: "text-xs text-tenue", children: "Sexo" }), _jsx("dd", { children: sexos.map(([s, n]) => `${GENEROS[s]} (${n})`).join(' · ') })] })), _jsxs("div", { children: [_jsx("dt", { className: "text-xs text-tenue", children: "Edad" }), _jsx("dd", { children: edades.length ? edades.slice(0, 8).map(([e, n]) => `${e} (${n})`).join(' · ') : 'Nunca se anotó' })] })] }) }))] }), _jsxs(Tarjeta, { titulo: "C\u00F3mo debe quedar", children: [_jsxs("div", { className: "grid grid-cols-2 gap-4 p-5", children: [_jsx(Campo, { etiqueta: "Nombre", children: _jsx(Entrada, { value: form.firstName, onChange: (e) => setForm({ ...form, firstName: e.target.value }) }) }), _jsx(Campo, { etiqueta: "Apellido", children: _jsx(Entrada, { value: form.lastName, onChange: (e) => setForm({ ...form, lastName: e.target.value }) }) }), _jsx(Campo, { etiqueta: "Sexo", className: "col-span-2", children: _jsx(Selector, { opciones: opciones(GENEROS), value: form.gender, onChange: (e) => setForm({ ...form, gender: e.target.value }) }) }), _jsx(CamposNacimiento, { valor: nacimiento, alCambiar: setNacimiento })] }), _jsxs("div", { className: "flex flex-wrap justify-end gap-2 border-t border-borde p-5", children: [_jsx(Boton, { variante: "fantasma", onClick: () => descartar(clave, 'Está bien así', 'Los datos de la ficha se quedan como están y el caso no vuelve a aparecer.'), children: "Est\u00E1 bien as\u00ED" }), _jsx(Boton, { cargando: guardar.isPending, disabled: !form.firstName.trim(), onClick: () => guardar.mutate(), children: "Guardar correcci\u00F3n" })] })] })] })] }));
}
/* ───────────── Unir: /revision/unir?a=&b= ───────────── */
export function UnirPacientes() {
    const [params, setParams] = useSearchParams();
    const a = Number(params.get('a')) || undefined;
    const b = Number(params.get('b')) || undefined;
    const pa = usePaciente(a);
    const pb = usePaciente(b);
    if (!a)
        return _jsx(Vacio, { titulo: "Falta el paciente", children: "Abre esta pantalla desde la ficha de un paciente o desde Revisi\u00F3n de datos." });
    if (pa.isPending || (b && pb.isPending))
        return _jsx(Cargando, {});
    if (!pa.data)
        return _jsx(Vacio, { titulo: "Paciente no encontrado" });
    if (!b || !pb.data)
        return _jsx(ElegirOtro, { a: pa.data, alElegir: (id) => setParams((p) => (p.set('b', String(id)), p), { replace: true }) });
    return _jsx(Unir, { a: pa.data, b: pb.data, caso: params.get('caso') });
}
function ElegirOtro({ a, alElegir }) {
    const [busqueda, setBusqueda] = useState(a.lastName || a.firstName);
    const lista = usePacientes({ page: 1, limit: 10, search: busqueda.trim() || undefined });
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: `Unir a ${nombreCompleto(a)} con…`, descripcion: "Busca la otra ficha de la misma persona.", volver: { a: `/pacientes/${a.id}`, texto: nombreCompleto(a) } }), _jsxs(Tarjeta, { className: "max-w-3xl", children: [_jsxs("div", { className: "relative border-b border-borde p-4", children: [_jsx(Search, { className: "absolute top-1/2 left-7 size-4 -translate-y-1/2 text-tenue" }), _jsx(Entrada, { autoFocus: true, className: "pl-9", placeholder: "Nombre o c\u00F3digo", value: busqueda, onChange: (e) => setBusqueda(e.target.value) })] }), lista.isPending ? (_jsx(Cargando, {})) : (_jsx("ul", { className: "divide-y divide-borde", children: (lista.data?.data ?? [])
                            .filter((x) => x.id !== a.id)
                            .map((x) => (_jsx("li", { children: _jsxs("button", { onClick: () => alElegir(x.id), className: "flex w-full items-center gap-4 px-5 py-3 text-left hover:bg-fondo", children: [_jsx("span", { className: "w-20 font-mono text-xs text-tenue", children: x.patientCode }), _jsx("span", { className: "flex-1 font-medium", children: nombreCompleto(x) }), _jsxs("span", { className: "text-xs text-tenue", children: [x.community?.name, " \u00B7 ", edadTexto(x), " \u00B7 ", GENEROS[x.gender]] }), _jsx(ArrowRight, { className: "size-4 text-tenue" })] }) }, x.id))) }))] })] }));
}
function Unir({ a, b, caso }) {
    const navegar = useNavigate();
    const confirmar = useConfirmar();
    const invalidar = useInvalidar();
    const descartar = useDescartar(() => navegar('/revision?tipo=DUPLICADO'));
    const va = a.clinicalVisits ?? [];
    const vb = b.clinicalVisits ?? [];
    // Por defecto se conserva la ficha con más visitas (o la más antigua).
    const [conservar, setConservar] = useState(vb.length > va.length ? b.id : a.id);
    const [keep, drop] = conservar === a.id ? [a, b] : [b, a];
    const unir = useMutation({
        mutationFn: () => unirPacientes(keep.id, drop.id),
        onSuccess: () => {
            invalidar();
            toast.success(`${drop.patientCode} se unió a ${keep.patientCode}. Se puede deshacer desde Auditoría.`);
            navegar(`/pacientes/${keep.id}`, { replace: true });
        },
        onError: (e) => toast.error(e.message),
    });
    const pedir = async () => {
        const ok = await confirmar({
            titulo: `¿Unir ${drop.patientCode} dentro de ${keep.patientCode}?`,
            mensaje: `Las ${(drop === a ? va : vb).length} visitas de ${drop.patientCode} pasan a ${keep.patientCode} y la ficha ${drop.patientCode} se elimina. Teléfono y casa se copian si ${keep.patientCode} no los tiene. Se puede deshacer desde Auditoría.`,
            confirmar: 'Unir fichas',
            peligro: false,
        });
        if (ok)
            unir.mutate();
    };
    const filas = [
        ['Código', (p) => p.patientCode],
        ['Nombre', (p) => nombreCompleto(p)],
        ['Batey', (p) => p.community?.name ?? '—'],
        ['Sexo', (p) => GENEROS[p.gender]],
        ['Edad', (p) => edadTexto(p)],
        ['Casa', (p) => p.address ?? '—'],
        ['Teléfono', (p) => p.phoneNumber ?? '—'],
        ['Visitas', (_, v) => String(v.length)],
        ['Primera visita', (_, v) => fecha(v[v.length - 1]?.visitDate)],
        ['Última visita', (_, v) => fecha(v[0]?.visitDate)],
        ['Última PA', (p) => (p.lastSystolic ? `${p.lastSystolic}/${p.lastDiastolic}` : '—')],
        ['Último que atendió', (p) => p.lastDoctorNombre ?? '—'],
    ];
    // Si los dos tienen visitas el mismo día, casi seguro son dos personas.
    const diasA = new Set(va.map((v) => soloFecha(v.visitDate)));
    const coinciden = vb.filter((v) => diasA.has(soloFecha(v.visitDate))).length;
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: "\u00BFEs la misma persona?", descripcion: "Compara las dos fichas. Si son la misma persona, elige cu\u00E1l se conserva.", volver: { a: '/revision?tipo=DUPLICADO', texto: 'Revisión de datos' } }), coinciden > 0 && (_jsxs("p", { className: "mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700", children: ["Ojo: las dos fichas tienen visitas el mismo d\u00EDa (", coinciden, "). Lo m\u00E1s probable es que sean dos personas."] })), _jsxs(Tarjeta, { className: "max-w-4xl", children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-borde", children: [_jsx("th", { className: "w-40 px-5 py-3" }), [a, b].map((p) => (_jsx("th", { className: "px-5 py-3 text-left", children: _jsxs("label", { className: cn('flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2', conservar === p.id ? 'border-tinta bg-marca-50' : 'border-borde'), children: [_jsx("input", { type: "radio", className: "accent-tinta", checked: conservar === p.id, onChange: () => setConservar(p.id) }), _jsx("span", { className: "font-medium", children: conservar === p.id ? 'Se conserva' : 'Se une y desaparece' })] }) }, p.id)))] }) }), _jsx("tbody", { children: filas.map(([t, f]) => {
                                        const x = f(a, va);
                                        const y = f(b, vb);
                                        return (_jsxs("tr", { className: "border-b border-borde last:border-0", children: [_jsx("td", { className: "px-5 py-2.5 text-xs text-tenue", children: t }), _jsx("td", { className: cn('px-5 py-2.5', x !== y && 'font-medium'), children: t === 'Código' ? _jsx(Link, { to: `/pacientes/${a.id}`, className: "font-mono hover:underline", children: x }) : x }), _jsx("td", { className: cn('px-5 py-2.5', x !== y && 'font-medium'), children: t === 'Código' ? _jsx(Link, { to: `/pacientes/${b.id}`, className: "font-mono hover:underline", children: y }) : y })] }, t));
                                    }) })] }) }), _jsxs("div", { className: "flex flex-wrap items-center justify-end gap-2 border-t border-borde p-5", children: [caso && (_jsx(Boton, { variante: "fantasma", onClick: () => descartar(caso, 'Son dos personas distintas', 'El par no volverá a aparecer como posible duplicado.'), children: "Son personas distintas" })), _jsxs(Boton, { icono: _jsx(GitMerge, { className: "size-4" }), cargando: unir.isPending, onClick: pedir, children: ["Unir en ", keep.patientCode] })] })] })] }));
}
