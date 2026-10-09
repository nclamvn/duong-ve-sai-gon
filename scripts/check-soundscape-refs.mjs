#!/usr/bin/env node
/**
 * Kiểm nguồn cho dữ liệu sinh thái content/ecology/*.json (voices của cảnh âm, items của climate):
 *  1. mọi refs[].entity + field phải có ít nhất một claim trong claims.jsonl của registry refinery;
 *  2. mọi con số (lá số trong voice, trừ refs/design) phải được phủ bởi refs[].supports hoặc design[]
 *     (đường dẫn kiểu `bout.meanMin`, `windows[0].start.min`; tiền tố phủ cả nhánh con);
 *  3. mọi đường dẫn khai trong supports/design phải tồn tại trong voice (không khai khống).
 * Dùng: node scripts/check-soundscape-refs.mjs [config.json] [claims.jsonl] → exit 1 nếu lỗi.
 * Cũng export `checkSoundscapeRefs()` cho unit test.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DEFAULT_CONFIG = 'content/ecology/soundscape.truong-son.json';
const DEFAULT_CLAIMS = 'docs/research/rung-truong-son/claims.jsonl';

function numericLeaves(v, path, out) {
  if (typeof v === 'number') out.push(path);
  else if (Array.isArray(v)) v.forEach((x, i) => numericLeaves(x, `${path}[${i}]`, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) numericLeaves(x, path ? `${path}.${k}` : k, out);
  return out;
}

function allPaths(v, path, out) {
  if (path) out.add(path);
  if (Array.isArray(v)) v.forEach((x, i) => allPaths(x, `${path}[${i}]`, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) allPaths(x, path ? `${path}.${k}` : k, out);
  return out;
}

const covers = (prefix, leaf) => leaf === prefix || leaf.startsWith(`${prefix}.`) || leaf.startsWith(`${prefix}[`);

export function checkSoundscapeRefs(configPath = DEFAULT_CONFIG, claimsPath = DEFAULT_CLAIMS) {
  const cfg = JSON.parse(readFileSync(configPath, 'utf8'));
  const pairs = new Set();
  const entities = new Set();
  for (const line of readFileSync(claimsPath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const c = JSON.parse(line);
    pairs.add(`${c.entity}\u0000${c.field}`);
    entities.add(c.entity);
  }
  const errors = [];
  const stats = { voices: 0, numbers: 0, quantitative: 0, qualitative: 0, designOnly: 0, refs: 0 };
  for (const v of cfg.voices ?? cfg.items ?? []) {
    stats.voices++;
    const id = v.id ?? '?';
    const refs = Array.isArray(v.refs) ? v.refs : [];
    const design = Array.isArray(v.design) ? v.design : [];
    if (refs.length === 0) errors.push(`${id}: no refs`);
    const body = { ...v };
    delete body.refs;
    delete body.design;
    const leaves = numericLeaves(body, '', []);
    const paths = allPaths(body, '', new Set());
    for (const r of refs) {
      stats.refs++;
      if (!entities.has(r.entity)) errors.push(`${id}: entity not in claims: ${r.entity}`);
      else if (!pairs.has(`${r.entity}\u0000${r.field}`)) errors.push(`${id}: no claim for ${r.entity} / ${r.field}`);
      if (r.basis !== 'quantitative' && r.basis !== 'qualitative') errors.push(`${id}: ref basis must be quantitative|qualitative`);
      for (const s of r.supports ?? []) if (!paths.has(s)) errors.push(`${id}: supports unknown path ${s}`);
    }
    for (const d of design) if (!paths.has(d)) errors.push(`${id}: design unknown path ${d}`);
    for (const leaf of leaves) {
      stats.numbers++;
      const quant = refs.some((r) => r.basis === 'quantitative' && (r.supports ?? []).some((s) => covers(s, leaf)));
      const qual = refs.some((r) => r.basis === 'qualitative' && (r.supports ?? []).some((s) => covers(s, leaf)));
      const des = design.some((s) => covers(s, leaf));
      if (quant) stats.quantitative++;
      else if (qual) stats.qualitative++;
      else if (des) stats.designOnly++;
      else errors.push(`${id}: number at ${leaf} has no ref and is not declared design`);
    }
  }
  return { errors, stats };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [, , cfgArg, claimsArg] = process.argv;
  const { errors, stats } = checkSoundscapeRefs(cfgArg ?? DEFAULT_CONFIG, claimsArg ?? DEFAULT_CLAIMS);
  console.log(JSON.stringify(stats));
  if (errors.length) {
    for (const e of errors) console.error(`ERROR ${e}`);
    process.exit(1);
  }
  console.log('soundscape refs OK');
}
