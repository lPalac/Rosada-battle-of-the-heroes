// UI text lookup (A-02). English now; a `strings.hr.json` can be added later with the same keys.
import en from '../data/strings.en.json';

type Strings = Record<string, string>;
const tables: Record<string, Strings> = { en: en as Strings };
let current: Strings = tables.en;

export function setLanguage(lang: string): void {
  current = tables[lang] ?? tables.en;
}

export function hasString(key: string): boolean {
  return key in current;
}

/** `t('hud.turn', { n: 3 })` → "Turn 3". Unknown keys fall back to the key itself. */
export function t(key: string, params: Record<string, string | number> = {}): string {
  const raw = current[key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

export const STRING_KEYS = (): string[] => Object.keys(current);
