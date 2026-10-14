import { IDBFactory } from 'fake-indexeddb';
import { createStore, values } from 'idb-keyval';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pendiente } from './cola';

// Solo se simula el envío; ErrorApi queda real para que `instanceof` funcione en la cola.
vi.mock('../api/client', async (original) => ({ ...(await original<typeof import('../api/client')>()), enviar: vi.fn() }));

type Cola = typeof import('./cola');
type Cliente = typeof import('../api/client');
let cola: Cola;
let enviar: ReturnType<typeof vi.fn>;
let ErrorApi: Cliente['ErrorApi'];

/** Lo que de verdad quedó guardado en IndexedDB (no la copia en memoria del módulo). */
const guardados = async () => ((await values(createStore('hta-pendientes', 'pendientes'))) as Pendiente[]).sort((a, b) => a.creado.localeCompare(b.creado));

const nuevo = (id: string, pacienteId = 1): Omit<Pendiente, 'creado' | 'intentos'> => ({
  id,
  tipo: 'visita',
  ruta: `/visitas/${id}`,
  metodo: 'POST',
  cuerpo: { clienteId: id },
  resumen: { pacienteId, paciente: `Paciente ${pacienteId}`, detalle: 'Visita' },
});

/** Agrega en un orden de creación conocido (el reloj avanza un minuto entre cada uno). */
async function agregarEnOrden(...ids: string[]) {
  for (const [i, id] of ids.entries()) {
    vi.setSystemTime(new Date(2026, 9, 6, 9, i));
    await cola.agregarPendiente(nuevo(id));
  }
}

const enLinea = (si: boolean) => vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(si);

beforeEach(async () => {
  // La cola guarda estado a nivel de módulo y lee IndexedDB al importarse: base nueva y módulo nuevo en cada prueba.
  globalThis.indexedDB = new IDBFactory();
  vi.resetModules();
  // Solo Date: IndexedDB falso usa timers reales para resolver sus peticiones.
  vi.useFakeTimers({ toFake: ['Date'] });
  cola = await import('./cola');
  const cliente = await import('../api/client');
  enviar = cliente.enviar as unknown as ReturnType<typeof vi.fn>;
  ErrorApi = cliente.ErrorApi;
  enviar.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('agregarPendiente / descartarPendiente', () => {
  it('guarda el registro en IndexedDB con fecha de creación y 0 intentos', async () => {
    vi.setSystemTime(new Date('2026-10-06T14:00:00Z'));
    await cola.agregarPendiente(nuevo('a'));
    const [p] = await guardados();
    expect(p).toMatchObject({ id: 'a', ruta: '/visitas/a', intentos: 0, creado: '2026-10-06T14:00:00.000Z' });
    expect(p.error).toBeUndefined();
  });

  it('sobrevive a recargar el módulo (cerrar la pestaña)', async () => {
    await cola.agregarPendiente(nuevo('a'));
    vi.resetModules();
    const otra = await import('./cola');
    // Al importarse vuelve a leer la base; se le da un respiro a la lectura asíncrona.
    await vi.waitFor(async () => {
      enviar.mockResolvedValue(undefined);
      const r = await otra.sincronizar();
      expect(r.enviados).toBe(1);
    });
  });

  it('descartarPendiente lo quita de la cola', async () => {
    await agregarEnOrden('a', 'b');
    await cola.descartarPendiente('a');
    expect((await guardados()).map((p) => p.id)).toEqual(['b']);
  });
});

describe('sincronizar', () => {
  it('envía en orden de creación (no por id) y borra lo enviado', async () => {
    await agregarEnOrden('z', 'm', 'a');
    enviar.mockResolvedValue(undefined);
    const r = await cola.sincronizar();
    expect(r).toEqual({ enviados: 3, conError: 0 });
    expect(enviar.mock.calls.map((c) => c[0])).toEqual(['/visitas/z', '/visitas/m', '/visitas/a']);
    expect(enviar).toHaveBeenCalledWith('/visitas/z', 'POST', { clienteId: 'z' });
    expect(await guardados()).toEqual([]);
  });

  it('avisa al terminar solo si envió algo (para refrescar las consultas)', async () => {
    const alTerminar = vi.fn();
    cola.alTerminarSincronizacion(alTerminar);
    await cola.sincronizar();
    expect(alTerminar).not.toHaveBeenCalled();
    await agregarEnOrden('a');
    enviar.mockResolvedValue(undefined);
    await cola.sincronizar();
    expect(alTerminar).toHaveBeenCalledTimes(1);
  });

  it('sin conexión según el navegador no intenta nada', async () => {
    await agregarEnOrden('a');
    enLinea(false);
    expect(await cola.sincronizar()).toEqual({ enviados: 0, conError: 0 });
    expect(enviar).not.toHaveBeenCalled();
    expect(await guardados()).toHaveLength(1);
  });

  it.each([
    ['fetch sin respuesta (TypeError)', () => new TypeError('Failed to fetch')],
    ['servidor caído (5xx)', () => new ErrorApi('Bad Gateway', 502)],
  ])('se detiene ante %s y conserva el resto sin marcarlo', async (_, error) => {
    await agregarEnOrden('a', 'b', 'c');
    enviar.mockResolvedValueOnce(undefined).mockRejectedValueOnce(error());
    const r = await cola.sincronizar();
    expect(r).toEqual({ enviados: 1, conError: 0 });
    // No siguió con "c" después del corte.
    expect(enviar).toHaveBeenCalledTimes(2);
    const quedan = await guardados();
    expect(quedan.map((p) => p.id)).toEqual(['b', 'c']);
    expect(quedan.every((p) => !p.error && p.intentos === 0)).toBe(true);
  });

  it('se detiene si la conexión se pierde a mitad del envío', async () => {
    await agregarEnOrden('a', 'b');
    const offline = enLinea(true);
    enviar.mockImplementationOnce(async () => {
      offline.mockReturnValue(false);
      throw new ErrorApi('Algo', 400);
    });
    const r = await cola.sincronizar();
    // Con el navegador sin red, ni un 400 se toma como rechazo: se reintentará luego.
    expect(r).toEqual({ enviados: 0, conError: 0 });
    expect((await guardados()).every((p) => !p.error)).toBe(true);
  });

  it('un 409 cuenta como enviado (ya había llegado) y se borra', async () => {
    await agregarEnOrden('a', 'b');
    enviar.mockRejectedValueOnce(new ErrorApi('Ya existe', 409)).mockResolvedValueOnce(undefined);
    expect(await cola.sincronizar()).toEqual({ enviados: 2, conError: 0 });
    expect(await guardados()).toEqual([]);
  });

  it('un 4xx marca el registro con el error y sigue con el resto', async () => {
    await agregarEnOrden('a', 'b');
    enviar.mockRejectedValueOnce(new ErrorApi('No hay inventario de Amlodipino', 422)).mockResolvedValueOnce(undefined);
    expect(await cola.sincronizar()).toEqual({ enviados: 1, conError: 1 });
    const quedan = await guardados();
    expect(quedan).toHaveLength(1);
    expect(quedan[0]).toMatchObject({ id: 'a', intentos: 1, error: 'No hay inventario de Amlodipino' });
  });

  it('lo que tiene error no se reintenta solo', async () => {
    await agregarEnOrden('a', 'b');
    enviar.mockRejectedValueOnce(new ErrorApi('Rechazado', 400)).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await cola.sincronizar();
    enviar.mockReset().mockResolvedValue(undefined);
    expect(await cola.sincronizar()).toEqual({ enviados: 1, conError: 0 });
    expect(enviar.mock.calls.map((c) => c[0])).toEqual(['/visitas/b']);
    expect((await guardados()).map((p) => p.id)).toEqual(['a']);
  });

  it('no corre dos veces a la vez', async () => {
    await agregarEnOrden('a');
    let soltar!: () => void;
    enviar.mockReturnValueOnce(new Promise<void>((r) => (soltar = r)));
    const primera = cola.sincronizar();
    expect(await cola.sincronizar()).toEqual({ enviados: 0, conError: 0 });
    // Esperar a que el primer envío esté en vuelo antes de soltarlo.
    await vi.waitFor(() => expect(enviar).toHaveBeenCalledTimes(1));
    soltar();
    expect(await primera).toEqual({ enviados: 1, conError: 0 });
    expect(enviar).toHaveBeenCalledTimes(1);
  });
});

describe('reintentarPendiente', () => {
  it('limpia el error y lo vuelve a enviar', async () => {
    await agregarEnOrden('a');
    enviar.mockRejectedValueOnce(new ErrorApi('Sin inventario', 422));
    await cola.sincronizar();
    expect((await guardados())[0].error).toBe('Sin inventario');

    enviar.mockResolvedValueOnce(undefined);
    expect(await cola.reintentarPendiente('a')).toEqual({ enviados: 1, conError: 0 });
    expect(await guardados()).toEqual([]);
  });

  it('si vuelve a fallar queda marcado otra vez con un intento más', async () => {
    await agregarEnOrden('a');
    enviar.mockRejectedValue(new ErrorApi('Sin inventario', 422));
    await cola.sincronizar();
    await cola.reintentarPendiente('a');
    expect((await guardados())[0]).toMatchObject({ intentos: 2, error: 'Sin inventario' });
  });

  it('un id que no está no hace nada', async () => {
    expect(await cola.reintentarPendiente('no-existe')).toBeUndefined();
    expect(enviar).not.toHaveBeenCalled();
  });
});

describe('esFaltaDeConexion', () => {
  it('distingue la falta de conexión de un rechazo del servidor', () => {
    expect(cola.esFaltaDeConexion(new TypeError('Failed to fetch'))).toBe(true);
    expect(cola.esFaltaDeConexion(new ErrorApi('Caído', 503))).toBe(true);
    expect(cola.esFaltaDeConexion(new ErrorApi('Inválido', 400))).toBe(false);
    expect(cola.esFaltaDeConexion(new ErrorApi('Ya existe', 409))).toBe(false);
    expect(cola.esFaltaDeConexion(new Error('otro'))).toBe(false);
    enLinea(false);
    expect(cola.esFaltaDeConexion(new ErrorApi('Inválido', 400))).toBe(true);
  });
});
