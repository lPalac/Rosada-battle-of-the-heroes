// Browser save slot and file download/upload for save files (FR-200, FR-201).
import { parseSaveFile, toSaveFile, type SaveFile } from '../game/save.ts';
import type { Action, GameState } from '../rules/index.ts';

const KEY = 'rosada.save.v1';

export function saveLocal(initial: GameState, actions: readonly Action[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(toSaveFile(initial, actions)));
  } catch {
    // Storage full or blocked: saving is a convenience, the game goes on.
  }
}

export function loadLocal(): SaveFile | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? parseSaveFile(raw) : null;
  } catch {
    return null;
  }
}

export function clearLocal(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function downloadText(filename: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportFile(initial: GameState, actions: readonly Action[]): void {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  downloadText(`rosada-${stamp}.json`, JSON.stringify(toSaveFile(initial, actions), null, 1));
}

export async function readSaveFile(file: File): Promise<SaveFile> {
  return parseSaveFile(await file.text());
}
