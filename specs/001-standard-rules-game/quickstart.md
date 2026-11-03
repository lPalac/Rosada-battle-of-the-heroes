# Quickstart: Standard Rules Game

**Feature**: `001-standard-rules-game`

How to run, test and check this feature once it is built. Commands are run from the repository root.

## Prerequisites

- Node.js 24 LTS (or 22.12+)
- Git
- For browser tests: `npx playwright install chromium` once

## Setup

```powershell
npm install
```

## Run the game

```powershell
npm run dev          # opens http://localhost:5173
```

Production build (static site in `dist/`):

```powershell
npm run build
npm run preview
```

## Tests

```powershell
npm test             # rules core: type check without DOM, lint boundaries, Vitest
npm run test:e2e     # Playwright: setup → one turn → sandbox toggle, saves screenshots to test-results/
npm run check:data   # validate src/data/*.json against their schemas
```

`npm test` fails if any file in `src/rules/` or `src/game/` imports Three.js, Rapier or DOM APIs (research R-04).

## Manual check (5 minutes)

1. Start a 4-player Draft game. Pick Short (Light), Long, Long (Dark), Short (Light). Light chooses its turn order and which hero starts behind which Bishop, then Dark does the same. Check that the turn order shown matches the choices and that each hero stands behind the chosen Bishop.
2. Turn 1 (Light): move the hero, Lead pawn e2→e4. No Roll button appears, because the Peace side is up.
3. Play until a capture. The Common Pool shows +2, the token flips to War, and the next Lead shows the Roll button with a +2 modifier.
4. Ram an enemy hero with a Rook. The hero lands one square past the Rook and loses 3 health, and the log shows the Resilient Destiny gained.
5. Move a hero into a tavern, pause, buy a Drink, continue moving. Buying is no longer offered after leaving.
6. Settings → Sandbox. Put a Knight on the square of its own King, then switch back to rules. The game lists "Light King shares a square" and stays in sandbox. Move the Knight away, switch again, and play resumes at Before Turn.

## Acceptance traceability

Each acceptance scenario in `spec.md` maps to a Vitest test named `US<story>-AS<scenario>`. Run one story:

```powershell
npx vitest run -t "US4-"
```
