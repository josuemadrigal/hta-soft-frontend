import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { Toaster } from 'sonner';
import { App } from './App';
import { ErrorApi } from './api/client';
import { ProveedorSesion } from './auth/sesion';
import { ProveedorConfirmar } from './components/confirmar';
import './index.css';

const cliente = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Un 4xx no se arregla reintentando.
      retry: (n, e) => !(e instanceof ErrorApi && e.status < 500) && n < 2,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={cliente}>
      <BrowserRouter>
        <ProveedorSesion>
          <ProveedorConfirmar>
            <App />
          </ProveedorConfirmar>
          <Toaster position="top-right" richColors closeButton />
        </ProveedorSesion>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
