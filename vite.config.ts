import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

/** 005 research R-10: one build id for the client and the server bundle, so mismatched versions refuse to play. */
function buildId(): string {
  if (process.env.ROSADA_BUILD_ID) return process.env.ROSADA_BUILD_ID;
  try {
    const hash = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const dirty = execSync('git status --porcelain', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() ? '+' : '';
    return `${hash}${dirty}`;
  } catch {
    return 'dev';
  }
}

export default defineConfig(({ mode }) => {
  // The e2e Vite server (port 5174) talks to the test-mode game server on 2568 (005 T037).
  const gameServer = `http://localhost:${mode === 'e2e' ? 2568 : 2567}`;
  return {
    root: '.',
    define: { __BUILD_ID__: JSON.stringify(mode === 'production' ? buildId() : 'dev') },
    // Rapier (~4 MB, base64 WASM) is its own chunk, loaded on the first roll (plan Risks), so the limit is raised.
    build: { target: 'es2022', chunkSizeWarningLimit: 5000 },
    server: {
      port: 5173,
      proxy: {
        '/ws': { target: gameServer, ws: true, changeOrigin: true },
        '/api': { target: gameServer, changeOrigin: true },
      },
    },
  };
});
