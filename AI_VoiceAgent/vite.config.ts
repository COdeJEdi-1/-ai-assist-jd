import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/omnidim': {
        target: 'https://backend.omnidim.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/omnidim/, '/api/v1'),
      },
    },
  },
})
