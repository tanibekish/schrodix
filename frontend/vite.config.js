import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Разрешаем все хосты, чтобы ngrok работал без проблем
    allowedHosts: [
      '.ngrok-free.app',
      'all' // Или можно просто написать 'all' для полной свободы в разработке
    ]
  }
})