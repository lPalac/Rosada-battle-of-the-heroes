// Save files: the starting state plus the action log (FR-200, FR-201). Replaying the log restores the game exactly,
// including what can still be undone; no seed is needed (FR-037). Storage itself lives in the UI layer.
import { STATE_VERSION } from '../rules/setup.ts';
import type { Action, GameState } from '../rules/index.ts';
import { replay } from './session.ts';

export interface SaveFile {
  format: 'rosada-save';
  version: number;
  savedAt: string;
  initial: GameState;
  actions: Action[];
}

export function toSaveFile(initial: GameState, actions: readonly Action[], now = new Date()): SaveFile {
  return { format: 'rosada-save', version: STATE_VERSION, savedAt: now.toISOString(), initial, actions: [...actions] };
}

export function parseSaveFile(text: string): SaveFile {
  const data = JSON.parse(text) as Partial<SaveFile>;
  if (data.format !== 'rosada-save' || !data.initial || !Array.isArray(data.actions)) throw new Error('Not a Rošada save file');
  if (data.version !== STATE_VERSION) throw new Error(`Save file version ${data.version} is not supported`);
  replay(data.initial, data.actions); // throws if the log does not replay
  return data as SaveFile;
}
