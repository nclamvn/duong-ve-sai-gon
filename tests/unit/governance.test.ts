import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

function codeLines(file: string): { line: string; no: number }[] {
  return readFileSync(file, 'utf8')
    .split('\n')
    .map((raw, i) => ({ line: raw.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, ''), no: i + 1 }))
    .filter(({ line }) => !line.trim().startsWith('*'));
}

// AGENTS.md vùng cấm — grep tự động để Verify không phải bắt tay (TIP-010: Math.random lọt vào viewmodel)
describe('AGENTS.md vùng cấm', () => {
  it('không Math.random trong src/** (PRNG seeded mulberry32)', () => {
    const offenders: string[] = [];
    for (const f of walk('src')) for (const { line, no } of codeLines(f)) if (/Math\.random\s*\(/.test(line)) offenders.push(`${f}:${no}`);
    expect(offenders).toEqual([]);
  });

  it('không ShaderMaterial/onBeforeCompile (TSL only)', () => {
    const offenders: string[] = [];
    for (const f of walk('src')) for (const { line, no } of codeLines(f)) if (/\bShaderMaterial\b|onBeforeCompile/.test(line)) offenders.push(`${f}:${no}`);
    expect(offenders).toEqual([]);
  });

  it('engine/* không import game/*', () => {
    const offenders: string[] = [];
    for (const f of walk('src/engine')) for (const { line, no } of codeLines(f)) if (/from\s+['"](@game\/|\.\.\/(\.\.\/)*game\/)/.test(line)) offenders.push(`${f}:${no}`);
    expect(offenders).toEqual([]);
  });

  it('content/ không có file TS', () => {
    let hasContent = true;
    try {
      statSync('content');
    } catch {
      hasContent = false;
    }
    if (!hasContent) return;
    expect(walk('content')).toEqual([]);
  });
});
