# Quickstart: Sandbox Physics and Shared Unit Squares

**Feature**: `002-sandbox-physics`

How to check this feature once it is built. Setup and commands are the same as 001 ([001 quickstart](../001-standard-rules-game/quickstart.md)).

## Run

```powershell
npm install
npm run dev          # http://localhost:5173
npm test             # rules (stacked squares, validation), physics in Node, all 001 tests
npm run test:e2e     # browser: drag in sandbox, two units per square, resume
```

## Manual check (5 minutes)

1. **Bigger board.** Start any game. The squares are visibly larger than before (at least 20%); nothing beside the board overlaps the Graveyards, Well or dice tray.
2. **Pick up and drop.** Settings → Sandbox. Press on the g1 Knight, drag it over the board and release over f3. It falls, lands standing on f3, and the log shows the placement.
3. **Knock over.** Pick up a Rook and carry it through the row of Light pawns. Some pawns slide, at least one falls over. Pick a fallen pawn up and drop it: it lands standing.
4. **Two units on one square.** Drop a second Light pawn onto a square with a Light pawn. Both stand side by side and each can be selected. Turn rules back on: no problem for that square.
5. **Problems on resume.** Back in sandbox, drop a Dark pawn on that square and knock a Light Bishop off the table. Turn rules on: the game lists "Light and Dark units share …" and "… is not on the Battlefield or in a Graveyard" and stays in sandbox. The Bishop waits at the table edge.
6. **Fix and resume.** Drop the Dark pawn elsewhere and the Bishop into the Light Graveyard. Turn rules on: play resumes at *Before Turn*, every piece standing upright on its square.
7. **Battle on a shared square.** In sandbox put two Dark pawns on d5 and a Light Rook on d1 with a Light hero next to it, at War; resume and Lead the Rook to d5 with a winning roll. Both pawns go to the Dark Graveyard, Light gains 2 D, Dark gains 2 D (1 per pawn).

## Acceptance traceability

Every acceptance scenario in [spec.md](./spec.md) maps to a test named `US<story>-AS<scenario>` (Vitest for rules and physics, Playwright for dragging and clicking). Run one story:

```powershell
npx vitest run -t "US2-"
npx playwright test -g "US1-"
```

Contracts: [rules-api-changes.md](./contracts/rules-api-changes.md), [sandbox-physics.md](./contracts/sandbox-physics.md). Data: [data-model.md](./data-model.md).
