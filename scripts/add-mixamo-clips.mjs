#!/usr/bin/env node
/**
 * Add Mixamo animation clips to an existing character glb (DV-066) without touching its mesh, skin or textures.
 * In: base glb (e.g. public/assets/characters/soldier.glb, retextured Swat Guy) + a folder of Mixamo FBX (same rig, any skin
 * option) + a name map "file stem → clip name" (only mapped files are added; existing clips with the same name are replaced).
 * Clips are matched to nodes by name (Mixamo rig names are identical). Root motion is left as is: the runtime measures it
 * and makes clips in place (src/engine/render/clipAnalysis.ts).
 * Use: node scripts/add-mixamo-clips.mjs --base <in.glb> --src <dir> --map <map.json> [--out <out.glb>] [--manifest-id soldier_mixamo]
 */
import { readdirSync, existsSync, mkdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { resample, prune } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

const require = createRequire(import.meta.url);
const convert = require('fbx2gltf');
const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};
const BASE = opt('base');
const SRC = opt('src');
const MAP = JSON.parse(readFileSync(opt('map'), 'utf8'));
const OUT = opt('out', BASE);
const MID = opt('manifest-id', null);
if (!BASE || !SRC) throw new Error('missing --base or --src');
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(BASE);
const root = doc.getRoot();
const nodeByName = new Map(root.listNodes().map((n) => [n.getName(), n]));
const TMP = join(SRC, '_glb');
mkdirSync(TMP, { recursive: true });

const files = readdirSync(SRC).filter((f) => /\.fbx$/i.test(f) && MAP[f.replace(/\.fbx$/i, '')]);
let added = 0;
let channels = 0;
let missing = 0;
for (const f of files.sort()) {
  const clip = MAP[f.replace(/\.fbx$/i, '')];
  const out = join(TMP, `${clip}.glb`);
  if (!existsSync(out) || statSync(out).mtimeMs < statSync(join(SRC, f)).mtimeMs) await convert(join(SRC, f), out, []);
  const adoc = await io.read(out);
  const anim = adoc.getRoot().listAnimations()[0];
  if (!anim) {
    console.warn(`[clips] ${f}: no animation`);
    continue;
  }
  for (const old of root.listAnimations()) if (old.getName() === clip) old.dispose();
  const dst = doc.createAnimation(clip);
  const samplers = new Map();
  for (const ch of anim.listChannels()) {
    const tn = ch.getTargetNode();
    const local = tn ? nodeByName.get(tn.getName()) : null;
    if (!local) {
      missing++;
      continue;
    }
    // FBX2glTF exports scale channels Mixamo never animates: keep translation (hips) + rotation only
    if (ch.getTargetPath() === 'scale') continue;
    if (ch.getTargetPath() === 'translation' && !/Hips$/.test(tn.getName())) continue;
    const s = ch.getSampler();
    let ds = samplers.get(s);
    if (!ds) {
      const cp = (a) => doc.createAccessor().setType(a.getType()).setArray(a.getArray().slice());
      ds = doc.createAnimationSampler().setInput(cp(s.getInput())).setOutput(cp(s.getOutput())).setInterpolation(s.getInterpolation());
      samplers.set(s, ds);
      dst.addSampler(ds);
    }
    dst.addChannel(doc.createAnimationChannel().setTargetNode(local).setTargetPath(ch.getTargetPath()).setSampler(ds));
    channels++;
  }
  // buffers: everything into the base buffer
  const buf = root.listBuffers()[0];
  for (const smp of dst.listSamplers()) {
    smp.getInput().setBuffer(buf);
    smp.getOutput().setBuffer(buf);
  }
  added++;
  console.log(`[clips] ${f} → ${clip} (${dst.listChannels().length} ch)`);
}
await doc.transform(resample(), prune({ keepLeaves: true, keepAttributes: true }));
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: 'quantize' });
await io.write(OUT, doc);
const bytes = statSync(OUT).size;
console.log(`[clips] +${added} clips, ${channels} channels, ${missing} unmatched → ${OUT} (${(bytes / 1048576).toFixed(2)} MB)`);
console.log(`[clips] all: ${root.listAnimations().map((a) => a.getName()).join(', ')}`);

if (MID && OUT.startsWith('public/')) {
  const MANIFEST = 'content/assets/manifest.json';
  const m = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const a = m.assets.find((x) => x.id === MID);
  if (!a) throw new Error(`manifest id ${MID} not found`);
  const rel = OUT.replace(/^public\//, '');
  for (const fe of a.files) if (fe.path === rel) Object.assign(fe, { bytes, sha256: sha256(OUT) });
  a.sourceFiles = (a.sourceFiles ?? []).filter((s) => !s.path.startsWith(SRC));
  for (const f of files.sort()) a.sourceFiles.push({ path: join(SRC, f), bytes: statSync(join(SRC, f)).size, sha256: sha256(join(SRC, f)) });
  m.totalBytes = m.assets.reduce((s, x) => s + x.files.reduce((t, f) => t + f.bytes, 0), 0);
  m.generatedAt = new Date().toISOString();
  writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + '\n');
  console.log(`[clips] manifest ${MID} updated`);
}
