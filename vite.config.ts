import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// `npm run dev` alone runs the self-contained demo. To develop against the API server, run
// `npm run dev:server` and start Vite with API_PROXY=http://localhost:8787.
const apiProxy = process.env.API_PROXY;

export default defineConfig({
  plugins: [react()],
  server: apiProxy ? { proxy: { '/api': apiProxy } } : undefined,
  build: {
    rollupOptions: {
      // React rarely changes between deploys — keep it in its own long-cached chunk.
      output: { manualChunks: (id) => (/node_modules\/(react|react-dom|scheduler)\//.test(id) ? 'react' : undefined) },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
