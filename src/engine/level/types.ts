/**
 * Định nghĩa level dữ liệu (TIP-019, ADR-007): content/levels/<id>.level.json → builder dựng scene + collider + navmesh + spawn.
 * Engine thuần; không biết mission/AI. Đơn vị m, trục: +x đông, −z bắc (theo quy ước arena G0: spawn +z, mục tiêu −z).
 */
export type V3 = [number, number, number];

export interface LevelSky {
  hdri: string;
  res: '1k' | '2k' | '4k';
  /** cường độ IBL */
  envIntensity: number;
  /** nền trời: cường độ (AgX) */
  skyIntensity: number;
  sun: { azimuthDeg: number; elevationDeg: number; color: number; intensity: number };
  hemi: { sky: number; ground: number; intensity: number };
  fog: { color: number; density: number };
  /** cascade shadow: số cascade, xa nhất (m), map size */
  csm: { cascades: number; maxFar: number; mapSize: number };
}

export interface LevelGround {
  /** dải đường chính dọc z: x ∈ [−halfWidth, halfWidth], z ∈ [z0, z1] */
  road: { halfWidth: number; z0: number; z1: number; texture: string };
  /** đường ngang (ngã tư) dọc x tại z, nửa rộng */
  crossRoads: Array<{ z: number; halfWidth: number; x0: number; x1: number }>;
  sidewalk: { width: number; height: number; texture: string };
  /** nền ngoài (bùn/đất) */
  fill: { texture: string; size: number };
  /** độ ướt còn lại sau bão 0..1 (vũng nước SSR) */
  wetness: number;
}

export interface LotDef {
  /** bên trái (−x) hay phải (+x) của phố */
  side: 'west' | 'east';
  z: number;
  width: number;
  floors: number;
  /** màu tường (hex) */
  color: number;
  /** biến thể texture tường */
  wall: 'plaster' | 'damaged' | 'peeling' | 'plastered' | 'brick';
  /** tầng trệt: cửa cuốn đóng / cửa hàng mở / đổ nát */
  ground: 'shutter' | 'shop' | 'ruin';
  sign?: string;
  signColor?: number;
  awning?: number;
  balcony: boolean;
  roof: 'flat' | 'tin' | 'tile';
  /** hư hại sau bão/giao tranh: 0 (nguyên) → 1 (cháy đen, đổ) */
  damage: number;
}

export interface PropDef {
  model: string;
  position: V3;
  yaw?: number;
  scale?: number;
  /** collider hộp (half extents) nếu chặn đường; không → chỉ hình */
  collider?: V3;
  /** cover marker quanh collider */
  cover?: boolean;
}

export interface BarricadeDef {
  kind: 'sandbags' | 'barrier' | 'wreck_car' | 'wreck_bus' | 'wreck_apc' | 'stall' | 'rubble' | 'tires' | 'sheet';
  position: V3;
  yaw?: number;
  length?: number;
  /** cháy: khói + lửa */
  burning?: boolean;
  color?: number;
}

export interface FxDef {
  kind: 'smoke' | 'fire' | 'embers' | 'dust';
  position: V3;
  scale?: number;
  /** khói: màu (đen/xám/trắng) */
  color?: number;
}

export interface LevelDef {
  id: string;
  name: string;
  size: [number, number];
  sky: LevelSky;
  textures: string[];
  models: string[];
  ground: LevelGround;
  /** dãy nhà ống hai bên (lot) */
  lots: LotDef[];
  /** dãy nhà dọc đường ngang (hệ ảo: z ảo = x thế giới − origin, west = phía nam) */
  crossLots?: Array<{ origin: [number, number]; yaw: number; lots: LotDef[] }>;
  /** hẻm/khoảng trống: z ∈ [z0,z1] bên side không có nhà */
  gaps: Array<{ side: 'west' | 'east'; z0: number; z1: number }>;
  /** tường bao phía sau dãy nhà (khối chặn) */
  bounds: { xWest: number; xEast: number; zNorth: number; zSouth: number };
  /** công trình mục tiêu (khối lớn) */
  landmarks: Array<{ id: string; position: V3; size: V3; color: number; sign?: string }>;
  props: PropDef[];
  barricades: BarricadeDef[];
  fx: FxDef[];
  waypoints: V3[];
  playerSpawn: V3;
  playerYaw: number;
  botSpawns: Record<string, V3>;
  zones: Record<string, { center: V3; radius: number }>;
  /** cover marker thủ công thêm (ngoài marker tự sinh quanh barricade/prop) */
  coverMarkers: Array<{ id: string; position: V3; facing: V3 }>;
  /** nhãn biển hiệu ngẫu nhiên khi lot không đặt sign */
  signPool: string[];
  palette: number[];
}
