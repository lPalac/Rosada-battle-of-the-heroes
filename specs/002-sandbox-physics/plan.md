# Implementation Plan: Sandbox Physics and Shared Unit Squares

**Branch**: `002-sandbox-physics` | **Date**: 2026-11-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-sandbox-physics/spec.md`

## Summary

Three changes on top of the 001 game:
- **Shared squares.** The rules core supports up to 2 friendly units on one square (a tunable). A Battle there destroys all of them: +2 D once for the Leading side, +1 D per unit for the loser. Leading onto a friendly unit stays forbidden, with an unused seam for later abilities. The position check accepts friendly sharing and reports opposing units on one square, too many units, anything on a King's square, and units that are neither on the Battlefield nor in a Graveyard.
- **Bigger board.** Squares grow by 25% so two units stand side by side on the square's diagonal, each clickable.
- **Physics in sandbox (001 T114).** A lazily created Rapier world makes units and hero figures physical. Picking up turns a piece into a kinematic body that pushes and topples others. When a piece comes to rest on a new square, the UI records an ordinary `sandboxPlace` action, so the rules core never sees physics. Turning rules on waits for rest (at most 3 s), stands pieces up and runs the check.

## Technical Context

**Language/Version**: TypeScript 7.x on Node.js 24 LTS; current desktop browsers (unchanged from 001)

**Primary Dependencies**: three 0.187.x, @dimforge/rapier3d-compat 0.21.x, Vite 8.x; dev: Vitest 5.x, @playwright/test 1.64.x, ajv 8, tsx. No new dependencies.

**Storage**: Unchanged. Save files hold the starting state + action log; physics poses are not saved (spec A-04).

**Testing**: Vitest for rules (`US2-AS*`, `US3-AS*`), physics in Node (Rapier, like 001's d20 test) and pure mapping functions; Playwright for dragging in sandbox, shared-square clicks, resume, and the frame-rate check (`gpu` project).

**Target Platform**: Desktop Chrome, Edge, Firefox (unchanged)

**Project Type**: Single-project web application (unchanged)

**Performance Goals**: ≥ 50 fps while knocking pieces around with all 36 pieces physical (spec SC-002); a dropped piece rests within 2 s (SC-001).

**Constraints**:
- The rules core and session stay engine-free; physics results enter only as `sandboxPlace` actions (constitution II, spec FR-028).
- No physics in rules mode (FR-027).
- Hero figures never count as units on a square (FR-003).

**Scale/Scope**: 3 user stories, 21 functional requirements. Touches `src/rules` (paths, lead, sandbox validation), `src/table` (size, layout, picking), `src/physics` (new sandbox world), `src/ui` (sandbox flow, resume, undo in sandbox).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
| --- | --- | --- |
| I. Rulebook is the source of truth | Friendly sharing from *General Unit Rules* ("Units of opposing colors may not occupy the same square"), King's Majesty, "2 D when you Destroy one or more enemy units in Battle". Max 2, Destiny per Battle, heroes not counted and off-board handling were decided by Luka in spec Clarifications. No invented rules | ✅ Pass |
| II. Engine-free rules core | Rules changes are pure TypeScript in `src/rules`; physics lives in `src/physics/sandbox.ts` and reaches the rules only through `sandboxPlace` actions with squares; `tests/boundaries.test.ts` keeps guarding | ✅ Pass |
| III. Data-driven content | `maxUnitsPerSquare` in `rules.json` with schema; collider shapes follow the placeholder art keys; new messages in `strings.en.json` | ✅ Pass |
| IV. Rules tested first | Every new acceptance scenario gets a test (rules headless; physics in Node with Rapier; drag and click in Playwright); rules changes start with failing tests | ✅ Pass |
| V. Verifiable without a human | Physics runs in Node for tests; Playwright drags with the mouse and takes screenshots; quickstart lists the manual check | ✅ Pass |
| VI. Keep it simple | No new dependency; one size constant; off-board pieces reuse `pos` instead of a new list; the friendly-end seam is an option only, used by no v1 rule | ✅ Pass |

**Technology constraint** "sandbox core (table, camera, physics, dice, save/load) stays separate from the Rošada game module": the physics world is a table-level module that knows pieces and squares, not Rošada rules. ✅

**Re-check after Phase 1 design**: ✅ Pass. The contracts keep physics outside `src/rules` and `src/game`; the data model adds no physics data to the game state. *Complexity Tracking* stays empty.

## Project Structure

### Documentation (this feature)

```text
specs/002-sandbox-physics/
├── spec.md               # Feature spec (with Clarifications)
├── plan.md               # This file
├── research.md           # Phase 0: R-01…R-09
├── data-model.md         # Phase 1: occupancy rules, changed fields, problem codes, physical piece
├── quickstart.md         # Phase 1: run, test, manual check
├── contracts/
│   ├── rules-api-changes.md   # Changes to the 001 rules API
│   └── sandbox-physics.md     # Table/UI ↔ physics world
├── checklists/requirements.md
└── tasks.md              # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
src/
├── rules/
│   ├── paths.ts          # unitsAt, battleUnitIds, friendly-end ban + allowFriendlyEnd seam
│   ├── check.ts          # unitsAfterLead with several destroyed units
│   ├── lead.ts           # Battle destroys all enemy units; Destiny once per Battle, +1 per unit lost
│   ├── ram.ts            # King-on-landing check over all units on the square
│   └── sandbox.ts        # validatePosition: new problem codes; sandboxPlace accepts table-area squares
├── data/
│   ├── rules.json        # maxUnitsPerSquare: 2
│   └── schemas/rules.schema.json
├── physics/
│   └── sandbox.ts        # NEW: sandbox world, piece colliders, carry, settle, restDestination, clampToRim
├── table/
│   ├── coords.ts         # SQUARE = 1.25; zones in squares
│   ├── board.ts          # board, zones and labels from SQUARE
│   ├── pieces.ts         # shared-square layout (diagonal), poses from physics in sandbox
│   ├── camera.ts         # home positions scaled
│   └── picking.ts        # carry gestures (pointer → carry plane)
├── ui/hud/sandbox-editors.ts  # Undo button in sandbox
└── main.ts               # sandbox world lifecycle, settle → sandboxPlace, resume waits for rest

tests/
├── rules/shared-squares.test.ts   # US2-AS*: Battle on two units, friendly-end ban, sharing rules
├── rules/sandbox.test.ts          # extended: new problem codes, US3 resume cases
├── physics/sandbox.test.ts        # US1-AS*: drop, carry/knock, upright landing, rim, sleep (Rapier in Node)
└── e2e/sandbox-physics.spec.ts    # drag a piece, two units clickable, resume flow, fps
```

**Structure Decision**: Same single web project as 001. The only new module is `src/physics/sandbox.ts`, next to the dice physics; everything else changes existing files.

## Build Order

| Phase | Scope | Stories | Done when |
| --- | --- | --- | --- |
| A | Rules: `unitsAt`, Battle on several units, Destiny per Battle, friendly-end ban + seam, new position check, table-area `sandboxPlace` | US2 (rules), US3 (check) | New rules tests pass; all 001 tests pass |
| B | Table: `SQUARE = 1.25`, zones, camera, two-unit layout, picking both units | US2 (table) | Screenshot shows two units side by side; click test passes |
| C | Physics sandbox world, carry/drop/knock, settle → `sandboxPlace`, state → physics sync, undo in sandbox | US1 | Physics tests in Node pass; drag test in browser passes |
| D | Resume flow: wait for rest, stand up, check; off-table pieces at the rim | US3 | Quickstart steps 5–6 pass; fps check ≥ 50 |

## Risks

| Risk | Mitigation |
| --- | --- |
| Pieces jitter or never sleep | Damping, low centre of mass, sleep thresholds tuned in the Node physics test; 3 s cap on waiting (FR-026) |
| Knocked pieces tunnel through the board or rim | CCD on piece bodies; thick static colliders; `clampToRim` as a last resort |
| Two units on a square are hard to tell apart | Diagonal offset + selection rings per unit; SC-004 click test |
| Changing `battleUnitId` breaks 001 code paths | Rules tests first; 001 suite (170 tests) must stay green |
| Physics and state drift apart after undo or editing | State is the truth: on any non-physics change, mismatched bodies are teleported upright to their state squares (research R-07) |

## Complexity Tracking

No constitution violations.
