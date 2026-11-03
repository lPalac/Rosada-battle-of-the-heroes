# Research: Standard Rules Game (3D, hot-seat)

**Feature**: `001-standard-rules-game` | **Date**: 2026-11-03 | **Spec**: [spec.md](./spec.md)

Phase 0 of `/speckit-plan`. Each entry: decision, why, what else was considered. Package versions are the latest on npm on 2026-11-03; pin exact versions in `package.json` when the project is created.

---

## R-01 Toolchain

**Decision**: TypeScript 7.x, Vite 8.x (dev server + build), Vitest 5.x (unit/scenario tests), Playwright 1.64.x (`@playwright/test`, headless browser tests), ESLint 10.x. Node.js 24 LTS (Vitest 5 needs Node ^22.12 or ^24).

**Why**: Vite gives a static build that can be hosted anywhere (constitution: static website). Vitest shares Vite's config and runs the rules core in Node without a browser. Playwright lets Claude run the game headless and take screenshots (constitution V).

**Alternatives**: Webpack/Parcel (slower, more config), Jest (needs separate TS transform setup), Cypress (heavier; Playwright already used in this environment).

## R-02 Rendering and physics libraries

**Decision**: `three` 0.187.x (+ `@types/three`) for the 3D table; `@dimforge/rapier3d-compat` 0.21.x for dice physics and, later, free sandbox handling.

**Why**: Already chosen in the tech-stack decision. The `-compat` package inlines the WebAssembly as base64, so it works with Vite without extra WASM loader config.

**Alternatives**: cannon-es (unmaintained), ammo.js (large, awkward API), `@dimforge/rapier3d-deterministic-compat` (same API with stricter cross-platform determinism; not needed because replays use recorded roll values, see R-06; can be swapped in later if online play needs re-simulation).

## R-03 UI layer (HUD, setup screens, dialogs)

**Decision**: Plain TypeScript + DOM with CSS, layered over the Three.js canvas. No UI framework in v1.

**Why**: Constitution VI (fewer dependencies). The HUD is small: phase/turn bar, hero panels, pools, Roll button, choice dialogs, log, settings, result screen.

**Alternatives**: React/Svelte/Lit. Revisit if the hero-ability spec brings a lot more UI.

## R-04 Enforcing the engine-free rules core

**Decision**: `src/rules/` and `src/game/` get their own `tsconfig.rules.json` with `"lib": ["ES2022"]` (no DOM types) and are type-checked separately. ESLint `no-restricted-imports` blocks `three`, `@dimforge/*`, `colyseus*` and any import from `src/table/`, `src/physics/`, `src/ui/` inside those folders. CI/`npm test` runs both checks.

**Why**: Constitution II says the rules MUST NOT import engine or DOM APIs. A compile-time and lint-time check makes that automatic instead of a review habit.

## R-05 Board coordinates

**Decision**: One 10×10 grid, `x` = 0…9 (left→right from Light's side), `y` = 0…9 (Light's King's Court → Dark's King's Court).

| Region | Squares |
| --- | --- |
| Battlefield | x 1…8 (files a…h), y 1…8 (ranks 1…8) |
| King's Court | y = 0 (Light), y = 9 (Dark), x 1…8 |
| Wilderness | x = 0 and x = 9, y 1…8 |
| Taverns | (0,0), (9,0) friendly to Light; (0,9), (9,9) friendly to Dark |
| Hero starting squares | Light (3,0) behind c1 Bishop, (6,0) behind f1 Bishop; Dark (3,9) behind c8, (6,9) behind f8 |

Units may only be on the Battlefield; heroes anywhere on the 10×10 grid. "Off the board" means outside the 10×10 grid. Square names in logs use chess notation for the Battlefield (`e4`) and `c0`/`f9`-style names for the Outskirts.

**Why**: One grid makes hero Move, Range (Chebyshev distance) and Ram pushes the same code everywhere; chess notation keeps logs readable for players.

## R-06 Dice: physics roll, value into the rules core

**Decision**:
1. Rules core reaches a state `awaitingRoll` after a Lead is announced (unless no roll is needed).
2. The UI shows the **Roll** button. Pressing it throws a d20 in a dice tray area of the table in Rapier with a random impulse and spin (`Math.random`; no seed, see below).
3. When the die body sleeps, the top face is the face whose normal is closest to world-up. The roll is valid only if that dot product is ≥ 0.98, the die is inside the tray, and it settled within 6 s; otherwise it re-throws automatically (FR-036).
4. The UI sends `submitRoll(value)` to the rules core. The value is stored in the game log and the state.

Replays and saved games use the stored values and never re-simulate physics. Headless tests call `submitRoll(n)` directly (FR-037). Because every roll value is in the log, the game needs no seed: the action log alone reproduces the game (Luka, 2026-11-03: "no need to seed the games unless technically necessary"). The only seeded generator is a test helper in `tests/` for random playouts (constitution IV).

**Why**: Gives a real physics roll as requested, keeps the rules core pure and testable, and avoids relying on bit-exact physics across browsers.

**Alternatives**: Game-decided number with steered animation (rejected by Luka); re-simulating physics from a seed for replays (fragile, needs the deterministic build).

## R-07 Game state and updates

**Decision**: Immutable `GameState` (plain JSON-serialisable object). The rules core exposes pure functions: `legalActions(state)` and `apply(state, action) → { state, events } | { error }`. Every change goes through `apply`. The UI only renders state and sends actions.

**Why**: Serialisable snapshots (FR-121), `apply` is deterministic so the action log replays the game exactly (undo, saves), easy tests, ready for a Colyseus server later that runs the same `apply`.

## R-08 Turn phases and player decisions

**Decision**: A phase machine per hero turn: `beforeTurn → beginningOfTurn → beforeMove → move → beforeLead → lead → afterLead → endOfTurn`. Automatic steps (checkmate check, Heroic Recovery, Movement penalties, free Meal, Active Hero hand-off) run on entering a phase. Where the rules need a player choice in the middle of an action, the state holds a `pendingDecision` (promotion piece, Unconscious tavern choice, Short range advance square, Inspired Lead amount, pay-from pool split, draw offer reply) and only the matching action is legal until it is answered.

**Simultaneous effects**: the rulebook lets the active player order effects in the same phase. In v1 none of the in-scope effects change outcome by order except Destiny Well depletion timing, which has no v1 consequence (no Epic Stage). Decision: resolve in a fixed documented order (Battle/Destroy → Ram wounds → Destiny gains → Peace/War flip → Revenge) and add player ordering with hero abilities.

## R-09 Destiny Well model

**Decision**: `well = { initialRemaining: 16, depleted: false }`. Gains take from `initialRemaining` until 0; then `depleted = true` and the Well is unlimited from then on (rulebook: no limit to Destiny from the Well; FAQ 11 for overflow). Spending before depletion removes Destiny from play; after depletion it returns to the Well, which has no visible effect because the Well is unlimited. The UI shows the count while `initialRemaining > 0` and "∞" after.

**Why**: Matches the rules with no crystal bookkeeping. When the Epic Stage arrives, `depleted` becomes its trigger.

## R-10 Rule edge resolutions used by the design

| Topic | Decision | Source |
| --- | --- | --- |
| Range | Chebyshev distance ≤ Range | Clarification |
| Ram landing (sliding/pawn) | One square beyond the Led unit's end square, along the last step direction | Rulebook Ram + FR-050; confirmed by Luka (spec Q-21) |
| Ram landing (Knight) | One square beyond the end square in the direction of the 1-square leg | Clarification |
| Ram landing blocked | King on landing square or off the 10×10 grid → hero to starting square | Rulebook |
| Ram landing on a square with a non-King unit | Allowed, whichever side the unit belongs to. The rulebook only forbids *voluntarily* ending a Move on an enemy unit; a push is not voluntary | Design reading, logged as spec Q-17 |
| Castling path | King's 2 squares interact (Banishment applies); Rook does not interact | Rulebook Castling |
| King's Banishment, friendly heroes | Pushed one square further in the direction the King is Led; onto the King's end square or off the grid → starting square (Majesty) | Rulebook King's powers + spec Q-18 |
| Inspired Lead bonus | Applies to the Lead of the same turn only; cleared with `TurnFlags` at the next `beforeTurn` | Spec Q-19 |
| Setup choices (hot-seat) | Draft: L, D, D, L picks. Mirror: Light picks hero 1 for both sides, Dark hero 2 for both. Then Light orders its heroes (turns 1/3) and places them behind the c/f Bishops, then Dark (turns 2/4) | Corrections file *Setup* + spec Q-02, Q-20 |
| Checkmate eligibility | Standard chess legal moves of units on the Battlefield, range ignored, abilities ignored | Rulebook Checkmate |
| King may not be Led into a threatened square | Threat computed with units only (heroes don't threaten in v1) | Rulebook Threaten |
| Draw (no eligible unit) | Checked when entering the Lead phase, range ignored | Rulebook Ending 3b |

The "Ram landing on a unit" row is a design reading, not a rulebook rule, so it is logged as Q-17 in the spec for Luka to confirm.

## R-11 Undo

**Decision**: The session keeps the action log (every action with its roll values). Undo rebuilds the state by re-applying the log without its last action (a cache of recent states is an allowed speed-up, not a requirement). `undo` is legal until an action produces a *reveal* event (roll submitted, unit Destroyed, hero Rammed/wounded, Destiny gained) or the phase changes to the next hero. Matches the designers' note in the rulebook.

## R-12 Placeholder art

**Decision**: `src/data/assets.json` maps every visual key (`unit.light.knight`, `hero.short`, `token.peace`, `board`, `die.d20`) to either `{"placeholder": "<shape>"}` (geometry built in code: lathe/cylinder pieces, flat-coloured board, icosahedron die with numbered texture drawn on a canvas) or `{"gltf": "assets/models/…glb"}` / `{"image": "assets/…png"}`. v1 ships only placeholders; real art is a data change (FR-113).

## R-13 Testing approach

**Decision**:
- **Rules tests (Vitest)**: one test file per area (`paths`, `check`, `lead`, `ram`, `taverns`, `destiny`, `turn`, `endgame`, `sandbox`). Every spec acceptance scenario has a test named after it, e.g. `US4-AS13 pauses Move in tavern to buy`.
- **Position fixtures**: a 10-line text diagram format (`K Q R B N P` / lowercase for Dark, hero markers `1-4`, `.` empty) parsed by a test helper, so scenarios are readable.
- **Scripted games**: full games from a list of actions and rolls, asserting state and the Destiny ledger after each turn (SC-001, SC-003).
- **Browser tests (Playwright)**: load, setup, one turn with a stubbed roll (test hook `window.__rosada.forceNextRoll(n)` only in test builds), sandbox toggle, screenshots of the default camera.
- Coverage target: every rule in the spec's Scope Summary (SC-002).

## R-14 Performance

**Decision**: Target 60 fps on a mid-range laptop (SC-005). 32 units + 4 heroes + tokens is small; use one shared geometry per unit type, `MeshStandardMaterial`, one directional light with a small shadow map, and render on demand when nothing animates. Rapier world exists only for the dice tray in v1 (a few bodies).
