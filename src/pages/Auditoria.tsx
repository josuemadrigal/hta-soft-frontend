import { useMutation, useQueryClient } from '@tanstack/react-query';
import { History, RotateCcw, Undo2, X } from 'lucide-react';
import { type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useAuditoria, useFiltrosAuditoria } from '../api/consultas';
import { restaurarRegistro, type FiltroAuditoria } from '../api/recursos';
import type { MotivoBaja, RegistroAuditoria } from '../api/tipos';
import { MOTIVOS_BAJA } from '../lib/etiquetas';
import { useSesion } from '../auth/sesion';
import { useConfirmar } from '../components/confirmar';
import { BotonesTrimestre } from '../components/Periodo';
import { Boton, Cargando, EncabezadoPagina, Entrada, ErrorCarga, Insignia, Paginacion, Selector, Tabla, Tarjeta, Vacio } from '../components/ui';
import { fecha, fechaYHora, nombreCompleto } from '../lib/formato';

const ACCIONES: Record<string, { texto: string; color: string }> = {
  CREATE: { texto: 'Creó', color: '#15803d' },
  UPDATE: { texto: 'Editó', color: '#a16207' },
  DELETE: { texto: 'Eliminó', color: '#dc2626' },
  RESTORE: { texto: 'Restauró', color: '#2563eb' },
  MERGE: { texto: 'Unió', color: '#7c3aed' },
  SPLIT: { texto: 'Separó', color: '#7c3aed' },
  CLOSE: { texto: 'Cerró', color: '#15803d' },
  BAJA: { texto: 'Dio de baja', color: '#6b665e' },
  VIEW: { texto: 'Abrió la ficha', color: '#6b665e' },
  EXPORT: { texto: 'Exportó', color: '#7c3aed' },
  LOGIN: { texto: 'Inició sesión', color: '#6b665e' },
  BLOQUEO: { texto: 'Cuenta bloqueada', color: '#dc2626' },
  ENTRADA: { texto: 'Entrada', color: '#15803d' },
  AJUSTE: { texto: 'Ajuste', color: '#a16207' },
  REACTIVAR: { texto: 'Reactivó', color: '#15803d' },
  CANCEL: { texto: 'Canceló', color: '#6b665e' },
};
const ENTIDADES: Record<string, string> = { Patient: 'Paciente', User: 'Usuario', ClinicalVisit: 'Visita', Prescription: 'Receta', Configuracion: 'Configuración', Jornada: 'Jornada', Meta: 'Metas', Medication: 'Medicamento', Community: 'Batey', Sesion: 'Sesión', Reporte: 'Reporte' };

/** Nombre legible de cada campo de la visita. */
const CAMPOS: Record<string, string> = {
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

const legible = (campo: string, v: unknown) => {
  if (v === null || v === undefined || v === '') return '(vacío)';
  if (['visitDate', 'nextVisitDate'].includes(campo)) return fecha(String(v));
  if (campo === 'birthDate') return String(v).slice(0, 10);
  if (campo === 'gender') return ({ MALE: 'Masculino', FEMALE: 'Femenino', OTHER: 'Otro' } as Record<string, string>)[String(v)] ?? String(v);
  if (campo === 'birthDateIsEstimated') return v ? 'Sí' : 'No';
  if (['weightKg', 'heightM', 'bmi', 'temperature'].includes(campo)) return String(Math.round(Number(v) * 100) / 100);
  if (campo === 'isHomeVisit') return v === 'true' || v === true ? 'Sí' : 'No';
  const s = String(v);
  return s.length > 40 ? `${s.slice(0, 40)}…` : s;
};

/** Pacientes de una visita (para poder ir a la ficha). */
function pacienteDe(r: RegistroAuditoria, d: Record<string, unknown>): number | null {
  if (r.entity === 'Patient') return r.entityId;
  if (r.entity !== 'ClinicalVisit') return null;
  if (typeof d.paciente === 'number') return d.paciente;
  const v = d.visita as Record<string, unknown> | undefined;
  if (v?.patientId) return Number(v.patientId);
  if (typeof d.pacienteId === 'number') return d.pacienteId;
  return null;
}

function Detalle({ r }: { r: RegistroAuditoria }): ReactNode {
  if (r.action === 'VIEW') return 'Abrió la ficha del paciente';
  if (!r.details) return '—';
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(r.details);
  } catch {
    return r.details;
  }
  if (r.entity === 'User' && r.action === 'DELETE') {
    const n = Number(d.visitasReasignadas ?? 0);
    return `${d.usuario} (${d.email}, ${d.rol})${n ? ` · ${n.toLocaleString('es-DO')} visitas reasignadas a ${d.reasignadasA}; cada una conserva quién atendió` : ' · sin visitas'}`;
  }
  if (r.entity === 'User' && d.cambio === 'nombre') return `Cambió el nombre: ${d.antes} → ${d.despues} (${Number(d.visitasActualizadas).toLocaleString('es-DO')} visitas actualizadas)`;
  if (r.entity === 'Configuracion') {
    const a = (d.antes ?? {}) as Record<string, number>;
    const b = (d.despues ?? {}) as Record<string, number>;
    const NOMBRES: Record<string, string> = {
      visitasHorasEdicion: 'Plazo para que los médicos corrijan visitas (horas)',
      alertaSubidaSistolica: 'Alerta: subida de sistólica',
      alertaSubidaDiastolica: 'Alerta: subida de diastólica',
      alertaCumplimientoMinimo: 'Alerta: cumplimiento mínimo (%)',
      alertaVisitasCumplimiento: 'Alerta: visitas con cumplimiento bajo',
      alertaVisitasSinControl: 'Alerta: visitas seguidas sin control',
      sesionMinutosInactividad: 'Cierre de sesión por inactividad (min)',
    };
    const cambios = Object.keys(b).filter((k) => a[k] !== b[k]);
    return cambios.length ? cambios.map((k) => `${NOMBRES[k] ?? k}: ${a[k] ?? '—'} → ${b[k]}`).join(' · ') : 'Sin cambios';
  }
  if (r.entity === 'ClinicalVisit' && r.action === 'UPDATE') {
    const cambios = Object.entries((d.cambios ?? {}) as Record<string, { antes: unknown; despues: unknown }>).filter(([k]) => k !== 'bmi');
    return (
      <ul className="space-y-0.5">
        {cambios.map(([k, c]) => (
          <li key={k}>
            <span className="text-tinta">{CAMPOS[k] ?? k}:</span> {legible(k, c.antes)} → <span className="font-medium text-tinta">{legible(k, c.despues)}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (r.entity === 'ClinicalVisit' && r.action === 'DELETE') {
    const v = (d.visita ?? {}) as Record<string, unknown>;
    const recetas = (d.recetas ?? []) as { medicamento?: string; quantityDispensed?: number; entregadas?: number }[];
    return `Visita del ${fecha(String(v.visitDate))} de ${d.paciente} · atendió ${v.doctorNombre ?? '—'} · PA ${v.systolicManual ?? v.systolicAuto ?? '—'}/${v.diastolicManual ?? v.diastolicAuto ?? '—'}${recetas.length ? ` · ${recetas.map((x) => `${x.medicamento} (${x.quantityDispensed ?? x.entregadas})`).join(', ')}` : ''}`;
  }
  if (r.entity === 'Patient' && r.action === 'BAJA') {
    return `${d.codigo} · ${d.nombre}: ${MOTIVOS_BAJA[d.motivo as MotivoBaja] ?? d.motivo} el ${fecha(`${d.fecha}T12:00:00`)}${d.detalle ? ` · ${d.detalle}` : ''}`;
  }
  if (r.entity === 'Patient' && r.action === 'REACTIVAR') {
    const b = (d.bajaAnterior ?? {}) as { motivo?: MotivoBaja; fecha?: string };
    return `${d.codigo} · ${d.nombre} volvió a activo${b.motivo ? ` (estaba de baja: ${MOTIVOS_BAJA[b.motivo]}${b.fecha ? `, ${fecha(b.fecha)}` : ''})` : ''}`;
  }
  if (r.entity === 'Meta') {
    const antes = (d.antes ?? {}) as Record<string, number>;
    return Object.entries((d.despues ?? {}) as Record<string, number | null>)
      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${antes[k] ?? '—'} → ${v ?? 'sin meta'}`)
      .join(' · ') + ` (año ${d.anio})`;
  }
  if (r.entity === 'Patient' && r.action === 'MERGE') {
    const c = d.conservado as { codigo: string; nombre: string };
    const e = d.eliminado as { patientCode: string; firstName: string; lastName: string };
    return `Unió ${e.patientCode} (${e.firstName} ${e.lastName}) dentro de ${c.codigo} (${c.nombre}) · ${(d.visitas as number[]).length} visitas movidas; ${e.patientCode} se eliminó`;
  }
  if (r.entity === 'Patient' && r.action === 'SPLIT') {
    const o = d.original as { codigo: string; nombre: string };
    const n = d.nuevo as { codigo: string; nombre: string };
    return `Separó ${(d.visitas as number[]).length} visitas de ${o.codigo} (${o.nombre}) en la ficha nueva ${n.codigo} (${n.nombre})`;
  }
  if (r.entity === 'Patient' && r.action === 'UPDATE' && d.despues) {
    const antes = (d.antes ?? {}) as Record<string, unknown>;
    return (
      <ul className="space-y-0.5">
        {Object.entries(d.despues as Record<string, unknown>).map(([k, v]) => (
          <li key={k}>
            <span className="text-tinta">{CAMPOS[k] ?? k}:</span> {legible(k, antes[k])} → <span className="font-medium text-tinta">{legible(k, v)}</span>
          </li>
        ))}
        {!!d.revision && <li>Desde Revisión de datos</li>}
      </ul>
    );
  }
  // Ediciones con antes y después por campo (pacientes, medicamentos, bateyes)
  if (r.action === 'UPDATE' && d.cambios && ['Patient', 'Medication', 'Community'].includes(r.entity)) {
    const cambios = d.cambios as Record<string, { antes: unknown; despues: unknown }>;
    const quien = (d.nombre ?? d.medicamento ?? d.batey) as string | undefined;
    return (
      <ul className="space-y-0.5">
        {quien && <li className="text-tinta">{d.codigo ? `${d.codigo} · ` : ''}{quien}</li>}
        {Object.entries(cambios).map(([k, c]) => (
          <li key={k}>
            <span className="text-tinta">{CAMPOS[k] ?? k}:</span> {legible(k, c.antes)} → <span className="font-medium text-tinta">{legible(k, c.despues)}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (r.action === 'VIEW') return 'Abrió la ficha del paciente';
  if (r.action === 'EXPORT') return `${d.exportacion}${d.filtros ? ` · filtros: ${Object.entries(d.filtros as Record<string, unknown>).map(([k, v]) => `${k}=${v}`).join(', ') || 'ninguno'}` : ''}`;
  if (r.action === 'LOGIN') return `Inició sesión${d.ip ? ` desde ${d.ip}` : ''}`;
  if (r.action === 'BLOQUEO') return `${d.email}: ${d.minutos} minutos bloqueada por intentos fallidos${d.ip ? ` (desde ${d.ip})` : ''}`;
  if (r.entity === 'Medication' && r.action === 'ENTRADA') return `Entrada de ${d.cantidad} unidades (${d.origen === 'COMPRA' ? 'compra' : 'donación'}${d.procedencia ? `: ${d.procedencia}` : ''})${d.vencimiento ? ` · vence ${fecha(String(d.vencimiento))}` : ''}`;
  if (r.entity === 'Medication' && r.action === 'AJUSTE') return `Lote ${d.lote}: ${Number(d.cantidad) > 0 ? '+' : ''}${d.cantidad} · ${d.motivo}`;
  if (['Medication', 'Community'].includes(r.entity) && ['CREATE', 'DELETE'].includes(r.action)) return String(d.medicamento ?? d.batey ?? '');
  if (r.action === 'RESTORE') return `Deshizo la ${d.deshace} del registro #${d.registro}`;
  return Object.entries(d)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join(' · ');
}

export function Auditoria() {
  const [params, setParams] = useSearchParams();
  const num = (k: string) => (params.get(k) !== null && params.get(k) !== '' ? Number(params.get(k)) : undefined);
  const filtro: FiltroAuditoria = {
    page: num('pagina') ?? 1,
    userId: num('usuario'),
    entity: params.get('registro') || undefined,
    action: params.get('accion') || undefined,
    desde: params.get('desde') || undefined,
    hasta: params.get('hasta') || undefined,
    entityId: num('id'),
  };
  const consulta = useAuditoria(filtro);
  const opcionesFiltro = useFiltrosAuditoria();
  const cambiar = (c: Record<string, string | undefined>) =>
    setParams(
      (p) => {
        for (const [k, v] of Object.entries(c)) (v ? p.set(k, v) : p.delete(k));
        if (!('pagina' in c)) p.delete('pagina');
        return p;
      },
      { replace: true },
    );
  const hayFiltros = ['usuario', 'registro', 'accion', 'desde', 'hasta', 'id'].some((k) => params.get(k));
  const { tiene } = useSesion();
  const confirmar = useConfirmar();
  const cliente = useQueryClient();
  const puedeRestaurar = tiene('auditoria.restaurar');

  const restaurar = useMutation({
    mutationFn: restaurarRegistro,
    onSuccess: () => {
      for (const k of [['auditoria'], ['revision'], ['visitas'], ['paciente'], ['pacientes'], ['jornada'], ['stats'], ['medicamentos'], ['medicos']]) cliente.invalidateQueries({ queryKey: k });
      toast.success('Listo: el cambio se deshizo y quedó registrado.');
    },
    onError: (e) => toast.error(e.message),
  });

  const pedir = async (r: RegistroAuditoria) => {
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
      if (ok) restaurar.mutate(r.id);
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
    if (ok) restaurar.mutate(r.id);
  };

  return (
    <>
      <EncabezadoPagina titulo="Auditoría" descripcion="Quién hizo qué y cuándo: cambios, accesos a fichas, exportaciones e inicios de sesión. Las visitas eliminadas o corregidas se pueden restaurar." />
      <Tarjeta className="mb-4">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <Selector
            aria-label="Usuario"
            className="w-52"
            vacio="Todos los usuarios"
            value={params.get('usuario') ?? ''}
            onChange={(e) => cambiar({ usuario: e.target.value })}
            opciones={(opcionesFiltro.data?.actores ?? []).map((a) => ({ value: String(a.userId), label: a.nombre }))}
          />
          <Selector
            aria-label="Tipo de registro"
            className="w-52"
            vacio="Todos los registros"
            value={params.get('registro') ?? ''}
            onChange={(e) => cambiar({ registro: e.target.value, id: undefined })}
            opciones={(opcionesFiltro.data?.entidades ?? []).map((e) => ({ value: e, label: ENTIDADES[e] ?? e }))}
          />
          <Selector
            aria-label="Acción"
            className="w-52"
            vacio="Todas las acciones"
            value={params.get('accion') ?? ''}
            onChange={(e) => cambiar({ accion: e.target.value })}
            opciones={(opcionesFiltro.data?.acciones ?? []).map((a) => ({ value: a, label: ACCIONES[a]?.texto ?? a }))}
          />
          <BotonesTrimestre desde={params.get('desde')} hasta={params.get('hasta')} onCambiar={(r) => cambiar(r)} />
          <label className="flex items-center gap-2 text-sm text-tenue">
            Desde
            <Entrada type="date" className="w-auto" value={params.get('desde') ?? ''} onChange={(e) => cambiar({ desde: e.target.value })} />
          </label>
          <label className="flex items-center gap-2 text-sm text-tenue">
            Hasta
            <Entrada type="date" className="w-auto" value={params.get('hasta') ?? ''} onChange={(e) => cambiar({ hasta: e.target.value })} />
          </label>
          {hayFiltros && (
            <Boton variante="fantasma" icono={<X className="size-4" />} onClick={() => setParams({}, { replace: true })}>
              Limpiar
            </Boton>
          )}
        </div>
        {filtro.entityId !== undefined && (
          <p className="border-t border-borde px-4 py-2 text-sm text-tenue">
            Solo el registro {ENTIDADES[filtro.entity ?? ''] ?? filtro.entity} #{filtro.entityId}.{' '}
            <button className="text-tinta underline" onClick={() => cambiar({ id: undefined })}>
              Quitar
            </button>
          </p>
        )}
      </Tarjeta>
      <Tarjeta>
        {consulta.isPending ? (
          <Cargando />
        ) : consulta.isError ? (
          <ErrorCarga error={consulta.error} />
        ) : consulta.data.data.length === 0 ? (
          <Vacio icono={<History className="size-8" />} titulo={hayFiltros ? 'Nada con esos filtros' : 'Sin registros'} />
        ) : (
          <>
            <Tabla columnas={['Fecha', 'Acción', 'Registro', 'Detalle', 'Usuario', { texto: '', className: 'w-36' }]}>
              {consulta.data.data.map((r) => {
                const a = ACCIONES[r.action];
                let d: Record<string, unknown> = {};
                try {
                  d = r.details ? JSON.parse(r.details) : {};
                } catch {
                  /* detalle en texto plano */
                }
                const paciente = pacienteDe(r, d);
                const restaurable = (r.entity === 'ClinicalVisit' && ['DELETE', 'UPDATE'].includes(r.action)) || (r.entity === 'Patient' && ['MERGE', 'SPLIT'].includes(r.action));
                return (
                  <tr key={r.id} className="align-top">
                    <td className="px-5 py-3 whitespace-nowrap">{fechaYHora(r.timestamp)}</td>
                    <td className="px-5 py-3">
                      <Insignia color={a?.color}>{a?.texto ?? r.action}</Insignia>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      {ENTIDADES[r.entity] ?? r.entity}{' '}
                      {!['Configuracion', 'Reporte'].includes(r.entity) && (
                        <button className="font-mono text-xs text-tenue hover:text-tinta hover:underline" title="Ver todo el historial de este registro" onClick={() => cambiar({ registro: r.entity, id: String(r.entityId) })}>
                          #{r.entityId}
                        </button>
                      )}
                      {paciente && (
                        <Link to={`/pacientes/${paciente}`} className="block text-xs font-medium text-marca-700 hover:underline">
                          Ver paciente
                        </Link>
                      )}
                    </td>
                    <td className="max-w-xl px-5 py-3 text-xs text-tenue">
                      <Detalle r={r} />
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-tenue">{r.user ? nombreCompleto(r.user) : (r.actorName ?? 'Sistema')}</td>
                    <td className="px-5 py-2.5 text-right">
                      {restaurable && r.revertidoEn ? (
                        <span className="text-xs text-tenue">
                          Deshecho el {fecha(r.revertidoEn)}
                          {r.revertidoPor && <span className="block">por {r.revertidoPor}</span>}
                        </span>
                      ) : (
                        restaurable &&
                        puedeRestaurar && (
                          <Boton
                            variante="secundario"
                            className="h-8 text-xs"
                            cargando={restaurar.isPending && restaurar.variables === r.id}
                            icono={r.action === 'DELETE' ? <RotateCcw className="size-3.5" /> : <Undo2 className="size-3.5" />}
                            onClick={() => pedir(r)}
                          >
                            {r.action === 'DELETE' ? 'Restaurar' : 'Deshacer'}
                          </Boton>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </Tabla>
            <Paginacion pagina={filtro.page} ultima={consulta.data.meta.lastPage} total={consulta.data.meta.total} alCambiar={(p) => cambiar({ pagina: String(p) })} />
          </>
        )}
      </Tarjeta>
    </>
  );
}
