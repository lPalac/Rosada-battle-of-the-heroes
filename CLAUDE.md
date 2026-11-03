# Rošada – Battle of the Heroes

Browser video game of the Rošada board game. Spec-driven with GitHub Spec Kit (`.specify/`). Principles are in `.specify/memory/constitution.md`; read it before planning or coding.

## Active feature

`specs/001-standard-rules-game/`: standard rules, generic heroes, 3D table, hot-seat, sandbox mode. Read `spec.md`, `plan.md`, `research.md`, `data-model.md` and `contracts/` before working on it.

## Tech stack

- TypeScript 7, Node.js 24 LTS, Vite 8
- three (3D table), @dimforge/rapier3d-compat (dice physics)
- Vitest (rules tests), Playwright (browser tests, screenshots)

## Rules that matter most

- `src/rules/` and `src/game/` are engine-free: no imports from `three`, `@dimforge/*`, DOM, or `src/table|physics|ui`. They change state only through `apply(state, action)`.
- Heroes, units, health bars, board, tunables and art keys are JSON in `src/data/`.
- Every spec acceptance scenario has a Vitest test named `US<n>-AS<m>`. Fix a rule bug with a failing test first.
- Rolls come from the physics die and enter the rules core as `submitRoll(value)`; tests pass fixed values.
- Rules source: `Basic Rules 2_5.docx` plus the tracked changes in `Basic Rules 2_5 - corrections.docx`. Don't invent rules: log unclear cases in the spec's Open Questions.

## Commands

```powershell
npm run dev        # local game
npm test           # type checks, lint boundaries, Vitest
npm run test:e2e   # Playwright
```
