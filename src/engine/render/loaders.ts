/**
 * Loader dùng chung (TIP-D02, ADR-D04): GLTFLoader + Meshopt + KTX2 (Basis transcoder ở /basis/), KTX2Loader cho texture rời.
 * `initLoaders(renderer, base)` gọi một lần sau khi renderer init (detectSupport cần backend) — trước mọi loadAsync.
 */
import type { WebGPURenderer } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

let ktx2: KTX2Loader | null = null;

export function initLoaders(renderer: WebGPURenderer, base: string): void {
  if (ktx2) return;
  ktx2 = new KTX2Loader().setTranscoderPath(`${base}basis/`).detectSupport(renderer);
}

export function ktx2Loader(): KTX2Loader | null {
  return ktx2;
}

export function createGltfLoader(): GLTFLoader {
  const l = new GLTFLoader();
  l.setMeshoptDecoder(MeshoptDecoder);
  if (ktx2) l.setKTX2Loader(ktx2);
  return l;
}

/** Giải phóng worker transcoder (test/soak). */
export function disposeLoaders(): void {
  ktx2?.dispose();
  ktx2 = null;
}
