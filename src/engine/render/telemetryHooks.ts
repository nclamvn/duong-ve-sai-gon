/** Đọc số liệu renderer cho telemetry (PRD §4 Đo lường). Không allocation. */
import type { WebGPURenderer } from 'three/webgpu';

export interface RenderFrameInfo {
  calls: number;
  triangles: number;
  gpuMs: number | null;
  heapMB: number | null;
  renderWidth: number;
  renderHeight: number;
}

const perfMem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;

export function readRenderInfo(renderer: WebGPURenderer, out: RenderFrameInfo): RenderFrameInfo {
  // WebGPURenderer: `calls` là tổng render() từ đầu; `drawCalls` là draw call của frame hiện tại.
  // BatchedMesh trên backend WebGPU r185 phát 1 drawIndexed/instance trong cùng pipeline → được đếm từng cái.
  const r = renderer.info.render as { drawCalls: number; triangles: number; timestamp?: number };
  out.calls = r.drawCalls;
  out.triangles = r.triangles;
  out.gpuMs = typeof r.timestamp === 'number' && r.timestamp > 0 ? r.timestamp : null;
  out.heapMB = perfMem ? perfMem.usedJSHeapSize / 1048576 : null;
  const size = renderer.getDrawingBufferSize(scratchSize);
  out.renderWidth = size.x;
  out.renderHeight = size.y;
  return out;
}

import { Vector2 } from 'three/webgpu';
const scratchSize = new Vector2();
