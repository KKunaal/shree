import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',  // Use relative paths for assets (works with Cloud Storage)
  server: {
    port: 5173,
    proxy: {
      // Proxy all /api/* requests to the Django dev server
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
