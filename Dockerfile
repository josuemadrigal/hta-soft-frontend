# Imagen de producción de la web (PWA) de HTA-Soft: se compila con Node y se
# sirve con nginx, sin Node en la imagen final.
#
# Node 22: Vite 8 pide 20.19+ y Vitest 5 pide 22.12+; Node 20 además ya salió
# de soporte. Se usa la misma versión que en la CI.
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# El cliente llama siempre a rutas relativas (/api, /uploads): la misma imagen
# sirve para cualquier dominio y no hace falta ninguna variable VITE_ al compilar.
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=20s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
