import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/chat': 'http://localhost:8000',
      '/sources': 'http://localhost:8000',
      '/ingest': 'http://localhost:8000',
      '/upload': 'http://localhost:8000',
    },
  },
})
