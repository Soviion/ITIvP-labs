# Образ frontend: React-приложение собирается в статические файлы (этап 1), которые отдаёт nginx (этап 2).
# В итоговый образ попадают только готовые файлы и nginx: Node.js, исходники и node_modules остаются в этапе сборки.
# Образы можно подменить, если Docker Hub недоступен:
#   --build-arg NODE_IMAGE=mirror.gcr.io/library/node:24-alpine --build-arg NGINX_IMAGE=mirror.gcr.io/library/nginx:alpine

ARG NODE_IMAGE=node:24-alpine
ARG NGINX_IMAGE=nginx:alpine

# ---------- этап 1: сборка ----------
FROM ${NODE_IMAGE} AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---------- этап 2: nginx ----------
FROM ${NGINX_IMAGE}
ENV TZ=Europe/Minsk
COPY nginx.conf /etc/nginx/conf.d/default.conf
# скрипт из /docker-entrypoint.d/ nginx запускает сам перед стартом: он создаёт config.js с адресом API из переменной окружения
COPY docker/40-app-config.sh /docker-entrypoint.d/40-app-config.sh
# sed убирает возможные переводы строк Windows (\r): с ними Linux не смог бы запустить скрипт
RUN sed -i 's/\r$//' /docker-entrypoint.d/40-app-config.sh && chmod +x /docker-entrypoint.d/40-app-config.sh
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
