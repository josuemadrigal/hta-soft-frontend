import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useConfiguracion } from '../api/consultas';
import { guardarConfiguracion } from '../api/recursos';
import { Boton, Campo, Cargando, EncabezadoPagina, Entrada, Segmentos, Tarjeta } from '../components/ui';
import { cn } from '../lib/formato';
import { tiempoSinVenir, VISITAS_SIN_VENIR_REGULAR } from '../lib/regulares';
const PLAZOS = [
    { horas: 0, texto: 'No pueden' },
    { horas: 24, texto: '24 horas' },
    { horas: 48, texto: '48 horas' },
    { horas: 72, texto: '3 días' },
    { horas: 168, texto: '1 semana' },
];
export function Configuracion() {
    const consulta = useConfiguracion();
    const cliente = useQueryClient();
    const [horas, setHoras] = useState('');
    useEffect(() => {
        if (consulta.data)
            setHoras(consulta.data.visitasHorasEdicion);
    }, [consulta.data]);
    const guardar = useMutation({
        mutationFn: () => guardarConfiguracion({ visitasHorasEdicion: Number(horas) }),
        onSuccess: () => {
            cliente.invalidateQueries({ queryKey: ['configuracion'] });
            toast.success('Configuración guardada. El cambio quedó en Auditoría.');
        },
        onError: (e) => toast.error(e.message),
    });
    if (consulta.isPending)
        return _jsx(Cargando, {});
    const cambio = horas !== '' && horas !== consulta.data?.visitasHorasEdicion;
    const valido = horas !== '' && Number.isInteger(Number(horas)) && Number(horas) >= 0 && Number(horas) <= 720;
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: "Configuraci\u00F3n general", descripcion: "Ajustes que aplican a todo el sistema." }), _jsx(Tarjeta, { titulo: "Correcci\u00F3n de visitas", className: "max-w-2xl", children: _jsxs("div", { className: "space-y-4 p-5", children: [_jsx("p", { className: "text-sm text-tenue", children: "Cu\u00E1nto tiempo, desde que registra una visita, tiene un m\u00E9dico para corregirla \u00E9l mismo. Despu\u00E9s solo puede hacerlo un usuario con el permiso \u201CEditar cualquier visita sin plazo\u201D (el administrador), que adem\u00E1s puede eliminarlas. Toda correcci\u00F3n queda en Auditor\u00EDa." }), _jsx("div", { className: "flex flex-wrap gap-1.5", children: PLAZOS.map((p) => (_jsx("button", { type: "button", onClick: () => setHoras(p.horas), className: cn('rounded-full border px-3 py-1 text-sm', horas === p.horas ? 'border-tinta bg-marca-500 font-medium' : 'border-borde text-tenue hover:text-tinta'), children: p.texto }, p.horas))) }), _jsx(Campo, { etiqueta: "Horas", error: !valido && horas !== '' ? 'Entre 0 y 720 horas (30 días)' : undefined, className: "max-w-48", children: _jsx(Entrada, { type: "number", min: 0, max: 720, value: horas, onChange: (e) => setHoras(e.target.value === '' ? '' : Number(e.target.value)) }) }), _jsx(Boton, { icono: _jsx(Save, { className: "size-4" }), disabled: !cambio || !valido, cargando: guardar.isPending, onClick: () => guardar.mutate(), children: "Guardar" })] }) }), _jsx(AjustesAlertas, {}), _jsx(AjusteRegulares, {}), _jsx(AjusteEsperados, {}), _jsx(AjustesEntregas, {}), _jsx(AjusteAvisoInventario, {}), _jsx(AjusteSesion, {})] }));
}
const CAMPOS_ALERTAS = [
    { k: 'alertaSubidaSistolica', etiqueta: 'Subida de sistólica', ayuda: 'mmHg más que la última visita', min: 5, max: 80 },
    { k: 'alertaSubidaDiastolica', etiqueta: 'Subida de diastólica', ayuda: 'mmHg más que la última visita', min: 5, max: 50 },
    { k: 'alertaVisitasSinControl', etiqueta: 'Visitas seguidas sin control', ayuda: 'En ≥140/90 estando en tratamiento', min: 2, max: 8 },
    { k: 'alertaCumplimientoMinimo', etiqueta: 'Cumplimiento mínimo (%)', ayuda: 'Por debajo se considera bajo', min: 10, max: 100 },
    { k: 'alertaVisitasCumplimiento', etiqueta: 'Visitas seguidas con cumplimiento bajo', ayuda: 'Para avisar', min: 1, max: 6 },
];
/** Umbrales de las alertas clínicas que ve el médico al registrar la visita. */
function AjustesAlertas() {
    const consulta = useConfiguracion();
    const cliente = useQueryClient();
    const [valores, setValores] = useState({});
    useEffect(() => {
        if (consulta.data)
            setValores(Object.fromEntries(CAMPOS_ALERTAS.map((c) => [c.k, consulta.data[c.k]])));
    }, [consulta.data]);
    const guardar = useMutation({
        mutationFn: () => guardarConfiguracion(Object.fromEntries(CAMPOS_ALERTAS.map((c) => [c.k, Number(valores[c.k])]))),
        onSuccess: () => {
            cliente.invalidateQueries({ queryKey: ['configuracion'] });
            toast.success('Umbrales guardados. El cambio quedó en Auditoría.');
        },
        onError: (e) => toast.error(e.message),
    });
    if (!consulta.data)
        return null;
    const invalido = (c) => {
        const v = valores[c.k];
        return v === '' || v === undefined || !Number.isInteger(Number(v)) || Number(v) < c.min || Number(v) > c.max;
    };
    const cambio = CAMPOS_ALERTAS.some((c) => valores[c.k] !== consulta.data[c.k]);
    const valido = CAMPOS_ALERTAS.every((c) => !invalido(c));
    return (_jsx(Tarjeta, { titulo: "Alertas cl\u00EDnicas", className: "mt-4 max-w-2xl", children: _jsxs("div", { className: "space-y-4 p-5", children: [_jsx("p", { className: "text-sm text-tenue", children: "Al registrar una visita (y en la ficha del paciente) se avisa de crisis hipertensiva, presi\u00F3n baja, subidas bruscas, visitas seguidas sin control, cumplimiento bajo, pulso, saturaci\u00F3n, fiebre y peso. Estos son los l\u00EDmites que se pueden ajustar." }), _jsx("div", { className: "grid gap-4 sm:grid-cols-2", children: CAMPOS_ALERTAS.map((c) => (_jsx(Campo, { etiqueta: c.etiqueta, ayuda: c.ayuda, error: invalido(c) ? `Entre ${c.min} y ${c.max}` : undefined, children: _jsx(Entrada, { type: "number", min: c.min, max: c.max, value: valores[c.k] ?? '', onChange: (e) => setValores({ ...valores, [c.k]: e.target.value === '' ? '' : Number(e.target.value) }) }) }, c.k))) }), _jsx(Boton, { icono: _jsx(Save, { className: "size-4" }), disabled: !cambio || !valido, cargando: guardar.isPending, onClick: () => guardar.mutate(), children: "Guardar" })] }) }));
}
/** Cómo se entregan los medicamentos y cuándo se permite reponer sin consulta. */
function AjustesEntregas() {
    const consulta = useConfiguracion();
    const cliente = useQueryClient();
    const [inmediata, setInmediata] = useState(1);
    const [meses, setMeses] = useState('');
    useEffect(() => {
        if (consulta.data) {
            setInmediata(consulta.data.entregaInmediata);
            setMeses(consulta.data.reposicionMesesMaximo);
        }
    }, [consulta.data]);
    const guardar = useMutation({
        mutationFn: () => guardarConfiguracion({ entregaInmediata: inmediata, reposicionMesesMaximo: Number(meses) }),
        onSuccess: () => {
            cliente.invalidateQueries({ queryKey: ['configuracion'] });
            toast.success('Guardado. El cambio quedó en Auditoría.');
        },
        onError: (e) => toast.error(e.message),
    });
    if (!consulta.data)
        return null;
    const valido = meses !== '' && Number.isInteger(Number(meses)) && Number(meses) >= 1 && Number(meses) <= 24;
    const cambio = inmediata !== consulta.data.entregaInmediata || meses !== consulta.data.reposicionMesesMaximo;
    return (_jsx(Tarjeta, { titulo: "Entrega de medicamentos", className: "mt-4 max-w-2xl", children: _jsxs("div", { className: "space-y-4 p-5", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-[13px] font-medium text-tinta/80", children: "Al guardar una visita" }), [
                            { v: 1, t: 'Se entregan en el momento', d: 'Quien atiende entrega las pastillas. Es lo habitual cuando una sola persona hace todo.' },
                            { v: 0, t: 'Quedan para la mesa de farmacia', d: 'Otra persona las entrega desde Entregas y registra quién las recibió.' },
                        ].map((o) => (_jsxs("label", { className: cn('flex cursor-pointer gap-3 rounded-lg border px-4 py-3 text-sm', inmediata === o.v ? 'border-tinta bg-marca-50' : 'border-borde hover:bg-fondo'), children: [_jsx("input", { type: "radio", name: "entrega", className: "mt-0.5 accent-tinta", checked: inmediata === o.v, onChange: () => setInmediata(o.v) }), _jsxs("span", { children: [_jsx("span", { className: "font-medium", children: o.t }), _jsx("span", { className: "block text-tenue", children: o.d })] })] }, o.v))), _jsx("p", { className: "text-xs text-tenue", children: "Es solo lo que viene marcado: en cada visita se puede cambiar con \"Entregar los medicamentos ahora\"." })] }), _jsx(Campo, { etiqueta: "Reposici\u00F3n sin consulta: hasta cu\u00E1ntos meses desde la \u00FAltima visita", error: !valido && meses !== '' ? 'Entre 1 y 24 meses' : undefined, ayuda: "Pasado ese tiempo, el paciente necesita una consulta antes de recibir m\u00E1s medicamentos.", className: "max-w-96", children: _jsx(Entrada, { type: "number", min: 1, max: 24, value: meses, onChange: (e) => setMeses(e.target.value === '' ? '' : Number(e.target.value)) }) }), _jsx(Boton, { icono: _jsx(Save, { className: "size-4" }), disabled: !valido || !cambio, cargando: guardar.isPending, onClick: () => guardar.mutate(), children: "Guardar" })] }) }));
}
/** Minutos sin actividad tras los que se cierra la sesión. */
/** Esperados por jornada: la media alta de las últimas N jornadas (el promedio de las K con más pacientes). */
function AjusteEsperados() {
    const consulta = useConfiguracion();
    const cliente = useQueryClient();
    const [jornadas, setJornadas] = useState('');
    const [mejores, setMejores] = useState('');
    useEffect(() => {
        if (!consulta.data)
            return;
        setJornadas(consulta.data.jornadasParaEsperados ?? 6);
        setMejores(consulta.data.mejoresParaEsperados ?? 3);
    }, [consulta.data]);
    const guardar = useMutation({
        mutationFn: () => guardarConfiguracion({ jornadasParaEsperados: Number(jornadas), mejoresParaEsperados: Number(mejores) }),
        onSuccess: () => {
            for (const k of [['configuracion'], ['stats'], ['jornadas'], ['reportes']])
                cliente.invalidateQueries({ queryKey: k });
            toast.success('Guardado. El cambio quedó en Auditoría.');
        },
        onError: (e) => toast.error(e.message),
    });
    if (!consulta.data)
        return null;
    const n = Number(jornadas);
    const k = Number(mejores);
    const validoN = jornadas !== '' && Number.isInteger(n) && n >= 2 && n <= 20;
    const validoK = mejores !== '' && Number.isInteger(k) && k >= 1 && k <= n;
    const sinCambios = n === (consulta.data.jornadasParaEsperados ?? 6) && k === (consulta.data.mejoresParaEsperados ?? 3);
    return (_jsx(Tarjeta, { titulo: "Pacientes esperados por jornada", className: "mt-4 max-w-2xl", children: _jsxs("div", { className: "space-y-4 p-5", children: [_jsx("p", { className: "text-sm text-tenue", children: "Cu\u00E1ntos pacientes se esperan en cada jornada de un batey (en Registro en jornada, la ronda y el panel). Se miran sus \u00FAltimas jornadas y se promedian las que tuvieron m\u00E1s pacientes: as\u00ED un d\u00EDa flojo no baja lo esperado. Si las dos cifras son iguales, es el promedio simple." }), _jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsx(Campo, { etiqueta: "Jornadas recientes que se miran", error: !validoN && jornadas !== '' ? 'Entre 2 y 20' : undefined, children: _jsx(Entrada, { type: "number", min: 2, max: 20, value: jornadas, onChange: (e) => setJornadas(e.target.value === '' ? '' : Number(e.target.value)) }) }), _jsx(Campo, { etiqueta: "De esas, cu\u00E1ntas de las mejores se promedian", error: !validoK && mejores !== '' ? `Entre 1 y ${validoN ? n : 20}` : undefined, children: _jsx(Entrada, { type: "number", min: 1, max: validoN ? n : 20, value: mejores, onChange: (e) => setMejores(e.target.value === '' ? '' : Number(e.target.value)) }) })] }), validoN && validoK && (_jsx("p", { className: "rounded-lg bg-fondo px-3 py-2 text-sm", children: k === n ? (_jsxs(_Fragment, { children: ["Se espera el ", _jsx("strong", { children: "promedio" }), " de las \u00FAltimas ", n, " jornadas."] })) : k === 1 ? (_jsxs(_Fragment, { children: ["Se espera lo de ", _jsx("strong", { children: "la jornada con m\u00E1s pacientes" }), " de las \u00FAltimas ", n, "."] })) : (_jsxs(_Fragment, { children: ["Se espera el promedio de ", _jsxs("strong", { children: ["las ", k, " con m\u00E1s pacientes"] }), " de las \u00FAltimas ", n, " jornadas."] })) })), _jsx(Boton, { icono: _jsx(Save, { className: "size-4" }), disabled: !validoN || !validoK || sinCambios, cargando: guardar.isPending, onClick: () => guardar.mutate(), children: "Guardar" })] }) }));
}
/** Cuántas visitas puede perderse un paciente y seguir contándose como regular (jornada, ronda, "Qué llevar"). */
function AjusteRegulares() {
    const consulta = useConfiguracion();
    const cliente = useQueryClient();
    const [visitas, setVisitas] = useState('');
    useEffect(() => {
        if (consulta.data)
            setVisitas(consulta.data.visitasSinVenirRegular ?? VISITAS_SIN_VENIR_REGULAR);
    }, [consulta.data]);
    const guardar = useMutation({
        mutationFn: () => guardarConfiguracion({ visitasSinVenirRegular: Number(visitas) }),
        onSuccess: () => {
            // Cambia quién cuenta en la jornada, la ronda y el panel.
            for (const k of [['configuracion'], ['stats'], ['jornada'], ['jornadas'], ['reportes']])
                cliente.invalidateQueries({ queryKey: k });
            toast.success('Guardado. El cambio quedó en Auditoría.');
        },
        onError: (e) => toast.error(e.message),
    });
    if (!consulta.data)
        return null;
    const actual = consulta.data.visitasSinVenirRegular ?? VISITAS_SIN_VENIR_REGULAR;
    const n = Number(visitas);
    const valido = visitas !== '' && Number.isInteger(n) && n >= 1 && n <= 40;
    return (_jsx(Tarjeta, { titulo: "Pacientes regulares", className: "mt-4 max-w-2xl", children: _jsxs("div", { className: "space-y-4 p-5", children: [_jsxs("p", { className: "text-sm text-tenue", children: ["No todos los registrados desde 2017 siguen viniendo. Un paciente cuenta como ", _jsx("strong", { className: "text-tinta", children: "regular" }), " mientras no se haya perdido m\u00E1s de este n\u00FAmero de visitas (una cada 3 meses). Los dem\u00E1s siguen en el sistema y se pueden buscar y atender, pero no salen como \"por ver\" en la jornada ni en la ronda, ni se les prepara medicamento en \"Qu\u00E9 llevar\". Si uno vuelve, al registrarle la visita vuelve a contar."] }), _jsx(Campo, { etiqueta: "Visitas que se puede perder y seguir siendo regular", error: !valido && visitas !== '' ? 'Entre 1 y 40 visitas' : undefined, ayuda: valido ? `Con ${n}: deja de contar quien lleva más de ${tiempoSinVenir(n)} sin venir.` : undefined, className: "max-w-80", children: _jsx(Entrada, { type: "number", min: 1, max: 40, value: visitas, onChange: (e) => setVisitas(e.target.value === '' ? '' : Number(e.target.value)) }) }), _jsx(Boton, { icono: _jsx(Save, { className: "size-4" }), disabled: !valido || n === actual, cargando: guardar.isPending, onClick: () => guardar.mutate(), children: "Guardar" })] }) }));
}
/** El correo de cada mañana a quien gestiona el inventario (vencidos, por vencer, bajo el mínimo). */
function AjusteAvisoInventario() {
    const consulta = useConfiguracion();
    const cliente = useQueryClient();
    const guardar = useMutation({
        mutationFn: (v) => guardarConfiguracion({ avisoInventarioCorreo: v }),
        onSuccess: () => {
            cliente.invalidateQueries({ queryKey: ['configuracion'] });
            toast.success('Guardado. El cambio quedó en Auditoría.');
        },
        onError: (e) => toast.error(e.message),
    });
    if (!consulta.data)
        return null;
    const activo = (consulta.data.avisoInventarioCorreo ?? 1) === 1;
    return (_jsx(Tarjeta, { titulo: "Avisos del inventario por correo", className: "mt-4 max-w-2xl", children: _jsxs("div", { className: "space-y-4 p-5", children: [_jsx("p", { className: "text-sm text-tenue", children: "Cada ma\u00F1ana, despu\u00E9s de las 7, se manda un correo a quienes gestionan el inventario (con el correo confirmado) si hay lotes vencidos, lotes por vencer o medicamentos bajo el m\u00EDnimo. Si nada cambi\u00F3 desde el \u00FAltimo aviso, no se repite hasta pasada una semana." }), _jsx(Segmentos, { etiqueta: "Avisos del inventario por correo", valor: activo ? 'si' : 'no', alCambiar: (v) => guardar.mutate(v === 'si' ? 1 : 0), className: "max-w-xs", opciones: [
                        { value: 'si', label: 'Mandar avisos' },
                        { value: 'no', label: 'No mandar' },
                    ] })] }) }));
}
function AjusteSesion() {
    const consulta = useConfiguracion();
    const cliente = useQueryClient();
    const [minutos, setMinutos] = useState('');
    useEffect(() => {
        if (consulta.data)
            setMinutos(consulta.data.sesionMinutosInactividad);
    }, [consulta.data]);
    const guardar = useMutation({
        mutationFn: () => guardarConfiguracion({ sesionMinutosInactividad: Number(minutos) }),
        onSuccess: () => {
            cliente.invalidateQueries({ queryKey: ['configuracion'] });
            toast.success('Guardado. El cambio quedó en Auditoría.');
        },
        onError: (e) => toast.error(e.message),
    });
    if (!consulta.data)
        return null;
    const valido = minutos !== '' && Number.isInteger(Number(minutos)) && Number(minutos) >= 5 && Number(minutos) <= 480;
    return (_jsx(Tarjeta, { titulo: "Seguridad de la sesi\u00F3n", className: "mt-4 max-w-2xl", children: _jsxs("div", { className: "space-y-4 p-5", children: [_jsx("p", { className: "text-sm text-tenue", children: "La app guarda datos de salud: si nadie la usa durante este tiempo, cierra la sesi\u00F3n sola (tambi\u00E9n si se cerr\u00F3 el navegador). Tras 5 contrase\u00F1as incorrectas seguidas, la cuenta se bloquea 15 minutos." }), _jsx(Campo, { etiqueta: "Cerrar la sesi\u00F3n tras (minutos sin actividad)", error: !valido && minutos !== '' ? 'Entre 5 y 480 minutos' : undefined, className: "max-w-64", children: _jsx(Entrada, { type: "number", min: 5, max: 480, value: minutos, onChange: (e) => setMinutos(e.target.value === '' ? '' : Number(e.target.value)) }) }), _jsx(Boton, { icono: _jsx(Save, { className: "size-4" }), disabled: !valido || minutos === consulta.data.sesionMinutosInactividad, cargando: guardar.isPending, onClick: () => guardar.mutate(), children: "Guardar" })] }) }));
}
