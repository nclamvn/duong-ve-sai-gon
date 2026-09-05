#!/usr/bin/env node
/**
 * Kiểm registry lịch sử (PRD v0.2 §9, ADR-D03): schema, id đúng prefix theo file, id duy nhất toàn cục,
 * fact P/S phải có ≥ 1 nguồn, fact X phải có dispute_note, fact H/X không được asset `approved` tham chiếu.
 * Dùng: node scripts/validate-registry.mjs [--json]  → exit 1 nếu lỗi; --json in báo cáo provenance.
 * Cũng export `validateRegistries()` cho unit test.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import Ajv from 'ajv';

const DIR = 'content/registry';
const PREFIX = { uniforms: 'uni', weapons: 'wpn', vehicles: 'veh', aircraft: 'air', places: 'plc', timeline: 'tml', 'daily-life': 'dly' };

export function validateRegistries(dir = DIR, manifestPath = 'content/assets/manifest.json') {
  const schema = JSON.parse(readFileSync('content/schemas/registry.schema.json', 'utf8'));
  const ajv = new Ajv({ allErrors: true, strict: false, formats: { uri: /^https?:\/\/\S+$/ } });
  const validate = ajv.compile(schema);
  const errors = [];
  const ids = new Map();
  const stats = {};
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.yaml')).sort() : [];
  const facts = new Map();
  for (const f of files) {
    const doc = parse(readFileSync(join(dir, f), 'utf8'));
    const name = f.replace(/\.yaml$/, '');
    if (!validate(doc)) {
      for (const e of validate.errors ?? []) errors.push(`${f}: ${e.instancePath} ${e.message}`);
      continue;
    }
    if (doc.registry !== name) errors.push(`${f}: registry "${doc.registry}" ≠ tên file`);
    const st = { P: 0, S: 0, H: 0, X: 0, total: 0 };
    for (const fact of doc.facts) {
      st.total++;
      st[fact.provenance_level]++;
      if (!fact.id.startsWith(PREFIX[doc.registry] + '.')) errors.push(`${f}: ${fact.id} phải bắt đầu bằng "${PREFIX[doc.registry]}."`);
      if (ids.has(fact.id)) errors.push(`${f}: id trùng ${fact.id} (đã có ở ${ids.get(fact.id)})`);
      ids.set(fact.id, f);
      facts.set(fact.id, fact);
      if ((fact.provenance_level === 'P' || fact.provenance_level === 'S') && fact.sources.length === 0) errors.push(`${f}: ${fact.id} mức ${fact.provenance_level} phải có nguồn`);
      if (fact.provenance_level === 'P' && !fact.sources.some((s) => s.tier === 'P')) errors.push(`${f}: ${fact.id} mức P cần ≥ 1 nguồn tier P`);
      if (fact.provenance_level === 'X' && !fact.dispute_note) errors.push(`${f}: ${fact.id} mức X phải có dispute_note`);
      if (fact.disputed && fact.provenance_level !== 'X') errors.push(`${f}: ${fact.id} disputed=true phải là mức X`);
    }
    stats[name] = st;
  }
  // asset lịch sử → registryId phải tồn tại và là P/S khi approved
  if (existsSync(manifestPath)) {
    const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
    for (const a of m.assets ?? []) {
      if (a.historical && !a.registryId) errors.push(`manifest: asset ${a.id} historical=true thiếu registryId`);
      if (a.registryId) {
        const fact = facts.get(a.registryId);
        if (!fact) errors.push(`manifest: asset ${a.id} registryId ${a.registryId} không có trong registry`);
        else if (a.approved && (fact.provenance_level === 'H' || fact.provenance_level === 'X')) errors.push(`manifest: asset ${a.id} approved nhưng registry ${a.registryId} mức ${fact.provenance_level}`);
      }
    }
  }
  return { errors, stats, facts: facts.size, files: files.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = validateRegistries();
  if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 2));
  else {
    for (const [k, v] of Object.entries(r.stats)) console.log(`[registry] ${k.padEnd(11)} ${String(v.total).padStart(3)} fact — P ${v.P} · S ${v.S} · H ${v.H} · X ${v.X}`);
    console.log(`[registry] ${r.files} file, ${r.facts} fact, ${r.errors.length} lỗi`);
    for (const e of r.errors) console.log('  ✗ ' + e);
  }
  process.exit(r.errors.length ? 1 : 0);
}
