import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,

    proxy: {
      '/api': {
        target: 'https://j9bkrky9d2.execute-api.ap-south-1.amazonaws.com/Prod',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
  define: {
    global: {},
    'process.env': {}
  }
})
