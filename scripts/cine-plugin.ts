/**
 * DV-093 Vite plugin (chỉ dev/preview cục bộ): nhận dữ liệu bộ ghi intro từ trình duyệt và ghi vào recordings/.
 *   POST /__cine/write?name=<file>&append=0|1   thân = byte thô (luồng H.264 Annex-B, âm thanh webm, ảnh png)
 * Tên file chỉ chữ/số/._- (không đường dẫn). Ghép thành MP4 bằng scripts/cine-mux.mjs (ffmpeg).
 */
import type { Plugin, ViteDevServer, PreviewServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function handle(req: IncomingMessage, res: ServerResponse, next: () => void): void {
  const [path, query] = (req.url ?? '').split('?');
  if (path !== '/__cine/write') return next();
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end('POST only');
    return;
  }
  const q = new URLSearchParams(query ?? '');
  const name = q.get('name') ?? '';
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(name) || name.startsWith('.')) {
    res.statusCode = 400;
    res.end('bad name');
    return;
  }
  readBody(req)
    .then((buf) => {
      const dir = join(process.cwd(), 'recordings');
      mkdirSync(dir, { recursive: true });
      const file = join(dir, name);
      if (q.get('append') === '1') appendFileSync(file, buf);
      else writeFileSync(file, buf);
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ ok: true, bytes: buf.length }));
    })
    .catch((err: unknown) => {
      res.statusCode = 400;
      res.end(String(err));
    });
}

export function cinePlugin(): Plugin {
  return {
    name: 'dvsg-cine-plugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(handle);
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use(handle);
    },
  };
}
