/** Lo que devuelve la API: fechas ISO y los Decimal de Prisma como texto. */

export type CategoriaPA = 'NORMAL' | 'ELEVATED' | 'GRADE_1' | 'GRADE_2' | 'CRISIS';
export type Genero = 'MALE' | 'FEMALE' | 'OTHER';
export type EstadoPaciente = 'ACTIVE' | 'INACTIVE' | 'DECEASED';
export type ConsumoSal = 'YES' | 'NO' | 'REDUCED';
export type ConsumoAlcohol = 'NO' | 'OCCASIONAL' | 'FREQUENT';
export type Tabaquismo = 'NO' | 'EX_SMOKER' | 'ACTIVE';
export type TipoVisita = 'NEW' | 'FOLLOW_UP';

type Decimal = string | number;

export type Paginado<T> = {
  data: T[];
  meta: { total: number; page: number; limit: number; lastPage: number };
};

export type Rol = {
  id: number;
  name: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
  _count?: { users: number };
};

export type GrupoPermisos = { grupo: string; permisos: { clave: string; nombre: string }[] };

export type Usuario = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: Pick<Rol, 'id' | 'name' | 'permissions' | 'isSystem'>;
  photoUrl?: string | null;
  isActive: boolean;
  createdAt: string;
};

export type Comunidad = {
  id: number;
  name: string;
  abbreviation: string;
  municipality: string;
  province: string;
  sequenceCounter: number;
  isActive: boolean;
  latitud?: number | null;
  longitud?: number | null;
};

export type ConfigPA = {
  id: number;
  categoryName: CategoriaPA;
  systolicMin: number;
  systolicMax: number;
  diastolicMin: number;
  diastolicMax: number;
  priority: number;
  colorHex: string;
};

export type Medicamento = {
  id: number;
  name: string;
  concentration: string;
  currentStock: number;
  stockMinimo: number;
  activo: boolean;
  /** Solo en el listado: existencia sin vencer, vencida y próximo vencimiento */
  vigente?: number;
  vencido?: number;
  proximoVencimiento?: string | null;
  lotesActivos?: number;
};

export type OrigenLote = 'DONACION' | 'COMPRA' | 'INICIAL' | 'AJUSTE';

export type Lote = {
  id: number;
  medicationId: number;
  numero: string | null;
  vencimiento: string | null;
  cantidadInicial: number;
  cantidadActual: number;
  origen: OrigenLote;
  procedencia: string | null;
  nota: string | null;
  fechaEntrada: string;
  creadoPor: string | null;
  medication?: { name: string; concentration: string };
};

export type MovimientoInventario = {
  id: number;
  tipo: 'ENTRADA' | 'SALIDA_VISITA' | 'DEVOLUCION' | 'AJUSTE' | 'VENCIDO';
  cantidad: number;
  saldo: number;
  motivo: string | null;
  visitId: number | null;
  userName: string | null;
  createdAt: string;
  lote: { numero: string | null; vencimiento: string | null } | null;
};

export type AlertasInventario = {
  vencidos: Lote[];
  porVencer: Lote[];
  bajoMinimo: Medicamento[];
  diasAviso: number;
};

export type EstadoJornada = 'PLANIFICADA' | 'CERRADA' | 'CANCELADA';

export type Jornada = {
  id: number;
  communityId: number;
  fecha: string;
  responsableId: number | null;
  estado: EstadoJornada;
  notas: string | null;
  resumen: ResumenJornada | null;
  cerradaEn: string | null;
  cerradaPor: string | null;
  creadaPor: string | null;
  community: { id: number; name: string; abbreviation: string };
  responsable: { id: number; firstName: string; lastName: string } | null;
};

export type ResumenJornada = {
  activos: number;
  esperados: number;
  atendidos: number;
  atendidosEsperados: number;
  faltan: number;
  controlados: number;
  nuevos: number;
  entregadas?: { medicamento: string; pastillas: number }[];
  faltantes?: { id: number; codigo: string; nombre: string }[];
};

export type DetalleJornada = {
  jornada: Jornada;
  totales: ResumenJornada;
  llevar: { medicationId: number; medicamento: string; pacientes: number; pastillas: number; disponible: number; falta: number }[];
  entregadas: { medicamento: string; pastillas: number }[];
  pacientes: {
    id: number;
    patientCode: string;
    firstName: string;
    lastName: string;
    address: string | null;
    phoneNumber: string | null;
    birthDate: string;
    birthDateIsEstimated: boolean;
    atendidoHoy: boolean;
    esperado: boolean;
    ultimaVisita: string | null;
    presion: string | null;
    categoria: ConfigPA | null;
    atendio: string | null;
  }[];
};

export type SugerenciaJornada = {
  communityId: number;
  batey: string;
  pacientes: number;
  ultimaVisita: string | null;
  proxima: Jornada | null;
  sugerida: string;
  atrasada: boolean;
};

export type Receta = {
  id: number;
  visitId: number;
  medicationId: number;
  dailyDose: number;
  daysUntilNextVisit: number;
  bufferDays: number;
  patientSupplyRemaining: number;
  totalRequired: number;
  quantityDispensed: number;
  /** null en la primera receta de ese medicamento: no hay con qué comparar. */
  adherencePercentage: Decimal | null;
  medication?: Medicamento;
};

export type Visita = {
  id: number;
  patientId: number;
  doctorId: number;
  /** Quién atendió, guardado al registrar (no cambia si la cuenta se renombra o elimina). */
  doctorNombre: string | null;
  /** Cuenta original si fue eliminada y la visita se reasignó al administrador. */
  originalDoctorId: number | null;
  /** Cuándo se registró en el sistema (el plazo de corrección se cuenta desde aquí). */
  createdAt?: string;
  updatedAt?: string | null;
  importada?: boolean;
  visitDate: string;
  visitType: TipoVisita;
  isHomeVisit: boolean;
  nextVisitDate: string | null;
  // Pueden faltar en visitas históricas importadas del Excel.
  weightKg: Decimal | null;
  heightM: Decimal | null;
  bmi: Decimal | null;
  systolicManual: number | null;
  diastolicManual: number | null;
  systolicAuto: number | null;
  diastolicAuto: number | null;
  heartRate: number | null;
  oxygenSaturation: number | null;
  temperature: Decimal | null;
  reason: string | null;
  notes: string | null;
  prescriptionText: string | null;
  bpClassificationId: number | null;
  bpClassification?: ConfigPA | null;
  prescriptions?: Receta[];
  patient?: Paciente;
  doctor?: Usuario;
};

export type Paciente = {
  id: number;
  patientCode: string;
  communityId: number;
  nationalId: string | null;
  firstName: string;
  lastName: string;
  gender: Genero;
  photoUrl: string | null;
  birthDate: string;
  birthDateIsEstimated: boolean;
  phoneNumber: string | null;
  address: string | null;
  hasFamilyHistory: boolean;
  registrationDate: string;
  status: EstadoPaciente;
  saltIntake: ConsumoSal;
  alcoholIntake: ConsumoAlcohol;
  smokingStatus: Tabaquismo;
  community?: Comunidad;
  clinicalVisits?: Visita[];
  // Resumen de la última visita (para listar y filtrar)
  lastVisitDate?: string | null;
  lastSystolic?: number | null;
  lastDiastolic?: number | null;
  lastBpClassificationId?: number | null;
  lastBpClassification?: ConfigPA | null;
  nextVisitDate?: string | null;
  /** Último que lo atendió (la cuenta original si se eliminó) */
  lastDoctorId?: number | null;
  lastDoctorNombre?: string | null;
  /** Baja del programa */
  fechaBaja?: string | null;
  motivoBaja?: MotivoBaja | null;
  detalleBaja?: string | null;
  bajaRegistradaPor?: string | null;
  consentimientoDatos?: boolean;
  consentimientoFecha?: string | null;
  consentimientoRegistradoPor?: string | null;
};

export type PuntoTension = { date: string; systolic: number | null; diastolic: number | null };

export type AnaliticaPaciente =
  | { totalVisits: 0; message: string }
  | {
      totalVisits: number;
      lastVisitDate: string;
      bpStats: {
        systolic: { min: number; max: number; avg: number };
        diastolic: { min: number; max: number; avg: number };
      };
      weightTrend: { date: string; weight: Decimal; bmi: Decimal }[];
    };

export type EstadisticasPanel = {
  lowStockMedications: Medicamento[];
  bpControl: {
    totalAnalyzed: number;
    controlledCount: number;
    uncontrolledCount: number;
    controlledPercentage: number;
  };
  visits: { thisMonth: number };
  patientGrowth: { totalActive: number; newThisMonth: number };
};

export type EstadisticasAvanzadas = {
  genderStats: { gender: Genero; _count: { id: number } }[];
  ageGroups: Record<string, number>;
  riskPyramid: Record<string, number>;
};

export type PacienteAltoRiesgo = {
  id: number;
  firstName: string;
  lastName: string;
  latestVisit: Visita & { bpClassification: ConfigPA };
};

export type VisitaReciente = Visita & {
  patient: { firstName: string; lastName: string; photoUrl: string | null };
  doctor: { firstName: string; lastName: string };
};

export type RegistroAuditoria = {
  id: number;
  action: string;
  entity: string;
  entityId: number;
  userId: number | null;
  actorName: string | null;
  details: string | null;
  timestamp: string;
  user: { firstName: string; lastName: string; email: string } | null;
  revertidoEn: string | null;
  revertidoPor: string | null;
};

export type TendenciaPanel = {
  trimestres: {
    trimestre: string;
    visitas: number;
    pacientes: number;
    controladosPct: number | null;
    sistolicaPromedio: number | null;
    diastolicaPromedio: number | null;
    cumplimientoPromedio: number | null;
  }[];
  hoy: { categoria: CategoriaPA | null; configId: number | null; pacientes: number }[];
};

export type EstadisticasRonda = {
  round: { label: string; start: string; end: string };
  /** pending = pendientes de la ronda (vinieron hace menos de 6 meses); absent = no asisten hace más de 6 meses (absentYear: más de un año) */
  totals: { active: number; seen: number; pending: number; absent: number; absentYear: number; neverSeen: number };
  byCommunity: { communityId: number; name: string; active: number; seen: number; pending: number; absent: number; absentYear: number; neverSeen: number; lastVisit: string | null }[];
  /** Pendientes de la ronda cuya última toma fue grado 2 o crisis */
  priority: { total: number; lista: { id: number; patientCode: string; firstName: string; lastName: string; address: string | null; communityId: number; presion: string; categoria: CategoriaPA; lastVisitDate: string }[] };
  absentPatients: {
    id: number;
    patientCode: string;
    firstName: string;
    lastName: string;
    phoneNumber: string | null;
    address: string | null;
    communityId: number;
    lastVisitDate: string;
  }[];
};

/** Paciente de la lista de jornada: trae solo su última visita. */
export type PacienteJornada = Paciente & { clinicalVisits: (Visita & { bpClassification: ConfigPA })[] };

type Indicadores = {
  visitas: number;
  pacientes: number;
  controladosPct: number | null;
  sistolicaPromedio: number | null;
  diastolicaPromedio: number | null;
  cumplimientoPromedio: number | null;
  pastillas: number;
};

export type FiltroReporte = { from?: string; to?: string; communityId?: number; gender?: Genero; ageMin?: number; ageMax?: number };

export type ResumenReporte = {
  periodo: { desde: string; hasta: string };
  resumen: Indicadores & { nuevos: number; domiciliarias: number };
  porTrimestre: (Indicadores & { clave: string; trimestre: string; nuevos: number })[];
  categorias: { categoria: CategoriaPA; pacientes: number }[];
  porBatey: (Indicadores & { communityId: number; batey: string; pastillasPorMed: Record<string, number> })[];
  medicamentos: { medicamento: string; recetas: number; pacientes: number; pastillas: number; cumplimientoPromedio: number | null }[];
  medicamentosNombres: string[];
  pastillasPorTrimestre: Record<string, string | number>[];
  cumplimientoTramos: { tramo: string; recetas: number }[];
  demografia: {
    total: number;
    genero: Partial<Record<Genero, number>>;
    edad: { grupo: string; pacientes: number }[];
    habitos: { habito: string; pacientes: number }[];
  };
  noControlados: {
    id: number;
    codigo: string;
    nombre: string;
    batey: string;
    presion: string;
    categoria: CategoriaPA;
    fecha: string;
    telefono: string | null;
  }[];
};

export type LogrosMedico = {
  llevoAControl: number;
  mejoraron: number;
  nuevos: number;
  domiciliarias: number;
  jornadas: number;
  bateyes: number;
  primera: string | null;
  ultima: string | null;
};

export type PerfilMedico = {
  id: number;
  nombre: string;
  photoUrl: string | null;
  rol: string | null;
  estado: 'Activo' | 'Inactivo' | 'Eliminado';
  email: string | null;
};

type IndicadoresMedico = {
  visitas: number;
  pacientes: number;
  controladosPct: number | null;
  sistolicaPromedio: number | null;
  diastolicaPromedio: number | null;
  cumplimientoPromedio: number | null;
  pastillas: number;
};

export type FilaMedico = PerfilMedico & IndicadoresMedico & { logros: LogrosMedico };

export type ListaMedicos = { periodo: { desde: string; hasta: string }; medicos: FilaMedico[] };

export type DetalleMedico = Pick<ResumenReporte, 'periodo' | 'resumen' | 'porTrimestre' | 'categorias' | 'porBatey' | 'medicamentos' | 'cumplimientoTramos'> & {
  perfil: PerfilMedico;
  logros: LogrosMedico;
  jornadas: { fecha: string; batey: string; pacientes: number; controlados: number }[];
};

export type ComparacionMedicos = {
  periodo: { desde: string; hasta: string };
  medicos: (FilaMedico & Pick<ResumenReporte, 'porTrimestre' | 'categorias'>)[];
};

/* Revisión de datos */
export type TipoCaso = 'COMPARTIDO' | 'VARIANTES' | 'SIN_EDAD' | 'MISMO_DIA' | 'DUPLICADO';

export type GrupoPersona = {
  nombre: string;
  variantes: { nombre: string; visitas: number }[];
  visitas: number;
  sexo: Genero | null;
  nacimiento: [number, number] | null;
  desde: string;
  hasta: string;
};

export type CasoRevision = {
  clave: string;
  tipo: TipoCaso;
  pacientes: { id: number; codigo: string; nombre: string; batey: string; sexo: Genero; nacimiento: string; estimado: boolean; visitas: number }[];
  resumen: string;
  grupos?: GrupoPersona[];
  variantes?: { nombre: string; visitas: number }[];
  fecha?: string;
  visitas?: { id: number; presion: string; peso: number | null; atendio: string | null }[];
  motivos?: string[];
  decision: { id: number; estado: 'RESUELTO' | 'DESCARTADO'; nota: string | null; userName: string | null; createdAt: string } | null;
};

export type RevisionCasos = { totales: Partial<Record<TipoCaso, number>>; decididos: number; casos: CasoRevision[] };

export type OrigenVisita = { fila?: number; nombre?: string; apellido?: string; sexo?: Genero | null; edad?: string | null; casa?: string | null };

export type RevisionPaciente = {
  paciente: Paciente & { community: { id: number; name: string } };
  grupos: (GrupoPersona & { ids: number[] })[];
  visitas: {
    id: number;
    visitDate: string;
    systolicManual: number | null;
    diastolicManual: number | null;
    systolicAuto: number | null;
    diastolicAuto: number | null;
    weightKg: string | null;
    doctorNombre: string | null;
    origen: OrigenVisita | null;
    bpClassification: ConfigPA | null;
    prescriptions: { quantityDispensed: number; medication: { name: string; concentration: string } }[];
    grupo: number;
  }[];
};

export type MotivoBaja = 'FALLECIDO' | 'MUDANZA' | 'ABANDONO' | 'TRASLADO' | 'OTRO';

/* Metas e indicadores */
export type ClaveIndicador = 'controlados_pct' | 'cobertura_pct' | 'cumplimiento_pct' | 'riesgo_pct' | 'pacientes_atendidos' | 'pacientes_nuevos' | 'visitas' | 'dias_jornada';
export type EstadoMeta = 'sin-meta' | 'cumplida' | 'en-camino' | 'atrasada' | 'sin-datos';
export type IndicadorAnual = {
  clave: ClaveIndicador;
  nombre: string;
  descripcion: string;
  unidad: string;
  tipo: 'pct' | 'conteo';
  mayorEsMejor: boolean;
  meta: number | null;
  metaActualizada: { fecha: string; por: string | null } | null;
  valor: number | null;
  anterior: number | null;
  metaAnterior: number | null;
  trimestres: { etiqueta: string; valor: number | null }[];
  estado: EstadoMeta;
};
export type MetasAnio = { anio: number; fraccionAnio: number; indicadores: IndicadorAnual[]; bajas: Partial<Record<MotivoBaja, number>> };

export type ValoresIndicadores = Record<ClaveIndicador, number | null>;
export type ReporteDonantes = {
  periodo: { anio: number; trimestre: number | null; anual: boolean; etiqueta: string; desde: string; hasta: string; enCurso: boolean };
  actual: ValoresIndicadores;
  previo: ValoresIndicadores & { etiqueta: string };
  mismoAnterior: ValoresIndicadores & { etiqueta: string };
  evolucion: { etiqueta: string; controlados: number | null; pacientes: number | null; visitas: number | null }[];
  categorias: { categoria: CategoriaPA; pacientes: number }[];
  porBatey: { batey: string; pacientes: number; visitas: number; controladosPct: number | null; pastillas: number; pastillasPorMed: Record<string, number> }[];
  medicamentosNombres: string[];
  medicamentos: { medicamento: string; pastillas: number; pacientes: number }[];
  pastillasTotal: number;
  demografia: { mujeres: number; hombres: number; mayores60: number; edadPromedio: number | null };
  metas: { clave: ClaveIndicador; nombre: string; tipo: 'pct' | 'conteo'; mayorEsMejor: boolean; meta: number; valor: number | null }[];
  casos: { iniciales: string; sexo: string; edad: number; batey: string; antes: string; fechaAntes: string; ahora: string; fechaAhora: string; visitas: number }[];
  bajas: Partial<Record<MotivoBaja, number>>;
  texto: string;
};

export type IndicadorBatey = {
  id: number;
  nombre: string;
  prefijo: string;
  activo: boolean;
  latitud: number | null;
  longitud: number | null;
  pacientes: number;
  vistosRondaPct: number | null;
  /** No asisten hace más de 6 meses */
  sinVenir: number;
  controladosPct: number | null;
  riesgoPct: number | null;
  sistolica: number | null;
  diastolica: number | null;
  ultimaVisita: string | null;
  proximaJornada: string | null;
};

/** Panel del médico que consulta */
export type MiPanel = {
  pacientes: number;
  controladosPct: number | null;
  leToca: number;
  /** No asisten hace más de 6 meses */
  sinVenir: {
    total: number;
    lista: {
      id: number;
      patientCode: string;
      firstName: string;
      lastName: string;
      address: string | null;
      phoneNumber: string | null;
      nextVisitDate: string | null;
      lastVisitDate: string | null;
      lastSystolic: number | null;
      lastDiastolic: number | null;
      lastBpClassification: ConfigPA | null;
      community: { id: number; name: string };
    }[];
  };
  hoy: {
    id: number;
    visitDate: string;
    systolicManual: number | null;
    diastolicManual: number | null;
    systolicAuto: number | null;
    diastolicAuto: number | null;
    bpClassification: ConfigPA | null;
    patient: { id: number; patientCode: string; firstName: string; lastName: string; community: { name: string } };
  }[];
  visitasMes: number;
  jornadasHoy: (Jornada & { soyResponsable: boolean })[];
  proximaJornada: (Jornada & { community: { id: number; name: string } }) | null;
};

export type FiltrosAuditoria = { actores: { userId: number; nombre: string }[]; entidades: string[]; acciones: string[] };
