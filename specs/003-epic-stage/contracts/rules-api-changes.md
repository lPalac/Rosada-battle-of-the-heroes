# Contract changes: Rules Core API

**Feature**: `003-epic-stage` | Base: 001 `contracts/rules-api.md` + 002 `contracts/rules-api-changes.md`

## Actions (added)

```ts
| { type: 'becomeHeroUnit'; types: UnitType[] }   // Beginning of Turn (clarified), or End of Turn with Swift Change; Legendary Power ≥ 6
| { type: 'leaveHeroUnit' }                       // same times
| { type: 'kingsForces' }                         // Beginning of Turn; spends a King's Forces token
// decisions
| { type: 'decide'; decision: { type: 'destiny'; destiny: 'fanatic' | 'resolute' | 'dominant' } }
```

- `becomeHeroUnit.types`: `[own]`, `['rook']` (Advanced Warfare, ≥ 8), or `['rook', own]` (Final Form, ≥ 11). Errors: `POWER_LOCKED`, `HERO_UNIT_OCCUPIED`, `HERO_UNIT_OFF_BATTLEFIELD`, `HERO_UNIT_WOULD_CHECK`, `HERO_UNIT_IN_CHECK_PATH`, `WRONG_PHASE`.
- `kingsForces` errors: `NO_KINGS_FORCES`, `CREATE_WOULD_CHECK`, plus the Hero Unit restrictions.
- `announceLead` with a Hero Unit: range 2 / 4; modifier `heroUnit +4` when the Led unit is a Hero Unit; `RAMMED_BY_TARGET` when a Hero Unit would Lead itself into Battle with the unit that Rammed it last turn.

## Helpers (added, derived)

```ts
function destinyGeneration(state: GameState, side: Side): number;   // 0 in the Starting Stage
function isBloodied(state: GameState, heroId: HeroId): boolean;
function unlockedPowers(state: GameState, side: Side): PowerId[];
function heroUnitOptions(state: GameState, heroId: HeroId): UnitType[][]; // [] when not allowed now
```

`src/game/favor-model.ts` (engine-free) builds the tracker view from the state: per side, every Royal Favor with status, progress, requirement key, the track, unlocked Powers and the next threshold.

## Guarantees (added)

8. The Epic Stage starts exactly once, at the first `beforeTurn` after `well.depleted` became true, and only if the game did not end.
9. No side ever holds one Fanatic and one Dominant hero.
10. Each numbered Royal Favor completes at most once per side; `tides` at most 5 times; `track.length` never decreases.
11. A Hero Unit is always on the Battlefield and on a square with no other unit; its hero's `pos` equals the unit's `pos`.
12. Replaying the log rebuilds the same stage, choices, Royal Favors and Hero Units (001 guarantee 3a).
