import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Zona horaria fija (la de La Romana, sin horario de verano): las fechas dan igual en cualquier máquina.
process.env.TZ = 'America/Santo_Domingo';

// Configuración aparte de vite.config.ts: el plugin PWA y el proxy no hacen falta en las pruebas.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
});
