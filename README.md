# Rošada – Battle of the Heroes (video game)

Video game adaptation of the Rošada board game, built as a **TypeScript web app (no game engine)** and developed spec-first with **[GitHub Spec Kit](https://github.com/github/spec-kit)**.

## Tech stack

Decided Nov 3, 2026. This replaces the earlier Unity plan and may change later.

| Part | Choice |
| --- | --- |
| Language | TypeScript, runs in the browser |
| 3D table and rendering | Three.js |
| Physics (pick up, throw, dice, stacking) | Rapier (WebAssembly, deterministic) |
| Multiplayer | Hot-seat/local, and online rooms for 2–4 players with Colyseus (Node.js), feature 005 |
| Hosting | Test: one free Render web service (site + game server). Go live: Hostinger KVM VPS (nginx, Let's Encrypt, systemd) |

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

Features 001 (standard rules, generic heroes, 3D table, hot-seat, sandbox), 002 (sandbox physics), 003 (Epic Stage, Royal Favors, Legendary Powers, table visuals) and 004 (the named heroes Cavalier, Monk, Scout and Magus with their 12 Epic forms and 84 abilities, and the Tabletop Simulator sheets, pieces and table) are built. Requires Node.js 24 LTS.

```powershell
npm install
npx playwright install chromium   # once, for browser tests
npm run dev                       # the game on http://localhost:5173
npm run dev:server                # the online game server on :2567 (Vite proxies /ws and /api to it)
npm test                          # type checks, data schemas, rules, online core and server tests (Vitest)
npm run test:e2e                  # browser tests (Playwright, own servers on ports 5174 and 2568)
npm run build                     # static site in dist/ and the game server in dist-server/
```

Feature 005 adds online play: **Play online** creates a room with a 7-character code and a link; friends join, take seats (side and hero), and each plays only their own heroes. The game server runs the same rules core, checks every action and rolls the d20; every browser shows the physics die landing on the server's value. A reload or a dropped connection brings the player back to their seat, and rooms survive a server restart. Free test deployment (now): one Render web service, [docs/deploy-render.md](docs/deploy-render.md) and `render.yaml`. Go live later on Hostinger: [docs/deploy-hostinger.md](docs/deploy-hostinger.md). Spec, plan and contracts: `specs/005-online-multiplayer/`.

| Folder | What it is |
| --- | --- |
| `src/rules/` | Engine-free rules core: `createGame`, `legalActions`, `apply` (no Three.js, Rapier or DOM); `abilities/` is the ability engine and `heroes/` the hero abilities |
| `src/game/` | Engine-free session: action log, undo, replay, HUD model, log text, save files |
| `src/online/` | Engine-free online rooms (005): `RoomCore`, seats, who may act, automatic setup, protocol, state check |
| `src/net/` | Browser connection to the game server and the online session |
| `server/` | Node.js game server: Colyseus room adapter, room files, limits, `/api/health` |
| `src/data/` | JSON data: board, units, heroes, abilities, health bars, tunables, assets, UI strings (+ schemas) |
| `public/tts/` | Tabletop Simulator art and models, made by `scripts/import-tts-assets.ts` |
| `src/table/` | Three.js table: board, pieces, highlights, picking, camera, dice view |
| `src/physics/` | Rapier d20: tray, throw, top-face reading |
| `src/ui/` | DOM HUD, setup wizard, dialogs, settings, result screen |
| `tests/` | Vitest (`rules/`, `games/`, `physics/`, `game/`) and Playwright (`e2e/`) |

See `specs/001-standard-rules-game/quickstart.md` and `specs/002-sandbox-physics/quickstart.md` for the manual checks.

Feature 006 brings the fixes and improvements from the first playtests (`specs/006-fixes-improvements/`, rulebook wording in its `rulebook-corrections.md`). Rules: 2 D for any new check (once per turn per side), 1 D per Destiny symbol on Starting abilities, *Inspired Lead* until the roll, Leads and abilities refused when they would check a King, *Preaching* one use or both, Mirror with different heroes per side, and the sandbox returning to the saved turn. Controls:

- **Move the hero**: click a square to see the shortest path with step numbers; click it again (or double-click) to walk there. `Esc` clears the plan.
- **Choose on the board**: ability targets light up on the board; click one. Hover a blocked square or an ability you cannot use to see why.
- **Space** ends the phase (not while a dialog is open). **A** opens the Royal Favors.
- **Pick a hero** in setup: click the card, then click it again to confirm.
- **Settings**: sandbox, Offer draw, save, export and import, new game, and **Resume game** to go back.
- **HUD**: the ability panel is docked on the right and folds with a click on its header; short messages slide to the log; "CHECK" blinks over a checked King and an "In check" box explains the rule on hover.
- **Table**: online each player always sees the table from their own side; one shared Royal Favor track (1…11) lies between the board and the Graveyard / Well strip; the table is the Tabletop Simulator model.

Feature 003 adds the rest of the basic rules: the Epic Stage (destiny choice, Common Pool split, Epic health, the War bonus ends), Hero Destiny Generation, Bloodied, the 12 Royal Favors with a tracker (button or `A`) and a track per side on the table, and the six Legendary Powers (Hero Units are units with `kind: 'hero'`; King's Forces creates auxiliary units). The table now looks closer to the Tabletop Simulator version: wooden table in a dim room, illustrated board border, Graveyard / Well strip, hero sheets with portrait, health track and Epic art, Royal Favor tracks and turn-order medallions. Older saves load with defaults for the new fields. See `specs/003-epic-stage/quickstart.md`; open rule questions are Q-35…Q-37 in its spec.

Feature 002 adds physics to sandbox mode (pick up, drop and knock over units and hero figures; `src/physics/sandbox.ts`), a 25% larger board, and up to 2 friendly units per square (a Battle there destroys all of them).
