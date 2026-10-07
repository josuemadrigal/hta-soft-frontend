import { createStore, del, set, values } from 'idb-keyval';
import { useSyncExternalStore } from 'react';
import { enviar, ErrorApi } from '../api/client';

/**
 * Cola de lo que se registró sin internet (visitas, "No vino"). Vive en IndexedDB: sobrevive a
 * cerrar la pestaña o apagar la tablet, y se envía sola cuando vuelve la conexión.
 *
 * Cada registro lleva un clienteId generado aquí: si el envío se corta a mitad y se repite, el
 * servidor reconoce el id y no duplica la visita ni descuenta dos veces el inventario.
 */

export type TipoPendiente = 'visita' | 'no-vino' | 'quitar-no-vino';

export type Pendiente = {
  id: string;
  tipo: TipoPendiente;
  ruta: string;
  metodo: 'POST' | 'DELETE';
  cuerpo?: unknown;
  creado: string;
  intentos: number;
  /** Si el servidor lo rechazó (no es un problema de conexión): queda para revisarlo a mano. */
  error?: string;
  resumen: { pacienteId: number; paciente: string; detalle: string };
};

// Cada almacén en su propia base: idb-keyval solo crea el almacén al crear la base.
const almacen = createStore('hta-pendientes', 'pendientes');
let lista: Pendiente[] = [];
let estado: { sincronizando: boolean; ultimo: string | null } = { sincronizando: false, ultimo: null };
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());

async function recargar() {
  try {
    lista = ((await values(almacen)) as Pendiente[]).sort((a, b) => a.creado.localeCompare(b.creado));
  } catch {
    lista = [];
  }
  avisar();
}
void recargar();
// Base de una versión anterior (las dos cosas en la misma base no funcionaba).
try {
  indexedDB.deleteDatabase('hta-sin-internet');
} catch {
  /* sin IndexedDB */
}

export async function agregarPendiente(p: Omit<Pendiente, 'creado' | 'intentos'>) {
  await set(p.id, { ...p, creado: new Date().toISOString(), intentos: 0 }, almacen);
  await recargar();
}

export async function descartarPendiente(id: string) {
  await del(id, almacen);
  await recargar();
}

/** Lo pendiente, para la interfaz (se actualiza solo). */
export function usePendientes() {
  return useSyncExternalStore(
    (f) => (oyentes.add(f), () => oyentes.delete(f)),
    () => lista,
  );
}
export function useEstadoSincronizacion() {
  return useSyncExternalStore(
    (f) => (oyentes.add(f), () => oyentes.delete(f)),
    () => estado,
  );
}

/** Sin conexión: el navegador lo dice, o el fetch falló sin respuesta, o el servidor no está. */
export const esFaltaDeConexion = (e: unknown) => !navigator.onLine || e instanceof TypeError || (e instanceof ErrorApi && e.status >= 500);

let alSincronizar: (() => void) | null = null;
/** Lo que hay que refrescar después de enviar (lo registra main.tsx con el QueryClient). */
export function alTerminarSincronizacion(f: () => void) {
  alSincronizar = f;
}

/**
 * Envía la cola en orden. Si no hay conexión se detiene y lo intenta después; si el servidor
 * rechaza un registro (p. ej. no hay inventario), lo deja marcado con el error y sigue con el resto.
 */
export async function sincronizar() {
  if (estado.sincronizando || !navigator.onLine) return { enviados: 0, conError: 0 };
  estado = { ...estado, sincronizando: true };
  avisar();
  let enviados = 0;
  let conError = 0;
  try {
    for (const p of [...lista].filter((x) => !x.error)) {
      try {
        await enviar(p.ruta, p.metodo, p.cuerpo);
        await del(p.id, almacen);
        enviados++;
      } catch (e) {
        if (esFaltaDeConexion(e)) break;
        // 409: ya estaba (un envío anterior llegó aunque no recibimos la respuesta).
        if (e instanceof ErrorApi && e.status === 409) {
          await del(p.id, almacen);
          enviados++;
          continue;
        }
        conError++;
        await set(p.id, { ...p, intentos: p.intentos + 1, error: e instanceof Error ? e.message : 'Error desconocido' }, almacen);
      }
    }
  } finally {
    estado = { sincronizando: false, ultimo: new Date().toISOString() };
    await recargar();
    if (enviados) alSincronizar?.();
  }
  return { enviados, conError };
}

/** Vuelve a intentar un registro que el servidor había rechazado (p. ej. tras cargar inventario). */
export async function reintentarPendiente(id: string) {
  const p = lista.find((x) => x.id === id);
  if (!p) return;
  await set(id, { ...p, error: undefined }, almacen);
  await recargar();
  return sincronizar();
}

/** Arranca los envíos automáticos: al volver la conexión y cada minuto. */
export function iniciarSincronizacion() {
  window.addEventListener('online', () => void sincronizar());
  window.setInterval(() => {
    if (lista.some((p) => !p.error)) void sincronizar();
  }, 60_000);
  void recargar().then(() => sincronizar());
}

export const nuevoId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
