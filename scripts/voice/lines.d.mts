export interface VoiceLine {
  key: string;
  group?: string;
  voice: string;
  lang: 'vi' | 'en';
  text: string;
  tag: string;
  takes: number;
  radio?: boolean;
}
export interface VoiceCast {
  model: string;
  outputFormat: string;
  defaults: Record<string, unknown>;
  voices: Record<string, { lang: string; voiceId: string; settings?: Record<string, unknown>; radio?: boolean }>;
}
export const SQUAD: string[];
export const BARK_CUES: string[];
export const SQUAD_CUES: string[];
export const ENEMY_VOICES: string[];
export function speakable(text: string): string;
export function fileOf(l: VoiceLine, take: number): string;
export function settingsOf(cast: VoiceCast, voice: string): Record<string, unknown>;
export function hashOf(cast: VoiceCast, l: VoiceLine, take: number): string;
export function buildLines(root: string): VoiceLine[];
