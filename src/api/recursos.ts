import { api, descargar, enviar, type Sesion } from './client';
import type {
  AnaliticaPaciente,
  Comunidad,
  ConfigPA,
  EstadisticasAvanzadas,
  EstadisticasPanel,
  EstadisticasRonda,
  TendenciaPanel,
  FiltroReporte,
  GrupoPermisos,
  Medicamento,
  Lote,
  MovimientoInventario,
  AlertasInventario,
  OrigenLote,
  Jornada,
  DetalleJornada,
  SugerenciaJornada,
  Paciente,
  MiPanel,
  FiltrosAuditoria,
  Genero,
  MotivoBaja,
  MetasAnio,
  ClaveIndicador,
  ReporteDonantes,
  IndicadorBatey,
  TipoCaso,
  RevisionCasos,
  RevisionPaciente,
  PacienteAltoRiesgo,
  PacienteJornada,
  Paginado,
  PuntoTension,
  Receta,
  RegistroAuditoria,
  ResumenReporte,
  ListaMedicos,
  DetalleMedico,
  ComparacionMedicos,
  Rol,
  Usuario,
  Visita,
  VisitaReciente,
} from './tipos';

export function query(params: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
}

/* Autenticación */
export const iniciarSesion = (email: string, password: string) =>
  enviar<Sesion>('/auth/login', 'POST', { email, password });
export const obtenerYo = () => api<Usuario>('/auth/me');

/* Pacientes */
export type FiltroPacientes = {
  page: number;
  limit?: number;
  search?: string;
  communityId?: number;
  gender?: string;
  status?: string;
  /** id del rango de PA de la última visita, o "ninguna" */
  clasificacion?: string;
  situacion?: 'visto' | 'le-toca' | 'sin-venir' | 'sin-venir-ano' | 'sin-visitas';
  ageMin?: number;
  ageMax?: number;
  orden?: 'nombre' | 'codigo' | 'ultima-visita' | 'ausencia' | 'presion';
  /** Último médico que lo atendió */
  medico?: number;
};
export type DatosPaciente = Omit<
  Paciente,
  'id' | 'patientCode' | 'photoUrl' | 'registrationDate' | 'community' | 'clinicalVisits' | 'nationalId' | 'phoneNumber' | 'address'
> & { nationalId?: string; phoneNumber?: string; address?: string };

export const listarPacientes = (f: FiltroPacientes) =>
  api<Paginado<Paciente>>(`/patients${query({ limit: 15, ...f })}`);
export const obtenerPaciente = (id: number) => api<Paciente | null>(`/patients/${id}`);
export const tensionPaciente = (id: number) => api<PuntoTension[]>(`/patients/${id}/timeline`);
export const analiticaPaciente = (id: number) => api<AnaliticaPaciente>(`/patients/${id}/analytics`);
export const crearPaciente = (d: DatosPaciente) => enviar<Paciente>('/patients', 'POST', d);
export const editarPaciente = (id: number, d: Partial<DatosPaciente>) =>
  enviar<Paciente>(`/patients/${id}`, 'PATCH', d);
export const subirFotoPaciente = (id: number, archivo: File) => {
  const fd = new FormData();
  fd.append('file', archivo);
  return enviar<Paciente>(`/patients/${id}/photo`, 'POST', fd);
};
export const ultimosMedicos = (communityId?: number) =>
  api<{ id: number; nombre: string; pacientes: number }[]>(`/patients/medicos${query({ communityId })}`);
export const pacientesJornada = (comunidad: number) => api<PacienteJornada[]>(`/patients/jornada/${comunidad}`);

/* Visitas y recetas */
export type DatosReceta = Pick<
  Receta,
  'visitId' | 'medicationId' | 'dailyDose' | 'daysUntilNextVisit' | 'bufferDays' | 'patientSupplyRemaining'
>;
export type DatosVisita = {
  patientId: number;
  doctorId: number;
  visitDate: string;
  visitType: Visita['visitType'];
  isHomeVisit?: boolean;
  weightKg: number;
  heightM: number;
  systolicManual?: number;
  diastolicManual?: number;
  systolicAuto?: number;
  diastolicAuto?: number;
  heartRate?: number;
  oxygenSaturation?: number;
  temperature?: number;
  reason?: string;
  notes?: string;
  prescriptionText?: string;
  nextVisitDate?: string;
  prescriptions?: Omit<DatosReceta, 'visitId'>[];
};
export type FiltroVisitas = {
  page: number;
  limit?: number;
  search?: string;
  communityId?: number;
  from?: string;
  to?: string;
  doctorId?: number;
  bpClassificationId?: number;
  visitType?: string;
};
export type Atendio = { id: number; firstName: string; lastName: string };

export const listarVisitas = (f: FiltroVisitas) => api<Paginado<Visita>>(`/visits${query({ limit: 20, ...f })}`);
export const listarQuienesAtienden = () => api<Atendio[]>('/visits/doctors');
export const crearVisita = (d: DatosVisita) => enviar<Visita>('/visits', 'POST', d);
export const obtenerVisita = (id: number) => api<(Visita & { patient: Paciente }) | null>(`/visits/${id}`);
/** null borra el valor (p. ej. quitar una toma automática mal anotada). */
export type CambiosVisita = { [K in keyof Omit<DatosVisita, 'patientId' | 'prescriptions'>]?: DatosVisita[K] | null };
export const editarVisita = (id: number, d: CambiosVisita) => enviar<Visita>(`/visits/${id}`, 'PATCH', d);
export const borrarVisita = (id: number) => enviar<{ id: number; inventarioDevuelto: boolean }>(`/visits/${id}`, 'DELETE');

/* Configuración general */
export type Configuracion = {
  visitasHorasEdicion: number;
  alertaSubidaSistolica: number;
  alertaSubidaDiastolica: number;
  alertaCumplimientoMinimo: number;
  alertaVisitasCumplimiento: number;
  alertaVisitasSinControl: number;
  sesionMinutosInactividad: number;
};
export const leerConfiguracion = () => api<Configuracion>('/settings');
export const guardarConfiguracion = (d: Partial<Configuracion>) => enviar<Configuracion>('/settings', 'PATCH', d);

/* Catálogos */
export type DatosComunidad = Omit<Comunidad, 'id' | 'sequenceCounter'> & { sequenceCounter?: number };
export const listarComunidades = () => api<Comunidad[]>('/communities');
export const obtenerComunidad = (id: number) => api<Comunidad | null>(`/communities/${id}`);
export const crearComunidad = (d: DatosComunidad) => enviar<Comunidad>('/communities', 'POST', d);
export const editarComunidad = (id: number, d: Partial<DatosComunidad>) => enviar<Comunidad>(`/communities/${id}`, 'PATCH', d);

export const listarMedicamentos = () => api<Medicamento[]>('/medication');
export const obtenerMedicamento = (id: number) => api<(Medicamento & { lotes: Lote[] }) | null>(`/medication/${id}`);
export type DatosMedicamento = Pick<Medicamento, 'name' | 'concentration' | 'stockMinimo' | 'activo'>;
export const crearMedicamento = (d: DatosMedicamento) => enviar<Medicamento>('/medication', 'POST', d);
export const editarMedicamento = (id: number, d: Partial<DatosMedicamento>) => enviar<Medicamento>(`/medication/${id}`, 'PATCH', d);
export const alertasInventario = () => api<AlertasInventario>('/medication/alertas');
export const movimientosMedicamento = (id: number, page: number) => api<Paginado<MovimientoInventario>>(`/medication/${id}/movimientos?page=${page}`);
export type DatosEntrada = { cantidad: number; origen: OrigenLote; numero?: string; vencimiento?: string; procedencia?: string; nota?: string; fechaEntrada?: string };
export const registrarEntrada = (medId: number, d: DatosEntrada) => enviar<Lote>(`/medication/${medId}/entradas`, 'POST', d);
export type DatosAjuste = { loteId: number; cantidad: number; tipo: 'AJUSTE' | 'VENCIDO'; motivo: string };
export const registrarAjuste = (medId: number, d: DatosAjuste) => enviar<MovimientoInventario>(`/medication/${medId}/ajustes`, 'POST', d);

/* Jornadas */
export type DatosJornada = { communityId: number; fecha: string; responsableId?: number | null; notas?: string };
export const listarJornadas = (f: { desde?: string; hasta?: string; communityId?: number; estado?: string }) => api<Jornada[]>(`/jornadas${query(f)}`);
export const sugerenciasJornadas = () => api<SugerenciaJornada[]>('/jornadas/sugerencias');
export const responsablesJornada = () => api<{ id: number; firstName: string; lastName: string }[]>('/jornadas/responsables');
export const detalleJornada = (id: number) => api<DetalleJornada>(`/jornadas/${id}`);
export const crearJornada = (d: DatosJornada) => enviar<Jornada>('/jornadas', 'POST', d);
export const editarJornada = (id: number, d: Partial<DatosJornada>) => enviar<Jornada>(`/jornadas/${id}`, 'PATCH', d);
export const cancelarJornada = (id: number) => enviar<Jornada>(`/jornadas/${id}/cancelar`, 'POST');
export const cerrarJornada = (id: number) => enviar<Jornada>(`/jornadas/${id}/cerrar`, 'POST');
export const borrarMedicamento = (id: number) => enviar<Medicamento>(`/medication/${id}`, 'DELETE');

export const listarConfigPA = () => api<ConfigPA[]>('/blood-pressure-config');
export const obtenerConfigPA = (id: number) => api<ConfigPA | null>(`/blood-pressure-config/${id}`);
export const crearConfigPA = (d: Omit<ConfigPA, 'id'>) => enviar<ConfigPA>('/blood-pressure-config', 'POST', d);
export const editarConfigPA = (id: number, d: Partial<Omit<ConfigPA, 'id'>>) =>
  enviar<ConfigPA>(`/blood-pressure-config/${id}`, 'PATCH', d);
export const borrarConfigPA = (id: number) => enviar<ConfigPA>(`/blood-pressure-config/${id}`, 'DELETE');

/* Usuarios y roles */
export type DatosUsuario = Pick<Usuario, 'email' | 'firstName' | 'lastName' | 'isActive'> & { roleId: number; password?: string };
export const listarUsuarios = () => api<Paginado<Usuario>>('/users?limit=200');
export const obtenerUsuario = (id: number) => api<Usuario | null>(`/users/${id}`);
export const crearUsuario = (d: DatosUsuario) => enviar<Usuario>('/users', 'POST', d);
export const editarUsuario = (id: number, d: Partial<DatosUsuario>) => enviar<Usuario>(`/users/${id}`, 'PATCH', d);
export const borrarUsuario = (id: number) =>
  enviar<Usuario & { visitasReasignadas: number; reasignadasA: { id: number; firstName: string; lastName: string } }>(`/users/${id}`, 'DELETE');
export const subirFotoUsuario = (id: number, archivo: File) => {
  const fd = new FormData();
  fd.append('file', archivo);
  return enviar<Usuario>(`/users/${id}/photo`, 'POST', fd);
};

export type DatosRol = Pick<Rol, 'name' | 'permissions'> & { description?: string };
export const listarRoles = () => api<Rol[]>('/roles');
export const obtenerRol = (id: number) => api<Rol>(`/roles/${id}`);
export const catalogoPermisos = () => api<GrupoPermisos[]>('/roles/permisos');
export const crearRol = (d: DatosRol) => enviar<Rol>('/roles', 'POST', d);
export const editarRol = (id: number, d: Partial<DatosRol>) => enviar<Rol>(`/roles/${id}`, 'PATCH', d);
export const borrarRol = (id: number) => enviar<Rol>(`/roles/${id}`, 'DELETE');

/* Estadísticas, reportes y auditoría */
export const estadisticasPanel = (batey?: number) => api<EstadisticasPanel>(`/stats${batey ? `?batey=${batey}` : ''}`);
export const miPanel = () => api<MiPanel>('/stats/mio');
export const estadisticasAvanzadas = () => api<EstadisticasAvanzadas>('/stats/advanced');
export const tendenciaPanel = (batey?: number) => api<TendenciaPanel>(`/stats/trend${batey ? `?batey=${batey}` : ''}`);
export const estadisticasRonda = (batey?: number) => api<EstadisticasRonda>(`/stats/round${batey ? `?batey=${batey}` : ''}`);
export const pacientesAltoRiesgo = () => api<PacienteAltoRiesgo[]>('/stats/high-risk');
export const visitasRecientes = () => api<VisitaReciente[]>('/stats/recent-visits');
export const resumenReporte = (f: FiltroReporte) => api<ResumenReporte>(`/reports/summary${query(f)}`);
export const listarMedicos = (f: FiltroReporte, eliminados = false) => api<ListaMedicos>(`/doctors${query({ ...f, eliminados: eliminados ? 'true' : undefined })}`);
export const detalleMedico = (id: number, f: FiltroReporte) => api<DetalleMedico>(`/doctors/${id}${query(f)}`);
export const compararMedicos = (ids: number[], f: FiltroReporte) => api<ComparacionMedicos>(`/doctors/compare${query({ ...f, ids: ids.join(',') })}`);
export const restaurarRegistro = (id: number) => enviar<{ visitaId: number; pacienteId: number }>(`/audit-logs/${id}/restaurar`, 'POST');
export type FiltroAuditoria = { page: number; userId?: number; entity?: string; action?: string; desde?: string; hasta?: string; entityId?: number };
export const listarAuditoria = (f: FiltroAuditoria) => api<Paginado<RegistroAuditoria>>(`/audit-logs${query({ ...f, limit: 50 })}`);
export const filtrosAuditoria = () => api<FiltrosAuditoria>('/audit-logs/filtros');

/* Revisión de datos */
export const casosRevision = (f: { tipo?: TipoCaso; descartados?: boolean }) => api<RevisionCasos>(`/revision${query({ tipo: f.tipo, descartados: f.descartados ? "true" : undefined })}`);
export const revisionPaciente = (id: number) => api<RevisionPaciente>(`/revision/pacientes/${id}`);
export const unirPacientes = (conservarId: number, eliminarId: number) =>
  enviar<{ conservado: { id: number; codigo: string }; eliminado: { patientCode: string }; visitas: number[] }>('/revision/unir', 'POST', { conservarId, eliminarId });
export type DatosSeparar = {
  visitIds: number[];
  firstName: string;
  lastName: string;
  gender: Genero;
  birthDate: string;
  birthDateIsEstimated: boolean;
  communityId: number;
  address?: string;
};
export const separarPaciente = (id: number, d: DatosSeparar) => enviar<{ nuevo: { id: number; codigo: string; nombre: string } }>(`/revision/pacientes/${id}/separar`, 'POST', d);
export type DatosCorregir = { clave: string; firstName?: string; lastName?: string; gender?: Genero; birthDate?: string; birthDateIsEstimated?: boolean };
export const corregirPaciente = (id: number, d: DatosCorregir) => enviar<Paciente>(`/revision/pacientes/${id}/corregir`, 'POST', d);
export const decidirCaso = (d: { clave: string; estado: 'RESUELTO' | 'DESCARTADO'; nota?: string }) => enviar<unknown>('/revision/decisiones', 'POST', d);
export const reabrirCaso = (id: number) => enviar<unknown>(`/revision/decisiones/${id}`, 'DELETE');

/* Bajas */
export const darDeBaja = (id: number, d: { motivo: MotivoBaja; fecha: string; detalle?: string }) => enviar<Paciente>(`/patients/${id}/baja`, 'POST', d);
export const reactivarPaciente = (id: number) => enviar<Paciente>(`/patients/${id}/reactivar`, 'POST');

/* Metas, donantes, mapa */
export const metasAnio = (anio: number) => api<MetasAnio>(`/metas/${anio}`);
export const guardarMetas = (anio: number, valores: Partial<Record<ClaveIndicador, number | null>>) => enviar<MetasAnio>(`/metas/${anio}`, 'PUT', { valores });
/** trimestre null = año completo */
export const reporteDonantes = (anio: number, trimestre: number | null) => api<ReporteDonantes>(`/reports/donantes?anio=${anio}${trimestre ? `&trimestre=${trimestre}` : ''}`);
export const descargarPdfDonantes = (anio: number, trimestre: number | null) =>
  descargar(`/reports/donantes/pdf?anio=${anio}${trimestre ? `&trimestre=${trimestre}` : ''}`, `informe-light-a-candle_${trimestre ? `${anio}-T${trimestre}` : anio}.pdf`);
export const guardarTextoDonantes = (anio: number, trimestre: number | null, texto: string) =>
  enviar<{ texto: string }>('/reports/donantes/texto', 'PUT', { anio, trimestre, texto });
export const indicadoresBateyes = () => api<IndicadorBatey[]>('/reports/bateyes');
