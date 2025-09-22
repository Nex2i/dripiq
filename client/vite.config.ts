/// <reference types="vitest" />
import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import tailwindcss from '@tailwindcss/vite'

import { resolve } from 'node:path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [viteReact(), tailwindcss(), svgr()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  define: {
    'import.meta.env.VITE_APP_URL': JSON.stringify(process.env.VITE_APP_URL || 'https://dripiq.ai'),
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
})
