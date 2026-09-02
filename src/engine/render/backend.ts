/**
 * Chọn backend render (PRD REN-001): WebGPU primary, WebGL 2 fallback, cùng content path.
 * Override: ?backend=webgl | ?backend=webgpu. Device lost → callback (không ship menu debug).
 */
import { WebGPURenderer, ACESFilmicToneMapping, SRGBColorSpace, PCFSoftShadowMap } from 'three/webgpu';

export type BackendKind = 'webgpu' | 'webgl2';

export interface AdapterInfo {
  vendor: string;
  architecture: string;
  device: string;
  description: string;
}

export interface RendererBundle {
  renderer: WebGPURenderer;
  backend: BackendKind;
  adapterInfo: AdapterInfo | null;
  webgpuAvailable: boolean;
  /** GPU timestamp query có thể dùng không (WebGPU feature 'timestamp-query' hoặc EXT_disjoint_timer_query_webgl2) */
  timestampCapable: boolean;
  canvas: HTMLCanvasElement;
}

export interface CreateRendererOptions {
  canvas: HTMLCanvasElement;
  forceWebGL?: boolean;
  antialias?: boolean;
  onDeviceLost?: (info: { api: string; message: string; reason: string | null }) => void;
}

export function backendFromSearch(search: string): 'webgl' | 'webgpu' | null {
  const v = new URLSearchParams(search).get('backend');
  if (v === 'webgl' || v === 'webgl2') return 'webgl';
  if (v === 'webgpu') return 'webgpu';
  return null;
}

export async function probeAdapter(): Promise<AdapterInfo | null> {
  const gpu = (navigator as Navigator & { gpu?: GPU }).gpu;
  if (!gpu) return null;
  try {
    const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) return null;
    const info = adapter.info;
    return {
      vendor: info?.vendor ?? '',
      architecture: info?.architecture ?? '',
      device: info?.device ?? '',
      description: info?.description ?? '',
    };
  } catch {
    return null;
  }
}

export async function createRenderer(opts: CreateRendererOptions): Promise<RendererBundle> {
  const webgpuAvailable = typeof (navigator as Navigator & { gpu?: unknown }).gpu !== 'undefined';
  const forceWebGL = opts.forceWebGL === true || !webgpuAvailable;
  const renderer = new WebGPURenderer({
    canvas: opts.canvas,
    antialias: opts.antialias ?? true,
    forceWebGL,
    trackTimestamp: true,
    powerPreference: 'high-performance',
  });
  renderer.onDeviceLost = (info) => {
    opts.onDeviceLost?.({ api: info.api, message: info.message, reason: info.reason ?? null });
  };
  await renderer.init();
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  const backendObj = renderer.backend as { isWebGPUBackend?: boolean; device?: GPUDevice };
  const backend: BackendKind = backendObj.isWebGPUBackend === true ? 'webgpu' : 'webgl2';
  const adapterInfo = backend === 'webgpu' ? await probeAdapter() : null;
  let timestampCapable = false;
  if (backend === 'webgpu') timestampCapable = backendObj.device?.features.has('timestamp-query') ?? false;
  else {
    const gl = opts.canvas.getContext('webgl2');
    timestampCapable = !!gl?.getExtension('EXT_disjoint_timer_query_webgl2');
  }
  return { renderer, backend, adapterInfo, webgpuAvailable, timestampCapable, canvas: opts.canvas };
}
