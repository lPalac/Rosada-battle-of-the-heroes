# Data Model: Epic Stage, Destiny Generation, Royal Favors and Legendary Powers

**Feature**: `003-epic-stage` | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

Changes to the 001/002 data model. Everything stays JSON-serialisable (001 FR-121).

---

## GameState (added fields)

| Field | Type | Notes |
| --- | --- | --- |
| `stage` | `'starting' \| 'epic'` | R-01 |
| `epicPending` | boolean | Set when the initial 16 run out; the Epic Stage starts at the next `beforeTurn` |
| `royalFavors` | `Record<Side, RoyalFavorRecord>` | R-05 |

`destiny.well` gains `depletedBy: HeroId \| null`. `tokens.peaceTreaty` becomes `'peace' \| 'war' \| 'removed'`.

## Hero (added fields)

| Field | Type | Notes |
| --- | --- | --- |
| `epic` | `{ destiny: 'fanatic' \| 'resolute' \| 'dominant' } \| null` | Chosen at the Epic Stage |
| `heroUnitId` | `string \| null` | The unit this hero is while a Hero Unit |
| `heroUnitType` | `UnitType` | From `heroes.json`: `generic-short` → `knight`, `generic-long` → `bishop` |
| `rammedBy` | `{ unitId: string; turn: number } \| null` | Was `unitId \| null`; the turn is needed for "on the last turn" |

Derived (not stored): `isBloodied(hero)` = Epic Stage and `health ≤ startingMax` of its bar; `destinyGeneration(state, side)` (research R-04).

## Unit (changed)

| Field | Change |
| --- | --- |
| `kind` | `'main' \| 'auxiliary' \| 'hero'` (`'hero'` = a Hero Unit, id `HU-<heroId>`) |
| `extraTypes` | `UnitType[]`, optional: more path types at once (*Final Form*: Rook + own type) |
| `heroId` | `HeroId`, only for `kind: 'hero'` |

Rules: auxiliary pawns never promote; destroyed auxiliary and hero units leave play (never in the Graveyard); a destroyed hero unit gives its hero 3 wounds and sends it to its starting square.

## RoyalFavorRecord (per side)

| Field | Type | Notes |
| --- | --- | --- |
| `status` | `Record<FavorId, { progress: number; done: boolean }>` | `progress` for half/count kinds |
| `vanquishBloodied` | `HeroId[]` | Different enemy heroes brought to Bloodied |
| `tides` | number | 0…5 |
| `tidesThisTurn` | boolean | Reset at each `beforeTurn` |
| `track` | `FavorId[]` | Completion order, incl. `tides` entries and `manifest` |
| `kingsForces` | number | Unspent King's Forces tokens |

Powers unlocked = thresholds ≤ `track.length` (6 Hero Unit, 7 King's Forces, 8 Advanced Warfare, 9 Far Reach, 10 Swift Change, 11 Final Form).

## PendingDecision (added)

`epicDestiny { heroId, options: ('fanatic' | 'resolute' | 'dominant')[] }`. Answer: `{ type: 'destiny', destiny }`.

## Static data

| File | Change |
| --- | --- |
| `royal-favors.json` (new) | `favors: { id, order, kind: 'once' \| 'half' \| 'count', target, repeat? }[]` (10 numbered + `tides` with `repeat: 5` + `manifest`); `powers: { id, threshold }[]` |
| `heroes.json` | `heroUnitType` per hero (`knight`, `bishop`); `portrait` and `epicArt` asset keys |
| `rules.json` | `heroUnit: { range: 2, farReachRange: 4, selfLeadBonus: 4, destroyedWounds: 3 }`; `generation: { base: 1 }`; `favors: { destinedForGreatness: 20, greatIncursionUnits: 3, greatIncursionRanks: 4, deployTroopsMax: 3, decimate: 7, offenseAttackers: 3, royalsFury: 3 }` |
| `assets.json` | New keys: `table.top`, `room.floor`, `board.border`, `strip.graveyard`, `sheet.hero`, `track.favors`, `medallion`, `portrait.short`, `portrait.long`, `epic.short.<destiny>`, `epic.long.<destiny>` (image + column for the 3-panel epic art), `marker.auxiliary` |
| `strings.en.json` | Royal Favor names and requirements, Power names, destiny names, tracker labels, new errors |

## Log and events (added)

`epicStageStarted`, `destinyChosen { heroId, destiny }`, `favorProgress { side, id, progress }`, `favorCompleted { side, id, slot }`, `powerUnlocked { side, power }`, `heroUnitChanged { heroId, on, types }`, `unitCreated { unitId, type, kind, at }`, `destinyGeneration { heroId, amount }` (as a `destinyChanged` reason).
