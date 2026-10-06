# HTA-Soft · frontend

React 19 + Vite + Tailwind v4 + TanStack Query + react-hook-form/zod para el backend `hta-soft-backend`.

```bash
npm install
npm run dev        # http://localhost:5174
```

El proxy de Vite manda `/api` y `/uploads` al backend indicado en `API_URL` (archivo `.env`).
Usuarios del seed: `admin@hta.com` y `doctor@hta.com` (contraseña en `hta-soft-backend/prisma/seed.ts`).
