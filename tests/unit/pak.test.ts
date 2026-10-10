import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { packBytes, unpackBytes, pakName, isPak } from '@engine/render/pakCrypto';
import { pakRef } from '@engine/render/pak';

const sha = (b: Uint8Array | ArrayBuffer): string => createHash('sha256').update(new Uint8Array(b instanceof ArrayBuffer ? b : b)).digest('hex');

describe('DV-062 gói asset bảo vệ .dvpak', () => {
  it('đóng gói rồi giải mã ra đúng bản rõ; tất định; sai đường logic thì không giải mã được', async () => {
    const plain = new TextEncoder().encode('glTF giả lập '.repeat(500));
    const a = await packBytes(plain, 'weapons/x.glb');
    const b = await packBytes(plain, 'weapons/x.glb');
    expect(isPak(a)).toBe(true);
    expect(sha(a)).toBe(sha(b));
    expect(sha(await unpackBytes(a, 'weapons/x.glb'))).toBe(sha(plain));
    await expect(unpackBytes(a, 'weapons/y.glb')).rejects.toThrow();
    const bad = a.slice();
    bad[bad.length - 1] = (bad[bad.length - 1] ?? 0) ^ 1;
    await expect(unpackBytes(bad, 'weapons/x.glb')).rejects.toThrow();
    // Vite trả index.html cho file thiếu (DV-020)
    await expect(unpackBytes(new TextEncoder().encode('<!doctype html><html></html>'.repeat(4)), 'weapons/x.glb')).rejects.toThrow(/not a .dvpak/);
    expect(await pakName('weapons/x.glb')).toMatch(/^[0-9a-f]{16}\.dvpak$/);
  });

  it('phân giải URL logic → gói, giữ base và bỏ query', () => {
    const files = { 'weapons/ak47_vm.glb': 'pak/0123456789abcdef.dvpak' };
    expect(pakRef('/assets/weapons/ak47_vm.glb?v=2', files)).toEqual({ logical: 'weapons/ak47_vm.glb', url: '/assets/pak/0123456789abcdef.dvpak' });
    expect(pakRef('/assets/weapons/ak47.glb', files)).toBeNull();
    expect(pakRef('/assets/weapons/xak47_vm.glb', files)).toBeNull();
  });

  it('manifest: mọi asset Fab Standard là gói, không còn file trần trong public, gói giải mã ra GLB KTX2', async () => {
    const m = JSON.parse(readFileSync('content/assets/manifest.json', 'utf8')) as {
      assets: Array<{ id: string; license: string; protect?: boolean; files: Array<{ path: string; logical?: string }> }>;
    };
    const prot = m.assets.filter((a) => ['Fab-Standard', 'CGTrader-RF', 'Unity-EULA'].includes(a.license));
    expect(prot.length).toBeGreaterThan(0);
    for (const a of prot) {
      expect(a.protect).toBe(true);
      for (const f of a.files) {
        expect(f.path).toMatch(/^assets\/pak\/[0-9a-f]{16}\.dvpak$/);
        expect(existsSync(`public/${f.logical}`)).toBe(false);
        const logical = f.logical!.replace(/^assets\//, '');
        const glb = new Uint8Array(await unpackBytes(readFileSync(`public/${f.path}`), logical));
        const dv = new DataView(glb.buffer);
        expect(dv.getUint32(0, true)).toBe(0x46546c67);
        const len = dv.getUint32(12, true);
        const json = JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + len))) as { images?: Array<{ mimeType?: string }> };
        for (const im of json.images ?? []) expect(im.mimeType).toBe('image/ktx2');
      }
    }
  });
});
