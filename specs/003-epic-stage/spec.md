# Feature Specification: Epic Stage, Destiny Generation, Royal Favors and Legendary Powers

**Feature Branch**: `003-epic-stage`

**Created**: 2026-11-04

**Status**: Implemented

**Input**: User description: "Epic Stage and the rest of the basic rules: Epic Stage start when the initial 16 Destiny are depleted (choose Fanatic/Resolute/Dominant destinies in turn order, same side cannot combine Fanatic and Dominant, depleting hero chooses last and takes Manifest Epic Destiny, Common Pool split, health increase, Declaration of War removed), Hero Destiny Generation (tracker from 1, +1 per missing friendly unit type, +1 for auxiliary pawns in the enemy royal rank, gained at End of Turn), Bloodied, Royal Favors (10 numbered, half completion, Tides of Destiny ×5, Manifest Epic Destiny) with a tracker on the table and a modal showing what each side has completed or still needs, Legendary Powers (Hero Unit, King's Forces, Advanced Warfare, Far Reach, Swift Change, Final Form) with auxiliary units and Create rules they need. Visual improvements based on the Tabletop Simulator version (wooden table, illustrated board, hero sheets with health and Destiny generation trackers, Royal Favor track, turn-order medallions) and the hero / epic-hero art in assets; real 3D models come later."

**Builds on**: `specs/001-standard-rules-game` (rules core, Destiny Well, Peace/War, sandbox) and `specs/002-sandbox-physics` (shared squares, physical sandbox).

**Source rules**: `Basic Rules 2_5.docx` with the corrections file (now `Basic Rules 2_5 - claud corrections.docx`), sections *Destiny Well*, *Hero Destiny Pool*, *Hero Destiny Generation*, *Bloodied*, *Abilities*, *Epic Heroes*, *Royal Favors & Legendary Powers*, *Create*, *Auxiliary Units*, *Movement & Range* (Hero unit range), *Ram* (Hero Unit restriction).

**Reference art**: `assets/hero and epic stage images/` (Cavalier, Magus, Monk, Scout and three Epic forms each) and `assets/Table top Simulator examples/` (screenshots and a video of the Tabletop Simulator table).

---

## Clarifications

### Session 2026-11-04

- Q: Named heroes and Hero Unit type? → A: Keep the generic heroes in this feature. A Short range hero becomes a Knight Hero Unit, a Long range hero a Bishop Hero Unit. The hero art is used only as decoration on the hero sheets.
- Q: Does the +2 War bonus continue after the Declaration of War token is removed in the Epic Stage? → A: No. In the Epic Stage a Lead roll of 1–5 with no bonus fails and 6+ succeeds.
- Q: How does a *Final Form* Hero Unit (Rook and Knight/Bishop at once) move? → A: Each Lead may use either type's path, and it threatens with both.
- Q: In which phase may a hero become or stop being a Hero Unit without *Swift Change*? → A: *Beginning of Turn* only (plus *End of Turn* with *Swift Change*); this timing is long playtested.
- Q: When are Royal Favors that depend on the board position checked (*Great Incursion*, *Deploy Troops*, *Decimate*, *Offense is the Best Defense*)? → A: After every action, for both sides. Once a side has earned a Royal Favor (fully or half), it never loses it, for every Royal Favor.
- Q: What are they called? → A: **Royal Favors** (the rulebook calls them Achievements); the word "Achievement" is not used in the game.
- Q: Do auxiliary units and Hero Units count as having their type for Destiny generation's "missing types"? → A: Main and auxiliary units count; Hero Units do not.
- Q: What happens when a Lead passes through or ends on an enemy Hero Unit's square? → A: It acts like a unit: it blocks paths, a Lead ending on it is a Battle (the Hero Unit is destroyed if the Lead succeeds), and it is never Rammed or pushed.
- Q: Does *Manifest Epic Destiny* fill a Royal Favor slot and count towards Legendary Powers? → A: Yes, it fills the next slot and counts like any other Royal Favor.

---

## Scope

**In:** Epic Stage start and the destiny choice; Common Pool split and health increase; Declaration of War removal; Hero Destiny Generation; Bloodied; all 10 numbered Royal Favors, half completion, Tides of Destiny ×5 and Manifest Epic Destiny; a Royal Favor tracker on the table and in a modal for both sides; the six Legendary Powers (Hero Unit, King's Forces, Advanced Warfare, Far Reach, Swift Change, Final Form); auxiliary units of the standard types created by King's Forces, with the *Create* rules; the Hero Unit Ram restriction left out of 001 (001 Q-07); a visual pass on the table towards the Tabletop Simulator version, using the hero and epic-hero art.

**Out (later features):** named-hero abilities and their costs (Bloodied costs are tracked but no ability uses them yet); Mark, Modify, ability and aura tokens, Hazardous Terrain; special auxiliary units (Buffalo, Failed Clone, Carnivorous Monkey, Elite Squad of Veterans, Legendary Ancient); variant rules (*Beginner Chess player*, *Archive final form*); online play; final 3D models (Luka will provide them).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 – The Epic Stage begins (Priority: P1)

When the initial 16 Destiny in the Well run out during a hero's turn, the turn continues. At the next *Before Turn*, every hero chooses an Epic destiny (Fanatic, Resolute or Dominant) in turn order, and the hero who emptied the Well chooses last and takes the *Manifest Epic Destiny* Royal Favor. Heroes become Epic Heroes: more health, Destiny generation, their Epic art and name.

**Why this priority**: The second half of every game depends on it; 001 only showed a notice.

**Independent Test**: Start a game with 2 Destiny left in the Well, make a Battle, and check the choice order, the Fanatic/Dominant rule, the health increase, the Common Pool split and the removed War token.

**Acceptance Scenarios**:

1. **Given** the Well has its last Destiny taken during a hero's turn, **Then** the turn continues normally and the Epic Stage starts at the next *Before Turn*.
2. **Given** the Epic Stage starts, **Then** every hero chooses Fanatic, Resolute or Dominant in turn order starting with the active hero, and the hero who depleted the Well chooses last.
3. **Given** one hero of a side chose Fanatic, **Then** the side's other hero cannot choose Dominant, and the other way round.
4. **Given** the hero who depleted the Well, **Then** their side receives the *Manifest Epic Destiny* Royal Favor, which fills the next slot on its track and counts towards Legendary Powers.
5. **Given** a side's Common Pool holds 5 D at the start of the Epic Stage, **Then** each of its heroes gains 2 D and 1 D stays in the Common Pool.
6. **Given** a Short range hero with 7 of 10 health becomes Epic, **Then** their maximum health is 20 and current health 17; a Long range hero at 8 of 8 becomes 16 of 16.
7. **Given** the Epic Stage starts, **Then** the Declaration of War token is removed from the table and the +2 War bonus ends: from then on a Lead roll of 1–5 with no other bonus fails and 6+ succeeds.
8. **Given** a hero becomes Epic, **Then** their hero sheet shows the chosen destiny (Fanatic, Resolute or Dominant) with its decorative Epic art, and the Destiny Generation tracker at 1.

---

### User Story 2 – Hero Destiny Generation (Priority: P1)

In the Epic Stage each hero gains Destiny at *End of Turn* equal to their generation, which starts at 1 and rises with the side's losses.

**Why this priority**: It is the Epic Stage's Destiny income; without it the economy stops after the Well is depleted.

**Independent Test**: In the Epic Stage remove a side's Queen and both Knights, end a turn, and check the hero's gain.

**Acceptance Scenarios**:

1. **Given** the Epic Stage started, **Then** every hero's generation is 1.
2. **Given** a side has no Queen and no Knight on the board, **Then** its heroes' generation is 3.
3. **Given** that side then loses its last Bishop, **Then** generation is 4; **when** a Knight returns to the board (for example by Promotion), **then** it is 3.
4. **Given** one or more auxiliary pawns of the side stand on the enemy royal rank, **Then** generation is 1 higher while they are there.
5. **Given** a hero's *End of Turn*, **Then** that hero gains Destiny equal to their generation into their own pool.
6. **Given** the Starting Stage, **Then** there is no generation gain.

---

### User Story 3 – Royal Favors and the tracker (Priority: P1)

Each side completes Royal Favors during the game. Both sides can see, on the table and in a tracker modal, what they have completed, what is half done, what the enemy has completed, and which Legendary Power comes next.

**Why this priority**: Royal Favors drive Legendary Powers and are the long-term goal players plan around; the tracker was asked for explicitly.

**Independent Test**: Play scripted positions that complete each Royal Favor and check the track and the modal for both sides.

**Acceptance Scenarios**:

1. **Given** a side Destroys an enemy unit in Battle on the enemy's Royal rank, **Then** it completes *Bloody the Castle Gates*.
2. **Given** a side Rams an enemy hero once, **Then** *Overwhelm* is half complete; Ramming an enemy hero again (the same one or another) completes it.
3. **Given** a side has 3 friendly non-hero units within the 4 ranks on the enemy's side, **Then** it completes *Great Incursion*.
4. **Given** a side makes a discovered check, **Then** it completes *Tactical Genius*.
5. **Given** a side has 3 or fewer friendly pawns on its pawn starting squares, **Then** it completes *Deploy Troops*.
6. **Given** a side Destroys units in Battle with its King or Queen, **Then** *Royal's Fury* counts 1, 2 and completes at the 3rd.
7. **Given** the enemy Graveyard holds 7 Destroyed main units of the enemy, **Then** the side completes *Decimate*.
8. **Given** an enemy unit is threatened by 3 friendly units, **Then** the side completes *Offense is the Best Defense*.
9. **Given** a side brings an enemy hero to 0 health, **Then** it completes *Vanquish your Foes*; bringing one enemy Epic hero to Bloodied makes it half complete and a second different one completes it.
10. **Given** a side has 20 or more Destiny in its Common Pool and both Hero Pools at *End of Turn*, **Then** it completes *Destined for Greatness*.
11. **Given** the initial 16 Destiny are depleted, **When** a side gains at least 1 D in its Common Pool during its turn, **Then** it completes *Tides of Destiny* once for that turn, at most 5 times per game.
12. **Given** each of the 10 numbered Royal Favors, **Then** a side can complete it only once.
13. **Given** a side completes a Royal Favor, **Then** its token goes into that side's next empty slot on the Royal Favor track, visibly on the table, and the log says so.
14. **Given** any player opens the tracker modal, **Then** it lists for both sides every Royal Favor as completed, half complete (with progress) or open, what it requires, the Legendary Powers unlocked, and how many more Royal Favors the next Power needs.

---

### User Story 4 – Legendary Powers and Hero Units (Priority: P2)

With enough completed Royal Favors a side unlocks Legendary Powers; the central one lets heroes become Hero Units that fight as units on the board.

**Why this priority**: The rewards for Royal Favors; depends on US3.

**Independent Test**: Give a side 6 completed Royal Favors in sandbox, resume, turn a hero into a Hero Unit, Lead it into Battle, and check range, bonus and what happens when it is Destroyed.

**Acceptance Scenarios**:

1. **Given** 6 completed Royal Favors, **Then** the side's heroes may become or stop being a Hero Unit of their type: a Short range hero becomes a Knight, a Long range hero a Bishop.
2. **Given** a hero wants to become a Hero Unit, **Then** it is refused while they stand on an occupied square, when it would check a King from that square, when they are not on the Battlefield, or when their King is in check and they stand in the path of that check.
3. **Given** a hero may become or stop being a Hero Unit, **Then** they can do so only at *Beginning of Turn* (and at *End of Turn* with *Swift Change*). **Given** a Hero Unit, **Then** it skips the Move phase (not *Before Move*), has Range 2, may Lead itself with +4 to that Lead, may Lead other units staying where it is, and may be Led by a friendly hero.
4. **Given** a Hero Unit is Destroyed in Battle, **Then** it takes 3 wounds, goes to its starting square and is no longer a Hero Unit; the enemy gets the usual Destiny for destroying a unit.
5. **Given** a Hero Unit was Rammed by a unit on the last turn, **Then** it may not Lead itself into Battle with that unit (001 Q-07, now active).
6. **Given** 7 completed Royal Favors, **Then** the side gets a *King's Forces* token, which at *Beginning of Turn* can be spent to create an auxiliary unit of the hero's unit type on the hero's square if it is unoccupied, following the rules for becoming a Hero Unit and the *Create* rules.
7. **Given** 8 completed Royal Favors, **Then** a hero becoming a Hero Unit may choose Rook instead of their sheet's type (*Advanced Warfare*).
8. **Given** 9 completed Royal Favors, **Then** a Hero Unit's Range to Lead is 4 (*Far Reach*).
9. **Given** 10 completed Royal Favors, **Then** heroes may also become or stop being a Hero Unit at *End of Turn* (*Swift Change*).
10. **Given** 11 completed Royal Favors, **Then** a hero becoming a Hero Unit may be both Rook and their own type at once (*Final Form*): each Lead may use either type's path, and it threatens the squares of both.
11. **Given** a Hero Unit, **Then** it counts as a unit on its square (002 FR-003), threatens like a unit of its type, and can give and block check.

---

### User Story 5 – Auxiliary units and Create (Priority: P2)

Auxiliary units are units placed during play. In this feature they come from *King's Forces*; later from abilities.

**Why this priority**: Needed by US4 and by the Destiny generation rule for auxiliary pawns.

**Independent Test**: Create an auxiliary pawn with King's Forces, walk it to the enemy royal rank, and check that it cannot promote, raises generation, and leaves play when destroyed.

**Acceptance Scenarios**:

1. **Given** a unit would be created where it would immediately give check, **Then** the creation is refused.
2. **Given** an auxiliary pawn reaches the enemy royal rank, **Then** it is not Promoted and stays a pawn.
3. **Given** an auxiliary unit is Destroyed, **Then** it leaves play (it does not go to the Graveyard) and Destiny is gained as for any unit.
4. **Given** auxiliary units, **Then** they move, Battle, threaten and count for check and checkmate like main units of their type, and are drawn with a visible auxiliary marker.

---

### User Story 6 – Bloodied (Priority: P2)

Epic Heroes in the red area of their health bar are Bloodied; Starting Heroes never are.

**Why this priority**: Needed for *Vanquish your Foes* and shown to players; ability costs that use it come with named heroes.

**Independent Test**: Wound an Epic Short range hero from 20 to 10 and check the Bloodied marker and the Royal Favor progress.

**Acceptance Scenarios**:

1. **Given** an Epic hero whose health is in the red area of their health bar (Short range 10 or less of 20, Long range 8 or less of 16), **Then** they are Bloodied and the hero sheet shows it.
2. **Given** a Starting Hero at any health, **Then** they are never Bloodied.
3. **Given** a Bloodied hero heals above the red area, **Then** they are no longer Bloodied.

---

### User Story 7 – A table that looks like the board game (Priority: P2)

The 3D table moves towards the Tabletop Simulator version: a wooden table in a dim room, an illustrated board with the castle and forest border, a Graveyard and Destiny Well strip, a hero sheet beside each seat with portrait, health track, Destiny pool and Destiny Generation tracker, a Royal Favor track per side, turn-order medallions, and the hero and epic-hero art. Pieces stay placeholders until the real 3D models arrive.

**Why this priority**: Requested; makes the game recognisable to people who know the physical prototype.

**Independent Test**: Compare a screenshot from the default camera with the Tabletop Simulator screenshots: every element listed is present and readable.

**Acceptance Scenarios**:

1. **Given** the table, **Then** it shows a wooden table top in a dim room, the board with an illustrated border, and a Graveyard / Destiny Well strip beside it.
2. **Given** each hero, **Then** a hero sheet lies in front of that seat with the hero's name and portrait, a health track with a marker, the hero's Destiny pool, and (in the Epic Stage) a Destiny Generation tracker.
3. **Given** each side, **Then** a Royal Favor track with its slots and the Legendary Power thresholds lies on the table, and completed Royal Favor tokens appear in it.
4. **Given** the turn order, **Then** each hero sheet has a turn-order medallion with its number, and the active hero's medallion is highlighted.
5. **Given** a hero becomes Epic, **Then** their sheet shows the Epic form's name and art.
6. **Given** real models or art are added later, **Then** they replace placeholders by changing data only (001 FR-113).
7. **Given** the new table, **Then** the 001 HUD stays readable and nothing on the table hides the board from the default camera.

---

### Edge Cases

- The Well is depleted during a Lead that also ends the game → the game ends; no Epic Stage.
- The Well is depleted while a hero is Unconscious → that hero still chooses a destiny in turn order.
- Both heroes of a side want the same destiny → allowed (only Fanatic with Dominant is forbidden).
- In Mirror mode both sides have the same Starting Heroes → each side's heroes still choose separately.
  - *Replaced by 006 (FR-012, Q-64, Q-75): in Mirror each destiny is chosen once per class, for both heroes of that class.*
- A side completes several Royal Favors with one action → all are completed, in the order listed in the rulebook, each in its own slot.
- A Royal Favor's state condition (e.g. *Great Incursion*) holds for both sides at the same time → each side completes its own.
- A Hero Unit stands on a square with a friendly unit → not possible to become one.
- An enemy Lead's path reaches a Hero Unit → the path stops there like at any unit; ending on it is a Battle; it is never Rammed or pushed (clarified), including by King's Banishment.
- King's Forces when the hero's square is occupied by another hero → [Open Question Q-35].
- Sandbox: Epic Stage state, Royal Favors, generation, Hero Units and auxiliary units can be edited by value and are checked when rules resume.
- A save from 001/002 is loaded → it plays on; the Epic Stage starts when its Well is depleted.

## Requirements *(mandatory)*

### Functional Requirements

**Epic Stage**

- **FR-001**: When the last of the initial 16 Destiny leaves the Well during a turn, all Destiny not in Hero or Common Pools MUST be added to the Well, the turn MUST continue, and the Epic Stage MUST start at the next *Before Turn*.
- **FR-002**: At the start of the Epic Stage every hero MUST choose Fanatic, Resolute or Dominant in turn order from the active hero, with the hero who depleted the Well choosing last; a side MUST NOT have one Fanatic and one Dominant hero.
- **FR-003**: The hero who depleted the Well MUST receive *Manifest Epic Destiny* for their side.
- **FR-004**: Each side's Common Pool MUST be split evenly between its two Hero Pools, 1 D staying when the amount is odd.
- **FR-005**: Short range heroes' maximum and current health MUST rise by 10 and Long range heroes' by 8.
- **FR-006**: The Declaration of War token MUST be removed and the +2 War Lead bonus MUST end; Leads in the Epic Stage still need a roll (unless no roll is needed for another reason) and succeed on a total of 6+.
- **FR-007**: The decorative portrait and Epic art for each generic hero (by range type and destiny) MUST be data, shown on the hero sheet.

**Destiny generation and Bloodied**

- **FR-010**: In the Epic Stage each hero MUST have a Destiny Generation value: 1, plus 1 for each unit type (Queen, Rook, Bishop, Knight, Pawn) the side has no main or auxiliary unit of on the board (Hero Units do not count), plus 1 while one or more of the side's auxiliary pawns stand on the enemy royal rank.
- **FR-011**: At each hero's *End of Turn* in the Epic Stage, that hero MUST gain Destiny equal to their generation into their own pool.
- **FR-012**: Epic Heroes MUST be Bloodied while their health is in the red (starting) area of their health bar; Starting Heroes MUST NOT be.

**Royal Favors**

- **FR-020**: The system MUST track for each side the 10 numbered Royal Favors (each completable once), half completion for *Overwhelm* and *Vanquish your Foes*, the *Royal's Fury* count (1, 2, done), *Tides of Destiny* (up to 5) and *Manifest Epic Destiny*, with the completion rules in the rulebook *Royal Favors* list.
- **FR-020a**: Royal Favors whose condition is a board position MUST be checked after every action, for both sides. Progress and completion MUST never be lost once earned, even if the condition stops being true (clarified).
- **FR-021**: Completed Royal Favors MUST fill the side's next empty slot on its Royal Favor track; the count of completed slots unlocks Legendary Powers at 6, 7, 8, 9, 10 and 11.
- **FR-022**: Players MUST be able to see the Royal Favor track of both sides on the table and in a tracker modal listing every Royal Favor's requirement and status, completed Powers, and the Royal Favors still needed for the next Power.
- **FR-023**: Every Royal Favor completion and Power unlock MUST appear in the game log.

**Legendary Powers, Hero Units, auxiliary units**

- **FR-030**: *Hero Unit* (6): heroes MAY become or stop being a Hero Unit of their type (Short range → Knight, Long range → Bishop; a data value so named heroes can set their own) at *Beginning of Turn* (and also at *End of Turn* with *Swift Change*), under the restrictions in US4-AS2.
- **FR-031**: A Hero Unit MUST skip its Move phase, have Range 2 (4 with *Far Reach*), may Lead itself with +4, may Lead other units without moving, may be Led by friendly heroes, counts as a unit on its square, and on being Destroyed takes 3 wounds, returns to its starting square and stops being a Hero Unit.
- **FR-031a**: A Hero Unit MUST block paths like any unit; a Lead ending on an enemy Hero Unit MUST be a Battle; Hero Units MUST NOT be Rammed or pushed (clarified).
- **FR-032**: A Hero Unit MUST NOT Lead itself into Battle with the unit that Rammed it on the last turn.
- **FR-033**: *King's Forces* (7) MUST give a token that can be spent at *Beginning of Turn* to create an auxiliary unit of the hero's type on the hero's unoccupied square, under the Hero Unit restrictions and the *Create* rules.
- **FR-034**: *Advanced Warfare* (8), *Far Reach* (9), *Swift Change* (10) and *Final Form* (11) MUST work as in US4; a *Final Form* Hero Unit uses either type's path per Lead and threatens with both.
- **FR-035**: Units MUST NOT be created where they would immediately give check (to either King).
- **FR-036**: Auxiliary units MUST play as their type, MUST NOT be Promoted when they are pawns, MUST leave play when Destroyed, and MUST be visually marked.

**Table visuals**

- **FR-040**: The table MUST include the elements in US7 (wooden table and room, illustrated board border, Graveyard / Well strip, hero sheets with portrait, health track, pool and generation tracker, Royal Favor tracks, turn-order medallions).
- **FR-041**: All art (board, table, sheets, portraits, epic forms, tokens) MUST be referenced from data so real art and models replace placeholders without code changes; the art in `assets/hero and epic stage images/` MUST be used for portraits now.
- **FR-042**: The default camera view MUST still show the whole board and the active hero's sheet; frame rate MUST stay at the 001 target.

**Carry-over**

- **FR-050**: Sandbox MUST let players edit the new values (stage, destiny choices, generation shown, Royal Favors, Hero Unit state, King's Forces tokens, auxiliary units) and the position check MUST cover them.
- **FR-051**: Every acceptance scenario MUST have an automated test; rules scenarios against the headless rules core. All 001 and 002 tests MUST keep passing.

### Key Entities

- **Stage**: Starting or Epic, and who depleted the Well.
- **Epic destiny**: Fanatic, Resolute or Dominant per hero; with the Starting Hero it selects the Epic form's name and art.
- **Destiny generation**: per hero, derived from the side's units on the board.
- **Royal Favor record** (per side): each Royal Favor's status (open, half, done) and progress, Tides count, track slots in completion order.
- **Legendary Power**: unlocked by slot count; King's Forces tokens per side.
- **Hero Unit state** (per hero): off, or on with a unit type (sheet type, Rook, or both), and the unit that Rammed it last turn.
- **Auxiliary unit**: a unit with kind *auxiliary*, created by King's Forces (later abilities).
- **Table art**: data keys for table, room, board border, strip, sheets, medallions, track, portraits, epic forms.

## Success Criteria *(mandatory)*

- **SC-001**: In 5 internal playtests that reach the Epic Stage, the stage starts and the destiny choice finishes without manual help.
- **SC-002**: In 3 refereed playtests the game's Royal Favor completions and Destiny generation match the referee's on 100% of turns.
- **SC-003**: Testers can say from the tracker, within 10 seconds, which Royal Favors the enemy has and what the next Legendary Power needs, in 9 of 10 tries.
- **SC-004**: People who know the Tabletop Simulator version recognise the table elements (sheets, track, medallions, Graveyard strip) without explanation in 4 of 5 interviews.
- **SC-005**: Every acceptance scenario has a passing automated test and all 001/002 tests still pass; the table keeps the 001 frame-rate target.

## Open Questions

| # | Question | Who | Blocking? |
| --- | --- | --- | --- |
| Q-35 | Can *King's Forces* create a unit on a square shared with other heroes? Default: yes; only units make a square occupied. | Rules designer | No |
| Q-37 | What happens to a Hero Unit when a rule places its hero elsewhere (Hero Retreat to a tavern, Unconscious)? Default: it stops being a Hero Unit first; the unit leaves the board. | Rules designer | No |
| Q-36 | Which column of each epic-hero image is Fanatic, Resolute and Dominant? Default: left, middle, right (dark to bright; matches the rulebook's Scout → Royal Assassin example for Dominant). | Luka | No |

## Assumptions

- **A-01**: Heroes stay generic in this feature (clarified); named heroes and their abilities come later. The portraits from `assets/hero and epic stage images/` are decoration, assigned by range type in data (placeholder mapping: Short range → Cavalier art, Long range → Magus art).
- **A-02**: "Destiny on your side" for *Destined for Greatness* is the side's Common Pool plus both Hero Pools.
- **A-03**: *Royal's Fury* counts units Destroyed in Battle by a Led King or Queen; each such Battle counts its destroyed units.
- **A-04**: The epic-art order in the images follows Q-36's default until Luka confirms.
- **A-05**: Table and room art is placeholder or procedural until Luka supplies textures and models; layout follows the Tabletop Simulator screenshots.
