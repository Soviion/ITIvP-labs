import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Один файл настроек на весь проект: клиент читает переменные VITE_* из корневого .env (папка выше).
  // Остальные переменные (ключи, пароли) в браузер не попадают: Vite отдаёт клиенту только имена с префиксом VITE_.
  envDir: '..',
})
