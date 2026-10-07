import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { Toaster } from 'sonner';
import { App } from './App';
import { ErrorApi } from './api/client';
import { ProveedorSesion } from './auth/sesion';
import { ProveedorConfirmar } from './components/confirmar';
import { alTerminarSincronizacion, iniciarSincronizacion } from './offline/cola';
import { DIAS_GUARDADO, guardarConsulta, persistidor } from './offline/datos';
import './index.css';

const cliente = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Sin internet se usa lo guardado en el dispositivo en vez de quedarse esperando.
      networkMode: 'offlineFirst',
      gcTime: DIAS_GUARDADO * 24 * 60 * 60 * 1000,
      // Un 4xx no se arregla reintentando.
      retry: (n, e) => !(e instanceof ErrorApi && e.status < 500) && n < 2,
    },
    mutations: { networkMode: 'offlineFirst' },
  },
});

// Lo registrado sin internet se envía solo; al terminar se refresca lo que cambió.
alTerminarSincronizacion(() => {
  for (const k of ['jornada', 'paciente', 'pacientes', 'visitas', 'stats', 'medicamentos', 'jornadas']) void cliente.invalidateQueries({ queryKey: [k] });
});
iniciarSincronizacion();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={cliente}
      persistOptions={{ persister: persistidor, maxAge: DIAS_GUARDADO * 24 * 60 * 60 * 1000, buster: 'v1', dehydrateOptions: { shouldDehydrateQuery: guardarConsulta } }}
    >
      <BrowserRouter>
        <ProveedorSesion>
          <ProveedorConfirmar>
            <App />
          </ProveedorConfirmar>
          <Toaster position="top-right" richColors closeButton />
        </ProveedorSesion>
      </BrowserRouter>
    </PersistQueryClientProvider>
  </StrictMode>,
);
