import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5174,
    proxy: {
      '/api': 'http://localhost:9100',
      '/auth': 'http://localhost:9100',
      '/ws': {
        target: 'ws://localhost:9100',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
})
