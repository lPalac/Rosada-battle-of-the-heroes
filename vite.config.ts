import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

/** 005 research R-10: one build id for the client and the server bundle, so mismatched versions refuse to play. */
function buildId(): string {
  if (process.env.ROSADA_BUILD_ID) return process.env.ROSADA_BUILD_ID;
  if (process.env.RENDER_GIT_COMMIT) return process.env.RENDER_GIT_COMMIT.slice(0, 7); // Render builds (R-14)
  try {
    const hash = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const dirty = execSync('git status --porcelain', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() ? '+' : '';
    return `${hash}${dirty}`;
  } catch {
    return 'dev';
  }
}

export default defineConfig(({ mode, isSsrBuild }) => {
  // The e2e Vite server (port 5174) talks to the test-mode game server on 2568 (005 T037).
  const gameServer = `http://localhost:${mode === 'e2e' ? 2568 : 2567}`;
  return {
    root: '.',
    define: { __BUILD_ID__: JSON.stringify(mode === 'production' ? buildId() : 'dev') },
    // Rapier (~4 MB, base64 WASM) is its own chunk, loaded on the first roll (plan Risks), so the limit is raised.
    // The server bundle (`vite build --ssr server/index.ts`, research R-08) needs no public/ assets.
    build: { target: 'es2022', chunkSizeWarningLimit: 5000, copyPublicDir: !isSsrBuild },
    server: {
      port: 5173,
      proxy: {
        // The game server serves at its root; nginx strips /ws the same way in production.
        '/ws': { target: gameServer, ws: true, changeOrigin: true, rewrite: (p: string) => p.replace(/^\/ws/, '') || '/' },
        '/api': { target: gameServer, changeOrigin: true },
      },
    },
  };
});
