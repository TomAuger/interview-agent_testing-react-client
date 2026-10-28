import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4111',
        changeOrigin: true,
      },
      // Test-harness routes mount outside the reserved /api prefix.
      '/interviews': {
        target: 'http://localhost:4111',
        changeOrigin: true,
      },
    },
  },
});
