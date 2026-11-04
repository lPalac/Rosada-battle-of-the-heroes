// Hero art for the DOM (destiny dialog, tracker): portraits and Epic forms from assets.json (003 FR-007, FR-041).
import assetsJson from '../data/assets.json';
import { DATA, EPIC_DESTINIES, type EpicDestiny, type Hero } from '../rules/index.ts';

interface ImageEntry {
  image?: string;
  columns?: number;
}

const ASSETS = assetsJson as unknown as Record<string, ImageEntry>;

export function imageUrl(key: string): string | null {
  const img = ASSETS[key]?.image;
  return img ? encodeURI(`${import.meta.env.BASE_URL ?? '/'}${img}`) : null;
}

/** CSS for one column of a multi-panel image: Epic art holds Fanatic, Resolute, Dominant left to right (spec Q-36). */
export function epicArtStyle(key: string, destiny: EpicDestiny): string {
  const url = imageUrl(key);
  if (!url) return '';
  const cols = ASSETS[key]?.columns ?? 1;
  const i = Math.max(0, EPIC_DESTINIES.indexOf(destiny));
  const x = cols > 1 ? (i / (cols - 1)) * 100 : 50;
  return `background-image:url("${url}");background-size:${cols * 100}% auto;background-position:${x}% 20%`;
}

export function heroArtKeys(h: Pick<Hero, 'definitionId'>): { portrait: string; epic: string } {
  const def = DATA.heroes.find((d) => d.id === h.definitionId);
  return { portrait: def?.portrait ?? 'portrait.short', epic: def?.epicArt ?? 'epic.short' };
}
