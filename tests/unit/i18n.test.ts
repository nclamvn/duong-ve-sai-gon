import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { t, hasKey, localeKeys } from '@ui/i18n';

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

// Ký tự tiếng Việt có dấu (ngoài ASCII) trong chuỗi literal
const VI = /['"`][^'"`\n]*[ăâđêôơưĂÂĐÊÔƠƯàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ][^'"`\n]*['"`]/;

describe('TIP-008 UX-002 localization', () => {
  it('không có literal tiếng Việt trong src/**/*.ts ngoài i18n.ts (chỉ comment được phép)', () => {
    const offenders: string[] = [];
    for (const f of walk('src')) {
      if (f.endsWith('i18n.ts')) continue;
      const lines = readFileSync(f, 'utf8').split('\n');
      lines.forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
        if (code.trim().startsWith('*')) return; // JSDoc
        if (VI.test(code)) offenders.push(`${f}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('t() trả key trong ngoặc khi thiếu; có ≥ 30 key; speaker/dlg đủ', () => {
    expect(t('khong.co')).toBe('[khong.co]');
    expect(localeKeys().length).toBeGreaterThanOrEqual(30);
    for (const k of ['speaker.VY', 'speaker.DUY', 'speaker.TRAM_BAC', 'dlg.D01', 'dlg.D03', 'dlg.D05', 'hud.prompt.cut_relay']) expect(hasKey(k)).toBe(true);
  });
});
