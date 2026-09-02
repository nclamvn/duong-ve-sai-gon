/**
 * Vite plugin: nhận POST /__bench từ trang bench và ghi evidence/G0/performance-report-<ISO>.json
 * + device-profile.json. Hoạt động cả `vite` (dev) lẫn `vite preview`.
 * PRD §8 PerformanceReplay · §15 (64–72h) · TIP-004.
 */
import type { Plugin, ViteDevServer, PreviewServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Report từ sandbox/SwiftShader không được lẫn vào evidence G0 thật → evidence/sandbox/ */
function evidenceDir(status: string | undefined): string {
  return join(process.cwd(), 'evidence', status === 'sandbox_swiftshader_lifecycle_only' ? 'sandbox' : 'G0');
}

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
      const report = JSON.parse(raw) as { timestamp?: string; device?: unknown; backend?: string; verdict?: string; evidence_status?: string };
      const dir = evidenceDir(report.evidence_status);
      mkdirSync(dir, { recursive: true });
      const stamp = (report.timestamp ?? new Date().toISOString()).replace(/[:.]/g, '-');
      const file = join(dir, `performance-report-${stamp}.json`);
      writeFileSync(file, JSON.stringify(report, null, 2));
      writeFileSync(
        join(dir, 'device-profile.json'),
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
