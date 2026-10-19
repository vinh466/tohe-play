// Minimal static file server (node:http, no dependencies) used by the conformance kit and the
// local games origin. Production serves the same files with Caddy.
import { createReadStream, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve, sep } from 'node:path';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.pck': 'application/octet-stream',
};

export interface StaticServerOptions {
  root: string;
  port?: number;
  host?: string;
  /** Extra headers per request path (e.g. CSP, CORS, cache). */
  headers?: (path: string) => Record<string, string>;
  /** Paths answered with a 302 to the given URL instead of a file, e.g. the games origin's `/` to the hub. */
  redirects?: Record<string, string>;
  /** Called for every request, before the file is served. */
  onRequest?: (request: IncomingMessage) => void;
}

export interface StaticServer {
  url: string;
  close(): Promise<void>;
}

export function serveStatic(options: StaticServerOptions): Promise<StaticServer> {
  const root = resolve(options.root);

  const handler = (request: IncomingMessage, response: ServerResponse) => {
    options.onRequest?.(request);
    const path = decodeURIComponent(new URL(request.url ?? '/', 'http://x').pathname);
    const target = options.redirects?.[path];
    if (target) {
      response.writeHead(302, { location: target, ...options.headers?.(path) });
      return response.end();
    }
    let file = normalize(join(root, path));
    if (file !== root && !file.startsWith(root + sep)) return send(response, 403, 'forbidden');
    try {
      if (statSync(file).isDirectory()) file = join(file, 'index.html');
      const stat = statSync(file);
      response.writeHead(200, {
        'content-type': MIME[extname(file)] ?? 'application/octet-stream',
        'content-length': String(stat.size),
        'x-content-type-options': 'nosniff',
        ...options.headers?.(path),
      });
      if (request.method === 'HEAD') return response.end();
      createReadStream(file).pipe(response);
    } catch {
      send(response, 404, 'not found');
    }
  };

  return new Promise((resolvePromise, reject) => {
    const server = createServer(handler);
    server.once('error', reject);
    server.listen(options.port ?? 0, options.host ?? '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolvePromise({
        url: `http://${options.host === '0.0.0.0' ? 'localhost' : (options.host ?? '127.0.0.1')}:${port}`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

function send(response: ServerResponse, status: number, body: string): void {
  response.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  response.end(body);
}
