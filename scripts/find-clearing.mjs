#!/usr/bin/env node
/**
 * Tìm bãi trống tự nhiên (không cây thân/bụi) trong rừng scatter của level — chọn điểm treo đổ quân / LZ / chốt (TIP-D-SKY, DV-042).
 * Chạy đúng scatter seeded của engine (bundle rolldown như terrain-bake --nav) nên kết quả khớp rừng lúc chạy ở mọi tier (tier thấp ⊂ tier cao).
 * Dùng: node scripts/find-clearing.mjs <cx> <cz> <bán kính tìm m> <bán kính trống tối thiểu m> [dốc tối đa 1−ny] [--level content/levels/x.level.json] [--terrain truong-son-a]
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
const { rolldown } = await import('rolldown');
mkdirSync('.sync', { recursive: true });
writeFileSync('.sync/_nav-veg-entry.ts', "export { scatterSpecies, placementColliders } from '../src/engine/vegetation/scatter';\nexport { navObstacleMesh } from '../src/engine/vegetation/navObstacles';\nexport { TerrainTile } from '../src/engine/terrain/tile';\n");
const b = await rolldown({ input: './.sync/_nav-veg-entry.ts', resolve: { tsconfigFilename: 'tsconfig.json' } });
const { output } = await b.generate({ format: 'esm' });
writeFileSync('.sync/_nav-veg.mjs', output[0].code);
const eng = await import(`${process.cwd()}/.sync/_nav-veg.mjs?t=${Date.now()}`);
const argOpt = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const dir = `public/assets/terrain/${argOpt('terrain', 'truong-son-a')}`;
const meta = JSON.parse(readFileSync(`${dir}/meta.json`, 'utf8'));
const buf = readFileSync(`${dir}/height.r16`);
const u16 = new Uint16Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const level = JSON.parse(readFileSync(argOpt('level', 'content/levels/truong-son-a.level.json'), 'utf8'));
const veg = level.vegetation;
const tile = new eng.TerrainTile(meta, u16, 0);
const trees = [];
for (const rule of veg.species) {
  if (!rule.collider && !/tree|palm|bamboo|banana/.test(rule.id)) continue;
  const pl = eng.scatterSpecies(tile, rule.rect ?? veg.rect, { ...rule, variants: 1 }, veg.seed, veg.cellM ?? 64, 1);
  for (let i = 0; i < pl.count; i++) trees.push([pl.pos[i * 3], pl.pos[i * 3 + 2], rule.id, pl.scale[i]]);
}
console.log('cây thân:', trees.length);
const num = process.argv.slice(2).filter((a, i, arr) => !a.startsWith('--') && !(arr[i - 1] ?? '').startsWith('--')).map(Number);
const [cx, cz, R = 300, need = 18, maxSlope = 1] = num;
if (!Number.isFinite(cx) || !Number.isFinite(cz)) { console.error('cần <cx> <cz>'); process.exit(2); }
const cand = [];
const n = [0, 0, 0];
for (let x = cx - R; x <= cx + R; x += 4) for (let z = cz - R; z <= cz + R; z += 4) {
  let dmin = Infinity;
  for (const t of trees) { const d = Math.hypot(t[0] - x, t[1] - z); if (d < dmin) dmin = d; }
  if (dmin < need) continue;
  if (Math.abs(x - veg.rect.x) > veg.rect.w / 2 - 30 || Math.abs(z - veg.rect.z) > veg.rect.h / 2 - 30) continue;
  tile.normalAt(x, z, n);
  if (1 - n[1] > maxSlope) continue;
  cand.push({ x, z, dmin: +dmin.toFixed(1), slope: +(1 - n[1]).toFixed(3), y: +tile.sample(x, z).toFixed(1), dist: +Math.hypot(x - cx, z - cz).toFixed(0) });
}
cand.sort((a, b) => a.dist - b.dist);
console.log('bãi trống (≥', need, 'm không cây) gần', cx, cz, ':', cand.length);
for (const c of cand.slice(0, 12)) console.log(JSON.stringify(c));
// đường kính lớn nhất
cand.sort((a, b) => b.dmin - a.dmin);
console.log('rộng nhất:', cand.slice(0, 5).map((c) => JSON.stringify(c)).join(' '));
