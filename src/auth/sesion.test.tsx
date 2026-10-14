import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Usuario } from '../api/tipos';
import { ProveedorSesion, useSesion } from './sesion';

// Lo que sale a la red o toca IndexedDB se simula: aquí solo importa la regla de inactividad.
vi.mock('../api/recursos', () => ({ obtenerYo: vi.fn(() => new Promise(() => {})), iniciarSesion: vi.fn() }));
vi.mock('../api/consultas', () => ({ useConfiguracion: () => ({ data: { sesionMinutosInactividad: 30 } }) }));
vi.mock('../offline/datos', () => ({ borrarDatosGuardados: vi.fn(async () => {}) }));
vi.mock('sonner', () => ({ toast: { info: vi.fn() } }));

const { borrarDatosGuardados } = await import('../offline/datos');

const usuario: Usuario = {
  id: 7,
  email: 'medico@ejemplo.test',
  firstName: 'Rosa',
  lastName: 'Díaz',
  role: { id: 2, name: 'Médico', permissions: ['visitas.editar'], isSystem: false },
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

function Quien() {
  const { usuario } = useSesion();
  return <p>{usuario ? `Conectado: ${usuario.firstName}` : 'Sin sesión'}</p>;
}

const montar = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ProveedorSesion>
        <Quien />
      </ProveedorSesion>
    </QueryClientProvider>,
  );

const enLinea = (si: boolean) => vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(si);

describe('cierre por inactividad', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(borrarDatosGuardados).mockClear();
    localStorage.setItem('hta.sesion', JSON.stringify({ access_token: 'a', refresh_token: 'r', user: usuario }));
  });

  const inactivoDesdeHace = (minutos: number) => localStorage.setItem('hta:ultima-actividad', String(Date.now() - minutos * 60_000));

  it('con actividad reciente la sesión sigue abierta', () => {
    inactivoDesdeHace(5);
    montar();
    expect(screen.getByText('Conectado: Rosa')).toBeInTheDocument();
    expect(localStorage.getItem('hta.sesion')).not.toBeNull();
  });

  it('con internet y el tiempo cumplido, cierra la sesión y borra lo guardado', () => {
    inactivoDesdeHace(45);
    enLinea(true);
    montar();
    expect(screen.getByText('Sin sesión')).toBeInTheDocument();
    expect(localStorage.getItem('hta.sesion')).toBeNull();
    expect(borrarDatosGuardados).toHaveBeenCalledTimes(1);
  });

  it('sin internet no cierra (no podría volver a entrar); cierra al volver la conexión', () => {
    vi.useFakeTimers();
    try {
      inactivoDesdeHace(5);
      const conexion = enLinea(true);
      montar();
      expect(screen.getByText('Conectado: Rosa')).toBeInTheDocument();

      // Se va la señal y la tablet queda quieta 40 minutos: el reloj revisa cada 30 s pero no cierra.
      conexion.mockReturnValue(false);
      act(() => {
        vi.advanceTimersByTime(40 * 60_000);
      });
      expect(screen.getByText('Conectado: Rosa')).toBeInTheDocument();
      expect(borrarDatosGuardados).not.toHaveBeenCalled();

      // Vuelve la señal: el tiempo ya se cumplió, se cierra enseguida.
      conexion.mockReturnValue(true);
      act(() => {
        window.dispatchEvent(new Event('online'));
      });
      expect(screen.getByText('Sin sesión')).toBeInTheDocument();
      expect(localStorage.getItem('hta.sesion')).toBeNull();
      expect(borrarDatosGuardados).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
