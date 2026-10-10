/**
 * Loader dùng chung (TIP-D02, ADR-D04): GLTFLoader + Meshopt + KTX2 (Basis transcoder ở /basis/), KTX2Loader cho texture rời.
 * `initLoaders(renderer, base)` gọi một lần sau khi renderer init (detectSupport cần backend) — trước mọi loadAsync.
 */
import type { WebGPURenderer } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { fetchPak, pakRef } from './pak';

let ktx2: KTX2Loader | null = null;

export function initLoaders(renderer: WebGPURenderer, base: string): void {
  if (ktx2) return;
  ktx2 = new KTX2Loader().setTranscoderPath(`${base}basis/`).detectSupport(renderer);
}

export function ktx2Loader(): KTX2Loader | null {
  return ktx2;
}

/**
 * GLTFLoader biết gói bảo vệ (DV-062): URL thuộc `content/assets/pak.json` được tải dạng .dvpak, giải mã trong bộ nhớ
 * rồi `parse`; mọi chỗ gọi `load`/`loadAsync` giữ nguyên URL logic.
 */
class PakGltfLoader extends GLTFLoader {
  override load(url: string, onLoad: (gltf: GLTF) => void, onProgress?: (e: ProgressEvent) => void, onError?: (err: unknown) => void): void {
    const ref = pakRef(this.manager.resolveURL(url));
    if (!ref) {
      super.load(url, onLoad, onProgress, onError);
      return;
    }
    const resourcePath = ref.url.slice(0, ref.url.lastIndexOf('/') + 1);
    this.manager.itemStart(url);
    fetchPak(ref)
      .then((buf) =>
        this.parse(
          buf,
          resourcePath,
          (g) => {
            onLoad(g);
            this.manager.itemEnd(url);
          },
          (e) => {
            onError?.(e);
            this.manager.itemError(url);
            this.manager.itemEnd(url);
          },
        ),
      )
      .catch((e: unknown) => {
        if (onError) onError(e);
        else console.error(e);
        this.manager.itemError(url);
        this.manager.itemEnd(url);
      });
  }
}

export function createGltfLoader(): GLTFLoader {
  const l = new PakGltfLoader();
  l.setMeshoptDecoder(MeshoptDecoder);
  if (ktx2) l.setKTX2Loader(ktx2);
  return l;
}

/** Giải phóng worker transcoder (test/soak). */
export function disposeLoaders(): void {
  ktx2?.dispose();
  ktx2 = null;
}
