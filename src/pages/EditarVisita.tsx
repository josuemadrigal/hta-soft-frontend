import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, Save, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useConfigPA, useUsuarios, useVisita } from '../api/consultas';
import { editarVisita, type CambiosVisita } from '../api/recursos';
import type { Paciente, Visita } from '../api/tipos';
import { usePermisosVisita } from '../auth/permisosVisita';
import { useSesion } from '../auth/sesion';
import { useEliminarVisita } from '../components/eliminarVisita';
import { AreaTexto, Boton, Campo, Cargando, Casilla, comoNumero, EncabezadoPagina, Entrada, InsigniaCategoria, Selector, Tarjeta, Vacio } from '../components/ui';
import { opciones, TIPOS_VISITA } from '../lib/etiquetas';
import { atendio, clasificar, edadTexto, fecha, fechaYHora, nombreCompleto, num } from '../lib/formato';

type Datos = {
  visitDate: string;
  visitType: Visita['visitType'];
  isHomeVisit: boolean;
  weightKg?: number;
  heightM?: number;
  systolicManual?: number;
  diastolicManual?: number;
  systolicAuto?: number;
  diastolicAuto?: number;
  heartRate?: number;
  oxygenSaturation?: number;
  temperature?: number;
  reason: string;
  notes: string;
  prescriptionText: string;
  nextVisitDate: string;
  doctorId: string;
};

/** datetime-local / date quieren hora local sin zona. */
const local = (iso: string | null | undefined, largo: number) => {
  if (!iso) return '';
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, largo);
};

/** /visitas/:id/editar — médico: las suyas dentro del plazo; administrador: cualquiera. */
export function EditarVisita() {
  const id = Number(useParams().id);
  const consulta = useVisita(id);
  const permisos = usePermisosVisita();
  if (consulta.isPending) return <Cargando />;
  if (!consulta.data) return <Vacio titulo="Visita no encontrada">Puede que se haya eliminado.</Vacio>;
  if (!permisos.puedeEditar(consulta.data)) {
    return (
      <Vacio icono={<Lock className="size-8" />} titulo="No puedes editar esta visita">
        Los médicos corrigen solo las visitas que atendieron, durante {permisos.horas} horas desde que se registraron. Pide a un administrador que la corrija.
      </Vacio>
    );
  }
  return <Formulario visita={consulta.data} />;
}

function Formulario({ visita }: { visita: Visita & { patient: Paciente } }) {
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const pedido = params.get('volver');
  const volver = pedido?.startsWith('/') && !pedido.startsWith('//') ? pedido : `/pacientes/${visita.patientId}`;
  const cliente = useQueryClient();
  const configs = useConfigPA();
  const { tiene } = useSesion();
  const permisos = usePermisosVisita();
  const esAdmin = permisos.puedeEliminar;
  const usuarios = useUsuarios();
  const eliminar = useEliminarVisita(() => navegar(volver));
  const hasta = permisos.editableHasta(visita);

  const { register, handleSubmit, formState, watch } = useForm<Datos>({
    defaultValues: {
      visitDate: local(visita.visitDate, 16),
      visitType: visita.visitType,
      isHomeVisit: visita.isHomeVisit,
      weightKg: num(visita.weightKg) ?? undefined,
      heightM: num(visita.heightM) ?? undefined,
      systolicManual: visita.systolicManual ?? undefined,
      diastolicManual: visita.diastolicManual ?? undefined,
      systolicAuto: visita.systolicAuto ?? undefined,
      diastolicAuto: visita.diastolicAuto ?? undefined,
      heartRate: visita.heartRate ?? undefined,
      oxygenSaturation: visita.oxygenSaturation ?? undefined,
      temperature: num(visita.temperature) ?? undefined,
      reason: visita.reason ?? '',
      notes: visita.notes ?? '',
      prescriptionText: visita.prescriptionText ?? '',
      nextVisitDate: local(visita.nextVisitDate, 10),
      doctorId: String(visita.doctorId),
    },
  });
  const [sm, dm, sa, da] = watch(['systolicManual', 'diastolicManual', 'systolicAuto', 'diastolicAuto']);
  const s = sm ?? sa;
  const d = dm ?? da;
  const categoria = s && d ? clasificar(configs.data ?? [], s, d) : null;

  const guardar = useMutation({
    mutationFn: (x: Datos) => {
      // Lo que se deja vacío se borra (null), no se ignora.
      const nulo = <T,>(v: T | undefined) => (v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? null : v);
      const cambios: CambiosVisita = {
        visitDate: new Date(x.visitDate).toISOString(),
        visitType: x.visitType,
        isHomeVisit: x.isHomeVisit,
        weightKg: nulo(x.weightKg),
        heightM: nulo(x.heightM),
        systolicManual: nulo(x.systolicManual),
        diastolicManual: nulo(x.diastolicManual),
        systolicAuto: nulo(x.systolicAuto),
        diastolicAuto: nulo(x.diastolicAuto),
        heartRate: nulo(x.heartRate),
        oxygenSaturation: nulo(x.oxygenSaturation),
        temperature: nulo(x.temperature),
        reason: x.reason.trim() || null,
        notes: x.notes.trim() || null,
        prescriptionText: x.prescriptionText.trim() || null,
        ...(x.nextVisitDate && { nextVisitDate: new Date(`${x.nextVisitDate}T12:00:00`).toISOString() }),
        ...(esAdmin && Number(x.doctorId) !== visita.doctorId && { doctorId: Number(x.doctorId) }),
      };
      return editarVisita(visita.id, cambios);
    },
    onSuccess: () => {
      for (const k of [['visitas'], ['paciente'], ['pacientes'], ['jornada'], ['stats'], ['medicos'], ['auditoria']]) cliente.invalidateQueries({ queryKey: k });
      toast.success('Visita corregida. El cambio quedó registrado en Auditoría.');
      navegar(volver);
    },
    onError: (e) => toast.error(e.message.includes('No BP Configuration') ? 'Esos valores de presión no caen en ningún rango de la clasificación.' : e.message),
  });

  const campoNum = (nombre: keyof Datos, etiqueta: string, extra: Record<string, unknown> = {}) => (
    <Campo etiqueta={etiqueta}>
      <Entrada type="number" inputMode="decimal" {...extra} {...register(nombre, comoNumero)} />
    </Campo>
  );
  const p = visita.patient;

  return (
    <>
      <EncabezadoPagina
        titulo={`Editar visita del ${fecha(visita.visitDate)}`}
        descripcion={
          <>
            {nombreCompleto(p)} · <span className="font-mono">{p.patientCode}</span> · {edadTexto(p)} · atendió {atendio(visita)}
          </>
        }
        volver={{ a: volver, texto: volver.startsWith('/visitas') ? 'Visitas' : nombreCompleto(p) }}
        acciones={
          esAdmin && (
            <Boton variante="secundario" className="hover:text-red-600" icono={<Trash2 className="size-4" />} onClick={() => eliminar({ ...visita, patient: p })}>
              Eliminar visita
            </Boton>
          )
        }
      />
      {hasta && (
        <p className="mb-4 rounded-lg bg-marca-50 px-4 py-2.5 text-sm">
          Puedes corregir esta visita hasta el <strong>{fechaYHora(hasta.toISOString())}</strong>. Después, solo un administrador.
        </p>
      )}

      <form onSubmit={handleSubmit((x) => guardar.mutate(x))} className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <Tarjeta titulo="Presión arterial (mmHg)" accion={<span className="text-xs text-tenue">Deja vacío para borrar un valor mal anotado</span>}>
            <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
              {campoNum('systolicManual', 'Sistólica manual')}
              {campoNum('diastolicManual', 'Diastólica manual')}
              {campoNum('systolicAuto', 'Sistólica auto.')}
              {campoNum('diastolicAuto', 'Diastólica auto.')}
            </div>
          </Tarjeta>
          <Tarjeta titulo="Medida y visita">
            <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
              {campoNum('weightKg', 'Peso (kg)', { step: '0.1' })}
              {campoNum('heightM', 'Estatura (m)', { step: '0.01' })}
              <Campo etiqueta="Tipo">
                <Selector opciones={opciones(TIPOS_VISITA)} {...register('visitType')} />
              </Campo>
              <Campo etiqueta="Fecha y hora">
                <Entrada type="datetime-local" {...register('visitDate', { required: true })} />
              </Campo>
              <Campo etiqueta="Próxima visita">
                <Entrada type="date" {...register('nextVisitDate')} />
              </Campo>
              {campoNum('heartRate', 'Frec. cardíaca')}
              {campoNum('oxygenSaturation', 'Saturación O₂ (%)')}
              {campoNum('temperature', 'Temperatura (°C)', { step: '0.1' })}
              <div className="col-span-2 flex items-end pb-2 sm:col-span-4">
                <Casilla etiqueta="Visita domiciliaria" {...register('isHomeVisit')} />
              </div>
            </div>
          </Tarjeta>
          <Tarjeta titulo="Notas">
            <div className="grid gap-4 p-5">
              <Campo etiqueta="Motivo">
                <Entrada {...register('reason')} />
              </Campo>
              <Campo etiqueta="Comentario">
                <AreaTexto {...register('notes')} />
              </Campo>
              <Campo etiqueta="Indicaciones">
                <AreaTexto {...register('prescriptionText')} />
              </Campo>
            </div>
          </Tarjeta>
          {esAdmin && tiene('usuarios.gestionar') && (
            <Tarjeta titulo="Quién atendió" accion={<span className="text-xs text-tenue">Solo administradores</span>}>
              <div className="p-5">
                <Campo etiqueta="Atendió" ayuda={visita.originalDoctorId ? `Hoy figura ${atendio(visita)} (cuenta eliminada).` : undefined}>
                  <Selector {...register('doctorId')} opciones={(usuarios.data?.data ?? []).map((u) => ({ value: u.id, label: `${nombreCompleto(u)}${u.isActive ? '' : ' (inactivo)'}` }))} />
                </Campo>
              </div>
            </Tarjeta>
          )}
          {!!visita.prescriptions?.length && (
            <Tarjeta titulo="Medicamentos entregados" accion={<span className="text-xs text-tenue">No se editan: ya salieron del inventario</span>}>
              <ul className="divide-y divide-borde text-sm">
                {visita.prescriptions.map((r) => (
                  <li key={r.id} className="flex justify-between px-5 py-2.5">
                    <span>
                      {r.medication?.name} {r.medication?.concentration}
                    </span>
                    <span className="tabular text-tenue">
                      {r.dailyDose}/día · {r.quantityDispensed} entregadas
                    </span>
                  </li>
                ))}
              </ul>
            </Tarjeta>
          )}
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Tarjeta titulo="Resumen">
            <dl className="space-y-4 p-5">
              <div>
                <dt className="text-xs text-tenue">Presión</dt>
                <dd className="tabular mt-1 font-mono text-2xl font-medium">{s && d ? `${s}/${d}` : '—/—'}</dd>
              </div>
              <div>
                <dt className="mb-1 text-xs text-tenue">Clasificación</dt>
                <dd>{s && d ? <InsigniaCategoria config={categoria} /> : <span className="text-sm text-tenue">Sin toma: quedará sin clasificar</span>}</dd>
              </div>
            </dl>
            <div className="border-t border-borde p-5">
              <Boton type="submit" className="w-full" cargando={guardar.isPending} disabled={!formState.isDirty} icono={<Save className="size-4" />}>
                Guardar corrección
              </Boton>
            </div>
          </Tarjeta>
        </aside>
      </form>
    </>
  );
}
