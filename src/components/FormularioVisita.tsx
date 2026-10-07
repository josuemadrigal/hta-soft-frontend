import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Plus, Save, X } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, useForm, useWatch, type Control, type UseFormRegister } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useConfigPA, useMedicamentos } from '../api/consultas';
import { crearVisita, type DatosVisita } from '../api/recursos';
import { agregarPendiente, esFaltaDeConexion, nuevoId } from '../offline/cola';
import type { ConfigPA, Medicamento, Paciente, Receta, Visita } from '../api/tipos';
import { useSesion } from '../auth/sesion';
import { alertasClinicas } from '../lib/alertas';
import { opciones, TIPOS_VISITA } from '../lib/etiquetas';
import { clasificar, cn, colorCumplimiento, DIA_MS, nombreCompleto } from '../lib/formato';
import { ListaAlertas, useUmbrales } from './Alertas';
import { HistorialVisitas } from './HistorialVisitas';
import { AreaTexto, Boton, Campo, Cargando, Casilla, comoNumero, Entrada, InsigniaCategoria, Selector, Tarjeta } from './ui';

const INTERVALOS = [
  { value: '90', label: 'Trimestral (90 días)' },
  { value: '30', label: 'Mensual (30 días)' },
  { value: 'otro', label: 'Otro intervalo' },
];

const entero = (min: number, max: number) => z.number().int('Sin decimales').min(min, `Mínimo ${min}`).max(max, `Máximo ${max}`).optional();

const esquema = z
  .object({
    visitDate: z.string().min(1, 'Requerida'),
    visitType: z.enum(['NEW', 'FOLLOW_UP']),
    isHomeVisit: z.boolean(),
    weightKg: z.number('Requerido').min(2, 'Revisa el peso').max(350, 'Revisa el peso'),
    heightM: z.number('Requerida').min(0.4, 'En metros, p. ej. 1.68').max(2.5, 'En metros, p. ej. 1.68'),
    systolicManual: entero(40, 300),
    diastolicManual: entero(20, 200),
    systolicAuto: entero(40, 300),
    diastolicAuto: entero(20, 200),
    heartRate: entero(20, 250),
    oxygenSaturation: entero(50, 100),
    temperature: z.number().min(30).max(45).optional(),
    reason: z.string().trim(),
    notes: z.string().trim(),
    prescriptionText: z.string().trim(),
    intervalo: z.enum(['90', '30', 'otro']),
    diasOtro: z.number().int().min(7, 'Mínimo 7 días').max(365, 'Máximo 365').optional(),
    recetas: z.array(
      z.object({
        medicationId: z.string().min(1, 'Elige uno'),
        dailyDose: z.number('Requerida').int().min(1, 'Mínimo 1'),
        bufferDays: z.number('Requerido').int().min(0),
        patientSupplyRemaining: z.number('¿Cuántas le quedan?').int().min(0, 'No puede ser negativo'),
      }),
    ),
  })
  .refine((d) => (d.systolicManual && d.diastolicManual) || (d.systolicAuto && d.diastolicAuto), {
    message: 'Registra al menos una toma completa (sistólica y diastólica), manual o automática.',
    path: ['systolicManual'],
  })
  .refine((d) => d.intervalo !== 'otro' || d.diasOtro, { message: 'Indica los días', path: ['diasOtro'] })
  .refine((d) => new Set(d.recetas.map((r) => r.medicationId)).size === d.recetas.length, {
    message: 'Hay un medicamento repetido.',
    path: ['recetas'],
  });
type Datos = z.infer<typeof esquema>;

/** datetime-local quiere la hora local sin zona. */
const ahoraLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

const diasDe = (d: Pick<Datos, 'intervalo' | 'diasOtro'>) => (d.intervalo === 'otro' ? (d.diasOtro ?? 0) : Number(d.intervalo));

/** Receta más reciente de ese medicamento en el historial del paciente, con la fecha de su visita. */
function recetaAnterior(visitas: Visita[], medicationId: number): { receta: Receta; fecha: string } | null {
  for (const v of visitas) {
    const r = v.prescriptions?.find((p) => p.medicationId === medicationId);
    if (r) return { receta: r, fecha: v.visitDate };
  }
  return null;
}

/** Misma cuenta que PrescriptionsService.calcularCumplimiento, para verla antes de guardar. */
function estimarCumplimiento(anterior: { receta: Receta; fecha: string } | null, fechaVisita: string, sobrante: number | undefined) {
  if (!anterior || sobrante === undefined || Number.isNaN(sobrante)) return null;
  const dias = Math.round((new Date(fechaVisita).getTime() - new Date(anterior.fecha).getTime()) / DIA_MS);
  const tenia = anterior.receta.quantityDispensed + anterior.receta.patientSupplyRemaining;
  const debia = Math.min(anterior.receta.dailyDose * dias, tenia);
  if (debia <= 0) return null;
  return Math.min(100, (Math.max(0, tenia - sobrante) / debia) * 100);
}


function FilaReceta({
  indice,
  control,
  register,
  medicamentos,
  historial,
  alQuitar,
  errores,
}: {
  indice: number;
  control: Control<Datos>;
  register: UseFormRegister<Datos>;
  medicamentos: Medicamento[];
  historial: Visita[];
  alQuitar: () => void;
  errores?: Partial<Record<'medicationId' | 'dailyDose' | 'bufferDays' | 'patientSupplyRemaining', { message?: string }>>;
}) {
  const [receta, fecha, intervalo, diasOtro] = useWatch({ control, name: [`recetas.${indice}`, 'visitDate', 'intervalo', 'diasOtro'] });
  const med = medicamentos.find((m) => m.id === Number(receta.medicationId));
  // Misma cuenta que el backend: dosis × días + margen − lo que le queda.
  const total = (receta.dailyDose || 0) * diasDe({ intervalo, diasOtro }) + (receta.bufferDays || 0);
  const entregar = Math.max(0, total - (receta.patientSupplyRemaining || 0));
  const anterior = med ? recetaAnterior(historial, med.id) : null;
  const cumplimiento = estimarCumplimiento(anterior, fecha, receta.patientSupplyRemaining);

  return (
    <li className="grid grid-cols-2 gap-3 px-5 py-4 sm:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] sm:items-start">
      <Campo etiqueta="Medicamento" error={errores?.medicationId?.message} className="col-span-2 sm:col-span-1">
        <Selector
          vacio="Elegir…"
          {...register(`recetas.${indice}.medicationId`)}
          opciones={medicamentos.map((m) => ({ value: m.id, label: `${m.name} ${m.concentration}` }))}
        />
      </Campo>
      <Campo etiqueta="Pastillas al día" error={errores?.dailyDose?.message}>
        <Entrada type="number" min={1} {...register(`recetas.${indice}.dailyDose`, comoNumero)} />
      </Campo>
      <Campo etiqueta="Días de margen" error={errores?.bufferDays?.message}>
        <Entrada type="number" min={0} {...register(`recetas.${indice}.bufferDays`, comoNumero)} />
      </Campo>
      <Campo etiqueta="Le quedan" error={errores?.patientSupplyRemaining?.message}>
        <Entrada type="number" min={0} placeholder="0" {...register(`recetas.${indice}.patientSupplyRemaining`, comoNumero)} />
      </Campo>
      <button type="button" onClick={alQuitar} className="mt-6 hidden rounded-md p-2 text-tenue hover:bg-black/5 hover:text-red-600 sm:block" aria-label="Quitar medicamento">
        <X className="size-4" />
      </button>
      <div className="tabular col-span-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-tenue sm:col-span-5">
        <span>
          Se entregan <strong className={cn('text-tinta', med && med.currentStock < entregar && 'text-red-600')}>{entregar}</strong>
          {med && ` · quedan ${med.currentStock} en inventario`}
        </span>
        <span>
          Cumplimiento:{' '}
          {cumplimiento === null ? (
            <span>
              {!anterior
                ? 'primera vez con este medicamento'
                : receta.patientSupplyRemaining === undefined || Number.isNaN(receta.patientSupplyRemaining)
                  ? 'escribe cuántas le quedan'
                  : 'la receta anterior es de este mismo día'}
            </span>
          ) : (
            <strong className={colorCumplimiento(cumplimiento)}>{cumplimiento.toFixed(0)}%</strong>
          )}
        </span>
        <button type="button" onClick={alQuitar} className="ml-auto text-red-600 hover:underline sm:hidden">
          Quitar
        </button>
      </div>
    </li>
  );
}

type Props = {
  paciente: Paciente;
  /** En la jornada va en un modal: una sola columna, sin resumen lateral fijo. */
  enModal?: boolean;
  /** Sin visita cuando quedó guardada sin internet (se envía después). */
  alGuardar: (v?: Visita) => void;
};

/** Los <select> precargados necesitan sus opciones al montarse, si no se quedan en "Elegir…". */
export function FormularioVisita(props: Props) {
  const configs = useConfigPA();
  const medicamentos = useMedicamentos();
  if (!configs.data || !medicamentos.data) return <Cargando />;
  return <Formulario {...props} configs={configs.data} medicamentos={medicamentos.data} />;
}

function Formulario({ paciente, enModal, alGuardar, configs, medicamentos }: Props & { configs: ConfigPA[]; medicamentos: Medicamento[] }) {
  const { usuario } = useSesion();
  const cliente = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const historial = paciente.clinicalVisits ?? [];
  const ultima = historial[0];

  const { register, handleSubmit, control, formState } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: {
      visitDate: ahoraLocal(),
      visitType: ultima ? 'FOLLOW_UP' : 'NEW',
      isHomeVisit: false,
      // La estatura casi no cambia: se toma la última registrada.
      heightM: (() => {
        const h = historial.find((v) => v.heightM)?.heightM;
        return h ? Math.round(Number(h) * 100) / 100 : undefined;
      })(),
      reason: '',
      notes: '',
      prescriptionText: '',
      intervalo: '90',
      // Lo normal es repetir el tratamiento: se precargan los medicamentos de la última visita.
      recetas: (ultima?.prescriptions ?? []).map((r) => ({
        medicationId: String(r.medicationId),
        dailyDose: r.dailyDose,
        bufferDays: r.bufferDays,
        patientSupplyRemaining: undefined as unknown as number,
      })),
    },
  });
  const recetas = useFieldArray({ control, name: 'recetas' });
  const e = formState.errors;

  const [sm, dm, sa, da, peso, talla, intervalo, fc, spo2, temperatura, recetasHoy, fechaHoy] = useWatch({
    control,
    name: ['systolicManual', 'diastolicManual', 'systolicAuto', 'diastolicAuto', 'weightKg', 'heightM', 'intervalo', 'heartRate', 'oxygenSaturation', 'temperature', 'recetas', 'visitDate'],
  });
  const s = sm ?? sa;
  const d = dm ?? da;
  const categoria = s && d ? clasificar(configs, s, d) : null;
  const imc = peso && talla ? peso / (talla * talla) : null;

  // Alertas clínicas con lo que se va escribiendo y el historial
  const umbrales = useUmbrales();
  const alertas = alertasClinicas(
    {
      s,
      d,
      fc,
      spo2,
      temperatura,
      peso,
      talla,
      medicamentos: recetasHoy.map((r) => medicamentos.find((m) => m.id === Number(r.medicationId))?.name ?? '').filter(Boolean),
      cumplimientos: recetasHoy
        .map((r) => estimarCumplimiento(recetaAnterior(historial, Number(r.medicationId)), fechaHoy, r.patientSupplyRemaining))
        .filter((x): x is number => x !== null),
    },
    historial,
    umbrales,
  );

  const enviar = handleSubmit(async (datos) => {
    setError(null);
    const fecha = new Date(datos.visitDate);
    const dias = diasDe(datos);
    const visita: DatosVisita = {
        // Mismo id si se reenvía (sin internet o tras un corte): el servidor no la duplica.
        clienteId: nuevoId(),
        patientId: paciente.id,
        doctorId: usuario!.id,
        visitDate: fecha.toISOString(),
        nextVisitDate: new Date(fecha.getTime() + dias * DIA_MS).toISOString(),
        visitType: datos.visitType,
        isHomeVisit: datos.isHomeVisit,
        weightKg: datos.weightKg,
        heightM: datos.heightM,
        systolicManual: datos.systolicManual,
        diastolicManual: datos.diastolicManual,
        systolicAuto: datos.systolicAuto,
        diastolicAuto: datos.diastolicAuto,
        heartRate: datos.heartRate,
        oxygenSaturation: datos.oxygenSaturation,
        temperature: datos.temperature,
        reason: datos.reason || undefined,
        notes: datos.notes || undefined,
        prescriptionText: datos.prescriptionText || undefined,
        prescriptions: datos.recetas.map((r) => ({ ...r, medicationId: Number(r.medicationId), daysUntilNextVisit: dias })),
    };
    // Sin internet: se guarda en el dispositivo y se envía sola al volver la conexión.
    const guardarSinInternet = async () => {
      await agregarPendiente({
        id: visita.clienteId!,
        tipo: 'visita',
        ruta: '/visits',
        metodo: 'POST',
        cuerpo: visita,
        resumen: { pacienteId: paciente.id, paciente: `${nombreCompleto(paciente)} · ${paciente.patientCode}`, detalle: `Visita del ${fecha.toLocaleDateString('es-DO')} · PA ${s ?? '—'}/${d ?? '—'}` },
      });
      toast.success('Sin conexión: la visita quedó guardada en este dispositivo y se enviará sola al volver la señal.');
      alGuardar();
    };
    if (!navigator.onLine) return guardarSinInternet();
    try {
      const v = await crearVisita(visita);
      for (const k of [['paciente', paciente.id], ['pacientes'], ['visitas'], ['stats'], ['jornada'], ['medicamentos']]) {
        cliente.invalidateQueries({ queryKey: k });
      }
      toast.success('Visita registrada');
      alGuardar(v);
    } catch (err) {
      if (esFaltaDeConexion(err)) return guardarSinInternet();
      const m = err instanceof Error ? err.message : '';
      const sinStock = m.match(/^Insufficient stock for (.+)\. Required: (\d+), Available: (\d+)/);
      setError(
        sinStock
          ? `No hay suficiente ${sinStock[1]}: hacen falta ${sinStock[2]} y quedan ${sinStock[3]}. No se guardó nada.`
          : m.includes('No BP Configuration')
            ? 'Esos valores de presión no caen en ningún rango de la clasificación. Revisa la toma.'
            : m || 'No se pudo guardar la visita.',
      );
    }
  });

  const campoNum = (nombre: 'systolicManual' | 'diastolicManual' | 'systolicAuto' | 'diastolicAuto' | 'weightKg' | 'heightM' | 'temperature' | 'heartRate' | 'oxygenSaturation', etiqueta: string, extra: Record<string, unknown> = {}) => (
    <Campo etiqueta={etiqueta} error={e[nombre]?.type === 'custom' ? undefined : e[nombre]?.message}>
      <Entrada type="number" inputMode="decimal" {...extra} {...register(nombre, comoNumero)} aria-invalid={!!e[nombre]} />
    </Campo>
  );

  // Última toma válida, para comparar mientras se escribe la de hoy.
  const conToma = historial.find((v) => (v.systolicManual ?? v.systolicAuto) && (v.diastolicManual ?? v.diastolicAuto));
  const anterior = conToma ? { s: (conToma.systolicManual ?? conToma.systolicAuto)!, d: (conToma.diastolicManual ?? conToma.diastolicAuto)! } : null;
  const signo = (n: number) => (n > 0 ? `+${n}` : String(n));

  const resumen = (
    <Tarjeta titulo="Resumen">
      <dl className={cn('gap-4 p-5', enModal ? 'grid grid-cols-3' : 'space-y-4')}>
        <div>
          <dt className="text-xs text-tenue">Presión</dt>
          <dd className="tabular mt-1 font-mono text-2xl font-medium">{s && d ? `${s}/${d}` : '—/—'}</dd>
          {s && d && anterior && (
            <dd className="mt-0.5 text-xs text-tenue">
              Última: <span className="font-mono">{anterior.s}/{anterior.d}</span>{' '}
              <span className={cn('font-medium', s - anterior.s > 0 ? 'text-red-600' : s - anterior.s < 0 ? 'text-green-700' : '')}>
                ({signo(s - anterior.s)}/{signo(d - anterior.d)})
              </span>
            </dd>
          )}
        </div>
        <div>
          <dt className="mb-1 text-xs text-tenue">Clasificación</dt>
          <dd>{s && d ? <InsigniaCategoria config={categoria} /> : <span className="text-sm text-tenue">Falta la toma</span>}</dd>
        </div>
        <div>
          <dt className="text-xs text-tenue">IMC</dt>
          <dd className="tabular mt-1 font-mono text-lg">{imc && Number.isFinite(imc) ? imc.toFixed(1) : '—'}</dd>
        </div>
      </dl>
      {alertas.length > 0 && <ListaAlertas alertas={alertas} className="mx-5 mb-4" />}
      {(error || e.systolicManual?.type === 'custom' || e.recetas?.message) && (
        <p className="mx-5 mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error ?? e.systolicManual?.message ?? e.recetas?.message}</p>
      )}
      <div className="border-t border-borde p-5">
        <Boton type="submit" className="w-full" cargando={formState.isSubmitting} icono={<Save className="size-4" />}>
          Guardar visita
        </Boton>
      </div>
    </Tarjeta>
  );

  return (
    <form onSubmit={enviar} noValidate className={cn('grid grid-cols-1 gap-4', !enModal && 'lg:grid-cols-[minmax(0,1fr)_300px]')}>
      <div className="space-y-4">
        <Tarjeta titulo="Presión arterial (mmHg)" accion={<span className="text-xs text-tenue">La manual manda sobre la automática</span>}>
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
            <Campo etiqueta="Fecha y hora" error={e.visitDate?.message}>
              <Entrada type="datetime-local" {...register('visitDate')} />
            </Campo>
            <Campo etiqueta="Próxima visita" className="col-span-2">
              <Selector opciones={INTERVALOS} {...register('intervalo')} />
            </Campo>
            {intervalo === 'otro' ? (
              <Campo etiqueta="Días hasta la próxima" error={e.diasOtro?.message}>
                <Entrada type="number" min={7} {...register('diasOtro', comoNumero)} />
              </Campo>
            ) : (
              <div />
            )}
            <div className="flex items-end pb-2">
              <Casilla etiqueta="Domiciliaria" {...register('isHomeVisit')} />
            </div>
          </div>
        </Tarjeta>

        <Tarjeta
          titulo="Medicamentos"
          accion={
            <Boton
              variante="fantasma"
              className="h-8"
              icono={<Plus className="size-4" />}
              onClick={() => recetas.append({ medicationId: '', dailyDose: 1, bufferDays: 5, patientSupplyRemaining: undefined as unknown as number })}
            >
              Agregar
            </Boton>
          }
        >
          {recetas.fields.length === 0 ? (
            <p className="px-5 py-4 text-sm text-tenue">Sin medicamentos en esta visita.</p>
          ) : (
            <ul className="divide-y divide-borde">
              {recetas.fields.map((f, i) => (
                <FilaReceta
                  key={f.id}
                  indice={i}
                  control={control}
                  register={register}
                  medicamentos={medicamentos}
                  historial={historial}
                  alQuitar={() => recetas.remove(i)}
                  errores={e.recetas?.[i]}
                />
              ))}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta titulo="Comentario">
          <div className="space-y-4 p-5">
            <AreaTexto {...register('notes')} placeholder="Adherencia, síntomas, observaciones para la próxima clínica…" />
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-tenue hover:text-tinta">
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" /> Más datos (motivo, signos vitales, indicaciones)
              </summary>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Campo etiqueta="Motivo de consulta" className="col-span-2 sm:col-span-3">
                  <Entrada {...register('reason')} />
                </Campo>
                {campoNum('heartRate', 'Frec. cardíaca (lpm)')}
                {campoNum('oxygenSaturation', 'Saturación O₂ (%)')}
                {campoNum('temperature', 'Temperatura (°C)', { step: '0.1' })}
                <Campo etiqueta="Indicaciones para el paciente" className="col-span-2 sm:col-span-3">
                  <AreaTexto {...register('prescriptionText')} />
                </Campo>
              </div>
            </details>
          </div>
        </Tarjeta>
      </div>

      <aside className={cn('space-y-4', !enModal && 'lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:self-start lg:overflow-y-auto')}>
        {resumen}
        <HistorialVisitas visitas={historial} />
      </aside>
    </form>
  );
}

