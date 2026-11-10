# Tasks: Online Multiplayer and Hosting

**Input**: Design documents from `specs/005-online-multiplayer/` (spec.md, plan.md, research.md, data-model.md, contracts/, quickstart.md)

**Tests**: Required. Constitution IV and CLAUDE.md say every acceptance scenario gets a test named `US<n>-AS<m>`, written before its code.

**Format**: `- [ ] T### [P?] [US?] Description with file path`. [P] = can run in parallel (different files, no open dependency).

**Version note (2026-11-10)**: Colyseus is now at 0.18. Install `@colyseus/core` and `@colyseus/ws-transport` on the server, `@colyseus/schema` as their required peer (not used for state), and `@colyseus/sdk` in the browser, all 0.18.x and pinned exactly. Skip the `colyseus` meta-package: it also pulls in monitor, playground, auth and redis. Checked with a smoke test: custom `roomId`, `joinById`, messages-only, join errors.

---

## Phase 1: Setup

- [X] T001 Add the runtime dependencies `@colyseus/core`, `@colyseus/ws-transport`, `@colyseus/schema` and `@colyseus/sdk`, pinned to exact 0.18.x versions, in package.json; update research R-06 (0.17 → 0.18, which packages and why)
- [X] T002 [P] Add `src/online` to `ROOTS` in tests/boundaries.test.ts, and to `include` in tsconfig.rules.json, and forbid `node:` imports and `src/net` / `server` in the engine-free folders
- [X] T003 [P] Add `src/data/online.json` (code length 7, alphabet, name max 20, intent max 4096 bytes, max payload 262144, 20 msgs/s, 3 strikes, 5 creations per IP per hour, 300 rooms, lifetimes: playing 7 days, other 24 hours, reconnection window 60 s) with `src/data/schemas/online.schema.json`, and check it in scripts/check-data.ts
- [X] T004 [P] Add `__BUILD_ID__` (git short hash + date, or `dev`) through Vite `define` in vite.config.ts, plus the dev proxy for `/ws` and `/api` to `http://localhost:2567` (ws: true) and a `src/env.d.ts` declaration
- [X] T005 Add npm scripts in package.json: `dev:server` (`tsx watch server/index.ts`), `build:server` (`vite build --ssr server/index.ts --outDir dist-server`), and make `build` run both; add `dist-server/` to .gitignore

## Phase 2: Foundational (blocks every story)

- [X] T006 [P] Room types in src/online/model.ts exactly as in data-model.md: `Room`, `Seat` (`id` 'P1'…'P4', `side`, `heroSlots`, `name` "1–20 characters, trimmed, control characters removed; null = free", `tokenHash` "null = free or released", `connected`), `RoomConfig`, `RoomStatus` 'lobby' | 'setup' | 'playing' | 'ended', `RoomView`, `RoomFile` { format: 'rosada-room', version: 1, room }
- [X] T007 [P] Tests then code for src/online/codes.ts in tests/online/codes.test.ts: `ROOM_ALPHABET` = `23456789ABCDEFGHJKMNPQRSTUVWXYZ`, `newRoomCode(randomInt)` (7 chars), `normaliseCode` (upper-case, drop spaces and dashes), `cleanName` (trim, remove control chars, max 20, empty → null)
- [X] T008 [P] Tests then code for src/online/check.ts in tests/online/check.test.ts: `stateCheck(state)` = FNV-1a 32 over canonical JSON (sorted keys, `undefined` dropped) of the state without `log`; equal for a replayed copy, different after one action
- [X] T009 [P] `dataHash()` in src/online/version.ts: FNV-1a of the canonical static data (`DATA`) for the version check (research R-10), and `BUILD_ID` from `__BUILD_ID__` with a fallback for Node tests
- [X] T010 Export a `SessionLike` interface (`state`, `initial`, `actions`, `dispatch`, `canUndo`, `undo`, `onChange`) from src/game/session.ts; `GameSession implements SessionLike`; no behaviour change (existing tests stay green)

## Phase 3: User Story 1 – Create and join a room (P1) 🎯 MVP part 1

**Goal**: rooms, seats, lobby, start. **Independent test**: four clients create and join a 4-player room, take seats and start; everyone sees the same seat list and reaches hero picking.

- [X] T011 [US1] Tests `US1-AS1`…`US1-AS6` for the lobby in tests/online/room-lobby.test.ts against `RoomCore` with scripted `RoomDeps`: create (2/3/4 players, Draft/Mirror, 3-player single side), seat layout from `defaultPlayers`, take seat (returns token once; stores only the hash), change and leave seat in the lobby, start only by the creator when every seat is taken, refusals `ROOM_FULL` / `ROOM_STARTED` / seat taken
- [X] T012 [US1] `RoomCore` lobby part in src/online/room-core.ts (contracts/online-core-api.md): `create`, `takeSeat`, `leaveSeat`, `seatForToken`, `setConnected`, `start`, `view`; `Result` type; `room.save.initial = createSetup({ mode, playerCount, players })` with seat names as player names
- [X] T013 [P] [US1] Protocol types and guards in src/online/protocol.ts (contracts/protocol.md): client messages `takeSeat`, `leaveSeat`, `start`, `act`, `roll`, `undo`, `releaseSeat`, `rematch`, `resync`, `forceNextRoll`; server messages `snapshot`, `room`, `applied`, `undone`, `refused`, `seatToken`; `parseClientMessage` that returns null for anything malformed or over 4096 bytes, with tests in tests/online/protocol.test.ts

## Phase 4: User Story 2 – Play a full game online (P1) 🎯 MVP part 2

**Goal**: authority, auto setup, acting, undo. **Independent test**: the 004 scripted game played through `RoomCore` by the owning seats ends in the same state as the hot-seat replay.

- [X] T014 [US2] Tests for `actorFor` / `seatOfHero` / `canUndoBy` in tests/online/authority.test.ts (`US2-AS1`, `US2-AS4`, `US2-AS6`, `US2-AS7`): pick order in Draft and Mirror (research R-03 rule 1), active hero's seat, every pending-decision type, draw offer → every seat of the other side, 3-player single seat controls both heroes
- [X] T015 [US2] Implement src/online/authority.ts (research R-03)
- [X] T016 [US2] Tests then code for src/online/auto-setup.ts in tests/online/auto-setup.test.ts (`US2-AS2`): after the last pick, `setTurnOrder` Light (first pick plays turn 1), `setTurnOrder` Dark, `setStartFile` c for the first in turn order and f for the other, `startGame` (Q-52 default)
- [X] T017 [US2] Tests `US2-AS3`, `US2-AS5`, `US2-AS8` and guarantees G-1…G-3 in tests/online/room-play.test.ts: `act` accepted only for the owning seat and legal actions, refused with the rules' `RuleError` (code, message, rule), `NOT_YOUR_TURN` / `NOT_YOUR_DECISION`; `submitRoll`, `setEnforcement` and `sandbox*` refused with `NOT_ALLOWED_ONLINE`; replay(initial, actions) equals the state; `actors.length === actions.length`; rematch keeps the seats
- [X] T018 [US2] `RoomCore.act`, `undo` (FR-030), `rematch` and the `Applied` results (seq, by, check, roll) in src/online/room-core.ts, including auto-setup actions appended as `by: 'server'`
- [X] T019 [US2] Undo tests in tests/online/room-undo.test.ts: only the seat of the last action, only within the 001 undo limits, refused after another seat's action (`CANNOT_UNDO`)
- [X] T020 [US2] Scripted game through RoomCore in tests/online/scripted-online.test.ts: replay `tests/games/scripted-game-04` (or the newest scripted game) by sending each action from `actorFor`'s seat; final state equals the hot-seat replay; a roll inside comes through `roll` with forced values

## Phase 5: User Story 3 – Fair dice (P1) 🎯 MVP part 3

**Goal**: server rolls; client die lands on the value. **Independent test**: forced server roll 17 shows 17 in every window.

- [X] T021 [US3] Tests `US3-AS1`, `US3-AS2`, `US3-AS5` in tests/online/room-roll.test.ts: `roll` only from the active seat while `awaitingRoll`, value from `deps.randomInt(1, 21)`, `forceNextRoll` used once, applied as `submitRoll` by the sender's seat; a client `submitRoll` is refused
- [X] T022 [US3] `RoomCore.roll` and `forceNextRoll` in src/online/room-core.ts
- [ ] T023 [P] [US3] Uniformity test `US3-AS3` in tests/online/roll-uniform.test.ts (analysis C1, constitution IV): 200,000 rolls through `RoomCore.roll` with a **seeded** source passed in through `RoomDeps` (deterministic, no flake), chi-square with 19 degrees of freedom below the p = 0.001 critical value (43.82); plus a small test that `server/deps.ts` rolls with `crypto.randomInt`
- [X] T024 [P] [US3] `faceSymmetry(from, to)` in src/physics/d20.ts (a rotation of the icosahedron mapping face `from` to face `to`, body frame) and `throwDieTo(dw, target, random?)` in src/physics/roll.ts (research R-05); test in tests/physics/throw-to.test.ts: for all 20 × 20 face pairs, `topFace(q_end · R).value === target`, and `throwDieTo` ends on the target for several targets

## Phase 6: Server (serves US1–US4)

- [X] T025 [US1] server/deps.ts (server only; src/online stays engine-free): `RoomDeps` with `crypto.randomInt`, `randomBytes(16)` base64url tokens, SHA-256 hex, `new Date()`
- [X] T026 [US1] server/limits.ts: per-connection rate limiter (20 msgs/s, 3 strikes in a minute → disconnect), per-IP creation limiter (5 per hour), room cap (300); unit tests in tests/server/limits.test.ts
- [X] T027 [US1] server/rosada-room.ts: Colyseus `Room` adapter over `RoomCore`: `onCreate` (code as `roomId`, `autoDispose = false`, restore from file when given), `onJoin` (version check → `VERSION_MISMATCH`; seat token rejoin; otherwise lobby rules), `onDrop` (`allowReconnection` for the configured window), `onLeave`, `onMessage('*')` → `parseClientMessage` → RoomCore → `applied` / `undone` / `room` / `refused`; persist after every change through the store
- [X] T028 [US1] server/index.ts: `Server` with `WebSocketTransport({ maxPayload })` at path `/ws`, `GET /api/health` → `{ ok, buildId, rooms }`, define `rosada`, create rooms through the matchmaker with a fresh unique code, restore rooms from the store on start, hourly cleanup, `PORT` / `ROSADA_ROOMS_DIR` / `ROSADA_TEST` env (contracts/deployment.md)
- [X] T029 [US1] Integration test in tests/server/rooms.test.ts: start the server on a random port with a temp rooms dir; 4 `@colyseus/sdk` clients create and join by code, take seats, start (`US1-AS1`…`US1-AS6` over the wire); join with a wrong `buildId` fails with `VERSION_MISMATCH`
- [X] T030 [US2] Integration test in tests/server/game.test.ts: the scripted game through the server with 2–4 clients, each applying `applied` locally and matching `check` after every action; out-of-turn sends get `refused`
- [X] T031 [US2] Fuzz test (SC-004) in tests/server/fuzz.test.ts: thousands of random legal, illegal, out-of-turn and malformed messages from every seat; afterwards the server's log replays cleanly and equals what was broadcast; no client ever saw a `check` mismatch

## Phase 7: Client (US1–US3 in the browser)

- [X] T032 [US1] src/net/client.ts: wraps `@colyseus/sdk` (`create`, `joinById`, rejoin with the stored seat token, typed `send`, message subscriptions, connection status); endpoint is same-origin `/ws` (`ws://` in dev through the proxy, `wss://` in production)
- [X] T033 [US2] src/net/online-session.ts: `OnlineSession implements SessionLike`; applies `applied` actions with the rules core, checks `seq` and `check`, sends `resync` on a mismatch; `dispatch` sends `act` and returns a pending result; `undo` sends `undo`; exposes `mySeat`, `room`, `canAct(action)` via `actorFor`
- [X] T034 [US1] Play online screen and lobby in src/ui/online/ (`play-online.ts`: name, create with player count / mode / single side, join by code; `lobby.ts`: seat list with names and status, take/change seat, start, copy link) with strings in src/data/strings.en.json; names via `textContent` only
- [X] T035 [US2] main.ts integration: route `#/room/<code>` to the online flow; choose `GameSession` or `OnlineSession`; online setup shows only the picks for the local seat; HUD shows "waiting for <name>" and disables controls when the local seat is not in `actorFor`; no sandbox toggle or position editor online (FR-017)
- [X] T036 [US3] Roll in main.ts / table: online, the Roll button sends `roll`; on an `applied` with `roll: true`, play `throwDieTo(value)` and then show the result; skip the animation when catching up from a snapshot (`US3-AS4`)
- [X] T037 [US1] Playwright: tests/e2e/online-lobby.spec.ts (`US1-AS1`…`US1-AS6` in four browser contexts) with a second `webServer` in playwright.config.ts running the game server in test mode on 2568 and the e2e Vite server proxying to it
- [X] T038 [US2] Playwright: tests/e2e/online-play.spec.ts: picks per seat, auto setup, an out-of-turn click refused, a move seen by the others
- [X] T039 [US3] Playwright: tests/e2e/online-dice.spec.ts: `forceNextRoll(17)` via the test-mode message; every context shows 17 and the same result

## Phase 8: User Story 4 – Reconnect and resume (P2)

**Independent test**: reload one window mid-game: it is back in its seat with the current state.

- [X] T040 [US4] Tests `US4-AS2`…`US4-AS5` and G-4/G-7 in tests/online/room-persist.test.ts: `toFile` / `restore` round trip, no raw tokens in the file, release of an away seat by the creator (or any seated player when the creator is away, Q-55), `expiresAt` (7 days playing, 24 hours otherwise)
- [X] T041 [US4] `release`, `toFile`, `restore`, `expiresAt` in src/online/room-core.ts
- [X] T042 [US4] server/store.ts: atomic write (`.tmp` + rename) to `ROSADA_ROOMS_DIR/<code>.json`, load all, delete; tests in tests/server/store.test.ts
- [X] T043 [US4] Server restart test in tests/server/restart.test.ts (`US4-AS5`): play a few actions, stop the server, start a new one on the same dir, rejoin with seat tokens, the state matches
- [X] T044 [US4] Client: store `rosada.seat.<code>` on `seatToken`; on opening a room link rejoin with it; show "away" / "reconnecting" badges and a "release seat" button for away seats in src/ui/online/lobby.ts and the HUD
- [X] T045 [US4] Playwright: tests/e2e/online-reconnect.spec.ts (`US4-AS1`): reload a context mid-game, back in its seat within 10 s

## Phase 9: User Story 5 – The game on the internet (P2)

- [X] T046 [US5] Version mismatch (`US5-AS3`): the server refuses joins with another `buildId` / `dataHash`; the client shows "A new version is available — reload"; Playwright test in tests/e2e/online-version.spec.ts
- [X] T047 [P] [US5] scripts/vps-setup.sh: one-time Ubuntu 24.04 provisioning from contracts/deployment.md (users, NodeSource Node 24, nginx, certbot, ufw, unattended-upgrades, folders, systemd unit, nginx site, certificate) with `--domain` and `--email` arguments and no secrets in the repo
- [X] T048 [P] [US5] scripts/deploy.ps1 and scripts/rollback.ps1 (`-VpsHost`, `-User`): test, build, pack, scp, unpack into `/opt/rosada/releases/<buildId>`, `npm ci --omit=dev`, switch `current`, restart, check `/api/health`
- [X] T049 [P] [US5] scripts/smoke.ts `<url>`: HTTPS check, `/api/health`, create a room and join it with a second client over `wss://`
- [X] T050 [US5] Deployment guide docs/deploy-hostinger.md: exactly what Luka must buy, click and provide (plan, OS template, SSH key, domain DNS `A` record, email for Let's Encrypt), with placeholders; linked from quickstart.md and README.md

## Phase 10: User Story 6 – Save and continue online games (P3)

- [X] T051 [US6] Tests `US6-AS1`…`US6-AS3` in tests/online/room-save.test.ts: the room's save is a 001 save file; `RoomCore.create(config, deps, save)` builds seats from the save's players and resumes at its state; a save that does not replay is refused (`BAD_SAVE`)
- [X] T052 [US6] Create-from-save in src/online/room-core.ts, server/rosada-room.ts (`save` create option, ≤ 256 KB) and the Play online screen (upload a save file); Download save button online

## Phase 11: Polish

- [X] T053 [P] Update README.md (online play, server, deployment), CLAUDE.md (active feature built, commands `dev:server`, `build:server`), and quickstart.md if commands changed
- [ ] T054 Run `npm test`, `npm run build` and `npm run test:e2e`; all 001–004 tests stay green (FR-080)
- [ ] T055 Mark the spec Status as Built and record any new Open Questions found while building

## Phase 12: Analysis fixes (2026-11-10, decided by Luka)

- [ ] T056 [US3] H1: tests that `forceNextRoll` is refused (and the next roll stays random) when the server is not in test mode: RoomCore level in tests/online/room-roll.test.ts (a `testMode` flag on the server context) and over the wire in tests/server/rooms.test.ts with a server started without `testMode`
- [ ] T057 [US5] H2: Playwright test with no game server reachable: Play online shows "server not available" and a hot-seat game still starts and plays (US5-AS2, FR-073); tests/e2e/online-offline.spec.ts with a page route that blocks /ws and /api
- [ ] T058 [US2] Undo rule, tests first: tests/game/session-undo.test.ts (hot-seat) and tests/online/room-undo.test.ts (online): undo step by step across phase changes within the turn, stop at reveal events, enforcement changes and the Active Hero hand-off; online also stops at another seat's or the server's action; update 001 tests that assumed phase barriers
- [ ] T059 [US2] Undo rule, code: `isBarrier` in src/game/session.ts (reveal events, `enforcementChanged`, `turnStarted` / hand-off; not `phaseChanged`); `canUndoBy` in src/online/room-core.ts walks back the seat's own actions in the current turn; the `undone` broadcast names who undid what and the client log shows it
- [ ] T060 [US5] H3: nginx log format without client addresses in scripts/vps-setup.sh (and contracts/deployment.md); the game server never logs addresses; per-IP limits in server/limits.ts drop expired entries (test)

## Phase 13: Test deployment on Render (2026-11-10)

- [ ] T061 [US5] FR-074: server/static.ts serves `dist/` from the game server (index fallback, long cache for hashed `assets/`, no-cache for `index.html`, no path escapes) on the same port as `/ws` and `/api/health`; test in tests/server/static.test.ts
- [ ] T062 [P] [US5] render.yaml (Blueprint): free web service, Node 24, build `npm ci && npm run build`, start `node dist-server/index.js`, health check `/api/health`, auto-deploy from `005-online-multiplayer`, `ROSADA_ROOMS_DIR=/tmp/rosada-rooms`, `HOST=0.0.0.0`, no `ROSADA_TEST`
- [ ] T063 [P] [US5] docs/deploy-render.md: sign up, connect the repository, create from the Blueprint, the URL, the free-plan limits (sleep after 15 idle minutes, up to a minute to wake, rooms lost on restart or redeploy)
- [ ] T064 [US5] Deploy: push the branch, create the Render service from render.yaml (Luka approves the GitHub connection and any terms), run `scripts/smoke.ts <url>` and record the URL in quickstart.md

---

## Dependencies

- Setup (T001–T005) → Foundational (T006–T010) → US1 core (T011–T013) → US2 core (T014–T020) → US3 core (T021–T024).
- The server (T025–T031) needs the US1–US3 cores. The client (T032–T039) needs the server.
- US4 (T040–T045) needs the server and client. US5 (T046–T050) needs a working build. US6 (T051–T052) needs US4's persistence.
- Polish comes last.

## Parallel opportunities

- T002, T003 and T004 run in parallel; so do T006–T009; T013 runs alongside T011/T012; T023 and T024 run alongside T021/T022; and T047–T049 run in parallel.

## Implementation notes (2026-11-10)

- Built on branch `005-online-multiplayer` (merged with main after 004). All tasks done except the live deployment, which needs Luka's VPS, domain and SSH key (docs/deploy-hostinger.md lists what to provide).
- T020 uses seeded random games through RoomCore instead of the 004 scripted game (that one starts from a test position, not from setup); the server test (T030) plays the same way over the wire.
- T036 / T039: the e2e roll test starts the room from a save that stops at a roll (built in the page with the rules core), which also covers US6-AS2.
- Rejoin after a server restart (deploys): the client rejoins with its seat token when the Colyseus reconnect cannot come back (the reconnection token does not survive a restart).
- Found while testing, not part of 005: random play reaches a Move-phase dead end (a Scout steps f9 → f10 → f9, has no movement left, and may not end the Move phase on f9). Reproduction save kept outside the repo; a rules-core follow-up.

## Implementation strategy

- **MVP**: US1 + US2 + US3 (server, client, dice). It is playable on localhost and on the VPS.
- **Next**: US4 (reconnect) makes it robust; US5 puts it online; US6 is optional.
- Commit after each phase and push when the MVP is reviewable.
