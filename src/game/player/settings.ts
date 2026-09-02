/**
 * Settings (PRD PLY-002, A11Y-002): sensitivity, invert Y, raw input, FOV, bob/shake/recoil 0–100, motion blur, ADS hold.
 * Lưu IndexedDB (D-011) qua wrapper nhỏ; fallback in-memory khi IndexedDB throw (private mode, test).
 */
export interface Settings {
  sensitivity: number;
  invertY: boolean;
  rawInput: boolean;
  fov: number;
  bob: number;
  shake: number;
  recoilView: number;
  motionBlur: boolean;
  adsHold: boolean;
  subtitleScale: number;
  subtitleBg: number;
}

export const DEFAULT_SETTINGS: Settings = {
  sensitivity: 1,
  invertY: false,
  rawInput: true,
  fov: 90,
  bob: 100,
  shake: 100,
  recoilView: 100,
  motionBlur: false,
  adsHold: true,
  subtitleScale: 1,
  subtitleBg: 0.55,
};

const LIMITS: Record<keyof Settings, [number, number] | null> = {
  sensitivity: [0.1, 5],
  invertY: null,
  rawInput: null,
  fov: [70, 110],
  bob: [0, 100],
  shake: [0, 100],
  recoilView: [0, 100],
  motionBlur: null,
  adsHold: null,
  subtitleScale: [0.7, 2],
  subtitleBg: [0, 1],
};

export function sanitize(input: Partial<Settings> | null | undefined): Settings {
  const out: Settings = { ...DEFAULT_SETTINGS };
  if (!input) return out;
  for (const key of Object.keys(DEFAULT_SETTINGS) as Array<keyof Settings>) {
    const v = input[key];
    if (v === undefined) continue;
    const lim = LIMITS[key];
    if (lim) {
      if (typeof v === 'number' && Number.isFinite(v)) (out as unknown as Record<string, unknown>)[key] = Math.max(lim[0], Math.min(lim[1], v));
    } else if (typeof v === 'boolean') (out as unknown as Record<string, unknown>)[key] = v;
  }
  return out;
}

export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  readonly kind: 'indexeddb' | 'memory';
}

export function memoryStore(): KeyValueStore {
  const m = new Map<string, unknown>();
  return {
    kind: 'memory',
    get: async <T,>(k: string) => m.get(k) as T | undefined,
    set: async <T,>(k: string, v: T) => {
      m.set(k, v);
    },
  };
}

/** IndexedDB key-value store ~40 dòng. dbName/storeName cố định; mọi lỗi → throw để caller fallback. */
export function indexedDbStore(dbName = 'ht-mb', storeName = 'kv'): KeyValueStore {
  const open = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(storeName)) req.result.createObjectStore(storeName);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  return {
    kind: 'indexeddb',
    async get<T>(key: string): Promise<T | undefined> {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const r = tx.objectStore(storeName).get(key);
        r.onsuccess = () => resolve(r.result as T | undefined);
        r.onerror = () => reject(r.error);
        tx.oncomplete = () => db.close();
      });
    },
    async set<T>(key: string, value: T): Promise<void> {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).put(value, key);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      });
    },
  };
}

export async function pickStore(): Promise<KeyValueStore> {
  try {
    if (typeof indexedDB === 'undefined') return memoryStore();
    const s = indexedDbStore();
    await s.get('__probe');
    return s;
  } catch {
    return memoryStore();
  }
}

export class SettingsStore {
  current: Settings = { ...DEFAULT_SETTINGS };
  private listeners = new Set<(s: Settings) => void>();
  constructor(readonly store: KeyValueStore, readonly key = 'settings') {}

  async load(): Promise<Settings> {
    try {
      const raw = await this.store.get<Partial<Settings>>(this.key);
      this.current = sanitize(raw);
    } catch {
      this.current = { ...DEFAULT_SETTINGS };
    }
    this.emit();
    return this.current;
  }

  /** Áp dụng tức thời + lưu. */
  async update(patch: Partial<Settings>): Promise<Settings> {
    this.current = sanitize({ ...this.current, ...patch });
    this.emit();
    try {
      await this.store.set(this.key, this.current);
    } catch {
      /* best effort */
    }
    return this.current;
  }

  onChange(fn: (s: Settings) => void): () => void {
    this.listeners.add(fn);
    fn(this.current);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const l of this.listeners) l(this.current);
  }
}
