import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Camera, CheckCircle2, Save, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useComunidades } from '../api/consultas';
import { crearPaciente, editarPaciente, quitarFotoPaciente, subirFotoPaciente, type DatosPaciente } from '../api/recursos';
import type { Paciente } from '../api/tipos';
import { ALCOHOL, ESTADOS, GENEROS, SAL, TABACO } from '../lib/etiquetas';
import { cn, edad, fecha, soloFecha } from '../lib/formato';
import { Avatar, Boton, Campo, Entrada, Segmentos, Selector, Tarjeta } from './ui';
import { SelectorFecha } from './SelectorFecha';

const hoy = () => new Date().toISOString().slice(0, 10);

const esquema = z.object({
  firstName: z.string().trim().min(1, 'Requerido'),
  lastName: z.string().trim().min(1, 'Requerido'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER'], 'Elige una opción'),
  edad: z.string().refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) <= 120), 'Revisa la edad'),
  birthDate: z
    .string()
    .min(1, 'Escribe la edad o la fecha de nacimiento')
    .refine((v) => v <= hoy(), 'No puede ser futura'),
  phoneNumber: z.string().trim(),
  address: z.string().trim(),
  communityId: z.coerce.number<string>().int().positive('Elige un batey'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DECEASED']),
  hasFamilyHistory: z.boolean(),
  consentimientoDatos: z.boolean(),
  saltIntake: z.enum(['YES', 'NO', 'REDUCED']),
  alcoholIntake: z.enum(['NO', 'OCCASIONAL', 'FREQUENT']),
  smokingStatus: z.enum(['NO', 'EX_SMOKER', 'ACTIVE']),
});
type Entrada_ = z.input<typeof esquema>;
type Salida = z.output<typeof esquema>;

export function FormularioPaciente({
  paciente,
  comunidadInicial,
  alTerminar,
}: {
  paciente?: Paciente;
  comunidadInicial?: number;
  alTerminar: (p: Paciente) => void;
}) {
  const comunidades = useComunidades();
  const cliente = useQueryClient();
  // Si la fecha salió de la edad, se guarda como aproximada (1 de enero de ese año).
  const [estimada, setEstimada] = useState(paciente?.birthDateIsEstimated ?? false);
  // Foto: se aplica al guardar, junto con los datos. Nueva foto elegida, o quitar la actual.
  const [fotoNueva, setFotoNueva] = useState<File | null>(null);
  const [quitarFoto, setQuitarFoto] = useState(false);
  const [vista, setVista] = useState<string | null>(null);
  const archivo = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!fotoNueva) return setVista(null);
    const url = URL.createObjectURL(fotoNueva);
    setVista(url);
    return () => URL.revokeObjectURL(url);
  }, [fotoNueva]);
  const fotoActual = vista ?? (quitarFoto ? null : (paciente?.photoUrl ?? null));
  const { register, handleSubmit, formState, setValue, watch, control } = useForm<Entrada_, unknown, Salida>({
    resolver: zodResolver(esquema),
    defaultValues: paciente
      ? {
          ...paciente,
          phoneNumber: paciente.phoneNumber ?? '',
          address: paciente.address ?? '',
          edad: String(edad(paciente.birthDate)),
          birthDate: soloFecha(paciente.birthDate),
          communityId: String(paciente.communityId),
          consentimientoDatos: paciente.consentimientoDatos ?? false,
        }
      : {
          firstName: '',
          lastName: '',
          phoneNumber: '',
          address: '',
          edad: '',
          birthDate: '',
          communityId: comunidadInicial ? String(comunidadInicial) : '',
          status: 'ACTIVE',
          hasFamilyHistory: false,
          consentimientoDatos: false,
          saltIntake: 'NO',
          alcoholIntake: 'NO',
          smokingStatus: 'NO',
        },
  });
  const e = formState.errors;
  const comunidadElegida = Number(watch('communityId'));

  // Edad y fecha se completan una con otra.
  const alCambiarEdad = (v: string) => {
    if (/^\d+$/.test(v) && Number(v) <= 120) {
      setValue('birthDate', `${new Date().getFullYear() - Number(v)}-01-01`, { shouldValidate: formState.isSubmitted });
      setEstimada(true);
    }
  };
  const alCambiarFecha = (v: string) => {
    if (v) {
      setValue('edad', String(edad(`${v}T00:00:00Z`)), { shouldValidate: formState.isSubmitted });
      setEstimada(false);
    }
  };

  const guardar = useMutation({
    mutationFn: async (d: Salida) => {
      const { edad: _edad, ...resto } = d;
      const datos: DatosPaciente = {
        ...resto,
        birthDate: new Date(`${d.birthDate}T00:00:00Z`).toISOString(),
        birthDateIsEstimated: estimada,
      };
      // Al crear, los opcionales vacíos no se mandan.
      if (!paciente) for (const k of ['phoneNumber', 'address'] as const) if (!datos[k]) delete datos[k];
      let p = paciente ? await editarPaciente(paciente.id, datos) : await crearPaciente(datos);
      // La foto va aparte (se sube como archivo).
      if (fotoNueva) p = await subirFotoPaciente(p.id, fotoNueva);
      else if (quitarFoto && paciente?.photoUrl) p = await quitarFotoPaciente(p.id);
      return p;
    },
    onSuccess: (p) => {
      for (const k of [['pacientes'], ['paciente', p.id], ['stats'], ['jornada']]) cliente.invalidateQueries({ queryKey: k });
      toast.success(paciente ? 'Paciente actualizado' : `Paciente registrado con código ${p.patientCode}`);
      alTerminar(p);
    },
    onError: (err) => toast.error(err.message),
  });

  const registroEdad = register('edad', { onChange: (ev) => alCambiarEdad(ev.target.value) });

  // Lo que se ve mientras se llena: para el resumen y la barra de abajo.
  const [nombres, apellidos, genero, edadTxt, nacimiento, consentimiento] = watch(['firstName', 'lastName', 'gender', 'edad', 'birthDate', 'consentimientoDatos']);
  const batey = comunidades.data?.find((c) => c.id === comunidadElegida);
  const falta = [
    !nombres?.trim() && 'nombres',
    !apellidos?.trim() && 'apellidos',
    !genero && 'sexo',
    !nacimiento && 'edad o fecha de nacimiento',
    !comunidadElegida && 'batey',
  ].filter(Boolean) as string[];
  const listo = falta.length === 0;
  const textoFalta = listo ? (consentimiento ? 'Listo para guardar' : 'Listo · falta marcar el consentimiento') : `Falta: ${falta.join(', ')}`;
  const textoGuardar = paciente ? 'Guardar cambios' : 'Registrar paciente';
  const nombreVista = [nombres, apellidos].filter((x) => x?.trim()).join(' ');

  const resumen = (
    <Tarjeta titulo={paciente ? 'Paciente' : 'Paciente nuevo'}>
      <div className="flex flex-col items-center gap-3 px-5 pt-6 pb-5 text-center">
        <Avatar persona={{ firstName: nombres || '?', lastName: apellidos || '' }} foto={fotoActual} tamano="size-20 text-xl" />
        <div className="min-w-0">
          <p className={cn('font-semibold text-balance', !nombreVista && 'text-tenue')}>{nombreVista || 'Sin nombre todavía'}</p>
          <p className="mt-0.5 text-sm text-tenue">
            {[genero && GENEROS[genero as keyof typeof GENEROS], edadTxt && `${estimada ? '~' : ''}${edadTxt} años`].filter(Boolean).join(' · ') || 'Sexo y edad'}
          </p>
        </div>
        <div className="w-full rounded-lg bg-fondo px-3 py-2.5">
          <p className="text-xs text-tenue">{batey ? batey.name : 'Sin batey'}</p>
          <p className="tabular mt-0.5 font-mono text-lg font-semibold tracking-wide">
            {paciente ? paciente.patientCode : batey ? `${batey.abbreviation}····` : '——'}
          </p>
          {!paciente && <p className="text-xs text-tenue">{batey ? 'El número se asigna al guardar' : 'El código sale del batey'}</p>}
        </div>
      </div>
      <p className={cn('mx-5 mb-4 flex gap-2 rounded-lg px-3 py-2 text-sm', listo ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900')}>
        {listo ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <AlertCircle className="mt-0.5 size-4 shrink-0" />}
        {textoFalta}
      </p>
      <div className="border-t border-borde p-5">
        <Boton type="submit" className="h-11 w-full" cargando={guardar.isPending} icono={<Save className="size-4" />}>
          {textoGuardar}
        </Boton>
      </div>
    </Tarjeta>
  );

  const habito = (nombre: 'saltIntake' | 'alcoholIntake' | 'smokingStatus', etiqueta: string, etiquetas: Record<string, string>, orden: string[]) => (
    <Campo etiqueta={etiqueta} grupo>
      <Controller
        control={control}
        name={nombre}
        render={({ field }) => <Segmentos etiqueta={etiqueta} valor={field.value} alCambiar={field.onChange} opciones={orden.map((v) => ({ value: v as typeof field.value, label: etiquetas[v] }))} />}
      />
    </Campo>
  );

  return (
    <form onSubmit={handleSubmit((d) => guardar.mutate(d))} className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]" noValidate>
      <div className="min-w-0 space-y-4">
        <Tarjeta titulo="Quién es">
          <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-start">
            {/* La foto junto al nombre: así se reconoce al paciente en la jornada */}
            <div className="flex shrink-0 flex-row items-center gap-4 sm:w-32 sm:flex-col sm:gap-2.5">
              <button
                type="button"
                onClick={() => archivo.current?.click()}
                className="group relative rounded-full focus-visible:outline-2 focus-visible:outline-offset-2"
                aria-label={fotoActual ? 'Cambiar la foto' : 'Tomar o elegir foto'}
              >
                <Avatar persona={{ firstName: nombres || '?', lastName: apellidos || '' }} foto={fotoActual} tamano="size-28 text-2xl" />
                <span className="absolute right-0.5 bottom-0.5 grid size-9 place-items-center rounded-full border-2 border-superficie bg-tinta text-white shadow-sm transition group-hover:scale-105">
                  <Camera className="size-4" />
                </span>
              </button>
              <div className="space-y-1 sm:text-center">
                <p className="text-xs text-tenue">
                  {fotoNueva ? 'Foto nueva: se guarda con los datos' : quitarFoto && paciente?.photoUrl ? 'Se quitará al guardar' : fotoActual ? 'Toca para cambiarla' : 'Toca para tomarla con la cámara'}
                </p>
                {fotoActual && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs font-medium text-tenue hover:text-red-600"
                    onClick={() => {
                      setFotoNueva(null);
                      setQuitarFoto(true);
                      if (archivo.current) archivo.current.value = '';
                    }}
                  >
                    <Trash2 className="size-3.5" /> Quitar foto
                  </button>
                )}
              </div>
              <input
                ref={archivo}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(ev) => {
                  const f = ev.target.files?.[0];
                  if (!f) return;
                  if (f.size > 10 * 1024 * 1024) {
                    toast.error('La foto pasa de 10 MB.');
                    ev.target.value = '';
                    return;
                  }
                  setFotoNueva(f);
                  setQuitarFoto(false);
                }}
              />
            </div>

            <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-2">
              <Campo etiqueta="Nombres" error={e.firstName?.message}>
                <Entrada className="h-11 text-base" autoComplete="off" autoFocus={!paciente} enterKeyHint="next" {...register('firstName')} aria-invalid={!!e.firstName} />
              </Campo>
              <Campo etiqueta="Apellidos" error={e.lastName?.message}>
                <Entrada className="h-11 text-base" autoComplete="off" enterKeyHint="next" {...register('lastName')} aria-invalid={!!e.lastName} />
              </Campo>
              <Campo etiqueta="Sexo" error={e.gender?.message} grupo className="sm:col-span-2">
                <Controller
                  control={control}
                  name="gender"
                  render={({ field }) => (
                    <Segmentos etiqueta="Sexo" valor={field.value} alCambiar={field.onChange} invalido={!!e.gender} className="sm:max-w-md" opciones={(['FEMALE', 'MALE', 'OTHER'] as const).map((g) => ({ value: g, label: GENEROS[g] }))} />
                  )}
                />
              </Campo>
              {/* Edad y fecha son el mismo dato: con una basta, la otra se calcula. */}
              <div className="sm:col-span-2" role="group" aria-label="Edad o fecha de nacimiento">
                <div className="grid grid-cols-[minmax(0,7rem)_auto_minmax(0,1fr)] items-end gap-3">
                  <Campo etiqueta="Edad" error={e.edad?.message}>
                    <div className="relative">
                      <Entrada type="number" inputMode="numeric" min={0} max={120} enterKeyHint="next" className="h-11 pr-12 text-base" {...registroEdad} aria-invalid={!!e.edad} />
                      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-tenue">años</span>
                    </div>
                  </Campo>
                  <span className="pb-3 text-sm text-tenue">o</span>
                  <Campo etiqueta="Fecha de nacimiento" error={e.birthDate?.message}>
                    <Controller
                      control={control}
                      name="birthDate"
                      render={({ field }) => (
                        <SelectorFecha
                          corto
                          empezarPorAnio
                          className="h-11 text-base"
                          max={hoy()}
                          value={field.value}
                          onChange={(v) => {
                            field.onChange(v);
                            alCambiarFecha(v);
                          }}
                          aria-invalid={!!e.birthDate}
                          aria-label="Fecha de nacimiento"
                        />
                      )}
                    />
                  </Campo>
                </div>
                <p className="mt-1.5 text-xs text-tenue">
                  {estimada && nacimiento ? `Con solo la edad, la fecha queda aproximada (1 de enero de ${nacimiento.slice(0, 4)}).` : 'Con una de las dos basta: la otra se calcula.'}
                </p>
              </div>
            </div>
          </div>
        </Tarjeta>

        <Tarjeta titulo="Dónde vive">
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <Campo
              etiqueta="Batey"
              error={e.communityId?.message}
              ayuda={
                paciente
                  ? comunidadElegida && comunidadElegida !== paciente.communityId
                    ? `Se muda de batey; conserva su código ${paciente.patientCode}.`
                    : `Si se muda, conserva su código.`
                  : batey
                    ? `Su código empezará por ${batey.abbreviation}.`
                    : 'De aquí sale su código.'
              }
              className="sm:col-span-2 lg:col-span-1"
            >
              <Selector
                vacio="Elegir…"
                className="h-11 text-base"
                opciones={(comunidades.data ?? [])
                  .filter((c) => c.isActive || c.id === paciente?.communityId)
                  .map((c) => ({ value: c.id, label: `${c.name} (${c.abbreviation})` }))}
                {...register('communityId')}
                aria-invalid={!!e.communityId}
              />
            </Campo>
            <Campo etiqueta="Casa" ayuda="El número basta">
              <Entrada className="h-11 text-base" enterKeyHint="next" {...register('address')} />
            </Campo>
            <Campo etiqueta="Teléfono" ayuda="Opcional">
              <Entrada type="tel" inputMode="tel" className="h-11 text-base" enterKeyHint="next" placeholder="809-000-0000" {...register('phoneNumber')} />
            </Campo>
            {paciente && (
              <p className="text-sm text-tenue sm:col-span-2 lg:col-span-3">
                Estado: <strong className="font-medium text-tinta">{ESTADOS[paciente.status]}</strong> ·{' '}
                {paciente.status === 'ACTIVE' ? 'para darlo de baja usa "Dar de baja" en su ficha.' : 'para reactivarlo usa "Reactivar" en su ficha.'}
              </p>
            )}
          </div>
        </Tarjeta>

        <Tarjeta titulo="Hábitos y antecedentes">
          <div className="grid gap-4 p-5 md:grid-cols-2">
            {habito('saltIntake', 'Consumo de sal', SAL, ['NO', 'REDUCED', 'YES'])}
            {habito('alcoholIntake', 'Alcohol', ALCOHOL, ['NO', 'OCCASIONAL', 'FREQUENT'])}
            {habito('smokingStatus', 'Tabaco', { ...TABACO, ACTIVE: 'Fuma' }, ['NO', 'EX_SMOKER', 'ACTIVE'])}
            <Campo etiqueta="Familiares con presión alta" grupo>
              <Controller
                control={control}
                name="hasFamilyHistory"
                render={({ field }) => (
                  <Segmentos
                    etiqueta="Familiares con presión alta"
                    valor={field.value ? 'si' : 'no'}
                    alCambiar={(v) => field.onChange(v === 'si')}
                    opciones={[
                      { value: 'no', label: 'No' },
                      { value: 'si', label: 'Sí' },
                    ]}
                  />
                )}
              />
            </Campo>
          </div>
        </Tarjeta>

        <Tarjeta titulo="Consentimiento">
          <div className="p-5">
            {/* Toda la fila se toca; marcada se ve verde para confirmarlo de un vistazo */}
            <label
              className={cn(
                'flex cursor-pointer gap-3 rounded-xl border px-4 py-3.5 transition-colors',
                consentimiento ? 'border-green-300 bg-green-50' : 'border-borde hover:bg-fondo',
              )}
            >
              <input type="checkbox" className="mt-0.5 size-5 shrink-0 rounded accent-green-700" {...register('consentimientoDatos')} />
              <span className="space-y-1">
                <span className="block text-sm font-medium">El paciente (o su familiar) autoriza que la fundación guarde y use sus datos de salud para su atención y para estadísticas sin nombres</span>
                <span className="block text-xs text-tenue">
                  {paciente?.consentimientoDatos && paciente.consentimientoFecha
                    ? `Registrado el ${fecha(paciente.consentimientoFecha)}${paciente.consentimientoRegistradoPor ? ` por ${paciente.consentimientoRegistradoPor}` : ''}.`
                    : 'Los datos de salud son datos sensibles (Ley 172-13): pide su autorización verbal o firmada y márcala aquí.'}
                </span>
              </span>
            </label>
          </div>
        </Tarjeta>

        {/* Tablet y teléfono: lo que falta y Guardar siempre a mano */}
        <div className="sticky bottom-0 z-20 -mx-4 border-t border-borde bg-superficie/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10 xl:hidden">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{nombreVista || (paciente ? 'Paciente' : 'Paciente nuevo')}</p>
              <p className={cn('truncate text-xs', listo ? 'text-green-700' : 'text-amber-800')}>{textoFalta}</p>
            </div>
            <Boton type="submit" className="h-11 shrink-0 px-5" cargando={guardar.isPending} icono={<Save className="size-4" />}>
              {textoGuardar}
            </Boton>
          </div>
        </div>
      </div>

      <aside className="hidden xl:sticky xl:top-6 xl:block xl:self-start">{resumen}</aside>
    </form>
  );
}
