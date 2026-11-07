# Contract: Client ↔ Server Protocol

**Feature**: `005-online-multiplayer` | Transport: Colyseus 0.17 room `rosada` over WSS at `/ws` (research R-06), messages only, no Schema state. Types live in `src/online/protocol.ts`, and each message has a runtime guard there.

## HTTP

| Method & path | Body | Response | Notes |
| --- | --- | --- | --- |
| `GET /api/health` | — | `{ ok: true, buildId, rooms }` | Used by deploy smoke test and systemd checks |

Rooms are created and joined through the Colyseus matchmaker. There is no other HTTP API.

## Creating and joining

| Client call | Options | Server checks | Result |
| --- | --- | --- | --- |
| `client.create('rosada', opts)` | `{ name, playerCount, mode, singleSide?, seat?: SeatId, save?: SaveFile, buildId, dataHash }` | Version (R-10); create rate per IP; total room cap; `save` replays (`parseSaveFile`) | New room with a fresh code; the creator takes `seat` (default `P1`) |
| `client.joinById(code, opts)` | `{ name?, seatToken?, buildId, dataHash }` | Version; room exists; seat token matches a seat → rejoin; else lobby must have a free seat | Joined as a seat or as "choosing" (lobby, no seat yet) |

Join errors use Colyseus error codes plus a `reason`. The reasons are `VERSION_MISMATCH`, `ROOM_NOT_FOUND`, `ROOM_FULL`, `ROOM_STARTED`, `RATE_LIMITED` and `BAD_SAVE`.

## Client → server messages

| Type | Payload | Allowed when | Effect |
| --- | --- | --- | --- |
| `takeSeat` | `{ seat: SeatId, name: string }` | `lobby`, seat free, sender has no seat | Seat taken; reply `seatToken { seat, token }` (only to the sender) |
| `leaveSeat` | `{}` | `lobby` | Seat freed |
| `start` | `{}` | `lobby`, sender is creator, every seat taken | `status = setup` (or the save's state); broadcast `room` |
| `act` | `{ action: Action, clientSeq: number }` | sender's seat ∈ `actorFor` and `apply` ok; `action.type ≠ 'submitRoll'`, `'setEnforcement'`, `'sandbox*'` (FR-017, FR-020) | Broadcast `applied` |
| `roll` | `{ clientSeq: number }` | sender is active seat, `awaitingRoll(state)` | Server draws the value, applies `submitRoll`, broadcasts `applied` with `roll: true` |
| `undo` | `{ clientSeq: number }` | `canUndoBy(room, seat)` (data-model Undo) | Broadcast `undone` |
| `releaseSeat` | `{ seat: SeatId }` | target seat is away; sender is creator, or any seated player if the creator is away (Q-55) | Seat token cleared; broadcast `room` |
| `rematch` | `{}` | `ended`, sender is creator | New `initial` from the same config and seats, `status = setup`; broadcast `snapshot` |
| `resync` | `{}` | always | Reply `snapshot` |
| `forceNextRoll` | `{ value: 1..20 }` | server started with `ROSADA_TEST=1` only | Next `roll` uses `value` |

Every `act`, `roll` and `undo` gets either the broadcast or, to the sender only, `refused { clientSeq, code, message, rule? }`. The codes are:
- `NOT_YOUR_TURN`, `NOT_YOUR_DECISION`, `NOT_ALLOWED_ONLINE`;
- the rules core's `RuleError.code` with its `message` and `rule` (FR-015);
- `CANNOT_UNDO`, `BAD_MESSAGE`, `RATE_LIMITED`.

## Server → client messages

| Type | Payload | Sent to |
| --- | --- | --- |
| `snapshot` | `{ room: RoomView, save: SaveFile, seq, actors, buildId }` | One client: after join or rejoin, after `resync`, after `rematch` (everyone) |
| `room` | `RoomView` | Everyone, on any seat, connection or status change |
| `applied` | `{ seq, action, by, check, roll }` | Everyone |
| `undone` | `{ seq, check }` | Everyone (`seq` is the new log length) |
| `refused` | `{ clientSeq, code, message, rule? }` | Sender |
| `seatToken` | `{ seat, token }` | Sender only, once |

`RoomView` is `Room` without `save`, `actors` or `tokenHash`. For each seat it shows `{ id, side, heroSlots, name, taken, connected }`, plus `you: SeatId | null`.

## Client obligations

- Apply each `applied` action with the same rules core; check `seq === local + 1` and `check === hash(local state)`. On any mismatch send `resync` (FR-013).
- Never send a state or a roll value; never assume an intent succeeded until `applied` arrives.
- Store `seatToken` under `rosada.seat.<code>`; send it on `joinById` to rejoin.
- Show names with `textContent` only (FR-063).

## Limits (research R-11)

- Max payload 256 KB (create-from-save only); all other messages ≤ 4 KB.
- 20 messages/s per connection; excess is dropped; 3 strikes within a minute → disconnect.
- 5 room creations per IP per hour; 300 rooms per server.
