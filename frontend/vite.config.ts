import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// EXPLORER_API points the /api proxy at a backend (a worktree shoots against the
// seat's :8001 while Bobbo's :8000 keeps running); VITE_PORT moves the dev server
// so a second one can run beside his :5173.
const apiTarget = process.env.EXPLORER_API ?? 'http://127.0.0.1:8000'
const port = Number(process.env.VITE_PORT ?? 5173)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
})
