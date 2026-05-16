import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite config — talks to the Flask API on :5050 via a /api proxy
// so the browser never has to cross origins.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5050',
        changeOrigin: true,
      },
    },
  },
})
