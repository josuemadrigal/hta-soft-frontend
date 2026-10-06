import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // API_URL apunta al backend Nest; el proxy evita CORS y deja las rutas relativas.
  const { API_URL = 'http://localhost:3001' } = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [tailwindcss(), react()],
    server: {
      port: 5174,
      strictPort: true,
      proxy: {
        '/api': { target: API_URL, changeOrigin: true },
        '/uploads': { target: API_URL, changeOrigin: true },
      },
    },
  };
});
