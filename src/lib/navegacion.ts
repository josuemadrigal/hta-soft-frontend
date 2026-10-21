import { useNavigate } from 'react-router';

/** ¿Hay una pantalla anterior de la app en el historial? (React Router guarda la posición en history.state.idx) */
export const hayAnterior = () => ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;

/**
 * Volver a la pantalla anterior, como el botón Atrás del navegador. Si no hay una (se abrió el enlace
 * directo, o se recargó), va a `alternativa` reemplazando la actual, para que Atrás no vuelva a ella.
 * Se usa en los enlaces de volver y al terminar un formulario: así no queda el formulario guardado en el
 * historial y "atrás" lleva siempre a donde se estaba.
 */
export function useVolver() {
  const navegar = useNavigate();
  return (alternativa: string) => {
    if (hayAnterior()) navegar(-1);
    else navegar(alternativa, { replace: true });
  };
}
