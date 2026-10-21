import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { History, RotateCcw, Undo2, X } from 'lucide-react';
import {} from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useAuditoria, useFiltrosAuditoria } from '../api/consultas';
import { restaurarRegistro } from '../api/recursos';
import { conQuien, MOTIVOS_BAJA, MOTIVOS_INASISTENCIA, MOTIVOS_REPOSICION } from '../lib/etiquetas';
import { useSesion } from '../auth/sesion';
import { useConfirmar } from '../components/confirmar';
import { BotonesTrimestre } from '../components/Periodo';
import { Boton, Cargando, EncabezadoPagina, ErrorCarga, Insignia, Paginacion, porPaginaDe, recordarPorPagina, Selector, Tabla, Tarjeta, Vacio } from '../components/ui';
import { fecha, fechaYHora, nombreCompleto } from '../lib/formato';
import { SelectorFecha } from '../components/SelectorFecha';
const ACCIONES = {
    CREATE: { texto: 'Creó', color: '#15803d' },
    UPDATE: { texto: 'Editó', color: '#a16207' },
    DELETE: { texto: 'Eliminó', color: '#dc2626' },
    RESTORE: { texto: 'Restauró', color: '#2563eb' },
    MERGE: { texto: 'Unió', color: '#7c3aed' },
    SPLIT: { texto: 'Separó', color: '#7c3aed' },
    CLOSE: { texto: 'Cerró', color: '#15803d' },
    BAJA: { texto: 'Dio de baja', color: '#6b665e' },
    VIEW: { texto: 'Abrió la ficha', color: '#6b665e' },
    NO_VINO: { texto: 'No vino', color: '#6b665e' },
    DESCARGA: { texto: 'Descargó para usar sin internet', color: '#7c3aed' },
    NO_VINO_DESHECHO: { texto: 'Quitó "No vino"', color: '#6b665e' },
    EXPORT: { texto: 'Exportó', color: '#7c3aed' },
    LOGIN: { texto: 'Inició sesión', color: '#6b665e' },
    BLOQUEO: { texto: 'Cuenta bloqueada', color: '#dc2626' },
    DESBLOQUEO: { texto: 'Desbloqueó una cuenta', color: '#15803d' },
    SESIONES_CERRADAS: { texto: 'Cerró las sesiones de un usuario', color: '#a16207' },
    PLANILLA_ENVIADA: { texto: 'Envió la planilla por correo', color: '#2563eb' },
    ENTRADA: { texto: 'Entrada', color: '#15803d' },
    AJUSTE: { texto: 'Ajuste', color: '#a16207' },
    REACTIVAR: { texto: 'Reactivó', color: '#15803d' },
    RECUPERACION_PEDIDA: { texto: 'Pidió restablecer la contraseña', color: '#6b665e' },
    CONTRASENA_RESTABLECIDA: { texto: 'Restableció su contraseña', color: '#a16207' },
    CAMBIO_CODIGO: { texto: 'Cambió el código', color: '#a16207' },
    CANCEL: { texto: 'Canceló', color: '#6b665e' },
    ENTREGA: { texto: 'Entregó medicamentos', color: '#15803d' },
    REPOSICION: { texto: 'Repuso sin consulta', color: '#a16207' },
    DEVOLUCION: { texto: 'Devolución', color: '#2563eb' },
};
const ENTIDADES = { Patient: 'Paciente', User: 'Usuario', ClinicalVisit: 'Visita', Prescription: 'Receta', Configuracion: 'Configuración', Jornada: 'Jornada', Meta: 'Metas', Medication: 'Medicamento', Community: 'Batey', Sesion: 'Sesión', Reporte: 'Reporte', Entrega: 'Entrega', Role: 'Rol' };
/** Nombre legible de cada campo de la visita. */
const CAMPOS = {
    visitDate: 'Fecha',
    visitType: 'Tipo',
    isHomeVisit: 'Domiciliaria',
    weightKg: 'Peso',
    heightM: 'Estatura',
    bmi: 'IMC',
    systolicManual: 'Sistólica manual',
    diastolicManual: 'Diastólica manual',
    systolicAuto: 'Sistólica auto.',
    diastolicAuto: 'Diastólica auto.',
    heartRate: 'Frec. cardíaca',
    oxygenSaturation: 'Saturación',
    temperature: 'Temperatura',
    reason: 'Motivo',
    notes: 'Comentario',
    prescriptionText: 'Indicaciones',
    nextVisitDate: 'Próxima visita',
    bpClassificationId: 'Clasificación',
    doctorId: 'Atendió (cuenta)',
    doctorNombre: 'Atendió',
    firstName: 'Nombre',
    lastName: 'Apellido',
    gender: 'Sexo',
    birthDate: 'Nacimiento',
    birthDateIsEstimated: 'Nacimiento estimado',
    phoneNumber: 'Teléfono',
    address: 'Casa',
    nationalId: 'Cédula',
    communityId: 'Batey (id)',
    hasFamilyHistory: 'Antecedentes familiares',
    saltIntake: 'Sal',
    alcoholIntake: 'Alcohol',
    smokingStatus: 'Tabaco',
    photoUrl: 'Foto',
    consentimientoDatos: 'Consentimiento de datos',
    consentimientoFecha: 'Fecha del consentimiento',
    consentimientoRegistradoPor: 'Consentimiento registrado por',
    name: 'Nombre',
    concentration: 'Concentración',
    stockMinimo: 'Existencia mínima',
    activo: 'Activo',
    isActive: 'Activo',
    municipality: 'Municipio',
    province: 'Provincia',
    latitud: 'Latitud',
    longitud: 'Longitud',
};
const legible = (campo, v) => {
    if (v === null || v === undefined || v === '')
        return '(vacío)';
    if (['visitDate', 'nextVisitDate'].includes(campo))
        return fecha(String(v));
    if (campo === 'birthDate')
        return String(v).slice(0, 10);
    if (campo === 'gender')
        return { MALE: 'Masculino', FEMALE: 'Femenino', OTHER: 'Otro' }[String(v)] ?? String(v);
    if (campo === 'birthDateIsEstimated')
        return v ? 'Sí' : 'No';
    if (['weightKg', 'heightM', 'bmi', 'temperature'].includes(campo))
        return String(Math.round(Number(v) * 100) / 100);
    if (campo === 'isHomeVisit')
        return v === 'true' || v === true ? 'Sí' : 'No';
    const s = String(v);
    return s.length > 40 ? `${s.slice(0, 40)}…` : s;
};
/** Pacientes de una visita (para poder ir a la ficha). */
function pacienteDe(r, d) {
    if (r.entity === 'Patient')
        return r.entityId;
    if (r.entity !== 'ClinicalVisit')
        return null;
    if (typeof d.paciente === 'number')
        return d.paciente;
    const v = d.visita;
    if (v?.patientId)
        return Number(v.patientId);
    if (typeof d.pacienteId === 'number')
        return d.pacienteId;
    return null;
}
function Detalle({ r }) {
    if (r.action === 'VIEW')
        return 'Abrió la ficha del paciente';
    if (!r.details)
        return '—';
    if (r.action === 'DESCARGA') {
        const x = JSON.parse(r.details);
        return `Descargó ${x.batey} (${x.pacientes} fichas) en su dispositivo para usar sin internet`;
    }
    if (r.action === 'NO_VINO') {
        const x = JSON.parse(r.details);
        const t = x.tratamiento ? ` · se le dejó el tratamiento con ${conQuien(x.tratamiento.con, x.tratamiento.parentesco)}: ${x.tratamiento.medicamentos.join(' · ')}` : '';
        return `${x.codigo} · ${x.nombre}: no vino a la jornada del ${fecha(`${x.fecha}T12:00:00`)} (${MOTIVOS_INASISTENCIA[x.motivo].toLowerCase()})${x.nota ? ` · ${x.nota}` : ''}${t}`;
    }
    let d;
    try {
        d = JSON.parse(r.details);
    }
    catch {
        return r.details;
    }
    if (r.entity === 'Entrega') {
        const medicamentos = d.medicamentos?.join(' · ') ?? '';
        const motivo = d.motivo ? ` (${MOTIVOS_REPOSICION[d.motivo].toLowerCase()})` : '';
        const dev = d.devolucion;
        if (r.action === 'DEVOLUCION' && dev) {
            const que = dev.motivo === 'CORRECCION' ? 'Corrigió la entrega' : dev.destino === 'DESCARTE' ? 'El paciente devolvió (se descartaron)' : 'El paciente devolvió (al inventario)';
            return `${d.paciente}: ${que} · ${dev.medicamentos.join(' · ')}${dev.nota ? ` · ${dev.nota}` : ''}`;
        }
        return `${d.paciente}: ${medicamentos}${motivo} · recibió ${d.recibio}`;
    }
    if (r.entity === 'User' && r.action === 'DELETE') {
        const n = Number(d.visitasReasignadas ?? 0);
        return `${d.usuario} (${d.email}, ${d.rol})${n ? ` · ${n.toLocaleString('es-DO')} visitas reasignadas a ${d.reasignadasA}; cada una conserva quién atendió` : ' · sin visitas'}`;
    }
    if (r.entity === 'User' && d.cambio === 'correo')
        return `${d.nombre}: cambió su correo de ${d.antes} a ${d.despues}`;
    if (r.entity === 'User' && d.cambio === 'usuario')
        return `${d.nombre}: cambió su usuario para entrar de ${d.antes ?? '(ninguno)'} a ${d.despues}`;
    if (r.entity === 'User' && d.cambio === 'nombre')
        return `Cambió el nombre: ${d.antes} → ${d.despues} (${Number(d.visitasActualizadas).toLocaleString('es-DO')} visitas actualizadas)`;
    if (r.entity === 'Configuracion') {
        const a = (d.antes ?? {});
        const b = (d.despues ?? {});
        const NOMBRES = {
            visitasHorasEdicion: 'Plazo para que los médicos corrijan visitas (horas)',
            alertaSubidaSistolica: 'Alerta: subida de sistólica',
            alertaSubidaDiastolica: 'Alerta: subida de diastólica',
            alertaCumplimientoMinimo: 'Alerta: cumplimiento mínimo (%)',
            alertaVisitasCumplimiento: 'Alerta: visitas con cumplimiento bajo',
            alertaVisitasSinControl: 'Alerta: visitas seguidas sin control',
            sesionMinutosInactividad: 'Cierre de sesión por inactividad (min)',
            entregaInmediata: 'Entregar al guardar la visita (1 = sí)',
            avisoInventarioCorreo: 'Aviso diario del inventario por correo (1 = sí)',
            visitasSinVenirRegular: 'Visitas que se puede perder un paciente regular',
            jornadasParaEsperados: 'Esperados: jornadas recientes que se miran',
            mejoresParaEsperados: 'Esperados: cuántas de las mejores se promedian',
            reposicionMesesMaximo: 'Reposición sin consulta: meses desde la última visita',
        };
        const cambios = Object.keys(b).filter((k) => a[k] !== b[k]);
        return cambios.length ? cambios.map((k) => `${NOMBRES[k] ?? k}: ${a[k] ?? '—'} → ${b[k]}`).join(' · ') : 'Sin cambios';
    }
    if (r.entity === 'ClinicalVisit' && r.action === 'UPDATE') {
        const cambios = Object.entries((d.cambios ?? {})).filter(([k]) => k !== 'bmi');
        return (_jsx("ul", { className: "space-y-0.5", children: cambios.map(([k, c]) => (_jsxs("li", { children: [_jsxs("span", { className: "text-tinta", children: [CAMPOS[k] ?? k, ":"] }), " ", legible(k, c.antes), " \u2192 ", _jsx("span", { className: "font-medium text-tinta", children: legible(k, c.despues) })] }, k))) }));
    }
    if (r.entity === 'ClinicalVisit' && r.action === 'DELETE') {
        const v = (d.visita ?? {});
        const recetas = (d.recetas ?? []);
        return `Visita del ${fecha(String(v.visitDate))} de ${d.paciente} · atendió ${v.doctorNombre ?? '—'} · PA ${v.systolicManual ?? v.systolicAuto ?? '—'}/${v.diastolicManual ?? v.diastolicAuto ?? '—'}${recetas.length ? ` · ${recetas.map((x) => `${x.medicamento} (${x.quantityDispensed ?? x.entregadas})`).join(', ')}` : ''}`;
    }
    if (r.entity === 'Patient' && r.action === 'BAJA') {
        return `${d.codigo} · ${d.nombre}: ${MOTIVOS_BAJA[d.motivo] ?? d.motivo} el ${fecha(`${d.fecha}T12:00:00`)}${d.detalle ? ` · ${d.detalle}` : ''}`;
    }
    if (r.entity === 'Patient' && r.action === 'DELETE') {
        return `${d.codigo} · ${d.nombre} (${d.batey}): ficha eliminada`;
    }
    if (r.entity === 'Patient' && r.action === 'CAMBIO_CODIGO') {
        return `${d.nombre}: ${d.anterior} → ${d.codigo} (${d.batey}${d.aMano ? ', escrito a mano' : ''})`;
    }
    if (r.entity === 'Patient' && r.action === 'REACTIVAR') {
        const b = (d.bajaAnterior ?? {});
        return `${d.codigo} · ${d.nombre} volvió a activo${b.motivo ? ` (estaba de baja: ${MOTIVOS_BAJA[b.motivo]}${b.fecha ? `, ${fecha(b.fecha)}` : ''})` : ''}`;
    }
    if (r.entity === 'Meta') {
        const antes = (d.antes ?? {});
        return Object.entries((d.despues ?? {}))
            .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${antes[k] ?? '—'} → ${v ?? 'sin meta'}`)
            .join(' · ') + ` (año ${d.anio}${d.batey ? ` · ${d.batey}` : ''})`;
    }
    if (r.entity === 'Patient' && r.action === 'MERGE') {
        const c = d.conservado;
        const e = d.eliminado;
        return `Unió ${e.patientCode} (${e.firstName} ${e.lastName}) dentro de ${c.codigo} (${c.nombre}) · ${d.visitas.length} visitas movidas; ${e.patientCode} se eliminó`;
    }
    if (r.entity === 'Patient' && r.action === 'SPLIT') {
        const o = d.original;
        const n = d.nuevo;
        return `Separó ${d.visitas.length} visitas de ${o.codigo} (${o.nombre}) en la ficha nueva ${n.codigo} (${n.nombre})`;
    }
    if (r.entity === 'Patient' && r.action === 'UPDATE' && d.despues) {
        const antes = (d.antes ?? {});
        return (_jsxs("ul", { className: "space-y-0.5", children: [Object.entries(d.despues).map(([k, v]) => (_jsxs("li", { children: [_jsxs("span", { className: "text-tinta", children: [CAMPOS[k] ?? k, ":"] }), " ", legible(k, antes[k]), " \u2192 ", _jsx("span", { className: "font-medium text-tinta", children: legible(k, v) })] }, k))), !!d.revision && _jsx("li", { children: "Desde Revisi\u00F3n de datos" })] }));
    }
    // Ediciones con antes y después por campo (pacientes, medicamentos, bateyes)
    if (r.action === 'UPDATE' && d.cambios && ['Patient', 'Medication', 'Community'].includes(r.entity)) {
        const cambios = d.cambios;
        const quien = (d.nombre ?? d.medicamento ?? d.batey);
        return (_jsxs("ul", { className: "space-y-0.5", children: [quien && _jsxs("li", { className: "text-tinta", children: [d.codigo ? `${d.codigo} · ` : '', quien] }), Object.entries(cambios).map(([k, c]) => (_jsxs("li", { children: [_jsxs("span", { className: "text-tinta", children: [CAMPOS[k] ?? k, ":"] }), " ", legible(k, c.antes), " \u2192 ", _jsx("span", { className: "font-medium text-tinta", children: legible(k, c.despues) })] }, k)))] }));
    }
    if (r.action === 'VIEW')
        return 'Abrió la ficha del paciente';
    if (r.action === 'EXPORT')
        return `${d.exportacion}${d.filtros ? ` · filtros: ${Object.entries(d.filtros).map(([k, v]) => `${k}=${v}`).join(', ') || 'ninguno'}` : ''}`;
    if (r.action === 'LOGIN')
        return `Inició sesión${d.ip ? ` desde ${d.ip}` : ''}`;
    if (r.action === 'PLANILLA_ENVIADA')
        return `Planilla de ${d.periodo} a ${d.para.join(', ')}${d.simulado ? ' (sin enviar: el servidor no tiene correo)' : ''}`;
    if (r.action === 'SESIONES_CERRADAS')
        return `${d.nombre}: se cerraron todas sus sesiones; tiene que volver a entrar`;
    if (r.action === 'DESBLOQUEO')
        return `${d.email}: puede volver a entrar sin esperar`;
    if (r.action === 'BLOQUEO')
        return `${d.email}: ${d.minutos} minutos bloqueada por intentos fallidos${d.ip ? ` (desde ${d.ip})` : ''}`;
    if (r.entity === 'Medication' && r.action === 'ENTRADA')
        return `Entrada de ${d.cantidad} unidades (${d.origen === 'COMPRA' ? 'compra' : 'donación'}${d.procedencia ? `: ${d.procedencia}` : ''})${d.vencimiento ? ` · vence ${fecha(String(d.vencimiento))}` : ''}`;
    if (r.entity === 'Medication' && r.action === 'AJUSTE')
        return `Lote ${d.lote}: ${Number(d.cantidad) > 0 ? '+' : ''}${d.cantidad} · ${d.motivo}`;
    if (['Medication', 'Community'].includes(r.entity) && ['CREATE', 'DELETE'].includes(r.action))
        return String(d.medicamento ?? d.batey ?? '');
    if (r.action === 'RESTORE')
        return `Deshizo la ${d.deshace} del registro #${d.registro}`;
    return Object.entries(d)
        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join(' · ');
}
export function Auditoria() {
    const [params, setParams] = useSearchParams();
    const num = (k) => (params.get(k) !== null && params.get(k) !== '' ? Number(params.get(k)) : undefined);
    const filtro = {
        page: num('pagina') ?? 1,
        limit: porPaginaDe(params, 'auditoria', 50),
        userId: num('usuario'),
        entity: params.get('registro') || undefined,
        action: params.get('accion') || undefined,
        desde: params.get('desde') || undefined,
        hasta: params.get('hasta') || undefined,
        entityId: num('id'),
    };
    const consulta = useAuditoria(filtro);
    const opcionesFiltro = useFiltrosAuditoria();
    const cambiar = (c) => setParams((p) => {
        for (const [k, v] of Object.entries(c))
            (v ? p.set(k, v) : p.delete(k));
        if (!('pagina' in c))
            p.delete('pagina');
        return p;
    }, { replace: true });
    const hayFiltros = ['usuario', 'registro', 'accion', 'desde', 'hasta', 'id'].some((k) => params.get(k));
    const { tiene } = useSesion();
    const confirmar = useConfirmar();
    const cliente = useQueryClient();
    const puedeRestaurar = tiene('auditoria.restaurar');
    const restaurar = useMutation({
        mutationFn: restaurarRegistro,
        onSuccess: () => {
            for (const k of [['auditoria'], ['revision'], ['visitas'], ['paciente'], ['pacientes'], ['jornada'], ['stats'], ['medicamentos'], ['medicos']])
                cliente.invalidateQueries({ queryKey: k });
            toast.success('Listo: el cambio se deshizo y quedó registrado.');
        },
        onError: (e) => toast.error(e.message),
    });
    const pedir = async (r) => {
        const eliminacion = r.action === 'DELETE';
        if (r.action === 'MERGE' || r.action === 'SPLIT') {
            const union = r.action === 'MERGE';
            const ok = await confirmar({
                titulo: union ? '¿Deshacer la unión?' : '¿Deshacer la separación?',
                mensaje: union
                    ? 'La ficha eliminada vuelve con su mismo código y sus visitas. Los datos que se le copiaron a la ficha conservada (teléfono, dirección…) se quitan.'
                    : 'Las visitas vuelven a la ficha original y la ficha nueva se elimina (solo si no tiene visitas registradas después).',
                confirmar: 'Deshacer',
                peligro: false,
            });
            if (ok)
                restaurar.mutate(r.id);
            return;
        }
        const ok = await confirmar({
            titulo: eliminacion ? `¿Restaurar la visita #${r.entityId}?` : `¿Deshacer la corrección de la visita #${r.entityId}?`,
            mensaje: eliminacion
                ? 'La visita vuelve con sus medicamentos y el mismo número. Si se había registrado en la app, las pastillas se descuentan otra vez del inventario.'
                : 'Cada campo corregido vuelve al valor que tenía antes. Si después hubo otra corrección en esos mismos campos, se sobrescribe.',
            confirmar: eliminacion ? 'Restaurar' : 'Deshacer',
            peligro: false,
        });
        if (ok)
            restaurar.mutate(r.id);
    };
    return (_jsxs(_Fragment, { children: [_jsx(EncabezadoPagina, { titulo: "Auditor\u00EDa", descripcion: "Qui\u00E9n hizo qu\u00E9 y cu\u00E1ndo: cambios, accesos a fichas, exportaciones e inicios de sesi\u00F3n. Las visitas eliminadas o corregidas se pueden restaurar." }), _jsxs(Tarjeta, { className: "mb-4", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-3 p-4", children: [_jsx(Selector, { "aria-label": "Usuario", className: "w-52", vacio: "Todos los usuarios", value: params.get('usuario') ?? '', onChange: (e) => cambiar({ usuario: e.target.value }), opciones: (opcionesFiltro.data?.actores ?? []).map((a) => ({ value: String(a.userId), label: a.nombre })) }), _jsx(Selector, { "aria-label": "Tipo de registro", className: "w-52", vacio: "Todos los registros", value: params.get('registro') ?? '', onChange: (e) => cambiar({ registro: e.target.value, id: undefined }), opciones: (opcionesFiltro.data?.entidades ?? []).map((e) => ({ value: e, label: ENTIDADES[e] ?? e })) }), _jsx(Selector, { "aria-label": "Acci\u00F3n", className: "w-52", vacio: "Todas las acciones", value: params.get('accion') ?? '', onChange: (e) => cambiar({ accion: e.target.value }), opciones: (opcionesFiltro.data?.acciones ?? []).map((a) => ({ value: a, label: ACCIONES[a]?.texto ?? a })) }), _jsx(BotonesTrimestre, { desde: params.get('desde'), hasta: params.get('hasta'), onCambiar: (r) => cambiar(r) }), _jsxs("div", { className: "flex items-center gap-2 text-sm text-tenue", children: ["Desde", _jsx(SelectorFecha, { corto: true, vacio: "Cualquier fecha", className: "w-auto", "aria-label": "Desde", value: params.get('desde'), max: params.get('hasta') || undefined, onChange: (v) => cambiar({ desde: v }) })] }), _jsxs("div", { className: "flex items-center gap-2 text-sm text-tenue", children: ["Hasta", _jsx(SelectorFecha, { corto: true, vacio: "Cualquier fecha", className: "w-auto", "aria-label": "Hasta", value: params.get('hasta'), min: params.get('desde') || undefined, onChange: (v) => cambiar({ hasta: v }) })] }), hayFiltros && (_jsx(Boton, { variante: "fantasma", icono: _jsx(X, { className: "size-4" }), onClick: () => setParams({}, { replace: true }), children: "Limpiar" }))] }), filtro.entityId !== undefined && (_jsxs("p", { className: "border-t border-borde px-4 py-2 text-sm text-tenue", children: ["Solo el registro ", ENTIDADES[filtro.entity ?? ''] ?? filtro.entity, " #", filtro.entityId, ".", ' ', _jsx("button", { className: "text-tinta underline", onClick: () => cambiar({ id: undefined }), children: "Quitar" })] }))] }), _jsx(Tarjeta, { children: consulta.isPending ? (_jsx(Cargando, {})) : consulta.isError ? (_jsx(ErrorCarga, { error: consulta.error })) : consulta.data.data.length === 0 ? (_jsx(Vacio, { icono: _jsx(History, { className: "size-8" }), titulo: hayFiltros ? 'Nada con esos filtros' : 'Sin registros' })) : (_jsxs(_Fragment, { children: [_jsx(Tabla, { columnas: ['Fecha', 'Acción', 'Registro', 'Detalle', 'Usuario', { texto: '', className: 'w-36' }], children: consulta.data.data.map((r) => {
                                const a = ACCIONES[r.action];
                                let d = {};
                                try {
                                    d = r.details ? JSON.parse(r.details) : {};
                                }
                                catch {
                                    /* detalle en texto plano */
                                }
                                const paciente = pacienteDe(r, d);
                                const restaurable = (r.entity === 'ClinicalVisit' && ['DELETE', 'UPDATE'].includes(r.action)) || (r.entity === 'Patient' && ['MERGE', 'SPLIT'].includes(r.action));
                                return (_jsxs("tr", { className: "align-top", children: [_jsx("td", { className: "px-5 py-3 whitespace-nowrap", children: fechaYHora(r.timestamp) }), _jsx("td", { className: "px-5 py-3", children: _jsx(Insignia, { color: a?.color, children: a?.texto ?? r.action }) }), _jsxs("td", { className: "px-5 py-3 whitespace-nowrap", children: [ENTIDADES[r.entity] ?? r.entity, ' ', !['Configuracion', 'Reporte'].includes(r.entity) && (_jsxs("button", { className: "font-mono text-xs text-tenue hover:text-tinta hover:underline", title: "Ver todo el historial de este registro", onClick: () => cambiar({ registro: r.entity, id: String(r.entityId) }), children: ["#", r.entityId] })), paciente && (_jsx(Link, { to: `/pacientes/${paciente}`, className: "block text-xs font-medium text-marca-700 hover:underline", children: "Ver paciente" }))] }), _jsx("td", { className: "max-w-xl px-5 py-3 text-xs text-tenue", children: _jsx(Detalle, { r: r }) }), _jsx("td", { className: "px-5 py-3 whitespace-nowrap text-tenue", children: r.user ? nombreCompleto(r.user) : (r.actorName ?? 'Sistema') }), _jsx("td", { className: "px-5 py-2.5 text-right", children: restaurable && r.revertidoEn ? (_jsxs("span", { className: "text-xs text-tenue", children: ["Deshecho el ", fecha(r.revertidoEn), r.revertidoPor && _jsxs("span", { className: "block", children: ["por ", r.revertidoPor] })] })) : (restaurable &&
                                                puedeRestaurar && (_jsx(Boton, { variante: "secundario", className: "h-8 text-xs", cargando: restaurar.isPending && restaurar.variables === r.id, icono: r.action === 'DELETE' ? _jsx(RotateCcw, { className: "size-3.5" }) : _jsx(Undo2, { className: "size-3.5" }), onClick: () => pedir(r), children: r.action === 'DELETE' ? 'Restaurar' : 'Deshacer' }))) })] }, r.id));
                            }) }), _jsx(Paginacion, { pagina: filtro.page, ultima: consulta.data.meta.lastPage, total: consulta.data.meta.total, alCambiar: (p) => cambiar({ pagina: String(p) }), porPagina: filtro.limit, alCambiarPorPagina: (n) => {
                                recordarPorPagina('auditoria', n);
                                cambiar({ por: String(n) });
                            } })] })) })] }));
}
