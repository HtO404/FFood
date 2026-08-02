import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'FFood 食材管理',
        short_name: 'FFood',
        description: '家庭食材管理 — 保鲜提醒、智能识别、菜谱推荐',
        theme_color: '#34c759',
        background_color: '#f2f2f7',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // 预缓存：核心 JS/CSS/HTML
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // segmentit chunk 很大（3.6MB），不预缓存，按需加载
        globIgnores: ['**/segmenter-*.js'],
        runtimeCaching: [
          {
            // API 请求：NetworkFirst，后端不通时用缓存
            urlPattern: /\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'ffood-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 86400, // 24h
              },
            },
          },
          {
            // 字体/图片等静态资源：CacheFirst
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ffood-image-cache',
              expiration: { maxEntries: 60, maxAgeSeconds: 604800 },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
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
    rollupOptions: {
      output: {
        manualChunks: {
          segmenter: ['segmentit'],
          vue: ['vue', 'vue-router'],
        },
      },
    },
    chunkSizeWarningLimit: 4000,
  },
})
