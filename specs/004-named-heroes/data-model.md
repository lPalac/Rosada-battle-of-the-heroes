# Data Model: Named Heroes, Epic Forms and the Tabletop Simulator Look

**Feature**: `004-named-heroes` | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

Changes to the 001–003 data model. Everything stays JSON-serialisable (001 FR-121).

---

## Static data

### `heroes.json` (extended)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | `cavalier`, `monk`, `scout`, `magus` (generic `generic-short` / `generic-long` kept) |
| `name` | string key | `hero.cavalier.name` |
| `rangeType`, `movement`, `range`, `maxHealth`, `epicMaxHealth`, `healthBar`, `heroUnitType` | as 003 | Scout `heroUnitType: knight`, Monk `bishop` |
| `selectable` | boolean | `false` for the generic heroes (Q-42) |
| `art` | `{ figure, portrait, sheet }` asset keys | |
| `abilities` | ability ids | Starting Hero abilities |
| `forms` | `Record<'fanatic' \| 'resolute' \| 'dominant', Form>` | |

`Form`: `{ id, name, art: { portrait, sheet }, abilities: string[], stats?: { movement?: number } }` (Dragon Lord: `movement: 6`).

### `abilities.json` (new) – see [contracts/abilities-data.md](./contracts/abilities-data.md)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Unique, e.g. `deathKnight.auraOfFear` |
| `kind` | `'passive' \| 'action' \| 'reaction'` | Passive = Always Active |
| `timings` | `Timing[]` | `beginningOfTurn`, `beforeMove`, `duringMove`, `beforeLead`, `insteadOfLead`, `duringLead`, `afterLead`, `endOfTurn`, `beforeTurn`, `duringEnemyLead`, `beginningOfEpicStage` |
| `cost` | `{ normal: number, bloodied: number }` \| null | Epic abilities |
| `uses` | number \| null | Starting Hero abilities (per game) |
| `oncePerTurn` | boolean | default true for actions |
| `flags` | `notAsHeroUnit`, `notRoyalty`, `mustNotCheck`, `noRoll` | From the sheet icons |
| `values` | `Record<string, number \| [number, number]>` | `[normal, bloodied]` pairs for "a/b" in the text |
| `options` | string[] | For "OR" abilities (`bombardment.wound` / `bombardment.destroyAux`) |
| `icons` | Symbol Legend keys | HUD icons |
| `sheet` | `{ printedCost?: [number, number] }` | What the TTS sheet prints, for the corrected badge (research R-11) |

## GameState (added fields)

| Field | Type | Notes |
| --- | --- | --- |
| `effects` | `Effect[]` | Research R-04 |
| `abilityState` | `Record<HeroId, { uses: Record<abilityId, number>; usedThisTurn: string[]; usedThisPhase: string[] }>` | |
| `nextEffectId` | number | Stable ids for replay |

## Hero (changed)

| Field | Change |
| --- | --- |
| `definitionId` | Named hero id |
| `form` | `string \| null`: Epic form id, set with `epic.destiny` (003) |
| `movement` | From the form's stats when set |

## Unit (added)

| Field | Type | Notes |
| --- | --- | --- |
| `tags` | `('undead' \| 'legendaryAncient' \| 'demon' \| 'spy' \| 'clone')[]` | Optional |
| `health` | number | Legendary Ancient only (5) |
| `modifiedFrom` | UnitType \| null | A temporary Modify (Inquisition); `originalType` stays for Promotion |

## Effect

| Field | Type | Notes |
| --- | --- | --- |
| `id` | number | |
| `kind` | string | `cannotLead`, `cannotBattle`, `protected`, `protectedInBattle`, `leadModifier`, `token`, `modify`, `killOrder`, `divineProtector`, `paragon`, `demoralise`, `sacrifice`, `converge`, `badOmen`, `darkPact`, `dreamOfIllFate` … |
| `source` | `{ abilityId, heroId }` | |
| `target` | `{ unitId } \| { heroId } \| { square } \| { area: Coord[] } \| { side } \| { unitType }` | |
| `expires` | `{ at, heroId?, count? }` | `at`: `startOfTurn`, `endOfTurn`, `epicStage`, `removed`; `count` = turns to wait |
| `data` | object | Kind-specific (penalty value, portal pair, brewing step …) |

Rules:
- A target that is Destroyed, Promoted or leaves play drops its effects.
- `token` effects with a square show on the table.

## PendingDecision (added)

- `reaction { heroId, abilityId, at: 'announce' | 'battle' | 'destroy', context }`. Answer: `{ type: 'reaction', use: boolean, pay?, targets? }`.
- `abilityChoice { heroId, abilityId, choices }` for multi-step targets (Converge: keep which copy; Dream of Ill Fate: unit type).

## Log and events (added)

- `abilityUsed { heroId, abilityId, targets, cost }` (001 event, extended).
- `effectAdded { effect }`, `effectRemoved { id, reason }`.
- `unitModified { unitId, from, to }`, `unitPushed { unitId, from, to }`.
- `heroDamaged` and `heroHealed`: existing events, new `reason` values.
