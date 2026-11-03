# Implementation Plan: Standard Rules Game (3D, hot-seat)

**Branch**: `001-standard-rules-game` | **Date**: 2026-11-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-standard-rules-game/spec.md`

## Summary

A browser game that plays the standard Rošada rules (rulebook 2.5 plus the corrections file) for 2–4 people on one device, with four generic heroes, on a 3D table. The game enforces every in-scope rule and can switch to a free sandbox and back.

Technical approach:
- **Rules core:** a pure, engine-free TypeScript rules core (`legalActions` / `apply` over an immutable, JSON-serialisable `GameState`) holds all rules, turns and Destiny.
- **Content:** heroes, health bars, board, units, tunables and art keys are JSON data.
- **3D table:** a Three.js table renders the state and sends actions.
- **Dice:** Rapier simulates the d20 throw (plain random impulse, no seed) and the top face is passed to the rules core as a number. Every roll is logged, so undo and replay never need the physics again.
- **Tests:** Vitest covers every acceptance scenario headless; Playwright drives the real page and takes screenshots.

## Technical Context

**Language/Version**: TypeScript 7.x on Node.js 24 LTS (build/test) and current desktop browsers (runtime)

**Primary Dependencies**: three 0.187.x, @dimforge/rapier3d-compat 0.21.x, Vite 8.x; dev: Vitest 5.x, @playwright/test 1.64.x, ajv 8 (JSON Schema validator for data files), tsx. ESLint was planned but dropped (no TypeScript 7 support yet, research R-04)

**Storage**: None in P0 (state in memory). P1 save/resume uses browser `localStorage` with the serialised `GameState`

**Testing**: Vitest (rules core, scenario tests `US<n>-AS<m>`, scripted full games), Playwright (headless browser smoke + screenshots), type check of the rules core without DOM types

**Target Platform**: Desktop Chrome, Edge, Firefox; static site (Vite build); hostable on any static host (Azure Static Web Apps possible)

**Project Type**: Single-project web application (client only, no backend in this feature)

**Performance Goals**: 60 fps on a mid-range laptop; first load under 10 s on a normal home connection (SC-005)

**Constraints**:
- The rules core may not import Three.js, Rapier, Colyseus or the DOM (constitution II).
- Rolls come from physics but enter the rules core as values (research R-06).
- Everything is mouse-driven.
- Placeholder art is used, referenced from data.

**Scale/Scope**:
- 1 game per browser tab, 4 heroes, 32 units.
- About 15 rules areas, 7 user stories and 58 functional requirements (53 P0, 5 P1).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
| --- | --- | --- |
| I. Rulebook is the source of truth | Every rule maps to the rulebook or the spec's *Resolved* / *Clarifications*. The one design reading (Ram landing on a unit) is logged as Q-17, not built silently | ✅ Pass |
| II. Engine-free rules core | `src/rules/` + `src/game/` compiled with no DOM lib and blocked from `three`, `@dimforge/*`, UI folders by `tests/boundaries.test.ts` (R-04; ESLint dropped, see R-04); rolls enter as values (R-06) | ✅ Pass |
| III. Data-driven content | Heroes, health bars, board, units, tunables, assets and strings are JSON with schemas ([contracts/data-files.md](./contracts/data-files.md)) | ✅ Pass |
| IV. Rules tested first | Test per acceptance scenario, failing test first for rule bugs, fixed rolls injected via `submitRoll`; random playout tests use a seeded generator inside `tests/` (R-13). No seed in the game itself (FR-037) | ✅ Pass |
| V. Verifiable without a human | `npm test`, `npm run test:e2e` run headless; Playwright screenshots; test-only hook to force a roll | ✅ Pass |
| VI. Keep it simple | No UI framework, no backend, one physics use (dice). P2 items exist only as seams (`abilities: []`, `originalType`, `rammedBy`, `well.depleted`) | ✅ Pass |

**Re-check after Phase 1 design**: ✅ Pass. The data model and contracts keep rendering and physics outside `src/rules/`, and all content is data. No violations, so *Complexity Tracking* is empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-standard-rules-game/
├── spec.md              # Feature spec (with Clarifications)
├── plan.md              # This file
├── research.md          # Phase 0: decisions R-01…R-14
├── data-model.md        # Phase 1: state, entities, data files
├── quickstart.md        # Phase 1: run, test, manual check
├── contracts/
│   ├── rules-api.md     # Rules core functions, actions, events, errors
│   └── data-files.md    # JSON data files and their rules
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
src/
├── rules/                 # ENGINE-FREE. No DOM, no three, no rapier
│   ├── model/             # GameState, Unit, Hero, Action, Event types
│   ├── board.ts           # 10×10 grid, regions, distances, adjacency
│   ├── paths.ts           # Unit paths, castling, en passant, promotion
│   ├── check.ts           # Threaten, protected, check, discovered check, checkmate
│   ├── heroes.ts          # Move, range, health, Unconscious, recovery
│   ├── lead.ts            # Announce, roll needs, modifiers, resolve, Battle
│   ├── ram.ts             # Ram, push, Knight push-back, King's Banishment
│   ├── taverns.ts         # Shop window, Drink/Meal, free Meal, Movement penalty
│   ├── destiny.ts         # Well, pools, gains, Resilient Destiny, spending
│   ├── tokens.ts          # Peace/War, Revenge
│   ├── abilities.ts       # General abilities: Inspired Lead, Hero Retreat
│   ├── turn.ts            # Phase machine, Active Hero hand-off, pending decisions
│   ├── setup.ts           # Draft/Mirror picks, per-side turn order + start square choice
│   ├── endgame.ts         # Checkmate in Before Turn, King destroyed, draws
│   ├── sandbox.ts         # Sandbox actions, validatePosition, resume rules
│   └── index.ts           # Public API (contracts/rules-api.md)
├── game/                  # ENGINE-FREE. Session: action log (with roll values), undo, replay, log formatting
├── data/                  # JSON data + schemas (contracts/data-files.md)
├── table/                 # Three.js: scene, camera, board, pieces, highlights, picking, animations
├── physics/               # Rapier: dice tray, d20 body, throw, top-face detection, re-roll
├── ui/                    # DOM HUD: setup screens, phase bar, hero panels, Roll button, dialogs, log, settings, result
├── i18n/                  # String loading (strings.en.json)
└── main.ts                # Wires game ↔ table ↔ physics ↔ ui

tests/
├── rules/                 # Vitest: one file per rules area, US<n>-AS<m> scenario tests
├── games/                 # Scripted full games with Destiny ledger checks
├── fixtures/              # Text-diagram positions + parser
└── e2e/                   # Playwright: smoke, one turn, sandbox, screenshots

tsconfig.json              # App (DOM)
tsconfig.rules.json        # src/rules + src/game, lib ES2022 only
vite.config.ts
vitest.config.ts
playwright.config.ts
scripts/check-data.ts      # npm run check:data (ajv + cross-file rules)
```

Tests also live in `tests/physics/` (d20 faces and Rapier throws in Node), `tests/helpers/` (test PRNG, game helpers), `tests/game/` (save files, fixture export) and at `tests/` root (`boundaries.test.ts`, `i18n.test.ts`).

**Structure Decision**: Single web project, because there is no backend in this feature. The engine-free folders (`src/rules`, `src/game`) are separated by folder, tsconfig and lint rule rather than separate packages. That is simpler, and it can be split into a workspace package when the Colyseus server arrives.

## Build Order

Follows the spec's phases. Each phase ends with its tests green and a short demo.

| Phase | Scope | Stories | Done when |
| --- | --- | --- | --- |
| A | Project scaffold, data files + schemas, board, paths, check/mate, Lead + d20 value input, turn phases, endgame | US2, US3 | All US2/US3 scenario tests pass headless |
| B | Three.js table with placeholders, picking + highlights, HUD, setup flow (Draft/Mirror picks, each side chooses turn order and start squares), physics d20 with Roll button | US1, US7 | A full chess-with-dice game plays in the browser; Playwright smoke passes |
| C | Hero Move/Range, Ram (incl. Knight, shared squares), health, Unconscious, taverns shop window | US4 | US4 tests pass; manual check steps 4–5 |
| D | Destiny ledger, Resilient Destiny, Peace/War, Revenge, Inspired Lead, Hero Retreat, payment from pools | US5 | Scripted games match a hand ledger (SC-003 prep) |
| E | Sandbox on/off, position validation, resume at Before Turn | US6 | US6 tests pass; manual check step 6 |
| P1 | Save/resume, export/import, rule reference panel, physics handling in sandbox, position editor | — | Only after P0 is complete |

## Risks

| Risk | Mitigation |
| --- | --- |
| Rule interactions not covered by the rulebook show up while building | Log as new Q-nn in the spec and keep the default documented; do not build silently (constitution I) |
| Physics die lands badly often (tilts, slides off tray) | Walled dice tray, damping tuned in a Playwright scene test, automatic re-roll (FR-036) |
| Rapier WASM size slows first load | `-compat` package is base64 inlined; lazy-load physics module on first Roll if load time misses SC-005 |
| Checkmate detection cost | Move generation is small (≤ 32 units); compute on demand at Before Turn only |

## Complexity Tracking

No constitution violations.
