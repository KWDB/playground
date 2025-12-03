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
      },
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['lucide-react', 'clsx', 'tailwind-merge', 'react-resizable-panels'],
          'vendor-terminal': ['xterm', 'xterm-addon-fit', '@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-web-links'],
          'vendor-editor': ['@codemirror/view', '@codemirror/state', '@codemirror/language', '@codemirror/lang-sql', '@codemirror/autocomplete', '@codemirror/lint', '@codemirror/highlight'],
          'vendor-markdown': ['react-markdown', 'remark-gfm', 'rehype-raw', 'rehype-highlight', 'highlight.js', 'react-syntax-highlighter']
        }
      }
    },
    // 调整chunk大小警告限制
    chunkSizeWarningLimit: 1000
  }
})