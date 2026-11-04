---

description: "Task list for 002-sandbox-physics"
---

# Tasks: Sandbox Physics and Shared Unit Squares

**Input**: Design documents from `/specs/002-sandbox-physics/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/rules-api-changes.md, contracts/sandbox-physics.md, quickstart.md

**Tests**: Required. Constitution IV and spec FR-031: every acceptance scenario has an automated test named `US<story>-AS<scenario>` (rules headless in Vitest; physics in Vitest with Rapier in Node; dragging and clicking in Playwright). Write each story's tests first and see them fail.

**Organization**: By user story. Story phases follow the plan's build order: US2 (shared squares, P1) first because the rules and the bigger board are what the physics lands pieces on; then US1 (physics, P1); then US3 (resume, P2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story from spec.md (US1…US3)
- Paths are from the repository root (single project, see plan.md *Project Structure*)

## Ground rules for every task

- `src/rules/` and `src/game/` stay engine-free (no `three`, `@dimforge/*`, DOM, `src/table|physics|ui`). Physics reaches the rules only as `sandboxPlace` actions with squares (spec FR-028, constitution II).
- Tunables live in `src/data/rules.json`; new UI text in `src/data/strings.en.json` (constitution III, A-02).
- All 001 tests (`npm test`, `npm run test:e2e`) must stay green after every phase.
- Rules come from the corrections file and spec Clarifications. A new unclear case goes into the 002 spec's Assumptions or a new Open Question, never into code silently (constitution I).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: The one new tunable and its schema

- [X] T001 Add `"maxUnitsPerSquare": 2` to src/data/rules.json, add it to `RulesData` in src/rules/data.ts, and to src/data/schemas/rules.schema.json as `{ "type": "integer", "minimum": 1 }` in `required`; run `npm run check:data`
- [X] T002 [P] Add strings to src/data/strings.en.json: `sandbox.physicsHelp` ("Drag a piece to pick it up; release to drop it. Pieces can knock each other over."), `sandbox.settling` ("Waiting for pieces to come to rest…"), `action.undoSandbox` ("Undo")

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Multi-unit squares in the rules core helpers, used by every story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Add `unitsAt(state, p): Unit[]` to src/rules/paths.ts next to `unitAt` (keep `unitAt` returning the first unit, for "is occupied"); export it from src/rules/index.ts
- [X] T004 Replace `LeadOption.battleUnitId: string | null` with `battleUnitIds: string[]` in src/rules/paths.ts ("every enemy unit destroyed by the Lead (all units on the destination; for en passant the passed pawn). Empty when no Battle", data-model.md *LeadOption*); `isBattle` = `battleUnitIds.length > 0`. Update every user: src/rules/check.ts (`unitsAfterLead` filters all ids; the "destroying the enemy King" exception checks any id), src/rules/lead.ts, tests/rules/paths.test.ts, tests/rules/check.test.ts. All 001 tests must pass unchanged in behaviour
- [X] T005 Use `unitsAt` in src/rules/ram.ts `resolveLanding` so a King anywhere on the landing square sends the hero to its starting square

**Checkpoint**: `npm test` green; no behaviour change yet

---

## Phase 3: User Story 2 – Two friendly units on one square (Priority: P1) 🎯 MVP

**Goal**: Up to 2 friendly units share a square, the board is 25% bigger and shows both side by side, Battles destroy all enemy units on a square, and the position check follows the rulebook

**Independent Test**: In sandbox put two Light pawns on one square, resume, check both are visible and selectable, and that a Dark unit Leading into that square destroys both (spec US2)

### Tests for User Story 2 (write first, must fail) ⚠️

- [X] T006 [P] [US2] Write tests/rules/shared-squares.test.ts with fixtures built in sandbox (`setEnforcement('sandbox')` → `sandboxPlace` → `setEnforcement('rules')`, since `board()` puts one unit per square): `US2-AS2` (two Light pawns on d3 → resume accepted, no problem), `US2-AS3` (Light pawn + Dark pawn on d3 → `OPPOSING_UNITS_SHARE` listed, stays in sandbox), `US2-AS4` (a Knight on the Light King's square → `KING_SHARES`), `US2-AS5` (three Light pawns on d3 → `TOO_MANY_UNITS` "3 units on d3 (max 2)"), `US2-AS6` (a Light Rook with a Light pawn ahead: the pawn's square is never in `legalLeadTargets`, and `announceLead` onto it is rejected), `US2-AS7` (two Dark pawns on d5, Light Rook d1 → d5 at War with a winning roll: both in the Graveyard, two `unitDestroyed` events, Light +2 D once, Dark +2 D (1 per pawn), Revenge when one of them is the Dark Queen), `US2-AS8` (two Light units on d3: each has its own `legalLeadTargets`; a Dark Bishop's path stops at d3; both threaten), `US2-AS10` (two Light pawns and a hero figure on d3 → accepted: heroes do not count)
- [X] T007 [US2] Add to tests/rules/shared-squares.test.ts (after T006) a case for the seam: `basicLeads(state, unit, { allowFriendlyEnd: () => true })` offers a friendly-occupied end square, and the default call does not (contracts/rules-api-changes.md *Lead legality*)
- [X] T008 [P] [US2] Update tests/rules/sandbox.test.ts for the new codes: `US6-AS6` from 001 now expects `KING_SHARES` and `REVENGE_COUNT` (no `TWO_UNITS`); messages name the square and units, e.g. "Light King shares e1 (L-N@b1)" (FR-011)
- [X] T009 [P] [US2] Write tests/e2e/shared-squares.spec.ts: `US2-AS1` (the square size is ≥ 1.2× 001's: `screenOf('a1')` to `screenOf('b1')` distance at the default camera compared with a stored 001 value, plus a screenshot), `US2-AS9` (two Light pawns placed on d3 in sandbox, resume, Lead phase: clicking each pawn's own screen point selects that pawn; needs a new hook `window.__rosada.unitScreenOf(id)`)

### Implementation for User Story 2

- [X] T010 [US2] In src/rules/paths.ts exclude friendly-occupied end squares using `unitsAt` (any friendly unit there), add the optional `opts: { allowFriendlyEnd?: (unit: Unit, square: Coord) => boolean }` parameter to `basicLeads` (default none) and pass it through `legalLeadsForUnit` in src/rules/check.ts; Battle targets = every enemy unit on the destination (FR-005, FR-007)
- [X] T011 [US2] In src/rules/lead.ts `resolve`: destroy every unit in `battleUnitIds` (each to the Graveyard, one `unitDestroyed` each); then Destiny once per Battle: `gain(side, destroyEnemy)` once, `gain(loserSide, ownUnitLost)` once per destroyed unit, `gainRevenge` per destroyed Queen; King among them → `kingDestroyed` win (FR-006)
- [X] T012 [US2] In src/rules/sandbox.ts `validatePosition`: remove `TWO_UNITS`; add `OPPOSING_UNITS_SHARE` (units of both sides on one square), `TOO_MANY_UNITS` (more than `RULES.maxUnitsPerSquare`); keep `KING_SHARES` for any other unit or any hero on a King's square; count only units, never heroes; every message names the square and unit ids (data-model.md *PositionProblem codes*, FR-010, FR-011)
- [X] T013 [US2] Make T006–T008 pass; extend tests/rules/contract.test.ts with guarantee 6 (in rules mode no square holds both sides, more than `maxUnitsPerSquare` units, or anything besides the King on a King's square, Move transit excepted)
- [X] T014 [US2] Enlarge the board in src/table/coords.ts: `SQUARE = 1.25`; express `ZONES` in squares (multiply 001 positions by `SQUARE`); in src/physics/world.ts scale `TRAY.center` the same way; in src/table/board.ts size square meshes `0.98 * SQUARE`, labels and zones from `SQUARE` (FR-001, research R-01)
- [X] T015 [US2] Scale the camera in src/table/camera.ts: home positions and `minDistance`/`maxDistance` × `SQUARE`; check the default view still shows the board, both Graveyards and the dice tray at 1280×720
- [X] T016 [US2] In src/table/pieces.ts lay out shared squares: one unit in the centre; two on the square's diagonal at ±0.27 × `SQUARE` in id order; hero figures move to the free corners when units are present (research R-02, FR-002); scale ring sizes in src/table/highlights.ts by `SQUARE` and draw a selection ring per unit at the unit's own position
- [X] T017 [US2] Add `unitScreenOf(id)` to the test hook in src/main.ts (screen point of a unit's mesh) and make T009 pass; save a screenshot of a shared square in test-results/

**Checkpoint**: Shared squares play and display correctly; all `US2-*` tests and all 001 tests pass

---

## Phase 4: User Story 1 – Pick up, drop and knock over pieces in sandbox (Priority: P1)

**Goal**: In sandbox, units and hero figures are physical; picking up, carrying, dropping and knocking over work; resting on a new square records a `sandboxPlace`

**Independent Test**: Turn rules off, pick up a Rook, drop it into a crowd of pawns, watch it land and knock a pawn over; the log shows the placement (spec US1)

### Tests for User Story 1 (write first, must fail) ⚠️

- [X] T018 [P] [US1] Write tests/physics/sandbox.test.ts (Vitest, Node, Rapier compat) against contracts/sandbox-physics.md: pure `restDestination` (square under the point incl. off-grid; `{ graveyard }` inside each Graveyard rectangle) and `clampToRim`; then with a real world from the standard position: `US1-AS2` (a released piece rests upright on the square under its centre within 2 s), `US1-AS3` (carrying a Rook through the row of Light pawns pushes them and at least one ends tilted > 45°), `US1-AS4` (a fallen pawn picked up and released rests upright), behaviour 1 (placed pieces fall asleep within 1 s), 4 (a piece pushed past the rim is reported inside it), 5 (`takeSettled` reports each rest once; a wobbling piece reports its own square), 6 (`allAsleep` within 3 s)
- [X] T019 [P] [US1] Write tests/e2e/sandbox-physics.spec.ts: `US1-AS1` (in sandbox, press on the g1 Knight and drag: its mesh rises above the board and follows the mouse), `US1-AS6` (release over f3: after rest the state has the Knight on f3 and the log shows the placement), `US1-AS5` (in rules mode no piece moves by physics: positions equal the state squares after a Lead)

### Implementation for User Story 1

- [X] T020 [US1] Implement pure helpers in src/physics/sandbox.ts: `TableLayout` (square size, Graveyard rectangles from `ZONES`, rim bounds = table plane minus a margin), `restDestination(point, layout)` and `clampToRim(point, layout)` (contracts/sandbox-physics.md)
- [X] T021 [US1] Implement collider shapes in src/physics/sandbox.ts: per unit type a compound of a base cylinder (radius 0.32, height 0.16) and a body cylinder (radius 0.2, height from the lathe profile tops in src/table/assets.ts: pawn 0.42, rook 0.66, knight 0.7, bishop 0.74, queen 0.82, king 0.95); hero figures a capsule (radius 0.2, height 0.75); density so the centre of mass sits low (research R-06)
- [X] T022 [US1] Implement `createSandboxWorld(pieces, layout)` in src/physics/sandbox.ts: lazy `loadRapier()` from src/physics/world.ts, gravity, static table plane, board slab, rim walls; one dynamic body per `PieceSpec` with CCD, damping and sleep; `step(dt)` in fixed 1/60 s steps returning whether anything is awake; `poses()`; `place(id, at)` (upright, zero velocity); `allAsleep()`; `dispose()`
- [X] T023 [US1] Implement carrying in src/physics/sandbox.ts: `pickUp(id)` switches the body to kinematic-position-based and lifts it to the carry plane (1.0 × square above the board); `carryTo(point)` sets the next kinematic translation; `release()` switches back to dynamic, upright, zero velocity (FR-021–FR-023)
- [X] T024 [US1] Implement settling in src/physics/sandbox.ts: track bodies that go to sleep, clamp any outside the rim back inside (`clampToRim`), and report them once through `takeSettled()` with `restDestination` (FR-025, contract behaviour 4–5)
- [X] T025 [US1] Add a carry gesture to src/table/picking.ts: in sandbox, pointer-down on a unit or hero starts a carry (callback with the piece id), pointer-move reports the ray's hit on the carry plane, pointer-up releases; clicks (< 6 px movement) keep 001's click-to-place behaviour
- [X] T026 [US1] In src/table/pieces.ts add `applyPoses(poses)` that sets mesh position and rotation from physics while sandbox is on, and `snapToState(state)` that puts every mesh upright on its state square (used in rules mode and when the world is disposed) (FR-027)
- [X] T027 [US1] Wire the sandbox world in src/main.ts: create it when enforcement becomes `sandbox` (piece specs from the state and the shared-square layout), dispose it when rules resume; run `step` from a `ts.onFrame` loop while awake and while carrying; on each `takeSettled` result whose destination differs from the state (square or `'graveyard'`, units only for the Graveyard) dispatch `sandboxPlace` (FR-024)
- [X] T028 [US1] Keep physics and state in step in src/main.ts: after any state change not caused by a physics settle (undo, value editors, click placement, load), call `world.place` for every body whose state square differs from its current rest square (research R-07)
- [X] T029 [US1] Allow table-area squares in src/rules/sandbox.ts `sandboxPlace`: accept any `to` with x, y in −6…15 (reject others with `BAD_SQUARE`); heroes still cannot go to `'graveyard'` (contracts/rules-api-changes.md *Actions*, research R-05); add a case to tests/rules/sandbox.test.ts
- [X] T030 [US1] Add an Undo button to src/ui/hud/sandbox-editors.ts using `session.canUndo()` / `session.undo()` (spec edge case "Undo in sandbox"), and show `sandbox.physicsHelp`
- [X] T031 [US1] Make T018 and T019 pass

**Checkpoint**: Sandbox pieces are physical; placements are recorded; all `US1-*` tests pass

---

## Phase 5: User Story 3 – Resume rules from a physical sandbox position (Priority: P2)

**Goal**: Turning rules on waits for rest, stands pieces up on the square under their centre, and refuses to resume while a unit is neither on the Battlefield nor in a Graveyard

**Independent Test**: Knock a Bishop over across two squares, knock a pawn off the table, turn rules on, check the result and the problems list (spec US3)

### Tests for User Story 3 (write first, must fail) ⚠️

- [X] T032 [P] [US3] Add to tests/rules/sandbox.test.ts: `US3-AS2` (a unit placed off the Battlefield, inside or outside the 10×10 grid → `UNIT_OFF_BATTLEFIELD` "… is not on the Battlefield or in a Graveyard", resume refused; a hero off the grid → `HERO_OFF_BOARD`), `US3-AS3` (`sandboxPlace` to `'graveyard'` → in the Graveyard), `US3-AS4` (a Graveyard unit placed on a square is back on the board), `US3-AS5` (after fixing, resume at *Before Turn*, moved units count as Led)
- [X] T033 [P] [US3] Add to tests/e2e/sandbox-physics.spec.ts: `US3-AS1` (a piece knocked over across two squares is stood up on the square under its centre after resume), `US3-AS6` (a unit pushed off the table waits at the rim, can be dragged into the Light Graveyard, after which resume works), quickstart steps 5–6

### Implementation for User Story 3

- [X] T034 [US3] Implement the resume flow in src/main.ts: on *Turn rules back on* show `sandbox.settling`, wait until `world.allAsleep()` or 3 s, dispatch the last settled placements, dispose the world, `pieces.snapToState`, then dispatch `setEnforcement('rules')`; on `POSITION_INVALID` show the problems and recreate the world (FR-026)
- [X] T035 [US3] Update the `UNIT_OFF_BATTLEFIELD` message in src/rules/sandbox.ts to "… is not on the Battlefield or in a Graveyard" and make sure off-grid table squares are reported for units and heroes (FR-025)
- [X] T036 [US3] Make T032–T033 pass

**Checkpoint**: All stories work; all `US*` tests of 002 and all 001 tests pass

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T037 [P] Extend tests/e2e/perf.spec.ts (gpu project) with a sandbox case: knock pieces around for 3 s with all 36 pieces physical and assert median frame time ≤ 20 ms (≥ 50 fps, spec SC-002)
- [X] T038 [P] Update tests/e2e/sandbox.spec.ts (001 step 6) and tests/e2e/quickstart.spec.ts for the new problem messages and the bigger board
- [X] T039 [P] Update specs/001-standard-rules-game/contracts/rules-api.md and data-model.md where 002 changes them (`battleUnitIds`, problem codes, table-area `pos`), linking to specs/002-sandbox-physics/contracts/rules-api-changes.md
- [X] T040 Run specs/002-sandbox-physics/quickstart.md steps 1–7 in the browser and fix any differences
- [X] T041 Update README.md (sandbox physics, two units per square) and CLAUDE.md if commands or layout changed; mark specs/001-standard-rules-game/tasks.md T114 done with a note pointing to 002

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup; BLOCKS all stories
- **US2 (Phase 3)**: depends on Foundational
- **US1 (Phase 4)**: depends on Foundational; its layout (piece spec positions) uses US2's T014 and T016 (`SQUARE`, shared-square layout)
- **US3 (Phase 5)**: depends on US1 (physics world, settle, dispose) and US2's T012 (position check)
- **Polish (Phase 6)**: after all stories

### Story completion order

```text
Setup → Foundational → US2 (rules T010–T013 ║ table T014–T017) → US1 → US3 → Polish
```

### Within each story

- Tests first, failing, then implementation (constitution IV)
- Rules before table, table before wiring in src/main.ts
- Story checkpoint before moving on

## Parallel Opportunities

- Setup: T002 alongside T001
- US2: tests T006–T009 together; then rules (T010–T013) and table (T014–T016) in parallel, they touch different files
- US1: tests T018–T019 together; T020–T024 are one file (sequential), T025 and T026 in parallel with them
- US3: tests T032–T033 together
- Polish: T037, T038, T039 in parallel

## Parallel Example: User Story 2

```text
Task: "T006 [US2] Write tests/rules/shared-squares.test.ts"
Task: "T008 [US2] Update tests/rules/sandbox.test.ts for the new codes"
Task: "T009 [US2] Write tests/e2e/shared-squares.spec.ts"
# then
Task: "T010–T012 [US2] rules (paths, lead, sandbox)"
Task: "T014–T016 [US2] table (coords, camera, pieces)"
```

## Parallel Example: User Story 1

```text
Task: "T018 [US1] tests/physics/sandbox.test.ts"
Task: "T019 [US1] tests/e2e/sandbox-physics.spec.ts"
# then, while T020–T024 build src/physics/sandbox.ts
Task: "T025 [US1] carry gesture in src/table/picking.ts"
Task: "T026 [US1] poses and snap in src/table/pieces.ts"
```

---

## Implementation Strategy

### MVP first

1. Phase 1 Setup + Phase 2 Foundational
2. Phase 3 US2 → **MVP**: shared squares play correctly, the bigger board shows them, the position check follows the rulebook (usable right away with click placement in sandbox)
3. STOP and check quickstart steps 1 and 4

### Incremental delivery

4. US1 → physical sandbox (quickstart steps 2–3)
5. US3 → resume from physics (quickstart steps 5–6)
6. Polish → fps, docs, quickstart step 7

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- Commit after each task or logical group, on branch `002-sandbox-physics`
- If physics tuning (damping, density) changes test thresholds, record the values in specs/002-sandbox-physics/research.md R-06

## Implementation notes (2026-11-04)

- **T004/T010**: path generation now finds Battle targets with `unitsAt`, and friendly-occupied squares stop paths unless `allowFriendlyEnd` says otherwise (no v1 rule uses it). Rejecting a Lead onto a friendly square still uses the code `LEAD_LEAVES_KING_IN_CHECK` ("That Lead is not legal"), as in 001.
- **T012**: messages list Light units first, then by id, so they are stable.
- **T014**: `SQUARE = 1.25`; the dice tray moved to x 10.25, z 1.9.
- **T021–T024**: tuned values are recorded in research R-06. The rim is ±13.1 world units so every resting square is one `sandboxPlace` accepts (−6…15).
- **T025/T027**: a plain click on a piece in sandbox still works as click-to-place; only a carry that moves replaces it.
- **T034**: while pieces settle, the "Waiting for pieces to come to rest…" toast shows; a refused resume recreates the physics world.
- **T037**: on this machine's GPU (Intel UHD) the sandbox sweep runs at 16.7 ms median frame time.
- **T040**: checked with a headless screenshot (the in-app browser pane was hidden, so its animation frames were paused): a carried Rook scatters the pawn row, pawns fall over, placements appear in the log.
