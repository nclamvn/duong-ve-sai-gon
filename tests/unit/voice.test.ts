/**
 * DV-076 lồng tiếng: manifest khớp kịch bản (đổi phụ đề mà quên tạo lại giọng → đỏ), tra khoá giọng, ngân hàng giọng (xoay
 * vòng lần đọc, thiếu file im lặng), phụ đề kéo dài theo giọng, tiếng hô địch chống ồn.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildLines, fileOf, hashOf, SQUAD, BARK_CUES, type VoiceCast } from '../../scripts/voice/lines.mjs';
import { voiceKeys, VoiceBank, type VoiceManifest } from '@engine/audio/voice';
import { EnemyChatter, enemyVoiceOf } from '@game/ai/enemyChatter';
import type { AudioEngine } from '@engine/audio/audio';
import dialogueM1 from '@content/missions/truong-son-a.dialogue.json';
import dialogueM2 from '@content/missions/diem-cao-31.dialogue.json';
import cast from '@content/voice/cast.json';

const ROOT = process.cwd();
const VOICE = path.join(ROOT, 'public/assets/voice');
const manifest = JSON.parse(fs.readFileSync(path.join(VOICE, 'manifest.json'), 'utf8')) as VoiceManifest & { lines: Record<string, { hash: string[] }> };

describe('DV-076 kịch bản ↔ manifest', () => {
  const lines = buildLines(ROOT);

  it('mọi câu có file, file tồn tại, băm khớp chữ hiện tại (đổi phụ đề phải chạy lại npm run voice)', () => {
    const stale: string[] = [];
    for (const l of lines) {
      const e = manifest.lines[l.group ?? l.key];
      expect(e, l.key).toBeTruthy();
      for (let t = 0; t < l.takes; t++) {
        const rel = fileOf(l, t);
        const i = e!.files.indexOf(rel);
        expect(i, rel).toBeGreaterThanOrEqual(0);
        expect(fs.existsSync(path.join(VOICE, rel)), rel).toBe(true);
        if (e!.hash[i] !== hashOf(cast as VoiceCast, l, t)) stale.push(rel);
      }
    }
    expect(stale).toEqual([]);
  });

  it('mọi cue thoại của M1/M2 có giọng (cue cố định, hoặc đủ 5 người trong tổ với cue dùng chung)', () => {
    for (const c of [...dialogueM1.cues, ...dialogueM2.cues]) {
      if (c.cueId === 'M20') {
        for (const s of SQUAD) for (let h = 1; h <= 12; h++) expect(manifest.lines[`M20.${s}.h${h}`], `M20.${s}.h${h}`).toBeTruthy();
      } else if (c.speaker === 'SQUAD' || BARK_CUES.includes(c.cueId)) {
        for (const s of SQUAD) expect(manifest.lines[`${c.cueId}.${s}`], `${c.cueId}.${s}`).toBeTruthy();
      } else expect(manifest.lines[c.cueId], c.cueId).toBeTruthy();
    }
  });

  it('địch: 4 giọng × mỗi loại câu ≥ 3 lần đọc khác nhau; phe ta tiếng Việt, địch tiếng Anh', () => {
    for (const kind of ['contact', 'reload', 'frag', 'grenade', 'moving', 'pinned', 'suppress', 'flank', 'fallback', 'hit', 'mandown', 'lost']) {
      for (const v of ['E1', 'E2', 'E3', 'E4']) expect(manifest.lines[`en.${kind}.${v}`]?.files.length ?? 0, `${kind} ${v}`).toBeGreaterThanOrEqual(3);
    }
    for (const l of lines) expect(l.lang).toBe(cast.voices[l.voice as keyof typeof cast.voices].lang);
  });

  it('thời lượng hợp lý (câu hô ≤ 3,5 s, thoại đêm M2 ≤ 20 s)', () => {
    for (const [k, e] of Object.entries(manifest.lines)) {
      for (const ms of e.ms) {
        expect(ms, k).toBeGreaterThan(250);
        expect(ms, k).toBeLessThan(k.startsWith('B') ? 20000 : /^(M\d+\.|en\.)/.test(k) ? 3500 : 12000);
      }
    }
  });
});

describe('DV-076 tra giọng + ngân hàng giọng', () => {
  it('voiceKeys: giờ → người nói → cue', () => {
    expect(voiceKeys('M20', 'LONG', { h: 3, d: 40 })).toEqual(['M20.LONG.h3', 'M20.LONG', 'M20']);
    expect(voiceKeys('M01', 'QUYET')).toEqual(['M01.QUYET', 'M01']);
  });

  it('xoay vòng lần đọc, phát buffer, thiếu khoá im lặng', async () => {
    const played: string[] = [];
    const audio = {
      decode: async (b: ArrayBuffer) => ({ tag: new TextDecoder().decode(b) }) as unknown as AudioBuffer,
      playBuffer: (buf: AudioBuffer) => {
        played.push((buf as unknown as { tag: string }).tag);
        return () => undefined;
      },
    } as unknown as AudioEngine;
    const files: Record<string, string> = {
      'v/manifest.json': JSON.stringify({ version: 1, lines: { 'M10.LONG': { voice: 'LONG', files: ['a.mp3', 'b.mp3'], ms: [800, 900] } } }),
      'v/a.mp3': 'A',
      'v/b.mp3': 'B',
    };
    const bank = new VoiceBank(audio, 'v/', async (u) => (files[u] !== undefined ? new Response(files[u]) : new Response('', { status: 404 })));
    expect(await bank.load()).toBe(true);
    expect(bank.resolve(voiceKeys('M10', 'LONG'))).toBe('M10.LONG');
    expect(bank.resolve(voiceKeys('M10', 'DAT'))).toBeNull();
    expect(bank.durationMs('M10.LONG')).toBe(900);
    expect(bank.play('M10.LONG', 'dialogue')).toBe(800);
    expect(bank.play('M10.LONG', 'dialogue')).toBe(900);
    await new Promise((r) => setTimeout(r, 10));
    expect(bank.play('M10.LONG', 'dialogue')).toBe(800);
    expect(played).toEqual(['A', 'B', 'A']);
    expect(bank.play('nope', 'dialogue')).toBe(0);
  });
});

describe('DV-076 tiếng hô địch', () => {
  it('chống ồn: mỗi người 5 s, toàn trận 1,3 s, cùng loại 3,5 s; lựu đạn bỏ qua giới hạn chung', () => {
    let now = 0;
    const said: string[] = [];
    const ch = new EnemyChatter({ now: () => now, play: (id, k) => (said.push(`${id}:${k}`), true) });
    expect(ch.say('a', 'contact')).toBe(true);
    expect(ch.say('b', 'reload')).toBe(false); // < 1,3 s
    now = 1.5;
    expect(ch.say('b', 'reload')).toBe(true);
    expect(ch.say('c', 'grenade')).toBe(true); // khẩn
    now = 3;
    expect(ch.say('a', 'moving')).toBe(false); // người a < 5 s
    expect(ch.say('d', 'contact')).toBe(false); // cùng loại < 3,5 s
    now = 6;
    expect(ch.say('a', 'moving')).toBe(true);
    expect(said).toEqual(['a:contact', 'b:reload', 'c:grenade', 'a:moving']);
  });

  it('giọng theo mã lính ổn định và trải đều', () => {
    expect(enemyVoiceOf('f1_3', 4)).toBe(enemyVoiceOf('f1_3', 4));
    const set = new Set(Array.from({ length: 40 }, (_, i) => enemyVoiceOf(`lz_a_${i}`, 4)));
    expect(set.size).toBe(4);
  });
});
