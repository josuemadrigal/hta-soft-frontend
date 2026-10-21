import { api, descargar, enviar } from './client';
export function query(params) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params))
        if (v !== undefined && v !== '')
            q.set(k, String(v));
    const s = q.toString();
    return s ? `?${s}` : '';
}
/* Autenticación */
export const iniciarSesion = (email, password) => enviar('/auth/login', 'POST', { email, password });
export const obtenerYo = () => api('/auth/me');
/** ¿Sigue vigente la sesión? (401 si la cerraron: el cliente sale solo). */
export const revisarSesion = () => api('/auth/sesion');
/** Devuelve tokens nuevos: las demás sesiones de la cuenta se cierran. */
export const cambiarContrasena = (actual, nueva) => enviar('/auth/contrasena', 'PATCH', { actual, nueva });
export const pedirConfirmacionCorreo = () => enviar('/auth/correo/confirmacion', 'POST');
export const confirmarCorreo = (token) => enviar('/auth/correo/confirmar', 'POST', { token });
export const olvideContrasena = (email) => enviar('/auth/contrasena/olvido', 'POST', { email });
export const restablecerContrasena = (token, nueva) => enviar('/auth/contrasena/restablecer', 'POST', { token, nueva });
export const cerrarSesionesUsuario = (userId) => enviar(`/users/${userId}/cerrar-sesiones`, 'POST');
export const desbloquearUsuario = (userId) => enviar(`/users/${userId}/desbloquear`, 'POST');
export const reenviarConfirmacion = (userId) => enviar(`/users/${userId}/confirmacion-correo`, 'POST');
export const listarPacientes = (f) => api(`/patients${query({ limit: 15, ...f })}`);
export const pacientesParecidos = (d) => api(`/patients/parecidos${query(d)}`);
export const consumoMedicamentos = () => api('/medication/consumo');
export const obtenerPaciente = (id) => api(`/patients/${id}`);
export const tensionPaciente = (id) => api(`/patients/${id}/timeline`);
export const analiticaPaciente = (id) => api(`/patients/${id}/analytics`);
export const crearPaciente = (d) => enviar('/patients', 'POST', d);
export const editarPaciente = (id, d) => enviar(`/patients/${id}`, 'PATCH', d);
export const subirFotoPaciente = (id, archivo) => {
    const fd = new FormData();
    fd.append('file', archivo);
    return enviar(`/patients/${id}/photo`, 'POST', fd);
};
export const quitarFotoPaciente = (id) => enviar(`/patients/${id}/photo`, 'DELETE');
export const ultimosMedicos = (communityId) => 
// activo: es un usuario activo de la app (los demás se juntan como "Otros").
api(`/patients/medicos${query({ communityId })}`);
export const pacientesJornada = (comunidad) => api(`/patients/jornada/${comunidad}`);
export const listarVisitas = (f) => api(`/visits${query({ limit: 25, ...f })}`);
export const listarQuienesAtienden = () => api('/visits/doctors');
export const crearVisita = (d) => enviar('/visits', 'POST', d);
export const obtenerVisita = (id) => api(`/visits/${id}`);
export const editarVisita = (id, d) => enviar(`/visits/${id}`, 'PATCH', d);
export const borrarVisita = (id) => enviar(`/visits/${id}`, 'DELETE');
export const leerConfiguracion = () => api('/settings');
export const guardarConfiguracion = (d) => enviar('/settings', 'PATCH', d);
export const listarComunidades = () => api('/communities');
export const obtenerComunidad = (id) => api(`/communities/${id}`);
export const crearComunidad = (d) => enviar('/communities', 'POST', d);
export const editarComunidad = (id, d) => enviar(`/communities/${id}`, 'PATCH', d);
export const listarMedicamentos = () => api('/medication');
export const obtenerMedicamento = (id) => api(`/medication/${id}`);
export const crearMedicamento = (d) => enviar('/medication', 'POST', d);
export const editarMedicamento = (id, d) => enviar(`/medication/${id}`, 'PATCH', d);
export const alertasInventario = () => api('/medication/alertas');
export const movimientosMedicamento = (id, page) => api(`/medication/${id}/movimientos?page=${page}`);
export const registrarEntrada = (medId, d) => enviar(`/medication/${medId}/entradas`, 'POST', d);
export const registrarAjuste = (medId, d) => enviar(`/medication/${medId}/ajustes`, 'POST', d);
export const listarJornadas = (f) => api(`/jornadas${query(f)}`);
export const sugerenciasJornadas = () => api('/jornadas/sugerencias');
export const responsablesJornada = () => api('/jornadas/responsables');
export const detalleJornada = (id) => api(`/jornadas/${id}`);
export const crearJornada = (d) => enviar('/jornadas', 'POST', d);
export const editarJornada = (id, d) => enviar(`/jornadas/${id}`, 'PATCH', d);
export const cancelarJornada = (id) => enviar(`/jornadas/${id}/cancelar`, 'POST');
export const cerrarJornada = (id) => enviar(`/jornadas/${id}/cerrar`, 'POST');
export const asistenciaJornadas = () => api('/jornadas/asistencia');
export const destinatariosResumen = () => api('/jornadas/destinatarios');
export const enviarResumenJornada = (id, d) => enviar(`/jornadas/${id}/enviar-resumen`, 'POST', d);
export const borrarMedicamento = (id) => enviar(`/medication/${id}`, 'DELETE');
export const listarConfigPA = () => api('/blood-pressure-config');
export const obtenerConfigPA = (id) => api(`/blood-pressure-config/${id}`);
export const crearConfigPA = (d) => enviar('/blood-pressure-config', 'POST', d);
export const editarConfigPA = (id, d) => enviar(`/blood-pressure-config/${id}`, 'PATCH', d);
export const borrarConfigPA = (id) => enviar(`/blood-pressure-config/${id}`, 'DELETE');
export const listarUsuarios = () => api('/users?limit=200');
export const obtenerUsuario = (id) => api(`/users/${id}`);
export const crearUsuario = (d) => enviar('/users', 'POST', d);
export const editarUsuario = (id, d) => enviar(`/users/${id}`, 'PATCH', d);
export const borrarUsuario = (id) => enviar(`/users/${id}`, 'DELETE');
export const subirFotoUsuario = (id, archivo) => {
    const fd = new FormData();
    fd.append('file', archivo);
    return enviar(`/users/${id}/photo`, 'POST', fd);
};
export const listarRoles = () => api('/roles');
export const obtenerRol = (id) => api(`/roles/${id}`);
export const catalogoPermisos = () => api('/roles/permisos');
export const crearRol = (d) => enviar('/roles', 'POST', d);
export const editarRol = (id, d) => enviar(`/roles/${id}`, 'PATCH', d);
export const borrarRol = (id) => enviar(`/roles/${id}`, 'DELETE');
/* Estadísticas, reportes y auditoría */
export const estadisticasPanel = (batey) => api(`/stats${batey ? `?batey=${batey}` : ''}`);
export const miPanel = (p) => api(`/stats/mio${p ? query(p) : ''}`);
export const estadisticasAvanzadas = () => api('/stats/advanced');
export const tendenciaPanel = (batey) => api(`/stats/trend${batey ? `?batey=${batey}` : ''}`);
export const estadisticasRonda = (batey) => api(`/stats/round${batey ? `?batey=${batey}` : ''}`);
export const pacientesAltoRiesgo = () => api('/stats/high-risk');
export const visitasRecientes = () => api('/stats/recent-visits');
export const resumenReporte = (f) => api(`/reports/summary${query(f)}`);
export const planillaJornada = (f) => api(`/reports/planilla${query(f)}`);
export const destinatariosPlanilla = () => api('/reports/planilla/destinatarios');
export const enviarPlanilla = (d) => enviar('/reports/planilla/enviar', 'POST', d);
export const listarMedicos = (f, eliminados = false) => api(`/doctors${query({ ...f, eliminados: eliminados ? 'true' : undefined })}`);
export const detalleMedico = (id, f) => api(`/doctors/${id}${query(f)}`);
export const compararMedicos = (ids, f) => api(`/doctors/compare${query({ ...f, ids: ids.join(',') })}`);
export const restaurarRegistro = (id) => enviar(`/audit-logs/${id}/restaurar`, 'POST');
export const listarAuditoria = (f) => api(`/audit-logs${query({ limit: 50, ...f })}`);
export const filtrosAuditoria = () => api('/audit-logs/filtros');
/* Revisión de datos */
export const casosRevision = (f) => api(`/revision${query({ tipo: f.tipo, descartados: f.descartados ? "true" : undefined })}`);
export const revisionPaciente = (id) => api(`/revision/pacientes/${id}`);
export const unirPacientes = (conservarId, eliminarId) => enviar('/revision/unir', 'POST', { conservarId, eliminarId });
export const separarPaciente = (id, d) => enviar(`/revision/pacientes/${id}/separar`, 'POST', d);
export const corregirPaciente = (id, d) => enviar(`/revision/pacientes/${id}/corregir`, 'POST', d);
export const decidirCaso = (d) => enviar('/revision/decisiones', 'POST', d);
export const reabrirCaso = (id) => enviar(`/revision/decisiones/${id}`, 'DELETE');
/* Bajas */
export const darDeBaja = (id, d) => enviar(`/patients/${id}/baja`, 'POST', d);
export const reactivarPaciente = (id) => enviar(`/patients/${id}/reactivar`, 'POST');
export const eliminarPaciente = (id) => enviar(`/patients/${id}`, 'DELETE');
export const regenerarCodigoPaciente = (id) => enviar(`/patients/${id}/regenerar-codigo`, 'POST');
export const cambiarCodigoPaciente = (id, codigo) => enviar(`/patients/${id}/codigo`, 'POST', { codigo });
/* Metas, donantes, mapa */
export const metasAnio = (anio, batey) => api(`/metas/${anio}${batey ? `?batey=${batey}` : ''}`);
export const guardarMetas = (anio, valores, batey) => enviar(`/metas/${anio}${batey ? `?batey=${batey}` : ''}`, 'PUT', { valores });
/** trimestre null = año completo */
export const reporteDonantes = (anio, trimestre) => api(`/reports/donantes?anio=${anio}${trimestre ? `&trimestre=${trimestre}` : ''}`);
export const descargarPdfDonantes = (anio, trimestre) => descargar(`/reports/donantes/pdf?anio=${anio}${trimestre ? `&trimestre=${trimestre}` : ''}`, `informe-light-a-candle_${trimestre ? `${anio}-T${trimestre}` : anio}.pdf`);
export const guardarTextoDonantes = (anio, trimestre, texto) => enviar('/reports/donantes/texto', 'PUT', { anio, trimestre, texto });
export const indicadoresBateyes = () => api('/reports/bateyes');
export const marcarNoVino = (id, d) => enviar(`/patients/${id}/no-vino`, 'POST', d);
export const quitarNoVino = (id, fecha) => enviar(`/patients/${id}/no-vino/${fecha}`, 'DELETE');
export const pendientesDeEntrega = (communityId) => api(`/entregas/pendientes${query({ communityId })}`);
export const conteoPendientesEntrega = () => api('/entregas/pendientes/conteo');
export const entregasDeHoy = (communityId) => api(`/entregas/hoy${query({ communityId })}`);
export const entregasDelPaciente = (id) => api(`/entregas/paciente/${id}`);
export const entregarPendientes = (d) => enviar('/entregas', 'POST', d);
export const registrarReposicion = (d) => enviar('/entregas/reposicion', 'POST', d);
export const obtenerEntrega = (id) => api(`/entregas/${id}`);
export const devolverEntrega = (id, d) => enviar(`/entregas/${id}/devolucion`, 'POST', d);
export const reporteEntregas = (f) => api(`/entregas/reporte${query(f)}`);
export const preparacionJornada = (id) => api(`/jornadas/${id}/preparacion`);
export const pacientesSinConsulta = () => api('/entregas/sin-consulta');
