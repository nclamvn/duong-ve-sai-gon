#!/usr/bin/env node
/**
 * Snapshot gate (PRD §9 snapshots/<gate>/): build hash, lockfile, manifest src, replay seed, known issues.
 * Dùng: node scripts/snapshot.mjs [G0]
 */
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, statSync, readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const gate = process.argv[2] ?? 'G0';
const out = join('snapshots', gate);
mkdirSync(out, { recursive: true });

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'n/a';
  }
}

function walk(dir, list = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, list);
    else list.push(p);
  }
  return list;
}

function sha256(p) {
  return createHash('sha256').update(readFileSync(p)).digest('hex');
}

const head = git('rev-parse HEAD');
const dirty = git('status --porcelain') !== '';
const distFiles = existsSync('dist') ? walk('dist').sort() : [];
const distHash = createHash('sha256');
for (const f of distFiles) distHash.update(sha256(f));
writeFileSync(join(out, 'build-hash.txt'), `git=${head}${dirty ? ' (dirty)' : ''}\ndist=${distFiles.length ? distHash.digest('hex') : 'no-dist'}\nnode=${process.version}\ndate=${new Date().toISOString()}\n`);
copyFileSync('package-lock.json', join(out, 'package-lock.json'));

const srcFiles = [...walk('src'), ...walk('content'), ...walk('config')].sort();
const manifest = srcFiles.map((p) => ({ path: p, bytes: statSync(p).size, sha256: sha256(p).slice(0, 16) }));
writeFileSync(join(out, 'manifest.json'), JSON.stringify({ gate, git: head, files: manifest.length, totalBytes: manifest.reduce((a, b) => a + b.bytes, 0), manifest }, null, 2));
writeFileSync(join(out, 'replay-seed.txt'), 'seed=7\ninputTrack=arena-v1\nseconds=90\nruns=3\n');

// known issues: gom từ evidence/*/completion-report.md mục ISSUES
const issues = [];
if (existsSync('evidence')) {
  for (const d of readdirSync('evidence').sort()) {
    const f = join('evidence', d, 'completion-report.md');
    if (!existsSync(f)) continue;
    const md = readFileSync(f, 'utf8');
    const m = md.match(/\*\*ISSUES DISCOVERED:\*\*([\s\S]*?)\n\*\*/);
    if (m) issues.push(`## ${d}\n${m[1].trim()}`);
  }
}
writeFileSync(join(out, 'known-issues.md'), `# Known issues — ${gate}\n\nTổng hợp tự động từ evidence/*/completion-report.md (${new Date().toISOString()}).\n\n${issues.join('\n\n')}\n`);
console.log(`[snapshot] ${gate}: git ${head.slice(0, 7)}${dirty ? ' (dirty)' : ''}, ${manifest.length} files, ${distFiles.length} dist files → ${out}/`);
