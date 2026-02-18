import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({
      include: ['better-sqlite3']
    })],
    resolve: {
      alias: {
        '@shared': resolve('shared'),
        '@main': resolve('src/main')
      }
    },
    build: {
      rollupOptions: {
        external: ['better-sqlite3']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    root: resolve('src/renderer'),
    base: '/',
    plugins: [react()],
    resolve: {
      alias: {
        '@shared': resolve('shared'),
        '@renderer': resolve('src/renderer')
      }
    },
    css: {
      devSourcemap: true
    },
    server: {
      port: 5174,
      strictPort: false
    }
  }
})
