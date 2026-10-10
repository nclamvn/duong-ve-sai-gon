/**
 * Phân giải asset bảo vệ (DV-062): URL logic (vd `<base>weapons/ak47_vm.glb`) → gói `<base>pak/<hash>.dvpak`
 * theo `content/assets/pak.json` (sinh bởi scripts/pack-assets.mjs). Asset không bảo vệ đi đường cũ.
 */
import index from '@content/assets/pak.json';
import { unpackBytes } from './pakCrypto';

const FILES: Record<string, string> = (index as { files: Record<string, string> }).files;

export interface PakRef {
  /** đường logic dưới public/assets/ (AAD + khoá con) */
  logical: string;
  /** URL gói .dvpak */
  url: string;
}

export function pakRef(url: string, files: Record<string, string> = FILES): PakRef | null {
  const clean = url.split(/[?#]/)[0]!;
  for (const logical of Object.keys(files)) {
    if (clean === logical || clean.endsWith(`/${logical}`)) {
      return { logical, url: clean.slice(0, clean.length - logical.length) + files[logical]! };
    }
  }
  return null;
}

/** HEAD tồn tại: asset bảo vệ thì hỏi gói .dvpak, không hỏi file trần (đã không còn trên mạng) */
export async function assetExists(url: string): Promise<boolean> {
  const ref = pakRef(url);
  const r = await fetch(ref ? ref.url : url, { method: 'HEAD' });
  return r.ok;
}

export async function fetchPak(ref: PakRef): Promise<ArrayBuffer> {
  const r = await fetch(ref.url);
  if (!r.ok) throw new Error(`pak: ${ref.logical} HTTP ${r.status}`);
  return unpackBytes(await r.arrayBuffer(), ref.logical);
}

export function protectedPaths(): string[] {
  return Object.keys(FILES);
}
