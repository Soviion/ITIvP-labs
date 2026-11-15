# Образ backend: Node.js + Express + Socket.IO. Контекст сборки – корень репозитория (клиент в образ не попадает, см. .dockerignore).
# Образ Node можно подменить, если Docker Hub недоступен: --build-arg NODE_IMAGE=mirror.gcr.io/library/node:24-alpine

ARG NODE_IMAGE=node:24-alpine

# ---------- этап 1: зависимости ----------
# Отдельный этап, чтобы слой с node_modules пересобирался только при изменении package*.json, а не при каждой правке кода
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---------- этап 2: рабочий образ ----------
FROM ${NODE_IMAGE}
ENV NODE_ENV=production \
    TZ=Europe/Minsk
# tzdata нужен для часового пояса TZ (даты приёмов и «сегодня» в опросе считаются по Минску)
RUN apk add --no-cache tzdata
WORKDIR /app
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node . .
# не от root: процессу не нужны права администратора, сервер ничего не пишет на диск
USER node
EXPOSE 3000
CMD ["node", "server.js"]
