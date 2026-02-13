import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    exclude: ['tests/playwright/**', 'node_modules/**'],
  },
})
