import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    react(),
    legacy()
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          if (
            id.includes('@clerk/') ||
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/react-router/') ||
            id.includes('/react-router-dom/')
          ) {
            return 'vendor-react';
          }

          if (id.includes('chart.js') || id.includes('chartjs-plugin-annotation')) {
            return 'vendor-chart';
          }

          if (id.includes('jspdf') || id.includes('html2canvas')) {
            return 'vendor-export';
          }

          if (id.includes('@ionic/') || id.includes('ionicons')) {
            return 'vendor-ionic';
          }

          return undefined;
        },
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  }
})