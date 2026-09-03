#!/usr/bin/env node
/** Sinh CREDITS.md từ content/assets/manifest.json (ADR-005/006): nhóm theo license; CC-BY in nguyên chuỗi attribution. */
import { readFileSync, writeFileSync } from 'node:fs';
const m = JSON.parse(readFileSync('content/assets/manifest.json', 'utf8'));
const byLicense = new Map();
for (const a of m.assets) {
  const list = byLicense.get(a.license) ?? [];
  list.push(a);
  byLicense.set(a.license, list);
}
const lines = ['# CREDITS — tài sản bên thứ ba (sinh từ `content/assets/manifest.json`, `npm run assets:credits`)', ''];
const order = ['CC-BY-4.0', 'CC-BY-3.0', 'CC0-1.0', 'Mixamo'];
for (const lic of [...order, ...[...byLicense.keys()].filter((k) => !order.includes(k))]) {
  const list = byLicense.get(lic);
  if (!list) continue;
  lines.push(`## ${lic}`, '');
  if (lic.startsWith('CC-BY')) {
    lines.push('Ghi công bắt buộc (hiển thị trong game ở màn capability và tại đây):', '');
    for (const a of list) lines.push(`- ${a.attribution} — file \`${a.files.map((f) => f.path).join(', ')}\``);
  } else if (lic === 'Mixamo') {
    for (const a of list) lines.push(`- ${a.use ?? a.id} — Adobe Mixamo (${a.url}); dùng theo điều khoản Mixamo, không phân phối lại asset rời.`);
  } else {
    for (const a of list) lines.push(`- ${a.id} (${a.type}) — ${(a.authors ?? []).join(', ') || 'n/a'} — ${a.url}`);
  }
  lines.push('');
}
lines.push(`Tổng: ${m.assets.length} asset, ${(m.totalBytes / 1048576).toFixed(1)} MB. Cập nhật ${m.generatedAt}.`, '');
writeFileSync('CREDITS.md', lines.join('\n'));
console.log(`[credits] CREDITS.md: ${m.assets.length} asset, ${byLicense.size} license`);
