import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths: the same build works on localhost and under the
  // GitHub Pages project path (/razer_driver/).
  base: './',
  plugins: [react()],
})
