import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { FiltroReporte, TipoCaso } from './tipos';
import * as r from './recursos';

/* Los catálogos cambian poco: se comparten entre pantallas sin volver a pedirlos a cada rato. */
const CATALOGO = { staleTime: 5 * 60_000 };

export const useComunidades = () => useQuery({ queryKey: ['comunidades'], queryFn: r.listarComunidades, ...CATALOGO });
export const useComunidad = (id: number | undefined) =>
  useQuery({ queryKey: ['comunidades', id], queryFn: () => r.obtenerComunidad(id!), enabled: !!id });
export const useMedicamentos = () => useQuery({ queryKey: ['medicamentos'], queryFn: r.listarMedicamentos });
export const useMedicamento = (id: number | undefined) =>
  useQuery({ queryKey: ['medicamentos', id], queryFn: () => r.obtenerMedicamento(id!), enabled: !!id });
export const useAlertasInventario = () => useQuery({ queryKey: ['medicamentos', 'alertas'], queryFn: r.alertasInventario });
export const useMovimientos = (id: number, page: number) =>
  useQuery({ queryKey: ['medicamentos', id, 'movimientos', page], queryFn: () => r.movimientosMedicamento(id, page), placeholderData: keepPreviousData });
export const useJornadas = (f: { desde?: string; hasta?: string; communityId?: number; estado?: string }) =>
  useQuery({ queryKey: ['jornadas', f], queryFn: () => r.listarJornadas(f), placeholderData: keepPreviousData });
export const useSugerenciasJornadas = () => useQuery({ queryKey: ['jornadas', 'sugerencias'], queryFn: r.sugerenciasJornadas });
export const useResponsables = () => useQuery({ queryKey: ['jornadas', 'responsables'], queryFn: r.responsablesJornada, staleTime: 5 * 60_000 });
export const useDetalleJornada = (id: number | undefined) =>
  useQuery({ queryKey: ['jornadas', 'detalle', id], queryFn: () => r.detalleJornada(id!), enabled: !!id });
export const useConfigPA = () => useQuery({ queryKey: ['config-pa'], queryFn: r.listarConfigPA, ...CATALOGO });
export const useConfigPAUna = (id: number | undefined) =>
  useQuery({ queryKey: ['config-pa', id], queryFn: () => r.obtenerConfigPA(id!), enabled: !!id });

export const useUsuarios = () => useQuery({ queryKey: ['usuarios'], queryFn: r.listarUsuarios });
export const useUsuario = (id: number | undefined) =>
  useQuery({ queryKey: ['usuarios', id], queryFn: () => r.obtenerUsuario(id!), enabled: !!id });
export const useRoles = () => useQuery({ queryKey: ['roles'], queryFn: r.listarRoles });
export const useRol = (id: number | undefined) => useQuery({ queryKey: ['roles', id], queryFn: () => r.obtenerRol(id!), enabled: !!id });
export const useCatalogoPermisos = () => useQuery({ queryKey: ['permisos'], queryFn: r.catalogoPermisos, staleTime: Infinity });

export const usePacientes = (f: r.FiltroPacientes) =>
  useQuery({ queryKey: ['pacientes', f], queryFn: () => r.listarPacientes(f), placeholderData: keepPreviousData });
export const usePaciente = (id: number | undefined) =>
  useQuery({ queryKey: ['paciente', id], queryFn: () => r.obtenerPaciente(id!), enabled: !!id });
export const useUltimosMedicos = () => useQuery({ queryKey: ['pacientes', 'medicos'], queryFn: () => r.ultimosMedicos(), staleTime: 5 * 60_000 });
export const useTensionPaciente = (id: number) =>
  useQuery({ queryKey: ['paciente', id, 'tension'], queryFn: () => r.tensionPaciente(id) });
export const useAnaliticaPaciente = (id: number) =>
  useQuery({ queryKey: ['paciente', id, 'analitica'], queryFn: () => r.analiticaPaciente(id) });

export const useVisitas = (f: r.FiltroVisitas) =>
  useQuery({ queryKey: ['visitas', f], queryFn: () => r.listarVisitas(f), placeholderData: keepPreviousData });
export const useVisita = (id: number) => useQuery({ queryKey: ['visitas', 'una', id], queryFn: () => r.obtenerVisita(id) });
export const useConfiguracion = (activo = true) => useQuery({ queryKey: ['configuracion'], queryFn: r.leerConfiguracion, staleTime: 5 * 60_000, enabled: activo });
export const useQuienesAtienden = () => useQuery({ queryKey: ['visitas', 'atienden'], queryFn: r.listarQuienesAtienden, ...CATALOGO });

export const useEstadisticasPanel = (batey?: number) => useQuery({ queryKey: ['stats', 'panel', batey], queryFn: () => r.estadisticasPanel(batey), placeholderData: keepPreviousData });
export const useMiPanel = (activo = true) => useQuery({ queryKey: ['stats', 'mio'], queryFn: r.miPanel, enabled: activo });
export const useEstadisticasAvanzadas = () => useQuery({ queryKey: ['stats', 'avanzadas'], queryFn: r.estadisticasAvanzadas });
export const useAltoRiesgo = () => useQuery({ queryKey: ['stats', 'alto-riesgo'], queryFn: r.pacientesAltoRiesgo });
export const useVisitasRecientes = () => useQuery({ queryKey: ['stats', 'recientes'], queryFn: r.visitasRecientes });
export const useTendencia = (batey?: number) => useQuery({ queryKey: ['stats', 'tendencia', batey], queryFn: () => r.tendenciaPanel(batey), placeholderData: keepPreviousData });
export const useRonda = (batey?: number) => useQuery({ queryKey: ['stats', 'ronda', batey], queryFn: () => r.estadisticasRonda(batey), placeholderData: keepPreviousData });
export const useJornada = (comunidad: number | undefined) =>
  useQuery({ queryKey: ['jornada', comunidad], queryFn: () => r.pacientesJornada(comunidad!), enabled: !!comunidad });
export const useResumenReporte = (f: FiltroReporte) =>
  useQuery({ queryKey: ['reportes', f], queryFn: () => r.resumenReporte(f), placeholderData: keepPreviousData });
export const useMedicos = (f: FiltroReporte, eliminados = false) =>
  useQuery({ queryKey: ['medicos', f, eliminados], queryFn: () => r.listarMedicos(f, eliminados), placeholderData: keepPreviousData });
export const useMedico = (id: number, f: FiltroReporte) =>
  useQuery({ queryKey: ['medicos', id, f], queryFn: () => r.detalleMedico(id, f), placeholderData: keepPreviousData });
export const useComparacion = (ids: number[], f: FiltroReporte) =>
  useQuery({ queryKey: ['medicos', 'comparar', ids, f], queryFn: () => r.compararMedicos(ids, f), enabled: ids.length >= 2, placeholderData: keepPreviousData });
export const useAuditoria = (f: r.FiltroAuditoria) =>
  useQuery({ queryKey: ['auditoria', f], queryFn: () => r.listarAuditoria(f), placeholderData: keepPreviousData });
export const useFiltrosAuditoria = () => useQuery({ queryKey: ['auditoria', 'filtros'], queryFn: r.filtrosAuditoria, staleTime: 60_000 });

export const useCasosRevision = (f: { tipo?: TipoCaso; descartados?: boolean }) =>
  useQuery({ queryKey: ['revision', f], queryFn: () => r.casosRevision(f), placeholderData: keepPreviousData });
export const useRevisionPaciente = (id: number) => useQuery({ queryKey: ['revision', 'paciente', id], queryFn: () => r.revisionPaciente(id) });

export const useMetas = (anio: number) => useQuery({ queryKey: ['metas', anio], queryFn: () => r.metasAnio(anio), placeholderData: keepPreviousData });
export const useReporteDonantes = (anio: number, trimestre: number | null) =>
  useQuery({ queryKey: ['donantes', anio, trimestre], queryFn: () => r.reporteDonantes(anio, trimestre), placeholderData: keepPreviousData });
export const useIndicadoresBateyes = () => useQuery({ queryKey: ['bateyes-indicadores'], queryFn: r.indicadoresBateyes });
