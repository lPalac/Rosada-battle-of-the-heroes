# Data Model: Online Multiplayer and Hosting

**Feature**: `005-online-multiplayer` | **Plan**: [plan.md](./plan.md)

The rules model (`GameState`, `Action`, `SetupChoices`, `Player`, `Hero.playerId`) is unchanged (FR-081). This feature adds room-level types in `src/online/model.ts`, which is engine-free and shared by the server and the client.

## Room

| Field | Type | Notes |
| --- | --- | --- |
| `code` | string, 7 chars from `23456789ABCDEFGHJKMNPQRSTUVWXYZ` | Also the Colyseus `roomId`. Input is upper-cased and spaces are dropped (edge case) |
| `createdAt`, `lastActiveAt` | ISO time | `lastActiveAt` changes on every applied action, join or leave |
| `status` | `'lobby' \| 'setup' \| 'playing' \| 'ended'` | See transitions below |
| `config` | `{ playerCount: 2\|3\|4; mode: 'draft'\|'mirror'; singleSide: Side }` | Fixed at creation; `singleSide` only used with 3 players |
| `creatorSeat` | `SeatId` | The seat the creator took first; it can start and release seats (Q-55) |
| `seats` | `Seat[]` | One per player, built from `defaultPlayers(playerCount, singleSide)` |
| `save` | `SaveFile` (001) | `initial` = the state from `createSetup` (or the uploaded save's initial state); `actions` = the log |
| `actors` | `(SeatId \| 'server')[]` | Same length as `save.actions`: who sent each action. Needed for undo ownership (FR-030) |
| `seq` | number | `save.actions.length`, sent with every broadcast |
| `buildId`, `dataHash` | string | The version that created the room. Rooms from an older build are restored only if `dataHash` matches; otherwise they are kept read-only (save download only) |

**Validation**:
- `seats.length === config.playerCount`.
- Each side has 1 or 2 seats (001 FR-080).
- `actors.length === save.actions.length`.
- `replay(save.initial, save.actions)` succeeds.

**State transitions**:

```text
lobby ──(creator starts, every seat taken)──▶ setup ──(auto setup applies startGame)──▶ playing ──(gameEnded event)──▶ ended
  ▲                                                                                                                      │
  └──────────────────────────────(rematch: same seats, new initial state)────────────────────────────────────────────────┘
created from a save file: lobby ──(every seat taken)──▶ playing (or setup / ended, whichever the save's state is in)
```

## Seat

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `SeatId` = `'P1' \| 'P2' \| 'P3' \| 'P4'` | Equals `Player.id` in `SetupChoices.players`, so `hero.playerId` names the seat |
| `side` | `Side` | From `defaultPlayers` |
| `heroSlots` | `number[]` | Indices within the side (0, 1) that this seat controls; a single seat on a side has `[0, 1]` |
| `name` | string \| null | Display name, 1–20 characters, trimmed, control characters removed; `null` = free |
| `tokenHash` | string \| null | SHA-256 (hex) of the seat token; `null` = free or released |
| `connected` | boolean | Live connection count > 0; not saved to disk (always `false` on restore) |

**Rules**:
- A seat is **free** when `tokenHash === null`.
- Taking a seat sets `name` and `tokenHash`, and returns the token once.
- Changing seat is allowed only in `lobby`: it frees the old seat.
- Releasing an away seat (Q-55) sets `tokenHash = null` but keeps `name` until someone takes the seat.

## Intent (client → server)

An intent is one of: `act` (an `Action`), `roll`, `undo`, `forceNextRoll` (test mode only). Shapes are in [contracts/protocol.md](./contracts/protocol.md). An intent is accepted when:
1. the message passes its guard (shape, sizes, rate);
2. the sender has a seat in this room;
3. the sender's seat is in `actorFor(room, state)` (research R-03), or for `undo`, `canUndoBy(room, seat)` holds;
4. `apply(state, action)` returns `ok`.

## Applied action (server → clients)

| Field | Type | Notes |
| --- | --- | --- |
| `seq` | number | 1-based index of the action in the log |
| `action` | `Action` | Exactly what was appended to `save.actions` |
| `by` | `SeatId \| 'server'` | Who sent it (auto-setup actions are `'server'`) |
| `check` | number | FNV-1a 32 of the canonical JSON of the new state without `log` (research R-02) |
| `roll` | boolean | `true` when `action` is a server roll: clients play `throwDieTo(action.value)` |

## Undo

`canUndoBy(room, seat)` is true when:
- the last entry in `actors` is `seat`;
- `undo(save.initial, save.actions)` (001 session rule) returns a shorter log;
- the room is `playing`.

The server applies it by dropping the last action and actor, and broadcasts `undone { seq, check }`.

## Room file (disk)

`/var/lib/rosada/rooms/<code>.json`:

```text
{ format: 'rosada-room', version: 1, room: Room (seats without `connected`) }
```

It is written atomically after every change (research R-09). Lifetime: 7 days after `lastActiveAt` when `playing`, 24 hours when `lobby`, `setup` or `ended` (Q-56).

## Client-side storage

| Key | Value | Notes |
| --- | --- | --- |
| `rosada.seat.<code>` | `{ seatId, token, name }` | Lets the player rejoin by link (FR-040); removed when the room is gone |
| `rosada.name` | string | Last display name, pre-filled on the Play online screen |
