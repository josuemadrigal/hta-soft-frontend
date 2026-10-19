import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import { useSesion } from '../auth/sesion';
import { PantallaAcceso } from '../components/PantallaAcceso';
import { Boton, Campo, Entrada } from '../components/ui';

const esquema = z.object({
  email: z.string().trim().min(1, 'Escribe tu usuario o tu correo'),
  password: z.string().min(1, 'Escribe la contraseña'),
});

/** Lo que pueden pasarle otras pantallas: de dónde venía, o el aviso después de restablecer la contraseña. */
type Estado = { desde?: string; aviso?: string; email?: string } | null;

export function Login() {
  const { usuario, entrar } = useSesion();
  const navegar = useNavigate();
  const estado = useLocation().state as Estado;
  const desde = estado?.desde ?? '/';
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState, watch } = useForm({ resolver: zodResolver(esquema), defaultValues: { email: estado?.email ?? '', password: '' } });

  if (usuario) return <Navigate to={desde} replace />;

  const alEnviar = handleSubmit(async ({ email, password }) => {
    setError(null);
    try {
      await entrar(email, password);
      navegar(desde, { replace: true });
    } catch (e) {
      setError(e instanceof Error && e.message !== 'Invalid credentials' ? e.message : 'Usuario o contraseña incorrectos.');
    }
  });

  return (
    <PantallaAcceso>
      <form onSubmit={alEnviar} className="space-y-5" noValidate>
        <h1 className="text-2xl font-semibold tracking-tight">Iniciar sesión en HTA-Soft</h1>
        {estado?.aviso && !error && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{estado.aviso}</p>}
        <Campo etiqueta="Usuario o correo" error={formState.errors.email?.message}>
          <Entrada
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus={!estado?.email}
            {...register('email')}
            className="h-11"
            aria-invalid={!!formState.errors.email}
          />
        </Campo>
        <Campo etiqueta="Contraseña" error={formState.errors.password?.message}>
          <Entrada type="password" autoComplete="current-password" autoFocus={!!estado?.email} {...register('password')} className="h-11" aria-invalid={!!formState.errors.password} />
        </Campo>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <Boton type="submit" className="h-11 w-full" cargando={formState.isSubmitting}>
          Entrar
        </Boton>
        <p className="text-center">
          {/* Lleva el correo ya escrito (si escribió el usuario, no: el enlace se manda al correo) */}
          <Link to="/olvide-contrasena" state={{ email: watch('email').includes('@') ? watch('email') : '' }} className="text-sm text-tenue underline-offset-4 hover:text-tinta hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </p>
      </form>
    </PantallaAcceso>
  );
}
