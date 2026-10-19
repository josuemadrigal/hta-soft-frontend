import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, KeyRound, MailCheck, MailWarning, Send } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { cambiarContrasena, pedirConfirmacionCorreo } from '../api/recursos';
import { useSesion } from '../auth/sesion';
import { Avatar, Boton, Campo, EncabezadoPagina, Entrada, Tarjeta } from '../components/ui';
import { fechaYHora, nombreCompleto } from '../lib/formato';

type Datos = { actual: string; nueva: string; confirmar: string };

/** /cuenta — datos propios, confirmar el correo y cambiar la contraseña. */
export function MiCuenta() {
  const { usuario, reemplazarSesion } = useSesion();
  const { register, handleSubmit, formState, getValues, reset, setError } = useForm<Datos>({ defaultValues: { actual: '', nueva: '', confirmar: '' } });
  const e = formState.errors;

  const enlace = useMutation({
    mutationFn: pedirConfirmacionCorreo,
    onSuccess: (r) =>
      toast.success(
        r.simulado ? 'Enlace generado. El servidor no tiene correo configurado: está en la consola del backend.' : `Te enviamos un enlace a ${r.email}. Revisa también la carpeta de spam.`,
      ),
    onError: (err) => toast.error(err.message),
  });

  const guardar = useMutation({
    mutationFn: (d: Datos) => cambiarContrasena(d.actual, d.nueva),
    onSuccess: (sesion) => {
      reemplazarSesion(sesion);
      reset();
      toast.success('Contraseña cambiada. Se cerraron tus sesiones en otros dispositivos.');
    },
    onError: (err) => {
      if (err.message.includes('actual')) setError('actual', { message: err.message });
      else if (err.message.includes('contraseña')) setError('nueva', { message: err.message });
      else toast.error(err.message);
    },
  });

  if (!usuario) return null;
  const confirmado = !!usuario.emailVerificadoEn;

  return (
    <>
      <EncabezadoPagina titulo="Mi cuenta" descripcion="Tu correo y tu contraseña." />
      <div className="max-w-2xl space-y-4">
        <Tarjeta titulo="Datos">
          <div className="flex items-center gap-4 p-5">
            <Avatar persona={usuario} foto={usuario.photoUrl} tamano="size-12" />
            <div className="min-w-0">
              <p className="font-medium">{nombreCompleto(usuario)}</p>
              <p className="text-sm text-tenue">{usuario.role?.name}</p>
            </div>
          </div>
          {usuario.usuario && (
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-borde px-5 py-3">
              <span className="text-sm text-tenue">Usuario para entrar</span>
              <span className="font-mono font-medium">{usuario.usuario}</span>
            </div>
          )}
          <p className="border-t border-borde px-5 py-3 text-sm text-tenue">Para cambiar tu nombre, tu usuario, tu rol o tu correo, pídeselo a quien administra los usuarios.</p>
        </Tarjeta>

        <Tarjeta titulo="Correo">
          <div className="flex flex-wrap items-center gap-4 p-5">
            {confirmado ? <MailCheck className="size-6 shrink-0 text-green-700" /> : <MailWarning className="size-6 shrink-0 text-amber-600" />}
            <div className="min-w-0 flex-1">
              <p className="font-medium break-all">{usuario.email}</p>
              <p className="text-sm text-tenue">
                {confirmado
                  ? `Confirmado el ${fechaYHora(usuario.emailVerificadoEn)}.`
                  : 'Sin confirmar. Hasta que lo confirmes no puedes recibir los resúmenes de las jornadas.'}
              </p>
            </div>
            {!confirmado && (
              <Boton icono={<Send className="size-4" />} cargando={enlace.isPending} onClick={() => enlace.mutate()}>
                Enviarme el enlace
              </Boton>
            )}
          </div>
        </Tarjeta>

        <Tarjeta titulo="Cambiar contraseña">
          <form onSubmit={handleSubmit((d) => guardar.mutate(d))} noValidate>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Campo etiqueta="Contraseña actual" error={e.actual?.message} className="sm:col-span-2 sm:max-w-[calc(50%-0.5rem)]">
                <Entrada type="password" autoComplete="current-password" {...register('actual', { required: 'Escribe tu contraseña actual' })} aria-invalid={!!e.actual} />
              </Campo>
              <Campo etiqueta="Contraseña nueva" error={e.nueva?.message} ayuda="Al menos 8 caracteres. Mejor una frase que una palabra.">
                <Entrada
                  type="password"
                  autoComplete="new-password"
                  {...register('nueva', {
                    required: 'Escribe la contraseña nueva',
                    minLength: { value: 8, message: 'Al menos 8 caracteres' },
                    maxLength: { value: 72, message: 'Máximo 72 caracteres' },
                    validate: (v) => v !== getValues('actual') || 'Debe ser distinta de la actual',
                  })}
                  aria-invalid={!!e.nueva}
                />
              </Campo>
              <Campo etiqueta="Repetir la contraseña nueva" error={e.confirmar?.message}>
                <Entrada
                  type="password"
                  autoComplete="new-password"
                  {...register('confirmar', { validate: (v) => v === getValues('nueva') || 'No coincide' })}
                  aria-invalid={!!e.confirmar}
                />
              </Campo>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-borde px-5 py-3">
              <p className="text-sm text-tenue">
                {usuario.contrasenaCambiadaEn ? (
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="size-4" /> Último cambio: {fechaYHora(usuario.contrasenaCambiadaEn)}
                  </span>
                ) : (
                  'Al cambiarla se cierran tus sesiones en otros dispositivos.'
                )}
              </p>
              <Boton type="submit" icono={<KeyRound className="size-4" />} cargando={guardar.isPending}>
                Cambiar contraseña
              </Boton>
            </div>
          </form>
        </Tarjeta>
      </div>
    </>
  );
}
