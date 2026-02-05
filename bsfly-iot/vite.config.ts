/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    react(),
    legacy()
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-ionic': ['@ionic/react', '@ionic/react-router', 'ionicons'],
          'vendor-chart': ['chart.js', 'chartjs-plugin-annotation'],
          'vendor-clerk': ['@clerk/clerk-react'],
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
        }
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  }
})
