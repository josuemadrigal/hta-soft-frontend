import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { EVENTO_SESION_EXPIRADA, guardarSesion, leerSesion } from '../api/client';
import { iniciarSesion, obtenerYo } from '../api/recursos';
import type { Usuario } from '../api/tipos';
import { useConfiguracion } from '../api/consultas';
import { toast } from 'sonner';

type ContextoSesion = {
  usuario: Usuario | null;
  /** Lo que el rol del usuario le permite; el backend aplica lo mismo con 403. */
  tiene: (...permisos: string[]) => boolean;
  entrar: (email: string, password: string) => Promise<void>;
  salir: () => void;
  /** Tras editar el propio perfil (foto, nombre) para que la barra lateral lo refleje. */
  actualizarUsuario: (u: Partial<Usuario>) => void;
};

const Contexto = createContext<ContextoSesion | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => leerSesion()?.user ?? null);
  const cliente = useQueryClient();

  const salir = useCallback(() => {
    guardarSesion(null);
    setUsuario(null);
    cliente.clear();
  }, [cliente]);

  // Lo guardado puede estar viejo (otro admin le cambió el rol o lo desactivó).
  const hayUsuario = !!usuario;
  useEffect(() => {
    if (!hayUsuario) return;
    obtenerYo()
      .then((yo) => {
        const sesion = leerSesion();
        if (sesion) guardarSesion({ ...sesion, user: yo });
        setUsuario(yo);
      })
      .catch(() => {
        /* un 401 ya cierra la sesión desde el cliente */
      });
  }, [hayUsuario]);

  // Cierre por inactividad: con datos de salud no se deja una sesión abierta en una computadora
  // compartida. La última actividad se comparte entre pestañas y sobrevive a cerrar el navegador.
  const minutos = useConfiguracion(hayUsuario).data?.sesionMinutosInactividad ?? 30;
  useEffect(() => {
    if (!hayUsuario) return;
    const CLAVE = 'hta:ultima-actividad';
    const leer = () => {
      try {
        return Number(localStorage.getItem(CLAVE)) || Date.now();
      } catch {
        return Date.now();
      }
    };
    let ultimaEscritura = 0;
    const marcar = () => {
      const ahora = Date.now();
      if (ahora - ultimaEscritura < 15_000) return; // no escribir en cada movimiento
      ultimaEscritura = ahora;
      try {
        localStorage.setItem(CLAVE, String(ahora));
      } catch {
        /* sin almacenamiento: se usa solo el reloj de esta pestaña */
      }
    };
    const revisar = () => {
      if (Date.now() - leer() > minutos * 60_000) {
        salir();
        toast.info(`Se cerró la sesión tras ${minutos} minutos sin actividad.`);
      }
    };
    revisar();
    marcar();
    const eventos = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
    for (const e of eventos) window.addEventListener(e, marcar, { passive: true });
    const reloj = window.setInterval(revisar, 30_000);
    return () => {
      for (const e of eventos) window.removeEventListener(e, marcar);
      window.clearInterval(reloj);
    };
  }, [hayUsuario, minutos, salir]);

  useEffect(() => {
    const alExpirar = () => {
      setUsuario(null);
      cliente.clear();
    };
    window.addEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
    return () => window.removeEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
  }, [cliente]);

  const valor = useMemo<ContextoSesion>(
    () => ({
      usuario,
      // El Administrador lo tiene todo; una sesión guardada antes de los roles (role como texto) no tiene nada hasta refrescarse.
      tiene: (...permisos) =>
        typeof usuario?.role === 'object' && (usuario.role.isSystem || permisos.every((p) => usuario.role.permissions?.includes(p))),
      async entrar(email, password) {
        const sesion = await iniciarSesion(email, password);
        if (!sesion.user.isActive) throw new Error('Este usuario está desactivado.');
        guardarSesion(sesion);
        // Empieza a contar la inactividad desde ahora (no desde la sesión anterior).
        try {
          localStorage.setItem('hta:ultima-actividad', String(Date.now()));
        } catch {
          /* sin almacenamiento */
        }
        setUsuario(sesion.user);
      },
      salir,
      actualizarUsuario(cambios) {
        const sesion = leerSesion();
        if (sesion) guardarSesion({ ...sesion, user: { ...sesion.user, ...cambios } });
        setUsuario((u) => (u ? { ...u, ...cambios } : u));
      },
    }),
    [usuario, salir],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion() {
  const c = useContext(Contexto);
  if (!c) throw new Error('useSesion fuera de ProveedorSesion');
  return c;
}
