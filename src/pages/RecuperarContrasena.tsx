import { CheckCircle2, MailCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { olvideContrasena, restablecerContrasena } from '../api/recursos';
import { PantallaAcceso } from '../components/PantallaAcceso';
import { Boton, Campo, Entrada } from '../components/ui';

const volver = (
  <p className="text-center">
    <Link to="/login" className="text-sm text-tenue underline-offset-4 hover:text-tinta hover:underline">
      Volver a iniciar sesión
    </Link>
  </p>
);

/** /olvide-contrasena — pide el enlace para poner una contraseña nueva. */
export function OlvideContrasena() {
  const inicial = (useLocation().state as { email?: string } | null)?.email ?? '';
  const [enviadoA, setEnviadoA] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm({ defaultValues: { email: inicial } });

  const alEnviar = handleSubmit(async ({ email }) => {
    setError(null);
    try {
      await olvideContrasena(email.trim());
      setEnviadoA(email.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar. Intenta de nuevo.');
    }
  });

  if (enviadoA)
    return (
      <PantallaAcceso>
        <div className="space-y-5">
          <MailCheck className="size-10 text-green-700" />
          <h1 className="text-2xl font-semibold tracking-tight">Revisa tu correo</h1>
          {/* No dice si la cuenta existe: así nadie puede averiguar qué correos están registrados */}
          <p className="text-tenue">
            Si <span className="font-medium break-all text-tinta">{enviadoA}</span> tiene una cuenta, te enviamos un enlace para poner una contraseña nueva. Vence en
            1 hora.
          </p>
          <p className="text-sm text-tenue">¿No llega? Revisa la carpeta de spam o pide otro enlace en unos minutos. Si sigue sin llegar, pide al administrador que te cambie la contraseña.</p>
          {volver}
        </div>
      </PantallaAcceso>
    );

  return (
    <PantallaAcceso>
      <form onSubmit={alEnviar} className="space-y-5" noValidate>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">¿Olvidaste tu contraseña?</h1>
          <p className="mt-2 text-tenue">Escribe el correo de tu cuenta y te enviaremos un enlace para poner una nueva.</p>
        </div>
        <Campo etiqueta="Correo" error={formState.errors.email?.message}>
          <Entrada
            type="email"
            autoComplete="username"
            autoFocus
            className="h-11"
            {...register('email', { required: 'Escribe tu correo', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Correo no válido' } })}
            aria-invalid={!!formState.errors.email}
          />
        </Campo>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <Boton type="submit" className="h-11 w-full" cargando={formState.isSubmitting}>
          Enviar enlace
        </Boton>
        {volver}
      </form>
    </PantallaAcceso>
  );
}

/** /restablecer-contrasena?token=… — el enlace del correo: pone la contraseña nueva. */
export function RestablecerContrasena() {
  const token = useSearchParams()[0].get('token') ?? '';
  const navegar = useNavigate();
  const [error, setError] = useState<string | null>(token ? null : 'El enlace está incompleto. Ábrelo de nuevo desde el correo o pide otro.');
  const { register, handleSubmit, formState, getValues } = useForm({ defaultValues: { nueva: '', confirmar: '' } });
  const e = formState.errors;

  const alEnviar = handleSubmit(async ({ nueva }) => {
    setError(null);
    try {
      const r = await restablecerContrasena(token, nueva);
      navegar('/login', { replace: true, state: { aviso: 'Contraseña cambiada. Ya puedes entrar con la nueva.', email: r.email } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar la contraseña.');
    }
  });

  // Enlace usado o vencido: no tiene sentido mostrar el formulario.
  const sinArreglo = !token || (error && /no es válido|venció/.test(error));

  return (
    <PantallaAcceso>
      {sinArreglo ? (
        <div className="space-y-5">
          <h1 className="text-2xl font-semibold tracking-tight">El enlace ya no sirve</h1>
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          <Link to="/olvide-contrasena" className="flex h-11 w-full items-center justify-center rounded-lg bg-marca-500 text-sm font-semibold text-tinta hover:bg-marca-600">
            Pedir otro enlace
          </Link>
          {volver}
        </div>
      ) : (
        <form onSubmit={alEnviar} className="space-y-5" noValidate>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Pon una contraseña nueva</h1>
            <p className="mt-2 text-tenue">Al guardarla se cierra la sesión en los demás dispositivos.</p>
          </div>
          <Campo etiqueta="Contraseña nueva" error={e.nueva?.message} ayuda="Al menos 8 caracteres. Mejor una frase que una palabra.">
            <Entrada
              type="password"
              autoComplete="new-password"
              autoFocus
              className="h-11"
              {...register('nueva', {
                required: 'Escribe la contraseña nueva',
                minLength: { value: 8, message: 'Al menos 8 caracteres' },
                maxLength: { value: 72, message: 'No puede pasar de 72 caracteres' },
              })}
              aria-invalid={!!e.nueva}
            />
          </Campo>
          <Campo etiqueta="Repetir la contraseña nueva" error={e.confirmar?.message}>
            <Entrada
              type="password"
              autoComplete="new-password"
              className="h-11"
              {...register('confirmar', { validate: (v) => v === getValues('nueva') || 'No coincide' })}
              aria-invalid={!!e.confirmar}
            />
          </Campo>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Boton type="submit" className="h-11 w-full" icono={<CheckCircle2 className="size-4" />} cargando={formState.isSubmitting}>
            Guardar contraseña
          </Boton>
          {volver}
        </form>
      )}
    </PantallaAcceso>
  );
}
