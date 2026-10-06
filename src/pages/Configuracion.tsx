import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useConfiguracion } from '../api/consultas';
import { guardarConfiguracion, type Configuracion as Ajustes } from '../api/recursos';
import { Boton, Campo, Cargando, EncabezadoPagina, Entrada, Tarjeta } from '../components/ui';
import { cn } from '../lib/formato';

const PLAZOS = [
  { horas: 0, texto: 'No pueden' },
  { horas: 24, texto: '24 horas' },
  { horas: 48, texto: '48 horas' },
  { horas: 72, texto: '3 días' },
  { horas: 168, texto: '1 semana' },
];

export function Configuracion() {
  const consulta = useConfiguracion();
  const cliente = useQueryClient();
  const [horas, setHoras] = useState<number | ''>('');
  useEffect(() => {
    if (consulta.data) setHoras(consulta.data.visitasHorasEdicion);
  }, [consulta.data]);

  const guardar = useMutation({
    mutationFn: () => guardarConfiguracion({ visitasHorasEdicion: Number(horas) }),
    onSuccess: () => {
      cliente.invalidateQueries({ queryKey: ['configuracion'] });
      toast.success('Configuración guardada. El cambio quedó en Auditoría.');
    },
    onError: (e) => toast.error(e.message),
  });

  if (consulta.isPending) return <Cargando />;
  const cambio = horas !== '' && horas !== consulta.data?.visitasHorasEdicion;
  const valido = horas !== '' && Number.isInteger(Number(horas)) && Number(horas) >= 0 && Number(horas) <= 720;

  return (
    <>
      <EncabezadoPagina titulo="Configuración general" descripcion="Ajustes que aplican a todo el sistema." />
      <Tarjeta titulo="Corrección de visitas" className="max-w-2xl">
        <div className="space-y-4 p-5">
          <p className="text-sm text-tenue">
            Cuánto tiempo, desde que registra una visita, tiene un médico para corregirla él mismo. Después solo puede hacerlo un usuario con el permiso “Editar
            cualquier visita sin plazo” (el administrador), que además puede eliminarlas. Toda corrección queda en Auditoría.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PLAZOS.map((p) => (
              <button
                key={p.horas}
                type="button"
                onClick={() => setHoras(p.horas)}
                className={cn('rounded-full border px-3 py-1 text-sm', horas === p.horas ? 'border-tinta bg-marca-500 font-medium' : 'border-borde text-tenue hover:text-tinta')}
              >
                {p.texto}
              </button>
            ))}
          </div>
          <Campo etiqueta="Horas" error={!valido && horas !== '' ? 'Entre 0 y 720 horas (30 días)' : undefined} className="max-w-48">
            <Entrada type="number" min={0} max={720} value={horas} onChange={(e) => setHoras(e.target.value === '' ? '' : Number(e.target.value))} />
          </Campo>
          <Boton icono={<Save className="size-4" />} disabled={!cambio || !valido} cargando={guardar.isPending} onClick={() => guardar.mutate()}>
            Guardar
          </Boton>
        </div>
      </Tarjeta>
      <AjustesAlertas />
      <AjusteSesion />
    </>
  );
}

const CAMPOS_ALERTAS: { k: keyof Ajustes; etiqueta: string; ayuda: string; min: number; max: number }[] = [
  { k: 'alertaSubidaSistolica', etiqueta: 'Subida de sistólica', ayuda: 'mmHg más que la última visita', min: 5, max: 80 },
  { k: 'alertaSubidaDiastolica', etiqueta: 'Subida de diastólica', ayuda: 'mmHg más que la última visita', min: 5, max: 50 },
  { k: 'alertaVisitasSinControl', etiqueta: 'Visitas seguidas sin control', ayuda: 'En ≥140/90 estando en tratamiento', min: 2, max: 8 },
  { k: 'alertaCumplimientoMinimo', etiqueta: 'Cumplimiento mínimo (%)', ayuda: 'Por debajo se considera bajo', min: 10, max: 100 },
  { k: 'alertaVisitasCumplimiento', etiqueta: 'Visitas seguidas con cumplimiento bajo', ayuda: 'Para avisar', min: 1, max: 6 },
];

/** Umbrales de las alertas clínicas que ve el médico al registrar la visita. */
function AjustesAlertas() {
  const consulta = useConfiguracion();
  const cliente = useQueryClient();
  const [valores, setValores] = useState<Partial<Record<keyof Ajustes, number | ''>>>({});
  useEffect(() => {
    if (consulta.data) setValores(Object.fromEntries(CAMPOS_ALERTAS.map((c) => [c.k, consulta.data![c.k]])));
  }, [consulta.data]);
  const guardar = useMutation({
    mutationFn: () => guardarConfiguracion(Object.fromEntries(CAMPOS_ALERTAS.map((c) => [c.k, Number(valores[c.k])]))),
    onSuccess: () => {
      cliente.invalidateQueries({ queryKey: ['configuracion'] });
      toast.success('Umbrales guardados. El cambio quedó en Auditoría.');
    },
    onError: (e) => toast.error(e.message),
  });
  if (!consulta.data) return null;
  const invalido = (c: (typeof CAMPOS_ALERTAS)[number]) => {
    const v = valores[c.k];
    return v === '' || v === undefined || !Number.isInteger(Number(v)) || Number(v) < c.min || Number(v) > c.max;
  };
  const cambio = CAMPOS_ALERTAS.some((c) => valores[c.k] !== consulta.data![c.k]);
  const valido = CAMPOS_ALERTAS.every((c) => !invalido(c));
  return (
    <Tarjeta titulo="Alertas clínicas" className="mt-4 max-w-2xl">
      <div className="space-y-4 p-5">
        <p className="text-sm text-tenue">
          Al registrar una visita (y en la ficha del paciente) se avisa de crisis hipertensiva, presión baja, subidas bruscas, visitas seguidas sin control, cumplimiento bajo,
          pulso, saturación, fiebre y peso. Estos son los límites que se pueden ajustar.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {CAMPOS_ALERTAS.map((c) => (
            <Campo key={c.k} etiqueta={c.etiqueta} ayuda={c.ayuda} error={invalido(c) ? `Entre ${c.min} y ${c.max}` : undefined}>
              <Entrada type="number" min={c.min} max={c.max} value={valores[c.k] ?? ''} onChange={(e) => setValores({ ...valores, [c.k]: e.target.value === '' ? '' : Number(e.target.value) })} />
            </Campo>
          ))}
        </div>
        <Boton icono={<Save className="size-4" />} disabled={!cambio || !valido} cargando={guardar.isPending} onClick={() => guardar.mutate()}>
          Guardar
        </Boton>
      </div>
    </Tarjeta>
  );
}

/** Minutos sin actividad tras los que se cierra la sesión. */
function AjusteSesion() {
  const consulta = useConfiguracion();
  const cliente = useQueryClient();
  const [minutos, setMinutos] = useState<number | ''>('');
  useEffect(() => {
    if (consulta.data) setMinutos(consulta.data.sesionMinutosInactividad);
  }, [consulta.data]);
  const guardar = useMutation({
    mutationFn: () => guardarConfiguracion({ sesionMinutosInactividad: Number(minutos) }),
    onSuccess: () => {
      cliente.invalidateQueries({ queryKey: ['configuracion'] });
      toast.success('Guardado. El cambio quedó en Auditoría.');
    },
    onError: (e) => toast.error(e.message),
  });
  if (!consulta.data) return null;
  const valido = minutos !== '' && Number.isInteger(Number(minutos)) && Number(minutos) >= 5 && Number(minutos) <= 480;
  return (
    <Tarjeta titulo="Seguridad de la sesión" className="mt-4 max-w-2xl">
      <div className="space-y-4 p-5">
        <p className="text-sm text-tenue">
          La app guarda datos de salud: si nadie la usa durante este tiempo, cierra la sesión sola (también si se cerró el navegador). Tras 5 contraseñas incorrectas seguidas, la
          cuenta se bloquea 15 minutos.
        </p>
        <Campo etiqueta="Cerrar la sesión tras (minutos sin actividad)" error={!valido && minutos !== '' ? 'Entre 5 y 480 minutos' : undefined} className="max-w-64">
          <Entrada type="number" min={5} max={480} value={minutos} onChange={(e) => setMinutos(e.target.value === '' ? '' : Number(e.target.value))} />
        </Campo>
        <Boton icono={<Save className="size-4" />} disabled={!valido || minutos === consulta.data.sesionMinutosInactividad} cargando={guardar.isPending} onClick={() => guardar.mutate()}>
          Guardar
        </Boton>
      </div>
    </Tarjeta>
  );
}
