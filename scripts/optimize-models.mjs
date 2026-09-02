#!/usr/bin/env node
/**
 * Tối ưu glTF props (ADR-005): weld → simplify (meshopt) → resample/dedup/prune → quantize → reorder → meshopt compress → .glb
 * Vào: assets-src/polyhaven/models/<id>/<id>_1k.gltf · Ra: public/assets/models/<id>.glb (texture JPG embed)
 * Dùng độc lập: node scripts/optimize-models.mjs [ratio=0.25]  — fetch-assets.mjs cũng gọi hàm này.
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { weld, simplify, dedup, prune, quantize, reorder, resample } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import { readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const SRC_ROOT = 'assets-src/polyhaven/models';
export const OUT_ROOT = 'public/assets/models';

function triCount(doc) {
  let n = 0;
  for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) n += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
  return Math.round(n);
}

let io = null;
async function getIO() {
  if (io) return io;
  await MeshoptSimplifier.ready;
  await MeshoptEncoder.ready;
  io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  return io;
}

/** @returns {Promise<{out: string, before: number, after: number, bytes: number}>} */
export async function optimizeModel(id, ratio = 0.25) {
  const src = join(SRC_ROOT, id, `${id}_1k.gltf`);
  if (!existsSync(src)) throw new Error(`missing ${src}`);
  const nio = await getIO();
  const doc = await nio.read(src);
  const before = triCount(doc);
  await doc.transform(
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.0015, lockBorder: false }),
    resample(),
    dedup(),
    prune({ keepAttributes: false, keepLeaves: false }),
    quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }),
    reorder({ encoder: MeshoptEncoder }),
  );
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: 'quantize' });
  mkdirSync(OUT_ROOT, { recursive: true });
  const out = join(OUT_ROOT, `${id}.glb`);
  await nio.write(out, doc);
  return { out, before, after: triCount(doc), bytes: statSync(out).size };
}

if (process.argv[1] && process.argv[1].endsWith('optimize-models.mjs')) {
  const ratio = Number(process.argv[2] ?? 0.25);
  for (const id of readdirSync(SRC_ROOT)) {
    if (!statSync(join(SRC_ROOT, id)).isDirectory()) continue;
    const r = await optimizeModel(id, ratio);
    console.log(`[models] ${id}: ${r.before} → ${r.after} tri, ${(r.bytes / 1048576).toFixed(2)} MB`);
  }
}
