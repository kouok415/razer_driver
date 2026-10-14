import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths: the same build works on localhost and under the
  // GitHub Pages project path (/razer_driver/).
  base: './',
  plugins: [react()],
  build: {
    // Two pages: the app and the read-only USB/HID diagnostic page.
    // Vite 8 bundles with rolldown; `rollupOptions` is only a deprecated alias.
    rolldownOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        probe: fileURLToPath(new URL('./probe.html', import.meta.url)),
      },
    },
  },
})
