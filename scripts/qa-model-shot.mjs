#!/usr/bin/env node
/**
 * Chụp ảnh kiểm một GLB (4 góc) bằng three.js WebGL trong Chromium headless — QA asset trước khi vào game.
 * Dùng: node scripts/qa-model-shot.mjs <glb trong repo> <png ra> [--night]
 */
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const [src, out] = process.argv.slice(2);
const closeUp = process.argv.includes('--face');
const night = process.argv.includes('--night');
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.glb': 'model/gltf-binary', '.html': 'text/html', '.wasm': 'application/wasm' };
const views = closeUp ? '[[0, 0.1, 1.2], [0.9, 0.1, 0.9], [0, 0.15, -1.2], [1.2, 0.1, 0]]' : '[[1, 0.35, 1], [-1, 0.25, 0.6], [0, 0.9, -1], [1.2, 0.05, -0.3]]';
const html = `<!doctype html><html><body style="margin:0;background:#222"><canvas id=c width=1600 height=900></canvas>
<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
const r = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true, preserveDrawingBuffer: true });
r.setSize(1600, 900, false); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping;
const s = new THREE.Scene(); s.background = new THREE.Color(${night ? '0x05070a' : '0x8f9aa3'});
s.add(new THREE.HemisphereLight(${night ? '0x334466, 0x111108, 0.4' : '0xddeeff, 0x445533, 1.6'}));
const d = new THREE.DirectionalLight(${night ? '0x8899bb, 0.5' : '0xffffff, 2.2'}); d.position.set(5, 8, 6); s.add(d);
${night ? "const lamp = new THREE.PointLight(0xffaa55, 30, 12, 1.5); lamp.position.set(2.5, 1.5, 3); s.add(lamp);" : ''}
const ktx = new KTX2Loader().setTranscoderPath('/node_modules/three/examples/jsm/libs/basis/').detectSupport(r);
const g = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(ktx).loadAsync('/${src}');
s.add(g.scene);
g.scene.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(g.scene, true); const c = box.getCenter(new THREE.Vector3()); const z = box.getSize(new THREE.Vector3()).length();
const cam = new THREE.PerspectiveCamera(35, 16 / 9, 0.05, 200);
${closeUp ? 'c.y = box.max.y - 0.13; const zz = 0.6;' : 'const zz = z;'}
const views = ${views};
const shots = [];
for (const v of views) { cam.position.set(c.x + v[0] * zz * 0.85, c.y + v[1] * zz * 0.85, c.z + v[2] * zz * 0.85); cam.lookAt(c); r.render(s, cam); shots.push(r.domElement.toDataURL('image/png')); }
window.__shots = shots; window.__info = { size: box.getSize(new THREE.Vector3()).toArray() };
</script></body></html>`;
const srv = createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html); }
  const p = join(process.cwd(), u);
  if (!existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream' });
  res.end(readFileSync(p));
}).listen(0);
const port = srv.address().port;
const b = await chromium.launch({ executablePath: process.env.HT_CHROME, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pg = await b.newPage();
pg.on('console', (m) => m.type() === 'error' && console.error(m.text()));
await pg.goto(`http://127.0.0.1:${port}/`);
await pg.waitForFunction(() => window.__shots, null, { timeout: 120000 });
const shots = await pg.evaluate(() => window.__shots);
console.log(JSON.stringify(await pg.evaluate(() => window.__info)));
await b.close();
srv.close();
// ghép 2×2
const sharp = (await import('sharp')).default;
const bufs = shots.map((s) => Buffer.from(s.split(',')[1], 'base64'));
const tiles = await Promise.all(bufs.map((b) => sharp(b).resize(800, 450).toBuffer()));
await sharp({ create: { width: 1600, height: 900, channels: 3, background: '#000' } }).composite(tiles.map((t, i) => ({ input: t, left: (i % 2) * 800, top: Math.floor(i / 2) * 450 }))).png().toFile(out);
console.log(out);
