import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
  },
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/**/__tests__/**', 'src/test/**', 'src/main.jsx'],
      reporter: ['text-summary', 'text'],
      // A couple of points under the current figures, so a real drop fails CI
      // while ordinary churn does not. Raise them as coverage rises.
      thresholds: {
        statements: 33,
        branches: 31,
        functions: 31,
        lines: 33,
      },
    },
  },
})
