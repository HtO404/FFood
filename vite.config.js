import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    // 手动分包：segmentit 是超大依赖（3.6MB），单独拆出避免阻塞首屏
    rollupOptions: {
      output: {
        manualChunks: {
          // 中文分词引擎：体积大，独立 chunk
          segmenter: ['segmentit'],
          // Vue 生态运行时
          vue: ['vue', 'vue-router'],
        },
      },
    },
    // 提高 chunk 大小警告阈值（segmentit 确实大，分包后不再误报）
    chunkSizeWarningLimit: 4000,
  },
})
