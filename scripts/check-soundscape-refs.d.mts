export interface SoundscapeRefStats {
  voices: number;
  numbers: number;
  quantitative: number;
  qualitative: number;
  designOnly: number;
  refs: number;
}
export function checkSoundscapeRefs(configPath?: string, claimsPath?: string): { errors: string[]; stats: SoundscapeRefStats };
