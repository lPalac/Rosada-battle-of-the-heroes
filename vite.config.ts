import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  // Rapier (~4 MB, base64 WASM) is its own chunk, loaded on the first roll (plan Risks), so the limit is raised.
  build: { target: 'es2022', chunkSizeWarningLimit: 5000 },
  server: { port: 5173 },
});
