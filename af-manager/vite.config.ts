import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import packageJson from './package.json'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageJson.version)
  }
})
