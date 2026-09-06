import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  },
  build: {
    // El bundle era un único chunk de ~630 kB: en la primera visita el usuario
    // descargaba React Flow y dagre aunque solo fuera a ver el listado. Separar
    // las librerías pesadas permite además cachearlas entre despliegues, porque
    // su hash no cambia al tocar el código de la aplicación.
    rollupOptions: {
      output: {
        manualChunks: {
          diagram: ['@xyflow/react', 'dagre'],
          icons: ['lucide-react'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{js,jsx}'],
  },
})
