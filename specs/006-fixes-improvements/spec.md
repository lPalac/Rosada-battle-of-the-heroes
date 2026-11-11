# Feature Specification: Fixes and Improvements from the First Playtests

**Feature Branch**: `006-fixes-improvements`

**Created**: 2026-11-10

**Status**: Clarified 2026-11-11 (see Clarifications, seven rounds). No open questions. Written by hand in the Spec Kit format from the playtest spreadsheet, in a chat session that could not run the Spec Kit scripts; `/speckit-specify` was not run. Checked with `/speckit-analyze` on 2026-11-11.

**Input**: `Fixes & Improvements.xlsx` (Vice, 2026-11-10): 24 rows with problem, idea, wanted solution, screenshot and priority. The rows are kept as written in [backlog.md](./backlog.md) with ids `B-01`…`B-24`; the screenshots are in `screenshots/`.

**Builds on**: `specs/001-standard-rules-game` … `specs/005-online-multiplayer` (all built). This branch starts from `main` at `0ccd441` (005 merged).

**Source rules**: `Basic Rules 2_5.docx` and its corrections file. `Hero Rules 2_0.docx` is not in the repository, so hero ability texts were taken from `src/data/abilities.json` and `strings.en.json`, which 004 built from it. Rule changes in this feature: B-09 (back to the rulebook), B-06 and B-07 (earlier decisions changed by the designer on 2026-11-11), Mirror-mode Epic destinies and Mirror picks with two different heroes per side (a rulebook gap decided on 2026-11-11), and check Destiny (only new checks, from any source, once per turn; decided 2026-11-11).

---

## Clarifications

### Session 2026-11-11 (Vice)

- Q: B-05, which case gave check Destiny twice? → A: A Bishop gave check by a Lead. Then, in After Lead, an ability Destroyed a unit and the Queen gave a discovered check, and Destiny was gained again. **Rule: a side gains the 2 D for checking the King at most once per turn.** Checked against the code: in exactly this case (*Souls Clash* opening the Queen's file) the game gives check Destiny once; the second +2 D is the Destiny for Destroying an enemy unit (Basic Rules *Common Destiny Pool*), logged as "destroyed an enemy unit". So this case already follows the rule; a test pins it and the flashes (B-19) show the reason of every gain. A different case did break the rule's sense; it was decided in the second round below.
- Q: B-09, does each use of a starting ability with a Destiny symbol cost 1 D? → A: **Yes. Each symbol is one use**, paid with 1 Destiny. Abilities without a symbol are free.
- Q: B-07, may *Inspired Lead* be paid after the Lead is announced, until the roll? → A: **Yes.**
- Q: B-06, may a return from sandbox continue the turn where it was? → A: **Yes. And a new check when leaving the sandbox: if there is a checkmate, alert the players and let them choose to continue the game or to return to the sandbox to fix it.**
- Q: B-01, how do Epic destinies work in Mirror mode? → A: **One side chooses one Epic destiny, and both heroes of that class become it. Then the other side chooses the Epic destiny for the other class.**

### Session 2026-11-11, second round (Vice)

- Q (Q-73): A King stays in check from an earlier turn and a later Lead that has nothing to do with the check gains 2 D again. Should it? → A: **No. Only "new" checks give Destiny, and still at most 2 D per turn from check.**
- Q (Q-74): Does a check made only by an ability give the 2 D? → A: **Yes. Any type of check gives 2 D; it does not need to be during a Lead. Only 2 D can be gained from check per turn.**
- Added with that answer: **the game must warn of checks.** A "CHECK" notice flashes when a check is made (first asked as twice within a second; changed in the third round to three blinks of one second, above the King). A pop-up above the abilities box says "In check" for the side that is in check, until the check is resolved; on pointer hover it shows the rule for ending your Lead under check.
- Q (A-08): Does "Continue the game" after the checkmate alert mean: rules on, the turn goes on, checkmate is ruled when the next turn begins? → A: **Yes. And the rule "still in check after your Lead" must keep working after a return from the sandbox** (Basic Rules *Check*: "If your King is in check at the end of your Lead, you cannot use After Lead nor End of Turn abilities that turn"), so the turn goes straight on to its end. No new bug there.
- Q (Q-75): In Mirror, does the first hero in the normal choice order choose first, then the other side's hero of the other class? → A: **Yes.**

### Session 2026-11-11, third round (Vice)

- Q (A-10): Is a "new" check a newly checking unit, so that a Queen joining a Bishop's check from an earlier turn gains 2 D? → A: **Yes, that is correct.**
- Q (A-09): If a side uncovers a check on its own King, does the other side gain nothing? → A: **No. The other side does gain 2 D from that check, if it has not already gained 2 D from check that turn.**
- Added with that answer: **if using your ability would put your own side in check, warn the player that it will put their King in check and give an Undo or Continue option.**
- Added with that answer: **a Lead, even one made with an "Instead of Lead" ability, must not be allowed if it would put your own King in check, with the message "That would place your King in check".** (Basic Rules *Check*: "A unit cannot be Led if that Lead would leave its King in Check"; *Lead*: "You cannot attempt a Lead that would put your King in check".)
- Changed: the "CHECK" notice **blinks three times, one second each, and appears above the King in question**.

### Session 2026-11-11, fourth round (Vice)

- Statement to check against the rules: **the only abilities allowed to place a King in check are those that Destroy units and thereby leave a King in check. Every other ability is refused if it would place the King in check.**
- Checked against `Basic Rules 2_5.docx` (`Hero Rules 2_0.docx` is not in the repository). The rulebook has these parts of it, and no sentence that states it for all abilities:
  - *Create*: "You may never create a unit if it would immediately result in a check."
  - *Modify*: "You may never modify a unit if it would immediately result in a check."
  - Symbol Legend: "Must not check the King, in abilities with this symbol, this does not apply to discovered checks."
  - Legendary Power *Hero Unit*: a hero may not turn into a unit "if they would check the King from that square".
  - Royal Favor *Tactical Genius*: "Make a discovered check without Destroying a friendly unit with an ability", which shows that a check opened by an ability Destroying a unit is a known, allowed case.
- Two points where the statement goes beyond that text are recorded as Q-76: abilities without the symbol (the rulebook is silent), and a line opened without Destroying anything, such as a push (the symbol's text allows that discovered check).
- Recorded as the designer's rule and planned as stated (FR-016), since the designer gave it as the rule. Corrected in the fifth round below.

### Session 2026-11-11, fifth round (Vice)

- Q (Q-76 b): abilities without the "Must not check the King" symbol? → A: **They are allowed only if the result is a discovered check. If the affected unit itself would check, the ability is refused.**
- Q (Q-76 a): only a line opened by a Destroyed unit, or every discovered check as the symbol's text says? → A: **Every discovered check, as the text says** ("I was wrong here"). A push or a moved unit that opens a line is allowed.
- Added: **every refusal comes with a warning that says why.**
- Q (Q-62a): *Preaching* and "once per turn"? → A: **An ability that gains a different effect when both uses are spent gives the choice to spend both uses, if both are available.**
- Q (Q-63): are the ability texts right (Breath: enemy heroes only; the heals: friendly heroes only)? → A: **Yes.** Does the square the Move starts on count as "in the path"? → A: **Yes.**
- Q (Q-67): Royal Favor track as proposed (marker stops at 11, menu shows the full count, Graveyard side, gold and purple marker in one slot)? → A: **Yes.**
- Q (Q-68): show the real table model? → A: **Yes. The table may be bigger than needed; scale it, but keep its proportions.**
- Q (Q-69): turn all six unit types of both sides, also in the Graveyard, not the hero figures? → A: **Yes.**
- Q (Q-70): a planned walk does not stop at a tavern and avoids a visible Bear Trap between equally short paths? → A: **Yes.**
- Q (Q-71): what does "phases skipped" mean? → A: **When the game skips a phase it gives the message "Phase '<name>' skipped" and then goes on normally.**
- Q (Q-72): setup cards with Movement, Range and Health badges and the Hero Unit icon? → A: **Yes.**
- Q (A-12): the own-King warning comes before the ability takes effect, and Undo means "do not use it"? → A: **Yes.**

### Session 2026-11-11, sixth round (Vice)

- On refusals that say why (blocked Lead squares, blocked ability targets, abilities without a Use button): → **These can be a warning on hover.**
- Q (A-13): *Preaching* offers one use or both, and is once per turn? → A: **Yes.** Confirmed again when asked back (Q-78): once per turn, so not two different units in one turn.
- Q (A-14): the start square counts as in the path from the first moment? → A: **Yes.**
- Track, table, unit facing, planned walk, setup cards, skipped-phase message: → **Yes.**
- Q (Q-77): do Before Turn, Beginning of Turn and Before Move also get a "skipped" message every turn? → A: **Leave them out for heroes that have no abilities that use those phases.**
- Added: **a small light green box in the abilities box that shows the current phase.**

### Session 2026-11-11, seventh round (Vice, after `/speckit-analyze`)

- Q (Q-79): In Mirror the game lets a side pick the same hero twice (two Cavaliers per side, 004 Q-41), so the second Epic choice has no "other class". How does that work? → A: **The same hero cannot be on the same side. One choice per side: first one side chooses one hero for both sides, then the other side chooses a different hero for both sides.** This is the Mirror pick order of 001 and 004 (Light picks hero 1 for both sides, Dark picks hero 2 for both sides) with one new refusal: hero 2 may not be hero 1. The Epic choice in Mirror then always has two classes, as in Q-64 and Q-75. With the generic heroes, "the same hero" is the same definition, so a Mirror game with them has one Short range and one Long range hero per side.

---

## Scope

**In:** the 24 backlog rows, grouped into seven user stories; two small text bugs seen in the screenshots (X-01, X-02); and things decided on 2026-11-11: the checkmate alert when leaving the sandbox, Epic destinies in Mirror mode, no hero twice on one side in Mirror (seventh round), the check warnings ("CHECK" flash and "In check" pop-up), the warning before an ability that puts the own King in check, and the message for a Lead that would.

**Out:**
- New heroes, abilities or rules beyond the rule points above.
- Croatian UI text, mobile layout, sound.
- Anything on the online server other than what the rule changes need.

Priorities: the sheet's 1–2 map to **P1**, 3–4 to **P2**, 5 to **P3**.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 – Destiny and abilities follow the rulebook (Priority: P1)

*Backlog: B-05, B-09, B-10, B-11.*

Check Destiny is gained for a new check from any source (a Lead, a promotion, an ability), at most once per turn. Starting Heroes pay 1 Destiny for each use of an ability that has a Destiny symbol on the sheet. "During Move" abilities can be used for a hero whose square was on the Move's path, and the game says why an ability cannot be used.

**Why this priority**: These change who wins. Free starting abilities fill the pools too fast (the B-09 screenshot shows *Destined for Greatness* granted on turn 11).

**Independent Test**: Headless positions for each scenario; compare pools, uses and offers.

**Acceptance Scenarios**:

1. **Given** the enemy King is not in check, **When** a Lead puts it in check (by one unit or by several at once), **Then** the Leading side gains 2 D once.
2. **Given** a Lead gave check and the side gained its 2 D this turn, **When** an ability later in the same turn Destroys a unit and uncovers a second check (*Souls Clash* opening the Queen's file), **Then** no second check Destiny is gained. The 2 D for Destroying an enemy unit are a separate gain with their own reason in the log and in the flash.
3. **Given** the enemy King was already in check before an action and no further unit checks it after the action, **Then** no check Destiny is gained, whichever unit was Led and on whichever turn.
4. **Given** the enemy King is still in check by a Bishop from an earlier turn, **When** a Lead makes the Queen check it too, **Then** that is a new check and 2 D are gained, once for the turn (A-10).
5. **Given** no check Destiny was gained this turn, **When** an ability opens a line (it Destroys, pushes or moves a unit) and another unit thereby checks the enemy King, with no Lead giving check, **Then** the side gains 2 D.
6. **Given** a Pawn is Led to its promotion square and the promoted piece checks the enemy King, **Then** the side gains 2 D when the promotion is made (today it gains nothing).
7. **Given** a Starting Hero with at least 1 D available, **When** it uses an ability with a Destiny symbol (*Demoralise*), **Then** 1 D is paid (hero pool first, or the player's split), the use is spent, and the sheet shows a crystal on that symbol.
8. **Given** a Starting Hero with no Destiny available, **Then** its abilities with a Destiny symbol are not offered, and a forced use is refused with `NOT_ENOUGH_DESTINY`.
9. **Given** *Warhorse*, *Rejuvenating Stroll*, *Elusive* or *Future Sight* (no Destiny symbol), **Then** using them costs no Destiny.
10. **Given** *Flaming Bolt* or *Preaching* (2 symbols), **Then** each use costs 1 D.
11. **Given** the Epic Stage starts, **Then** Destiny placed on Starting sheets is not returned to any pool.
12. **Given** the Dragon Lord started its Move on, moved onto or moved through a square with an enemy hero, **Then** *Breath of Fiery Destruction* (square) is offered until the Move ends, for each such square, and wounds the enemy heroes there for 2.
13. **Given** the Monk or the Saint started its Move on, moved onto or moved through a friendly hero's square, **Then** *Rejuvenating Stroll* / *Saintly Inspiration* is offered until the Move ends, also after the hero stepped further.
14. **Given** an ability that is in its timing window but has no legal target (only a friendly hero on the path for *Breath*; only an enemy hero for *Saintly Inspiration*), **Then** it is not offered and its row in the ability panel says what is missing.
15. **Given** a side uses an ability that uncovers a check on its own King (it Destroys its own blocking Pawn), **Then** the other side gains 2 D for that check, unless it already gained check Destiny this turn.
16. **Given** a Lead that would leave the own King in check, made in the Lead phase or with any "Instead of Lead" ability, **Then** it is refused with the reason "That would place your King in check" and nothing changes. A move the unit cannot make at all is refused with a different reason.
17. **Given** any ability, with or without the "Must not check the King" symbol, **When** a unit it creates, moves, places or changes would itself check either King, **Then** the ability is refused, that target is shown as blocked, and hovering it tells the player "That would place a King in check".
18. **Given** an ability that opens a line by Destroying, pushing or moving a unit, **When** a unit the ability did not touch thereby checks a King (a discovered check), **Then** the ability is allowed; for the own King the warning of US4-AS12 comes first; check Destiny follows scenarios 1–6 and 15.
19. **Given** *Preaching* with both uses left and 2 D available, **When** the Monk uses it, **Then** the player chooses between one use (the unit has −4 to Lead on the next turn; 1 use, 1 D) and both uses (the unit cannot be Led on the next turn; 2 uses, 2 D). With one use or 1 D left, only the single use is offered.

---

### User Story 2 – Undo and sandbox keep the turn (Priority: P1)

*Backlog: B-03, B-06.*

Undo steps back across phases inside the turn (005 already built this; it is checked here against the screenshot case). Leaving to sandbox and coming back continues the turn where it was, and a checkmate in the position is pointed out before play goes on.

**Why this priority**: A wrong click on End phase costs a turn; a sandbox fix during a playtest restarts the turn.

**Independent Test**: Headless session tests; one browser test for the Undo button and one for the sandbox round trip.

**Acceptance Scenarios**:

1. **Given** the After Lead phase with a usable ability, **When** the player presses End phase and reaches End of Turn, **Then** Undo is enabled and returns to After Lead with the ability still usable.
2. **Given** a roll was made earlier in the turn, **Then** Undo still goes back step by step to that roll, across phase changes, and no further (005 FR-030).
3. **Given** the Lead phase with 2 Movement left and no Lead made, **When** rules are turned off and on again with a legal position, **Then** the same hero is active, the phase is Lead, Movement left is 2 and a Lead can still be made.
4. **Given** the turn's Lead was rolled and resolved, **When** the player goes to sandbox and back, **Then** the phase and the Lead result are as before; no second Lead is possible.
5. **Given** a Lead was announced and waits for its roll, **When** its unit was moved or removed in sandbox, **Then** on return the announcement is cancelled and the hero may announce again.
6. **Given** an illegal position, **Then** the problems are listed as in 001 and rules stay off.
7. **Given** the position editor or a new test position, **Then** play starts at Before Turn as in 001.
8. **Given** a legal position in which a King is checkmated, **When** the player turns rules back on (or starts play from the position editor), **Then** an alert names the checkmated side and offers "Continue the game" and "Back to sandbox"; nothing changes until one is chosen.
9. **Given** that alert, **When** the player chooses "Back to sandbox", **Then** rules stay off and the position is untouched. **When** the player chooses "Continue the game", **Then** rules come back on as in scenarios 3–7 and the checkmate is ruled at the next Before Turn as in 001.
10. **Given** the active side's King is in check and the turn is continued after a sandbox trip, **When** its Lead ends with the King still in check (a failed Lead), **Then** After Lead and End of Turn abilities are not offered and the turn goes on to its end, exactly as without the sandbox trip (Basic Rules *Check*).

---

### User Story 3 – A clear Epic destiny choice (Priority: P1)

*Backlog: B-01.*

When the Epic Stage starts, each hero's choice shows that hero's own three Epic forms, by name and picture, and it is clear whose choice it is and what was already chosen.

**Why this priority**: Today all four choices look the same, so players cannot tell what they are choosing (see research R-01).

**Independent Test**: Browser test with four named heroes: open each of the four choices and compare header and card images. Headless tests for the Mirror picks and the Mirror choice queue.

**Acceptance Scenarios**:

1. **Given** the Epic Stage starts, **Then** the dialog names the choosing hero (*Cavalier*), its side and player, and shows "choice n of 4".
2. **Given** the Cavalier chooses, **Then** the three cards show *Death Knight*, *Dragon Lord* and *Holy Paladin* with their own portraits and the destiny names; the Monk's cards show *Cultist*, *Saint*, *Supreme Inquisitor*; likewise Scout and Magus.
3. **Given** a hero has chosen, **Then** the next dialog shows a different hero, different pictures, and a line listing the choices made so far.
4. **Given** the side's other hero is Fanatic (or Dominant), **Then** the Dominant (or Fanatic) card is disabled with its reason (003, unchanged).
5. **Given** the last hero has chosen, **Then** every hero sheet on the table shows its Epic sheet, and the hero cards in the HUD show the form names.
6. **Given** a Mirror game, **When** the Epic Stage starts, **Then** there are two choices instead of four: the first chooser picks a destiny for its hero class, and both heroes of that class (one on each side) take that form.
7. **Given** the first Mirror choice was made, **Then** a hero of the other side chooses for the other class and both heroes of that class take it. The Fanatic / Dominant limit applies to this second choice. The dialog says "choice n of 2" and names both heroes the choice is for.
8. **Given** a Mirror game in setup where Light has picked a hero for both sides, **When** Dark picks its hero, **Then** Light's hero is not offered, and a pick of it is refused with "That hero is already on this side"; Dark's different hero goes to both sides. With the generic heroes, Dark picks the other range type. Draft is unchanged (seventh round).

---

### User Story 4 – Choose on the board (Priority: P2)

*Backlog: B-02, B-16, B-12, B-15.*

Targets are picked on the battlefield, not from a list of coordinates. The Move shows everything the hero can reach, and a path can be planned and walked. A hero pick needs a second click. Space ends the phase.

**Independent Test**: Browser tests using the `__rosada` test hook for highlighted squares; headless tests for the reach and path model.

**Acceptance Scenarios**:

1. **Given** *Warhorse* is usable, **When** the player presses Use, **Then** the legal squares are highlighted on the board and no coordinate list opens; a click on one moves the hero; Esc or Cancel leaves the ability unused. The same holds for every ability whose targets are squares, units or heroes on the board.
2. **Given** an ability with two-part targets (a unit, then a square), **Then** the units are highlighted first, then the squares for the chosen unit.
3. **Given** the Move phase, **Then** every square the hero can reach with its Movement left is highlighted, not only the adjacent ones.
4. **Given** a click on a reachable square, **Then** the shortest path to it is drawn, the Movement counter shows what would be left, and the highlighted squares shrink to those reachable from the path's end.
5. **Given** a planned path, **When** the player clicks further reachable squares, **Then** the path grows through them in order.
6. **Given** a planned path, **When** the player clicks its last square again, **Then** the hero walks the path. Each step is one `moveStep` in the log and can be undone.
7. **Given** no planned path, **When** the player double-clicks a reachable square, **Then** the hero walks there by the shortest path.
8. **Given** a planned path, **When** the player presses Esc or clicks a square that cannot be reached, **Then** the plan is cleared and nothing moved.
9. **Given** a step that wounds the hero or opens a decision (a Bear Trap), **Then** the walk stops there.
10. **Given** hero picking in setup (hot-seat or online, Draft or Mirror), **When** a hero card is clicked, **Then** it is highlighted with "Click again to confirm"; a second click on the same card picks it; a click on another card moves the highlight.
11. **Given** the End phase button is enabled and no dialog is open, **When** Space is pressed, **Then** the phase ends. Space does nothing while a dialog is open, while typing in a field, while the button is disabled, or while the key is held down.
12. **Given** an ability whose use with the chosen targets would open a line to the player's own King (a discovered check), **When** the player presses Use (or picks the last target), **Then** before anything happens a warning says "This will put your King in check" and offers "Continue" and "Undo". Undo leaves the ability unused and nothing paid; Continue uses it.
13. **Given** a unit that could move to a square by its own rules, but the Lead would leave the own King in check, **Then** that square is shown as blocked, and hovering it shows "That would place your King in check"; a click shows the same and announces no Lead. The same holds while choosing the unit and square of an "Instead of Lead" ability.
14. **Given** anything the game refuses or does not offer for a rule reason (a refused action, a blocked Lead square, a blocked ability target, an ability that cannot be used now), **Then** the player is told why: refused actions show the reason and the rule's name; blocked squares, blocked targets and abilities without a Use button show the reason as a warning when the pointer is over them (and on keyboard focus for ability rows).

---

### User Story 5 – The Lead prompt (Priority: P2)

*Backlog: B-04, B-07, X-01, X-02.*

**Independent Test**: Browser test of the Lead panel in three cases: no roll, roll with Inspired Lead available, roll with ability modifiers.

**Acceptance Scenarios**:

1. **Given** a Lead that needs no roll, **Then** the text "No roll needed" is not shown anywhere; the panel says why the Lead succeeds ("Peace Treaty: the Lead succeeds", "The King needs no roll", "Cannot fail: +N") (A-02).
2. **Given** a Lead waits for its roll and the hero has at least 1 D and has not used *Inspired Lead* this turn, **Then** an Inspired Lead button is shown next to Roll d20.
3. **Given** the player spends X D there, **Then** the Lead gets +2 per D, the line updates, and if the Lead can no longer fail it succeeds without a roll.
4. **Given** the die was rolled, or *Inspired Lead* was used in Before Lead, **Then** the button is not shown.
5. **Given** ability modifiers on a Lead, **Then** the line reads "d20 + War +2 + Bear Traps −3 + Future Sight +2 ≥ 6": ability names, never text keys. The same holds for reasons in the log and marks on the sheets.

---

### User Story 6 – A readable HUD (Priority: P2)

*Backlog: B-17, B-18, B-19, B-20, B-21, B-08, B-22.*

**Independent Test**: Browser screenshots at 1920×1080 and 1366×768; headless tests of the HUD and flash models.

**Acceptance Scenarios**:

1. **Given** a game in play, **Then** the ability panel is docked at the side of the screen and does not cover any square of the board at the default camera; a header click collapses it to one line and opens it again; the choice is remembered in this browser. A small light green box in the panel's header shows the current phase, also when the panel is collapsed.
2. **Given** a collapsed panel and an ability that is usable now, **Then** the collapsed header shows how many are usable.
3. **Given** a hero with 6 of 8 health, **Then** its bar is green for 75% and red for the lost 25%, with "6/8" inside the bar and readable on both colours. The bar is on the HUD hero card and on the hero sheet on the table.
4. **Given** an action whose result includes health lost or healed, wounds dealt, a die rolled, an ability used, Destiny gained or spent, or phases passed automatically, **Then** a flash for each appears for 0.5 s, slides towards the game log and fades. Several flashes queue; none is lost; the log still gets every line. Each phase the game passes by itself gets its own message: "Phase 'Before Lead' skipped". Before Turn, Beginning of Turn and Before Move get it only when the active hero has an ability timed in that phase (a Cavalier whose *Demoralise* is spent sees "Phase 'Before Move' skipped"; a hero with nothing in Before Turn sees nothing for it).
5. **Given** the operating system asks for reduced motion, **Then** flashes appear and fade without sliding.
6. **Given** any screen during play, **Then** named heroes are never described as "Short range" / "Long range"; they are shown by name (*Cavalier*, *Dragon Lord*). Movement and Range are shown as two badges with the Symbol Legend icons on the hero card and for the active hero in the top bar ("Move 3/5", "Range 1").
7. **Given** the Lead phase, **Then** the squares within the active hero's Range are outlined on the board.
8. **Given** a hero card, **Then** the unit type the hero becomes as a Hero Unit is shown as a small icon next to the hero's name or Epic form: dimmed before the side has the *Hero Unit* power, lit after; a Rook icon is added with *Advanced Warfare*.
9. **Given** the Settings menu, **Then** its last button reads "Resume game".
10. **Given** the action bar, **Then** it has no Offer draw button; Settings has one, in hot-seat and online, enabled when a draw may be offered.
11. **Given** an action after which a unit newly checks a King, **Then** a "CHECK" notice appears above that King on the board and blinks three times, one second each, for every player, and the log gets its line. It follows the King's place on the screen if the camera moves. With reduced motion it is shown steadily for three seconds.
12. **Given** a side whose King is in check, **Then** a pop-up above the ability panel says "In check" with that side's name and colour, for as long as the King is in check, and it goes away when the check is resolved. On pointer hover (and keyboard focus) it shows the rule: "If your King is in check at the end of your Lead, you cannot use After Lead nor End of Turn abilities that turn." With both Kings in check there is one pop-up per side.

---

### User Story 7 – The table (Priority: P2)

*Backlog: B-13, B-14, B-23, B-24.*

**Independent Test**: Browser tests reading `tableElements()` from the test hook, and screenshots.

**Acceptance Scenarios**:

1. **Given** an online game, **Then** each player's default camera is on their own side on every turn; they can still orbit and zoom, and Reset camera returns to their side. A 3-player seat that holds both heroes of a side sees that side. Hot-seat keeps following the active side.
2. **Given** the table, **Then** there is one Royal Favor track, with slots 1…11 and the Legendary Power names at 6…11, standing vertically between the board and the Graveyard / Well strip. It shows a Light marker and a Dark marker.
3. **Given** the single track, **Then** the Graveyard / Well strip has moved outwards and is fully visible at the default camera from both sides; the two per-side tracks beside the hero sheets are gone.
4. **Given** Light has 2 Royal Favors and Dark 1, **Then** the track shows Light on 2 and Dark on 1; two markers on the same slot are both visible.
5. **Given** the Royal Favor menu (`A`), **Then** both sides' lists of favors and powers are as before, and the two 16-slot rows are replaced by the same shared 1…11 track.
6. **Given** the game has loaded, **Then** the table is the Tabletop Simulator table model with its texture; until it has loaded, and with `?placeholders`, the drawn slab is shown.
7. **Given** units on the board, **Then** every unit model is turned 180° from today, for both sides, on the board, in the Graveyard and in sandbox.

---

### Edge Cases

- A Lead that gives check and also destroys a unit: both Destiny gains apply, as today.
- A side's own action uncovers a check on its own King: the warning comes first (US4-AS12); after Continue, the "CHECK" notice and the pop-up show and the other side gains its 2 D (US1-AS15).
- The "Must not check the King" symbol (004 FR-014) keeps its meaning; the same rule now holds for abilities without it. A discovered check on the own King gets the warning.
- An ability whose result cannot be known beforehand: no warning beforehand; the check warnings show afterwards.
- *Infiltrate* (Spy Master) has the "Instead of Lead" timing but is not a Lead: it is refused when the placed Pawn would itself check a King; if moving the Pawn away opens a line to the own King, the warning of US4-AS12 comes first.
- An ability that makes the turn's Lead (*Tight Formation*, *Crusade*, …) follows the Lead rules: its Lead may check the enemy King and may not leave the own King in check.
- An ability that wounds or moves heroes only: no unit changes, so no check can come of it.
- A check made by the side that is not on turn (a reaction during the enemy's Lead): it gains its 2 D, once in that turn.
- The checking unit moves and still checks from another square: not a new check.
- Both Kings checkmated in a sandbox position: the alert names both sides.
- Mirror game with generic heroes: one Short range and one Long range hero per side (FR-013), and the same two-choice rule, by hero definition.
- Draft game with the generic heroes, where both sides hold the same two definitions: four separate choices, as in 003 (only Mirror mode pairs the heroes).
- A Starting Hero pays for an ability from the Common Pool when its own pool is empty (001 payment rules).
- An old save or online room whose log used a starting ability for free may not replay under the new cost; the game refuses it with a clear message and does not crash (research R-04).
- Planned path and a square that becomes illegal after a step: the walk stops and the rest of the plan is dropped.
- The path passes a tavern: the walk does not stop; leaving the tavern closes its shop as today.
- Two Royal Favors completed by one action: the marker moves by two.
- A side with more than 11 Royal Favors: its marker stays on 11; the menu shows the full count.
- Flashes while the die is rolling: they wait until the die has landed.
- Space pressed while a planned path is shown: the plan is dropped and the phase ends, if ending is legal.

---

## Requirements *(mandatory)*

### Functional Requirements

**Rules (engine-free core)**

- **FR-001** (B-05): A side MUST gain 2 D for a **new check**: after an action, a unit of that side checks the enemy King that did not check it before the action. This holds for every kind of action (a Lead, a promotion, an ability effect; a created unit can never give check, Basic Rules *Create*) and whichever side took the action, so also when a side uncovers a check on its own King. A side MUST gain it at most once per turn. An action after which no further unit checks MUST NOT gain it, even while the King stays in check (Basic Rules *Destiny*: "2 D when you Check an enemy King … only once per turn"; decided 2026-11-11).
- **FR-002** (B-09): Each use of a Starting Hero ability that has uses MUST cost 1 Destiny, paid by the 001 payment rules; abilities without uses stay free (Basic Rules *Hero abilities*: "Starting Heroes place a Destiny on the Destiny symbol by the ability used"; FAQ 10; decided 2026-11-11). The cost MUST be data in `abilities.json`.
- **FR-003** (B-10, B-11): "During Move" abilities that act on a hero's square (*Breath of Fiery Destruction*, *Rejuvenating Stroll*, *Saintly Inspiration*) MUST offer the square the Move started on and every square entered during it, including the current one, until the Move ends (decided 2026-11-11).
- **FR-004** (B-10, B-11): For every ability of the active hero that is in its timing window but not offered, the core MUST give the reason (no uses, used this turn, not enough Destiny, no legal target with the target kind).
- **FR-005** (B-03): The 005 undo rule MUST be covered by a test of the screenshot case (After Lead → End phase → Undo).
- **FR-006** (B-06): Turning rules back on MUST continue the saved turn: same active hero, phase, Movement left, Lead state, abilities used and open decisions, when the turn it was saved in is still the current one; otherwise, and for the position editor, play restarts at Before Turn (replaces 001 User Story 6, scenario 5; 001 FR-104 on Led units and en passant stays; decided 2026-11-11). The turn's record of "King in check at the end of the Lead" MUST be kept, so After Lead and End of Turn abilities stay blocked as the rulebook says.
- **FR-007** (B-07): `inspiredLead` MUST also be accepted in the Lead phase until the die is rolled, once per turn; an announced Lead's modifiers and its need for a roll MUST be recomputed (decided 2026-11-11).
- **FR-008** (B-16): The core MUST provide the squares the active hero can reach this Move with the Movement left, each with a shortest path, using the same step rules as `moveStep`.
- **FR-014** (B-05, decided 2026-11-11): A Lead that would leave the own King in check MUST be refused, in the Lead phase and for every "Instead of Lead" ability that Leads a unit, with a reason of its own ("That would place your King in check"). The core MUST tell this reason apart from "the unit cannot move there" and MUST list, per unit, the Leads blocked for this reason.
- **FR-016** (B-05, decided 2026-11-11, fifth round): Every ability, with or without the "Must not check the King" symbol, MUST be refused when a unit it creates, moves, places or changes would itself check either King. A discovered check, where a unit the ability did not touch checks because a line was opened, MUST be allowed (Symbol Legend: "does not apply to discovered checks"). Leads made by an ability follow the Lead rules instead (FR-014).
- **FR-017** (Q-62a, decided 2026-11-11): An ability whose text gives a different effect when both uses are spent (*Preaching*) MUST offer the choice between one use and both uses when both are available; spending both costs both uses and their Destiny in one action.
- **FR-015** (B-05, decided 2026-11-11): The core MUST provide a derived check: would this action, taken now, put the acting side's own King in check (a unit checking it afterwards that did not before).
- **FR-009** (B-06): When rules are turned back on and a King is checkmated, the game MUST tell the players which side is checkmated and let them continue the game or return to the sandbox. The core MUST provide the checkmated sides as a derived helper; the position check of 001 stays as it is (decided 2026-11-11).

**Epic destiny choice**

- **FR-010** (B-01): The destiny dialog MUST show the choosing hero's name, side, player and position in the choice order, and for each destiny that hero's Epic form name and portrait from `heroes.json` / `assets.json`.
- **FR-011** (B-01): The dialog MUST list the destinies already chosen.
- **FR-012** (B-01): In Mirror mode the Epic Stage MUST ask for two choices: the first chooser's destiny applies to both heroes of its class, then a hero of the other side chooses for both heroes of the other class (replaces the 003 edge case "each side's heroes still choose separately"; decided 2026-11-11).
- **FR-013** (B-01, Q-79, decided 2026-11-11, seventh round): In Mirror mode the two heroes of a side MUST differ. Light picks a hero for both sides, then Dark picks a different hero for both sides; a pick of the hero already chosen MUST be refused (`HERO_TAKEN`, "That hero is already on this side") and MUST NOT be offered. For the generic heroes "the same hero" is the same definition. Draft is unchanged (replaces 004 Q-41 "yes in Mirror" as far as one side is concerned; both sides still have the same two heroes).

**Board interaction**

- **FR-020** (B-02): Ability targets that are squares, units or heroes MUST be chosen on the board with highlights; lists stay only for targets that are not on the board (a unit type).
- **FR-021** (B-16): The Move MUST highlight all reachable squares, support a planned path by clicks, walk it on a second click on its end or on a double click, and show the Movement left for the plan.
- **FR-022** (B-12): A hero pick MUST need two clicks on the same card.
- **FR-023** (B-15): Space MUST end the phase under the conditions of US4-AS11.
- **FR-024** (B-05, decided 2026-11-11): Before an ability or power is used that would put the player's own King in check, the game MUST warn ("This will put your King in check") and let the player Continue or Undo.
- **FR-026** (decided 2026-11-11, fifth round): Every refusal MUST come with its reason: a refused action shows the reason and the rule's name (001 FR-202, kept); a Lead square or ability target that is not available for a rule reason is shown as blocked and gives the reason on hover; an ability that cannot be used now gives the reason on hover over its row (FR-004).
- **FR-025** (B-05, decided 2026-11-11): Squares a unit cannot be Led to only because of check MUST be shown as blocked and MUST show "That would place your King in check" when clicked, also for "Instead of Lead" abilities.

**HUD**

- **FR-030** (B-04): The text "No roll needed" MUST be replaced as in US5-AS1.
- **FR-031** (B-07): The roll prompt MUST offer Inspired Lead as in US5-AS2…AS4.
- **FR-032** (X-01, X-02): Modifier sources, Destiny and heal reasons and marks MUST be shown by name; a missing text MUST fall back to the ability's name, never to a key.
- **FR-033** (B-17): The ability panel MUST be docked at the side and collapsible, and MUST show the current phase in a small light green box (decided 2026-11-11).
- **FR-034** (B-18): Health MUST be shown as a green / red bar with the numbers inside.
- **FR-035** (B-19): Resolved effects MUST be shown as flashes as in US6-AS4, AS5. A skipped Before Turn, Beginning of Turn or Before Move MUST be announced only for a hero that has an ability timed in that phase; every other skipped phase is always announced (decided 2026-11-11).
- **FR-036** (B-20): "Short range" / "Long range" MUST not describe named heroes; Movement and Range MUST be shown as badges; the Range MUST be outlined in the Lead phase.
- **FR-037** (B-21): The Hero Unit type MUST be shown as icons on the hero card.
- **FR-038** (B-08, B-22): Settings MUST have "Resume game" and "Offer draw"; the action bar MUST NOT have Offer draw.
- **FR-039** (B-05, decided 2026-11-11): The game MUST warn of checks: a "CHECK" notice above the checked King that blinks three times, one second each, when a new check is made, and an "In check" pop-up above the ability panel for each side whose King is in check, shown until the check is resolved, with the *Check* rule about the end of the Lead on hover.

**Table**

- **FR-040** (B-13): Online, the default camera side MUST be the local seat's side.
- **FR-041** (B-14): The table MUST have one shared Royal Favor track (1…11, both sides) between the board and the strip; the strip MUST stay fully visible.
- **FR-042** (B-23): The table MUST be the TTS table model, with the drawn slab as placeholder.
- **FR-043** (B-24): Unit models MUST face the other way; the turn MUST be data per model.

**Carry-over**

- **FR-050**: All 001–005 tests MUST pass, changed only where a requirement above changes the expected result. Every acceptance scenario here MUST have an automated test named `US<n>-AS<m>`.
- **FR-051**: All new UI text MUST be in `strings.en.json`.

### Key Entities

- **Sandbox resume point**: the turn state kept when rules are turned off.
- **Reach**: the squares a hero can reach this Move, with cost and path.
- **Move plan**: the path the player has clicked but not walked (UI state only).
- **Target prompt**: the board picks an ability still needs (UI state only).
- **Flash**: one short notice built from a game event.
- **Shared track**: slots 1…11 with one marker per side.

---

## Success Criteria *(mandatory)*

- **SC-001**: In 3 playtest games, no player reports Destiny gained or kept against the rulebook for check or starting abilities.
- **SC-002**: A hero is moved to a square 4 steps away with at most 2 clicks.
- **SC-003**: No ability with board targets opens a list of coordinates.
- **SC-004**: At 1920×1080 and 1366×768, with the default camera, no HUD panel covers a board square.
- **SC-005**: Players name the hero and form they are choosing in the Epic dialog without help, in 4 of 4 choices of a test game.
- **SC-006**: First load stays ≤ 10 s and the table at 60 fps on the 001 reference machine with the table model.

---

## Open Questions

None. Every question was answered on 2026-11-11.

### Resolved

| # | Decision | Affects |
| --- | --- | --- |
| Q-61 | Check Destiny is gained **at most once per turn per side** (2026-11-11). The reported case (Lead check, then an ability uncovers a second check) already gains it once; the other +2 D there is for Destroying an enemy unit. Completed by Q-73 and Q-74. | FR-001, US1-AS1, AS2 |
| Q-62 | **Each Destiny symbol on a Starting sheet is one use and costs 1 D** (2026-11-11). Free: *Warhorse*, *Rejuvenating Stroll*, *Elusive*, *Future Sight*. Corrects 004 A-03. | FR-002, US1-AS7…AS11 |
| Q-64 | **Mirror: two Epic choices.** One side chooses a destiny and both heroes of that class take it; then the other side chooses for the other class (2026-11-11). Replaces the 003 edge case. | FR-012, US3-AS6, AS7 |
| Q-65 | ***Inspired Lead* may be paid until the die is rolled**, also after the Lead is announced (2026-11-11). Before Lead keeps stopping as today. | FR-007, FR-031, US5-AS2…AS4 |
| Q-66 | **Returning from sandbox continues the turn** where it was (2026-11-11). New: a checkmate in the position is pointed out, and the players choose to continue or to go back to the sandbox. "Continue" lets the turn go on; checkmate is ruled when the next turn begins. The *Check* rule about the end of the Lead keeps working. | FR-006, FR-009, US2-AS3…AS10 |
| Q-73 | **Only new checks give Destiny**, at most 2 D per turn (2026-11-11). A new check is a newly checking unit: a second unit joining an older check gains; a Lead after which no further unit checks gains nothing. | FR-001, US1-AS3, AS4 |
| Q-74 | **Any kind of check gives the 2 D**, not only a Lead (2026-11-11), also a check a side uncovers on its own King (the other side gains). Also fixes a promotion that gives check, which gains nothing today. | FR-001, US1-AS5, AS6, AS15 |
| Q-76 | **Abilities and check** (2026-11-11, fifth round): any ability is refused when the unit it affects would itself check a King; every discovered check is allowed, as the Symbol Legend says; the rule holds for abilities without the symbol too. | FR-016, US1-AS17, AS18 |
| Q-62a | **Both uses at once**: an ability with a different effect for both uses (*Preaching*) offers the choice to spend both (2026-11-11). Replaces 004 Q-50's "use it twice on the same unit". | FR-017, US1-AS19 |
| Q-63 | **Ability texts are right**: *Breath* hits enemy heroes only; *Saintly Inspiration* and *Rejuvenating Stroll* heal friendly heroes only. **The square the Move starts on counts as in the path** (2026-11-11). | FR-003, US1-AS12…AS14 |
| Q-67 | **Royal Favor track** as proposed: the marker stops at 11, the menu shows the full count, the track is on the Graveyard side, a gold and a purple marker share a slot (2026-11-11). | FR-041, US7-AS2…AS5 |
| Q-68 | **The real table model**, scaled as needed with its proportions kept (2026-11-11). | FR-042, US7-AS6 |
| Q-69 | **All six unit types of both sides are turned**, also in the Graveyard; hero figures are not (2026-11-11). | FR-043, US7-AS7 |
| Q-70 | **A planned walk does not stop at a tavern** and avoids a visible Bear Trap between equally short paths (2026-11-11). | FR-021, US4-AS3…AS9 |
| Q-71 | **Skipped phases**: each phase the game passes by itself gives "Phase '<name>' skipped" and play goes on (2026-11-11). Narrowed by Q-77. | FR-035, US6-AS4 |
| Q-72 | **Setup cards** show Movement, Range and Health badges and the Hero Unit icon; generic heroes keep their name (2026-11-11). | FR-036, FR-037 |
| Q-78 | ***Preaching* is once per turn**, with the choice of one use or both in that use (2026-11-11). | FR-017, US1-AS19 |
| Q-77 | **Start-of-turn phases**: a skipped Before Turn, Beginning of Turn or Before Move is announced only for a hero with an ability timed in that phase (2026-11-11). | FR-035, US6-AS4 |
| Q-75 | **Mirror order**: the first hero in the 003 choice order chooses for its class, then the other side's hero of the other class (2026-11-11). | FR-012, US3-AS6, AS7 |
| Q-79 | **Mirror picks**: the same hero cannot be on the same side. Light picks one hero for both sides, then Dark picks a different hero for both sides (2026-11-11, seventh round). Narrows 004 Q-41. | FR-013, US3-AS8 |

---

## Assumptions

- **A-01**: Priority 1 in the sheet is the most urgent.
- **A-02**: For B-04 any wording that explains the automatic success is fine; the exact texts are strings and can be changed without code.
- **A-03**: B-03 was seen on a build from before 005's undo change (commit `3b0b8c9`, 2026-11-10 19:06); on `main` the screenshot case already works (research R-03). If Undo is still greyed out on the current build, that is a new bug to report with the steps.
- **A-04**: B-11's "similar to B-10" means "During Move" abilities in general.
- **A-05**: UI choices kept in the browser (collapsed panel) are per browser, not per player.
- **A-06**: The screenshots in `screenshots/` are downscaled copies of the ones in the spreadsheet.
- **A-07**: In Mirror mode the destiny applies by hero class, meaning the same hero definition on both sides. (The order was confirmed on 2026-11-11.)
- **A-08**: Confirmed 2026-11-11. The checkmate alert says what continuing means ("Dark's King is checkmated. If you continue, Light wins when the next turn begins."). If play restarts at Before Turn (position editor), the game ends at once.
- **A-09**: Withdrawn. Decided 2026-11-11: the other side gains its 2 D also when a side uncovers a check on its own King.
- **A-10**: Confirmed 2026-11-11: a new check is a unit that checks the King after an action and did not check it before. A unit that keeps checking, also from another square, is not a new check.
- **A-13**: *Preaching* is used once per turn like every Starting ability (Basic Rules *Hero abilities*), with the one-or-both choice in that use. The second use can still be spent on a later turn as a single use. Confirmed by the designer on 2026-11-11.
- **A-14**: Confirmed 2026-11-11. "The start square counts as in the path" holds from the beginning of the Move, also before the first step: a Dragon Lord that starts on an enemy hero's square may use *Breath* there at once.
- **A-11**: The "In check" pop-up shows the rule the designer named. The texts are strings and can be changed without code.
- **A-12**: Confirmed 2026-11-11. The own-King warning is shown **before** the ability takes effect, once all its targets are chosen. "Undo" there means: do not use it; nothing happened and nothing is paid. This is safer than letting it happen and undoing after, because an effect that reveals something (a wound, a Destroyed unit) cannot be undone (005 FR-030).
