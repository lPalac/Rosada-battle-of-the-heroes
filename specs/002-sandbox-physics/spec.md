# Feature Specification: Sandbox Physics and Shared Unit Squares

**Feature Branch**: `002-sandbox-physics`

**Created**: 2026-11-04

**Status**: Draft

**Input**: User description: "Finish sandbox mode and add physics collisions (open task T114 from 001: pick up, drop, knock over pieces with Rapier). Enlarge the board squares by at least 20% so two chess pieces fit on one square. Two units on one square must be supported (sandbox already allows it; later abilities such as the Death Knight's — when he successfully Leads into Battle he creates an auxiliary pawn on that square — will create it in play). In normal Leading, friendly pieces still can never be Led into a square with another friendly piece, except by a special rule. The validation when turning rules back on must take this into account. Heroes (named) come in a later feature."

**Builds on**: `specs/001-standard-rules-game` (sandbox mode, US6, FR-100…FR-104; open task T114, FR-203).

**Source rules**: `Basic Rules 2_5.docx` with `Basic Rules 2_5 - corrections.docx`. The rules used here:
- *General Unit Rules*: "Units of opposing colors may not occupy the same square." Friendly units may share.
- *King's Majesty*: "No unit can share its space with the King." The King never shares a square.
- *Common Destiny Pool*: "2 D when you Destroy one or more enemy units in Battle." A Battle can destroy more than one unit.
- Auxiliary units are "placed on the board during play" by abilities. No ability exists yet; this feature prepares the board and the rules for them.

## Clarifications

### Session 2026-11-04

- Q: Maximum units per square? → A: 2 for now.
- Q: Can anything share a square with the King? → A: No, nothing. The King and hero interaction from 001 stays as it is.
- Q: Destiny for a Battle that destroys several units on one square? → A: The Leading side gains 2 D once; the losing side gains 1 D for every unit destroyed.
- Q: Are hero figures physical pieces too? → A: Yes. They do not count towards the number of units on a square (until a hero becomes a Hero Unit, which comes with Favours/Achievements later).
- Q: What happens to a unit knocked off the board or table? → A: The player can put it in the Graveyard. Rules cannot be turned back on until every unit is either on the Battlefield or in a Graveyard.

## User Scenarios & Testing *(mandatory)*

Personas: **Designer** (tries ability ideas and odd positions by hand), **Playtester** (sets up a position to discuss).

### User Story 1 – Pick up, drop and knock over pieces in sandbox (Priority: P1)

In sandbox mode the units and hero figures behave like real pieces on a real table. A player picks a piece up, carries it over the board and drops it. The piece falls, lands, and can bump other pieces. Pieces that are hit can slide or fall over, like on a physical board.

**Why this priority**: This is the open part of sandbox mode (001 FR-203, task T114) and what makes the sandbox feel like the physical prototype.

**Independent Test**: Turn rules off, pick up a Rook, drop it onto a square crowded with pawns from a height, and watch it land and knock a pawn over.

**Acceptance Scenarios**:

1. **Given** sandbox mode, **When** the player presses on a unit or hero figure and drags, **Then** the piece lifts off the table and follows the pointer above the board.
2. **Given** a piece is being carried, **When** the player releases it, **Then** it falls onto the table where it was released and comes to rest.
3. **Given** a carried piece is moved into other pieces, **Then** they are pushed, and a piece hit hard enough falls over.
4. **Given** a piece has fallen over, **When** the player picks it up and drops it again, **Then** it lands standing up.
5. **Given** rules are on (not sandbox), **Then** pieces never move by physics: they stand upright, centred on their squares, exactly as the game state says.
6. **Given** a piece comes to rest on a different square than before, **Then** the game state and the log record it on its new square, as if it had been placed there by hand.

---

### User Story 2 – Two friendly units on one square (Priority: P1)

The board is larger, so two units fit side by side on one square and both stay easy to see and click. Two units of the same side may share a square; this will happen in play later through abilities (for example, a Death Knight that wins a Battle creates an auxiliary pawn on that square). The rules handle such a square correctly when play resumes.

**Why this priority**: Upcoming abilities need it, and sandbox users already create such positions. Without it the board cannot show them and the rules cannot play them.

**Independent Test**: In sandbox put two Light pawns on one square, turn rules back on, and check that both are visible, that play resumes, and that a Dark unit Leading into that square destroys both.

**Acceptance Scenarios**:

1. **Given** the board, **Then** every square is at least 20% wider than in the previous version, and two units on one square stand side by side without overlapping.
2. **Given** two Light units share a square, **When** rules are turned back on, **Then** the position is accepted (no problem listed for the shared square).
3. **Given** a Light and a Dark unit share a square, **When** rules are turned back on, **Then** the problem "Units of opposing sides share a square" is listed and the game stays in sandbox.
4. **Given** any unit shares a square with a King, **When** rules are turned back on, **Then** the King's-square problem is listed and the game stays in sandbox (King's Majesty).
5. **Given** more units share a square than the maximum (2), **When** rules are turned back on, **Then** a problem is listed for that square.
6. **Given** a normal Lead, **Then** a unit can never be Led onto a square holding a friendly unit; such squares are never offered.
7. **Given** two enemy units share a square, **When** a unit is successfully Led into Battle on that square, **Then** both enemy units are destroyed and go to the Graveyard; the Leading side gains 2 D once (one Battle), not 2 D per unit, and the losing side gains 1 D for every unit lost; a destroyed Queen among them gives Revenge as usual.
10. **Given** a square holds two friendly units and one or more hero figures, **When** rules are turned back on, **Then** the position is accepted: hero figures do not count towards the units on a square.
8. **Given** two friendly units share a square, **Then** each can be Led out of it by its own path, each threatens squares as usual, and the square stops other paths like any occupied square.
9. **Given** the player selects a square with two units, **Then** they can choose either unit (both are separately clickable and highlightable).

---

### User Story 3 – Resume rules from a physical sandbox position (Priority: P2)

After moving and knocking pieces around, the player turns rules back on. The game reads where every piece ended up, stands fallen pieces back up on their squares, and checks the position.

**Why this priority**: Without a clean way back to the rules, the physics sandbox would be a dead end.

**Independent Test**: Knock a Bishop over so that it lies across two squares, knock a pawn off the board, then turn rules on and check the result and the problems list.

**Acceptance Scenarios**:

1. **Given** a piece lies on its side, **When** rules are turned on, **Then** it is stood up on the square under its centre.
2. **Given** a unit came to rest off the Battlefield (in the Outskirts, on the table edge or knocked off the table), **When** rules are turned on, **Then** the problem "unit is not on the Battlefield or in a Graveyard" is listed for it and the game stays in sandbox; rules cannot resume until every unit is on the Battlefield or in a Graveyard.
6. **Given** a unit was knocked off the table, **Then** the player can still pick it up (it waits at the table edge) and put it in a Graveyard or back on the Battlefield.
3. **Given** a unit was dropped into a Graveyard zone, **Then** it is moved to that side's Graveyard.
4. **Given** a unit was taken out of the Graveyard and dropped on a square, **Then** it is back on the board on that square.
5. **Given** the problems are fixed, **When** rules are turned on, **Then** play resumes at *Before Turn* of the active hero as in 001 (moved units count as Led, en passant chances are cleared).

---

### Edge Cases

- A piece is released over a gap between two squares → it belongs to the square under its centre once it rests.
- A piece is still moving or rolling when the player turns rules on → the game waits until all pieces rest (or at most 3 seconds, then uses where they are).
- A piece falls off the table entirely → it is placed at the table edge nearest to where it fell, so the player can still pick it up and put it in a Graveyard or back on the board.
- Several pieces knocked in a chain → each one that lands on a new square is recorded; pieces that only wobble stay on their square.
- A hero figure is knocked over → it is stood up on the square under its centre; heroes may stand anywhere on the 10×10 grid, so it is only a problem if it is off the grid.
- A piece is dropped exactly onto a King → it bounces off; if it rests on the King's square, the King's-square problem is listed on resume.
- Two units of the same side and a King's square are three-way crowded → every rule broken is listed.
- Undo in sandbox → undoing a recorded placement puts the piece back on its old square, standing up.
- Switching between rules and sandbox repeatedly → no piece is lost or duplicated.
- Saving and loading a sandbox game → pieces come back standing on their recorded squares (how they lay is not saved).
- Physics on a slow machine → the board stays responsive; if the frame rate drops, physics may run at lower precision but pieces must still come to rest.

## Requirements *(mandatory)*

### Functional Requirements

**Board size and shared squares**

- **FR-001**: Each board square MUST be at least 20% wider than in feature 001, for the Battlefield, the Outskirts and the Taverns alike. Zones beside the board (Graveyards, Well, pools, dice tray) MUST be moved so nothing overlaps.
- **FR-002**: Two units on one square MUST be shown side by side without overlapping, each clearly visible and separately clickable from the default camera.
- **FR-003**: The maximum number of units on one square MUST be a tunable value in the rules data, set to 2. Hero figures MUST NOT count towards it (they share squares as in 001; Hero Units come later with Favours/Achievements).
- **FR-004**: Units of opposing sides MUST NOT share a square in an accepted position, and no unit may share a square with a King (King's Majesty). Friendly non-King units MAY share a square up to the maximum.
- **FR-005**: In a normal Lead, a unit MUST NOT be Led onto a square holding a friendly unit. Only a special rule (a later ability) may allow it, and the rules MUST offer a way for such rules to do so without changing the normal path rules.
- **FR-006**: A successful Lead into Battle on a square with several enemy units MUST destroy all of them. Destiny for that Battle: the Leading side gains 2 D once (not per unit), the losing side gains 1 D for every unit destroyed, and each destroyed Queen gives Revenge as usual (up to the limit).
- **FR-007**: A square with several units MUST count as occupied for paths, threats, check, checkmate and Ram landings exactly like a square with one unit; each unit on it threatens and can be Led separately.

**Position check when rules resume**

- **FR-010**: The check when turning rules back on (001 FR-103) MUST accept friendly non-King units sharing a square up to the maximum, and MUST list: opposing units sharing a square; any unit sharing a King's square; more units on a square than the maximum. All other 001 checks stay.
- **FR-011**: Each listed problem MUST name the square and the units involved.

**Physics in sandbox**

- **FR-020**: In sandbox mode, units and hero figures MUST be physical pieces: they collide with each other, the board and the table edge, slide, and can fall over.
- **FR-021**: Players MUST be able to pick up a piece with the pointer, carry it above the board, and release it to drop it.
- **FR-022**: A carried piece MUST push and can knock over pieces it touches.
- **FR-023**: A piece picked up after falling over MUST land standing up when dropped.
- **FR-024**: When a piece comes to rest on a different square (or in or out of a Graveyard zone), the game MUST record it as a sandbox placement in the state and the log, so undo, save and the position check see it.
- **FR-025**: Pieces that come to rest off the 10×10 grid, or fall off the table, MUST wait at the table edge where the player can reach them and put them in a Graveyard or back on the board. Rules MUST NOT resume while any unit is neither on the Battlefield nor in a Graveyard, or any hero is off the 10×10 grid; the position check lists each one.
- **FR-026**: When rules are turned back on, the game MUST wait for pieces to come to rest (at most 3 seconds), stand every piece up on the square under its centre, and then run the position check.
- **FR-027**: In rules mode, pieces MUST NOT be moved by physics: they are placed upright on their squares from the game state only.
- **FR-028**: The physics MUST NOT decide anything in the rules: the rules only ever see squares, as with sandbox placement in 001.
- **FR-029**: Tokens, Destiny crystals and counters stay edited by value (001 FR-101); they are not physical pieces in this feature. The d20 keeps its own tray.

**Carry-over from 001**

- **FR-030**: Everything sandbox already does (free placement by click, value editors, free roll, permanent indicator, no automatic result, Continue in sandbox after the game) MUST keep working.
- **FR-031**: Every new acceptance scenario MUST have an automated test; rules scenarios against the headless rules core.

### Key Entities

- **Square occupancy**: the units on a square (0…maximum), all of one side; never shared with a King. Hero figures on the square are not counted.
- **Physical piece** (sandbox only): a unit or hero figure with a position and pose on the table, linked to its unit or hero in the game state. Its pose is presentation; only its square is game state.
- **Sandbox placement**: a recorded change of a piece's square (board square, Graveyard, or off the Battlefield), the same record 001 sandbox uses.
- **Position problem**: as in 001, with new kinds: opposing units share a square, too many units on a square.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 10 tries, a player can pick up a piece, drop it on a chosen square and see it rest there within 2 seconds, in at least 9 tries.
- **SC-002**: With all 32 units and 4 heroes in physical play, the table keeps a smooth frame rate (at least 50 frames per second on the reference laptop used for 001) while pieces are being knocked around.
- **SC-003**: After any sandbox session, turning rules back on gives the same squares a person reads off the screen for 100% of the pieces (no piece lost, duplicated or put on the wrong square).
- **SC-004**: With two units on one square, testers identify and select the intended unit on the first click in at least 9 of 10 attempts from the default camera.
- **SC-005**: Every acceptance scenario in this spec has a passing automated test, and all 001 tests still pass.

## Assumptions

- **A-01**: "Heroes come in a later feature" means named heroes and their abilities. The generic hero figures from 001 are physical pieces in sandbox like units (confirmed); they never count as units on a square until Hero Units arrive.
- **A-02**: The maximum of 2 units per square fits the current examples (Death Knight plus auxiliary pawn); confirmed "2 for now". It is a tunable so later abilities can raise it.
- **A-03**: Physics is only for free play in sandbox. Leads, Rams, pushes and the d20 in rules mode work as in 001.
- **A-04**: How a piece lies (fallen over, rotated) is not saved; saves and undo keep squares only.
- **A-05**: No v1 rule creates two units on one square; in play such squares come from sandbox now and from abilities later. The rules engine supports them now so abilities only add the creating rule.
- **A-06**: Mouse on desktop browsers only, as in 001.
