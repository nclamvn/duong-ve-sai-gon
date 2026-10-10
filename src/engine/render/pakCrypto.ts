/**
 * Gói asset bảo vệ `.dvpak` (DV-062). Asset mua theo license đòi "ngăn người dùng cuối trích xuất"
 * (Fab Standard, CGTrader Royalty Free, Unity Asset Store EULA) không bao giờ nằm trần trên mạng:
 * build mã hoá AES-256-GCM, game giải mã trong bộ nhớ bằng WebCrypto (bất đồng bộ, không chặn luồng chính).
 * Đây là "biện pháp hợp lý" theo license, không phải DRM tuyệt đối: khoá nằm trong bundle.
 *
 * Tự chứa (không import) để script Node (`scripts/pack-assets.mjs`) nạp thẳng file .ts này.
 *
 * Định dạng: "DVPK" | u8 phiên bản (1) | 3 byte 0 | IV 12 byte | bản mã + tag 16 byte.
 * Khoá riêng mỗi file: HKDF-SHA256(ikm, salt "dvsg-pak-v1", info = đường logic). AAD = đường logic
 * (gói của file này không giải mã được ở vị trí file khác).
 * IV = 12 byte đầu SHA-256(bản rõ): build tất định (cùng file → cùng .dvpak), khác bản rõ → khác IV.
 */

export const PAK_MAGIC = 0x4b505644; // "DVPK" little-endian
export const PAK_VERSION = 1;
const HEADER = 20;
const SALT = 'dvsg-pak-v1';

// mảnh khoá trộn mặt nạ: không để chuỗi khoá liền một khối trong bundle
const F: readonly number[] = [
  0x5d, 0x91, 0x0c, 0xe7, 0x3a, 0x48, 0xb2, 0x1f, 0xc6, 0x70, 0x2e, 0x99, 0x04, 0xdb, 0x63, 0xa8,
  0x17, 0xf4, 0x8e, 0x35, 0xca, 0x52, 0x0b, 0x6d, 0xe1, 0x29, 0x9f, 0x76, 0x43, 0xbc, 0x08, 0xd5,
];
const M: readonly number[] = [
  0x2a, 0x6e, 0xb3, 0x14, 0xd9, 0x87, 0x40, 0xfc, 0x31, 0x9b, 0xe5, 0x0d, 0x72, 0x58, 0xae, 0x63,
  0xc0, 0x1b, 0x47, 0xf8, 0x95, 0x2c, 0xd6, 0x81, 0x3e, 0xa4, 0x07, 0xe9, 0x5f, 0x12, 0xbd, 0x70,
];

function ikm(): Uint8Array {
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = (F[i]! ^ M[(i * 7) % 32]!) & 0xff;
  return out;
}

function subtle(): SubtleCrypto {
  const c = globalThis.crypto?.subtle;
  if (!c) throw new Error('pak: WebCrypto unavailable (needs a secure context: https or localhost)');
  return c;
}

const enc = new TextEncoder();

async function fileKey(logical: string): Promise<CryptoKey> {
  const s = subtle();
  const base = await s.importKey('raw', ikm() as BufferSource, 'HKDF', false, ['deriveKey']);
  return s.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: enc.encode(SALT) as BufferSource, info: enc.encode(logical) as BufferSource },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** tên file gói: không lộ tên asset (16 hex của SHA-256(đường logic + salt)) */
export async function pakName(logical: string): Promise<string> {
  const h = new Uint8Array(await subtle().digest('SHA-256', enc.encode(`${SALT}:${logical}`) as BufferSource));
  return `${Array.from(h.subarray(0, 8), (b) => b.toString(16).padStart(2, '0')).join('')}.dvpak`;
}

export async function packBytes(plain: Uint8Array, logical: string): Promise<Uint8Array> {
  const s = subtle();
  const iv = new Uint8Array(await s.digest('SHA-256', plain as BufferSource)).slice(0, 12);
  const ct = new Uint8Array(
    await s.encrypt({ name: 'AES-GCM', iv: iv as BufferSource, additionalData: enc.encode(logical) as BufferSource }, await fileKey(logical), plain as BufferSource),
  );
  const out = new Uint8Array(HEADER + ct.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, PAK_MAGIC, true);
  out[4] = PAK_VERSION;
  out.set(iv, 8);
  out.set(ct, HEADER);
  return out;
}

export function isPak(buf: ArrayBuffer | Uint8Array): boolean {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return u.length > HEADER + 16 && new DataView(u.buffer, u.byteOffset, 8).getUint32(0, true) === PAK_MAGIC;
}

export async function unpackBytes(buf: ArrayBuffer | Uint8Array, logical: string): Promise<ArrayBuffer> {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  // Vite trả index.html (200) cho file thiếu: kiểm byte đầu trước khi giải mã (DV-020)
  if (!isPak(u)) throw new Error(`pak: ${logical} is not a .dvpak`);
  if (u[4] !== PAK_VERSION) throw new Error(`pak: ${logical} unsupported version ${u[4]}`);
  const iv = u.slice(8, 20);
  return subtle().decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource, additionalData: enc.encode(logical) as BufferSource },
    await fileKey(logical),
    u.slice(HEADER) as BufferSource,
  );
}
