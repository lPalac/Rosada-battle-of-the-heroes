# Data Model: Standard Rules Game

> **Changed by 002**: up to `maxUnitsPerSquare` (2) friendly units may share a square; in sandbox a piece's `pos` may lie on the table beside the board. See [002 data-model.md](../../002-sandbox-physics/data-model.md).

**Feature**: `001-standard-rules-game` | **Date**: 2026-11-03 | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

All types live in `src/rules/model/` and are plain JSON-serialisable data (FR-121). Coordinates follow research R-05.

---

## Core types

```ts
type Side = 'light' | 'dark';
type Coord = { x: number; y: number };          // 0..9 each
type UnitType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';
type RangeType = 'short' | 'long';
type Phase =
  | 'beforeTurn' | 'beginningOfTurn' | 'beforeMove' | 'move'
  | 'beforeLead' | 'lead' | 'afterLead' | 'endOfTurn';
```

## GameState

| Field | Type | Notes |
| --- | --- | --- |
| `version` | number | State schema version, for saves |
| `setup` | SetupChoices | Mode, players, picks (fixed after start) |
| `status` | `'setup' \| 'playing' \| 'ended'` | |
| `enforcement` | `'rules' \| 'sandbox'` | FR-100…104 |
| `turnNumber` | number | Increments when the Active Hero passes |
| `activeHeroId` | HeroId | Holder of the Active Hero token |
| `phase` | Phase | Current phase of the active hero |
| `turn` | TurnFlags | Per-turn bookkeeping, reset at `beforeTurn` |
| `units` | Unit[] | On the Battlefield |
| `graveyard` | Unit[] | Destroyed Main units, in order |
| `heroes` | Hero[4] | Ordered by `turnOrder` |
| `destiny` | DestinyLedger | |
| `tokens` | Tokens | Peace/War, Revenge |
| `pendingDecision` | PendingDecision \| null | Blocks all other actions |
| `decisionQueue` | PendingDecision[] | Decisions waiting behind `pendingDecision` |
| `sandboxMoved` | unitId[] | Units moved by hand in sandbox; set `hasBeenLed` on resume (FR-104) |
| `result` | GameResult \| null | Set when `status = 'ended'` |
| `log` | LogEntry[] | Every action, roll, Destiny change (FR-112). Roll values are stored here; no seed is kept (FR-037) |

**Validation**: at most one unit per square; units only on the Battlefield; nothing shares the King's square; exactly one King per side while playing. The same checks back FR-103 when leaving sandbox.

## SetupChoices

| Field | Type | Notes |
| --- | --- | --- |
| `mode` | `'draft' \| 'mirror'` | FR-081 |
| `playerCount` | 2 \| 3 \| 4 | FR-080 |
| `players` | `{ id, name, side, heroIds[] }[]` | With 3 players the single player on a side holds both heroIds |
| `picks` | `{ side, rangeType, pickIndex }[4]` | In pick order (Draft: L, D, D, L; Mirror: Light's pick fills hero 1 of both sides, Dark's pick hero 2) (FR-081) |
| `turnOrder` | `{ light: [pickIndex, pickIndex], dark: [pickIndex, pickIndex] }` | Chosen by each side, Light first: first entry plays turn 1 (Light) / 2 (Dark), second turn 3 / 4 (FR-082) |
| `startFiles` | `{ [pickIndex]: 'c' \| 'f' }` | Chosen by each side; one hero per Bishop file (FR-083) |

## Unit

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Stable, e.g. `L-N-b` (Light Knight from b-file) |
| `side` | Side | |
| `type` | UnitType | Current type |
| `originalType` | UnitType | For future Modify; equals `type` in v1 except after Promotion |
| `kind` | `'main' \| 'auxiliary'` | Always `main` in v1 |
| `pos` | Coord | |
| `hasBeenLed` | boolean | Castling rights; set true by sandbox moves (FR-104) |
| `promoted` | boolean | |
| `enPassantTarget` | Coord \| null | Set for one turn after a 2-square pawn Lead from its starting square |

## Hero

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `'H1' \| 'H2' \| 'H3' \| 'H4'` | Equals turn order |
| `side` | Side | |
| `turnOrder` | 1…4 | Light 1 & 3, Dark 2 & 4 |
| `playerId` | string | Controlling player |
| `definitionId` | string | Key into `heroes.json` (`generic-short`, `generic-long`) |
| `rangeType` | RangeType | From definition |
| `movement` / `range` | number | Base values from definition |
| `maxHealth` / `health` | number | 10/8 starting; 0…max |
| `healthBarId` | string | Key into `healthbars.json` |
| `pos` | Coord | Anywhere on the 10×10 grid |
| `startSquare` | Coord | FR-025 / FR-083 |
| `pool` | number | Hero Destiny Pool, starts at 3 |
| `status` | HeroStatus | See below |
| `rammedBy` | unitId \| null | Recorded for later Hero Unit rule (v1: no effect) |

**HeroStatus**: `{ unconscious: boolean; skipNextTurn: boolean; recoverAtBeginningOfTurn: boolean; movementPenaltyNextTurn: number }`. Movement for a turn = base − penalties, never reduced by more than 2.

### Hero life cycle

```text
active ──health hits 0──▶ unconscious (placed in friendly tavern, skipNextTurn)
unconscious ──its next turn──▶ turn skipped (recoverAtBeginningOfTurn = true)
skipped ──following turn, Beginning of Turn──▶ active, health = floor(max/2)
```

## TurnFlags (reset each turn)

| Field | Notes |
| --- | --- |
| `movementLeft` | Set at `beginningOfTurn` (tavern −1, Banishment −1, cap −2) |
| `movePath` | Squares moved through this turn |
| `tavernShopOpen` | Tavern square where buying is allowed now, or null; closes when the hero leaves it (FR-060) |
| `leftTaverns` | Taverns the hero has left this turn (no buying there again) |
| `bothKingsInCheckAtBeginning` | For the draw check at End of Turn |
| `doubleStepUnitId` | Pawn that made a 2-square Lead this turn; keeps its en passant target one more turn |
| `leadAttempted` / `leadPossible` | Drive FR-031, FR-042 |
| `kingInCheckAfterLead` | Blocks After Lead / End of Turn abilities and free Meal |
| `checkBonusClaimed` | 2 D for checking, once per turn |
| `abilitiesUsed` | Set of general abilities used (`inspiredLead`, `heroRetreat`) |
| `inspiredLeadBonus` | +2 per D spent, used by this turn's Lead only; lost if no Lead is made (reset at `beforeTurn`) |
| `lead` | LeadAttempt \| null |

## LeadAttempt

| Field | Notes |
| --- | --- |
| `unitId`, `from`, `to`, `path` | `path` = interacted squares (Knight: from + to only) |
| `isBattle` | Enemy unit on `to` |
| `isCastling`, `isEnPassant` | |
| `needsRoll` | false for King, Peace side up, Revenge used, or when the Lead cannot fail (1 + modifiers ≥ 6, spec Q-24) |
| `usedRevenge` | |
| `roll` | 1…20 \| null |
| `modifiers` | `{ source: 'war' \| 'check' \| 'inspiredLead', value }[]` |
| `total`, `success` | success = total ≥ 6 (or no roll needed) |
| `rams` | `{ heroId, landing: Coord, sentToStart: boolean, wounds: 3 }[]` |

### Lead flow

```text
chooseUnit → announce(to) ──needsRoll──▶ awaitingRoll ──submitRoll(n)──▶ resolve
                         └─no roll──────────────────────────────────────▶ resolve
resolve: success → move unit, Battle/Destroy, Rams, Promotion (pendingDecision), Destiny
         failure → unit stays, +1 D to Common Pool
```

## DestinyLedger

| Field | Notes |
| --- | --- |
| `well` | `{ initialRemaining: 16, depleted: false }` (R-09) |
| `common` | `{ light: number, dark: number }` |
| `entries` | `{ turn, side, heroId?, delta, pool: 'common' \| 'hero' \| 'well', reason }[]` for SC-003 comparisons |

Gains (to the Common Pool unless noted): check +2 (once per turn), Destroy in Battle +2 to the destroyer, +1 per own unit lost to the loser, +1 per enemy hero wounded, +1 on a failed Lead, Resilient Destiny to the wounded hero's own pool. Spending may combine hero pool and Common Pool (`pendingDecision: payDestiny` when both are needed).

## Tokens

| Field | Notes |
| --- | --- |
| `peaceTreaty` | `'peace' \| 'war'`; flips once to `war` on the first Destiny gain |
| `revenge` | `{ light: 0..2, dark: 0..2 }` |

## PendingDecision (union)

`promotion { unitId, chooserHeroId }` · `unconsciousTavern { heroId, options: Coord[] }` · `advanceSquare { heroId, options: Coord[] }` · `drawOffer { fromSide }`. Several decisions from one Lead (two heroes Unconscious, then Promotion, then the advance) wait in `GameState.decisionQueue` in that order.

The Inspired Lead amount, the pool split and the Revenge choice are not decisions: they are fields of the action (`inspiredLead.destiny`, `pay`) or an action of their own (`useRevenge` while the roll is awaited).

## GameResult

`{ kind: 'win', winner: Side, by: 'checkmate' | 'kingDestroyed' } | { kind: 'draw', by: 'bothKingsInCheck' | 'noEligibleUnits' | 'agreed' }` plus summary `{ turnsPlayed, destroyed: { light, dark } }` (FR-090).

## LogEntry

`{ turn, heroId, phase, type, data }`: one entry per action (`type: 'action'`, the action in `data`) and one per event (`type` = the event type, the event in `data`). Text is made from the string file when shown (`src/game/log.ts`, A-02), so the log stays data.

---

## Static data files (`src/data/`)

| File | Contents |
| --- | --- |
| `board.json` | Grid size, region map, taverns with owner side, starting squares per side |
| `units.json` | Unit types, starting squares per side, path definitions (direction sets, max steps, jump flag) |
| `heroes.json` | `generic-short` (Move 5, Range 1, max 10, bar `bar-20`), `generic-long` (Move 3, Range 3, max 8, bar `bar-16`); fields for later: `epicMaxHealth`, `abilities: []`, `art` |
| `healthbars.json` | `bar-16`: red 1–8, points [1,2,4,6,8,9,11,14]; `bar-20`: red 1–10, points [1,2,4,6,8,10,11,13,15,18] |
| `rules.json` | Tunables: lead target 6, war +2, check +4, inspired +2/D, ram wounds 3, drink/meal costs and heals, revenge max 2, well 16, hero pool start 3 |
| `assets.json` | Visual keys → placeholder shape, glTF or image (R-12) |
| `strings.en.json` | UI text (A-02) |

JSON Schemas for these files are in [contracts/data-files.md](./contracts/data-files.md).
