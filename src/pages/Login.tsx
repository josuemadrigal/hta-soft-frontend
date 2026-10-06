import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import { useSesion } from '../auth/sesion';
import { Boton, Campo, Entrada } from '../components/ui';

const esquema = z.object({
  email: z.email('Correo no válido'),
  password: z.string().min(1, 'Escribe la contraseña'),
});

export function Login() {
  const { usuario, entrar } = useSesion();
  const navegar = useNavigate();
  const desde = (useLocation().state as { desde?: string } | null)?.desde ?? '/';
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm({ resolver: zodResolver(esquema) });

  if (usuario) return <Navigate to={desde} replace />;

  const alEnviar = handleSubmit(async ({ email, password }) => {
    setError(null);
    try {
      await entrar(email, password);
      navegar(desde, { replace: true });
    } catch (e) {
      setError(e instanceof Error && e.message !== 'Invalid credentials' ? e.message : 'Correo o contraseña incorrectos.');
    }
  });

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-marca-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <img src="/logo-mapa.png" alt="" className="w-28" />
        {/* Trazo de pulso en el amarillo de la marca */}
        <svg viewBox="0 0 600 120" className="absolute inset-x-0 top-1/2 w-full -translate-y-1/2 text-marca-500/30" fill="none" aria-hidden>
          <path d="M0 70h170l18-40 26 78 22-58 14 20h350" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="relative max-w-md">
          <p className="text-sm font-semibold tracking-widest text-marca-500 uppercase">Light a Candle · Dominican Republic</p>
          <p className="mt-3 text-3xl leading-tight font-semibold tracking-tight">Seguimiento de la presión arterial en los bateyes, paciente por paciente.</p>
          <p className="mt-3 text-white/60">Jornadas trimestrales, clasificación automática y dispensación de medicamentos.</p>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <form onSubmit={alEnviar} className="w-full max-w-sm space-y-5" noValidate>
          <img src="/logo.webp" alt="Light a Candle · Dominican Republic" className="mb-8 w-64" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Iniciar sesión en HTA-Soft</h1>
            <p className="mt-1 text-sm text-tenue">Entra con tu cuenta del centro.</p>
          </div>
          <Campo etiqueta="Correo" error={formState.errors.email?.message}>
            <Entrada type="email" autoComplete="username" autoFocus {...register('email')} aria-invalid={!!formState.errors.email} />
          </Campo>
          <Campo etiqueta="Contraseña" error={formState.errors.password?.message}>
            <Entrada type="password" autoComplete="current-password" {...register('password')} aria-invalid={!!formState.errors.password} />
          </Campo>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Boton type="submit" className="w-full" cargando={formState.isSubmitting}>
            Entrar
          </Boton>
        </form>
      </div>
    </div>
  );
}
