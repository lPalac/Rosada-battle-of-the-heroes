---

description: "Task list for 003-epic-stage"
---

# Tasks: Epic Stage, Destiny Generation, Royal Favors and Legendary Powers

**Input**: Design documents from `/specs/003-epic-stage/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/rules-api-changes.md, contracts/royal-favors-data.md, quickstart.md

**Tests**: Required. Constitution IV and spec FR-051: every acceptance scenario has an automated test named `US<story>-AS<scenario>` (rules headless in Vitest; tracker model headless; dialogs and table in Playwright). Write each story's tests first and see them fail.

**Organization**: By user story. Order follows the plan's build order and story dependencies: US1 Epic Stage → US2 generation → US6 Bloodied → US3 Royal Favors (needs Bloodied for *Vanquish*) → US5 auxiliary units and Create → US4 Legendary Powers (needs US3 thresholds and US5 Create) → US7 table visuals.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story from spec.md (US1…US7)
- Paths are from the repository root

## Ground rules for every task

- `src/rules/` and `src/game/` stay engine-free; state changes only through `apply` (constitution II).
- Numbers and art keys live in `src/data/` (constitution III); UI text in `src/data/strings.en.json`.
- Rule gaps: use the default in spec Open Questions Q-35…Q-36; add a new row for anything else instead of inventing a rule (constitution I).
- All 001 and 002 tests stay green after every phase.

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Copy the eight images from `assets/` (worktree: `Cavalier.png`, `Magus.png`, `monk.png`, `scout.png` and the four `* - epic heroes.png`) to `public/art/heroes/` (same file names) so Vite serves and bundles them
- [X] T002 [P] Create src/data/royal-favors.json exactly as in contracts/royal-favors-data.md (12 Royal Favors with `order`, `kind`, `target`, `repeat`; 6 powers with thresholds 6…11) and src/data/schemas/royal-favors.schema.json ("ids unique; `order` unique; `half`/`count` need `target ≥ 2`; thresholds ascending"); add it to scripts/check-data.ts with the cross-file check that every id has `favor.<id>.name` and `.requirement` strings
- [X] T003 [P] Extend src/data/rules.json and its schema with `heroUnit: { range: 2, farReachRange: 4, selfLeadBonus: 4, destroyedWounds: 3 }`, `generation: { base: 1 }`, `favors: { destinedForGreatness: 20, greatIncursionUnits: 3, greatIncursionRanks: 4, deployTroopsMax: 3, decimate: 7, offenseAttackers: 3, royalsFury: 3 }`; add the types to `RulesData` in src/rules/data.ts
- [X] T004 [P] Extend src/data/heroes.json (and schema): `generic-short` → `"heroUnitType": "knight", "portrait": "portrait.short", "epicArt": "epic.short"`, `generic-long` → `"bishop"`, `"portrait.long"`, `"epic.long"`; extend src/data/assets.json (and schema: optional `columns` integer ≥ 1) with every key in contracts/royal-favors-data.md *assets.json*
- [X] T005 [P] Add strings to src/data/strings.en.json: `favor.<id>.name` / `.requirement` for all 12 (requirement text from the rulebook *Royal Favors* list), `power.<id>.name` / `.text` for all 6, `destiny.fanatic|resolute|dominant` (+ the rulebook quotes), tracker labels (`tracker.title`, `tracker.done`, `tracker.half`, `tracker.open`, `tracker.next`), `hud.bloodied`, `hud.generation`, `action.becomeHeroUnit`, `action.leaveHeroUnit`, `action.kingsForces`, `action.tracker`, `dialog.destiny`, `notice.epicStage`, and `error.*` for every new code in contracts/rules-api-changes.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 Extend the model in src/rules/model/*.ts per data-model.md: `GameState.stage`, `epicPending`, `Royal Favors: Record<Side, RoyalFavorRecord>`; `well.depletedBy`; `peaceTreaty: 'peace' | 'war' | 'removed'`; `Hero.epic`, `heroUnitId`, `heroUnitType`, `rammedBy: { unitId; turn } | null`; `Unit.kind: 'main' | 'auxiliary' | 'hero'`, `extraTypes?`, `heroId?`; `PendingDecision` `epicDestiny`; `DecisionAnswer` `{ type: 'destiny', destiny }`; new `Action`s and `GameEvent`s from contracts/rules-api-changes.md and data-model.md *Log and events*
- [X] T007 Initialise the new fields in src/rules/setup.ts (`stage: 'starting'`, `epicPending: false`, empty Royal Favor records with every status `{ progress: 0, done: false }`, `tides: 0`, `track: []`, `kingsForces: 0`; heroes' `heroUnitType` from heroes.json, `epic: null`, `heroUnitId: null`) and update src/rules/ram.ts to write `rammedBy: { unitId, turn: state.turnNumber }`; update tests that read `rammedBy`
- [X] T008 Make old saves load in src/game/save.ts: `migrateState(state)` fills missing 003 fields with the T007 defaults before replay; test in tests/game/save.test.ts with a 002-shaped save
- [X] T009 Let units have several path types in src/rules/paths.ts and src/rules/check.ts: `basicLeads` and `attackSquares` take the union over `[unit.type, ...(unit.extraTypes ?? [])]` (pawn and castling rules only for the primary type); tests in tests/rules/paths.test.ts for a Rook+Knight unit
- [X] T010 [P] Write tests/fixtures/position.ts options for 003: `stage`, `epic` per hero, `royalFavors` (side → list of completed ids), `kingsForces`, `heroUnits` (heroId → types), `auxiliary` (squares of auxiliary units)

**Checkpoint**: `npm test` green; old saves load; no behaviour change yet

---

## Phase 3: User Story 1 – The Epic Stage begins (Priority: P1) 🎯 MVP

**Goal**: Well depleted → next Before Turn destiny choice → Epic Stage applied

**Independent Test**: Start with 2 Destiny left, make a Battle, check choice order, Fanatic/Dominant rule, health, Common Pool split, War token removed (spec US1)

### Tests for User Story 1 (write first, must fail) ⚠️

- [X] T011 [P] [US1] Write tests/rules/epic.test.ts: `US1-AS1` (the turn that depletes the Well continues; `epicPending` true; stage still starting), `US1-AS2` (next Before Turn: `epicDestiny` decisions in turn order from the active hero, the depleting hero last), `US1-AS3` (after a Fanatic on a side, its other hero's options exclude Dominant, and vice versa), `US1-AS4` (depleting hero's side gets `manifestEpicDestiny` in its track), `US1-AS5` (Common Pool 5 → 2 + 2 to the heroes, 1 stays), `US1-AS6` (Short 7/10 → 17/20; Long 8/8 → 16/16), `US1-AS7` (`peaceTreaty === 'removed'`; next Lead has no War modifier; roll 5 fails, 6 succeeds), `US1-AS8` (each hero's `epic.destiny` set; generation 1); edge cases: depletion during a game-ending Lead → no Epic Stage; an Unconscious hero still chooses

### Implementation for User Story 1

- [X] T012 [US1] In src/rules/destiny.ts set `well.depletedBy = activeHeroId` and `epicPending = true` when the initial 16 run out (keep the 001 `wellDepleted` event)
- [X] T013 [US1] Implement src/rules/epic.ts: on `beforeTurn` entry after the checkmate check, if `epicPending` and the game goes on, queue `epicDestiny` decisions (turn order from the active hero, depleting hero last, options per FR-002); `decide { type: 'destiny' }` records the choice; after the last one apply research R-02 steps 1–5 and emit `epicStageStarted`; wire the hook in src/rules/turn.ts and the decision in src/rules/index.ts `decide`
- [X] T014 [US1] In src/rules/tokens.ts `flipToWar` only flips `'peace'`; in src/rules/lead.ts `computeModifiers` adds War only for `'war'` and the Peace no-roll rule only for `'peace'` (FR-006)
- [X] T015 [US1] Add the destiny-choice dialog to src/ui/dialogs.ts: three cards (name, rulebook quote, Epic art column from `epic.<range>` per research R-09), unavailable ones disabled with the reason; a `notice.epicStage` toast in src/main.ts
- [X] T016 [US1] Make T011 pass

**Checkpoint**: The Epic Stage starts and plays on; all `US1-*` pass

---

## Phase 4: User Story 2 – Hero Destiny Generation (Priority: P1)

**Goal**: Derived generation gained at each Epic hero's End of Turn

**Independent Test**: In the Epic Stage remove a Queen and both Knights, end a turn, check the gain (spec US2)

### Tests for User Story 2 (write first, must fail) ⚠️

- [X] T017 [P] [US2] Write tests/rules/generation.test.ts: `US2-AS1` (1 at Epic start), `US2-AS2` (no Queen, no Knight → 3), `US2-AS3` (lose last Bishop → 4; a Knight back by Promotion → 3), `US2-AS4` (an auxiliary pawn on the enemy royal rank → +1 while there), `US2-AS5` (End of Turn: hero pool + generation, `destinyChanged` reason `destinyGeneration`), `US2-AS6` (Starting Stage: 0, no gain); Hero Units do not count as their type, auxiliary units do (clarified)

### Implementation for User Story 2

- [X] T018 [US2] Implement `destinyGeneration(state, side)` in src/rules/generation.ts per research R-04 (counts `main` and `auxiliary` units only) and export it from src/rules/index.ts
- [X] T019 [US2] Gain generation on `endOfTurn` entry in src/rules/turn.ts when `stage === 'epic'` (before the free Meal; the order has no v1 effect)
- [X] T020 [US2] Show generation in the HUD hero panels (src/ui/hud/heroes.ts) via `src/game/hud-model.ts` (`generation` per hero card); make T017 pass

**Checkpoint**: Epic economy works; all `US2-*` pass

---

## Phase 5: User Story 6 – Bloodied (Priority: P2)

**Goal**: Epic heroes in the red area are Bloodied

**Independent Test**: Wound an Epic Short hero from 20 to 10 (spec US6)

### Tests for User Story 6 (write first, must fail) ⚠️

- [X] T021 [P] [US6] Write tests/rules/bloodied.test.ts: `US6-AS1` (Epic Short ≤ 10 of 20, Long ≤ 8 of 16 → Bloodied), `US6-AS2` (Starting Heroes never), `US6-AS3` (healing above the red area clears it)

### Implementation for User Story 6

- [X] T022 [US6] Implement `isBloodied(state, heroId)` in src/rules/generation.ts (`health ≤ healthBar.startingMax` in the Epic Stage); add `bloodied` to the hero cards in src/game/hud-model.ts and a marker in src/ui/hud/heroes.ts; make T021 pass

---

## Phase 6: User Story 3 – Royal Favors and the tracker (Priority: P1)

**Goal**: All Royal Favors complete correctly, fill the track, unlock Powers; both sides visible in the tracker

**Independent Test**: Scripted positions complete each Royal Favor; check track and modal (spec US3)

### Tests for User Story 3 (write first, must fail) ⚠️

- [X] T023 [P] [US3] Write tests/rules/royal-favors.test.ts: `US3-AS1` (Battle on the enemy Royal rank), `US3-AS2` (one Ram → ½, second Ram of any enemy hero → done), `US3-AS3` (3 non-hero units in ranks 5–8 for Light / 1–4 for Dark), `US3-AS4` (discovered check), `US3-AS5` (≤ 3 pawns on own pawn starting squares), `US3-AS6` (King/Queen Battles count 1, 2, done at 3), `US3-AS7` (7 enemy main units in the Graveyard), `US3-AS8` (an enemy unit threatened by 3 friendly units), `US3-AS9` (enemy hero to 0 → done; one Epic enemy Bloodied → ½; a second different one → done), `US3-AS10` (≥ 20 D in Common + Hero Pools at End of Turn), `US3-AS11` (after depletion, Common Pool gain on own turn → Tides +1, once per turn, max 5), `US3-AS12` (each numbered one only once), `US3-AS13` (completion → next track slot, `favorCompleted` event, log line); several completions from one action in rulebook order; state checks for both sides after every action (clarified), and earned progress is never lost when the condition stops being true
- [X] T024 [P] [US3] Write tests/game/favor-model.test.ts for `US3-AS14`: model lists both sides, every Royal Favor with status (done / half + progress / open) and requirement key, the track in order, unlocked Powers and "n more for <next>"
- [X] T025 [P] [US3] Write tests/e2e/tracker.spec.ts: the tracker button and `A` key open the modal; it shows both sides; after a scripted Ram the enemy's *Overwhelm* shows ½

### Implementation for User Story 3

- [X] T026 [US3] Implement src/rules/royal-favors.ts: `progress(ctx, side, id, amount)`, `complete(ctx, side, id)` (track push, `favorCompleted`, Power unlock at thresholds with `powerUnlocked`, +1 King's Forces token at 7), `checkState(ctx)` for both sides (Great Incursion, Deploy Troops, Decimate, Offense), `checkEndOfTurn(ctx, side)` (Destined for Greatness), Tides with `tidesThisTurn` reset at `beforeTurn`
- [X] T027 [US3] Hook the event checks: src/rules/lead.ts (Battle on the enemy Royal rank; King/Queen Battles → Royal's Fury by destroyed units; discovered check via `isDiscoveredCheck` → Tactical Genius), src/rules/ram.ts (each enemy hero Rammed → Overwhelm), src/rules/heroes.ts (enemy hero to 0 → Vanquish done; an Epic enemy newly Bloodied → `vanquishBloodied`), src/rules/destiny.ts (Common Pool gain on own turn after depletion → Tides); call `checkState` at the end of `apply` in src/rules/index.ts and `checkEndOfTurn` in src/rules/turn.ts
- [X] T028 [US3] Implement `favorModel(state)` in src/game/favor-model.ts (engine-free) and `unlockedPowers` in src/rules/royal-favors.ts
- [X] T029 [US3] Implement the tracker modal in src/ui/tracker.ts (two columns, statuses, progress, requirements, track, Powers, next threshold; opened from a HUD button `action.tracker` and the `A` key in src/main.ts)
- [X] T030 [US3] Make T023–T025 pass

**Checkpoint**: Royal Favors and tracker complete; all `US3-*` pass

---

## Phase 7: User Story 5 – Auxiliary units and Create (Priority: P2)

**Goal**: Units can be created by rules; auxiliary units play correctly

**Independent Test**: Create an auxiliary pawn, move it to the enemy royal rank, check no promotion, generation +1, leaves play when destroyed (spec US5)

### Tests for User Story 5 (write first, must fail) ⚠️

- [X] T031 [P] [US5] Write tests/rules/create.test.ts: `US5-AS1` (a creation that would give check to either King is refused, `CREATE_WOULD_CHECK`), `US5-AS2` (auxiliary pawn on the enemy royal rank: no promotion decision), `US5-AS3` (destroyed auxiliary unit leaves play, not in the Graveyard; Destiny as usual), `US5-AS4` (auxiliary units move, Battle, threaten and give check like their type)

### Implementation for User Story 5

- [X] T032 [US5] Implement `createUnit(ctx, { side, type, at, kind })` in src/rules/create.ts (refuse occupied square or a check to either King; id `A-<side>-<type>-<n>`; `unitCreated` event)
- [X] T033 [US5] In src/rules/lead.ts destroyed `auxiliary` and `hero` units leave play instead of going to the Graveyard (Destiny unchanged); in src/rules/sandbox.ts validation accept `kind: 'auxiliary'`; draw the `marker.auxiliary` ring in src/table/pieces.ts; make T031 pass

---

## Phase 8: User Story 4 – Legendary Powers and Hero Units (Priority: P2)

**Goal**: Hero Unit, King's Forces, Advanced Warfare, Far Reach, Swift Change, Final Form

**Independent Test**: With 6 Royal Favors turn a hero into a Hero Unit, Lead it into Battle, check range, bonus and destruction (spec US4)

### Tests for User Story 4 (write first, must fail) ⚠️

- [X] T034 [P] [US4] Write tests/rules/hero-unit.test.ts: `US4-AS1` (6 Royal Favors: Short → Knight, Long → Bishop Hero Unit; locked below 6, `POWER_LOCKED`), `US4-AS2` (refused on an occupied square, off the Battlefield, when it would check the enemy King, when its King is in check and it stands on the check's path), `US4-AS3` (Move skipped, Range 2, self-Lead +4, Leading others stays put, Led by a friendly hero with +4), `US4-AS4` (destroyed in Battle: 3 wounds, starting square, no longer a Hero Unit, enemy gets Battle Destiny, not in the Graveyard), `US4-AS5` (Rammed by a unit last turn → cannot Lead itself into Battle with it, `RAMMED_BY_TARGET`), `US4-AS7` (8: Rook allowed), `US4-AS8` (9: Range 4), `US4-AS9` (10: become/leave at End of Turn), `US4-AS10` (11: Rook + own type, either path per Lead, threatens with both), `US4-AS11` (counts as a unit on its square, can give and block check)
- [X] T035 [P] [US4] Write tests/rules/kings-forces.test.ts for `US4-AS6` (7 Royal Favors → 1 token; at Beginning of Turn create an auxiliary unit of the hero's type on its unoccupied square; refused under the Hero Unit restrictions and the Create rule; token spent)

### Implementation for User Story 4

- [X] T036 [US4] Implement src/rules/hero-unit.ts: `heroUnitOptions(state, heroId)` (Power checks, restrictions per research R-06, types `[own]`, `['rook']` with Advanced Warfare, `['rook', own]` with Final Form), `becomeHeroUnit` (create `kind: 'hero'` unit `HU-<heroId>` on the hero's square), `leaveHeroUnit`, keeping hero `pos` = unit `pos` after every Lead
- [X] T037 [US4] Integrate Hero Units in the Lead: src/rules/heroes.ts and src/rules/lead.ts (Range 2 / 4 from the hero's square; Move phase skipped; `heroUnit +4` modifier when the Led unit is a Hero Unit; Leading others leaves the Hero Unit in place; `RAMMED_BY_TARGET`), src/rules/ram.ts (Hero Units are never Rammed or pushed; clarified), destroyed Hero Unit → wound 3, starting square, unit removed (src/rules/lead.ts)
- [X] T038 [US4] Rest in the phases with choices in src/rules/turn.ts (research R-08): `beginningOfTurn` when King's Forces is usable or the hero may become or leave a Hero Unit, `endOfTurn` with Swift Change; implement the `kingsForces` action in src/rules/create.ts
- [X] T039 [US4] Add HUD buttons in src/ui/hud/actions.ts (Become Hero Unit with type choice, Leave Hero Unit, King's Forces) and draw Hero Units in src/table/pieces.ts (unit mesh of its type with the hero's colour ring); make T034–T035 pass

**Checkpoint**: All Legendary Powers work; all `US4-*` and `US5-*` pass

---

## Phase 9: User Story 7 – A table that looks like the board game (Priority: P2)

**Goal**: Room, wooden table, illustrated border, Graveyard/Well strip, hero sheets, Royal Favor tracks, medallions, art

**Independent Test**: Screenshot from the default camera shows every element; compare with the Tabletop Simulator screenshots (spec US7)

### Tests for User Story 7 (write first, must fail) ⚠️

- [X] T040 [P] [US7] Write tests/e2e/table.spec.ts: `US7-AS1` (hook `tableElements()` reports table top, room floor, board border, strip), `US7-AS2` (4 hero sheets with name, portrait loaded, health marker at the hero's health, pool), `US7-AS3` (2 Royal Favor tracks with slots; a completed Royal Favor shows a token), `US7-AS4` (4 medallions with numbers; the active one highlighted), `US7-AS5` (after the Epic Stage a sheet shows the chosen destiny's art column), `US7-AS6` (every table, sheet, track, medallion, portrait and epic key is read from `assets.json`: a test build with `portrait.short` pointed at `scout.png` shows that image on the Short range sheets, with no code change), `US7-AS7` (default-camera screenshot to test-results/table-003.png; the HUD panels do not cover the board centre); extend tests/e2e/perf.spec.ts to keep the 60 fps check with the new table

### Implementation for User Story 7

- [X] T041 [P] [US7] Implement src/table/room.ts: stone floor plane, fog, warm point lights, an irregular extruded wooden table slab with a canvas wood-grain texture (`room.floor`, `table.top` keys)
- [X] T042 [P] [US7] Update src/table/board.ts: an illustrated border strip around the Battlefield drawn on a canvas (forest green, water blue, castle-wall grey, per `board.border`) and parchment-tinted squares
- [X] T043 [P] [US7] Implement src/table/strip.ts: the Graveyard / Destiny Well strip beside the board (`strip.graveyard`), placed where `ZONES.graveyard` and `ZONES.well` are
- [X] T044 [US7] Implement src/table/sheets.ts: one hero sheet per hero in front of its seat, canvas texture with portrait image (`portrait.<range>`), name and range, health track with marker, pool, Bloodied mark, and in the Epic Stage the destiny name, the Epic art column (`epic.<range>`, `columns: 3`, order fanatic/resolute/dominant) and a Destiny Generation tracker; redraw only when that hero's data changes (FR-041, FR-042)
- [X] T045 [US7] Implement src/table/tracks.ts: a Royal Favor track per side (16 slots, marks at 6…11, tokens for completed entries) and a turn-order medallion per hero sheet (number texture; active one glows); feed from `favorModel`
- [X] T046 [US7] Wire room, strip, sheets and tracks into src/main.ts (sync on every state change), add the `tableElements()` test hook, keep the default camera framing the board and the active sheet (src/table/camera.ts), and make T040 pass

**Checkpoint**: The table matches the reference layout; frame rate holds

---

## Phase 10: Polish & Cross-Cutting Concerns

- [X] T047 [P] Sandbox editors in src/ui/hud/sandbox-editors.ts and `sandboxSet` paths in src/rules/sandbox.ts for stage, destinies, Royal Favors (toggle done / progress), King's Forces tokens; position check covers Hero Units (on the Battlefield, alone among units) and auxiliary units (FR-050); tests in tests/rules/sandbox.test.ts
- [X] T048 [P] Extend tests/rules/contract.test.ts with guarantees 8–12 (contracts/rules-api-changes.md) over seeded playouts that reach the Epic Stage (start with `wellRemaining` low)
- [X] T049 [P] Add a scripted game tests/games/scripted-game-03.test.ts reaching the Epic Stage with a hand-kept ledger of pools, generation and Royal Favors per turn
- [X] T050 Run specs/003-epic-stage/quickstart.md steps 1–7 in the browser and fix differences
- [X] T051 Update README.md, CLAUDE.md and the 001/002 docs where 003 changes them (Peace token `'removed'`, `Unit.kind 'hero'`, `rammedBy` shape); note Q-35…Q-36 for Luka

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → **Foundational (Phase 2)** → stories
- **US1 (Phase 3)**: after Foundational
- **US2 (Phase 4)**: after US1 (needs `stage === 'epic'`)
- **US6 (Phase 5)**: after US1
- **US3 (Phase 6)**: after US1 (Manifest, Tides) and US6 (Vanquish)
- **US5 (Phase 7)**: after Foundational; its generation test needs US2
- **US4 (Phase 8)**: after US3 (thresholds) and US5 (Create)
- **US7 (Phase 9)**: after US1, US2, US3 for live data; room/board/strip (T041–T043) can start right after Foundational
- **Polish (Phase 10)**: after all stories

### Story completion order

```text
Setup → Foundational → US1 → US2 ║ US6 → US3 → US5 → US4 → Polish
                        └──────────── US7 (T041–T043 early, T044–T046 after US3) ──┘
```

## Parallel Opportunities

- Setup: T002–T005 together after T001
- Foundational: T010 alongside T006–T009
- Each story's test tasks marked [P] together
- US2 and US6 in parallel after US1
- US7 room/board/strip (T041–T043) in parallel with US2–US5 (different files)
- Polish: T047–T049 together

## Parallel Example: after User Story 1

```text
Task: "T017 [US2] tests/rules/generation.test.ts"
Task: "T021 [US6] tests/rules/bloodied.test.ts"
Task: "T041 [US7] src/table/room.ts"
Task: "T042 [US7] illustrated border in src/table/board.ts"
Task: "T043 [US7] src/table/strip.ts"
```

---

## Implementation Strategy

### MVP first

1. Setup + Foundational
2. US1 Epic Stage → **MVP**: games carry on into the Epic Stage with the right choices and numbers
3. US2 generation + US6 Bloodied → the Epic economy is complete

### Incremental delivery

4. US3 Royal Favors + tracker
5. US5 auxiliary units → US4 Legendary Powers
6. US7 table visuals (started early in parallel)
7. Polish: sandbox editors, guarantees, scripted game, quickstart

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- Commit after each task or logical group, on branch `003-epic-stage`
- New rule gaps → spec Open Questions, never silent defaults
