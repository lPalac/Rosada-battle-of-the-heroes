# Data Model: Sandbox Physics and Shared Unit Squares

**Feature**: `002-sandbox-physics` | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

Changes to the 001 data model (`specs/001-standard-rules-game/data-model.md`). Everything not listed stays as it is. The game state stays JSON-serialisable; nothing from physics is stored in it.

---

## Square occupancy (derived, not stored)

| Rule | Source |
| --- | --- |
| 0…`maxUnitsPerSquare` units per square (2) | Spec FR-003, rules.json |
| All units on a square are of one side | Rulebook *General Unit Rules*; spec FR-004 |
| Nothing shares a King's square (units or heroes) | Rulebook *King's Majesty* |
| Hero figures on a square are not counted | Spec FR-003 (clarified) |

Accepted positions satisfy these. Sandbox may break them; the position check reports it.

## Unit (changed meaning of `pos` in sandbox)

| Field | Change |
| --- | --- |
| `pos` | In rules mode: always on the Battlefield. In sandbox: may be any square of the table area (x, y from −6 to 15); outside the 10×10 grid means "on the table, off the board" (research R-05). |

## Hero (changed meaning of `pos` in sandbox)

| Field | Change |
| --- | --- |
| `pos` | In sandbox may be off the 10×10 grid (on the table). Rules cannot resume until it is back on the grid. |

## LeadOption (rules core, not stored)

| Field | Change |
| --- | --- |
| `battleUnitId: string \| null` | Replaced by `battleUnitIds: string[]`: every enemy unit destroyed by the Lead (all units on the destination; for en passant the passed pawn). Empty when no Battle. |

`LeadAttempt.isBattle` is unchanged; the Destiny entries show how many units were lost.

## Battle Destiny (per successful Battle)

| Who | Gain |
| --- | --- |
| Leading side | +2 once (`destroyEnemy`), however many units are destroyed |
| Losing side | +1 per unit destroyed (`ownUnitLost`) |
| Losing side, per destroyed Queen | Revenge token (up to `revengeMax`) |

## PositionProblem codes

| Code | When | Message example |
| --- | --- | --- |
| `OPPOSING_UNITS_SHARE` | Units of both sides on one square | "Light and Dark units share d4 (L-P-d, D-N-g)" |
| `TOO_MANY_UNITS` | More than `maxUnitsPerSquare` on one square | "3 units on d4 (max 2)" |
| `KING_SHARES` | Anything else on a King's square | "Light King shares e1 (L-N-g)" |
| `UNIT_OFF_BATTLEFIELD` | A unit neither on the Battlefield nor in a Graveyard | "L-P-a is not on the Battlefield or in a Graveyard" |
| `HERO_OFF_BOARD` | A hero off the 10×10 grid | "H2 is not on the board" |
| (001, unchanged) | `KING_COUNT`, `UNPROMOTED_PAWN`, `BAD_HEALTH`, `NEGATIVE_POOL`, `REVENGE_COUNT` | |

`TWO_UNITS` is removed. Every problem names the square and the units involved (FR-011).

## Static data

| File | Change |
| --- | --- |
| `rules.json` | New tunable `maxUnitsPerSquare: 2` (schema: integer ≥ 1) |
| `strings.en.json` | Messages for the new problem codes and the sandbox physics help |

## Physical piece (presentation only, `src/physics/sandbox.ts`)

| Field | Notes |
| --- | --- |
| `kind` | `'unit' \| 'hero'` |
| `id` | Unit or hero id in the game state |
| `shape` | Collider shape by unit type or hero range type |
| `body` | Rapier rigid body; dynamic, or kinematic while carried |
| `lastSquare` | Destination last recorded for it: a square or `'graveyard'` |

Lifecycle:

```text
(sandbox on) ──create world──▶ resting
resting ──picked up──▶ carried (kinematic) ──released──▶ falling (dynamic, upright)
falling / knocked ──comes to rest──▶ resting ──square changed?──▶ sandboxPlace
(state changed elsewhere) ──square differs──▶ teleported upright ──▶ resting
(rules on) ──all asleep or 3 s──▶ last placements recorded ──▶ world removed
```

The pose (tilt, rotation, exact point) is never written to the game state or saves (spec A-04).
