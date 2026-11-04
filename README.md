# Rošada – Battle of the Heroes (video game)

Video game adaptation of the Rošada board game, built as a **TypeScript web app (no game engine)** and developed spec-first with **[GitHub Spec Kit](https://github.com/github/spec-kit)**.

## Tech stack

Decided Nov 3, 2026. This replaces the earlier Unity plan and may change later.

| Part | Choice |
| --- | --- |
| Language | TypeScript, runs in the browser |
| 3D table and rendering | Three.js |
| Physics (pick up, throw, dice, stacking) | Rapier (WebAssembly, deterministic) |
| Multiplayer | Hot-seat/local first (no server); online rooms later with Colyseus (Node.js) |
| Hosting | Static website + Node.js server (can run on Azure) |

**Keep a later engine switch cheap:** game rules, hero abilities and turn logic live in plain TypeScript modules that don't import Three.js, Rapier or Colyseus. Components (heroes, cards, tokens, board) are defined as data (JSON). The sandbox core (table, physics, decks, dice, hand zones, save/load) stays separate from the Rošada game module.

## Repository layout

| Path | What it is |
| --- | --- |
| `.specify/` | Spec Kit: constitution, templates, PowerShell scripts, git extension |
| `.specify/memory/constitution.md` | Project principles and rules (fill in with `/speckit-constitution`) |
| `.claude/skills/` | Spec Kit commands for Claude Code (`/speckit-*`) |
| `specs/` | One folder per feature (`001-…`, `002-…`), created by `/speckit-specify` |
| `src/` | Game source (TypeScript), created with the first feature |

## Spec-driven workflow

1. `/speckit-constitution` – establish project principles (once, then amend as needed)
2. `/speckit-specify` – describe a feature; creates `specs/NNN-name/spec.md` and a `NNN-name` branch
3. `/speckit-clarify` – *(optional)* resolve ambiguities before planning
4. `/speckit-plan` – technical plan for the feature
5. `/speckit-checklist` – *(optional)* requirement quality checklists
6. `/speckit-tasks` – break the plan into tasks
7. `/speckit-analyze` – *(optional)* cross-check spec, plan and tasks
8. `/speckit-implement` – build it

## Development

Feature 001 (standard rules, generic heroes, 3D table, hot-seat, sandbox) is built. Requires Node.js 24 LTS.

```powershell
npm install
npx playwright install chromium   # once, for browser tests
npm run dev                       # the game on http://localhost:5173
npm test                          # type checks, data schemas, rules tests (Vitest)
npm run test:e2e                  # browser tests (Playwright, own server on port 5174)
npm run build                     # static site in dist/
```

| Folder | What it is |
| --- | --- |
| `src/rules/` | Engine-free rules core: `createGame`, `legalActions`, `apply` (no Three.js, Rapier or DOM) |
| `src/game/` | Engine-free session: action log, undo, replay, HUD model, log text, save files |
| `src/data/` | JSON data: board, units, heroes, health bars, tunables, assets, UI strings (+ schemas) |
| `src/table/` | Three.js table: board, pieces, highlights, picking, camera, dice view |
| `src/physics/` | Rapier d20: tray, throw, top-face reading |
| `src/ui/` | DOM HUD, setup wizard, dialogs, settings, result screen |
| `tests/` | Vitest (`rules/`, `games/`, `physics/`, `game/`) and Playwright (`e2e/`) |

See `specs/001-standard-rules-game/quickstart.md` and `specs/002-sandbox-physics/quickstart.md` for the manual checks.

Feature 002 adds physics to sandbox mode (pick up, drop and knock over units and hero figures; `src/physics/sandbox.ts`), a 25% larger board, and up to 2 friendly units per square (a Battle there destroys all of them).
