# Implementation Plan: Online Multiplayer and Hosting

**Branch**: `005-online-multiplayer` | **Date**: 2026-11-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-online-multiplayer/spec.md`

## Summary

Play the existing game online with 2–4 friends in anonymous rooms, hosted on one Hostinger KVM VPS.

- **Server-authoritative, action-log replication** (research R-02): a Node.js game server runs the same pure rules core as the browser. It keeps each room as a 001 save file (starting state + action log), checks every intent for the right seat (`actorFor`, R-03) and for the rules (`apply`), and broadcasts accepted actions. Clients apply them with their own copy of the rules core and check a state hash after each one.
- **Rooms and seats**: a seat equals a `Player` in `SetupChoices`, so `hero.playerId` already says who controls each hero. All room logic is a pure `RoomCore` in the new engine-free folder `src/online/`, tested without a network.
- **Online setup**: players pick their own heroes. The server then sets turn order and starting squares automatically (R-04, Q-52).
- **Dice** (R-05): the server draws every d20 value with `crypto.randomInt`. Each client plays a normal physics throw, re-labelled with an icosahedral symmetry rotation, so the die lands on the server's value.
- **Reconnect** (R-09): 128-bit seat tokens (stored hashed). Room files on disk are written after every action and restored on server start.
- **Transport** (R-06): Colyseus 0.18, rooms and messages only (no Schema state). The Colyseus room is a thin adapter over `RoomCore`.
- **Hosting** (R-01, R-07): a KVM 1 VPS with Ubuntu 24.04. nginx serves `dist/` and proxies `/ws` and `/api`. Let's Encrypt provides HTTPS, a systemd unit runs the server, and Luka deploys with a PowerShell script from Windows.

## Technical Context

**Language/Version**: TypeScript 7.x; Node.js 24 LTS (browser build and game server); current desktop Chrome, Edge, Firefox

**Primary Dependencies**:
- Unchanged: three 0.187.x, @dimforge/rapier3d-compat 0.21.x, Vite 8.x; dev: Vitest 5.x, @playwright/test 1.64.x, ajv 8, tsx, sharp.
- New runtime dependencies: **Colyseus 0.18.x**: `@colyseus/core` + `@colyseus/ws-transport` (+ required peer `@colyseus/schema`) on the server, and `@colyseus/sdk` in the browser. Pinned exactly, all on one minor version (R-06, updated at implementation). Justified under constitution VI below.
- Node built-ins on the server only: `node:crypto` (rolls, codes, tokens, hashes), `node:fs` (room files), `node:http`.

**Storage**: Room files (JSON, one per room) in `/var/lib/rosada/rooms/` (R-09). The browser keeps seat tokens in `localStorage`. Save files keep the 001 format.

**Testing**:
- Vitest, pure: `src/online` (RoomCore, authority, auto setup, undo, rolls with an injected source, persistence, guards), `throwDieTo`, a chi-square roll test.
- Vitest, integration: the real Colyseus server on a random port with 2–4 Node clients. The 004 scripted game is played through the server, and a fuzz test sends thousands of random messages (SC-004).
- Playwright: a second web server runs the game server in test mode. Multi-context tests cover create/join, turn flow, rolls, reconnect and version mismatch.
- Deployment: `scripts/smoke.ts`. The 001–004 suites stay green.

**Target Platform**: Browser as before. Server: Ubuntu 24.04 LTS on a Hostinger KVM 1 VPS (1 vCPU, 4 GB RAM).

**Project Type**: Web application. The single front-end project gains a small Node.js game server in the same repository and `package.json`, sharing `src/rules`, `src/game` and `src/online`.

**Performance Goals**:
- An action reaches the other screens in ≤ 1 s for 95% of actions (SC-002). Server work per action is under 5 ms: one `apply`, one hash, one file write.
- Rejoin ≤ 10 s (SC-003). A snapshot is under 200 KB, and replaying a full game takes under 200 ms.
- ≥ 20 concurrent rooms on KVM 1 (SC-006); the design allows hundreds.
- First load ≤ 10 s (001), helped by nginx caching and compression.

**Constraints**:
- No change to `src/rules` behaviour (FR-081).
- `src/online` is engine-free and joins the boundary test.
- The server never trusts client state or roll values (FR-012, FR-020).
- No accounts and no personal data beyond display names (FR-064).
- Hot-seat works without the server (FR-073).

**Scale/Scope**:
- 6 user stories and about 40 functional requirements.
- New: `src/online/` (about 7 modules), `src/net/` (client adapter and online session), `src/ui/online/` (Play online, lobby, status), `server/` (entry point, Colyseus room adapter, room store, limits) and `scripts/` (VPS setup, deploy, rollback, smoke).
- Small additions in `src/game/session.ts` (`SessionLike`), `src/physics` (`throwDieTo`, face symmetries), `main.ts` (choosing a hot-seat or online session), the HUD (whose turn, greyed-out controls), the strings, `vite.config.ts` (dev proxy, build id) and `playwright.config.ts`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
| --- | --- | --- |
| I. Rulebook is the source of truth | No rules are added or changed. Online-only choices (auto turn order and starting squares, who answers a draw offer with two players on a side) come from 001's decisions or are logged as Q-52…Q-58 with defaults | ✅ Pass |
| II. Engine-free rules core | `src/rules` is untouched. The new shared `src/online` is engine-free (no Colyseus, Node, DOM or Three) and is added to the boundary test and `tsconfig.rules.json`. The server reuses the rules core headless, which is what II prepared for | ✅ Pass |
| III. Data-driven content | Heroes, units and rules stay in `src/data/`. Room limits and lifetimes go in `src/data/online.json` (new, with a schema). UI text goes in `strings.en.json` | ✅ Pass |
| IV. Rules tested first | Every acceptance scenario gets a `US<n>-AS<m>` test, written before its code. Authority and RoomCore tests come before the adapters. Server rolls are tested with an injected (scripted) roll source, which is the repeatable source IV asks for | ✅ Pass |
| V. Verifiable without a human | The server, rooms and the full scripted game run headless in Vitest. Multi-window flows run in Playwright with the test-mode server. Deployment is checked by `scripts/smoke.ts` and `/api/health`. The quickstart covers local runs and deployment | ✅ Pass |
| VI. Keep it simple | One new runtime dependency family: Colyseus, already named in the constitution's technology table. Its client and server packages are justified because they provide rooms, ids and client reconnection, used messages-only. No database (JSON files), no Docker, no pm2, no accounts. P2 items (spectators, timers, chat) are only seams | ✅ Pass |
| Technology Constraints | Multiplayer: "online rooms later with Colyseus (Node.js)", which this plan follows. Hosting: "static website; Node.js server for multiplayer later (can run on Azure)". Hostinger is an allowed host; a PATCH amendment to name Hostinger is a follow-up, not a gate | ✅ Pass |

**Re-check after Phase 1 design**: ✅ Pass.
- The contracts keep every rule decision in `src/rules`, the seat logic in the engine-free `src/online`, and Colyseus only in `server/` and `src/net/`. The boundary test already forbids `colyseus` imports in the engine-free folders.
- The deployment adds no runtime dependency beyond Colyseus (nginx, certbot and systemd are OS packages).
- No Complexity Tracking entries.

## Project Structure

### Documentation (this feature)

```text
specs/005-online-multiplayer/
├── spec.md               # Feature spec (Clarifications 2026-11-07; Open Questions Q-52…Q-59)
├── plan.md               # This file
├── research.md           # Phase 0: R-01…R-13
├── data-model.md         # Phase 1: Room, Seat, Intent, Applied action, Undo, room file
├── quickstart.md         # Phase 1: local run, tests, manual check, Hostinger deployment
├── contracts/
│   ├── protocol.md       # Client ↔ server messages, errors, limits
│   ├── online-core-api.md# src/online API and guarantees G-1…G-7
│   └── deployment.md     # VPS, systemd, nginx, scripts, post-deploy checks
├── checklists/
│   └── requirements.md   # Spec quality checklist
└── tasks.md              # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
src/
├── rules/                # unchanged (FR-081)
├── game/
│   └── session.ts        # + SessionLike interface
├── online/               # NEW, engine-free, shared by server and client
│   ├── model.ts          # Room, Seat, RoomView, RoomFile
│   ├── protocol.ts       # message types + guards
│   ├── authority.ts      # actorFor, seatOfHero, canUndoBy
│   ├── auto-setup.ts     # turn order / start files / startGame after picks (Q-52)
│   ├── check.ts          # stateCheck (FNV-1a)
│   ├── codes.ts          # room codes, names
│   └── room-core.ts      # RoomCore
├── net/                  # NEW, browser only
│   ├── client.ts         # Colyseus client wrapper: create, join, rejoin, messages
│   └── online-session.ts # SessionLike over the server
├── physics/
│   ├── d20.ts            # + faceSymmetry
│   └── roll.ts           # + throwDieTo
├── ui/
│   └── online/           # NEW: Play online, lobby, seat list, status badges
└── data/
    ├── online.json       # NEW: limits, lifetimes (+ schema)
    └── strings.en.json   # + online strings
server/                   # NEW, Node only
├── index.ts              # http + Colyseus server, /api/health, restore rooms, cleanup timer
├── rosada-room.ts        # Colyseus Room adapter over RoomCore
├── store.ts              # room files: atomic write, load, delete
└── limits.ts             # rate limits, per-IP room creation
scripts/
├── vps-setup.sh          # one-time VPS provisioning
├── deploy.ps1            # build, upload, switch, restart, health check
├── rollback.ps1
└── smoke.ts              # deployment smoke test
tests/
├── online/               # Vitest: RoomCore, authority, auto setup, undo, rolls, persistence, guards
├── server/               # Vitest: real server + Node clients, scripted game, fuzz (SC-004)
├── physics/              # + throwDieTo / faceSymmetry
└── e2e/online-*.spec.ts  # Playwright multi-context
```

**Structure Decision**: Keep one repository and one `package.json`. The server is a folder (`server/`) bundled by Vite's SSR build into `dist-server/` (R-08), so it shares the rules core and data with the client without a workspace setup. The shared online logic is engine-free in `src/online/`, and the Colyseus-specific code is confined to `server/` and `src/net/` (R-06).

## Phases for /speckit-tasks (guidance)

1. **Foundations**:
   - pin the Colyseus packages;
   - `src/online` model, codes and check;
   - add `src/online` to the boundary test and `tsconfig.rules.json`;
   - `online.json` + schema;
   - Vite build id and `dataHash`, dev proxy, `dev:server` and `build` scripts.
2. **US1 + US2 core** (P1): `authority.ts` and `auto-setup.ts`, then `RoomCore` seats, start, act and the views, with tests first (G-1…G-3).
3. **US3 core** (P1): `roll` with an injected source; `faceSymmetry` + `throwDieTo`; the chi-square test.
4. **Server** (P1): `server/` adapter, protocol guards and limits; integration test with the scripted game; fuzz test.
5. **Client** (P1): `SessionLike`, `OnlineSession`, Play online and lobby screens, HUD turn ownership, roll animation from `applied`; Playwright US1–US3.
6. **US4** (P2): store, restore and cleanup; seat tokens and rejoin; release seat; Playwright reconnect.
7. **US5** (P2): `vps-setup.sh`, `deploy.ps1`, `rollback.ps1`, `smoke.ts`, the version mismatch prompt; deploy to the VPS and run the deployment checks.
8. **US6** (P3): save download online; create a room from a save file; rematch.
9. **Polish**: strings, docs (README, CLAUDE.md active feature), all 001–004 suites green.

## Risks

| Risk | Mitigation |
| --- | --- |
| Colyseus 0.18 does not run cleanly with TypeScript 7 / Node 24 or the Vite SSR bundle (checked at implementation: it runs; kept external in the SSR bundle) | It is used only in `server/` and `src/net/`, behind `RoomCore`. The fallback is plain `ws` (R-06), recorded in Complexity Tracking if used |
| State hash differs between browser and server for equal states (key order, `-0`, `undefined`) | Both sides use the same bundled rules code; `stateCheck` canonicalises (sorted keys, drops `undefined`). The integration test compares hashes after every action of the scripted game |
| The re-labelled die looks wrong (face numbers vs mesh texture) | The rotation is in the body frame and is an exact symmetry; a unit test covers all 400 face pairs, and a Playwright screenshot shows the final face |
| A VPS reboot or deploy cuts connections | Rooms are restored from disk; clients rejoin with seat tokens automatically (US4); the deploy restart takes about 2 s |
| Hostinger first-term vs renewal price | Noted in R-01; KVM 1 is enough, and the move to KVM 2 is a plan change in hPanel |
| Domain not decided (Q-59) | Deployment takes the domain as a parameter; everything before US5 is independent of it |

## Follow-ups (not part of this plan)

- Constitution PATCH: name Hostinger in the Hosting row (currently "can run on Azure"), via `/speckit-constitution`.
- Spectators, turn timers, chat, public rooms, and accounts are later features (spec Out).

## Complexity Tracking

No constitution violations to justify.
