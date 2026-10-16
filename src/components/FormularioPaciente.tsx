import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useComunidades } from '../api/consultas';
import { crearPaciente, editarPaciente, quitarFotoPaciente, subirFotoPaciente, type DatosPaciente } from '../api/recursos';
import type { Paciente } from '../api/tipos';
import { ALCOHOL, ESTADOS, GENEROS, opciones, SAL, TABACO } from '../lib/etiquetas';
import { edad, fecha, soloFecha } from '../lib/formato';
import { Avatar, Boton, Campo, Casilla, Entrada, Selector, Tarjeta } from './ui';

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
  const { register, handleSubmit, formState, setValue, watch } = useForm<Entrada_, unknown, Salida>({
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
  const registroFecha = register('birthDate', { onChange: (ev) => alCambiarFecha(ev.target.value) });

  return (
    <form onSubmit={handleSubmit((d) => guardar.mutate(d))} className="space-y-4" noValidate>
      <Tarjeta titulo="Foto">
        <div className="flex flex-wrap items-center gap-5 p-5">
          <Avatar persona={{ firstName: watch('firstName') || '?', lastName: watch('lastName') || '' }} foto={fotoActual} tamano="size-24 text-2xl" />
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Boton variante="secundario" icono={<Camera className="size-4" />} onClick={() => archivo.current?.click()}>
                {fotoActual ? 'Cambiar foto' : 'Tomar o elegir foto'}
              </Boton>
              {fotoActual && (
                <Boton
                  variante="secundario"
                  className="hover:text-red-600"
                  icono={<Trash2 className="size-4" />}
                  onClick={() => {
                    setFotoNueva(null);
                    setQuitarFoto(true);
                    if (archivo.current) archivo.current.value = '';
                  }}
                >
                  Quitar foto
                </Boton>
              )}
            </div>
            <p className="text-xs text-tenue">
              {fotoNueva ? 'Foto nueva: se guarda al pulsar ' : quitarFoto && paciente?.photoUrl ? 'Se quitará al pulsar ' : 'En la tableta se puede tomar con la cámara. JPG o PNG, hasta 10 MB. Se aplica al pulsar '}
              <strong>{paciente ? 'Guardar cambios' : 'Registrar paciente'}</strong>.
            </p>
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
      </Tarjeta>

      <Tarjeta titulo="Datos personales">
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Campo etiqueta="Nombres" error={e.firstName?.message} className="lg:col-span-2">
            <Entrada {...register('firstName')} aria-invalid={!!e.firstName} />
          </Campo>
          <Campo etiqueta="Apellidos" error={e.lastName?.message} className="lg:col-span-2">
            <Entrada {...register('lastName')} aria-invalid={!!e.lastName} />
          </Campo>
          <Campo etiqueta="Edad" error={e.edad?.message} ayuda={estimada ? 'Fecha calculada: 1 de enero' : 'Años cumplidos'}>
            <Entrada type="number" inputMode="numeric" min={0} max={120} {...registroEdad} aria-invalid={!!e.edad} />
          </Campo>
          <Campo etiqueta="Fecha de nacimiento" error={e.birthDate?.message} ayuda={estimada ? 'Aproximada' : undefined}>
            <Entrada type="date" max={hoy()} {...registroFecha} aria-invalid={!!e.birthDate} />
          </Campo>
          <Campo etiqueta="Género" error={e.gender?.message}>
            <Selector opciones={opciones(GENEROS)} vacio={paciente ? undefined : 'Elegir…'} {...register('gender')} aria-invalid={!!e.gender} />
          </Campo>
          <Campo etiqueta="Teléfono" ayuda="Opcional">
            <Entrada type="tel" {...register('phoneNumber')} />
          </Campo>
          <Campo etiqueta="Dirección / casa" ayuda="Basta con el número de casa" className="sm:col-span-1 lg:col-span-3">
            <Entrada {...register('address')} />
          </Campo>
        </div>
      </Tarjeta>

      <Tarjeta titulo="Registro">
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Campo
            etiqueta="Batey"
            error={e.communityId?.message}
            ayuda={
              paciente
                ? comunidadElegida && comunidadElegida !== paciente.communityId
                  ? `Se muda de batey; conserva su código ${paciente.patientCode}.`
                  : `Código ${paciente.patientCode}. Si se muda, lo conserva.`
                : 'El código del paciente se genera con el prefijo del batey.'
            }
          >
            <Selector
              vacio="Elegir…"
              opciones={(comunidades.data ?? [])
                .filter((c) => c.isActive || c.id === paciente?.communityId)
                .map((c) => ({ value: c.id, label: `${c.name} (${c.abbreviation})` }))}
              {...register('communityId')}
              aria-invalid={!!e.communityId}
            />
          </Campo>
          {paciente && (
            <Campo etiqueta="Estado" ayuda={paciente.status === 'ACTIVE' ? 'Para darlo de baja usa "Dar de baja" en su ficha' : 'Para reactivarlo usa "Reactivar" en su ficha'}>
              <Entrada value={ESTADOS[paciente.status]} disabled readOnly />
            </Campo>
          )}
        </div>
      </Tarjeta>

      <Tarjeta titulo="Hábitos y antecedentes">
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <Campo etiqueta="Consumo de sal">
            <Selector opciones={opciones(SAL)} {...register('saltIntake')} />
          </Campo>
          <Campo etiqueta="Alcohol">
            <Selector opciones={opciones(ALCOHOL)} {...register('alcoholIntake')} />
          </Campo>
          <Campo etiqueta="Tabaco">
            <Selector opciones={opciones(TABACO)} {...register('smokingStatus')} />
          </Campo>
          <Casilla etiqueta="Antecedentes familiares de hipertensión" className="sm:col-span-3" {...register('hasFamilyHistory')} />
        </div>
      </Tarjeta>

      <Tarjeta titulo="Consentimiento">
        <div className="space-y-2 p-5">
          <Casilla
            etiqueta="El paciente (o su familiar) autoriza que la fundación guarde y use sus datos de salud para su atención y para estadísticas sin nombres"
            {...register('consentimientoDatos')}
          />
          <p className="pl-6 text-xs text-tenue">
            {paciente?.consentimientoDatos && paciente.consentimientoFecha
              ? `Registrado el ${fecha(paciente.consentimientoFecha)}${paciente.consentimientoRegistradoPor ? ` por ${paciente.consentimientoRegistradoPor}` : ''}.`
              : 'Los datos de salud son datos sensibles (Ley 172-13): pide su autorización verbal o firmada y márcala aquí.'}
          </p>
        </div>
      </Tarjeta>

      <div className="flex justify-end">
        <Boton type="submit" cargando={guardar.isPending}>
          {paciente ? 'Guardar cambios' : 'Registrar paciente'}
        </Boton>
      </div>
    </form>
  );
}
