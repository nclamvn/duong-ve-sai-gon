/**
 * Gói phe (DV-061): engine chỉ có `friend` / `enemy`; súng, vải, trang bị của từng phe là dữ liệu
 * `content/factions/factions.json`. Chọn gói bằng `?factions=<id>` (mặc định theo file).
 */
import data from '@content/factions/factions.json';

export type FactionSide = 'friend' | 'enemy';
export type GearKind = 'pavn1971' | 'us1971' | 'faction_a' | 'faction_b';
export type SkinKind = 'recon' | 'erdl' | 'camo_b';

export interface FactionLook {
  weapon: string;
  gear?: GearKind;
  skin?: SkinKind;
}

interface SideDef extends FactionLook {
  archetypes?: Record<string, Partial<FactionLook>>;
}

interface PackFile {
  default: string;
  packs: Record<string, { friend: SideDef; enemy: SideDef }>;
}

const FILE = data as unknown as PackFile;

export function factionPackIds(): string[] {
  return Object.keys(FILE.packs);
}

export function resolvePackId(param: string | null, file: PackFile = FILE): string {
  return param && file.packs[param] ? param : file.default;
}

export function factionLook(packId: string, side: FactionSide, archetype?: string, file: PackFile = FILE): FactionLook {
  const pack = file.packs[packId] ?? file.packs[file.default]!;
  const def = pack[side];
  const over = archetype ? def.archetypes?.[archetype] : undefined;
  const out: FactionLook = { weapon: over?.weapon ?? def.weapon };
  const gear = over?.gear ?? def.gear;
  const skin = over?.skin ?? def.skin;
  if (gear) out.gear = gear;
  if (skin) out.skin = skin;
  return out;
}
