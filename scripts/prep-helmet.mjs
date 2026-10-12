#!/usr/bin/env node
/**
 * Helmet prop for faction A (DV-068): Sketchfab "Soviet SSH-60" (SimplyK, CC-BY) → one game-ready mesh.
 * Keeps the shell only, drops the leather liner band (it pokes through the simplified shell), the chin strap/buckle (the Swat rig has no real chin,
 * a strap would cut through the face) and the hidden suspension rings. Bakes node transforms (Z-up → Y-up), recentres so the
 * origin is the rim centre (y = 0 at the lowest shell point), scales to a target width, welds, simplifies, and replaces the
 * near-flat source textures with plain painted-steel / leather materials (no texture download at runtime).
 * Use: node scripts/prep-helmet.mjs --in <ssh60.glb> --out public/assets/characters/helmet_a.glb [--width 0.31] [--ratio 0.03]
 */
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, dedup, prune } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const IN = opt('in');
const OUT = opt('out');
const WIDTH = Number(opt('width', '0.31'));
const RATIO = Number(opt('ratio', '0.03'));
// liner dropped: after simplification it pokes through the shell as red streaks
const KEEP = { 'Material.001': 'Shell' };

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const src = await io.read(IN);
const parts = { Shell: { pos: [], nor: [], idx: [] }, Liner: { pos: [], nor: [], idx: [] } };
for (const n of src.getRoot().listNodes()) {
  const mesh = n.getMesh();
  if (!mesh) continue;
  const M = n.getWorldMatrix();
  for (const p of mesh.listPrimitives()) {
    const cls = KEEP[p.getMaterial()?.getName() ?? ''];
    if (!cls) continue;
    const g = parts[cls];
    const P = p.getAttribute('POSITION').getArray();
    const N = p.getAttribute('NORMAL')?.getArray();
    const I = p.getIndices()?.getArray();
    const base = g.pos.length / 3;
    for (let v = 0; v < P.length / 3; v++) {
      const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
      g.pos.push(M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]);
      if (N) {
        const a = N[v * 3], b = N[v * 3 + 1], c = N[v * 3 + 2];
        const nx = M[0] * a + M[4] * b + M[8] * c, ny = M[1] * a + M[5] * b + M[9] * c, nz = M[2] * a + M[6] * b + M[10] * c;
        const l = Math.hypot(nx, ny, nz) || 1;
        g.nor.push(nx / l, ny / l, nz / l);
      } else g.nor.push(0, 1, 0);
    }
    if (I) for (const i of I) g.idx.push(base + i);
    else for (let i = 0; i < P.length / 3; i++) g.idx.push(base + i);
  }
}
// frame from the shell: width along x, rim at y = 0, centred in x/z
const sp = parts.Shell.pos;
let minX = Infinity, maxX = -Infinity, minY = Infinity, minZ = Infinity, maxZ = -Infinity;
for (let i = 0; i < sp.length; i += 3) {
  minX = Math.min(minX, sp[i]); maxX = Math.max(maxX, sp[i]);
  minY = Math.min(minY, sp[i + 1]);
  minZ = Math.min(minZ, sp[i + 2]); maxZ = Math.max(maxZ, sp[i + 2]);
}
const s = WIDTH / (maxX - minX);
const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;

const doc = new Document();
const buf = doc.createBuffer();
const scene = doc.createScene('helmet');
const mats = {
  // painted steel, faded olive (sRGB → linear factors)
  Shell: doc.createMaterial('HelmetShell').setBaseColorFactor([0.085, 0.095, 0.052, 1]).setMetallicFactor(0.15).setRoughnessFactor(0.62),
  Liner: doc.createMaterial('HelmetLiner').setBaseColorFactor([0.12, 0.05, 0.03, 1]).setMetallicFactor(0).setRoughnessFactor(0.8),
};
const mesh = doc.createMesh('helmet_a');
for (const [cls, g] of Object.entries(parts)) {
  if (!g.idx.length) continue;
  const pos = new Float32Array(g.pos.length);
  for (let i = 0; i < g.pos.length; i += 3) {
    pos[i] = (g.pos[i] - cx) * s;
    pos[i + 1] = (g.pos[i + 1] - minY) * s;
    pos[i + 2] = (g.pos[i + 2] - cz) * s;
  }
  const prim = doc.createPrimitive().setMaterial(mats[cls]);
  prim.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buf));
  prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(g.nor)).setBuffer(buf));
  prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(g.idx)).setBuffer(buf));
  mesh.addPrimitive(prim);
}
scene.addChild(doc.createNode('helmet_a').setMesh(mesh));
await MeshoptSimplifier.ready;
await doc.transform(weld({ tolerance: 0.0005 }), simplify({ simplifier: MeshoptSimplifier, ratio: RATIO, error: 0.002, lockBorder: false }), dedup(), prune());
let tris = 0;
for (const p of mesh.listPrimitives()) tris += p.getIndices().getCount() / 3;
await io.write(OUT, doc);
console.log(`[helmet] ${OUT}: ${tris} tris, width ${WIDTH} m, scale ${s.toFixed(4)}`);
