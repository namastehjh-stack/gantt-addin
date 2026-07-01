import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [vue()],
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'dev/index.html'),
        dialog: resolve(__dirname, 'dev/dialog.html'),
      },
    },
    outDir: 'dist',
  },
})
