// Save files: the starting state plus the action log (FR-200, FR-201). Replaying the log restores the game exactly,
// including what can still be undone; no seed is needed (FR-037). Storage itself lives in the UI layer.
import { STATE_VERSION } from '../rules/setup.ts';
import { DATA, type Action, type GameState } from '../rules/index.ts';
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
  if (typeof data.version !== 'number' || data.version < 1 || data.version > STATE_VERSION) {
    throw new Error(`Save file version ${data.version} is not supported`);
  }
  data.initial = migrateState(data.initial);
  data.version = STATE_VERSION;
  replay(data.initial, data.actions); // throws if the log does not replay
  return data as SaveFile;
}

function emptyRecord(): GameState['royalFavors']['light'] {
  const status = Object.fromEntries(DATA.favors.favors.map((f) => [f.id, { progress: 0, done: false }]));
  return { status, vanquishBloodied: [], tides: 0, tidesThisTurn: false, track: [], kingsForces: 0 } as unknown as GameState['royalFavors']['light'];
}

/** Fill fields added after a save was written (001/002 saves → 003), so old games play on (003 T008). */
export function migrateState(state: GameState): GameState {
  const s = JSON.parse(JSON.stringify(state)) as GameState;
  s.version = STATE_VERSION;
  s.stage ??= 'starting';
  s.epicPending ??= false;
  s.royalFavors ??= { light: emptyRecord(), dark: emptyRecord() };
  s.destiny.well.depletedBy ??= null;
  s.turn.heroUnitChanges ??= [];
  s.turn.kingsForcesUsed ??= false;
  for (const h of s.heroes) {
    const def = DATA.heroes.find((d) => d.id === h.definitionId);
    h.epic ??= null;
    h.heroUnitId ??= null;
    h.heroUnitType ??= def?.heroUnitType ?? (h.rangeType === 'short' ? 'knight' : 'bishop');
    if (typeof h.rammedBy === 'string') h.rammedBy = { unitId: h.rammedBy, turn: -1 };
  }
  return s;
}
