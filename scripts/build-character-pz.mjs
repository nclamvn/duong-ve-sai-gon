#!/usr/bin/env node
/**
 * Build the soldier body from "WW2 Panzergrenadier 2k" (britdawgmasterfunk, Sketchfab, CC-BY 4.0) with the game's Mixamo clips
 * retargeted onto it (DV-069). The old Swat body has no real skull; this one has a real head and human proportions.
 *
 * Steps
 *  1. drop the M42 helmet + scrim net (separate meshes); keep the body and the plain leather belt pouches
 *  2. rename joints to the runtime convention ("mixamorig:Hips_63" → "mixamorigHips")
 *  3. replace the body albedo with the cleaned texture (insignia removed, DV-069; dark short hair painted, DV-070:
 *     scripts/clean-pz-insignia.py, then pz-hair-mask.mjs + paint-pz-hair.py) and downsize normal/ORM maps
 *  4. retarget every clip of the source character (soldier.glb, Swat rig) onto this skeleton:
 *       world-rotation delta per bone, rest directions aligned bone-by-bone (the two rigs have different rest rolls/poses),
 *       hips translation scaled by hip height; sampled at 30 fps then resampled
 *  5. add "<Bone>_ref" child nodes (Head, Spine2, Hips, RightHand, LeftHand) whose world frame equals the Swat bone frame at
 *     every pose (rotation + scale), so weapon grips, left-hand IK targets and gear offsets calibrated on the Swat rig still apply
 *
 * Use: node scripts/build-character-pz.mjs --src assets-src/sketchfab/ww2_panzergrenadier_2k_cc0.glb
 *        --albedo <clean.png> --clips public/assets/characters/soldier.glb --out public/assets/characters/soldier_pz.glb
 */
import { readFileSync } from 'node:fs';
import { NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { resample, prune, dedup, quantize, reorder, textureCompress } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { Object3D, AnimationMixer, AnimationClip, QuaternionKeyframeTrack, VectorKeyframeTrack, Quaternion, Vector3, Matrix4, LoopOnce } from 'three';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const SRC = opt('src');
const ALBEDO = opt('albedo');
const CLIPS = opt('clips');
const OUT = opt('out');
const FPS = 30;
// keep the leather belt pouches (Object_7, plain leather, no insignia): they replace the procedural chest rig on this body
const DROP_NODES = /^(helmet_|Object_(9|10|11))$/;
const REF_BONES = ['Head', 'Spine2', 'Hips', 'RightHand', 'LeftHand'];

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const norm = (n) => n.replace(/^mixamorig:?/, '').replace(/_\d+$/, '');

// ---------------------------------------------------------------- target document
const doc = await io.read(SRC);
const root = doc.getRoot();
for (const n of root.listNodes()) if (DROP_NODES.test(n.getName())) n.dispose();
for (const a of root.listAnimations()) a.dispose();
const skin = root.listSkins()[0];
const joints = skin.listJoints();
for (const j of joints) if (/^mixamorig/.test(j.getName())) j.setName(`mixamorig${norm(j.getName())}`);

// albedo without insignia; smaller normal/ORM
const bodyMat = root.listMaterials().find((m) => m.getName() === 'Material.003');
if (!bodyMat) throw new Error('body material not found');
bodyMat.setName('Body');
const albedo = await sharp(readFileSync(ALBEDO)).resize(2048, 2048).jpeg({ quality: 88 }).toBuffer();
bodyMat.getBaseColorTexture().setImage(new Uint8Array(albedo)).setMimeType('image/jpeg').setURI('body_albedo.jpg');

// ---------------------------------------------------------------- three mirrors of both hierarchies (rest pose)
function mirror(d) {
  const map = new Map();
  const make = (n) => {
    const o = new Object3D();
    const nm = norm(n.getName());
    o.name = /^mixamorig/.test(n.getName()) ? nm : `n_${map.size}_${nm.replace(/[^A-Za-z0-9]/g, '')}`;
    o.position.fromArray(n.getTranslation());
    o.quaternion.fromArray(n.getRotation());
    o.scale.fromArray(n.getScale());
    map.set(n, o);
    for (const c of n.listChildren()) o.add(make(c));
    return o;
  };
  const top = new Object3D();
  for (const n of d.getRoot().listScenes()[0].listChildren()) top.add(make(n));
  top.updateMatrixWorld(true);
  const byName = new Map();
  top.traverse((o) => byName.set(o.name, o));
  return { top, map, byName };
}
const srcDoc = await io.read(CLIPS);
const S = mirror(srcDoc);
const T = mirror(doc);

const BONES = [...T.byName.keys()].filter((k) => S.byName.has(k) && !k.startsWith('n_'));
console.log(`[pz] ${BONES.length} shared bones`);

// rest world quaternions/positions
const wq = (o) => o.getWorldQuaternion(new Quaternion());
const wp = (o) => o.getWorldPosition(new Vector3());
const ws = (o) => new Vector3().setFromMatrixScale(o.matrixWorld).x;
const Ws0 = new Map(BONES.map((b) => [b, wq(S.byName.get(b))]));
const Wt0 = new Map(BONES.map((b) => [b, wq(T.byName.get(b))]));

// primary child for direction alignment
const CHILD = { Hips: 'Spine', Spine: 'Spine1', Spine1: 'Spine2', Spine2: 'Neck', Neck: 'Head' };
for (const s of ['Left', 'Right']) {
  Object.assign(CHILD, {
    [`${s}Shoulder`]: `${s}Arm`, [`${s}Arm`]: `${s}ForeArm`, [`${s}ForeArm`]: `${s}Hand`, [`${s}Hand`]: `${s}HandMiddle1`,
    [`${s}UpLeg`]: `${s}Leg`, [`${s}Leg`]: `${s}Foot`, [`${s}Foot`]: `${s}ToeBase`, [`${s}ToeBase`]: `${s}Toe_End`,
  });
  for (const f of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) for (let i = 1; i < 4; i++) CHILD[`${s}Hand${f}${i}`] = `${s}Hand${f}${i + 1}`;
}
const align = new Map();
for (const b of BONES) {
  const c = CHILD[b];
  const q = new Quaternion();
  if (c && S.byName.has(c) && T.byName.has(c)) {
    const dS = wp(S.byName.get(c)).sub(wp(S.byName.get(b))).normalize();
    const dT = wp(T.byName.get(c)).sub(wp(T.byName.get(b))).normalize();
    if (dS.lengthSq() > 0.5 && dT.lengthSq() > 0.5) q.setFromUnitVectors(dT, dS);
  }
  align.set(b, q);
}
// Wt0' = A·Wt0 (target rest turned to the source rest directions)
const Wt0a = new Map(BONES.map((b) => [b, align.get(b).clone().multiply(Wt0.get(b))]));

// heights from the skeleton (meshes may be quantized): ground ≈ toe joints, top ≈ head joint
function skelHeight(M) {
  const toe = Math.min(wp(M.byName.get('LeftToeBase')).y, wp(M.byName.get('RightToeBase')).y);
  const head = wp(M.byName.get('Head')).y;
  return { lo: toe, h: head - toe };
}
const hS = skelHeight(S);
const hT = skelHeight(T);
const hipS = wp(S.byName.get('Hips')).y - hS.lo;
const hipT = wp(T.byName.get('Hips')).y - hT.lo;
const kHip = hipT / hipS;
console.log(`[pz] heights src ${hS.h.toFixed(3)} tgt ${hT.h.toFixed(2)} · hips ${hipS.toFixed(3)} / ${hipT.toFixed(2)} → k ${kHip.toFixed(3)}`);

// ---------------------------------------------------------------- source clips as three clips on the mirror
function clipsOf(d, M) {
  const out = [];
  for (const a of d.getRoot().listAnimations()) {
    const tracks = [];
    let dur = 0;
    for (const ch of a.listChannels()) {
      const o = M.map.get(ch.getTargetNode());
      if (!o) continue;
      const s = ch.getSampler();
      const t = Array.from(s.getInput().getArray());
      const v = Array.from(s.getOutput().getArray());
      dur = Math.max(dur, t[t.length - 1]);
      if (ch.getTargetPath() === 'rotation') tracks.push(new QuaternionKeyframeTrack(`${o.uuid}.quaternion`, t, v));
      else if (ch.getTargetPath() === 'translation') tracks.push(new VectorKeyframeTrack(`${o.uuid}.position`, t, v));
    }
    out.push({ name: a.getName(), clip: new AnimationClip(a.getName(), dur, tracks), dur });
  }
  return out;
}
const srcClips = clipsOf(srcDoc, S);
const mixer = new AnimationMixer(S.top);

// target traversal order (parents first)
const order = [];
T.top.traverse((o) => order.push(o));
const tRestLocal = new Map(order.map((o) => [o, o.quaternion.clone()]));
const tParentOf = (o) => o.parent;
const hipsT = T.byName.get('Hips');
const hipsS = S.byName.get('Hips');

const buf = root.listBuffers()[0];
const nodeOfT = new Map([...T.map.entries()].map(([n, o]) => [o, n]));
const tmpQ = new Quaternion();
const tmpM = new Matrix4();
for (const { name, clip, dur } of srcClips) {
  const action = mixer.clipAction(clip);
  // LoopOnce + clamp: sampling exactly at t = duration must give the last pose (LoopRepeat wraps to t = 0 and loses root motion)
  action.setLoop(LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  const frames = Math.max(2, Math.round(dur * FPS) + 1);
  const times = new Float32Array(frames);
  const rot = new Map(BONES.map((b) => [b, new Float32Array(frames * 4)]));
  const hipsPos = new Float32Array(frames * 3);
  const worldT = new Map();
  for (let f = 0; f < frames; f++) {
    const t = Math.min(dur, f / FPS);
    times[f] = t;
    mixer.setTime(t);
    S.top.updateMatrixWorld(true);
    worldT.clear();
    for (const o of order) {
      const parentW = o.parent && worldT.has(o.parent) ? worldT.get(o.parent) : o.parent ? wq(o.parent) : new Quaternion();
      let W;
      const b = o.name;
      if (rot.has(b)) {
        // Wt(t) = Ws(t) · Ws0⁻¹ · A · Wt0
        W = wq(S.byName.get(b)).multiply(tmpQ.copy(Ws0.get(b)).invert()).multiply(Wt0a.get(b));
        const local = parentW.clone().invert().multiply(W);
        local.toArray(rot.get(b), f * 4);
      } else W = parentW.clone().multiply(tRestLocal.get(o));
      worldT.set(o, W);
    }
    // hips: world position scaled about the ground point, then into the target parent space
    const p = wp(hipsS);
    p.y -= hS.lo;
    p.multiplyScalar(kHip);
    p.y += hT.lo;
    const parent = hipsT.parent;
    parent.updateMatrixWorld(true);
    p.applyMatrix4(tmpM.copy(parent.matrixWorld).invert());
    p.toArray(hipsPos, f * 3);
    if (process.env.DBG && name === 'walk_f' && (f === 0 || f === frames - 1)) console.log('[dbg]', f, wp(hipsS).toArray().map((v) => v.toFixed(3)), p.toArray().map((v) => v.toFixed(2)));
  }
  action.stop();
  mixer.uncacheAction(clip);
  const anim = doc.createAnimation(name);
  const inAcc = doc.createAccessor().setType('SCALAR').setArray(times).setBuffer(buf);
  for (const [b, arr] of rot) {
    const node = nodeOfT.get(T.byName.get(b));
    const smp = doc.createAnimationSampler().setInput(inAcc).setOutput(doc.createAccessor().setType('VEC4').setArray(arr).setBuffer(buf)).setInterpolation('LINEAR');
    anim.addSampler(smp).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath('rotation').setSampler(smp));
  }
  const smp = doc.createAnimationSampler().setInput(inAcc).setOutput(doc.createAccessor().setType('VEC3').setArray(hipsPos).setBuffer(buf)).setInterpolation('LINEAR');
  anim.addSampler(smp).addChannel(doc.createAnimationChannel().setTargetNode(nodeOfT.get(hipsT)).setTargetPath('translation').setSampler(smp));
}
console.log(`[pz] retargeted ${srcClips.length} clips`);

// ---------------------------------------------------------------- reference frames (Swat bone frame, rotation + scale)
// at rest the ref world rotation must equal Ws0 when the target is in its aligned rest: Wt0a · C = … with Wt(t)·C = Ws(t)
// → C = Wt0⁻¹ · A⁻¹ · Ws0 ; scale: runtime normalizes both models to the same height
const sRun = hT.h / hS.h; // target units per source unit after runtime normalization
for (const b of REF_BONES) {
  const tb = T.byName.get(b);
  const sb = S.byName.get(b);
  if (!tb || !sb) continue;
  const C = Wt0.get(b).clone().invert().multiply(align.get(b).clone().invert()).multiply(Ws0.get(b));
  const s = (ws(sb) * sRun) / ws(tb);
  const ref = doc.createNode(`mixamorig${b}_ref`).setRotation(C.toArray()).setScale([s, s, s]);
  nodeOfT.get(tb).addChild(ref);
}

// ---------------------------------------------------------------- optimize + write
await doc.transform(
  resample(),
  dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH, PropertyType.TEXTURE] }),
  prune({ keepAttributes: false, keepLeaves: true }),
  textureCompress({ encoder: sharp, targetFormat: 'jpeg', quality: 86, resize: [2048, 2048], slots: /baseColor/ }),
  textureCompress({ encoder: sharp, targetFormat: 'jpeg', quality: 90, resize: [1024, 1024], slots: /^(?!baseColor)/ }),
  quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, pattern: /^(?!JOINTS_|WEIGHTS_)/ }),
  reorder({ encoder: MeshoptEncoder }),
);
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: 'quantize' });
await io.write(OUT, doc);
let tris = 0;
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? 0) / 3;
console.log(`[pz] → ${OUT}: ${tris} tris, ${root.listAnimations().length} clips, joints ${skin.listJoints().length}`);
