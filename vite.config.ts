import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['diary.learnmath2.xyz'],
    proxy: {
      '/api': 'http://127.0.0.1:4173',
    },
  },
  preview: {
    allowedHosts: ['diary.learnmath2.xyz'],
  },
})
