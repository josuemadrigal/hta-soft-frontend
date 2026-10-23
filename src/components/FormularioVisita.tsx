import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, ChevronDown, Minus, Plus, Save, X } from 'lucide-react';
import { useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch, type Control, type UseFormRegister, type UseFormSetValue } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useConfigPA, useConfiguracion, useMedicamentos } from '../api/consultas';
import { crearVisita, editarVisita, type CambiosVisita, type DatosVisita } from '../api/recursos';
import { agregarPendiente, esFaltaDeConexion, nuevoId } from '../offline/cola';
import type { ConfigPA, Medicamento, Paciente, Receta, Visita } from '../api/tipos';
import { useSesion } from '../auth/sesion';
import { useConfirmar } from './confirmar';
import { alertasClinicas } from '../lib/alertas';
import { opciones, TIPOS_VISITA } from '../lib/etiquetas';
import { margenDe, mensajeEntrega } from '../lib/entregas';
import { clasificar, cn, colorCumplimiento, DIA_MS, fecha as fechaCorta, nombreCompleto } from '../lib/formato';
import { ListaAlertas, useUmbrales } from './Alertas';
import { HistorialVisitas } from './HistorialVisitas';
import { SelectorFecha, ymd } from './SelectorFecha';
import { AreaTexto, Boton, Campo, Cargando, Casilla, comoNumero, Entrada, InsigniaCategoria, Segmentos, Selector, Tarjeta } from './ui';

const entero = (min: number, max: number) => z.number().int('Sin decimales').min(min, `Mínimo ${min}`).max(max, `Máximo ${max}`).optional();

const base = z.object({
    visitDate: z.string().min(1, 'Requerida'),
    visitType: z.enum(['NEW', 'FOLLOW_UP']),
    isHomeVisit: z.boolean(),
    /** Entregar los medicamentos al guardar; si no, quedan para la mesa de farmacia. */
    entregar: z.boolean(),
    // Obligatorios al registrar; al corregir pueden quedar vacíos (visitas viejas del Excel).
    weightKg: z.number().min(2, 'Revisa el peso').max(350, 'Revisa el peso').optional(),
    heightM: z.number().min(0.4, 'En metros, p. ej. 1.68').max(2.5, 'En metros, p. ej. 1.68').optional(),
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
    /** Al corregir, quién atendió (solo administración). */
    doctorId: z.string().optional(),
    recetas: z.array(
      z.object({
        /** Al corregir: la receta que ya existía (sin id es un medicamento agregado). */
        id: z.number().optional(),
        /** Al corregir: cuántas se entregaron de verdad (mueve el inventario por la diferencia). */
        entregadas: z.number().int('Sin decimales').min(0).max(2000, 'Máximo 2000').optional(),
        medicationId: z.string().min(1, 'Elige uno'),
        dailyDose: z.number('Requerida').int().min(1, 'Mínimo 1'),
        bufferDays: z.number('Requerido').int().min(0),
        // Vacío = no trajo ninguna (0).
        patientSupplyRemaining: z.number().int('Sin decimales').min(0, 'No puede ser negativo').optional(),
      }),
    ),
});
type Datos = z.infer<typeof base>;

const crearEsquema = (edicion: boolean) =>
  base
  .refine((d) => edicion || (d.systolicManual && d.diastolicManual) || (d.systolicAuto && d.diastolicAuto), {
    message: 'Registra al menos una toma completa (sistólica y diastólica), manual o automática.',
    path: ['systolicManual'],
  })
  .refine((d) => edicion || d.weightKg !== undefined, { message: 'Requerido', path: ['weightKg'] })
  .refine((d) => edicion || d.heightM !== undefined, { message: 'Requerida', path: ['heightM'] })
  // Casi siempre es un error al teclear: la diastólica es la de abajo.
  .refine((d) => !(d.systolicManual && d.diastolicManual && d.diastolicManual >= d.systolicManual), { message: 'La diastólica debe ser menor que la sistólica', path: ['diastolicManual'] })
  .refine((d) => !(d.systolicAuto && d.diastolicAuto && d.diastolicAuto >= d.systolicAuto), { message: 'La diastólica debe ser menor que la sistólica', path: ['diastolicAuto'] })
  .refine((d) => d.intervalo !== 'otro' || d.diasOtro, { message: 'Indica los días', path: ['diasOtro'] })
  .refine((d) => new Set(d.recetas.map((r) => r.medicationId)).size === d.recetas.length, {
    message: 'Hay un medicamento repetido.',
    path: ['recetas'],
  });

/**
 * La visita se elige por día; la hora se conserva: la de ahora al registrarla, la que tenía al corregirla
 * (así varias del mismo día siguen en su orden).
 */
const conHora = (dia: string, hora: Date) => {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(a, m - 1, d, hora.getHours(), hora.getMinutes(), hora.getSeconds());
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
function estimarCumplimiento(anterior: { receta: Receta; fecha: string } | null, fechaVisita: string, quedan: number | undefined) {
  // Vacío = no le quedaba ninguna.
  const sobrante = quedan === undefined || Number.isNaN(quedan) ? 0 : quedan;
  if (!anterior) return null;
  const dias = Math.round((new Date(fechaVisita).getTime() - new Date(anterior.fecha).getTime()) / DIA_MS);
  const tenia = anterior.receta.quantityDispensed + anterior.receta.patientSupplyRemaining;
  const debia = Math.min(anterior.receta.dailyDose * dias, tenia);
  if (debia <= 0) return null;
  return Math.min(100, (Math.max(0, tenia - sobrante) / debia) * 100);
}


/**
 * Campo solo de dígitos, con tope de largo (la presión no pasa de 3). type="text" porque
 * type="number" no respeta maxLength y deja escribir letras como la "e".
 */
function digitos<N extends Parameters<UseFormRegister<Datos>>[0]>(register: UseFormRegister<Datos>, nombre: N, max: number) {
  const r = register(nombre, comoNumero);
  return {
    ...r,
    type: 'text',
    inputMode: 'numeric' as const,
    pattern: '[0-9]*',
    maxLength: max,
    autoComplete: 'off',
    onChange: (ev: React.ChangeEvent<HTMLInputElement>) => {
      ev.target.value = ev.target.value.replace(/\D/g, '').slice(0, max);
      return r.onChange(ev);
    },
  };
}

/** Enter pasa al siguiente campo (como Tab) en vez de guardar: así se llena la visita sin soltar el teclado. */
function siguienteCampo(ev: React.KeyboardEvent<HTMLFormElement>) {
  if (ev.key !== 'Enter' || ev.shiftKey) return;
  const actual = ev.target as HTMLElement;
  if (actual.tagName !== 'INPUT' || (actual as HTMLInputElement).type === 'checkbox') return;
  ev.preventDefault();
  const campos = [...ev.currentTarget.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input:not([type=hidden]):not([type=checkbox]):not([disabled]), textarea')].filter(
    (c) => c.offsetParent !== null,
  );
  const siguiente = campos[campos.indexOf(actual as HTMLInputElement) + 1];
  if (siguiente) {
    siguiente.focus();
    if (siguiente instanceof HTMLInputElement && siguiente.type !== 'date') siguiente.select();
  }
}

/** Botones de un toque (tablet): elige una opción entre pocas. */
/** Número con − y + a los lados: en la tablet es más fácil que escribir. */
function Contador({ campo, valor, min, register, setValue }: { campo: `recetas.${number}.dailyDose` | `recetas.${number}.bufferDays`; valor: number | undefined; min: number; register: UseFormRegister<Datos>; setValue: UseFormSetValue<Datos> }) {
  const cambiar = (d: number) => setValue(campo, Math.max(min, (Number.isFinite(valor) ? (valor as number) : min) + d), { shouldDirty: true, shouldValidate: true });
  const boton = 'grid size-10 shrink-0 place-items-center rounded-lg border border-borde bg-superficie text-tenue hover:text-tinta disabled:opacity-40';
  return (
    <div className="flex items-center gap-1">
      <button type="button" className={boton} onClick={() => cambiar(-1)} disabled={(valor ?? min) <= min} aria-label="Menos">
        <Minus className="size-4" />
      </button>
      <Entrada enterKeyHint="next" className="h-10 w-12 px-1 text-center text-base font-medium" {...digitos(register, campo, 2)} />
      <button type="button" className={boton} onClick={() => cambiar(1)} aria-label="Más">
        <Plus className="size-4" />
      </button>
    </div>
  );
}

function FilaReceta({
  indice,
  control,
  register,
  setValue,
  medicamentos,
  historial,
  alQuitar,
  errores,
  correccion,
}: {
  /** Al corregir una visita: lo que ya se había entregado de esa receta y si es del Excel (no mueve inventario). */
  correccion?: { antes: Receta[]; importada: boolean };
  indice: number;
  control: Control<Datos>;
  register: UseFormRegister<Datos>;
  setValue: UseFormSetValue<Datos>;
  medicamentos: Medicamento[];
  historial: Visita[];
  alQuitar: () => void;
  errores?: Partial<Record<'medicationId' | 'dailyDose' | 'bufferDays' | 'patientSupplyRemaining' | 'entregadas', { message?: string }>>;
}) {
  const [receta, fecha, intervalo, diasOtro, entregarAhora] = useWatch({ control, name: [`recetas.${indice}`, 'visitDate', 'intervalo', 'diasOtro', 'entregar'] });
  const med = medicamentos.find((m) => m.id === Number(receta.medicationId));
  // Misma cuenta que el backend: dosis × días + margen − lo que le queda.
  const total = (receta.dailyDose || 0) * diasDe({ intervalo, diasOtro }) + (receta.bufferDays || 0);
  const entregar = Math.max(0, total - (receta.patientSupplyRemaining || 0));
  const anterior = med ? recetaAnterior(historial, med.id) : null;
  const cumplimiento = estimarCumplimiento(anterior, fecha, receta.patientSupplyRemaining);
  const hay = med ? Math.max(0, med.vigente ?? med.currentStock) : undefined;
  // Al corregir: lo que sale o vuelve al inventario por la diferencia con lo que ya se había entregado.
  const entregadasAntes = correccion?.antes.find((r) => r.id === receta.id && r.medicationId === Number(receta.medicationId))?.quantityDispensed ?? 0;
  const diferencia = correccion ? (receta.entregadas ?? 0) - entregadasAntes : 0;
  const noAlcanza = !!correccion && !correccion.importada && diferencia > 0 && hay !== undefined && diferencia > hay;

  // Lo que se entrega y lo que dice el inventario, en una línea debajo de los campos.
  const entrega = correccion ? (
    <>
      <span>
        Le corresponden <strong className="text-tinta">{entregar}</strong>
      </span>
      {!correccion.importada && diferencia !== 0 && (
        <span className={cn('font-medium', diferencia > 0 ? (noAlcanza ? 'text-red-600' : 'text-amber-800') : 'text-green-700')}>
          {diferencia > 0 ? `Salen ${diferencia} más del inventario` : `Vuelven ${-diferencia} al inventario`}
        </span>
      )}
      {correccion.importada && <span>Visita del Excel: no mueve el inventario</span>}
    </>
  ) : !entregarAhora ? (
    <span>
      Le corresponden <strong className="text-tinta">{entregar}</strong> · se entregan en la mesa de farmacia
    </span>
  ) : hay !== undefined && hay < entregar ? (
    // No alcanza: se entrega lo que hay y el resto queda pendiente (la visita se guarda igual).
    <span className="text-amber-800">
      Le corresponden <strong>{entregar}</strong> · hay {hay}: se entregan {hay} y quedan <strong>{entregar - hay} pendientes</strong>
    </span>
  ) : (
    <span>
      Se entregan <strong className="text-sm text-tinta">{entregar}</strong>
      {hay !== undefined && ` · quedan ${(hay - entregar).toLocaleString('es-DO')} en inventario`}
    </span>
  );

  return (
    <li className="px-5 py-3.5 even:bg-fondo/60">
      <div
        className={cn(
          'grid grid-cols-2 items-start gap-x-3 gap-y-3',
          correccion ? 'md:grid-cols-[minmax(11rem,1fr)_auto_auto_5.5rem_5.5rem_auto]' : 'md:grid-cols-[minmax(11rem,1fr)_auto_auto_6rem_auto]',
        )}
      >
        <div className="col-span-2 flex items-start gap-2 md:col-span-1">
          <Campo etiqueta="Medicamento" error={errores?.medicationId?.message} className="min-w-0 flex-1">
            <Selector
              vacio="Elegir…"
              className="h-10"
              {...register(`recetas.${indice}.medicationId`)}
              opciones={medicamentos.map((m) => ({ value: m.id, label: `${m.name} ${m.concentration}` }))}
            />
          </Campo>
          {/* En el teléfono, quitar va junto al medicamento */}
          <button type="button" onClick={alQuitar} className="mt-6 grid size-10 shrink-0 place-items-center rounded-lg bg-red-50/70 text-red-600/80 transition-colors hover:bg-red-100 hover:text-red-700 md:hidden" aria-label="Quitar medicamento">
            <X className="size-4" />
          </button>
        </div>
        <Campo etiqueta="Al día" error={errores?.dailyDose?.message}>
          <Contador campo={`recetas.${indice}.dailyDose`} valor={receta.dailyDose} min={1} register={register} setValue={setValue} />
        </Campo>
        <Campo etiqueta="Margen (días)" error={errores?.bufferDays?.message}>
          <Contador campo={`recetas.${indice}.bufferDays`} valor={receta.bufferDays} min={0} register={register} setValue={setValue} />
        </Campo>
        <Campo etiqueta="Le quedan" error={errores?.patientSupplyRemaining?.message}>
          <Entrada
            placeholder="0"
            title="Vacío si no trajo ninguna"
            enterKeyHint="next"
            className="h-10 text-center text-base font-medium"
            {...digitos(register, `recetas.${indice}.patientSupplyRemaining`, 4)}
            aria-invalid={!!errores?.patientSupplyRemaining}
          />
        </Campo>
        {correccion && (
          <Campo etiqueta="Entregadas" error={errores?.entregadas?.message ?? (noAlcanza ? `Hay ${hay} en inventario` : undefined)}>
            <Entrada enterKeyHint="next" className="h-10 text-center text-base font-semibold" {...digitos(register, `recetas.${indice}.entregadas`, 4)} aria-invalid={noAlcanza || !!errores?.entregadas} />
          </Campo>
        )}
        <button
          type="button"
          onClick={alQuitar}
          className="mt-6 hidden size-10 shrink-0 place-items-center rounded-lg bg-red-50/70 text-red-600/80 transition-colors hover:bg-red-100 hover:text-red-700 md:grid"
          aria-label="Quitar medicamento"
          title="Quitar medicamento"
        >
          <X className="size-4" />
        </button>
      </div>
      {/* Lo que se entrega, el cumplimiento y lo de la vez pasada (para contar y comparar) */}
      <p className="tabular mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs text-tenue">
        {entrega}
        <span>
          Cumplimiento{' '}
          {cumplimiento === null ? (
            <span>{!anterior ? 'primera vez con este medicamento' : 'la receta anterior es de este mismo día'}</span>
          ) : (
            <strong className={colorCumplimiento(cumplimiento)}>{cumplimiento.toFixed(0)}%</strong>
          )}
        </span>
        {anterior && (
          <span className="text-tenue/90">
            La vez pasada ({fechaCorta(anterior.fecha)}): {anterior.receta.dailyDose} al día, {anterior.receta.quantityDispensed} entregadas
            {anterior.receta.patientSupplyRemaining > 0 && `, le quedaban ${anterior.receta.patientSupplyRemaining}`}
          </span>
        )}
      </p>
    </li>
  );
}

type Props = {
  paciente: Paciente;
  /** Corregir esta visita en vez de registrar una nueva (la misma pantalla, con sus datos). */
  visita?: Visita;
  /** Al corregir, la administración puede cambiar quién atendió. */
  medicos?: { value: number; label: string }[];
  /** En la jornada va en un modal: una sola columna, sin resumen lateral fijo. */
  enModal?: boolean;
  /** Sin visita cuando quedó guardada sin internet (se envía después) o al corregir. */
  alGuardar: (v?: Visita) => void;
};

/** Los <select> precargados necesitan sus opciones al montarse, si no se quedan en "Elegir…". */
export function FormularioVisita(props: Props) {
  const configs = useConfigPA();
  const medicamentos = useMedicamentos();
  if (!configs.data || !medicamentos.data) return <Cargando />;
  return <Formulario {...props} configs={configs.data} medicamentos={medicamentos.data} />;
}

const local = (iso: string | null | undefined) => (iso ? ymd(new Date(iso)) : '');
const aNumero = (v: unknown) => (v === null || v === undefined || v === '' ? undefined : Number(v));

/** Los datos guardados de una visita, en la forma del formulario (para corregirla). */
function valoresDe(v: Visita): Datos {
  const dias = v.nextVisitDate ? Math.round((new Date(v.nextVisitDate).getTime() - new Date(v.visitDate).getTime()) / DIA_MS) : 90;
  return {
    visitDate: local(v.visitDate),
    visitType: v.visitType,
    isHomeVisit: v.isHomeVisit,
    entregar: true,
    weightKg: aNumero(v.weightKg),
    heightM: aNumero(v.heightM),
    systolicManual: aNumero(v.systolicManual),
    diastolicManual: aNumero(v.diastolicManual),
    systolicAuto: aNumero(v.systolicAuto),
    diastolicAuto: aNumero(v.diastolicAuto),
    heartRate: aNumero(v.heartRate),
    oxygenSaturation: aNumero(v.oxygenSaturation),
    temperature: aNumero(v.temperature),
    reason: v.reason ?? '',
    notes: v.notes ?? '',
    prescriptionText: v.prescriptionText ?? '',
    intervalo: dias === 90 ? '90' : dias === 30 ? '30' : 'otro',
    diasOtro: dias === 90 || dias === 30 ? undefined : Math.max(7, dias),
    doctorId: String(v.doctorId),
    recetas: (v.prescriptions ?? []).map((r) => ({
      id: r.id,
      medicationId: String(r.medicationId),
      dailyDose: r.dailyDose,
      bufferDays: r.bufferDays,
      patientSupplyRemaining: r.patientSupplyRemaining,
      entregadas: r.quantityDispensed,
    })),
  };
}

function Formulario({ paciente, visita: editada, medicos, enModal, alGuardar, configs, medicamentos }: Props & { configs: ConfigPA[]; medicamentos: Medicamento[] }) {
  const { usuario } = useSesion();
  const edicion = !!editada;
  const confirmar = useConfirmar();
  const entregaInmediata = (useConfiguracion().data?.entregaInmediata ?? 1) === 1;
  const cliente = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  // Al corregir, las "anteriores" son las de antes de esa visita.
  const historial = (paciente.clinicalVisits ?? []).filter((v) => !editada || (v.id !== editada.id && new Date(v.visitDate) < new Date(editada.visitDate)));
  const ultima = historial[0];

  const { register, handleSubmit, control, formState, setValue } = useForm<Datos>({
    resolver: zodResolver(crearEsquema(edicion)),
    defaultValues: editada
      ? valoresDe(editada)
      : {
          visitDate: ymd(new Date()),
          visitType: ultima ? 'FOLLOW_UP' : 'NEW',
          isHomeVisit: false,
          entregar: entregaInmediata,
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
            // Las recetas importadas del Excel traen 0 días de margen: se proponen los 5 de siempre.
            bufferDays: margenDe(r),
            patientSupplyRemaining: undefined,
          })),
        },
  });
  const recetas = useFieldArray({ control, name: 'recetas' });
  const e = formState.errors;

  const [sm, dm, sa, da, peso, talla, intervalo, diasOtro, fc, spo2, temperatura, recetasHoy, fechaHoy, tipo] = useWatch({
    control,
    name: ['systolicManual', 'diastolicManual', 'systolicAuto', 'diastolicAuto', 'weightKg', 'heightM', 'intervalo', 'diasOtro', 'heartRate', 'oxygenSaturation', 'temperature', 'recetas', 'visitDate', 'visitType'],
  });
  const s = sm ?? sa;
  const d = dm ?? da;
  const categoria = s && d ? clasificar(configs, s, d) : null;
  // La fecha en que le toca volver, para decírsela al paciente.
  const diasProxima = diasDe({ intervalo, diasOtro });
  const proxima =
    fechaHoy && diasProxima > 0
      ? new Intl.DateTimeFormat('es-DO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(conHora(fechaHoy, new Date(2000, 0, 1, 12)).getTime() + diasProxima * DIA_MS)
      : null;
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

  /** Corregir una visita: los mismos campos; lo vacío se borra y los medicamentos mueven el inventario por la diferencia. */
  const corregir = async (datos: Datos) => {
    const v = editada!;
    const fecha = conHora(datos.visitDate, new Date(v.visitDate));
    const nulo = <T,>(x: T | undefined) => (x === undefined || (typeof x === 'number' && Number.isNaN(x)) ? null : x);
    const cambios: CambiosVisita = {
      visitDate: fecha.toISOString(),
      nextVisitDate: new Date(fecha.getTime() + diasDe(datos) * DIA_MS).toISOString(),
      visitType: datos.visitType,
      isHomeVisit: datos.isHomeVisit,
      weightKg: nulo(datos.weightKg),
      heightM: nulo(datos.heightM),
      systolicManual: nulo(datos.systolicManual),
      diastolicManual: nulo(datos.diastolicManual),
      systolicAuto: nulo(datos.systolicAuto),
      diastolicAuto: nulo(datos.diastolicAuto),
      heartRate: nulo(datos.heartRate),
      oxygenSaturation: nulo(datos.oxygenSaturation),
      temperature: nulo(datos.temperature),
      reason: datos.reason || null,
      notes: datos.notes || null,
      prescriptionText: datos.prescriptionText || null,
      ...(medicos && datos.doctorId && Number(datos.doctorId) !== v.doctorId && { doctorId: Number(datos.doctorId) }),
    };
    // Los medicamentos solo se mandan si cambiaron: mueven el inventario.
    const nuevas = datos.recetas.map((r) => ({
      ...(r.id && { id: r.id }),
      medicationId: Number(r.medicationId),
      dailyDose: r.dailyDose,
      bufferDays: r.bufferDays,
      patientSupplyRemaining: r.patientSupplyRemaining ?? 0,
      entregadas: r.entregadas ?? 0,
    }));
    const antes = (v.prescriptions ?? []).map((r) => ({ id: r.id, medicationId: r.medicationId, dailyDose: r.dailyDose, bufferDays: r.bufferDays, patientSupplyRemaining: r.patientSupplyRemaining, entregadas: r.quantityDispensed }));
    if (JSON.stringify(nuevas) !== JSON.stringify(antes)) {
      // Un dedo de más (89 → 8960) sacaría miles de pastillas: se confirma antes.
      const dias = diasDe(datos);
      const raras = datos.recetas.some((r) => {
        const debe = Math.max(0, r.dailyDose * dias + r.bufferDays - (r.patientSupplyRemaining ?? 0));
        return (r.entregadas ?? 0) > Math.max(debe * 1.5, debe + 30);
      });
      if (
        raras &&
        !(await confirmar({
          titulo: '¿Seguro de esas cantidades?',
          mensaje: `Las entregadas son mucho más de lo que le corresponde${v.importada ? '' : ' y salen del inventario'}. Revisa que no sobre un número.`,
          confirmar: 'Sí, guardar',
          peligro: true,
        }))
      )
        return;
      cambios.recetas = nuevas;
    }
    try {
      await editarVisita(v.id, cambios);
      for (const k of [['visitas'], ['visita'], ['paciente'], ['pacientes'], ['jornada'], ['stats'], ['medicos'], ['auditoria'], ['medicamentos'], ['entregas']]) cliente.invalidateQueries({ queryKey: k });
      toast.success('Visita corregida. El cambio quedó registrado en Auditoría.');
      alGuardar();
    } catch (err) {
      const m = err instanceof Error ? err.message : '';
      setError(m.includes('No BP Configuration') ? 'Esos valores de presión no caen en ningún rango de la clasificación. Revisa la toma.' : mensajeEntrega(m) || 'No se pudo guardar la corrección.');
    }
  };

  const enviar = handleSubmit(async (datos) => {
    setError(null);
    if (edicion) return corregir(datos);
    const fecha = conHora(datos.visitDate, new Date());
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
      weightKg: datos.weightKg!,
      heightM: datos.heightM!,
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
      prescriptions: datos.recetas.map(({ id: _id, entregadas: _e, ...r }) => ({ ...r, medicationId: Number(r.medicationId), patientSupplyRemaining: r.patientSupplyRemaining ?? 0, daysUntilNextVisit: dias })),
      entregar: datos.entregar,
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
      for (const k of [['paciente', paciente.id], ['pacientes'], ['visitas'], ['stats'], ['jornada'], ['medicamentos'], ['entregas']]) {
        cliente.invalidateQueries({ queryKey: k });
      }
      if (v.pendientes?.length) {
        toast.warning(`Visita registrada. No alcanzó el inventario: quedan pendientes ${v.pendientes.map((p) => `${p.indicada - p.entregada} de ${p.medicamento}`).join(', ')}.`, { duration: 10_000 });
      } else if (datos.recetas.length && v.entregada === false) {
        toast.success('Visita registrada. Los medicamentos quedaron para la mesa de farmacia.');
      } else toast.success('Visita registrada');
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

  const campoNum = (nombre: 'temperature' | 'heartRate' | 'oxygenSaturation', etiqueta: string, extra: Record<string, unknown> = {}) => (
    <Campo etiqueta={etiqueta} error={e[nombre]?.message}>
      <Entrada type="number" inputMode="decimal" enterKeyHint="next" {...extra} {...register(nombre, comoNumero)} aria-invalid={!!e[nombre]} />
    </Campo>
  );
  // La toma: números grandes, fáciles de leer y tocar en la tablet.
  const cifra = (nombre: 'systolicManual' | 'diastolicManual' | 'systolicAuto' | 'diastolicAuto', etiqueta: string, grande = true) => (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-tenue">{etiqueta}</span>
      <Entrada
        placeholder="—"
        enterKeyHint="next"
        autoFocus={!edicion && nombre === 'systolicManual'}
        onFocus={(ev) => ev.currentTarget.select()}
        className={cn('text-center font-mono font-semibold tracking-tight placeholder:font-normal placeholder:text-tenue/40', grande ? 'h-14 w-24 text-3xl sm:w-28 xl:w-24' : 'h-11 w-20 text-xl sm:w-24 xl:w-20')}
        {...digitos(register, nombre, 3)}
        aria-invalid={!!e[nombre]}
      />
      {e[nombre] && e[nombre]?.type !== 'custom' && <span className="text-xs text-red-600">{e[nombre]?.message}</span>}
    </label>
  );

  // Última toma válida, para comparar mientras se escribe la de hoy.
  const conToma = historial.find((v) => (v.systolicManual ?? v.systolicAuto) && (v.diastolicManual ?? v.diastolicAuto));
  const anterior = conToma ? { s: (conToma.systolicManual ?? conToma.systolicAuto)!, d: (conToma.diastolicManual ?? conToma.diastolicAuto)! } : null;
  const signo = (x: number) => (x > 0 ? `+${x}` : String(x));
  const comparacion = s && d && anterior && (
    <span className="text-xs text-tenue">
      {edicion ? 'Anterior' : 'Última'}: <span className="font-mono">{anterior.s}/{anterior.d}</span>{' '}
      <span className={cn('font-medium', s - anterior.s > 0 ? 'text-red-600' : s - anterior.s < 0 ? 'text-green-700' : '')}>
        ({signo(s - anterior.s)}/{signo(d - anterior.d)})
      </span>
    </span>
  );
  const tomaInvertida = !!((sm && dm && dm >= sm) || (sa && da && da >= sa));

  // Lo que falta para poder guardar, en palabras (al corregir, lo vacío se permite).
  const falta = [
    !edicion && !(s && d) && 'la toma de presión',
    !edicion && !(peso && Number.isFinite(peso)) && 'el peso',
    !edicion && !(talla && Number.isFinite(talla)) && 'la estatura',
    recetasHoy.some((r) => !r.medicationId) && 'elegir el medicamento',
  ].filter(Boolean) as string[];
  const sinCambios = edicion && !formState.isDirty;
  const listo = falta.length === 0;
  const textoFalta = sinCambios ? 'Sin cambios todavía' : listo ? (edicion ? 'Listo para guardar la corrección' : 'Listo para guardar') : `Falta: ${falta.join(', ')}`;
  const pesoAnterior = historial.find((v) => v.weightKg)?.weightKg;
  const errorGeneral = error ?? (e.systolicManual?.type === 'custom' ? e.systolicManual.message : undefined) ?? e.recetas?.message;
  const textoGuardar = edicion ? 'Guardar corrección' : 'Guardar visita';

  const resumen = (
    <Tarjeta titulo="Resumen">
      <dl className="space-y-4 p-5">
        <div>
          <dt className="text-xs text-tenue">Presión</dt>
          <dd className="tabular mt-1 font-mono text-2xl font-medium">{s && d ? `${s}/${d}` : '—/—'}</dd>
          {comparacion && <dd className="mt-0.5">{comparacion}</dd>}
        </div>
        <div>
          <dt className="mb-1 text-xs text-tenue">Clasificación</dt>
          <dd>{s && d ? <InsigniaCategoria config={categoria} /> : <span className="text-sm text-tenue">{edicion ? 'Sin toma: quedará sin clasificar' : 'Falta la toma'}</span>}</dd>
        </div>
        <div>
          <dt className="text-xs text-tenue">IMC</dt>
          <dd className="tabular mt-1 font-mono text-lg">{imc && Number.isFinite(imc) ? imc.toFixed(1) : '—'}</dd>
        </div>
      </dl>
      {alertas.length > 0 && <ListaAlertas alertas={alertas} className="mx-5 mb-4" />}
      <p className={cn('mx-5 mb-4 flex gap-2 rounded-lg px-3 py-2 text-sm', sinCambios ? 'bg-fondo text-tenue' : listo ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900')}>
        {listo ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <AlertCircle className="mt-0.5 size-4 shrink-0" />}
        {textoFalta}
      </p>
      {errorGeneral && <p className="mx-5 mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorGeneral}</p>}
      <div className="border-t border-borde p-5">
        <Boton type="submit" className="h-11 w-full" cargando={formState.isSubmitting} disabled={sinCambios} icono={<Save className="size-4" />}>
          {textoGuardar}
        </Boton>
      </div>
    </Tarjeta>
  );

  const agregarMedicamento = () => {
    const dias = diasDe({ intervalo, diasOtro });
    recetas.append({ medicationId: '', dailyDose: 1, bufferDays: 5, patientSupplyRemaining: undefined, ...(edicion && { entregadas: dias + 5 }) });
  };

  return (
    <form onSubmit={enviar} onKeyDown={siguienteCampo} noValidate className={cn('grid grid-cols-1 gap-4', !enModal && 'xl:grid-cols-[minmax(0,1fr)_300px]')}>
      <div className="min-w-0 space-y-4">
        <Tarjeta titulo={edicion ? 'Signos de la visita' : 'Signos de hoy'} accion={<span className="hidden text-xs text-tenue sm:inline">{edicion ? 'mmHg · deja vacío para borrar un valor mal anotado' : 'mmHg · la manual manda sobre la automática'}</span>}>
          {/* En pantallas anchas, la presión a la izquierda y el peso a la derecha: no queda medio renglón vacío */}
          <div className="grid xl:grid-cols-[auto_minmax(0,1fr)]">
          <div className="flex flex-wrap items-stretch gap-x-8 gap-y-4 p-5 xl:gap-x-6">
            <fieldset className="min-w-0">
              <legend className="mb-1.5 text-[13px] font-medium text-tinta/80">Presión manual</legend>
              <div className="flex items-end gap-2">
                {cifra('systolicManual', 'Sistólica')}
                <span className="pb-2.5 text-3xl text-tenue/40" aria-hidden>
                  /
                </span>
                {cifra('diastolicManual', 'Diastólica')}
              </div>
            </fieldset>
            <fieldset className="min-w-0">
              <legend className="mb-1.5 text-[13px] font-medium text-tinta/80">
                Automática <span className="font-normal text-tenue">· opcional</span>
              </legend>
              <div className="flex items-end gap-2">
                {cifra('systolicAuto', 'Sistólica', false)}
                <span className="pb-2 text-2xl text-tenue/40" aria-hidden>
                  /
                </span>
                {cifra('diastolicAuto', 'Diastólica', false)}
              </div>
            </fieldset>
            {/* Lo que dice la toma, en cuanto se escribe. En escritorio ya lo muestra el Resumen. */}
            <div className={cn('flex min-w-44 flex-1 flex-col items-start justify-center gap-1 rounded-lg bg-fondo px-4 py-2.5', !enModal && 'xl:hidden')}>
              <span className="text-xs text-tenue">{sm && dm ? 'Toma manual' : sa && da ? 'Toma automática' : 'Clasificación'}</span>
              {tomaInvertida ? (
                // Casi siempre es un error al teclear (se invirtieron los números).
                <span className="text-sm font-medium text-red-700">La diastólica debe ser menor que la sistólica. Revisa la toma.</span>
              ) : s && d ? (
                <>
                  <span className="tabular font-mono text-2xl font-semibold">
                    {s}/{d}
                  </span>
                  <InsigniaCategoria config={categoria} />
                  {comparacion}
                </>
              ) : (
                <span className="text-sm text-tenue">{anterior ? `La ${edicion ? 'anterior' : 'última'} fue ${anterior.s}/${anterior.d}` : 'Primera toma del paciente'}</span>
              )}
            </div>
            {/* En escritorio, el aviso de la toma invertida va bajo los campos */}
            {tomaInvertida && !enModal && <p className="hidden w-full text-sm font-medium text-red-700 xl:block">La diastólica debe ser menor que la sistólica. Revisa la toma.</p>}
          </div>
          <div className="grid grid-cols-2 content-start gap-x-4 gap-y-3 border-t border-borde px-5 py-4 sm:grid-cols-[9rem_9rem_minmax(0,1fr)] xl:grid-cols-2 xl:border-t-0 xl:border-l xl:py-5">
            <Campo etiqueta="Peso (kg)" error={e.weightKg?.message} ayuda={pesoAnterior ? `${edicion ? 'Antes' : 'Último'}: ${Number(pesoAnterior)} kg` : undefined}>
              <Entrada
                type="number"
                inputMode="decimal"
                step="0.1"
                enterKeyHint="next"
                className="h-10 text-base"
                {...register('weightKg', comoNumero)}
                aria-invalid={!!e.weightKg}
              />
            </Campo>
            <Campo etiqueta="Estatura (m)" error={e.heightM?.message} ayuda={!edicion && historial.some((v) => v.heightM) ? 'De la última visita' : 'En metros, p. ej. 1.62'}>
              <Entrada type="number" inputMode="decimal" step="0.01" enterKeyHint="next" className="h-10 text-base" {...register('heightM', comoNumero)} aria-invalid={!!e.heightM} />
            </Campo>
            <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1 xl:col-span-2 xl:flex-row xl:items-baseline xl:gap-3">
              <span className="text-[13px] font-medium text-tinta/80">IMC</span>
              <span className="tabular flex h-10 items-center font-mono text-lg xl:h-auto">
                {imc && Number.isFinite(imc) ? (
                  <>
                    {imc.toFixed(1)}
                    <span className="ml-2 font-sans text-sm text-tenue">{imc < 18.5 ? 'bajo peso' : imc < 25 ? 'normal' : imc < 30 ? 'sobrepeso' : 'obesidad'}</span>
                  </>
                ) : (
                  <span className="text-tenue">—</span>
                )}
              </span>
            </div>
          </div>
          </div>
        </Tarjeta>

        {/* En tablet, las alertas justo debajo de la toma (en escritorio van en el resumen) */}
        {!enModal && alertas.length > 0 && <ListaAlertas alertas={alertas} className="xl:hidden" />}

        <Tarjeta
          titulo={edicion ? 'Medicamentos entregados' : 'Medicamentos'}
          accion={
            <div className="flex items-center gap-3">
              {edicion && <span className="hidden text-xs text-tenue sm:inline">{editada!.importada ? 'Visita del Excel: no mueve el inventario' : 'Al guardar se ajusta el inventario'}</span>}
              <Boton variante="fantasma" className="h-8 bg-marca-50 text-marca-700 hover:bg-marca-100 hover:text-marca-700" icono={<Plus className="size-4" />} onClick={agregarMedicamento}>
                Agregar
              </Boton>
            </div>
          }
        >
          {recetas.fields.length === 0 ? (
            <p className="px-5 py-4 text-sm text-tenue">Sin medicamentos en esta visita.</p>
          ) : (
            <>
              <ul className="divide-y divide-borde">
                {recetas.fields.map((f, i) => (
                  <FilaReceta
                    key={f.id}
                    indice={i}
                    control={control}
                    register={register}
                    setValue={setValue}
                    medicamentos={medicamentos}
                    historial={historial}
                    alQuitar={() => recetas.remove(i)}
                    errores={e.recetas?.[i]}
                    correccion={editada ? { antes: editada.prescriptions ?? [], importada: !!editada.importada } : undefined}
                  />
                ))}
              </ul>
              {!edicion && (
                <div className="border-t border-borde px-5 py-3">
                  <Casilla etiqueta="Entregar los medicamentos ahora" {...register('entregar')} />
                  <p className="mt-1 ml-6 text-xs text-tenue">Si lo desmarcas, quedan pendientes y se entregan en la mesa de farmacia (Entregas).</p>
                </div>
              )}
            </>
          )}
          {/* Quitar uno que ya existía devuelve al inventario todo lo que se le entregó */}
          {edicion && !editada!.importada && (() => {
            const quitados = (editada!.prescriptions ?? []).filter((r) => r.quantityDispensed > 0 && !recetasHoy.some((x) => x.id === r.id && Number(x.medicationId) === r.medicationId));
            return quitados.length > 0 ? (
              <p className="border-t border-borde bg-green-50 px-5 py-2.5 text-xs text-green-800">
                {quitados.map((r) => `${r.medication?.name ?? 'Medicamento'} ${r.medication?.concentration ?? ''}: vuelven ${r.quantityDispensed} al inventario`).join(' · ')}
              </p>
            ) : null;
          })()}
        </Tarjeta>

        <Tarjeta titulo="Fecha, próxima visita y comentario">
          <div className="grid gap-x-4 gap-y-3 p-5 sm:grid-cols-2">
            <Campo etiqueta="Fecha de la visita" error={e.visitDate?.message}>
              <Controller
                control={control}
                name="visitDate"
                render={({ field }) => <SelectorFecha className="h-10" value={field.value} onChange={field.onChange} max={ymd(new Date())} aria-invalid={!!e.visitDate} aria-label="Fecha de la visita" />}
              />
            </Campo>
            <Campo etiqueta="Dónde" grupo>
              <Controller
                control={control}
                name="isHomeVisit"
                render={({ field }) => (
                  <Segmentos
                    etiqueta="Dónde fue la visita"
                    valor={field.value ? 'casa' : 'batey'}
                    alCambiar={(v) => field.onChange(v === 'casa')}
                    opciones={[
                      { value: 'batey', label: 'En la jornada' },
                      { value: 'casa', label: 'En su casa' },
                    ]}
                  />
                )}
              />
            </Campo>
            <Campo etiqueta="Próxima visita" error={e.diasOtro?.message} grupo ayuda={proxima && `Le toca volver el ${proxima}`}>
              <input type="hidden" {...register('intervalo')} />
              <Segmentos
                etiqueta="Próxima visita"
                valor={intervalo}
                alCambiar={(v) => setValue('intervalo', v, { shouldDirty: true, shouldValidate: true })}
                opciones={[
                  { value: '90', label: 'En 3 meses' },
                  { value: '30', label: 'En 1 mes' },
                  { value: 'otro', label: 'Otro' },
                ]}
              />
              {intervalo === 'otro' && <Entrada type="number" inputMode="numeric" min={7} enterKeyHint="next" placeholder="Días hasta la próxima visita" className="mt-1 h-10" {...register('diasOtro', comoNumero)} />}
            </Campo>
            <Campo etiqueta="Tipo de visita" grupo>
              <input type="hidden" {...register('visitType')} />
              <Segmentos
                etiqueta="Tipo de visita"
                valor={tipo}
                alCambiar={(v) => setValue('visitType', v, { shouldDirty: true })}
                opciones={opciones(TIPOS_VISITA).map((o) => ({ value: String(o.value) as Datos['visitType'], label: o.label }))}
              />
            </Campo>
            {medicos && (
              <Campo etiqueta="Atendió" ayuda="Solo administración" className="sm:col-span-2">
                <Selector className="h-10" {...register('doctorId')} opciones={medicos} />
              </Campo>
            )}
          </div>
          <div className="space-y-3 border-t border-borde px-5 py-4">
            <AreaTexto rows={2} aria-label="Comentario" {...register('notes')} placeholder="Comentario: adherencia, síntomas, observaciones para la próxima clínica…" />
            <details className="group" open={edicion && !!(editada!.reason || editada!.prescriptionText || editada!.heartRate || editada!.oxygenSaturation || editada!.temperature)}>
              <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-tenue hover:text-tinta">
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" /> Más datos (motivo, signos vitales, indicaciones)
              </summary>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Campo etiqueta="Motivo de consulta" className="col-span-2 sm:col-span-3">
                  <Entrada enterKeyHint="next" {...register('reason')} />
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

        {/* Tablet y teléfono: la presión, lo que falta y Guardar siempre a mano */}
        {!enModal && (
          <div className="sticky bottom-0 z-20 -mx-4 border-t border-borde bg-superficie/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10 xl:hidden">
            {errorGeneral && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorGeneral}</p>}
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="tabular font-mono text-xl font-semibold">{s && d ? `${s}/${d}` : '—/—'}</span>
                  {s && d && <InsigniaCategoria config={categoria} />}
                </div>
                <p className={cn('truncate text-xs', sinCambios ? 'text-tenue' : listo ? 'text-green-700' : 'text-amber-800')}>{textoFalta}</p>
              </div>
              <Boton type="submit" className="h-11 shrink-0 px-5" cargando={formState.isSubmitting} disabled={sinCambios} icono={<Save className="size-4" />}>
                {textoGuardar}
              </Boton>
            </div>
          </div>
        )}
      </div>

      <aside className={cn('space-y-4', !enModal && 'xl:sticky xl:top-6 xl:max-h-[calc(100dvh-3rem)] xl:self-start xl:overflow-y-auto')}>
        {/* En tablet el resumen va en la barra de abajo; aquí queda el historial */}
        <div className={cn(!enModal && 'hidden xl:block')}>{resumen}</div>
        <HistorialVisitas visitas={historial} />
      </aside>
    </form>
  );
}
