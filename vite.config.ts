import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // 抑制模块级指令警告
    rollupOptions: {
      onwarn(warning, warn) {
        // 忽略 "use client" 指令警告
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
          return
        }
        warn(warning)
      }
    },
    // 调整chunk大小警告限制
    chunkSizeWarningLimit: 1000
  }
})