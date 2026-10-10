import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { factionLook, resolvePackId, factionPackIds } from '@game/factions';

describe('DV-061 gói phe', () => {
  it('mặc định hư cấu: phe A AK + tai bèo, phe B súng khác AK + rằn ri hư cấu; recon theo phe', () => {
    expect(resolvePackId(null)).toBe('fictional');
    expect(resolvePackId('khong-co')).toBe('fictional');
    expect(factionLook('fictional', 'friend')).toEqual({ weapon: 'ak47', gear: 'faction_a' });
    const e = factionLook('fictional', 'enemy');
    expect(e.weapon).not.toBe('ak47');
    expect(e).toEqual({ weapon: 'm16a1', gear: 'faction_b', skin: 'camo_b' });
    expect(factionLook('fictional', 'enemy', 'recon')).toEqual(e);
  });

  it('gói lịch sử giữ đúng hành vi DV-046', () => {
    expect(factionPackIds()).toContain('historical-1971');
    expect(factionLook('historical-1971', 'friend')).toEqual({ weapon: 'ak47', gear: 'pavn1971' });
    expect(factionLook('historical-1971', 'enemy')).toEqual({ weapon: 'm16a1', gear: 'pavn1971' });
    expect(factionLook('historical-1971', 'enemy', 'recon')).toEqual({ weapon: 'm16a1', gear: 'us1971', skin: 'erdl' });
  });

  it('engine trung lập: không tên quân đội có thật trong src/engine và src/game (ngoài comment)', () => {
    const banned = /\b(PAVN|NVA|ARVN|VNCH|Viet ?Cong|US Army|USMC|Wehrmacht)\b/i;
    const hits: string[] = [];
    const walk = (d: string): void => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith('.ts')) {
          readFileSync(p, 'utf8')
            .split('\n')
            .forEach((line, i) => {
              const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
              if (/^\s*\*/.test(line)) return;
              if (banned.test(code)) hits.push(`${p}:${i + 1}`);
            });
        }
      }
    };
    walk('src/engine');
    walk('src/game');
    expect(hits).toEqual([]);
  });
});
