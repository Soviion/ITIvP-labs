#!/bin/sh
# Запускается образом nginx перед стартом. Создаёт /config.js с адресом сервера (API и WebSocket) из переменной окружения
# VITE_API_URL, которая приходит из .env через env_file в docker-compose.yml. Так домен меняется в .env, без пересборки образа.
set -eu

api="${VITE_API_URL:-}"
if [ -z "$api" ]; then
  echo "ВНИМАНИЕ: VITE_API_URL не задан в .env, клиент будет обращаться к http://localhost:3000" >&2
fi

# в значение попадает только то, что может быть адресом: кавычки и обратные слэши убираем, чтобы не сломать JavaScript
safe=$(printf '%s' "$api" | tr -d '"\\\r\n ')
printf 'window.__APP_CONFIG__ = { apiUrl: "%s" };\n' "$safe" > /usr/share/nginx/html/config.js
echo "config.js создан, apiUrl: ${safe:-<не задан>}"
