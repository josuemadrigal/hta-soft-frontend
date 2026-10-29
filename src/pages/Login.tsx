import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import { useSesion } from '../auth/sesion';
import { PantallaAcceso } from '../components/PantallaAcceso';
import { Boton, Campo, Casilla, Entrada } from '../components/ui';

const esquema = z.object({
  email: z.string().trim().min(1, 'Escribe tu usuario o tu correo'),
  password: z.string().min(1, 'Escribe la contraseña'),
});

/** "Recordarme": el usuario queda escrito en este equipo; la contraseña la guarda el navegador (nunca la app). */
const CLAVE_RECORDAR = 'hta:recordar-usuario';
const recordado = () => {
  try {
    return localStorage.getItem(CLAVE_RECORDAR) ?? '';
  } catch {
    return '';
  }
};

/** Le pide al gestor de contraseñas del navegador que la guarde (Chrome, Edge, Android). En otros, el navegador lo ofrece solo. */
async function guardarEnNavegador(id: string, password: string) {
  try {
    const PC = (window as unknown as { PasswordCredential?: new (d: { id: string; password: string }) => Credential }).PasswordCredential;
    if (PC && navigator.credentials) await navigator.credentials.store(new PC({ id, password }));
  } catch {
    /* el usuario dijo que no, o el navegador no lo permite */
  }
}

/** Lo que pueden pasarle otras pantallas: de dónde venía, o el aviso después de restablecer la contraseña. */
type Estado = { desde?: string; aviso?: string; email?: string } | null;

export function Login() {
  const { usuario, entrar } = useSesion();
  const navegar = useNavigate();
  const estado = useLocation().state as Estado;
  const desde = estado?.desde ?? '/';
  const [error, setError] = useState<string | null>(null);
  const [recordar, setRecordar] = useState(() => !!recordado());
  const { register, handleSubmit, formState, watch } = useForm({ resolver: zodResolver(esquema), defaultValues: { email: estado?.email ?? recordado(), password: '' } });

  if (usuario) return <Navigate to={desde} replace />;

  const alEnviar = handleSubmit(async ({ email, password }) => {
    setError(null);
    try {
      await entrar(email, password);
      try {
        if (recordar) localStorage.setItem(CLAVE_RECORDAR, email.trim());
        else localStorage.removeItem(CLAVE_RECORDAR);
      } catch {
        /* sin almacenamiento */
      }
      if (recordar) await guardarEnNavegador(email.trim(), password);
      navegar(desde, { replace: true });
    } catch (e) {
      setError(e instanceof Error && e.message !== 'Invalid credentials' ? e.message : 'Usuario o contraseña incorrectos.');
    }
  });

  return (
    <PantallaAcceso>
      <form onSubmit={alEnviar} className="space-y-5" noValidate>
        <h1 className="text-2xl font-semibold tracking-tight">Iniciar sesión</h1>
        {estado?.aviso && !error && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{estado.aviso}</p>}
        <Campo etiqueta="Usuario o correo" error={formState.errors.email?.message}>
          <Entrada
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus={!estado?.email && !recordado()}
            {...register('email')}
            className="h-11"
            aria-invalid={!!formState.errors.email}
          />
        </Campo>
        <Campo etiqueta="Contraseña" error={formState.errors.password?.message}>
          <Entrada type="password" autoComplete="current-password" autoFocus={!!estado?.email || !!recordado()} {...register('password')} className="h-11" aria-invalid={!!formState.errors.password} />
        </Campo>
        <div>
          <Casilla etiqueta="Recordarme en este equipo" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} />
          <p className="mt-1 pl-6 text-xs text-tenue">Guarda tu usuario aquí y el navegador te ofrece guardar la contraseña. No lo marques en un equipo compartido.</p>
        </div>
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
