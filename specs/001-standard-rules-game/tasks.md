---

description: "Task list for 001-standard-rules-game"
---

# Tasks: Standard Rules Game (3D, hot-seat)

**Input**: Design documents from `/specs/001-standard-rules-game/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/rules-api.md, contracts/data-files.md, quickstart.md

**Tests**: Required. Constitution IV ("Rules Are Tested First", NON-NEGOTIABLE) and spec SC-002 require a Vitest test for every acceptance scenario, named `US<story>-AS<scenario>`. Write each story's tests first and make sure they fail before implementing.

**Organization**: Tasks are grouped by user story. Story phases follow the plan's build order (rules core first, then browser), not the story numbers: US2 → US3 → US1 → US7 (all P1), then US4 → US5 → US6 (P2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story from spec.md (US1…US7)
- Paths are from the repository root (single project, see plan.md *Project Structure*)

## Ground rules for every task

- `src/rules/` and `src/game/` MUST NOT import `three`, `@dimforge/*`, `colyseus*`, DOM APIs, or anything from `src/table/`, `src/physics/`, `src/ui/` (constitution II, research R-04).
- State changes only through `apply(state, action)`; never mutate the input state (contracts/rules-api.md).
- Numbers that are tunables come from `src/data/rules.json`, not literals in code (constitution III).
- Rules come from `Basic Rules 2_5.docx` + `Basic Rules 2_5 - corrections.docx` and spec.md *Clarifications*/*Resolved*. If a case is not covered, add a row to spec.md *Open Questions* instead of inventing a rule (constitution I).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and tooling

- [X] T001 Create `package.json` (`"type": "module"`, `"private": true`, `"engines": { "node": ">=22.12" }`) with scripts `dev` (vite), `build` (tsc -p tsconfig.json --noEmit && vite build), `preview`, `typecheck:rules` (tsc -p tsconfig.rules.json --noEmit), `test` (npm run typecheck:rules && npm run lint && vitest run), `test:e2e` (playwright test), `check:data` (node scripts/check-data.ts or tsx), `lint` (eslint .) in package.json
- [X] T002 Install pinned dependencies: runtime `three@0.187.x`, `@dimforge/rapier3d-compat@0.21.x`; dev `typescript@7.x`, `vite@8.x`, `vitest@5.x`, `@playwright/test@1.64.x`, `@types/three@0.187.x`, `eslint@10.x`, `ajv@8` (JSON Schema validator), `tsx` (runs scripts/check-data.ts); write exact versions to package.json and commit package-lock.json
- [X] T003 [P] Create `tsconfig.json` (strict, `lib: ["ES2022","DOM"]`, `moduleResolution: "bundler"`, `resolveJsonModule: true`, includes `src`, `tests`, `scripts`) and `tsconfig.rules.json` (extends base, `lib: ["ES2022"]` only, `types: []`, includes only `src/rules/**` and `src/game/**`) per research R-04
- [X] T004 [P] Create `vite.config.ts` (root `index.html`, `build.target: "es2022"`), `vitest.config.ts` (`environment: "node"`, `include: ["tests/**/*.test.ts"]`) and `playwright.config.ts` (chromium only, `webServer: { command: "npm run dev -- --mode e2e", port: 5173 }`, screenshots to `test-results/`)
- [X] T005 [P] Create `eslint.config.js` with typescript-eslint and `no-restricted-imports` for files in `src/rules/**` and `src/game/**` blocking `three`, `three/*`, `@dimforge/*`, `colyseus*` and relative imports into `src/table`, `src/physics`, `src/ui`. If typescript-eslint does not support TypeScript 7, pin the lint-only parser to a supported TypeScript version or drop ESLint and rely on T031, and record the change in specs/001-standard-rules-game/research.md R-04
- [X] T006 [P] Create the folder skeleton from plan.md (`src/rules/model/`, `src/game/`, `src/data/schemas/`, `src/table/`, `src/physics/`, `src/ui/`, `src/i18n/`, `tests/rules/`, `tests/games/`, `tests/fixtures/`, `tests/helpers/`, `tests/e2e/`, `scripts/`), plus `index.html` with `<canvas id="table">`, `<div id="hud">`, `<div id="overlay">` and `src/main.ts` that only logs "Rošada boot" in index.html and src/main.ts
- [X] T007 [P] Append `node_modules/`, `dist/`, `test-results/`, `playwright-report/`, `.vite/` to .gitignore
- [X] T008 [P] Add a "Development" section to README.md with the commands from specs/001-standard-rules-game/quickstart.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Rules core skeleton, data, board geometry, unit paths, check detection, Destiny core and test helpers that every story needs

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Model types

- [X] T009 [P] Define `Side`, `Coord` (`{ x: number; y: number } // 0..9 each`), `UnitType`, `RangeType`, `Phase` in src/rules/model/types.ts exactly as in data-model.md *Core types*
- [X] T010 [P] Define `Unit` (`id`, `side`, `type`, `originalType`, `kind: 'main' | 'auxiliary'` "Always `main` in v1", `pos`, `hasBeenLed`, `promoted`, `enPassantTarget: Coord | null` "Set for one turn after a 2-square pawn Lead from its starting square") in src/rules/model/unit.ts
- [X] T011 [P] Define `Hero` and `HeroStatus` in src/rules/model/hero.ts per data-model.md: `id: 'H1' | 'H2' | 'H3' | 'H4'` "Equals turn order", `turnOrder: 1…4` "Light 1 & 3, Dark 2 & 4", `health` "0…max", `pool` "starts at 3", `rammedBy: unitId | null` "Recorded for later Hero Unit rule (v1: no effect)", `HeroStatus { unconscious; skipNextTurn; recoverAtBeginningOfTurn; movementPenaltyNextTurn }`
- [X] T012 [P] Define `GameState`, `SetupChoices`, `TurnFlags`, `LeadAttempt`, `DestinyLedger`, `Tokens` (`peaceTreaty: 'peace' | 'war'`, `revenge: { light: 0..2, dark: 0..2 }`), `GameResult`, `LogEntry` in src/rules/model/state.ts with every field from data-model.md
- [X] T013 [P] Define `Action`, `GameEvent`, `RuleError` (`{ code; message; rule }`), `PendingDecision` and `DecisionAnswer` unions in src/rules/model/actions.ts exactly as listed in contracts/rules-api.md and data-model.md *PendingDecision*

### Static data

- [X] T014 [P] Create src/data/board.json, src/data/units.json, src/data/rules.json with the exact content from contracts/data-files.md
- [X] T015 [P] Create src/data/heroes.json and src/data/healthbars.json with the exact content from contracts/data-files.md (`bar-16` points [1,2,4,6,8,9,11,14], `bar-20` points [1,2,4,6,8,10,11,13,15,18])
- [X] T016 [P] Create src/data/assets.json with a placeholder entry for every key the game uses: `unit.<light|dark>.<king|queen|rook|bishop|knight|pawn>`, `hero.short`, `hero.long`, `token.peace`, `token.war`, `token.revenge`, `die.d20`, `board`, `tavern`, `crystal` ("Each value is exactly one of `{ "placeholder": <shape> }`, `{ "gltf": <path> }`, `{ "image": <path> }`, with optional `color` and `scale`")
- [X] T017 [P] Create src/data/strings.en.json with all UI strings referenced by later tasks (phase names, actions, errors by `RuleError.code`, setup screens, results) and src/i18n/strings.ts with `t(key, params)` (A-02)
- [X] T018 Create JSON Schemas in src/data/schemas/ (`board`, `units`, `heroes`, `healthbars`, `rules`, `assets`) enforcing: heroes "`movement` 1…10, `range` 1…10, `maxHealth` ≥ 1 and ≤ the bar's red area top, `healthBar` must exist, `art` must exist in `assets.json`"; healthbars "points ascending, unique, within 1…max"
- [X] T019 Implement scripts/check-data.ts (ajv) validating every src/data/*.json against its schema plus the cross-file rules from T018; exit code 1 on failure
- [X] T020 Implement `loadStaticData(): StaticData` in src/rules/data.ts that imports the JSON files (no `fs`) and returns typed objects

### Board, paths, check

- [X] T021 Implement src/rules/board.ts per research R-05: 10×10 grid, `regionOf(coord)` (Battlefield x 1…8, y 1…8; King's Court y = 0 Light / y = 9 Dark, x 1…8; Wilderness x = 0 / x = 9, y 1…8; Taverns (0,0),(9,0) Light, (0,9),(9,9) Dark), `inGrid`, `isBattlefield`, `chebyshev(a,b)`, `adjacent8(c)`, `tavernOwner(c)`, `heroStartSquares(side)` ((3,0),(6,0) / (3,9),(6,9)), `squareName(c)` (chess notation on the Battlefield, `c0`/`f9` style in the Outskirts, `T-a0`-style for taverns)
- [X] T022 [P] Write tests/rules/board.test.ts covering every region boundary, Chebyshev distance, adjacency at grid edges, tavern owners and square names
- [X] T023 Implement position fixtures in tests/fixtures/position.ts: parse a 10-line diagram (top line y = 9, left column x = 0) with `K Q R B N P` for Light, `k q r b n p` for Dark, `1`–`4` for heroes H1–H4, `.` empty; accept an options object for things one character cannot show (`heroes: { H1: 'e4' }` for heroes sharing a square with a unit or hero, `health`, `pools`, `tokens`, `activeHeroId`, `phase`) and return a full `GameState`
- [X] T024 Implement basic unit paths in src/rules/paths.ts from units.json: King/Queen/Rook/Bishop/Knight/Pawn (pawn: one forward to unoccupied, one diagonal forward into Battle, two forward from its starting square without battling), returning `{ to, isBattle, path }` where `path` is every interacted square (Knight: start + end only); paths stop at the first enemy unit, never enter friendly-unit squares, never leave the Battlefield; units "may not initiate Battle with an enemy unit that cannot be Destroyed"
- [X] T025 [P] Write tests/rules/paths.test.ts for every unit type from fixtures, including blocked paths, edges, and Knight jumps
- [X] T026 Implement src/rules/check.ts: `threatenedSquares(state, side)` using the rulebook *Threaten* definition (eligible units, includes squares of the first friendly units, a unit pinned to its King still threatens), `isProtected`, `isInCheck(state, side)`, `leadLeavesKingInCheck(state, lead)`, `isDiscoveredCheck(state, ledUnitId)`; heroes never threaten in v1 (research R-10)
- [X] T027 [P] Write tests/rules/check.test.ts: threat maps, pinned pieces, check, discovered check, "A King may not be Led into a threatened square"

### Core state, Destiny core, turn skeleton

- [X] T028 Implement Destiny core in src/rules/destiny.ts per research R-09: `well = { initialRemaining: 16, depleted: false }`; `gain(state, target, amount, reason)` takes from `initialRemaining` until 0, then sets `depleted = true` and the Well is unlimited (overflow per FAQ 11), writes a ledger entry and a `destinyChanged` event, and flips `peaceTreaty` to `war` on the first gain (FR-070); `spend(state, target, amount, reason)` removes from play before depletion and returns to the Well after (no visible effect); emits `wellDepleted` once
- [X] T029 [P] Write tests/rules/destiny-core.test.ts: Well countdown, depletion, overflow (FAQ 11), Peace → War flip on first gain only, spend before/after depletion
- [X] T030 Implement the test-only seeded PRNG in tests/helpers/rng.ts (string seed → 32-bit hash → `mulberry32`) with `nextFloat()` and `nextInt(min,max)`, used only by random playout tests (constitution IV). The game itself keeps no seed: rolls enter through `submitRoll` and are stored in the log (FR-037, research R-06)
- [X] T031 [P] Write tests/boundaries.test.ts that scans every `.ts` file in src/rules and src/game for forbidden imports (same list as T005) and fails with the file and import name
- [X] T032 Implement turn skeleton in src/rules/turn.ts: phase order `beforeTurn → beginningOfTurn → beforeMove → move → beforeLead → lead → afterLead → endOfTurn`, registry of on-enter hooks per phase (filled by later tasks), `endPhase` action, Active Hero hand-off at `endOfTurn` (1→2→3→4→1, `turnNumber` increments), `TurnFlags` reset at `beforeTurn`, `phaseChanged` events
- [X] T033 Implement `createGame(setup, data)` in src/rules/setup.ts: units on standard squares (Light ranks 1–2), Graveyard empty, Well 16, Common Pools 0, hero pools 3, Peace up, Revenge 0; turn order from `setup.turnOrder` per FR-082 (Light's first-chosen hero = turn 1, Dark's = turn 2, Light's second = turn 3, Dark's second = turn 4); start squares from `setup.startFiles` per FR-083 (c-file → (3,0)/(3,9), f-file → (6,0)/(6,9)); hero stats from heroes.json
- [X] T034 Implement the public API in src/rules/index.ts: `createGame`, `legalActions`, `apply` (dispatch by action type to area modules, returns `{ ok, state, events }` or `{ ok: false, error }`, appends `LogEntry` for every action/roll/Destiny change, FR-112), `isInCheck`, `legalMoveSquares`, `legalLeadTargets`, `leadPreview` stubs wired to later modules
- [X] T035 [P] Write tests/rules/contract.test.ts for contracts/rules-api.md *Guarantees* 2–4 (every legal action applies; illegal actions return `ok: false`; `JSON.parse(JSON.stringify(state))` deep-equals `state`; 3a re-applying the action log to `createGame(setup, data)` gives the same state; while `pendingDecision` is set only its answers are legal), using random legal-action playouts driven by the T030 test PRNG with a fixed seed (extend as stories land)

**Checkpoint**: `npm test` passes; a game can be created headless and phases can be stepped with `endPhase`

---

## Phase 3: User Story 2 – Take a hero turn: Move and Lead (Priority: P1) 🎯 MVP core

**Goal**: The active hero moves up to their Movement, then must Lead one friendly unit in Range; the d20 decides on 6+; a Battle destroys the enemy unit

**Independent Test**: Scripted turns from fixtures, comparing board state, rolls and Destiny with a hand-refereed run (spec US2)

### Tests for User Story 2 (write first, must fail) ⚠️

- [X] T036 [P] [US2] Write tests/rules/move.test.ts: `US2-AS1` (Short range: only paths of up to 5 sequentially adjacent squares; enemy-unit and King squares cannot be the final square), `US2-AS2` (Long range: only friendly units within 3 squares selectable, hero stays), `US2-AS3` (Short range advance ends on a chosen adjacent square not occupied by a King or enemy unit)
- [X] T037 [P] [US2] Write tests/rules/lead.test.ts: `US2-AS4` (Peace: non-King Lead succeeds without roll), `US2-AS5` (War, King not in check, die 3 → total 5 → fail, unit stays, side +1 D), `US2-AS6` (cannot end turn without attempting a possible Lead), `US2-AS7` (destination leaving own King in check is not offered), `US2-AS8` (King Lead incl. castling: no roll); plus check bonus +4, Inspired Lead modifier hook, Battle destroys and sends Main unit to Graveyard (FR-005)
- [X] T038 [P] [US2] Write tests/rules/special-moves.test.ts: castling both sides (fails if King or Rook was Led, squares between occupied, King's squares threatened), en passant (only on the turn right after the 2-square move), Promotion to queen/rook/bishop/knight with chooser = active hero on own turn and next hero of that side otherwise
- [X] T039 [P] [US2] Write tests/rules/undo.test.ts: undo allowed until a reveal event (`rolled`, `unitDestroyed`, `heroRammed`, `heroWounded`, `destinyChanged` gain), never across the Active Hero hand-off (FR-012, research R-11)

### Implementation for User Story 2

- [X] T040 [US2] Implement hero movement in src/rules/heroes.ts: `movementForTurn(hero)` (base − penalties, "never reduced by more than 2"), `moveStep` action (must be adjacent8, inside the 10×10 grid, decrements `movementLeft`, records `movePath`), `legalMoveSquares`, and the rule that the Move phase cannot end on an enemy unit or King square (passing through is allowed) (FR-022)
- [X] T041 [US2] Implement range in src/rules/heroes.ts: `unitsInRange(state, hero)` with Chebyshev distance ≤ Range (FR-023)
- [X] T042 [US2] Implement `announceLead` in src/rules/lead.ts: unit friendly and in range, destination from paths.ts, reject `LEAD_LEAVES_KING_IN_CHECK`, set `needsRoll` (false for King, Peace side up), build `modifiers` (`war` +2, `check` +4, `inspiredLead` from TurnFlags) and enter `awaitingRoll`
- [X] T043 [US2] Implement `submitRoll(value)` and resolution in src/rules/lead.ts: validate 1…20, `total = roll + modifiers`, success when total ≥ `leadTarget` (6); success moves the unit along `path`, Battle destroys the enemy unit (Main → Graveyard, `unitDestroyed`); failure leaves the unit and calls `destiny.gain(side, 1, 'failedLead')` (FR-035); set `turn.leadAttempted`
- [X] T044 [US2] Implement the forced Lead in src/rules/lead.ts and src/rules/turn.ts: compute `turn.leadPossible` on entering `lead`; `endPhase` from `lead` returns `MUST_ATTEMPT_LEAD` while a Lead is possible and not attempted (FR-031); set `turn.kingInCheckAfterLead` after resolution and expose `abilitiesBlocked()` for After Lead / End of Turn (FR-042)
- [X] T045 [US2] Implement Short range advance in src/rules/lead.ts: after a successful Lead by a Range-1 hero, set `pendingDecision: advanceSquare` with squares adjacent to the unit not occupied by a King or enemy unit; Long range heroes stay (US2-AS3)
- [X] T046 [US2] Implement castling, en passant and Promotion in src/rules/paths.ts and src/rules/lead.ts: castling per rulebook (King 2 squares toward Rook in the Royal rank, Rook placed on the crossed square, Rook interacts with no squares), `enPassantTarget` set/cleared each turn, Promotion `pendingDecision: promotion` with the chooser rules from T038 (FR-003)
- [X] T047 [US2] Implement the session action log and `undo(history: Action[])` in src/game/session.ts per research R-11: undo drops the last action and rebuilds the state by re-applying the log from `createGame` (a cache of recent states is optional); blocked after reveal events or the Active Hero hand-off
- [X] T048 [US2] Wire `legalActions`/`legalLeadTargets`/`leadPreview` in src/rules/index.ts for Move and Lead phases and make T036–T039 pass

**Checkpoint**: A headless game can be played turn by turn with fixed rolls; all `US2-*` tests pass

---

## Phase 4: User Story 3 – Win or draw (Priority: P1)

**Goal**: Checkmate in *Before Turn*, King destroyed in Battle, and the three draws end the game with a result

**Independent Test**: Load prepared positions and check the result (spec US3)

### Tests for User Story 3 (write first, must fail) ⚠️

- [X] T049 [P] [US3] Write tests/rules/endgame.test.ts: `US3-AS1` (mate detected at next *Before Turn*, units only, range ignored, side that gave mate wins), `US3-AS2` (King left in check after a failed Lead, enemy successfully Leads into Battle with it → win), `US3-AS3` (both Kings in check at *Beginning of Turn* and *End of Turn* of the same turn → draw), `US3-AS4` (no unit could legally be Led even ignoring range → draw, checked when entering Lead), `US3-AS5` (draw offer accepted → draw; declined → play continues)

### Implementation for User Story 3

- [X] T050 [US3] Implement src/rules/endgame.ts: `isCheckmate(state, side)` (standard chess legality over Battlefield units, abilities and range ignored, per rulebook *Checkmate*), hook on entering `beforeTurn` that ends the game with `{ kind: 'win', by: 'checkmate' }`
- [X] T051 [US3] Implement King destroyed in src/rules/lead.ts + src/rules/endgame.ts: a successful Battle against a King ends the game immediately with `{ kind: 'win', by: 'kingDestroyed' }`
- [X] T052 [US3] Implement draws in src/rules/endgame.ts: record "both Kings in check" on entering `beginningOfTurn` and `endOfTurn` → `bothKingsInCheck`; on entering `lead` with no eligible unit ignoring range → `noEligibleUnits`; `offerDraw` / `answerDraw` with `pendingDecision: drawOffer` → `agreed`
- [X] T053 [US3] Set `status = 'ended'`, `result` with summary `{ turnsPlayed, destroyed: { light, dark } }`, emit `gameEnded`, and restrict `legalActions` after the end to `setEnforcement` only (FR-090) in src/rules/endgame.ts and src/rules/index.ts
- [X] T054 [US3] Implement the result screen in src/ui/result.ts (winner/draw reason, summary, buttons *New game*, *Rematch (same setup)*, *Continue in sandbox*) mounted in `#overlay` (FR-091); the sandbox button dispatches `setEnforcement('sandbox')` (wired fully in US6)

**Checkpoint**: Headless games reach a correct result; all `US3-*` tests pass

---

## Phase 5: User Story 1 – Set up and start a game (Priority: P1)

**Goal**: Pick player count, sides and heroes in Draft or Mirror order; each side (Light first) chooses its turn order and which hero starts behind which Bishop; start the game

**Independent Test**: Start a game with each player count and compare the starting state with the rulebook *Setup* section (spec US1)

### Tests for User Story 1 (write first, must fail) ⚠️

- [X] T055 [P] [US1] Write tests/rules/setup.test.ts: `US1-AS1` (2 players: each controls both heroes of one side), `US1-AS2` (3 players: the single player of a side controls both its heroes; on the other side one hero each), `US1-AS3` (Light chooses which hero plays turn 1 / 3, then Dark chooses turn 2 / 4; `setTurnOrder` for Dark is rejected before Light has chosen; the chosen order is used, not the pick order), `US1-AS4` (Well 16, hero pools 3, Common 0, Peace up, each hero on the start square its side chose: c-file Light (3,0) / Dark (3,9), f-file Light (6,0) / Dark (6,9); two heroes of a side on the same file rejected), `US1-AS5` (Draft order Light, Dark, Dark, Light; out-of-order `pickHero` rejected), `US1-AS6` (Mirror: Light's pick sets hero 1 for both sides, Dark's pick sets hero 2 for both sides; both sides end with the same two range types)

### Implementation for User Story 1

- [X] T056 [US1] Implement setup actions in src/rules/setup.ts: `status: 'setup'` state, `pickHero` (enforce Draft order Light → Dark → Dark → Light; Mirror: Light's pick sets hero 1 for both sides, then Dark's pick sets hero 2 for both sides) (FR-081), `setTurnOrder` (Light first, then Dark) (FR-082), `setStartFile` (one hero per c/f file per side) (FR-083), player assignment per FR-080, `startGame` (validates all picks, both turn orders and all start files, then calls the T033 initialisation)
- [X] T057 [P] [US1] Build setup screens in src/ui/setup/: player count + names + side assignment (src/ui/setup/players.ts), mode Draft/Mirror (src/ui/setup/mode.ts), hero picks in order showing Short (Move 5, Range 1, health 10) / Long (Move 3, Range 3, health 8) (src/ui/setup/picks.ts), turn order and Bishop choice per side, Light first, with a pre-selected suggestion the players can change (src/ui/setup/order.ts), summary with the chosen turn order and starting squares (src/ui/setup/summary.ts); all text via `t()`
- [X] T058 [US1] Wire setup flow in src/main.ts: setup screens dispatch actions to a `GameSession` (src/game/session.ts) and switch to the table view on `startGame`
- [X] T059 [US1] Write tests/e2e/setup.spec.ts: 4-player Draft setup through the UI, choosing a non-default turn order and Bishop for one side, reaches the table with that turn order and those starting squares shown

**Checkpoint**: Games can be configured and started through the UI; all `US1-*` tests pass

---

## Phase 6: User Story 7 – 3D table (Priority: P1)

**Goal**: The game is shown and played on a 3D table with placeholder art, highlights, HUD and a physics d20 rolled with a Roll button

**Independent Test**: Play one full turn with the mouse only; legal squares, the roll and the result are readable from the default camera (spec US7)

### Tests for User Story 7 (write first, must fail) ⚠️

- [X] T060 [P] [US7] Write tests/e2e/turn.spec.ts: `US7-AS1` (selecting a unit highlights legal destinations), `US7-AS2` (Roll button throws the die; face, modifiers, total and success/fail are shown; uses `window.__rosada.forceNextRoll(n)`), `US7-AS3` (active hero, phase, health, Movement and Range visible without menus); saves a screenshot of the default camera
- [X] T061 [P] [US7] Write tests/physics/d20.test.ts (Vitest, Node, Rapier compat): face-normal → number mapping covers 1…20 once each; a resting die with top-face dot < 0.98, outside the tray, or not asleep after 6 s is reported as invalid (FR-036)

### Implementation for User Story 7

- [X] T062 [P] [US7] Implement asset loading in src/table/assets.ts: read assets.json, build placeholder meshes (lathe profiles per unit type, distinct hero-short/hero-long figures, flat board, tavern markers, crystal, icosahedron d20 with numbers drawn to a canvas texture) or load `gltf`/`image` when present (FR-113, research R-12)
- [X] T063 [P] [US7] Implement src/table/scene.ts: WebGLRenderer on `#table`, one directional light with a small shadow map, `MeshStandardMaterial`, shared geometry per unit type, render on demand when nothing animates (research R-14)
- [X] T064 [P] [US7] Implement src/table/camera.ts: orbit + zoom with limits, default view from the active side, reset-camera control (FR-110)
- [X] T065 [US7] Implement src/table/board.ts: 10×10 board meshes from board.json with Battlefield checkering, King's Court, Wilderness and Tavern areas, Graveyard and Destiny Well zones beside the board
- [X] T066 [US7] Implement src/table/pieces.ts: sync unit, hero (several heroes per square offset in a ring), token and crystal meshes from `GameState` after every `apply`
- [X] T067 [US7] Implement src/table/picking.ts (raycast squares, units, heroes) and src/table/highlights.ts (selectable units, `legalMoveSquares`, `legalLeadTargets` with Battle targets marked) (FR-111)
- [X] T068 [US7] Implement src/table/animate.ts: tween units, heroes and tokens from `GameEvent`s (`heroMoved`, `unitLed`, `unitDestroyed`, `promoted`), queueing so state and visuals stay in order
- [X] T069 [P] [US7] Implement src/physics/world.ts: lazy `RAPIER.init()`, world with gravity, walled dice tray beside the board
- [X] T070 [US7] Implement src/physics/d20.ts and src/physics/roll.ts per research R-06: convex-hull d20 body, throw with random impulse and spin from `Math.random` (no seed; the result is logged via `submitRoll`), wait for sleep, top face = normal closest to world-up, valid only if dot ≥ 0.98, inside the tray and settled within 6 s, otherwise re-throw automatically; return the value (FR-034, FR-036); test builds honour `window.__rosada.forceNextRoll(n)` (mode `e2e` only)
- [X] T071 [US7] Implement HUD in src/ui/hud/: phase/turn bar (src/ui/hud/phase-bar.ts), hero panels with health, Movement left, Range, pool (src/ui/hud/heroes.ts), Common Pools, Well count, Peace/War and Revenge (src/ui/hud/pools.ts), Roll button + lead preview with modifiers and target 6 (src/ui/hud/roll.ts), action buttons *End phase*, *Undo*, *Offer draw* (src/ui/hud/actions.ts)
- [X] T072 [US7] Implement src/ui/dialogs.ts rendering every `pendingDecision` type (promotion, advanceSquare via table click, unconsciousTavern, inspiredLeadAmount, payDestiny, drawOffer, revengeChoice) and src/ui/log.ts showing the game log (FR-112)
- [X] T073 [US7] Wire table, physics and HUD in src/main.ts: input → `apply` → table sync + animations + HUD; `rollRequested` event shows the Roll button, physics result → `submitRoll` (FR-037)
- [X] T074 [US7] Run tests/e2e/turn.spec.ts and tests/e2e/setup.spec.ts headless, check the screenshot in test-results/ for readability, and fix layout issues in src/ui/hud/ and src/table/camera.ts

**Checkpoint**: 🎯 Browser MVP — a full chess-with-dice game with generic heroes plays in the browser from setup to result

---

## Phase 7: User Story 4 – Ram, wounds, Unconscious and taverns (Priority: P2)

**Goal**: Rams push and wound enemy heroes; heroes go Unconscious and recover; taverns sell Drinks and Meals within the shop window

**Independent Test**: Place a hero in a unit's path, Lead through it, check position, health and Destiny (spec US4)

### Tests for User Story 4 (write first, must fail) ⚠️

- [X] T075 [P] [US4] Write tests/rules/ram.test.ts: `US4-AS1` (enemy hero in path, including mid-path, lands one square past the Led unit's end square in the path direction, 3 wounds, Leading side +1 D), `US4-AS2` (all enemy heroes on a shared square Rammed, +1 D each; friendly heroes not), `US4-AS3` (Knight b1→c3 Rams hero on c3 → lands d3), `US4-AS4` (landing on a King or off the board → starting square), `US4-AS5` (push onto a square with another hero → they share), `US4-AS6` (friendly hero in path: square interacted, not Rammed, not wounded, Lead not blocked), `US4-AS7` (no Lead restriction next turn; `rammedBy` recorded), `US4-AS8` (King's Banishment: enemy hero to starting square, −1 Movement next turn; friendly heroes in the King's path pushed one square further in the direction the King is Led; a friendly hero pushed onto the King's end square, e.g. while castling, goes to their starting square); plus push onto a non-King unit square allowed (Q-17 default)
- [X] T076 [P] [US4] Write tests/rules/health.test.ts: `US4-AS9` (0 health → friendly tavern of choice, skip next turn, heal to half max at *Beginning of Turn* of the following turn: 10 → 5, 8 → 4)
- [X] T077 [P] [US4] Write tests/rules/taverns.test.ts: `US4-AS10` (buy at start of turn in a tavern before leaving), `US4-AS11` (free Meal in friendly tavern at *End of Turn*, blocked when King in check after Lead or no Lead possible), `US4-AS12` (start turn in tavern → Movement −1, total reduction ≤ 2), `US4-AS13` (pause Move in a tavern, buy, continue with leftover Movement), `US4-AS14` (no buying after leaving; no buying during a Short range Lead advance); healing never above max

### Implementation for User Story 4

- [X] T078 [US4] Implement src/rules/ram.ts: for each square in the Lead `path` (excluding the start square) Ram every enemy hero there: landing = one square beyond the Led unit's end square along the last step direction (sliding/pawn), or one more square in the direction of the Knight's 1-square leg; landing on a King or outside the 10×10 grid → hero's `startSquare`; landing on a non-King unit square allowed (spec Q-17 default); record `rammedBy`; emit `heroRammed` (FR-050, FR-052, FR-053, research R-10)
- [X] T079 [US4] Implement King's Banishment in src/rules/ram.ts: enemy heroes Rammed by a King go to their starting square with `movementPenaltyNextTurn += 1`; friendly heroes on the King's interacted squares are pushed one square further in the direction the King is Led (spec Q-18); a push onto the King's square or off the grid sends the hero to their starting square, so nothing is ever pushed into the King's square (King's Majesty) (FR-041)
- [X] T080 [US4] Implement wounds, healing and Unconscious in src/rules/heroes.ts: `wound(hero, n, source)` clamps at 0 and emits `heroWounded`; Ram wounds call `destiny.gain(leadingSide, 1, 'woundEnemyHero')` per enemy hero wounded; at 0 → `pendingDecision: unconsciousTavern` (friendly taverns), `skipNextTurn`, `recoverAtBeginningOfTurn`; `heal(hero, n)` clamps at max (FR-051)
- [X] T081 [US4] Implement turn skipping and Heroic Recovery in src/rules/turn.ts: a hero with `skipNextTurn` passes straight to the next hero (log entry); on the following turn's `beginningOfTurn` set health to `floor(max / 2)` and clear status
- [X] T082 [US4] Wire Ram into Lead resolution in src/rules/lead.ts (after the unit is placed and Battles resolved; fixed effect order from research R-08: Battle/Destroy → Ram wounds → Destiny gains → Peace/War flip → Revenge)
- [X] T083 [US4] Implement src/rules/taverns.ts: `tavernShopOpen` opens at `beginningOfTurn` when the hero is in a tavern and when the hero pauses the Move on a tavern square; it closes when the hero leaves; `buy('drink' | 'meal')` costs and heals from rules.json, paid from the hero pool or Common Pool (combined payment via `payDestiny` comes in US5); never during a Lead advance (FR-060)
- [X] T084 [US4] Implement tavern turn effects in src/rules/taverns.ts + src/rules/turn.ts: Movement −1 when the turn starts in a tavern (cap 2 total), free Meal on entering `endOfTurn` in a friendly tavern unless `abilitiesBlocked()` (FR-042)
- [X] T085 [P] [US4] Add Ram/wound/heal/Unconscious animations to src/table/animate.ts and a tavern shop panel (Drink/Meal buttons, shown only while the shop is open) to src/ui/hud/tavern.ts
- [X] T086 [US4] Make T075–T077 pass and extend tests/rules/contract.test.ts playouts to include heroes in unit paths

**Checkpoint**: Hero-vs-hero rules work; all `US4-*` tests pass

---

## Phase 8: User Story 5 – Destiny economy and general abilities (Priority: P2)

**Goal**: Every Destiny gain and spend is automatic and correct; Inspired Lead, Hero Retreat and Revenge work

**Independent Test**: Run a scripted game and compare every pool after each turn to a hand-kept ledger (spec US5)

### Tests for User Story 5 (write first, must fail) ⚠️

- [X] T087 [P] [US5] Write tests/rules/destiny.test.ts: `US5-AS1` (check +2, once per turn), `US5-AS2` (destroy one or more enemy units in one Battle +2; loser +1 per own unit destroyed), `US5-AS3` (Resilient Destiny examples: Short 10 → 7 gains 1; Long 8 → 3 gains 2; none for self/friendly wounds), `US5-AS4` (first gain flips Peace to War, Leads +2 after), `US5-AS8` (spending before depletion removes from play), `US5-AS9` (Well runs out → refill per rules, heroes stay Starting Heroes, notice event, play continues)
- [X] T088 [P] [US5] Write tests/rules/abilities.test.ts: `US5-AS5` (Inspired Lead X D → that turn's Lead +2×X, Before Lead, once per turn; with no Lead that turn the bonus is gone next turn and the D stays spent), `US5-AS6` (Hero Retreat 2 D at End of Turn → friendly tavern + free Drink; blocked when King in check after Lead or no Lead possible), `US5-AS7` (Queen destroyed → Revenge token, max 2 per side; discard to auto-succeed a Lead)
- [X] T089 [P] [US5] Write tests/games/scripted-game-01.test.ts: a full scripted game (actions + fixed rolls) asserting every pool after each turn against a hand-kept ledger in tests/games/scripted-game-01.ledger.json (SC-001, SC-003 prep)

### Implementation for User Story 5

- [X] T090 [US5] Implement Destiny gain sources in src/rules/destiny.ts and src/rules/lead.ts: check +2 (`turn.checkBonusClaimed`), destroy enemy +2 per Battle, own unit lost +1 per unit to the loser, wound enemy hero +1 (already wired in T080), failed Lead +1 (T043); none for friendly/self sources
- [X] T091 [US5] Implement Resilient Destiny in src/rules/destiny.ts: gain 1 D to the wounded hero's own pool for each point `p` of their health bar with `newHealth ≤ p < oldHealth` (contracts/data-files.md), only for wounds from enemy heroes and units (FR-054)
- [X] T092 [US5] Implement spending in src/rules/destiny.ts: `payDestiny` pendingDecision when the cost must be split between the hero pool and the side's Common Pool; reject with `NOT_ENOUGH_DESTINY` otherwise (FR-072)
- [X] T093 [US5] Implement Revenge in src/rules/tokens.ts: +1 when the side's Queen is destroyed, capped at `revengeMax` (2); `useRevenge` at announce time sets `needsRoll = false` and auto-success (FR-071, FR-033)
- [X] T094 [US5] Implement src/rules/abilities.ts: `inspiredLead` (Before Lead, X D, +2×X to this turn's Lead only, stored in `TurnFlags.inspiredLeadBonus` and dropped at the next `beforeTurn`, once per turn) (spec Q-19) and `heroRetreat` (End of Turn, 2 D, place in a chosen friendly tavern + free Drink, once per turn, blocked by `abilitiesBlocked()`) (FR-073)
- [X] T095 [US5] Implement the Well-depleted notice: `wellDepleted` event → HUD toast "The Epic Stage comes in a later version" in src/ui/hud/notice.ts; Well count shows "∞" after depletion in src/ui/hud/pools.ts (research R-09)
- [X] T096 [P] [US5] Add ability buttons (Inspired Lead with amount picker, Hero Retreat with tavern choice), Revenge button and pay-split dialog to src/ui/hud/actions.ts and src/ui/dialogs.ts
- [X] T097 [US5] Make tests/rules/destiny.test.ts, tests/rules/abilities.test.ts and tests/games/scripted-game-01.test.ts pass, fixing src/rules/destiny.ts, src/rules/abilities.ts and src/rules/tokens.ts

**Checkpoint**: Destiny ledger matches hand-kept ledgers; all `US5-*` tests pass

---

## Phase 9: User Story 6 – Sandbox mode (Priority: P2)

**Goal**: Turn rule enforcement off at any time or after the game, move anything freely, and turn it back on after a legality check

**Independent Test**: Switch to sandbox mid-game, move a King onto an occupied square, confirm it is allowed and logged (spec US6)

### Tests for User Story 6 (write first, must fail) ⚠️

- [X] T098 [P] [US6] Write tests/rules/sandbox.test.ts: `US6-AS1` (toggle off → free placement of units, heroes, tokens, counters), `US6-AS2` (after game end, *Continue in sandbox* keeps the final position editable), `US6-AS3` (no win/draw declared in sandbox), `US6-AS4` (free roll shown, not applied), `US6-AS5` (legal position → resume at *Before Turn* of the current active hero), `US6-AS6` (illegal position → list of problems, stays in sandbox); FR-104 (moved units count as Led, en passant cleared)

### Implementation for User Story 6

- [X] T099 [US6] Implement src/rules/sandbox.ts: `setEnforcement` action, `sandboxPlace` (any unit/hero to any square or Graveyard), `sandboxSet` (health, pool, common, revenge, peaceTreaty), free `submitRoll` not applied, no result checks while `enforcement = 'sandbox'`; log `sandboxToggle` (FR-100, FR-101, FR-102)
- [X] T100 [US6] Implement `validatePosition(state)` in src/rules/sandbox.ts with at least the FR-103 checks: "at most one unit per square; units only on the Battlefield; nothing sharing a square with a King; exactly one King per side; every hero on the board; no unpromoted main pawn on the enemy royal rank; health within 0…max; pools ≥ 0; at most 2 Revenge tokens per side"
- [X] T101 [US6] Implement resume in src/rules/sandbox.ts: on `setEnforcement('rules')` with no problems, mark every unit moved in sandbox `hasBeenLed = true`, clear `enPassantTarget`, clear `pendingDecision`, and enter `beforeTurn` of the current active hero (checkmate is checked first) (FR-103, FR-104)
- [X] T102 [P] [US6] Build sandbox UI: settings toggle with confirmation (src/ui/settings.ts), permanent sandbox indicator (src/ui/hud/sandbox-badge.ts), drag-and-drop of units/heroes via src/table/picking.ts, value editors for health/pools/tokens (src/ui/hud/sandbox-editors.ts), problems list dialog in src/ui/dialogs.ts
- [X] T103 [US6] Write tests/e2e/sandbox.spec.ts: quickstart manual check step 6 (Knight onto own King's square → problem listed; fix → resume at Before Turn)
- [X] T104 [US6] Make tests/rules/sandbox.test.ts and tests/e2e/sandbox.spec.ts pass, fixing src/rules/sandbox.ts and src/ui/

**Checkpoint**: All P0 stories work; all `US*` tests pass

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Checks across all stories

- [X] T105 [P] Extend tests/rules/contract.test.ts with guarantee 1 (`apply` never returns a state that fails `validatePosition` while `enforcement = 'rules'`) over 200 seeded random playouts
- [X] T106 [P] Add a second scripted full game with Rams, Unconscious and tavern use in tests/games/scripted-game-02.test.ts (+ ledger JSON) (SC-001, SC-003)
- [X] T107 [P] Add tests/e2e/perf.spec.ts measuring frame time over 10 s with the default camera (target 60 fps on the CI machine as a proxy for SC-005) and first-load time; lazy-load src/physics/ on first Roll if load misses the target (plan *Risks*)
- [X] T108 [P] Check every `RuleError.code` and UI string has an entry in src/data/strings.en.json (test in tests/i18n.test.ts)
- [X] T109 Run the quickstart.md manual check (steps 1–6) and fix any differences; update quickstart.md if commands changed
- [X] T110 Update README.md and CLAUDE.md with the final commands and folder layout; note any new Open Questions in spec.md

---

## Phase 11: Nice-to-Have (P1 requirements, only after Phase 10)

**Purpose**: FR-200…FR-204. Optional for this feature; each can ship independently

- [X] T111 [P] Save and resume in browser `localStorage` using the serialised `GameState` + `version`, with a *Resume game* option on the start screen (FR-200) in src/game/save.ts and src/ui/setup/players.ts
- [X] T112 [P] Export/import a game state file (JSON download/upload) in src/game/save.ts and src/ui/settings.ts (FR-201)
- [X] T113 [P] Rule reference panel showing the `RuleError.rule` section text for rejected actions in src/ui/hud/rule-panel.ts (FR-202)
- [ ] T114 [P] Physics-based free handling of pieces in sandbox (pick up, drop, knock over) using Rapier bodies in src/physics/sandbox.ts (FR-203)
- [X] T115 [P] Board-position editor reusing sandbox placement with save-as-fixture export in src/ui/position-editor.ts (FR-204)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup; BLOCKS all stories
- **US2 (Phase 3)**: depends on Foundational
- **US3 (Phase 4)**: depends on US2 (needs Lead and Battle)
- **US1 (Phase 5)**: depends on Foundational (T033 `createGame`); rules part can run in parallel with US2/US3; UI part needs T006 app shell
- **US7 (Phase 6)**: depends on US1 (start flow) and US2 (actions to render); US3 for the result screen
- **US4 (Phase 7)**: depends on US2 (Lead resolution); UI parts need US7
- **US5 (Phase 8)**: depends on US2 (Lead) and US4 (wounds, taverns) for Resilient Destiny, Hero Retreat and tavern payments
- **US6 (Phase 9)**: depends on US3 (results) and US7 (table interaction); rules part only on Foundational + US2
- **Polish (Phase 10)**: after all P0 stories
- **Nice-to-have (Phase 11)**: after Polish

### Story completion order

```text
Setup → Foundational → US2 → US3 ─┐
            └────────→ US1 ───────┴→ US7 (browser MVP) → US4 → US5 → US6 → Polish → Nice-to-have
```

### Within each story

- Tests first, failing, then implementation (constitution IV)
- Model/rules modules before UI
- Story checkpoint before moving on

## Parallel Opportunities

- Setup: T003–T008 in parallel after T001–T002
- Foundational: model types T009–T013, data files T014–T017, and tests T022/T025/T027/T029/T031/T035 in parallel with each other once their module exists
- US1 rules (T055–T056) in parallel with US2/US3
- US7: T062, T063, T064, T069 in parallel; HUD (T071) in parallel with table work after T063
- Each story's test-writing tasks marked [P] in parallel

## Parallel Example: User Story 2

```text
Task: "T036 [US2] Write tests/rules/move.test.ts (US2-AS1…AS3)"
Task: "T037 [US2] Write tests/rules/lead.test.ts (US2-AS4…AS8)"
Task: "T038 [US2] Write tests/rules/special-moves.test.ts"
Task: "T039 [US2] Write tests/rules/undo.test.ts"
```

## Parallel Example: User Story 7

```text
Task: "T062 [US7] src/table/assets.ts placeholders"
Task: "T063 [US7] src/table/scene.ts renderer and lights"
Task: "T064 [US7] src/table/camera.ts orbit and reset"
Task: "T069 [US7] src/physics/world.ts dice tray"
```

---

## Implementation Strategy

### MVP first

1. Phase 1 Setup + Phase 2 Foundational
2. Phase 3 US2 + Phase 4 US3 → **headless MVP**: complete games play in tests with fixed rolls
3. Phase 5 US1 + Phase 6 US7 → **browser MVP**: a full game in the browser (all P1 stories)
4. STOP and playtest internally (SC-001)

### Incremental delivery

5. US4 (heroes' world) → playtest
6. US5 (Destiny economy) → compare with hand ledgers (SC-003)
7. US6 (sandbox) → designers can test ability ideas by hand
8. Polish, then nice-to-haves as time allows

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- Commit after each task or logical group, on the feature branch
- If a task finds a rule gap, add it to spec.md *Open Questions* and continue with a documented default only if spec/plan already allow one

## Implementation notes (2026-11-03)

- **T005**: typescript-eslint supports TypeScript < 6.1 only, so ESLint was dropped as the task allows. `tests/boundaries.test.ts` (T031) and `tsconfig.rules.json` guard the engine-free folders; recorded in research R-04. `npm test` = typecheck (rules, app) + `check:data` + Vitest.
- **T030**: the seeded PRNG is test-only (`tests/helpers/rng.ts`); the game keeps no seed (FR-037, spec Q-22).
- **T047**: `undo(initial, history)` and `replay` live in `src/game/session.ts` and work on the action log; undo also stops at every phase change (FR-012).
- **T060**: besides the Playwright test, `tests/rules/presentation.test.ts` covers `US7-AS1…AS3` headless through `src/game/hud-model.ts`, so every acceptance scenario has a test against the headless core (constitution IV; analysis finding C1).
- **T072 / T092 / T093**: the pay split is a `pay` field on `buy`, `inspiredLead` and `heroRetreat` (UI dialog when more than one split works) instead of a `payDestiny` decision; Revenge is the `useRevenge` action while the roll is awaited instead of a `revengeChoice` decision. Contract and data model updated.
- **T102**: sandbox pieces move by drag-and-drop or by click → click.
- **T107**: the frame-time check runs in a `gpu` Playwright project with GPU flags; default headless Chromium uses SwiftShader. Measured on this machine (Intel UHD): median frame 16.7 ms, first load ≈ 2.7 s. Rapier is a separate chunk loaded on the first roll.
- **T111/T112**: save files hold the starting state + action log (`src/game/save.ts`); the browser slot autosaves after every action.
- **T114 (open)**: physics-based free handling of pieces in sandbox (pick up, drop, knock over) is not built. Sandbox placement works by drag-and-drop without physics. Optional P1 item.
- New Open Questions from building: spec Q-23 (Hero Retreat and the free Meal), Q-24 (a Lead in check cannot fail with v1 modifiers).
