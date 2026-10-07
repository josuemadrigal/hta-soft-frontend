import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  // API_URL apunta al backend Nest; el proxy evita CORS y deja las rutas relativas.
  const { API_URL = 'http://localhost:3001' } = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      tailwindcss(),
      react(),
      // App instalable que abre sin internet: guarda la app en el dispositivo. Los datos (pacientes,
      // catálogos) los guarda React Query en IndexedDB y lo registrado sin señal va a una cola (src/offline).
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.png', 'apple-touch-icon.png', 'logo.webp', 'logo-icono.png'],
        manifest: {
          name: 'HTA-Soft · Light a Candle',
          short_name: 'HTA-Soft',
          description: 'Control de la hipertensión en los bateyes de La Romana',
          lang: 'es',
          start_url: '/',
          display: 'standalone',
          background_color: '#f7f5f1',
          theme_color: '#fed801',
          icons: [
            { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,png,webp,svg,woff2}'],
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          // Cualquier ruta de la app abre sin internet; la API y las fotos no se sirven desde aquí.
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api/, /^\/uploads/],
          runtimeCaching: [
            { urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, handler: 'CacheFirst', options: { cacheName: 'fuentes', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } } },
            { urlPattern: /\/uploads\/.*/, handler: 'CacheFirst', options: { cacheName: 'fotos', expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 30 } } },
            { urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/, handler: 'CacheFirst', options: { cacheName: 'mapa', expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 } } },
          ],
        },
        devOptions: { enabled: false },
      }),
    ],
    server: {
      port: 5174,
      strictPort: true,
      proxy: {
        '/api': { target: API_URL, changeOrigin: true },
        '/uploads': { target: API_URL, changeOrigin: true },
      },
    },
    preview: {
      port: 4174,
      proxy: {
        '/api': { target: API_URL, changeOrigin: true },
        '/uploads': { target: API_URL, changeOrigin: true },
      },
    },
  };
});
