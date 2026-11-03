# Feature Specification: Standard Rules Game (3D, hot-seat)

**Feature Branch**: `001-standard-rules-game`

**Created**: 2026-11-03

**Status**: Draft

**Input**: User description: "Browser game app built on the standard Rošada rules (Basic Rules 2.5). Heroes and their abilities come later."

**Source rules**: `Basic Rules 2_5.docx` (project root), with the decisions below applied as tracked changes in `Basic Rules 2_5 - corrections.docx`. Where this spec and the rulebook disagree, the rulebook wins until the conflict is logged in *Open Questions* and decided.

---

## Problem Statement

Rošada only exists as a physical prototype, so every playtest needs the full box, a table and someone who knows the rules well enough to referee. The rules are dense (d20 Leads, Ram, taverns, Peace/War, Destiny pools) and easy to get wrong at the table, which makes playtest results unreliable. A browser version that plays the standard rules correctly lets the designers and the F&ST community playtest anywhere, and gives the later hero/ability work a tested rules core to plug into.

## Goals

1. **A complete game can be played** in the browser by 2–4 people on one device (hot-seat), from setup to a win or draw, using the standard rules with generic heroes.
2. **The game is the referee.** Every rule in scope is enforced: only legal actions are offered, dice and modifiers are resolved automatically, Destiny is tracked without manual bookkeeping.
3. **Players can step outside the rules when they want to**, by switching to a free sandbox where pieces and heroes move by hand.
4. **Heroes and abilities can be added later without rewriting the core**: rules live in engine-free TypeScript, components and heroes are data.

## Non-Goals (this spec)

| Out of scope | Why |
| --- | --- |
| Named heroes and their abilities (Scout, Cavalier, Magus, Monk…) | Separate spec; needs this rules core first |
| Epic Stage (Fanatic / Resolute / Dominant), Bloodied, Hero Destiny Generation | All depend on epic hero sheets |
| Achievements and Legendary Powers (Hero Unit, King's Forces, Far Reach…) | Large rule set; next phase after heroes |
| Auxiliary units, ability tokens, auras, Hazardous Terrain, Mark/Create/Modify | Only produced by abilities |
| Online multiplayer, accounts, matchmaking | Planned with Colyseus later; hot-seat validates rules first |
| AI opponent | Not requested; large effort on its own |
| Variant rules (Beginner Chess player, Archive final form) | Rulebook entries are still placeholders |

## Scope Summary

**In:** 10×10 board (8×8 battlefield + outskirts, taverns), 32 main units with standard paths incl. castling, en passant and promotion, 4 generic heroes (Short/Long range), hero turn phases, Move, Lead with d20, Battle/Destroy, Graveyard, Ram and Push, Check/Checkmate/King's powers, health, Unconscious + Heroic Recovery, taverns, Peace Treaty / Declaration of War, Revenge, Destiny Well + Common + Hero pools + Resilient Destiny, general abilities *Hero Retreat* and *Inspired Lead*, Draft/Mirror setup flow and turn order, win/draw detection, sandbox mode, 3D table.

---

## Clarifications

### Session 2026-11-03

- Q: Revenge token limit? → A: 2 per side.
- Q: Hero starting squares? → A: King's Court squares behind the friendly Bishops (corrected from Knights). Assigned by default.
- Q: How is Range counted? → A: In any direction, including diagonally.
- Q: Which way does a Knight Ram push? → A: One square back = one more square in the direction of the Knight's last 1-square step.
- Q: Can heroes share squares? → A: Yes; all enemy heroes on a Rammed square are Rammed, friendly heroes are not.
- Q: Do unit paths interact with friendly heroes? → A: Yes, but friendly heroes are never Rammed.
- Q: Starting health and Resilient Destiny points? → A: From the health bars: 10 / 8 starting, 20 / 16 epic (FR-021, FR-054).
- Q: What happens when the initial 16 Destiny run out (no Epic Stage yet)? → A: The Well refills per the rules and the game continues with Starting Heroes; a notice says the Epic Stage comes later.
- Q: Does a check (or no possible Lead) block the free Meal in a friendly tavern at End of Turn? → A: Yes, the free Meal is treated like an End of Turn ability and is blocked.
- Q: Does the "Rammed hero may not Lead themself into Battle with the unit that Rammed them" rule apply in v1? → A: No. It only matters for Hero Units and is added with them later.
- Q: Can players switch from sandbox back to enforced rules mid-game? → A: Yes, after the game checks that the position is legal.
- Q: Do players choose turn order? → A: No. Players choose heroes; the game sets turn order and starting squares automatically.
- Q: Are the Resilient Destiny points in FR-054 correct? → A: Yes.
- Q: How is the d20 rolled? → A: Physics roll started with a Roll button; the throw decides the number.
- Q: When can a hero buy in a tavern? → A: While standing in a tavern at the start of their turn, or when pausing their Move in a tavern; they then continue with leftover Movement. Once they leave, they cannot buy any more.
- Q: With 3 players, who controls what? → A: The side with one player: that player controls both heroes of the side.
- Q: Art? → A: Placeholders first; real images added in later stages.

---

## User Scenarios & Testing *(mandatory)*

Personas: **Playtester** (a player at the device), **Designer** (Luka and the rules team, checking that the rules work as written).

### User Story 1 – Set up and start a game (Priority: P1)

A group opens the game, picks 2, 3 or 4 players, splits into Light and Dark sides, picks the four generic heroes (a range type, Short or Long, for each) in Draft or Mirror order, and starts. Turn order and starting squares follow automatically from the picks. The board, units, heroes, Destiny Well (16), hero pools (3 each) and the Peace Treaty token are placed automatically.

**Why this priority**: Nothing else can be played or tested without it.

**Independent Test**: Start a game with each player count and check the starting state against the rulebook *Setup* section.

**Acceptance Scenarios**:

1. **Given** the start screen, **When** the group chooses 2 players, **Then** each player controls both heroes of one side.
2. **Given** 3 players, **When** setting up, **Then** the side with one player has that player control both of its heroes, and on the other side each player controls one hero.
3. **Given** heroes are picked, **Then** turn order is set automatically from the pick order (FR-082): each side's first-picked hero plays first for that side, so Light's first pick is turn 1, Dark's first pick turn 2, Light's second pick turn 3, Dark's second pick turn 4. Players are not asked to choose turn order.
4. **Given** setup is complete, **Then** the Destiny Well holds 16, each Hero Destiny Pool holds 3, each Common Pool holds 0, the Peace side is up and each hero stands on its starting square: the King's Court square directly behind a friendly Bishop's starting square (files c and f), one hero per square, assigned by default (FR-083).

---

### User Story 2 – Take a hero turn: Move and Lead (Priority: P1)

The active hero moves up to their Movement through adjacent squares, then must Lead one friendly unit in Range along its legal path. The game rolls the d20 (unless no roll is needed), applies modifiers, and on 6+ places the unit; a Battle destroys the enemy unit.

**Why this priority**: This is the core loop of the game.

**Independent Test**: Play a scripted sequence of turns and compare board state, rolls and Destiny with a hand-refereed run.

**Acceptance Scenarios**:

1. **Given** a Short range hero (Move 5, Range 1), **When** they Move, **Then** only paths of up to 5 sequentially adjacent squares are offered, and squares with an enemy unit or a King cannot be the final square.
2. **Given** a Long range hero (Move 3, Range 3), **When** they Lead, **Then** only friendly units within 3 squares are selectable and the hero stays where they are.
3. **Given** a Short range hero Leads successfully, **Then** the hero advances with the unit and ends on a square of the player's choice adjacent to it that is not occupied by a King or enemy unit.
4. **Given** the Peace side is up, **When** a non-King Lead is announced, **Then** it succeeds without a roll.
5. **Given** the War side is up and the King is not in check, **When** the d20 shows 3, **Then** the total is 5 and the Lead fails, the unit does not move, and the side gains 1 D.
6. **Given** a Lead is possible, **Then** the player cannot end the turn without attempting it.
7. **Given** a Lead would leave the own King in check, **Then** that destination is not offered.
8. **Given** a King is Led (including castling), **Then** no roll is made.

---

### User Story 3 – Win or draw (Priority: P1)

The game detects checkmate in the *Before Turn* phase, a King destroyed in Battle, and the three draw conditions, then shows the result.

**Why this priority**: Without an end state there is no complete game.

**Independent Test**: Load prepared board positions and check the result.

**Acceptance Scenarios**:

1. **Given** a King is checkmated (standard chess definition, units only, heroes' range ignored), **When** the next hero's *Before Turn* phase starts, **Then** the side that gave mate wins.
2. **Given** a King stays in check after a failed Lead, **When** the enemy successfully Leads a unit into Battle with that King, **Then** that side wins.
3. **Given** both Kings are in check at *Beginning of Turn* and at *End of Turn* of the same turn, **Then** the game ends in a draw.
4. **Given** the active hero has no unit that could legally be Led even ignoring range, **Then** the game ends in a draw.
5. **Given** one side offers a draw, **When** the other accepts, **Then** the game ends in a draw.

---

### User Story 4 – Ram, wounds, Unconscious and taverns (Priority: P2)

Enemy heroes in the path of a Lead are Rammed: pushed along the path, take 3 wounds. Heroes at 0 health go Unconscious, return to a friendly tavern, skip a turn and recover to half health. Taverns sell Drinks and Meals for Destiny.

**Why this priority**: These are the hero-vs-hero rules that make Rošada more than chess with dice; the game can be tested without them, but they are needed before heroes are added.

**Independent Test**: Place a hero in a unit's path, Lead through it, and check position, health and Destiny.

**Acceptance Scenarios**:

1. **Given** an enemy hero stands on a square in the path of a successful Lead, **Then** that hero is pushed along the path, lands in the next square in the direction of the path, takes 3 wounds, and the Leading side gains 1 D.
2. **Given** two or more heroes share a square in the path, **Then** every enemy hero on that square is Rammed (each takes 3 wounds; the Leading side gains 1 D per hero wounded); friendly heroes on that square are not Rammed.
3. **Given** a Knight is Led onto a square with one or more enemy heroes, **Then** each of them is Rammed: pushed one square back, i.e. one more square in the direction of the Knight's last 1-square step, and takes 3 wounds.
4. **Given** the landing square holds a King or is off the board, **Then** the Rammed hero goes to their starting square instead.
5. **Given** a push lands a hero on a square that already holds another hero, **Then** the push is allowed and the heroes share the square.
6. **Given** a friendly hero stands in the path of a Lead, **Then** the path interacts with that square, but the friendly hero is not Rammed, not wounded and does not block the Lead.
7. **Given** a hero is Rammed, **Then** no Lead restriction is applied on their next turn in v1 (the "may not Lead themself into Battle with the unit which Rammed them" rule only applies to Hero Units, added later). The game still records which unit Rammed the hero.
8. **Given** a King's Lead Rams an enemy hero, **Then** King's Banishment applies: the hero goes to their starting square with −1 Movement next turn; friendly heroes in the King's path are pushed one square back.
9. **Given** a hero's health reaches 0, **Then** they are placed in a friendly tavern of their choice, skip their next turn, and at *Beginning of Turn* of the following turn heal to half max health.
10. **Given** a hero starts their turn in a tavern, **Then** they may buy Drinks (1 D, heal 1) and Meals (2 D, heal 3) before leaving it, healing never exceeding max health.
11. **Given** a hero is in a friendly tavern at *End of Turn*, **Then** they get a free Meal, unless their King was in check at the end of their Lead or no Lead was possible that turn (the free Meal counts as an End of Turn ability).
12. **Given** a hero starts their turn in a tavern, **Then** their Movement is reduced by 1 (total reduction never more than 2).
13. **Given** a hero moving during their Move phase enters a tavern, **When** the player pauses the Move there, **Then** they may buy Drinks and Meals and then continue moving with their leftover Movement.
14. **Given** a hero has left a tavern this turn, **Then** they cannot buy there any more this turn. A Short range hero who ends up in a tavern while advancing with a Led unit cannot buy (buying only happens before or during Move).

---

### User Story 5 – Destiny economy and general abilities (Priority: P2)

The game takes Destiny from the Well into the correct pool whenever it is earned, lets heroes spend from their own pool and their side's Common Pool, and offers *Inspired Lead* and *Hero Retreat*.

**Why this priority**: Destiny is the resource heroes will spend on abilities; the economy has to be right before abilities exist.

**Independent Test**: Run a scripted game and compare every pool after each turn to a hand-kept ledger.

**Acceptance Scenarios**:

1. **Given** a side checks the enemy King, **Then** its Common Pool gains 2 D, at most once per turn.
2. **Given** a side destroys one or more enemy units in one Battle, **Then** it gains 2 D; the side that lost the unit gains 1 D per own unit destroyed.
3. **Given** a hero takes wounds from an enemy, **Then** they gain 1 D into their Hero Pool for each Resilient Destiny point (FR-054) their health reaches or passes on the way down, not counting the point they start on; self/friendly wounds give none. *Example: a Short range hero at 10 takes 3 wounds from a Ram → health 7, passes 8 → gains 1 D. A Long range hero at 8 takes 5 wounds → health 3, passes 6 and 4 → gains 2 D (the rulebook example).*
4. **Given** the Peace side is up, **When** either side gains Destiny, **Then** the token flips to War and all Leads get +2 from then on.
5. **Given** a hero uses *Inspired Lead* in *Before Lead* spending X D, **Then** their next Lead gets +2×X.
6. **Given** a hero uses *Hero Retreat* (2 D) at *End of Turn*, **Then** they are placed in a friendly tavern and get a free Drink; it is unavailable if their King was in check at the end of their Lead or if no Lead was possible.
7. **Given** a side's Queen is destroyed, **Then** that side gains a Revenge token, which can be discarded to auto-succeed a Lead instead of rolling. A side can hold at most 2 Revenge tokens; a Queen destroyed while the side already holds 2 gives no extra token.
8. **Given** Destiny is spent before the Well has ever been depleted, **Then** it is removed from play, not returned to the Well.
9. **Given** the initial 16 in the Well are used up, **Then** the Well is refilled per the rules and later spending returns to the Well; heroes stay Starting Heroes, the game shows a notice that the Epic Stage comes in a later version, and play continues.

---

### User Story 6 – Sandbox mode (Priority: P2)

At any time from settings, or after the game ends, players can switch rule enforcement off and freely pick up, move, add back or remove units and heroes and change pools and health on the 3D table.

**Why this priority**: Explicitly requested; lets designers try situations the rules engine doesn't cover yet (for example hero abilities played by hand).

**Independent Test**: Switch to sandbox mid-game, move a King onto an occupied square, and confirm the game allows it and logs the switch.

**Acceptance Scenarios**:

1. **Given** a game is in progress, **When** a player turns enforcement off in settings, **Then** the game asks for confirmation and then allows free manipulation of all pieces, heroes, tokens and counters.
2. **Given** a game has ended, **When** players choose *Continue in sandbox*, **Then** the final position stays on the table and can be freely changed.
3. **Given** sandbox mode is on, **Then** a clear indicator is always visible and no win/draw is declared automatically.
4. **Given** sandbox mode, **When** the d20 is rolled by hand, **Then** the result is shown but not applied to any Lead.
5. **Given** a game in sandbox mode, **When** a player turns enforcement back on and the position is legal, **Then** play resumes at the *Before Turn* phase of the current active hero (so checkmate is checked first).
6. **Given** a game in sandbox mode, **When** a player turns enforcement back on and the position is not legal, **Then** the game lists each problem (for example "Light King shares a square") and stays in sandbox.

---

### User Story 7 – 3D table (Priority: P1, delivered with Stories 1–3)

The game is shown on a 3D table with 3D units, hero figures, d20, Destiny crystals and tokens. Players can rotate and zoom the camera and play with mouse.

**Why this priority**: Requested from the start.

**Independent Test**: Play one full turn with mouse only and check that legal squares, the roll and the result are readable from the default camera.

**Acceptance Scenarios**:

1. **Given** a hero turn, **When** the player selects a unit, **Then** legal destination squares are highlighted on the 3D board.
2. **Given** a Lead needs a roll, **When** the player presses Roll, **Then** a 3D d20 is thrown with physics, and the face on top, modifiers, total and success/fail are displayed.
3. **Given** the active hero changes, **Then** the Active Hero indicator, current phase and the hero's health, Movement and Range are visible without opening a menu.

---

### Edge Cases

- A Lead is possible only for units that are not in the hero's range → no Lead is possible; the turn continues without After Lead / End of Turn abilities.
- No friendly unit on the whole board can legally be Led → draw (rule 3b), checked in the Lead phase.
- Pawn Promotion during the opponent's turn (cannot happen without abilities in v1, but the rule is supported): the next hero of the promoting side in turn order chooses.
- A Ram pushes a hero onto a square that already holds another hero → allowed, they share the square.
- A Lead's path crosses a square holding one enemy and one friendly hero → only the enemy hero is Rammed.
- A Knight lands on a square holding two enemy heroes → both are Rammed and pushed one square back.
- A Knight's push-back square holds a King or is off the board → the hero goes to their starting square.
- A single hit takes a hero past several Resilient Destiny points (for example 3 wounds from 16 to 13 on the 16 bar passes 14) → 1 D per point passed.
- A hero goes Unconscious on the turn the Well runs out.
- Gaining more Destiny than the Well holds: Well depletes, refills, the rest is taken (FAQ 11).
- Inspired Lead is used and then no legal Lead exists.
- King in check at the end of a Lead while the hero is in a friendly tavern → no After Lead / End of Turn abilities and no free Meal.
- A hero pauses in a tavern with 0 Movement left → may buy, then the Move ends there.
- A die lands tilted against another object or falls off the table → automatic re-roll; only a die resting flat counts.
- A browser refresh mid-turn. *(P1 save/load)*

---

## Requirements *(mandatory)*

### Functional Requirements – Must-Have (P0)

**Board & units**

- **FR-001**: System MUST model a 10×10 grid: the 8×8 Battlefield (ranks 1–8, files a–h, quadrants, royal ranks), the Outskirts ring (King's Court rows, Wilderness columns) and 4 corner Taverns (2 friendly per side).
- **FR-002**: System MUST place the 32 main units on standard chess starting squares, Light at ranks 1–2.
- **FR-003**: System MUST generate legal paths for King, Queen, Rook, Bishop, Knight and Pawn as in the rulebook, including pawn double step from its starting square, en passant, castling (King and Rook not previously Led, no units between, King's squares not threatened) and Promotion of unmodified main pawns to Queen/Rook/Bishop/Knight.
- **FR-004**: Units MUST stay on the Battlefield; heroes MAY be on the Battlefield and Outskirts.
- **FR-005**: Destroyed main units MUST go to the Graveyard and be visible there.

**Turn structure**

- **FR-010**: System MUST run each hero turn as the phases *Before Turn → Beginning of Turn → Before Move → Move → Before Lead → Lead → After Lead → End of Turn*, showing the current phase.
- **FR-011**: System MUST follow turn order 1→2→3→4 (Light 1 and 3, Dark 2 and 4) and pass the Active Hero token at *End of Turn*.
- **FR-012**: System MUST let the player undo actions within the current phase until new information is revealed (a roll, a destroyed unit), per the designers' note. Undo across the Active Hero hand-off MUST NOT be possible.

**Heroes (generic)**

- **FR-020**: System MUST support 4 generic heroes, each set to Short range (Movement 5, Range 1) or Long range (Movement 3, Range 3) at setup.
- **FR-021**: Starting max health MUST be 10 for Short range and 8 for Long range (the red area of the 20 and 16 health bars), configurable in the hero data. Epic max health (20 / 16) is stored for later use.
- **FR-022**: Hero Move MUST be through sequentially adjacent squares up to Movement, never ending on an enemy unit or a King; Movement reductions MUST NOT exceed 2.
- **FR-023**: Range MUST be counted in any direction (orthogonal and diagonal, king-step distance): Range 1 is the 3×3 area around the hero, Range 3 the 7×7 area.
- **FR-025**: Hero starting squares MUST be the King's Court squares directly behind the friendly Bishops' starting squares (files c and f), one hero per square.
- **FR-026**: Any number of heroes, friendly or enemy, MAY share a square. Heroes never block unit paths.
- **FR-024**: Hero definitions (name, range type, Movement, Range, max health, health-bar thresholds, art reference, abilities list) MUST be data (JSON), so named heroes can be added without code changes to the rules core.

**Lead**

- **FR-030**: System MUST follow *Choose unit → Announce square → Roll → Place* and allow one Lead per turn.
- **FR-031**: System MUST force a Lead attempt when one is possible, and MUST NOT offer a Lead that leaves the own King in check.
- **FR-032**: Success MUST be d20 + modifiers ≥ 6. Modifiers in v1: War +2, own King in check +4, Inspired Lead +2 per D. The breakdown MUST be shown.
- **FR-033**: No roll MUST be made for King Leads, while the Peace side is up, or when a Revenge token is discarded.
- **FR-034**: The d20 MUST be rolled with physics: the player presses a **Roll** button, the die is thrown on the 3D table with a random throw, and the face that ends up on top is the result.
- **FR-036**: A roll MUST be repeated automatically if the die does not come to rest flat on the table (tilted against an object, off the table, or still moving after a time limit).
- **FR-037**: The rules core MUST receive the roll as an input value, so headless tests can supply fixed rolls; throws MUST use a seedable random source so a game can be replayed.
- **FR-035**: A failed Lead MUST leave the unit in place and give the side 1 D.

**Check, mate, King**

- **FR-040**: System MUST compute Threaten, Protected, Check, discovered check and Checkmate as defined in the rulebook.
- **FR-041**: System MUST enforce King's powers that apply without abilities: no roll (Determination), Banishment, Majesty (no sharing, nothing pushed into its square).
- **FR-042**: System MUST block After Lead and End of Turn abilities, including the free tavern Meal, when the own King is in check at the end of the Lead or when no Lead was possible.

**Ram, Push, health**

- **FR-050**: System MUST apply Ram to every enemy hero on each square the Lead's path interacts with: push along the path to the next square in the path direction, 3 wounds each; to starting square if that square has a King or is off the board.
- **FR-051**: System MUST track health 0…max, apply wounds and healing, and handle Unconscious (friendly tavern of choice, skip next turn, Heroic Recovery to half max at *Beginning of Turn*).
- **FR-052**: For a Knight Lead (which interacts only with its start and end squares), every enemy hero on the end square MUST be Rammed: pushed one more square in the direction of the Knight's last 1-square step (after the 2-square leg), and 3 wounds. *Example: Knight b1→c3 (2 up, 1 right) Rams a hero on c3 → the hero lands on d3.*
- **FR-053**: Unit paths MUST interact with squares holding friendly heroes (needed for King's Banishment now and for abilities later), but friendly heroes MUST NOT be Rammed or wounded by friendly Leads.
- **FR-054**: Resilient Destiny points MUST come from the hero's health bar data:

  | Health bar | Starting area (red) | Epic area (grey) | Resilient Destiny points |
  | --- | --- | --- | --- |
  | 16 (Long range) | 1–8 | 9–16 | 1, 2, 4, 6, 8, 9, 11, 14 |
  | 20 (Short range) | 1–10 | 11–20 | 1, 2, 4, 6, 8, 10, 11, 13, 15, 18 |

  0 is Unconscious (skull). Points confirmed by Luka from the physical bars.

**Taverns**

- **FR-060**: System MUST offer Drink (1 D, heal 1) and Meal (2 D, heal 3) while the hero is in a tavern at the start of their turn or has paused their Move in a tavern (then continuing with leftover Movement), and not after the hero has left that tavern or during a Lead advance; the free Meal in a friendly tavern at *End of Turn* (blocked as in FR-042), and −1 Movement when starting the turn in a tavern.

**Tokens & Destiny**

- **FR-070**: Peace Treaty token MUST start Peace side up and flip to War permanently when either side gains Destiny (or uses an ability affecting a unit, which cannot happen in v1).
- **FR-071**: Revenge token MUST be gained when a side's Queen is destroyed, held up to a maximum of 2 per side, and discardable to auto-succeed a Lead instead of rolling.
- **FR-072**: System MUST track the Destiny Well (16 at start), two Common Pools and four Hero Pools (3 each), all gains from the rulebook's *Common Destiny Pool* list, Resilient Destiny, and the Well depletion/refill rule. Spending MAY draw from the hero's pool, the side's Common Pool or both.
- **FR-073**: System MUST offer the general abilities *Inspired Lead* (X D, Before Lead) and *Hero Retreat* (2 D, End of Turn), each once per turn.

**Setup flow**

- **FR-080**: System MUST support 2, 3 or 4 players on one device. With 2 players each controls one side; with 3 the side with one player has that player control both its heroes; with 4 each player controls one hero.
- **FR-081**: System MUST provide the Draft / Mirror choice as a setup step for picking heroes. With generic heroes a pick is a range type; the step MUST be kept so named heroes can use it later.
- **FR-082**: Turn order MUST be set automatically from the pick order, without asking the players: Light's first pick = turn 1, Dark's first pick = turn 2, Light's second pick = turn 3, Dark's second pick = turn 4. *(Default proposed by Claude; easy to change.)*
- **FR-083**: Starting squares MUST be assigned by default: each side's first-picked hero starts behind its c-file Bishop, the second behind its f-file Bishop. *(Default proposed by Claude; easy to change.)*

**End of game**

- **FR-090**: System MUST detect checkmate in *Before Turn*, King destroyed in Battle, and the three draw conditions, and show the result with a summary (turns played, units destroyed per side).
- **FR-091**: System MUST offer *New game*, *Rematch (same setup)* and *Continue in sandbox* on the result screen.

**Sandbox**

- **FR-100**: System MUST let players toggle rule enforcement off from settings during a game (with confirmation) and from the result screen.
- **FR-101**: In sandbox, users MUST be able to move any unit or hero to any square, remove units to the Graveyard, return them, edit health and pool values, and roll the d20 freely.
- **FR-102**: Sandbox MUST show a permanent indicator and MUST NOT declare win/draw automatically.
- **FR-103**: Players MUST be able to turn enforcement back on during a game. Before resuming, the system MUST check that the position is legal and list every problem if it is not. Checks include at least: at most one unit per square; units only on the Battlefield; nothing sharing a square with a King; exactly one King per side; every hero on the board; no unpromoted main pawn on the enemy royal rank; health within 0…max; pools ≥ 0; at most 2 Revenge tokens per side.
- **FR-104**: Units moved in sandbox MUST count as having been Led (no castling with them afterwards), and en passant chances MUST be cleared when enforcement resumes.

**3D presentation**

- **FR-110**: System MUST render the board, units, hero figures, Graveyard/Well, pools, tokens and d20 on a 3D table with orbit/zoom camera and a reset-camera control.
- **FR-111**: System MUST highlight selectable units, legal move squares and legal Lead destinations, and show a readable phase/turn HUD.
- **FR-112**: System MUST keep a text log of every action, roll and Destiny change in the current game.
- **FR-113**: v1 MUST use placeholder 3D models and images for units, heroes, board and tokens. Every model and image MUST be referenced from the data files, so real art can replace a placeholder without code changes.

**Architecture constraints** *(from the tech-stack decision)*

- **FR-120**: Rules, turn logic and Destiny MUST be plain TypeScript modules with no import of Three.js, Rapier or Colyseus, and MUST be runnable headless in tests.
- **FR-121**: The game state MUST be a serialisable snapshot so it can later be saved, replayed and sent over the network.

### Nice-to-Have (P1)

- **FR-200**: Save and resume a game in the browser (survives refresh).
- **FR-201**: Export/import a game state file, to share a position for playtest discussion.
- **FR-202**: Rule reference panel linking each rejected action to the rule that blocked it ("King may not be Led into a threatened square").
- **FR-203**: Physics-based free handling of pieces in sandbox (pick up, drop, knock over).
- **FR-204**: Board-position editor to set up test situations.

### Future Considerations (P2) – design for, don't build

- Named heroes and abilities with phase hooks (*Before Move*, *Instead of Lead*, *After Lead*…), costs, Bloodied costs, once-per-turn tracking.
- Epic Stage, Hero Destiny Generation, Achievements, Legendary Powers, Hero Units.
- Auxiliary and special units (Buffalo, Carnivorous Monkey…), Mark/Create/Modify, ability and aura tokens.
- Online rooms with an authoritative server (Colyseus) using the same rules modules.
- Touch controls for tablets.

### Key Entities

- **GameState**: setup choices, stage, turn number, active hero, phase, board, pools, tokens, enforcement flag, log.
- **Square**: coordinates, region (Battlefield / King's Court / Wilderness / Tavern), occupant unit, heroes present, tokens.
- **Unit**: side, type, main/auxiliary, has-been-Led flag, en-passant eligibility, original type (for future Modify).
- **Hero**: id, side, controlling player, range type, Movement, Range, health/max, starting square, turn order, status (Unconscious, skip-turn, Movement penalties), Rammed-by unit, hero pool.
- **DestinyLedger**: Well count, initial-16-depleted flag, Common Pools, Hero Pools, entries per gain/spend.
- **Token**: Peace/War, Revenge, Turn Order, Active Hero.
- **LeadAttempt**: hero, unit, path, announced square, roll, modifiers, total, result, Battle/Ram outcomes.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

Targets are proposals for this project, not measured baselines.

**Leading (first weeks after the playable build)**

- **SC-001**: A 4-hero hot-seat game can be played from setup to a result with no manual corrections in at least 5 of 5 internal playtests.
- **SC-002**: Automated rules tests cover every rule listed under *Scope Summary*, with at least one passing test per acceptance scenario in this spec.
- **SC-003**: In at least 3 recorded playtests refereed by a rules designer, the game's decisions match the referee's on 100% of Leads, Rams and Destiny changes (any mismatch becomes a bug or a rule question).
- **SC-004**: New players can complete their first full turn without help within 2 minutes.
- **SC-005**: The 3D table runs at 60 fps on a mid-range laptop in Chrome, Edge and Firefox, and loads in under 10 seconds on a normal home connection.

**Lagging (over 1–3 months)**

- **SC-006**: At least 10 full games played by people outside the core team (for example F&ST members).
- **SC-007**: The first named hero can be added by writing data plus ability code only, with no change to the core rules modules.
- **SC-008**: Every rulebook ambiguity found during development is logged and resolved in the rulebook.

---

## Open Questions

No open questions. New ones found during planning or building get added here.

### Resolved (2026-11-03, Luka)

| # | Decision | Where |
| --- | --- | --- |
| Q-01 | Revenge token limit is **2 per side**. Queen section of the rulebook fixed in the corrections file. | FR-071 |
| Q-02 | Hero starting squares are the King's Court squares **behind the friendly Bishops** (corrected from Knights), assigned by default; turn order is automatic. | FR-025, FR-082, FR-083 |
| Q-03 | Starting max health is **10 (Short) / 8 (Long)**, Epic **20 / 16**, from the health bars. FAQ 4 in the rulebook fixed ("short ranged" → "long ranged") in the corrections file. | FR-021 |
| Q-04 | Range is counted **in any direction**. | FR-023 |
| Q-06 | A Knight Ram pushes heroes **one square back = one more square in the direction of the Knight's last 1-square step**. | FR-052 |
| Q-08 | Heroes **can share squares**. Every enemy hero on a Rammed square is Rammed; friendly heroes are not. | FR-026, FR-050 |
| Q-09 | Resilient Destiny points from the health bars are **confirmed**. | FR-054 |
| Q-13 | Unit paths **interact with friendly heroes** (they are not Rammed). | FR-053 |
| Q-05 | When the initial 16 Destiny run out: **refill and continue** with Starting Heroes, with a notice. | Story 5 |
| Q-07 | The Rammed-hero Battle restriction has **no effect in v1**; added with Hero Units. | Story 4 |
| Q-10 | A check or no possible Lead **blocks the free Meal**. | FR-042, FR-060 |
| Q-12 | Sandbox → enforced **is allowed after a legality check**. | FR-103, FR-104 |
| Q-11 | Dice: **physics roll with a Roll button**; tilted or off-table dice re-roll. | FR-034, FR-036, FR-037 |
| Q-14 | Taverns: buy **at the start of the turn or when pausing the Move** in a tavern; not after leaving, not during a Lead advance. | FR-060 |
| Q-15 | 3 players: the single player on a side **controls both** of its heroes. | FR-080 |
| Q-16 | Art: **placeholders first**, real images later. | FR-113 |

## Assumptions

- **A-01**: Players share one device with mouse and keyboard; desktop browsers only (Chrome, Edge, Firefox).
- **A-02**: English UI for v1; text kept in string files so Croatian can be added.
- **A-03**: Generic heroes use the Short/Long range values from *Movement & Range*, the starting health in FR-021 and the health bars in FR-054.
- **A-04**: Draft/Mirror is kept as a setup step even though generic heroes have no identity yet.
- **A-05**: The rulebook (Basic Rules 2.5) is the source of truth; highlighted/unfinished rulebook text is treated as provisional and listed in Open Questions when it affects v1.

## Timeline Considerations

No hard deadline is known. Suggested phasing inside this spec:

1. **Phase A – Rules core, headless**: board, units, paths, check/mate, Lead with d20, turn phases, end conditions. Tested without graphics. *(Stories 2, 3)*
2. **Phase B – 3D table and setup**: Three.js board, pieces, die, HUD, setup flow. First playable chess-with-dice game. *(Stories 1, 7)*
3. **Phase C – Heroes' world**: Move, Range, Ram, health, Unconscious, taverns. *(Story 4)*
4. **Phase D – Destiny and tokens**: pools, Peace/War, Revenge, general abilities. *(Story 5)*
5. **Phase E – Sandbox mode**. *(Story 6)*

Dependencies: no blocking questions left. The remaining open questions can be settled during implementation. Next spec after this one: named Starting Heroes and their abilities.
