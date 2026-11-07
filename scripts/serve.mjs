// Serves the Vite build. Vibeship injects no PORT, so the image sets it.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const port = Number(process.env.PORT) || 3000;

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

function inRoot(file) {
  const prefix = root.endsWith(sep) ? root : `${root}${sep}`;
  return file === root || file.startsWith(prefix);
}

function fileFor(url) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(url ?? '/', 'http://127.0.0.1').pathname);
  } catch {
    return null;
  }
  const segments = pathname.split('/').filter((part) => part !== '' && part !== '.');
  if (segments.some((part) => part === '..')) return null;
  const rel = segments.length === 0 ? 'index.html' : segments.join('/');
  const file = join(root, pathname.endsWith('/') && segments.length > 0 ? join(rel, 'index.html') : rel);
  return inRoot(file) ? file : null;
}

// Hashed build files never change, so phones may keep them forever. Everything
// that decides which version runs (the page, the service worker, version.json)
// must be revalidated every time, or installed apps get stuck on an old release.
function cacheControl(file) {
  const rel = file.slice(root.length).split(sep).join('/').replace(/^\//, '');
  if (rel.startsWith('assets/')) return 'public, max-age=31536000, immutable';
  if (rel === 'sw.js' || rel === 'version.json') return 'no-store';
  if (rel.endsWith('.html') || rel.endsWith('.webmanifest')) return 'no-cache';
  return 'public, max-age=86400';
}

const server = createServer(async (req, res) => {
  const pathname = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
  if (pathname === '/health' || pathname === '/health/') {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end();
      return;
    }
    try {
      await readFile(join(root, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }).end('ok\n');
    } catch {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('not ready\n');
    }
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end();
    return;
  }
  const file = fileFor(req.url);
  if (!file) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': cacheControl(file) });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    res.writeHead(404).end('Not found');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Hexbound listening on 0.0.0.0:${port}`);
});
