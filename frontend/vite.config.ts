import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: true,
    // In der Entwicklung läuft das Backend lokal; im Betrieb zeigt VITE_API_URL auf Heroku.
    proxy: {
      '/api': process.env.BACKEND_URL ?? 'http://localhost:2412',
    },
    // Erlaubt das Testen auf dem Handy über einen Cloudflare-Tunnel (siehe README).
    allowedHosts: ['.trycloudflare.com'],
  },
  build: {
    // three.js steckt im Chunk der 3D-Szene, der neben der Oberfläche nachgeladen wird.
    chunkSizeWarningLimit: 700,
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
