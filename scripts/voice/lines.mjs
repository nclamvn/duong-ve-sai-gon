/**
 * DV-076 danh sách câu lồng tiếng: dựng từ thoại nhiệm vụ (content/missions/*.dialogue.json + content/locale/vi.json) và câu hô
 * của địch (content/voice/enemy-lines.json). Một nguồn sự thật: đổi phụ đề → chạy lại `npm run voice` tạo lại đúng câu đó.
 *
 * Khoá (key) theo cách game tra (src/engine/audio/voice.ts `voiceKeys`):
 *   - thoại cốt truyện: `<cue>` (người nói cố định theo file thoại)
 *   - câu hô của tổ ta (ai nói cũng được): `<cue>.<SPEAKER>`, 2 lần đọc (đỡ lặp)
 *   - báo hướng địch: `M20.<SPEAKER>.h<giờ>`
 *   - địch: `en.<kind>.<E1..E4>` (mỗi câu trong kind là một lần đọc khác nhau)
 *   - DV-087 câu hô nhiều biến thể của tổ ta (content/voice/squad-barks.json): `sq.<kind>#<i>.<SPEAKER>`; câu gọi tên đồng đội
 *     `sq.<kind>#<i>-<NGƯỜI ĐƯỢC GỌI>.<SPEAKER>` (một bản cho mỗi người được gọi, trừ chính mình)
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const SQUAD = ['QUYET', 'LONG', 'DAT', 'HOAN', 'KHANG'];
/** cue hô dùng chung (Squadmates.bark): mỗi người trong tổ có bản riêng */
export const BARK_CUES = ['M05', 'M06', 'M10', 'M11', 'M12', 'M13', 'M14', 'M15'];
export const SQUAD_CUES = ['M21', 'M22', 'M23', 'M24', 'M25', 'M26'];
export const ENEMY_VOICES = ['E1', 'E2', 'E3', 'E4'];
const HOURS = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín', 'mười', 'mười một', 'mười hai'];

/** thẻ diễn (audio tag eleven_v3, không đọc thành lời) */
const TAGS = {
  M01: '[whispers]', M02: '[whispers]', M03: '[whispers]', M04: '[quietly]', M05: '[shouting]', M06: '[shouting]', M08: '[whispers]',
  M09: '[tired]', M10: '[shouting]', M12: '[pained]', M13: '[shouting]', M15: '[shouting]', M20: '[shouting]', M22: '[shouting]',
  M23: '[shouting]', M24: '[shouting]', M25: '[shouting]', M26: '[shouting]', M30: '[quietly]', M31: '[curious]', M34: '[disgusted]',
  M35: '[laughs]', M37: '[calm]', M39: '[shivering] [weak]', M40: '[concerned]', M42: '[shouting]', M43: '[urgent]',
  M44: '[relieved] [quietly]', M46: '[whispers] [uneasy]', M47: '[shouting]', M48: '[awed] [whispers]', M49: '[calm]',
  M51: '[whispers] [curious]', M52: '[whispers]', M53: '[whispers]', M54: '[shouting]', M56: '[quietly]', M57: '[shouting]',
  M58: '[urgent]', M59: '[shouting]', M60: '[shouting]', M61: '[shouting]', M62: '[urgent]', M63: '[shouting]', M64: '[shouting]',
  M65: '[shouting]', M66: '[excited]', M67: '[tired]', M68: '[relieved]', M69: '[quietly]', M70: '[sad] [quietly]',
  B01: '[reflective]', B02: '[quietly]', B03: '[quietly]', B04: '[quietly]', B05: '[whispers]', B07: '[whispers]', B08: '[whispers]',
  B09: '[whispers]', B10: '[whispers]', B11: '[whispers]', B12: '[quietly]', B13: '[shouting]', B14: '[laughs]',
  // DV-085 M1 bản dồn dập
  M00: '[sad] [quietly]', M16: '[nervous]', M17: '[shouting]', M18: '[shouting]', M19: '[shouting]', M27: '[urgent]', M28: '[shouting]',
  M71: '[shouting]', M72: '[shouting]', M73: '[shouting]', M74: '[shouting]', M75: '[panicked] [shouting]', M76: '[shouting]',
  M77: '[shouting]', M78: '[shouting]', M79: '[crying] [shouting]', M80: '[shouting]', M81: '[shouting]', M82: '[shouting]',
  M83: '[whispers]', M84: '[shouting]', M85: '[out of breath]', M86: '[panicked]', M87: '[shouting]', M88: '[shouting]',
  M89: '[urgent]', M90: '[shouting]', M91: '[shouting]', M92: '[shouting]', M93: '[shouting]', M94: '[shouting]', M95: '[shouting]',
  M96: '[strained] [shouting]', M97: '[crying] [shouting]', M98: '[shouting]', M99: '[shouting]',
  // DV-089 hồi sườn đồi theo nhịp Normandy: nín thở → pháo dồn → xung phong
  M100: '[whispers]', M101: '[whispers] [nervous]', M102: '[whispers] [scared]', M103: '[whispers] [determined]',
  M104: '[panicked] [shouting]', M105: '[shouting]',
  // DV-093 intro: chỉ huy qua bộ đàm, Quyết
  C01: '[serious]', C02: '[serious] [urgent]', C03: '[urgent]', C04: '[quietly]', C05: '[whispers]', C06: '[shouting] [desperate]', C07: '[shouting]',
  // DV-078 hồi đêm Ngầm Ta Lê
  N01: '[quietly]', N02: '[quietly]', N03: '[curious]', N04: '[calm]', N05: '[calm]', N07: '[shouting]', N08: '[shouting]',
  N09: '[shouting]', N10: '[excited]', N11: '[shouting]', N12: '[shouting]', N13: '[shouting]', N14: '[urgent]', N15: '[shouting]',
  N16: '[shouting]', N17: '[pained]', N18: '[relieved]', N19: '[shouting]', N20: '[shouting]', N21: '[shouting]', N22: '[shouting]',
  N30: '[tired]', N31: '[tired]', N32: '[tired]', N33: '[quietly]',
};

/** viết lại cho máy đọc (phụ đề giữ nguyên) */
export function speakable(text) {
  return text
    .replace(/B-52/g, 'Bê năm hai')
    .replace(/\s*—\s*/g, ', ')
    .replace(/…/g, '...')
    .trim();
}

/** đường dẫn file (tương đối public/assets/voice) của lần đọc `take` */
export const fileOf = (l, take) => `${l.lang}/${l.key.replace(/[#.]/g, '_')}${l.takes > 1 ? `_${take + 1}` : ''}.mp3`;
export const settingsOf = (cast, voice) => ({ ...cast.defaults, ...(cast.voices[voice].settings ?? {}) });
/** băm "ý định" của một lần đọc: đổi chữ/thẻ/giọng/model/cài đặt → tạo lại */
export function hashOf(cast, l, take) {
  const v = cast.voices[l.voice];
  return crypto.createHash('sha1').update(JSON.stringify([cast.model, v.voiceId, settingsOf(cast, l.voice), l.tag, l.text, take, cast.outputFormat])).digest('hex').slice(0, 16);
}

export function buildLines(root) {
  const vi = JSON.parse(fs.readFileSync(path.join(root, 'content/locale/vi.json'), 'utf8'));
  const out = [];
  const seen = new Set();
  const add = (l) => {
    if (seen.has(l.key)) return;
    seen.add(l.key);
    out.push(l);
  };
  const missionsDir = path.join(root, 'content/missions');
  const cues = [];
  for (const f of fs.readdirSync(missionsDir).filter((x) => x.endsWith('.dialogue.json')).sort()) {
    for (const c of JSON.parse(fs.readFileSync(path.join(missionsDir, f), 'utf8')).cues) cues.push(c);
  }
  const byId = new Map(cues.map((c) => [c.cueId, c]));
  const textOf = (c) => vi[c.subtitleKey];
  for (const c of cues) {
    const text = textOf(c);
    if (!text) continue;
    const tag = TAGS[c.cueId] ?? '';
    if (c.cueId === 'M20') continue;
    if (c.speaker === 'SQUAD' || BARK_CUES.includes(c.cueId)) {
      for (const s of SQUAD) add({ key: `${c.cueId}.${s}`, voice: s, lang: 'vi', text: speakable(text), tag, takes: BARK_CUES.includes(c.cueId) || c.cueId === 'M26' ? 2 : 1 });
      continue;
    }
    add({ key: c.cueId, voice: c.speaker, lang: 'vi', text: speakable(text), tag, takes: 1, radio: c.bus === 'radio' });
  }
  if (byId.has('M20')) {
    const tpl = textOf(byId.get('M20'));
    for (const s of SQUAD) for (let h = 1; h <= 12; h++) add({ key: `M20.${s}.h${h}`, voice: s, lang: 'vi', text: speakable(tpl.replace('{h}', HOURS[h])), tag: TAGS.M20, takes: 1 });
  }
  for (const l of squadBarkLines(root)) add(l);
  const enemy = JSON.parse(fs.readFileSync(path.join(root, 'content/voice/enemy-lines.json'), 'utf8')).kinds;
  for (const [kind, list] of Object.entries(enemy)) {
    const voices = kind === 'radio' ? ['ERADIO'] : ENEMY_VOICES;
    for (const v of voices) {
      list.forEach((raw, i) => {
        const m = raw.match(/^((?:\[[^\]]+\]\s*)*)(.*)$/);
        add({ key: `en.${kind}.${v}#${i}`, group: `en.${kind}.${v}`, voice: v, lang: 'en', text: m[2].trim(), tag: m[1].trim(), takes: 1, radio: kind === 'radio' });
      });
    }
  }
  return out;
}

/** DV-087: câu hô nhiều biến thể của tổ ta → các dòng lồng tiếng (khoá theo cách Squadmates gọi: `sq.<kind>#<i>[-<TARGET>]`) */
export function squadBarkLines(root) {
  const def = JSON.parse(fs.readFileSync(path.join(root, 'content/voice/squad-barks.json'), 'utf8'));
  const out = [];
  for (const [kind, k] of Object.entries(def.kinds)) {
    k.lines.forEach((line, i) => {
      const who = line.who ?? SQUAD;
      const tag = line.tag ?? k.tag ?? '';
      for (const s of who) {
        if (line.t.includes('{name}')) {
          for (const target of SQUAD) {
            if (target === s) continue;
            const text = line.t.replaceAll('{name}', def.names[target]);
            out.push({ key: `sq.${kind}#${i}-${target}.${s}`, voice: s, lang: 'vi', text: speakable(text), tag, takes: 1 });
          }
        } else out.push({ key: `sq.${kind}#${i}.${s}`, voice: s, lang: 'vi', text: speakable(line.t), tag, takes: 1 });
      }
    });
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const lines = buildLines(process.cwd());
  const chars = lines.reduce((a, l) => a + (l.tag.length + 1 + l.text.length) * l.takes, 0);
  const by = {};
  for (const l of lines) by[l.voice] = (by[l.voice] ?? 0) + l.takes;
  console.log(`${lines.length} câu, ${lines.reduce((a, l) => a + l.takes, 0)} lần đọc, ~${chars} ký tự`);
  console.log(by);
}
