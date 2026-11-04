# Research: Sandbox Physics and Shared Unit Squares

**Feature**: `002-sandbox-physics` | **Date**: 2026-11-04 | **Spec**: [spec.md](./spec.md)

Phase 0 of `/speckit-plan`. Builds on 001's decisions (`specs/001-standard-rules-game/research.md`, referred to as 001 R-nn). Each entry: decision, why, what else was considered. No new dependencies.

---

## R-01 Square size

**Decision**: One board square becomes 1.25 world units (+25%, above the ≥ 20% asked). The constant `SQUARE` in `src/table/coords.ts` is the only size; every zone beside the board (Graveyards, Well, Common Pools, tokens, dice tray) is defined in squares and scaled from it. Piece meshes keep their size. The default camera moves back by the same factor.

**Why**: One constant keeps the board, picking, highlights and physics in step. 25% leaves room for two bases (radius 0.32) side by side with a gap: 2 × 0.64 = 1.28 needs a 1.25 square if the pieces are offset diagonally (see R-02).

**Alternatives**: Shrinking pieces instead (rejected: harder to read on the default camera); scaling only the Battlefield (rejected: Outskirts heroes and squares would no longer line up).

## R-02 Layout of two units on one square

**Decision**: One unit stands in the centre. With two, they stand on the square's diagonal, ±0.27 squares from the centre, in id order (stable, so they do not swap on redraw). Hero figures keep their ring layout from 001 but move to the free corners when units are present.

**Why**: The diagonal gives the most room (1.25 × √2 ≈ 1.77 units corner to corner), so bases do not touch and both stay clickable from the default camera (SC-004).

## R-03 Rules core with several units on a square

**Decision**:
- `unitsAt(state, p)` returns every unit on a square; `unitAt` stays for "is this square occupied" and returns the first.
- `LeadOption.battleUnitId` becomes `battleUnitIds: string[]`: every enemy unit on the destination (en passant: the passed pawn). Resolution destroys all of them in one Battle.
- Destiny for one Battle: the Leading side +2 once, the losing side +1 per unit destroyed, Revenge per destroyed Queen (spec FR-006, clarified). This matches the rulebook ("2 D when you Destroy one or more enemy units in Battle").
- Paths, threats, check, checkmate and Ram landings already treat a square as occupied if any unit is there, so they need no change beyond using `unitsAt` where the side matters (a square is never mixed in an accepted position).
- Leading onto a friendly-occupied square stays forbidden. The seam for later special rules is an option on path generation, `{ allowFriendlyEnd?: (unit, square) => boolean }`, default none. No v1 rule passes it.

**Why**: Smallest change that makes stacked squares play correctly when sandbox creates them now and abilities later (spec A-05). The option is a seam only, which constitution VI allows.

**Alternatives**: A `Square` object with an occupant list in the state (rejected: the 001 state stores units with positions, and every check would need migrating for no gain).

## R-04 Position check

**Decision**: `validatePosition` replaces `TWO_UNITS` with:
- `OPPOSING_UNITS_SHARE`: units of both sides on one square.
- `TOO_MANY_UNITS`: more units than `rules.json` `maxUnitsPerSquare` (2).
- `KING_SHARES` (kept): any unit or hero on a King's square.
- `UNIT_OFF_BATTLEFIELD` (kept, new wording): a unit neither on the Battlefield nor in a Graveyard.
- `HERO_OFF_BOARD` (kept): a hero off the 10×10 grid.

Hero figures are never counted as units (spec FR-003).

**Why**: Directly from the spec clarifications. The rulebook only forbids opposing colours and the King's square; the 2-unit maximum is a tunable.

## R-05 Where an off-board piece is in the state

**Decision**: In sandbox a unit or hero may have a `pos` outside the 10×10 grid, within the table area (x and y from −6 to 15 in square coordinates). That is how "on the table, not on the board" is stored. `sandboxPlace` accepts such squares; it rejects anything outside the table area. The Graveyard stays a separate list (`state.graveyard`), as in 001.

**Why**: No new field or list: an off-grid `pos` already means "not on the board", and the position check already reports units off the Battlefield and heroes off the grid. Saves and undo work unchanged.

**Alternatives**: A third list `offBoard: Unit[]` (rejected: one more place for a unit to be, more code in every sync); sending off-board units to the Graveyard automatically (rejected by Luka: the player decides).

## R-06 Physics world for the sandbox

**Decision**: A second Rapier world, created when sandbox mode starts and dropped when it ends (lazy, like the dice world in 001 R-06):
- **Static**: a table plane (with a raised rim so pieces stay reachable), the board slab, and low walls round the table edge. A piece that still goes over the rim is put back at the nearest point inside the rim (spec edge case).
- **Pieces**: one dynamic body per unit and hero figure. Colliders are simple compound shapes matching the placeholder meshes: a cylinder base + a narrower cylinder body (per unit type, heights from the lathe profiles in `src/table/assets.ts`), a capsule for hero figures. Density gives a low centre of mass so pieces stand but tip when hit.
- **Carrying**: picking up switches the body to kinematic-position-based and moves it to the pointer ray's point on a plane 1.0 square above the board. A kinematic body pushes dynamic ones, which gives "push and knock over" for free (FR-022). Releasing switches it back to dynamic with zero velocity, upright, so a picked-up piece always lands standing (FR-023).
- **Stepping**: fixed 1/60 s steps inside the table's render loop while any body is awake; nothing runs when all sleep (render on demand stays, 001 R-14).
- **Rules mode**: the sandbox world does not exist; pieces are placed from state (FR-027).

**Why**: Rapier is already a dependency (001 R-02) and its kinematic bodies are the standard way to drag objects that still collide. Lazy creation keeps rules-mode cost at zero.

**Tuned values (implementation, 2026-11-04)**: base cylinder radius 0.26 (the mesh base is 0.32) and height 0.16 at density 1.6, body cylinder radius 0.2 at density 1.0; friction 1.0 on bases and the table; carry height 0.22 above the board, so the carried piece's side meets other pieces' sides. With a wider, heavier base (0.32, density 3) pieces were pushed like a plough and never tipped. A body counts as resting after 0.3 s below 0.05 m/s and 0.15 rad/s. Rim at ±13.1 world units, the table area the rules accept (R-05).

**Alternatives**: A pick-and-place tween with fake knock-over animations (rejected: not real collisions, the request was physics); one shared world with the dice (rejected: the dice tray is separate and replays recorded frames).

## R-07 From physics back to game state

**Decision**:
- When a carried piece is released, or a knocked piece falls asleep, its rest point (body translation projected to the table) is mapped to a destination: inside a Graveyard zone → `'graveyard'`; otherwise the square under its centre (`fromWorld`), which may be off-grid (R-05).
- If that destination differs from the state, the UI dispatches `sandboxPlace` (FR-024). Pieces that only wobble map to their own square and send nothing.
- Turning rules on: the UI waits until every body sleeps (at most 3 s), records any remaining changes, then removes the sandbox world (pieces snap upright onto their squares from state) and dispatches `setEnforcement('rules')` (FR-026).
- When the state changes for another reason (undo, value editor, click placement, load), each body whose square no longer matches the state is teleported upright to its state square.

**Why**: Physics never decides rules (FR-028, constitution II): the rules core only sees `sandboxPlace` actions with squares, as in 001. Undo and saves keep working because placements are ordinary actions.

## R-08 Testing physics

**Decision**:
- Pure mapping (`restDestination(point)`: square, Graveyard, off-grid; table-rim clamping) is unit-tested in Node.
- Rapier behaviour is tested in Node like the dice (001 T061): a dropped piece rests upright on its square; a carried piece moved through a row of pawns knocks at least one over; a piece pushed off the board comes to rest inside the rim; all bodies fall asleep within 3 s.
- Rules changes (stacked Battle, validation, friendly-end ban, seam) get `US2-AS*` tests against the headless core.
- Playwright drags a piece with the mouse in sandbox and checks the recorded square, and checks that two units on one square are separately clickable.

## R-09 Performance

**Decision**: Up to 36 dynamic bodies plus a few static ones; Rapier handles this easily. Sleeping bodies cost nothing; the render loop only steps physics while something is awake. The 002 SC-002 target (≥ 50 fps while knocking pieces) is measured with the existing `gpu` Playwright project.
