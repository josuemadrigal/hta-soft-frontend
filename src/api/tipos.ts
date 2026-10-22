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
  /** Para entrar sin el correo (p. ej. "ana.martinez"). */
  usuario?: string | null;
  /** Cuándo confirmó su correo (null: sin confirmar). */
  emailVerificadoEn?: string | null;
  /** Bloqueado por intentos fallidos hasta esta hora (null o pasada: puede entrar). */
  bloqueadoHasta?: string | null;
  /** Última vez que inició sesión. */
  ultimoAcceso?: string | null;
  /** Última vez que usó la app (cada minuto como mucho): "en línea" si fue hace menos de 5 minutos. */
  ultimaActividad?: string | null;
  contrasenaCambiadaEn?: string | null;
};

export type DestinatarioResumen = { id: number; nombre: string; email: string; rol: string; confirmado: boolean };
export type ResultadoCorreo = { enviados?: number; simulado: boolean; email?: string; para?: string[] };

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
  tipo: 'ENTRADA' | 'SALIDA_VISITA' | 'SALIDA_REPOSICION' | 'DEVOLUCION' | 'AJUSTE' | 'VENCIDO';
  cantidad: number;
  saldo: number;
  motivo: string | null;
  visitId: number | null;
  userName: string | null;
  createdAt: string;
  lote: { numero: string | null; vencimiento: string | null } | null;
  /** A quién se le dio (o de quién volvió). */
  patient: { id: number; firstName: string; lastName: string; patientCode: string; community: { name: string } | null } | null;
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
  /** De los que faltan, cuántos se marcaron "No vino" */
  noVinieron?: number;
  controlados: number;
  nuevos: number;
  entregadas?: { medicamento: string; pastillas: number }[];
  faltantes?: { id: number; codigo: string; nombre: string; motivo?: MotivoInasistencia | null }[];
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
    noVino: MotivoInasistencia | null;
    tratamientoDejado?: { con: string | null; parentesco: Parentesco | null } | null;
    ultimaVisita: string | null;
    presion: string | null;
    categoria: ConfigPA | null;
    /** Si atendidoHoy, quién lo atendió ese día; si no, quién lo vio la última vez. */
    atendio: string | null;
    pastillasHoy?: number;
    nuevo?: boolean;
  }[];
  /** Por médico, ese día: a cuántos vio, pastillas entregadas y cuántos quedaron controlados. */
  porMedico?: { medico: string; pacientes: number; pastillas: number; conToma: number; controlados: number; nuevos: number }[];
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
  /** Lo que le corresponde (dosis × días + margen − le quedan). */
  cantidadIndicada?: number;
  /** Lo entregado hasta ahora. Si es menos que cantidadIndicada, el resto está pendiente. */
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
  /** En la lista de pacientes: cuántas visitas tiene. */
  _count?: { clinicalVisits: number };
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
  inasistencias?: Inasistencia[];
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
  /**
   * active = regulares; pending = regulares a los que les toca (vinieron hace menos de 6 meses); absent = regulares que no
   * asisten hace más de 6 meses (absentYear: más de un año); retired = ya no vienen (no son regulares);
   * expected = esperados en la ronda (media alta de las últimas jornadas; ver Configuración); missing = faltan para llegar a los esperados.
   */
  totals: { active: number; seen: number; pending: number; absent: number; absentYear: number; neverSeen: number; retired?: number; expected?: number; missing?: number };
  byCommunity: { communityId: number; name: string; active: number; seen: number; pending: number; absent: number; absentYear: number; neverSeen: number; retired?: number; expected?: number; missing?: number; lastVisit: string | null }[];
  visitasSinVenirRegular?: number;
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
/** visitasAnio: días (YYYY-MM-DD) en que vino este año, para filtrar los vistos por ronda. */
export type PacienteJornada = Paciente & { clinicalVisits: (Visita & { bpClassification: ConfigPA })[]; inasistencias: Inasistencia[]; visitasAnio?: string[] };

export type MotivoInasistencia = 'NO_ESTABA' | 'TRABAJANDO' | 'VIAJE' | 'ENFERMO' | 'NO_QUISO' | 'SE_MUDO' | 'OTRO';
/** "No vino" a la jornada de ese día */
export type Inasistencia = {
  id?: number;
  fecha: string;
  motivo: MotivoInasistencia;
  nota?: string | null;
  userName?: string | null;
  /** Si se le dejó el tratamiento con alguien */
  entrega?: TratamientoDejado | null;
};
export type Parentesco = 'HIJO' | 'PAREJA' | 'HERMANO' | 'PADRE' | 'VECINO' | 'OTRO';
export type TratamientoDejado = { recibioNombre: string | null; recibioParentesco: Parentesco | null; items?: { cantidad: number; medication?: { name: string; concentration: string } }[] };

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
  porTrimestre: (Indicadores & { clave: string; trimestre: string; nuevos: number; categorias?: Partial<Record<CategoriaPA, number>> })[];
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
  porBatey: { batey: string; pacientes: number; hombres: number; mujeres: number; edadPromedio: number | null; visitas: number; controladosPct: number | null; pastillas: number; pastillasPorMed: Record<string, number> }[];
  medicamentosNombres: string[];
  medicamentos: { medicamento: string; pastillas: number; pacientes: number }[];
  pastillasTotal: number;
  demografia: { mujeres: number; hombres: number; mayores60: number; edadPromedio: number | null };
  metas: { clave: ClaveIndicador; nombre: string; tipo: 'pct' | 'conteo'; mayorEsMejor: boolean; meta: number; valor: number | null }[];
  casos: { iniciales: string; sexo: string; edad: number; batey: string; antes: string; fechaAntes: string; ahora: string; fechaAhora: string; visitas: number }[];
  bajas: Partial<Record<MotivoBaja, number>>;
  analisis?: AnalisisDonantes;
  /** Historias buenas y malas, sin nombres: el texto va en partes para resaltar las presiones. */
  historias?: { tipo: 'mejoro' | 'constante' | 'volvio' | 'empeoro' | 'dejoDeVenir'; buena: boolean; etiqueta: string; pacienteId: number; partes: { t: string; color?: 'verde' | 'rojo'; fuerte?: boolean }[] }[];
  /** Qué hacer el próximo periodo, según los números de este (como mucho cinco, la más urgente primero). */
  estrategias?: { titulo: string; porque: string; acciones: string[] }[];
  planilla?: { filas: FilaPlanilla[]; total: FilaPlanilla };
  texto: string;
};

/** Grupos de pacientes con su % controlado (última toma del periodo). */
export type GrupoControl = { grupo: string; pacientes: number; controladosPct: number | null };
export type AnalisisDonantes = {
  tiempoEnPrograma: GrupoControl[];
  seguimiento: { pacientes: number; mejoraron: number; igual: number; empeoraron: number; controladosAntesPct: number | null; controladosAhoraPct: number | null; cambioSistolica: number | null };
  porEdad: GrupoControl[];
  porSexo: GrupoControl[];
  retencion: { anteriores: number; volvieron: number; pct: number | null };
  presionPromedio: { sistolica: number | null; diastolica: number | null; pacientes: number };
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
/** Una fila de la planilla de la jornada (la de papel): por batey, contando pacientes. */
export type FilaPlanilla = {
  communityId: number | null;
  batey: string;
  fechas: string[];
  evaluados: number;
  enPrograma: number;
  conToma: number;
  existentesConMedicamento: number;
  controlados: number;
  noControlados: number;
  datosDudosos: number;
  nuevos: number;
  nuevosConMedicamento: number;
};
export type Planilla = { periodo: { desde: string; hasta: string }; filas: FilaPlanilla[]; total: FilaPlanilla };

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
  /** Las visitas que registró en el periodo pedido (hasta 200) y el total. */
  periodo?: { desde: string; hasta: string };
  atendidos?: MiPanel['hoy'];
  atendidosTotal?: number;
  visitasMes: number;
  jornadasHoy: (Jornada & { soyResponsable: boolean })[];
  proximaJornada: (Jornada & { community: { id: number; name: string } }) | null;
};

export type FiltrosAuditoria = { actores: { userId: number; nombre: string }[]; entidades: string[]; acciones: string[] };

/* ─────────── Entregas de medicamentos ─────────── */

export type RecibioEntrega = 'PACIENTE' | 'FAMILIAR' | 'OTRO';
export type MotivoReposicion = 'FAMILIAR_RECOGE' | 'SE_LE_ACABARON' | 'SE_DEJO_CON_ALGUIEN' | 'DOMICILIO' | 'OTRO';
type MedicamentoCorto = { id?: number; name: string; concentration: string };

/** Una receta con pastillas por entregar. */
export type RecetaPendiente = {
  id: number;
  medicamento: MedicamentoCorto & { id: number };
  dosisDiaria?: number;
  indicada: number;
  entregada: number;
  pendiente: number;
  visitaId: number;
  visitaFecha: string;
  atendio?: string | null;
};

export type PacienteConPendientes = {
  paciente: { id: number; patientCode: string; firstName: string; lastName: string; address: string | null; photoUrl: string | null; communityId: number };
  recetas: RecetaPendiente[];
};

export type Entrega = {
  id: number;
  patientId: number;
  visitId: number | null;
  tipo: 'VISITA' | 'REPOSICION';
  fecha: string;
  entregadoPorNombre: string | null;
  recibio: RecibioEntrega;
  recibioNombre: string | null;
  recibioParentesco?: Parentesco | null;
  motivo: MotivoReposicion | null;
  nota: string | null;
  createdAt: string;
  items: { id: number; medicationId: number; prescriptionId: number | null; cantidad: number; medication?: MedicamentoCorto; devoluciones?: Devolucion[]; devolvible?: number }[];
  patient?: PacienteConPendientes['paciente'];
};

export type EntregasDelPaciente = {
  pendientes: RecetaPendiente[];
  entregas: Entrega[];
  /** Rondas seguidas recibiendo tratamiento sin consulta (alerta desde 2) */
  sinConsulta: number;
  reposicion: {
    permitida: boolean;
    motivo?: string;
    mesesMaximo: number;
    ultimaReceta: { medicationId: number; dailyDose: number; bufferDays?: number; medication: MedicamentoCorto }[];
  };
};

/** Lo que devuelve guardar una visita: si se entregó y qué quedó pendiente por falta de inventario. */
export type PendienteAlGuardar = { medicamento: string; indicada: number; entregada: number };

export type MotivoDevolucion = 'CORRECCION' | 'PACIENTE_DEVOLVIO';
export type DestinoDevolucion = 'INVENTARIO' | 'DESCARTE';
export type Devolucion = { id: number; cantidad: number; motivo: MotivoDevolucion; destino: DestinoDevolucion; nota: string | null; userName: string | null; createdAt: string };

/** Hoja de preparación: por paciente, qué meter en su bolsita. */
export type PreparacionJornada = {
  jornada: Jornada;
  pacientes: { id: number; codigo: string; nombre: string; casa: string | null; items: { medicamento: string; dosisDiaria: number; cantidad: number; tipo: 'RONDA' | 'PENDIENTE' }[] }[];
  totales: { medicamento: string; pastillas: number }[];
};

export type ReporteEntregas = {
  periodo: { desde: string; hasta: string };
  totales: {
    entregas: number;
    pacientes: number;
    pastillas: number;
    visita: number;
    mesa: number;
    reposicion: number;
    devueltas: number;
    descartadas: number;
    recibioOtro: number;
    pendientesPacientes: number;
    pendientesPastillas: number;
  };
  porBatey: { communityId: number; batey: string; entregas: number; pastillas: number; visita: number; mesa: number; reposicion: number; pendientesPacientes: number; pendientesPastillas: number }[];
  porPersona: { nombre: string; entregas: number; pastillas: number }[];
  porMedicamento: { medicamento: string; pastillas: number; visita: number; mesa: number; reposicion: number; devueltas: number; descartadas: number }[];
  reposicionesPorMotivo: { motivo: MotivoReposicion; entregas: number; pastillas: number }[];
};
