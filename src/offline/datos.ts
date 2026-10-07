import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { Query, QueryClient } from '@tanstack/react-query';
import { createStore, del, get, set } from 'idb-keyval';
import { useSyncExternalStore } from 'react';
import { api } from '../api/client';
import * as r from '../api/recursos';
import type { Paciente, PacienteJornada } from '../api/tipos';

/**
 * Lo que se consulta en la app se guarda en el dispositivo (IndexedDB) para poder verlo sin
 * internet: la lista de la jornada, las fichas abiertas y los catálogos que usa el formulario.
 * Se borra al cerrar sesión (son datos de salud).
 */

const almacen = createStore('hta-consultas', 'consultas');
export const DIAS_GUARDADO = 7;

export const persistidor = createAsyncStoragePersister({
  storage: {
    getItem: (k) => get(k, almacen),
    setItem: (k, v) => set(k, v, almacen),
    removeItem: (k) => del(k, almacen),
  },
  key: 'hta-consultas',
  throttleTime: 2000,
});

/** Solo lo que sirve en la jornada; reportes y auditoría siempre se piden al servidor. */
const SE_GUARDAN = new Set(['jornada', 'paciente', 'comunidades', 'config-pa', 'medicamentos', 'configuracion', 'jornadas', 'yo']);
export const guardarConsulta = (q: Query) => q.state.status === 'success' && SE_GUARDAN.has(String(q.queryKey[0]));

/** Borra del dispositivo todo lo guardado (al cerrar sesión). La cola de pendientes no se toca. */
export async function borrarDatosGuardados(cliente: QueryClient) {
  cliente.clear();
  await persistidor.removeClient();
  try {
    localStorage.removeItem('hta:jornadas-descargadas');
  } catch {
    /* sin almacenamiento */
  }
}

/* ─────────── Conexión ─────────── */

const oyentes = new Set<() => void>();
window.addEventListener('online', () => oyentes.forEach((f) => f()));
window.addEventListener('offline', () => oyentes.forEach((f) => f()));
export function useEnLinea() {
  return useSyncExternalStore(
    (f) => (oyentes.add(f), () => oyentes.delete(f)),
    () => navigator.onLine,
  );
}

/* ─────────── Descargar una jornada ─────────── */

const CLAVE_DESCARGAS = 'hta:jornadas-descargadas';
export function jornadasDescargadas(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_DESCARGAS) ?? '{}');
  } catch {
    return {};
  }
}

/**
 * Deja en el dispositivo todo lo necesario para trabajar un batey sin internet: la lista de
 * pacientes, la ficha de cada uno (para el historial en el formulario) y los catálogos.
 */
export async function descargarJornada(cliente: QueryClient, comunidadId: number, alAvanzar: (hechos: number, total: number) => void) {
  const fresco = { staleTime: 0 };
  await Promise.all([
    cliente.fetchQuery({ queryKey: ['comunidades'], queryFn: r.listarComunidades, ...fresco }),
    cliente.fetchQuery({ queryKey: ['config-pa'], queryFn: r.listarConfigPA, ...fresco }),
    cliente.fetchQuery({ queryKey: ['medicamentos'], queryFn: r.listarMedicamentos, ...fresco }),
    cliente.fetchQuery({ queryKey: ['configuracion'], queryFn: r.leerConfiguracion, ...fresco }),
  ]);
  // Marcado como descarga: en Auditoría queda un solo registro en vez de uno por ficha.
  const descarga = { headers: { 'x-descarga-jornada': '1' } };
  const pacientes = await cliente.fetchQuery({ queryKey: ['jornada', comunidadId], queryFn: () => api<PacienteJornada[]>(`/patients/jornada/${comunidadId}`, descarga), ...fresco });
  let hechos = 0;
  alAvanzar(0, pacientes.length);
  // De a 6 a la vez: rápido sin saturar el servidor.
  const cola = [...pacientes];
  const trabajador = async () => {
    for (let p = cola.shift(); p; p = cola.shift()) {
      const id = p.id;
      await cliente.fetchQuery({ queryKey: ['paciente', id], queryFn: () => api<Paciente | null>(`/patients/${id}`, descarga), ...fresco }).catch(() => undefined);
      alAvanzar(++hechos, pacientes.length);
    }
  };
  await Promise.all(Array.from({ length: 6 }, trabajador));
  try {
    localStorage.setItem(CLAVE_DESCARGAS, JSON.stringify({ ...jornadasDescargadas(), [comunidadId]: new Date().toISOString() }));
  } catch {
    /* sin almacenamiento */
  }
  return pacientes.length;
}
