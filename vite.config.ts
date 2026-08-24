import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['diary.learnmath2.xyz'],
  },
  preview: {
    allowedHosts: ['diary.learnmath2.xyz'],
  },
})
