/**
 * Navmesh — recast-navigation-js (ADR-003): sinh runtime từ positions/indices, query path/nearest.
 * Không chứa logic AI. Chạy được trong Node (wasm-compat) cho unit test.
 */
import { init, NavMesh, NavMeshQuery, importNavMesh, exportNavMesh } from 'recast-navigation';
import { generateSoloNavMesh } from '@recast-navigation/generators';

export interface NavConfig {
  cs: number;
  ch: number;
  walkableRadius: number;
  walkableClimb: number;
  walkableSlopeAngle: number;
  walkableHeight: number;
}

export const DEFAULT_NAV: NavConfig = { cs: 0.3, ch: 0.2, walkableRadius: 0.4, walkableClimb: 0.35, walkableSlopeAngle: 50, walkableHeight: 1.8 };

export interface NavPoint {
  x: number;
  y: number;
  z: number;
}

let initPromise: Promise<void> | null = null;
export function initNav(): Promise<void> {
  if (!initPromise) initPromise = init();
  return initPromise;
}

export class NavService {
  readonly navMesh: NavMesh;
  readonly query: NavMeshQuery;
  readonly buildMs: number;
  readonly polyCount: number;
  private readonly halfExtents = { x: 2, y: 4, z: 2 };

  /** Nạp navmesh bake sẵn (scripts/terrain-bake.mjs --nav → nav.bin, TIP-D04) — không bake runtime. */
  static fromExport(data: Uint8Array): NavService {
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const { navMesh } = importNavMesh(data);
    return new NavService(navMesh, t0);
  }

  /** Xuất navmesh (bake offline) */
  export(): Uint8Array {
    return exportNavMesh(this.navMesh);
  }

  constructor(positions: ArrayLike<number>, indices: ArrayLike<number>, cfg?: Partial<NavConfig>);
  constructor(navMesh: NavMesh, t0: number);
  constructor(a: ArrayLike<number> | NavMesh, b?: ArrayLike<number> | number, cfg: Partial<NavConfig> = {}) {
    if (!(a instanceof NavMesh) && typeof b === 'number') throw new Error('NavService: invalid arguments');
    if (a instanceof NavMesh) {
      const t0 = typeof b === 'number' ? b : Date.now();
      this.navMesh = a;
      this.query = new NavMeshQuery(this.navMesh);
      this.buildMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
      this.polyCount = countPolys(this.navMesh);
      return;
    }
    const positions = a;
    const indices = b as ArrayLike<number>;
    const c = { ...DEFAULT_NAV, ...cfg };
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const res = generateSoloNavMesh(positions, indices, {
      cs: c.cs,
      ch: c.ch,
      walkableRadius: Math.ceil(c.walkableRadius / c.cs),
      walkableClimb: Math.ceil(c.walkableClimb / c.ch),
      walkableSlopeAngle: c.walkableSlopeAngle,
      walkableHeight: Math.ceil(c.walkableHeight / c.ch),
      minRegionArea: 8,
      mergeRegionArea: 20,
      maxEdgeLen: 12,
      maxSimplificationError: 1.3,
      detailSampleDist: 6,
      detailSampleMaxError: 1,
    });
    if (!res.success) throw new Error(`navmesh build failed: ${res.error}`);
    this.navMesh = res.navMesh;
    this.query = new NavMeshQuery(this.navMesh);
    this.buildMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
    this.polyCount = countPolys(this.navMesh);
  }

  /** Điểm gần nhất trên navmesh. */
  nearest(p: NavPoint): NavPoint | null {
    const r = this.query.findClosestPoint(p, { halfExtents: this.halfExtents });
    if (!r.success) return null;
    return { x: r.point.x, y: r.point.y, z: r.point.z };
  }

  /** Đường thẳng hoá từ a → b. [] nếu không có. */
  findPath(a: NavPoint, b: NavPoint): NavPoint[] {
    const r = this.query.computePath(a, b, { halfExtents: this.halfExtents, maxPathPolys: 256, maxStraightPathPoints: 64 });
    if (!r.success) return [];
    return r.path.map((v) => ({ x: v.x, y: v.y, z: v.z }));
  }

  /**
   * Trượt trên mặt navmesh từ `from` tới `to` (moveAlongSurface): bước thẳng ngắn của bot (ló/nấp/dịch chuyển khi bắn, đội hình)
   * không xuyên tường/thân cây — obstacle = mép navmesh. Null khi `from` không nằm gần navmesh.
   */
  moveAlong(from: NavPoint, to: NavPoint): NavPoint | null {
    const n = this.query.findNearestPoly(from, { halfExtents: this.halfExtents });
    if (!n.success || !n.nearestRef) return null;
    const r = this.query.moveAlongSurface(n.nearestRef, n.nearestPoint, to);
    if (!r.success) return null;
    return { x: r.resultPosition.x, y: r.resultPosition.y, z: r.resultPosition.z };
  }

  /** Điểm ngẫu nhiên quanh p trong bán kính r (dùng cho stuck recovery). */
  randomAround(p: NavPoint, radius: number, rand: () => number): NavPoint | null {
    const r = this.query.findRandomPointAroundCircle(p, radius, { halfExtents: this.halfExtents });
    if (!r.success) return null;
    void rand;
    return { x: r.randomPoint.x, y: r.randomPoint.y, z: r.randomPoint.z };
  }

  dispose(): void {
    this.query.destroy();
    this.navMesh.destroy();
  }
}

function countPolys(nav: NavMesh): number {
  let n = 0;
  const max = nav.getMaxTiles();
  for (let i = 0; i < max; i++) {
    const tile = nav.getTile(i);
    const header = tile.header();
    if (header) n += header.polyCount();
  }
  return n;
}
