/**
 * Vite plugin: nhận POST /__bench từ trang bench và ghi evidence/G0/performance-report-<ISO>.json
 * + device-profile.json. Hoạt động cả `vite` (dev) lẫn `vite preview`.
 * PRD §8 PerformanceReplay · §15 (64–72h) · TIP-004.
 */
import type { Plugin, ViteDevServer, PreviewServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const EVIDENCE_DIR = join(process.cwd(), 'evidence', 'G0');

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function handle(req: IncomingMessage, res: ServerResponse, next: () => void): void {
  if (req.url?.split('?')[0] !== '/__bench') return next();
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end('POST only');
    return;
  }
  readBody(req)
    .then((raw) => {
      const report = JSON.parse(raw) as { timestamp?: string; device?: unknown; backend?: string; verdict?: string };
      mkdirSync(EVIDENCE_DIR, { recursive: true });
      const stamp = (report.timestamp ?? new Date().toISOString()).replace(/[:.]/g, '-');
      const file = join(EVIDENCE_DIR, `performance-report-${stamp}.json`);
      writeFileSync(file, JSON.stringify(report, null, 2));
      writeFileSync(
        join(EVIDENCE_DIR, 'device-profile.json'),
        JSON.stringify({ capturedAt: report.timestamp, backend: report.backend, device: report.device }, null, 2),
      );
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ saved: file.replace(process.cwd() + '/', ''), verdict: report.verdict ?? null }));
      // eslint-disable-next-line no-console
      console.log(`[bench] saved ${file} verdict=${report.verdict}`);
    })
    .catch((err: unknown) => {
      res.statusCode = 400;
      res.end(String(err));
    });
}

export function benchPlugin(): Plugin {
  return {
    name: 'ht-bench-plugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(handle);
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use(handle);
    },
  };
}
