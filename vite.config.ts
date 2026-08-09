/// <reference types="vitest" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  return {
    plugins: [react(), tailwindcss()],
    base: '/wellcare-services/',
    // Environment variables with VITE_ prefix are automatically available
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          // Cache-stable vendor chunks: framework code changes rarely, so it
          // should not invalidate app-code caches (or vice versa). Heavy libs
          // (recharts, @google/genai) already live in lazy view chunks.
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react-vendor'
            if (id.includes('node_modules/@supabase/')) return 'supabase'
            if (id.includes('node_modules/motion/') || id.includes('node_modules/framer-motion/'))
              return 'motion'
          },
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.ts',
      exclude: ['node_modules', 'tests', 'dist', '.kilo', '.worktrees'],
    },
  }
})
