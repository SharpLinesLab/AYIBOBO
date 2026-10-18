import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

/** Emits /sw.js with the build's file list baked in (precache) and a version from their hashes. */
function serviceWorker(): Plugin {
  const publicFiles = ['/manifest.webmanifest', '/favicon.svg', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];
  return {
    name: 'asf-service-worker',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle)
        .filter((f) => /\.(js|css|woff2?)$/.test(f))
        .sort()
        .map((f) => `/${f}`);
      const version = createHash('sha256').update(files.join('|')).digest('hex').slice(0, 12);
      const source = readFileSync(new URL('./src/sw.template.js', import.meta.url), 'utf8')
        .replace('__VERSION__', version)
        .replace("'__PRECACHE__'", JSON.stringify(['/', ...publicFiles, ...files]));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

// `npm run dev` alone runs the self-contained demo. To develop against the API server, run
// `npm run dev:server` and start Vite with API_PROXY=http://localhost:8787.
const apiProxy = process.env.API_PROXY;

export default defineConfig({
  plugins: [react(), serviceWorker()],
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
