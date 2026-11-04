# Contract changes: Rules Core API

**Feature**: `002-sandbox-physics` | Base: `specs/001-standard-rules-game/contracts/rules-api.md`

Only the changes. Everything else in the 001 contract stays.

## Actions

```ts
// sandbox only — `to` may now be any square of the table area (x, y in −6…15), not just the 10×10 grid.
| { type: 'sandboxPlace'; target: { unitId?: string; heroId?: string }; to: Coord | 'graveyard' }
```

- Rejected with `BAD_SQUARE` outside the table area.
- A hero cannot go to `'graveyard'` (unchanged).
- Placing onto a square already holding units is allowed in sandbox, whatever their side (the position check reports it).

## Lead legality (unchanged rule, now explicit)

- A unit is never Led onto a square holding a friendly unit. `legalLeadTargets` never lists such a square and `announceLead` rejects it.
- Seam for later abilities (not used in this feature): path generation takes an optional `{ allowFriendlyEnd?: (unit: Unit, square: Coord) => boolean }`. When absent, friendly-occupied end squares are excluded as before.

## Battle

- `legalLeadTargets(...)[i].isBattle` is true when the destination holds any enemy unit.
- A successful Battle destroys **every** enemy unit on the destination (en passant: the passed pawn). Events: one `unitDestroyed` per unit, then Destiny: `destroyEnemy` +2 once to the Leading side, `ownUnitLost` +1 per unit to the losing side, `tokenChanged` (Revenge) per destroyed Queen up to the limit.

## validatePosition

Returns the problems in [data-model.md](../data-model.md) *PositionProblem codes*. `TWO_UNITS` is gone; `OPPOSING_UNITS_SHARE` and `TOO_MANY_UNITS` are new. Friendly non-King units sharing a square up to `maxUnitsPerSquare` are accepted. Heroes do not count as units.

## Guarantees (added)

6. In rules mode, after any `apply`, no square holds units of both sides, more than `maxUnitsPerSquare` units, or anything besides the King on a King's square (the active hero passing over a King during its Move excepted, as in 001 guarantee 1).
7. `sandboxPlace` actions recorded from physics replay exactly like hand placements: re-applying the log rebuilds the same state (001 guarantee 3a).
