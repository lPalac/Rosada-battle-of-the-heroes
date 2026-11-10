# Contract: Online Core API (`src/online/`)

**Feature**: `005-online-multiplayer`. Engine-free like `src/rules` and `src/game`: it MUST NOT import `colyseus`, `three`, `@dimforge/*`, `node:*`, DOM, or `src/table|physics|ui|net`, or `server/`. Randomness, hashing of tokens, clocks and file I/O are injected, so everything runs in Vitest without a network. It is added to `tests/boundaries.test.ts` and `tsconfig.rules.json`.

## Modules

| File | Exports |
| --- | --- |
| `model.ts` | `Room`, `Seat`, `SeatId`, `RoomConfig`, `RoomStatus`, `RoomView`, `RoomFile` (data-model.md) |
| `protocol.ts` | Message types (contracts/protocol.md) and `parseClientMessage(type, payload): ClientMessage \| null` guards |
| `authority.ts` | `actorFor(room, state): Set<SeatId>`; `seatOfHero(room, heroId)`; `canUndoBy(room, seat): boolean` |
| `auto-setup.ts` | `autoSetupActions(state): Action[]`: the system actions after the last pick (research R-04, Q-52) |
| `check.ts` | `stateCheck(state): number`: FNV-1a 32 over canonical JSON without `log` |
| `codes.ts` | `ROOM_ALPHABET`, `normaliseCode(input)`, `newRoomCode(randomInt)`, `cleanName(input)` |
| `room-core.ts` | `RoomCore` class (below) |

## `RoomCore`

```ts
interface RoomDeps {
  randomInt(minIncl: number, maxExcl: number): number; // crypto.randomInt on the server, scripted in tests
  newToken(): string;                                  // 128-bit base64url
  hashToken(token: string): string;                    // SHA-256 hex
  now(): Date;
}

class RoomCore {
  static create(config: RoomConfig, deps: RoomDeps, from?: SaveFile): RoomCore;
  static restore(file: RoomFile, deps: RoomDeps): RoomCore;   // throws if the log does not replay
  readonly room: Room;                                        // never mutate from outside
  get state(): GameState;                                     // replayed current state

  takeSeat(seat: SeatId, name: string): Result<{ token: string }>;
  leaveSeat(seat: SeatId): Result;
  seatForToken(token: string): SeatId | null;
  setConnected(seat: SeatId, on: boolean): void;
  start(by: SeatId): Result<Applied[]>;                       // may return auto-setup actions when the save is past picks
  act(by: SeatId, action: Action): Result<Applied[]>;         // the action, then any auto-setup actions
  roll(by: SeatId): Result<Applied>;                          // draws randomInt(1, 21) unless forced
  forceNextRoll(value: number): void;                         // used only when the server runs in test mode
  undo(by: SeatId): Result<{ seq: number; check: number }>;
  release(by: SeatId, seat: SeatId): Result;
  rematch(by: SeatId): Result;
  view(forSeat: SeatId | null): RoomView;
  toFile(): RoomFile;
  expiresAt(): Date;                                          // Q-56 lifetimes
}

type Result<T = void> = { ok: true; value: T } | { ok: false; code: string; message: string; rule?: string };
interface Applied { seq: number; action: Action; by: SeatId | 'server'; check: number; roll: boolean }
```

## Guarantees (tested)

- **G-1**: `act` succeeds if and only if `actorFor(room, state).has(by)` and `apply(state, action).ok`. It never changes `room` on failure.
- **G-2**: `act` refuses `submitRoll`, `setEnforcement` and `sandboxPlace` / `sandboxSet` with `NOT_ALLOWED_ONLINE` (FR-017, FR-020).
- **G-3**: After any sequence of calls, `replay(room.save.initial, room.save.actions)` equals `state`, and `room.actors.length === room.save.actions.length`.
- **G-4**: `RoomCore.restore(core.toFile())` gives an equal `state`, `seq` and seats (with `connected = false`).
- **G-5**: `roll` values are `randomInt(1, 21)`. With `crypto.randomInt`, 200,000 draws pass a chi-square test at p > 0.001 (US3-AS3).
- **G-6**: `stateCheck` is equal for equal states built on different machines. It does not depend on object key insertion order beyond what `apply` produces (the same code on both sides).
- **G-7**: Seat tokens are only ever stored hashed; `toFile()` contains no raw token.

## Changes outside `src/online`

| File | Change |
| --- | --- |
| `src/game/session.ts` | Export a `SessionLike` interface; `GameSession implements SessionLike`. No behaviour change |
| `src/physics/roll.ts` | Add `throwDieTo(dw, target, random?)` (research R-05); `throwDie` unchanged |
| `src/physics/d20.ts` | Add `faceSymmetry(from, to)`: a precomputed rotation quaternion mapping face to face |
| `src/rules/**` | None (FR-081) |
