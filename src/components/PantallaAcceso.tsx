import { useEffect, type ReactNode } from 'react';

/**
 * Marco de las pantallas sin sesión (iniciar sesión, olvidé mi contraseña, restablecerla):
 * foto apagada con el mensaje de la fundación a la izquierda en escritorio, o como franja arriba
 * en tablet y teléfono, y el formulario en una hoja clara.
 */
export function PantallaAcceso({ children }: { children: ReactNode }) {
  // La barra del sistema (teléfono, tablet, PWA) se pinta del negro de la franja y no del amarillo.
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) return;
    const antes = meta.content;
    meta.content = '#14120f';
    return () => {
      meta.content = antes;
    };
  }, []);

  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr] bg-marca-900 lg:grid-cols-[1.1fr_1fr] lg:grid-rows-1">
      {/* En escritorio, columna a la izquierda; en tablet y teléfono, franja arriba del formulario */}
      <div className="relative flex min-h-[38dvh] flex-col justify-end overflow-hidden bg-marca-900 px-6 pt-28 pb-14 sm:min-h-0 text-white sm:px-10 sm:pt-44 sm:pb-20 lg:p-12">
        {/* Foto de fondo apagada: el panel sigue siendo negro y el texto se lee bien */}
        <img src="/login-fondo.webp" alt="" className="absolute inset-0 size-full object-cover opacity-60 grayscale-[35%]" aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-t from-marca-900 via-marca-900/75 to-marca-900/35" aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-r from-marca-900/60 to-transparent" aria-hidden />

        {/* Trazo de pulso en el amarillo de la marca */}
        <svg viewBox="0 0 600 120" className="absolute inset-x-0 top-12 w-full -translate-y-1/2 text-marca-500/40 sm:top-16 lg:top-1/2" fill="none" aria-hidden>
          <path d="M0 70h170l18-40 26 78 22-58 14 20h350" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {/* Mismo ancho que el formulario en tablet, para que ambos queden alineados */}
        <div className="relative mx-auto w-full max-w-sm sm:max-w-md lg:mx-0 lg:max-w-lg">
          {/* En teléfono y tablet el logo del formulario ya lo dice justo debajo */}
          <p className="hidden text-sm font-semibold tracking-widest text-marca-500 uppercase lg:block">Light a Candle · Dominican Republic</p>
          <p className="text-[1.75rem] leading-[1.15] font-semibold tracking-tight text-balance sm:text-4xl lg:mt-4">Cuidamos la presión arterial de cada paciente.</p>
          <p className="mt-3 hidden leading-relaxed text-white/70 text-pretty sm:block lg:mt-4 lg:text-lg">
            Registra las visitas de la jornada, entrega los medicamentos y detecta a tiempo a quien necesita atención, aunque no haya señal.
          </p>
        </div>
      </div>

      {/* En teléfono y tablet, una hoja clara que sube sobre la franja */}
      <div className="relative -mt-6 flex justify-center rounded-t-3xl bg-fondo px-6 pt-10 pb-12 sm:items-center sm:pt-12 lg:mt-0 lg:rounded-none lg:py-12">
        <div className="w-full max-w-sm sm:max-w-md lg:max-w-sm">
          <img src="/logo.webp" alt="Light a Candle · Dominican Republic" className="mb-6 w-52 sm:w-60 lg:mb-8 lg:w-64" />
          {children}
        </div>
      </div>
    </div>
  );
}
