# Research: Online Multiplayer and Hosting

**Feature**: `005-online-multiplayer` | **Date**: 2026-11-07 | **Plan**: [plan.md](./plan.md)

Each entry follows Decision / Rationale / Alternatives. Prices and package versions were checked on 2026-11-07 and MUST be confirmed again when buying the VPS and installing packages (T001).

---

## R-01 Hostinger plan: KVM VPS, not shared/cloud web hosting

**Decision**: Use a Hostinger **KVM 1** VPS: 1 vCPU, 4 GB RAM, 50 GB NVMe. Install the **Ubuntu 24.04 LTS** template (plain OS, no panel). Choose a European data centre near the players. Move up to KVM 2 only if SC-006 fails.

**Rationale**:
- An online room needs a Node.js process that runs all the time and holds WebSocket connections open for hours. A VPS gives root access and full control over processes, ports and nginx.
- KVM 1 lists at about USD 6.49/month on a 12-month term ([vpsbenchmarks](https://www.vpsbenchmarks.com/hosters/hostinger/plans/kvm-1), [valebyte price tracker](https://valebyte.com/en/providers/hostinger/)). Renewal prices are higher than the first term, so check the renewal price on Hostinger's page before buying.
- Load is tiny. One room is 2–4 sockets and a few actions per minute. Applying an action takes milliseconds, and the room log is kilobytes. Even KVM 1 has room for hundreds of rooms (SC-006 asks for 20).
- The same machine serves the static site (`dist/`) through nginx, so the whole game lives in one place under one domain. Same origin means no CORS setup.

**Alternatives considered**:
- **Shared Business / Cloud hosting with Hostinger's "Node.js web apps"**: some reviewers report Express + Socket.io working, and GitHub auto-deploy is convenient ([Capterra reviews](https://www.capterra.com/p/218357/Hostinger//reviews/)). Hostinger publishes nothing on how long WebSocket connections may stay open or how long app processes live. A managed process can be recycled at any time, which would cut every room. The plan also ties us to their app runtime. Rejected for the game server. It would be fine for the static site alone.
- **Static site on shared hosting + game server on the VPS**: two hosts, two deploys, and cross-origin WebSockets. No benefit over one VPS.
- **Hostinger VPS templates with Docker or Coolify**: they work, but they add a layer the game does not need (constitution VI). A systemd unit and nginx are enough (R-07).
- **Azure** (named in the constitution's hosting line as "can run on"): possible, but Luka chose Hostinger. The constitution's wording ("can run on Azure") is not a requirement. A PATCH amendment can name Hostinger (plan, Follow-ups).

## R-02 Server authority: same rules core, action log replication

**Decision**: The server runs the same `src/rules` core as the browser:
- It keeps each room as a `SaveFile` (starting state + action log, `src/game/save.ts`) plus room metadata.
- A client sends an **intent** (an `Action`, a roll request or an undo request). The server checks who sent it (R-03) and calls `apply(state, action)`. On success it appends the action and broadcasts `{ seq, action, check }` to everyone.
- Each client applies the same action with its own copy of the rules core.
- On joining or reconnecting, a client gets a **snapshot**: the save file, the current `seq` and the room metadata. It rebuilds the state with `replay()`.

**Rationale**:
- The rules core is pure and deterministic, with no seed: rolls are in the log (001 FR-037). So identical action lists give identical states on every machine.
- Actions are small (tens of bytes), while a full `GameState` is tens of KB. Broadcasting actions keeps traffic tiny, and it reuses replay, saves and undo unchanged.
- The server never takes a state from a client (FR-012). Clients cannot change anything except by sending an action the rules accept, from the right seat.

**Desync guard (FR-013, FR-014)**: every broadcast carries `check`, a 32-bit FNV-1a hash of the canonical JSON of the new state without its `log`. If a client's hash differs, or a `seq` is skipped, it asks for a fresh snapshot. The rules core already builds states the same way on both sides, so a mismatch means a bug or a version mismatch. R-10 blocks version mismatches at join.

**Alternatives considered**:
- **Server sends the full state after every action** (Colyseus Schema state sync): it needs every state type declared as a Schema class with decorators. That would duplicate the rules model outside `src/rules` and break constitution II/III. Rejected.
- **Peer-to-peer / host-authoritative client**: the host could cheat, and rooms would die when the host leaves. Rejected.
- **Lockstep without a server check**: any client could send illegal actions. Rejected (FR-010).

## R-03 Who may send which action (the authority rule)

**Decision**: one pure function, `actorFor(room, state)`, in `src/online/authority.ts`. It returns the seat ids allowed to act now. The server accepts an intent only if the sender's seat is in that set **and** `apply` accepts the action. In order:
1. **Setup, hero pick**: `nextPicker(setup)` gives the side. The seat is the side's `slot`-th seat, where `slot` is how many picks that side has made so far (capped to the side's seat count), the same mapping as `playerFor` in `src/rules/setup.ts`. In Mirror, Light's pick fills hero 1 of both sides, so Light's seat 1 makes that pick and Dark's seat 1 makes the next. Who picks is exactly the order of the hot-seat screen, done by the seat that owns that slot.
2. **Setup, turn order / start files / start game**: no seat. The server applies them itself (R-04).
3. **Pending decision**: `drawOffer` → every seat of the side that did not offer (Q-54). `promotion` → the seat of `chooserHeroId`'s player. `epicDestiny`, `reaction`, `abilityChoice`, `unconsciousTavern`, `advanceSquare` → the seat of `heroId`'s player.
4. **Otherwise**: the seat of the active hero's player (`hero.playerId`, already set by setup).

Seats map 1:1 to `SetupChoices.players`: seat `P1…P4` is `Player.id`. So `hero.playerId` already says which seat controls each hero, with no change to the rules core (FR-081).

**Rationale**: the rules core already knows the owner of every decision (`heroId`, `chooserHeroId`, `fromSide`) and of every hero (`playerId`). Keeping the rule in one pure, tested function lets the fuzz test (SC-004) check it exhaustively.

**Alternatives considered**: putting seat checks inside `apply`. That would add networking ideas to the rules core, and hot-seat does not need them. Rejected.

## R-04 Online setup: automatic turn order and starting squares

**Decision**: when `picksComplete(setup)` becomes true in an online room, the server applies, in order and as system actions (actor `server`):
- `setTurnOrder` for Light: its first pick plays turn 1;
- `setTurnOrder` for Dark: its first pick plays turn 2;
- `setStartFile`: the hero first in turn order starts at `c`, the other at `f`;
- `startGame`.

This is the Q-52 default. The system actions go in the log like any other action, so saves and replays stay standard. A different rule from Luka (Q-52) changes only `src/online/auto-setup.ts`.

**Rationale**: 001 decided online play sets these automatically (001 FR-082/083 notes). Pick order is the simplest rule that matches the hot-seat screen's pre-selected suggestion.

## R-05 Dice: server rolls, the client die lands on the value

**Decision**:
- The client sends `{ t: 'roll' }` (no value). The server accepts it only from the active seat and only while `awaitingRoll(state)`. It draws `crypto.randomInt(1, 21)` and applies `{ type: 'submitRoll', value }` as the sender's action.
- A client's own `submitRoll` intent is always refused (FR-020).
- In e2e and test mode only (`ROSADA_TEST=1`), the server takes a `forceNextRoll` message, mirroring the 002 e2e hook.

**Showing it (FR-022)**: a new `throwDieTo(dw, target)` in `src/physics/roll.ts`:
1. Run the normal `throwDie` simulation. It lands on some face value `v`.
2. If `v ≠ target`, find a rotation `R` of the icosahedron's symmetry group (60 rotations) that maps the face showing `target` onto the face showing `v`, in the die's own body frame.
3. Play the same frames with every orientation multiplied by `R` (`q' = q · R`).

The die is a regular icosahedron, so `R` maps the shape onto itself. Collisions, bounces and the resting pose look the same; only the numbers painted on it are "turned", and at rest the `target` face is up. `R` is precomputed once: for each pair of faces, there is a rotation mapping face A's normal and one of its vertices onto face B's. A unit test checks that for all 20 × 20 pairs, `topFace(q_end · R) = target`.

Every client simulates its own throw, so the tumbling may differ between screens while the result is the same. That is acceptable: FR-022 asks for the same value and a natural look, not identical frames. A player who reconnects during a roll gets no animation, only the result (US3-AS4).

**Rationale**:
- Fair: no client can choose or fake the value.
- It uses the 002 physics die unchanged, with no snapping to a face, and the log entry is the same `submitRoll` as hot-seat.
- `crypto.randomInt` is uniform with no modulo bias. Tests check uniformity with a chi-square test over 200,000 draws (US3-AS3).

**Alternatives considered**:
- **Accept the client's physics result**: trusts the client. Rejected by Luka (Clarifications).
- **Server simulates the physics throw and sends the frames**: needs Rapier on the server, means far more traffic, and gains nothing visible. Rejected.
- **Commit-reveal between players**: overkill for friends' games, with a trusted server. Rejected.

## R-06 Transport and room framework: Colyseus, messages only

**Decision**:
- Use **Colyseus 0.17.x** (the `colyseus` server package with its WebSocket transport, and the matching 0.17 client SDK in the browser). Pin exact versions at install. All Colyseus packages MUST be on the same minor version ([Colyseus FAQ](https://docs.colyseus.io/faq)).
- Use Colyseus only for rooms, joining by id, the socket transport and client reconnection. Use **no Schema state**: all game data goes in typed messages (contracts/protocol.md).
- The room code is the Colyseus `roomId`, so `joinById(code)` works directly.

**Rationale**:
- The constitution names Colyseus for online rooms.
- It handles the socket lifecycle (`onJoin`, `onLeave`, `onDrop` / `allowReconnection`), room ids and client reconnection ([reconnection docs](https://docs.colyseus.io/room/reconnection)), which saves building these by hand.
- Messages-only use avoids `@colyseus/schema` decorators, which would need `experimentalDecorators` under TypeScript 7 and would duplicate the state model (R-02).
- All room logic lives in a pure `RoomCore` (`src/online/`). The Colyseus room is a thin adapter of about 150 lines. Swapping Colyseus for plain `ws` later would touch only `server/` and `src/net/`.

**Alternatives considered**:
- **Plain `ws`** (one small dependency): it would mean writing our own room registry, ping/timeout and client reconnection. It is the fallback if Colyseus 0.17 does not install or run cleanly with TypeScript 7 / Node 24. In that case, swap the adapters and record the change in Complexity Tracking.
- **Socket.IO**: a heavier protocol, and no reason to prefer it over the named choice.

## R-07 Deployment layout on the VPS

**Decision** (details in contracts/deployment.md):
- **nginx** serves `dist/` (the static game) with long cache headers on hashed assets and `no-cache` on `index.html`. It proxies `/ws` (WebSocket upgrade) and `/api` to the game server on `127.0.0.1:2567`.
- **HTTPS**: Let's Encrypt via `certbot --nginx`. Renewal runs from the certbot systemd timer (FR-070). HTTP redirects to HTTPS.
- **Game server**: a `systemd` unit `rosada.service` (`Restart=always`, `User=rosada`, `Environment=NODE_ENV=production`) runs `node /opt/rosada/current/server/index.js` (FR-071).
- **Node.js 24 LTS** from the NodeSource apt repository.
- **Firewall**: `ufw` allows 22, 80 and 443 only. Port 2567 is bound to localhost. SSH uses keys, with password login turned off.
- **Releases**: `/opt/rosada/releases/<build-id>/` holding `dist/` and `server/`, with a `current` symlink. A deploy uploads a new release, moves the symlink, and restarts the service. Rollback means moving the symlink back.
- **Room files**: `/var/lib/rosada/rooms/` (R-09), outside the releases, so they survive deploys.
- **Domain (Q-59)**: an `A` record for the chosen domain or subdomain points to the VPS IP. Hostinger DNS works if the domain is registered there; any registrar works otherwise.

**Deploy (FR-072)**: `scripts/deploy.ps1 -Host <vps>` runs from Luka's Windows machine:
1. `npm test` and `npm run build`, which produces `dist/` and `dist-server/`.
2. Pack them as a tar and `scp` it to the VPS (Windows 11 ships `tar`, `ssh` and `scp`).
3. Unpack into a new release and `npm ci --omit=dev` there for the server's runtime dependencies.
4. Switch `current` and `systemctl restart rosada`.

Connected players see "reconnecting" for about a second; their rooms come back from disk (R-09).

**Alternatives considered**:
- **pm2**: an extra global dependency; systemd already restarts and starts on boot. Rejected (VI).
- **Build on the VPS from git**: needs a deploy key for the private repo and dev dependencies (Playwright, sharp) on the server. Rejected.
- **Docker**: see R-01.

## R-08 Server build and running TypeScript on the server

**Decision**: build the server with Vite's SSR build: `vite build --ssr server/index.ts --outDir dist-server`. It is one ES module bundle. It inlines the JSON data and the `src/rules`, `src/game` and `src/online` code, and keeps `colyseus` external. In development, run `tsx watch server/index.ts` (tsx is already a dev dependency), and add a Vite dev proxy for `/ws` and `/api` to port 2567, so `npm run dev` + `npm run dev:server` work like production.

**Rationale**: the rules core imports JSON without import attributes (`src/rules/data.ts`). Node's own TypeScript type stripping would need `with { type: 'json' }` on every import, and the build would not inline the data. Vite is already the build tool, so no new tool is needed.

**Alternatives considered**: `tsc` emit (keeps JSON imports, needs attributes); esbuild directly (would be a new dependency; Vite bundles it internally anyway); running `tsx` in production (a dev tool on the server). Rejected.

## R-09 Persistence, reconnect and room lifetime

**Decision**:
- **Room file**: `/var/lib/rosada/rooms/<code>.json` holds `{ room metadata, seats (with token hashes), save file, actors[] }`. It is written after every applied action and seat change, atomically (write `*.tmp`, then rename). It is small: a full game is under 200 KB.
- **On server start**, every room file younger than its lifetime (Q-56: 7 days in play, 24 hours in the lobby or ended) is loaded back. `RoomCore` is rebuilt by `replay()`, and its Colyseus room is created with the same `roomId` (FR-044).
- **Seat token**: on taking a seat, the server generates 128 random bits (`crypto.randomBytes(16)`, base64url). The client stores it in `localStorage` under `rosada.seat.<code>`. The server stores only its SHA-256 hash, so a leaked room file cannot be used to take seats.
- **Reconnect** (FR-040): opening `/#/room/<code>` with a stored token joins with `{ seatToken }`. The server matches the hash and puts the connection in that seat. For short drops, the Colyseus client also reconnects on its own (`allowReconnection(client, 60)` in `onDrop`). After that window, or after a server restart, the seat-token rejoin handles it. Either way the player is back in the seat, and a fresh snapshot brings the table up to date.
- **Lost token** (Q-55): the room creator, or if the creator is away, any seated player, can **release** an away seat. A released seat gets a new token for whoever takes it next.
- **Cleanup**: once an hour the server removes rooms past their lifetime: the file, and the room if it is loaded.

**Rationale**: the 001 save format already captures the whole game. Per-room JSON files are enough for a few hundred rooms, with no database to install or back up (VI).

**Alternatives considered**: SQLite or Redis (Colyseus presence/driver) — needed only for several server processes, which is out of scope. Rejected.

## R-10 Version check

**Decision**: Vite `define` adds `__BUILD_ID__` (git short hash + date) to the client and the server bundle. The server also computes a `dataHash` of the static data JSON. A client sends both when joining. If they differ, the server refuses the join with `VERSION_MISMATCH`, and the client shows "A new version is available — reload" (US5-AS3, FR-065). `index.html` is served `no-cache`, so a reload gets the new build.

## R-11 Security and abuse limits

**Decision** (FR-060…FR-064):

| Threat | Measure |
| --- | --- |
| Forged or illegal actions | `actorFor` + `apply`; client state and roll values never trusted (R-02, R-03, R-05) |
| Guessing room codes | 6 characters from a 31-letter alphabet without look-alikes (`23456789ABCDEFGHJKMNPQRSTUVWXYZ`; no 0/O, 1/I/L): 31⁶ ≈ 8.9 × 10⁸, so use **7** characters (≈ 2.75 × 10¹⁰ > 10⁹). Joining a full or started room needs a seat token anyway |
| Seat hijacking | 128-bit seat tokens, stored hashed; released only by another seated player (Q-55) |
| Flooding | WebSocket max payload 256 KB (a save upload is the largest message, under 200 KB); intents ≤ 4 KB; 20 messages/s per connection, then drop; 3 strikes → disconnect; at most 5 rooms created per IP per hour and 300 rooms in total |
| Malformed input | every message is validated against its type (a hand-written guard per message kind, `src/online/protocol.ts`) before it reaches `RoomCore`; save uploads go through `parseSaveFile` (001 FR-201) |
| Script injection via names | names are trimmed and limited to 1–20 characters with control characters removed, and always rendered with `textContent` (FR-063) |
| Eavesdropping | HTTPS / WSS only (nginx); HSTS header |
| Server exposure | port 2567 on localhost only; `ufw`; non-root service user; SSH keys only; unattended-upgrades for security updates |
| Personal data | only display names and games; no IPs stored beyond nginx's default logs (rotated, 14 days); no analytics (FR-064) |

## R-12 Testing approach

**Decision**:
- **Vitest, pure** (no network): `src/online` covers `RoomCore` seats, lobby, `actorFor`, auto-setup, undo ownership, roll handling with an injected roll source, persistence round trip, the protocol guards and cleanup. This is where most `US<n>-AS<m>` tests live. It also runs a uniformity chi-square test, and a `throwDieTo` test that needs Rapier but no DOM, so it runs in Node.
- **Vitest, server integration**: start the real Colyseus server on a random port and connect 2–4 client SDK instances in Node. Play the 004 scripted game through the server and compare the final state with the hot-seat replay (US2 independent test). Then run the **fuzz test** (SC-004): thousands of random legal, illegal, out-of-turn and malformed messages from every seat, checking afterwards that the server's log equals the accepted subset and replays cleanly.
- **Playwright**: a second `webServer` entry starts the game server in test mode on port 2568, and the e2e Vite server proxies to it. Multi-context tests cover create/join by code and link (US1), turn flow and refusal messages (US2), the forced server roll shown in every window (US3), reconnect after a page reload (US4), and the version-mismatch prompt (US5-AS3).
- **Deployment smoke test**: `scripts/smoke.ts <url>` opens the deployed site over HTTPS, checks the certificate, creates a room, joins it with a second client, and plays one Lead (US5).

## R-13 Client integration

**Decision**:
- Introduce a small `SessionLike` interface (`state`, `actions`, `dispatch`, `canUndo`, `undo`, `onChange`) in `src/game/session.ts`. Hot-seat's `GameSession` already fits it.
- `src/net/online-session.ts` implements it for online play. `dispatch` sends an intent and returns `pending`. Applied actions from the server go through `apply` locally and notify listeners exactly like `GameSession`, so the HUD, table, log and sheets work unchanged.
- In online play the Roll button sends `{ t: 'roll' }`. When the applied `submitRoll` arrives, the table plays `throwDieTo(value)` before showing the result, the same order as hot-seat today.
- The HUD greys out controls when `actorFor` does not include the local seat, and shows "waiting for <name>".
- New screens in `src/ui/online/`: Play online (name, create or join by code), the lobby (seats, take or change seat, start, copy link) and status badges (away, reconnecting). Strings go in `strings.en.json`.
