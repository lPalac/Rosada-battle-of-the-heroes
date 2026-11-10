// 005 T061 / FR-074: the game server can serve the built site itself, so one Node process is the whole game on hosts
// without nginx (the free Render test deployment, research R-14). Hashed files under /assets/ are cached for a year,
// index.html never; unknown paths without a file extension fall back to index.html; nothing outside `root` is served.
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.obj': 'text/plain; charset=utf-8',
  '.mtl': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
};
const COMPRESS = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.obj', '.mtl', '.txt', '.wasm']);

/** Paths the game server answers itself (matchmaking, health). */
export function isServerPath(path: string): boolean {
  return path.startsWith('/matchmake') || path.startsWith('/api/');
}

export interface StaticSite {
  /** True if the request was answered. */
  handle(req: IncomingMessage, res: ServerResponse): boolean;
}

export function staticSite(dir: string): StaticSite {
  const root = resolve(dir);
  const index = join(root, 'index.html');
  const gzipCache = new Map<string, Buffer>();

  const fileFor = (urlPath: string): string | null => {
    let path: string;
    try {
      path = decodeURIComponent(urlPath);
    } catch {
      return null;
    }
    if (path.includes('\0')) return null;
    const full = resolve(root, '.' + normalize('/' + path));
    if (full !== root && !full.startsWith(root + sep)) return null; // no escaping the site folder
    if (existsSync(full) && statSync(full).isFile()) return full;
    // Client-side routes (no file extension) get the app; missing files are 404.
    return extname(path) === '' && existsSync(index) ? index : null;
  };

  return {
    handle(req, res) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return false;
      const urlPath = (req.url ?? '/').split('?')[0];
      if (isServerPath(urlPath)) return false;
      const file = fileFor(urlPath === '/' ? '/index.html' : urlPath);
      if (!file) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return true;
      }
      const ext = extname(file).toLowerCase();
      const headers: Record<string, string> = {
        'Content-Type': TYPES[ext] ?? 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': file === index ? 'no-cache'
          : urlPath.startsWith('/assets/') ? 'public, max-age=31536000, immutable'
          : 'public, max-age=86400',
      };
      const gzip = COMPRESS.has(ext) && /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''));
      if (gzip) {
        let body = gzipCache.get(file);
        if (!body) {
          body = gzipSync(readFileSync(file));
          if (file !== index) gzipCache.set(file, body);
        }
        res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', 'Content-Length': String(body.length), Vary: 'Accept-Encoding' });
        res.end(req.method === 'HEAD' ? undefined : body);
        return true;
      }
      res.writeHead(200, { ...headers, 'Content-Length': String(statSync(file).size) });
      if (req.method === 'HEAD') res.end();
      else createReadStream(file).pipe(res);
      return true;
    },
  };
}
