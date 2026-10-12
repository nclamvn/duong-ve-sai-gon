#!/usr/bin/env node
/**
 * Hoàn thiện GLB của Thu (DV-077) sau Blender: alpha đúng loại (thân, áo, mắt OPAQUE; tóc, lông mày, mi MASK để không lỗi
 * thứ tự vẽ trong suốt), tên khớp xương runtime ("mixamorig:Hips" → "mixamorigHips"), texture WebP ≤ 1024, meshopt.
 * Dùng: node scripts/characters/finish-thu.mjs <in.glb> <out.glb>
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { prune, dedup, textureCompress, quantize, reorder } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

const [src, out] = process.argv.slice(2);
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(src);
for (const m of doc.getRoot().listMaterials()) {
  const n = m.getName();
  if (/braid|eyebrow|eyelash/.test(n)) {
    m.setAlphaMode('MASK');
    m.setAlphaCutoff(0.45);
    m.setDoubleSided(true);
  } else {
    m.setAlphaMode('OPAQUE');
    m.setDoubleSided(/casualsuit/.test(n));
  }
  m.setRoughnessFactor(/low-poly/.test(n) ? 0.25 : /braid/.test(n) ? 0.55 : 0.85);
  m.setMetallicFactor(0);
}
for (const node of doc.getRoot().listNodes()) node.setName(node.getName().replace('mixamorig:', 'mixamorig'));
await doc.transform(dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024] }), reorder({ encoder: MeshoptEncoder }), quantize());
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
await io.write(out, doc);
console.log('[thu]', out);
