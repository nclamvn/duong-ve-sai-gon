/**
 * Localization — nguồn chuỗi duy nhất cho UI/phụ đề (PRD UX-002).
 * Mọi chuỗi hiển thị phải đi qua t(key). Key thiếu → trả về chính key trong ngoặc để lộ lỗi khi test.
 */
import vi from '@content/locale/vi.json';

type Dict = Record<string, string>;
const dict: Dict = vi as Dict;

export function t(key: string, vars?: Record<string, string | number>): string {
  let s = dict[key];
  if (s === undefined) return `[${key}]`;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export function hasKey(key: string): boolean {
  return key in dict;
}

export const localeKeys = (): string[] => Object.keys(dict);
