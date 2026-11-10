# Feature Specification: Online Multiplayer and Hosting

**Feature Branch**: `005-online-multiplayer`

**Created**: 2026-11-07

**Status**: Built (2026-11-10); not yet deployed

**Input**: User description: "Online multiplayer for 2–4 players with anonymous rooms (create, join by code or link), seats per side and hero, server-authoritative turn flow where each player acts only for their heroes, server-owned d20 rolls animated on the client physics die, reconnect/resume, and hosting on a Hostinger KVM VPS (static site + Node.js server, domain, HTTPS)."

**Builds on**: `specs/001-standard-rules-game` (rules core, setup, players and seats, hot-seat, action log, undo, saves), `specs/002-sandbox-physics` (physics die), `specs/003-epic-stage` and `specs/004-named-heroes` (Epic Stage, Royal Favors, the four named heroes and their abilities). This branch starts from `004-named-heroes`.

**Source rules**: No rule changes. The online game plays exactly the rules of 001–004. 001 already decided how online setup differs from hot-seat: players only pick heroes, and turn order and starting squares are set automatically (001 clarifications, FR-082, FR-083).

---

## Clarifications

### Session 2026-11-07

- Q: Which Hostinger plan? → A: A KVM VPS. It runs the website and the game server on one machine.
- Q: How many players per room? → A: 2–4, like hot-seat. With 4 players each side has two players; with 3, one side has a single player who controls both of its heroes.
- Q: Accounts or anonymous rooms? → A: Anonymous rooms. A player types a display name and creates or joins a room by code or link. No sign-up.
- Q: Who rolls the d20 online? → A: The server picks the value. Every player's screen plays the physics die landing on that value.

### Session 2026-11-10 (analysis round, decided by Luka, the game's designer)

- Q: Online turn order and starting squares (was Q-52)? → A: Pick order. Each side's first-picked hero plays first (Light turn 1, Dark turn 2) and starts behind the c-file Bishop; the second-picked plays turns 3 / 4 and starts at f.
- Q: How far back can a player undo? → A: Everything in their own turn until a reveal such as a dice roll; everyone sees the undo. Undo goes back step by step across phase changes inside the turn, back to the last reveal event (a roll, a destroyed unit, a wound) or the start of the turn. It never crosses the Active Hero hand-off or another player's action (a reaction or other decision). This changes 001 FR-012 for hot-seat too.
- Q: Access logs keep client IP addresses (nginx default)? → A: Drop IPs. Neither nginx nor the game server writes client addresses to disk; per-address limits stay in memory only.
- Q: Hosting now? → A: A free test deployment first: one free Render web service serves the website and the game server (a different URL is fine). Hostinger is a later "go live" step: production will be a subdomain of Luka's existing domain on a Hostinger KVM VPS (his Premium Web Hosting plan cannot run the server).

---

## Scope

**In:**
- Online rooms for 2–4 players: create a room, share a code or link, join, choose a seat (side and hero slot), start when every seat is filled.
- Online setup: each player picks the hero(es) of their own seat (Draft or Mirror). Turn order and starting squares are set automatically.
- The full game online: every player sees the same table, and each player may act only for their own heroes and for the decisions their heroes own. The server checks every action against the rules.
- Server-owned dice, shown on every screen as the physics die landing on the server's value.
- Leaving, refreshing and dropping connection: a player gets back to their seat and the game continues where it was.
- Undo for the acting player, within the same limits as hot-seat.
- Saving: download the online game as a normal save file; continue a saved game in a new online room.
- A free **test deployment** on Render: one web service serves the website and the game server from one Node process, over HTTPS, at a Render URL.
- **Go live (later step)**: hosting on a Hostinger KVM VPS under a subdomain of the project's domain with HTTPS, with documented deployment steps (scripts and guide are built; running them waits for the VPS).
- Hot-seat and the sandbox keep working, without the server.

**Out (later features):**
- Accounts, friends, user profiles (and any personal data they would bring), ratings, match history, public room lists and matchmaking.
- Chat (players use their own voice or chat app).
- Spectators.
- Turn timers.
- AI players and filling empty seats with bots.
- Sandbox mode (rules off) and the position editor in online rooms.
- Mobile layouts (desktop browsers as in 001).
- Running more than one game server machine.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 – Create and join a room (Priority: P1)

Luka opens the game, chooses **Play online**, types his name and creates a room. He chooses the number of players (2, 3 or 4) and the mode (Draft or Mirror). The game shows a short room code and a link. Friends open the link (or type the code), type their names and take a free seat. Each seat shows its side and which hero slot(s) it controls. When every seat is taken, the room creator starts setup.

**Why this priority**: Nothing else online works without getting players into one room.

**Independent Test**: Open four browser windows. Window 1 creates a 4-player room, windows 2–4 join by link or code and take the other seats, and window 1 starts. All four see the same seat list and reach hero picking.

**Acceptance Scenarios**:

1. **Given** the start screen, **When** a player chooses Play online, enters a name and creates a 4-player Draft room, **Then** they get a room code and a link, and they sit in a seat of their choice (Light seat 1 by default).
2. **Given** an open room, **When** a second player opens the link or enters the code and a name, **Then** they see the room's seats, who sits where, and can take any free seat.
3. **Given** a 3-player room, **Then** the seats are one side with one seat (both of its heroes) and the other side with two seats (one hero each), and the creator chooses which side has the single seat before anyone joins.
4. **Given** a room where every seat is taken, **When** the creator starts, **Then** every player moves to hero picking at the same time. **Given** a free seat, **Then** start is not possible.
5. **Given** a code that does not exist, or a room that is full or already playing, **When** someone tries to join, **Then** they get a clear message and are not let in (except a returning player, US4).
6. **Given** a player in the room before start, **When** they leave or change seat, **Then** every other player sees the change within 1 second.

---

### User Story 2 – Play a full game online (Priority: P1)

Each player picks the hero for their own seat in the Draft or Mirror order. Turn order and starting squares are set automatically. In play, the active hero's player moves, leads and uses abilities. The others see every step on their own table as it happens but cannot act. When a decision belongs to another player's hero (a reaction during an enemy Lead, a promotion, an Epic destiny, a tavern choice, an answer to a draw offer), only that player is asked.

**Why this priority**: This is the feature: the existing game, played across the internet.

**Independent Test**: Four windows play a scripted game (the 004 scripted game) to its result, each window sending only its own players' actions. Every window ends with the same final state as the hot-seat replay of the same actions.

**Acceptance Scenarios**:

1. **Given** online hero picking, **Then** each pick is made by the player of the seat that owns that hero slot, in the 001 pick order, and the others see each pick when it is made.
2. **Given** all heroes are picked, **Then** turn order and starting squares are set automatically in pick order (Clarifications 2026-11-10) and shown to everyone before turn 1.
3. **Given** it is hero H1's turn, **When** H1's player moves, leads or uses an ability, **Then** every other screen shows the same change within 1 second.
4. **Given** it is H1's turn, **When** another player tries to act (or sends an action by hand), **Then** the server refuses it, nothing changes, and that player is told it is not their turn.
5. **Given** an action the rules forbid, **When** any player sends it, **Then** the server refuses it with the same rule message hot-seat would show, and the game state does not change.
6. **Given** a pending decision owned by a hero (reaction, promotion, Epic destiny, tavern or advance square, ability choice), **Then** only that hero's player can answer it, and everyone else sees who is deciding.
7. **Given** a draw offer from one side, **Then** any player of the other side can accept or decline it (Q-54).
8. **Given** the game ends, **Then** every player sees the same result screen, and the room offers a rematch with the same seats.
9. **Given** it is the acting player's turn, **When** they undo, **Then** they can go back step by step through their own turn, across phase changes, to the last reveal (a roll, a destroyed unit) or the start of the turn; every player sees each undo and the log says who undid what. **Given** another player has acted since (a reaction or decision) or the turn has passed, **Then** undo is refused.

---

### User Story 3 – Fair dice everyone sees (Priority: P1)

When a Lead needs a roll, the active player presses Roll. The server picks the value, and every screen plays the physics die tumbling and landing on that value at the same time. No player can choose or fake a roll.

**Why this priority**: Online, a die rolled on a player's own computer could be faked. The die decides battles, so it must be fair and the same for everyone.

**Independent Test**: In an e2e room with the server's test roll source, force the next roll to 17. The active window presses Roll; all windows show the die landing on 17 and the same Lead result.

**Acceptance Scenarios**:

1. **Given** a Lead waiting for a roll, **When** the active player presses Roll, **Then** the server picks a value from 1 to 20, applies it, and every player sees the die land on that value and the same result.
2. **Given** a Lead waiting for a roll, **When** any player sends a roll value of their own, **Then** the server ignores the value and refuses the action.
3. **Given** many server rolls, **Then** every value 1–20 is equally likely (checked statistically in tests).
4. **Given** a player who is reconnecting while a roll happens, **Then** they see the result (value and outcome) without the animation.
5. **Given** a Revenge token use or any other decision that comes before the roll, **Then** it is still made by the active player before pressing Roll, as in hot-seat.

---

### User Story 4 – Reconnect and resume (Priority: P2)

A player refreshes the page, closes the tab by mistake, or loses connection. When they come back on the same browser, they are back in their seat, with the table as it is now. The other players see that the player is away, and the game waits for them when it is their turn or their decision.

**Why this priority**: Online games of Rošada are long. A dropped connection must not end the game.

**Independent Test**: In a 2-player room mid-game, close window 2 and open the room link again in the same browser profile. Window 2 shows the current position, and play continues.

**Acceptance Scenarios**:

1. **Given** a player in a room, **When** they refresh or reopen the room link on the same browser, **Then** they are back in their seat within 10 seconds with the current state, without typing anything.
2. **Given** a player who is away, **Then** the others see "away" next to that player's name; the game goes on until it needs that player, then shows "waiting for <name>".
3. **Given** a player who lost their seat token (another browser, cleared data), **Then** the room creator can let them take back their seat (Q-55), and no one else can take a seat that belongs to someone.
4. **Given** every player has left a room, **Then** the room is kept for at least 24 hours (Q-56) and can be continued from the link.
5. **Given** the game server restarts (update or crash), **Then** rooms in progress are restored and players can reconnect to them. *(Built and tested locally. On the free test deployment the disk is temporary, so rooms are lost on a restart there; required again at go live on Hostinger.)*

---

### User Story 5 – The game on the internet (Priority: P2)

Anyone with the link can open the game at the project's address in a desktop browser, over a secure connection, and play hot-seat or online. Luka can put a new version online by following documented steps.

**Why this priority**: Friends cannot play online unless the game is hosted.

**Independent Test**: Test deployment: the game loads at its Render URL over HTTPS and `scripts/smoke.ts <url>` passes (a room is created and joined over wss). Go live (later): follow the quickstart on a fresh Hostinger VPS: the game loads at the domain over HTTPS, a 2-player room works between two different networks, and the browser shows no security warnings.

**Acceptance Scenarios**:

1. **Given** the game is deployed (test deployment on Render now, Hostinger at go live), **When** someone opens its address in a desktop browser, **Then** the game loads over HTTPS with a valid certificate within the 001 load target (on the free plan, after a wake-up of up to about a minute when it was idle). Checked by `scripts/smoke.ts`.
2. **Given** the deployed game, **Then** hot-seat and the sandbox work exactly as locally, with or without the game server running.
3. **Given** a new version is deployed, **Then** players with an older version open in their browser are told to reload instead of joining a room with a mismatched version.
4. **Given** the server machine restarts, **Then** the website and the game server start again without anyone logging in. *(Deployment check.)*
5. **Given** the quickstart, **Then** a new version can be deployed in under 15 minutes by running the documented commands. *(Deployment check at go live on Hostinger; on Render every push to the branch deploys.)*

---

### User Story 6 – Save and continue online games (Priority: P3)

Any player can download the online game as a save file. The room creator can start a new room from a save file, and the game continues from that position with players taking the seats.

**Why this priority**: Useful for long games and for moving a game between hot-seat and online, but rooms already survive disconnects (US4).

**Independent Test**: Download a save from an online room, create a new room from it, seat two players, and check the position matches.

**Acceptance Scenarios**:

1. **Given** an online game, **When** a player downloads the save, **Then** it is a normal save file (001 format) that loads in hot-seat.
2. **Given** a save file (hot-seat or online), **When** the creator starts a room from it, **Then** the room has seats for that game's player count and sides, and after everyone sits the game continues at the saved position.
3. **Given** a save file that does not replay, **Then** the server refuses it with the same message as loading it in hot-seat.

---

### Edge Cases

- Two players press a button at the same moment: the server applies actions one at a time in arrival order; the second is checked against the new state and may be refused.
- A player acts while their screen is behind (slow connection): the action is checked against the server's state, never the player's; a refused action does not change anything.
- A player answers a decision that was already answered: refused as "nothing to decide".
- The active player is away for a long time: the game waits (no timers, Q-57). Other players can leave and come back later (US4).
- A player leaves a 3- or 4-player room before start: their seat is free again.
- A player wants to undo after another player has already acted (for example a reaction): not possible; undo only goes back through the acting player's own actions in their turn, to the last reveal (FR-030).
- Someone sends malformed, huge or very many messages: the server drops them and may disconnect that client; the game state does not change.
- A room link is shared beyond the friends: once all seats are taken, no one else can get in.
- The server is down: online play shows "server not available"; hot-seat still works.
- A player's browser is not supported: the same message as 001.
- Room code typed in lower case or with spaces: accepted.

## Requirements *(mandatory)*

### Functional Requirements

**Rooms and seats**

- **FR-001**: A player MUST be able to create a room by entering a display name (1–20 characters), choosing the player count (2, 3 or 4), the mode (Draft or Mirror) and, for 3 players, which side has the single seat.
- **FR-002**: Each room MUST get a room code of at least 6 characters, easy to read aloud (no look-alike characters), and a link that opens the room directly. Codes MUST be hard to guess (FR-061).
- **FR-003**: Seats MUST follow 001's players and sides (FR-080): one seat per player; each seat has a side and the hero slot(s) it controls. With 3 players, the single seat of a side controls both of that side's heroes.
- **FR-004**: Players MUST be able to take any free seat and change seat before setup starts. The room creator MUST be able to start setup only when every seat is taken.
- **FR-005**: Every player in a room MUST see the seat list, names, who is connected and whose turn or decision it is, updated within 1 second.
- **FR-006**: A room MUST refuse new players once all seats are taken or setup has started, except a player returning to their own seat (FR-040).

**Authority and turn flow**

- **FR-010**: The server MUST hold the authoritative game: the starting state and the action log. It MUST check every action with the same rules core as hot-seat and apply only actions that the rules accept.
- **FR-011**: The server MUST accept an action only from the player who owns it now (Q-53):
  - in setup, the player whose seat owns the hero slot being picked;
  - in play, the player of the active hero;
  - for a pending decision, the player of the hero that owns the decision;
  - for a draw offer, a player of the other side.
- **FR-012**: The server MUST never trust a game state, a roll value or a result sent by a client. Clients send intentions (an action); the server sends back the applied action, and each client updates its table by applying it with the same rules core.
- **FR-013**: All players MUST see the same game state after every applied action. A client that finds its state differs from the server's (FR-014) MUST reload the state from the server without the player doing anything.
- **FR-014**: The server MUST send each applied action with a sequence number and a check value of the resulting state, so clients can detect missing actions or a different result.
- **FR-015**: Refused actions MUST show the player the rule message that hot-seat would show, or "not your turn / not your decision".
- **FR-016**: In online setup, turn order and starting squares MUST be set automatically (001 FR-082, FR-083 online notes; rule in Q-52) and shown to all players before turn 1.
- **FR-017**: Sandbox mode (rules off) and the position editor MUST NOT be available in online rooms (Out of scope).

**Dice**

- **FR-020**: Online, the server MUST choose every d20 value with a secure random source, uniformly from 1 to 20, and apply it as the roll. A roll value sent by a client MUST be refused.
- **FR-021**: The active player MUST trigger the roll (Roll button); the roll happens only when the rules are waiting for one.
- **FR-022**: Every client MUST show the physics die landing on the server's value; the animation MUST look like a normal physics throw (002), not a die snapping to a face.
- **FR-023**: The applied roll MUST be in the action log like a hot-seat roll, so replay, saves and undo limits work unchanged.

**Undo**

- **FR-030**: During their own turn, the acting player MUST be able to undo their actions step by step, across phase changes, back to the last reveal event (a roll, a destroyed unit, a wound; 001 REVEAL_EVENTS) or the start of the turn. Undo MUST NOT cross the Active Hero hand-off or another player's action (a reaction or other decision), nor actions the server made. The server applies each undo for everyone and every client shows it; the log says who undid what. (Clarified 2026-11-10; 001 FR-012 amended to match.)

**Reconnect and resume**

- **FR-040**: Each seat MUST have a secret seat token stored in the player's browser. Opening the room link with that token MUST put the player back in their seat with the current state.
- **FR-041**: A disconnected player MUST keep their seat. Others MUST see that the player is away. The game MUST wait for that player only when it needs their action or decision.
- **FR-042**: The room creator MUST be able to hand an away player's seat to someone who opens the link without the token (Q-55).
- **FR-043**: A room MUST be kept while players are in it and for at least 24 hours after the last player left (Q-56); then it MAY be removed.
- **FR-044**: Rooms in progress MUST survive a game server restart: the server keeps each room's save file (starting state and action log) on disk and restores rooms from it when it starts.

**Saves**

- **FR-050**: Any player MUST be able to download the online game as a 001 save file.
- **FR-051**: The room creator MUST be able to create a room from a save file; the server checks that the file replays (as 001 FR-201) before opening the room.

**Security and limits**

- **FR-060**: All traffic MUST use HTTPS and secure WebSockets in the deployed game.
- **FR-061**: Room codes and seat tokens MUST be generated with a secure random source; codes MUST have at least 10⁹ possible values and seat tokens at least 128 bits.
- **FR-062**: The server MUST limit message size and rate per connection and the number of rooms per address, and drop messages that do not match the protocol.
- **FR-063**: Display names MUST be shown as plain text (never as markup) and limited to 20 characters.
- **FR-064**: The server MUST NOT store personal data beyond display names, seat tokens and the games in rooms; no accounts, emails or analytics.
- **FR-065**: Client and server MUST check that they run the same game version and rules data; on a mismatch the player is asked to reload.

**Hosting**

- **FR-070**: The website (the built game) and the game server MUST run on one host under one origin with HTTPS: now a free Render web service (test deployment, Render URL); at go live one Hostinger KVM VPS under a subdomain of the project's domain, with a certificate that renews automatically.
- **FR-074**: The game server MUST be able to serve the built website itself (static files with an index fallback), so one Node process is the whole game on hosts without nginx (Render).
- **FR-071**: The website and the game server MUST start automatically when the server machine starts and restart if they crash.
- **FR-072**: Deploying a new version MUST be a documented set of commands (quickstart), runnable from the developer's machine or the VPS.
- **FR-073**: Hot-seat and the sandbox MUST keep working without the game server, locally and in the deployed game.

**Carry-over**

- **FR-080**: All 001–004 tests MUST keep passing; every acceptance scenario of this feature MUST have an automated test.
- **FR-081**: The rules core MUST stay engine-free and unchanged in behaviour; online play adds no rules.

### Key Entities

- **Room**: a game being set up or played online: code, creator, player count, mode, single-seat side (3 players), seats, status (lobby, setup, playing, ended), the save file (starting state and action log), created and last-active times.
- **Seat**: one player's place: side, the hero slot(s) it controls, display name, seat token, connected or away.
- **Player connection**: a browser connected to a room, linked to a seat by its token.
- **Intent**: an action a client asks the server to apply (or a roll request, an undo request).
- **Applied action**: an action the server accepted, with its sequence number and state check value; the same action as in the 001 log.
- **Server roll**: a d20 value chosen by the server and applied as `submitRoll`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Four players on four different networks finish a full 4-hero game online, with no player ever seeing a different position from the others, in 3 of 3 internal playtests.
- **SC-002**: A player's action appears on every other player's screen within 1 second in 95% of actions, with players in Europe and the server in Europe.
- **SC-003**: A player who refreshes or loses connection is back in their seat with the current position within 10 seconds in 10 of 10 tries.
- **SC-004**: Zero illegal or out-of-turn actions are accepted in an automated test that sends thousands of random, out-of-turn and malformed messages to a room.
- **SC-005**: Friends can create and join a room and reach hero picking in under 2 minutes without help, in 4 of 5 tries.
- **SC-006**: The hosted game loads in a desktop browser within 10 seconds (001 target), and one entry-level VPS runs at least 20 rooms at once with no slowdown players notice.
- **SC-007**: A new version goes online in under 15 minutes by following the quickstart.

## Open Questions

Numbering continues from 004 (Q-51).

| # | Question | Who | Blocking? |
| --- | --- | --- | --- |
| Q-53 | With two players on a side, can one player act for the teammate's hero (for example when the teammate is away)? Default: no; each player acts only for their own hero(es). | Luka | No |
| Q-54 | Who answers a draw offer when a side has two players? Default: either player of that side; the first answer counts. | Luka | No |
| Q-55 | How does a player get their seat back on a new browser? Default: the room creator hands an away seat to the person who asks. If the creator is the one who lost the token, any other seated player can hand it back. | Luka | No |
| Q-56 | How long are rooms kept after everyone left? Default: 7 days for games in progress, 24 hours for rooms in the lobby or ended games. | Luka | No |
| Q-57 | Should there be turn timers or a way to skip an away player? Default: no (Out of scope); the game waits. | Luka | No |
| Q-58 | Does Rošada have any hidden information that other players must not see (for example a hero's chosen destiny before it is revealed)? Default: no; the whole game state is public, as at the table, so every client gets the full state. | Rules designer | No |
| Q-59 | The domain for go live: a subdomain of Luka's existing domain on a Hostinger KVM VPS (answered 2026-11-10); the subdomain name is not chosen yet. The test deployment uses its Render URL. | Luka | Yes, for go live only |
| Q-60 | Found while building: the seat token is kept per browser, so two tabs of the same browser are the same player. Is that right? Default: yes; to sit two players on one computer, use two browser profiles or a private window. | Luka | No |

## Assumptions

- **A-01**: Players use a current desktop Chrome, Edge or Firefox (001).
- **A-02**: Players know each other and share the link themselves (no public room list).
- **A-03**: For testing, the game runs on a free Render web service (it sleeps after about 15 idle minutes and wakes in about a minute; its disk is temporary). At go live, the game server and the website run on one Hostinger KVM VPS (entry level is enough for friends' games); Luka manages the VPS, the domain and DNS.
- **A-08**: No client IP addresses are written to disk by nginx or the game server (Clarifications 2026-11-10). User profiles and any personal data they bring are a later feature.
- **A-04**: Online games use the named heroes (004) and the same setup choices as hot-seat, without the generic heroes (004 Q-42).
- **A-05**: There is no hidden information in the game state (Q-58), so every client may hold the full state.
- **A-06**: A player's seat token lives in that browser's local storage; clearing it is handled by Q-55.
- **A-07**: The project's TTS art in `public/tts/` may be served publicly from the website (004 A-04).
