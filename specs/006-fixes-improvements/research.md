# Research: Fixes and Improvements from the First Playtests

**Feature**: `006-fixes-improvements` | **Date**: 2026-11-10 | **Spec**: [spec.md](./spec.md) | **Backlog**: [backlog.md](./backlog.md)

Phase 0 of `/speckit-plan`, updated on 2026-11-11 with the designer's answers (spec, Clarifications). Each entry: what was found, the decision, why, and what else was looked at.

How the findings were made:
- All 24 rows and the 10 screenshots of the spreadsheet were read.
- The code was read at `main` `0ccd441` (005 merged, 2026-11-10 19:51). File and line references are to that commit.
- `Basic Rules 2_5.docx` was read as text. `Hero Rules 2_0.docx` is not in the repository; ability texts come from `abilities.json` and `strings.en.json`.
- The rules and session suites were run (45 files, 360 tests, all green on Node 22; the project asks for Node 24).
- Rows marked **Reproduced** were confirmed with a throw-away headless test against the rules core. Rows marked **Read** were found by reading code only. UI rows were not run in a browser.

---

## R-01 Epic destiny choice (B-01)

**Found (Read)**: Two causes make all four choices look the same.

1. `src/data/heroes.json`: every named hero's `epicArt` is the generic key from 003, `epic.short` for Cavalier and Monk and `epic.long` for Scout and Magus. `assets.json` maps those to the Cavalier's and the Magus's Epic pictures. So the Monk is offered the Cavalier's three forms and the Scout the Magus's. `public/art/heroes/Monk - epic heroes.png` and `Scout - epic heroes.png` exist but no key points at them.
2. `src/ui/dialogs.ts` (`epicDestiny`, line 42): the title is "H2 · Dark Short range: choose your Epic destiny" and the cards are named only Fanatic / Resolute / Dominant. The hero's name and the form names (*Death Knight* …) are never shown. After a choice the next dialog opens with the same layout and, for two of four heroes, the same pictures.

The rules side was checked against Basic Rules *Epic Heroes*: choice in turn order starting with the active hero, the hero who emptied the Well last, no Fanatic with Dominant on one side, health, Common Pool split, War token removed. `src/rules/epic.ts` does all of that, and its tests pass. One gap was found: Mirror mode, decided on 2026-11-11 (R-17).

**Decision**:
- The dialog reads each card from the hero's form in `heroes.json` (`forms[destiny].name`, `.portrait`): 12 form portraits are already in `public/tts/portrait/` and in `assets.json`. No new art.
- Header: hero name, side, player name, "choice n of 4". Below the cards: the choices made so far.
- A pure `destinyChoiceModel(state)` in `src/game/` builds this, so it is tested headless.
- `epicArt` stays for the generic heroes only (canvas sheet); named heroes do not use it.
- Mirror mode asks for two choices; see R-17.

**Why**: Data already holds what the dialog needs (constitution III). The fix is in the view.

**Alternatives**: Add `epic.monk` / `epic.scout` keys for the three-column pictures (rejected: still no form names, and the form portraits are sharper and already used on the sheets).

---

## R-02 Check Destiny and check warnings (B-05)

**Rule (decided 2026-11-11, three rounds)**: a side gains 2 D for a **new** check on the enemy King, from any kind of action, not only a Lead, and whichever side took the action; at most 2 D per turn from check. Basic Rules *Destiny*: "2 D when you Check an enemy King. You may benefit from this only once per turn."

**Found**: the only place that gains check Destiny today is the Lead's resolution (`src/rules/lead.ts:263-269`): after a successful Lead, if the enemy King is in check, gain once per turn (`turn.checkBonusClaimed`). Three cases were replayed against it.

| Case | Today | By the decided rule |
| --- | --- | --- |
| **The reported case (Reproduced).** Bishop c4→b5 gives check by a Lead; in After Lead *Souls Clash* Destroys the Pawns on e4 and e6 and opens the e-file for the Queen | One `check` gain. The second +2 D is `destroyEnemy`, the Destiny for Destroying an enemy unit (`abilities/units.ts:71`); in the log it follows the check line and reads like a second check gain | Same: the Queen's check is new, but the turn's 2 D are already taken |
| **King left in check (Reproduced).** Rook a1→a8 gives check on turn 1; Dark cannot Lead; on turn 3 the other Rook is Led h1→h2, far from the King | +2 D again on turn 3 | **Wrong.** No unit newly checks, so nothing is gained |
| **Promotion with check (Reproduced).** Pawn a7→a8 promotes to a Queen that checks the King on e8 | No Destiny and no `check` event: the Lead looks for check before the promotion is made | **Wrong.** A new check: +2 D |
| **Ability-only check (Read).** An ability's effect makes a unit check, with no Lead giving check that turn | No Destiny: abilities never gain it | **Wrong.** A new check: +2 D |

**Decision**:
- One rule in one place. After every applied action (in `apply`, after the action's own effects and before any automatic phase change), compare the units checking each King before and after the action. A unit that checks now and did not before is a **new check** (spec A-10).
  - For each King with a new check: emit `check` with the checking units (once per action and King).
  - The side whose unit newly checks gains `DESTINY.check`, unless it already did this turn. That also holds when the checked side uncovered the check itself (decided in the third round; the warning of R-18 comes first).
- The gain and the `check` event leave `lead.ts`; `checkingUnits(state, side)` is added to `check.ts` beside `isInCheck`.
- The once-per-turn mark becomes per side (`turn.checkDestinyClaimed: Side[]`), because a reaction of the side that is not on turn can also make a check.
- Not evaluated in sandbox mode or inside simulations (`simulate` abilities, checkmate search).
- *Tactical Genius* (a discovered check by a Lead) is not changed; whether an ability's discovered check should count for it is a follow-up.
- The four existing tests that compare the `check` event change for its new field.

**Check warnings (decided 2026-11-11)**: the game showed a check only as a log line ("Dark King in check").
- **"CHECK" flash** (as changed in the third round): on a `check` event, a notice appears above the checked King and blinks three times, one second each (CSS), for all players. It is a DOM label placed at the King's square projected to the screen (`picker.screenOf`, already used by the test hook) and re-placed every frame while it shows, so it stays on the King when the camera moves. It does not slide to the log. Reduced motion: steady for three seconds.
- **"In check" pop-up**: `HudModel.inCheck` lists the sides whose King is in check now (`isInCheck`). For each, a small panel sits directly above the ability panel (also when that panel is collapsed), in the side's colour, until the King is out of check. Hover or keyboard focus shows the rule from Basic Rules *Check*: "If your King is in check at the end of your Lead, you cannot use After Lead nor End of Turn abilities that turn."
- Both are drawn from the state and events, so they work the same in hot-seat, online and after a reload.

**Alternatives**: Fix only the Lead (compare "in check before / after" inside `lead.ts`) (rejected: promotions and abilities would stay wrong, and the designer decided that any kind of check counts). A "new check" as "the King was not in check before" (rejected by the designer: a second unit joining the check gains). A 3D text sprite over the King (rejected: its size changes with the camera distance, and a DOM label is easier to test). Take away the Destroy Destiny when the same action also uncovers a check (rejected: not in the rulebook).

---

## R-03 Undo across phases (B-03)

**Found (Reproduced)**: Already built. 005 changed the undo barrier in `src/game/session.ts` (`isBarrier`) on 2026-11-10: phase changes inside the turn are no longer barriers; only reveal events (`rolled`, `unitDestroyed`, `heroRammed`, `heroWounded`), a rules/sandbox switch, the Active Hero hand-off and another hero's decision are. The screenshot case was replayed: After Lead → End phase → End of Turn, `canUndo()` is true, and Undo returns to After Lead.

The change is commit `3b0b8c9` (2026-11-10, 19:06) and went live on the Render test site at about 19:21. The screenshot shows the behaviour from before that commit (Undo greyed out right after a phase change), so it was most likely taken on an older build.

**Decision**: No rule or session change. Add one test of the exact screenshot case with a named hero that has an After Lead ability, and one browser test that the Undo button is enabled there. If the button is still greyed out on the current Render build, redeploy first (005 quickstart: Render does not auto-deploy).

**Alternatives**: A separate "Back one phase" button (rejected: Undo does this).

---

## R-04 Starting abilities cost Destiny (B-09)

**Found (Reproduced)**: Using *Demoralise* leaves the Hero Pool at 3. In `abilities.json` all starting abilities have `cost: null`; the limited ones have `uses`. 004 assumption A-03 read the Destiny symbols on the sheet as uses only.

Basic Rules *Hero abilities*: "Starting Heroes can use each of their abilities only once per turn, but they have a limited number of uses. To use an ability from their hero sheet, Starting Heroes place a Destiny on the Destiny symbol by the ability used and discard it to the Destiny Well when they become Epic." FAQ 10 says the same. So a symbol is both: a use and 1 Destiny.

**Decision** (confirmed 2026-11-11: each symbol is one use and costs 1 D):
- Data only: `cost: { normal: 1, bloodied: 1 }` on the eight limited starting abilities (`cavalier.demoralise`, `cavalier.tightFormation`, `monk.preaching`, `monk.makePeaceNotWar`, `scout.bearTraps`, `scout.poisonWater`, `magus.flamingBolt`, `magus.soulsClash`). The schema already allows `cost` and `uses` together, and the engine already checks and spends `cost` (`engine.ts` `blocker`, `useAbility`).
- No "Destiny on the sheet" pool in the state: Destiny spent before the Well is empty already leaves play (`destiny.ts` `spend`), which is the same result as holding it on the sheet until the Epic Stage and discarding it then.
- View: `sheet-model` rows show cost and uses together ("1 D · 1 of 1 left"); the sheet draws a crystal on each used symbol.
- 004 A-03 is corrected in the 004 spec with a pointer to this feature.

**Effects on existing things**:
- Tests: the 004 `US2-AS*` tests, `tests/games/scripted-game-03/04` and their ledgers, and `tests/e2e/heroes.spec.ts` change where they assert pools. Each is updated by first adding the failing expectation.
- Old saves and online rooms: a save is the starting state plus the action log, replayed with today's rules. A log that used a starting ability for free replays with other Destiny numbers and may stop at a later action. This is already safe: `parseSaveFile` throws on a failed replay, `loadLocal` then offers no Resume button, and the server logs and skips a room it cannot restore (`server/index.ts:78`). What is added: an imported file that fails shows a clear message ("made with older rules") instead of the raw replay error, and `STATE_VERSION` goes up by one so such files can be told apart. Tests cover the three paths.

**Alternatives**: Keep the paid Destiny on the sheet as state and return it to the Well at the Epic Stage (rejected: no rule reads it; VI). A rules flag to play old saves with old costs (rejected: two rule sets to test).

---

## R-05 "During Move" abilities and why an ability is not offered (B-10, B-11)

**Found (Reproduced)**:
- *Breath of Fiery Destruction* (square): offered when the Dragon Lord stepped onto an enemy hero's square, and still offered after stepping further (it reads `turn.movePath`). Not offered on a friendly hero's square. Not offered when the Move starts on the enemy's square and no step was made.
- *Saintly Inspiration* and *Rejuvenating Stroll*: offered while standing on a friendly hero's square, gone after the next step (`heroesHere` in `heroes/monk.ts` reads the current square only). Not offered on an enemy hero's square. Offered even when the friendly hero is at full health.
- In both screenshots the other hero is not a legal target by the ability text, judging by the ring colours in the photos (gold = Light, purple = Dark): B-10 shows the Light Dragon Lord with the Light Magus; B-11 shows a Dark hero with a Light hero. The designer confirmed on 2026-11-11 that the texts are right, so both screenshots show positions without a legal target.
- The ability panel shows a Use button only when the ability is usable. A row without a button gives no reason, so "no legal target" looks like "broken".

**Decision**:
- One helper for "heroes on this Move's path": the Move's start square and the squares in `turn.movePath` (current square included), used by all three abilities. The heals then stay available until the Move ends, like *Breath*. Text: "while passing through that hero's square".
- The start square is part of the path (decided 2026-11-11). It is kept in a new turn flag, `turn.moveStart`, set to the hero's square when the Move phase begins; the path the abilities see is `moveStart` plus `turn.movePath` (spec A-14). `turn.movePath` itself is not changed, because two abilities read "`movePath` is empty" as "the hero has not moved yet" (`heroes/monk.ts:171`, `heroes/scout.ts:301`). The ability texts were confirmed as right: *Breath* hits enemy heroes only, the heals friendly heroes only.
- New derived helper `abilityStatus(state)`: for each ability of the active hero in its timing window, `usable` or one reason: `noUses`, `usedThisTurn`, `notEnoughDestiny`, `noTarget` (with the target kind the ability needs, from data: `targetHint`), `notAsHeroUnit`. The panel shows the reason under the row.
- Tests for each case above, including the two screenshot positions as "not offered, reason noTarget".

**Why**: With B-16 a hero walks several squares per click; an ability that only works while standing on the square would be skipped by every planned walk.

**Alternatives**: Stop a planned walk on every square where an ability becomes usable (rejected: many stops, and the player cannot know why). Not offering a heal for a hero at full health (left out: not asked; a wasted Destiny is the player's choice today).

---

## R-06 Sandbox keeps the turn (B-06)

**Found (Reproduced)**: `src/rules/sandbox.ts:95-108`: turning rules back on clears `pendingDecision`, sets fresh turn flags and calls `startFirstTurn`. A hero in the Lead phase with 4 Movement left comes back in the Move phase with 5. The phase and flags are still intact while in sandbox; only the return resets them. 001 decided this on purpose (User Story 6, scenario 5: play resumes at Before Turn "so checkmate is checked first"), so B-06 changes a recorded decision. The designer confirmed the change on 2026-11-11 and added the checkmate alert below.

**Decision**:
- On entering sandbox while `status` is `playing`, the state keeps a resume point: turn number, active hero, phase, turn flags, open decisions (`GameState.sandboxResume`).
- `setEnforcement { mode: 'rules', restart?: boolean }`. Without `restart`, and when the resume point's turn number and active hero still match, the turn continues: phase, flags and decisions are put back, then checked:
  - a Lead that waits for its roll is cancelled when its unit is not on the announced square any more or the Lead is no longer legal;
  - a square decision whose options changed is asked again with the new options, or dropped if none is left;
  - `leadPossible` is recomputed when the Lead was not yet attempted.
- With `restart: true`, or with no matching resume point, today's behaviour stays (Before Turn). The position editor and the test fixture (`tests/fixtures/position.ts`) pass `restart: true`, so all existing positions start as before.
- The position check (`validatePosition`) is unchanged. Checkmate is ruled at the next Before Turn, as always (`endgame.ts` `checkmateCheck`).
- **Checkmate alert (decided 2026-11-11).** A mid-turn resume no longer passes Before Turn, so a checkmate set up in the sandbox would go unnoticed until the next turn. New derived helper `positionWarnings(state)` returns `{ code: 'CHECKMATE', side }` for each checkmated King (it uses `isCheckmate`). Before the UI sends `setEnforcement('rules')`, from Settings or from the position editor, it reads the warnings; with a checkmate it shows an alert that names the side and what will happen, with two buttons: "Continue the game" sends the action, "Back to sandbox" does nothing. The rules core stays permissive: checkmate is a legal position, not a `POSITION_INVALID` problem, and a position with real problems still shows the problem list first.
- "Continue" does not end the game by itself; the normal check at the next Before Turn does (confirmed 2026-11-11).
- **The *Check* rule about the end of the Lead must survive the trip** (the designer's condition). Today: after a Lead resolves, `turn.kingInCheckAfterLead` records whether the own King is in check, and `abilitiesBlocked` (`abilities.ts:12`) then blocks After Lead and End of Turn abilities, so those phases pass by themselves. The resume point copies all turn flags, this one included, and the resume does not recompute it. A turn continued before its Lead runs the normal Lead code, which sets the flag as always. Tests: a turn resumed in the Lead phase with the own King in check, whose Lead fails, ends without After Lead and End of Turn abilities; a turn resumed with the flag already set keeps it.
- Saves: `migrateState` fills `sandboxResume: null`.

**Why**: The resume point must be in the state, not in the UI: saves and replays rebuild the game from the action log only (001 R-11).

**Alternatives**: Keep it in the browser session (rejected: lost on reload and not replayable). Make checkmate a blocking problem (rejected: the decision gives the players the choice). An `acceptCheckmate` flag on the action (rejected: sandbox is hot-seat only and the core has nothing to refuse). Always resume and let the fixture work around it (rejected: 360 tests assume a fresh turn).

---

## R-07 Inspired Lead at the roll prompt (B-07)

**Found (Read)**: `src/rules/abilities.ts` allows `inspiredLead` only in `beforeLead`. The turn already stops in Before Lead whenever the hero can pay 1 D (`turn.ts` `isAutomaticBase`), and the action bar shows an Inspired Lead button there. Once the player presses End phase, the chance is gone, and the roll prompt (`ui/hud/roll.ts`) only has Roll d20 and Revenge.

**Decision** (confirmed 2026-11-11): the rules core also accepts `inspiredLead` in the Lead phase until the die is rolled, still once per turn.
- Before a Lead is announced: as today (`turn.inspiredLeadBonus`).
- After the announcement: the bonus is added to the Lead's modifiers; if `1 + modifiers ≥ target` the Lead needs no roll any more and resolves as a success.
- The roll prompt shows the button next to Roll d20; the action bar keeps its button in Before Lead only, so there is never two.
- Before Lead keeps stopping as today.

**Why**: Doing this in the UI alone (undo back to Before Lead, pay, announce again) breaks online and after any reveal. One small rule change is simpler and is what the designer asked for; it is recorded as a decision for the rulebook (constitution I).

**Alternatives**: A reminder toast in Before Lead (rejected: the request is a button at the roll).

---

## R-08 Targets on the board (B-02)

**Found (Read)**: `main.ts` `useAbilityFromPanel`: when an ability has more than one target choice it opens `dialogs.choose` with one button per choice, labelled by `targetLabel` (square names). *Warhorse* has up to 8 squares, so it lists coordinates. The same code path serves every ability with targets. Board targeting exists only for Hero Retreat (`targeting: { kind: 'retreat' }`).

**Decision**:
- A pure `targetPrompt(offers)` in `src/game/target-model.ts` turns an ability's target choices into steps. Each step is a set of board picks: squares, units (picked by their square) or heroes. Choices with a `unitType` target, or with nothing to pick on the board, keep the dialog. An ability with `options` (*Breath*: square / knight) first asks for the option in a small dialog, then targets on the board.
- `main.ts` generalises `targeting` to `{ abilityId, option, step, chosen }`. Highlights use the existing `decision` colour; a help line names the ability and has a Cancel button; Esc cancels.
- One choice with one target is still used at once, as today.

**Why**: One mechanism for all 86 abilities, tested headless; no per-ability UI.

**Alternatives**: Special-case the four "move one square" abilities (rejected: the same list problem exists for *Flaming Bolt*, *Preaching*, *Poison Water* and others).

---

## R-09 Reach and the Move plan (B-16)

**Found (Read)**: `legalMoveSquares` returns the adjacent squares in the grid (plus Smuggler's Grotto squares); `moveStep` moves one square and costs 1 Movement. A hero may step onto any square in the grid; only the end of the Move is limited (`isForbiddenEndSquare`: an enemy unit or a King, unless *Elusive*). The highlight shows only the next step.

**Decision**:
- Rules core: `moveReach(state)` returns every square reachable with the Movement left: `{ to, cost, path, canEnd }`. It is a breadth-first search over the same step function `moveStep` uses, written so it takes a position (`moveSquaresFrom(state, hero, pos)`); `legalMoveSquares` becomes a call to it. Ties between shortest paths are broken the same way every time: fewest squares with a visible enemy square token, then straight before diagonal.
- A property test proves that every returned path is accepted step by step by `moveStep`.
- `src/game/move-plan.ts` (pure): `extendPlan(state, plan, to)`, `planReach(state, plan)` (squares reachable from the plan's end with what is left), `planLeft(state, plan)`.
- UI (`main.ts`, `table/highlights.ts`): reachable squares in the `move` colour, squares that can be passed but not ended on in a lighter tone, the planned path as a line with step numbers, and "Movement left" in the help line for the plan.
- Clicks: a click on a reachable square extends the plan; a click on the plan's last square walks it. A double click on a fresh square is therefore plan + walk, with no timer. Esc or a click elsewhere clears the plan.
- Walking sends one `moveStep` per square, the next one after the previous one arrived and its move animation ended (about 150 ms; none in e2e mode). It stops on a refused step, an open decision or a wound. The same loop serves hot-seat and online.

**Why**: Each step stays a normal action, so the log, undo, replay, the online server and "During Move" abilities work unchanged (005 FR-081).

**Alternatives**: A new `moveTo` action with a whole path (rejected: a new server-checked action and new undo rules for the same result). Showing reach by distance only (rejected: wrong as soon as an ability changes the step rules).

---

## R-10 Flashes (B-19)

**Decision**:
- `src/game/flash-model.ts` (pure): `flashesFor(events, state)` returns a list of `{ kind, textKey, params, tone }` from the events of one action:
  - `heroWounded`, `heroHealed` (amount > 0), `unitDestroyed`, `abilityUsed`, `rolled` (value, total, success or fail), `leadFailed` without a roll (*Demoralise*);
  - `check`: the "CHECK" notice above the King, three blinks of one second, which does not slide (R-02);
  - `destinyChanged` summed per pool **and reason** for the action, with the reason in the text ("+2 D check", "+2 D destroyed an enemy unit"; see R-02), `epicSplit` left out;
  - phases the game passes by itself: one message per phase, "Phase '<name>' skipped", in order (decided 2026-11-11). For the Lead phase the message adds the reason ("no Lead possible"). Before Turn, Beginning of Turn and Before Move are announced only when the active hero has an ability timed in that phase (decided 2026-11-11): `flashesFor` looks the hero's ability ids up in `abilities.json`. Today that is Before Move for most heroes, Beginning of Turn for the Monk and the Death Knight, Before Turn for the Chronomonger; the Dragon Lord, Royal Assassin and Supreme Inquisitor have none of the three.
- `src/ui/hud/flashes.ts`: a DOM layer above the action bar. A flash appears, stays 0.5 s, then moves to the log panel's position and fades (CSS transition, about 0.4 s). Flashes start 120 ms apart; at most 4 are visible; later ones wait. With `prefers-reduced-motion` there is no slide.
- The test hook gets `flashes()` (everything shown so far), so browser tests do not race the animation.
- Rolls: local rolls dispatch after the die has landed, and online rolls are played before the change is handled, so the roll flash comes after the die.

**Why**: Events already describe everything that happened (001 R-11). CSS is enough; no animation library (VI).

**Alternatives**: 3D text over the board (rejected: unreadable from the far side and costly per frame).

---

## R-11 HUD details (B-04, B-08, B-12, B-15, B-17, B-18, B-20, B-21, B-22, X-01, X-02)

| Item | Found | Decision |
| --- | --- | --- |
| B-04 | `ui/hud/roll.ts` prints `lead.noRoll` whenever the Lead needs no roll | `hud-model` derives why: `king`, `peace`, `ability` (an ability's no-roll effect), `cannotFail` (1 + modifiers ≥ target). The panel shows `lead.auto.<reason>`. The string `lead.noRoll` is removed |
| X-01, X-02 | `roll.ts` builds `mod.<source>` and `game/log.ts` builds `reason.<reason>`; for abilities the source is the ability id, which has no such string, and `t()` returns the key. `table/sheets.ts` draws effect kinds as they are | `modifierLabel` and `reasonLabel` in `src/game/labels.ts`: the specific string if it exists, else the ability's name, else the effect's `effect.<kind>` string. `tests/i18n.test.ts` gets a check that no modifier source or reason of any ability falls through to a key |
| B-08 | Settings uses `action.close` | New string `settings.resume` = "Resume game" for the Settings button only (the problems dialog keeps Close) |
| B-22 | Offer draw is in `ui/hud/actions.ts` | Moved to `ui/settings.ts` (hot-seat and online menus), enabled from `can.offerDraw`; choosing it closes Settings. The test id `offer-draw` stays |
| B-15 | Only `A` and Esc are bound (`main.ts`) | Space ends the phase when: `can.endPhase`, it is this seat's move, no dialog / Settings / tracker is open, no roll or walk is running, the event target is not a field, and `event.repeat` is false. `preventDefault` stops page scroll |
| B-12 | `ui/setup/picks.ts` picks on the first click | `renderPicks` takes the pending hero id and a setter; the wizard (hot-seat) and `renderOnlinePicks` (online) hold it. First click: highlight and "Click again to confirm". Second click on the same card: pick |
| B-17 | The ability panel is in the bottom-centre column (`.actions`), over the near edge of the board and the sheets | Docked on the right between the pools and the log, own scroll, collapsible header with the count of usable abilities and a small light green box with the current phase (decided 2026-11-11; it stays visible when collapsed); state in `localStorage` (`rosada.ui.abilities`). Below 1500 px width it starts collapsed. A browser test projects the board corners to the screen and checks that no panel rectangle overlaps them (SC-004) |
| B-18 | HUD: an 8 px red bar plus "Health 7/8" text. Sheet: a "7/8" tag | HUD: an 18 px bar, red track, green fill = health / max, "7/8" centred in white with a dark outline. TTS sheet overlay: the same bar instead of the tag. The canvas sheet keeps its per-point track |
| B-20 | "Short range" / "Long range" in the top bar (`hud.activeHero`), hero cards (when no name), the destiny dialog title, setup cards | Top bar: "H1 · Cavalier (Light)" and two badges with `legend.movement` and `legend.range` icons. Hero cards: the same badges in place of the small grey text. Setup cards: badges (Q-72). During the Lead phase `highlights()` also returns the squares in Range, drawn as an outline |
| B-21 | The Hero Unit type is only text in the setup card | `HeroCard.heroUnitIcons`: the hero's `heroUnitType`, plus `rook` with *Advanced Warfare*, and `unlocked` from `unlockedPowers`. Drawn with the TTS ring token (`token.ring.knight` / `.bishop`) or a chess glyph when there is no image (Rook); dimmed until *Hero Unit* is unlocked |

---

## R-12 One Royal Favor track (B-14)

**Found (Read)**: `table/tracks.ts` draws one 16-slot track per side beside the hero sheets (`seatPose(side, 'track')`). The tracker menu (`ui/tracker.ts`) shows a 16-slot row per side above the lists. 16 comes from 11 Royal Favors done once plus *Tides of Destiny* up to 5 times; the Legendary Powers are at 6…11 (`royal-favors.json`).

**Decision** (confirmed 2026-11-11):
- `favor-model` adds `shared: { slots: 11, light, dark, powers }` with each side's count capped at 11 for the marker; the full count stays in `track.length`.
- Table: one vertical track, 1.2 × 8.4 squares, centred at x = −6.1 squares (between the board border and the strip), slot 1 at Light's end. Each slot has the number and, at 6…11, the power's short name, drawn once for each seat so both sides read it upright. Light's gold marker sits in the half of the slot nearer Light's seat, Dark's purple marker in the other half.
- The strip, the Graveyard zones and the Well move from x = −7.2 to x = −8.6 squares (`ZONES` in `table/coords.ts`), which keeps the strip inside the sandbox rim (±10.5 squares). The sandbox layout reads `ZONES`, so physics follows.
- The camera target moves a little towards the strip if the screenshot test needs it: the strip's four corners must be inside the viewport at 1366×768 from both sides.
- The per-side tracks are removed; `seatPose('track')` goes away. The turn-order medallions stay.
- Menu: the two 16-slot rows become the same shared track (one row, two markers). The lists of favors and powers stay as they are.

These numbers are starting values; the browser screenshots decide the final ones.

**Alternatives**: Keep 16 slots (rejected: the request is 1…11, and slots 12…16 unlock nothing). Two marker columns (rejected: wider, and the gap to the Graveyard is small).

---

## R-13 The Tabletop Simulator table (B-23)

**Found**: The folder holds `Table__Mesh.obj` (12,453 vertices, 24,651 faces, a table with legs: 84 × 33 × 46 units, top at y ≈ 0.6), `Table__Diffuse.png` (2048²) and `Table__Collider.obj`. 004 already imported the mesh and the texture (`public/tts/mesh/table.obj`, 2.8 MB; `tts/texture/table.webp`; key `tts.table`). `table/room.ts` uses only the texture, on a drawn slab of 30 × 27 world units; the floor is 6 units below.

**Decision** (confirmed 2026-11-11: the real model, scaled with its proportions kept):
- `room.ts` loads the `tts.table` model after the first frame. It is scaled evenly so its top covers the area the game needs (the sandbox rim, 26.2 units deep: scale ≈ 0.58, giving about 49 × 27 units) and placed with its top at the slab's height. The floor is lowered to the feet of the legs.
- The drawn slab stays until the model has loaded and with `?placeholders` (001 FR-113 pattern).
- The sandbox keeps its flat table collider and rim; `Table__Collider.obj` is not needed.
- Scale, height offset and turn are fields on the `tts.table` entry in `assets.json`.
- Load cost: 2.8 MB once (about 0.8 MB compressed), after the board is visible; checked against the 10 s first-load target.

**Alternatives**: Keep the slab with the texture (rejected: the request is the table). Import the file again from `D:\…` (not needed: same mesh).

---

## R-14 Unit facing (B-24)

**Found (Read)**: `table/pieces.ts` `yawOf`: Light units have yaw 0, Dark units π. The TTS models then look away from the enemy.

**Decision**: a `yaw` field (degrees) on mesh entries in `assets.json`, set to 180 for the six unit models by `scripts/import-tts-assets.ts`; `tts-models.ts` turns the model inside its holder, and `colliderPoints` turns the sandbox collider the same way. `yawOf(side)` stays. Placeholders are not turned.

**Why**: The mistake is in how the models were exported, so it belongs to the model's data (III), and one place fixes the board, the Graveyard and the sandbox.

---

## R-15 Online camera (B-13)

**Found (Read)**: `main.ts` `onChange`: `camera.setSide(active.side)` after every change, for hot-seat and online alike.

**Decision**: a small `viewSide(state, seat)`: online it is the side of the local seat (from the room view), for every seat type; in hot-seat it is the active hero's side as today. `camera.setSide` is called when that value changes, so a player's own orbiting is not undone on every action. Reset camera uses the same side.

---

## R-16 Existing tests this feature touches

| Suite | Why it changes |
| --- | --- |
| `tests/rules/destiny*.test.ts`, `lead.test.ts`, `hero-unit.test.ts`, `royal-favors.test.ts`, `create.test.ts` | B-05: the `check` event gets its units and is emitted only for a new check; new cases: the reported one, a King left in check, a promotion with check, an ability-only check |
| `tests/rules/epic*.test.ts`, `tests/e2e/epic.spec.ts` | Mirror: two choices (new tests; no test covers Mirror destinies today) |
| `tests/rules/heroes/*.test.ts`, `named-heroes.test.ts`, `games/scripted-game-03/04` | B-09: pools after starting abilities; B-10/11: path-based heals |
| `tests/rules/sandbox.test.ts`, `tests/fixtures/position.ts` | B-06: `restart: true` in the fixture; new resume cases |
| `tests/rules/undo.test.ts`, `tests/online/room-undo.test.ts` | B-03: the screenshot case |
| `tests/game/favor-model.test.ts`, `sheet-model.test.ts` | B-14, B-09 |
| `tests/e2e/turn.spec.ts`, `quickstart.spec.ts`, `tracker.spec.ts`, `setup.spec.ts`, `heroes.spec.ts`, `epic.spec.ts`, `tts-table.spec.ts`, `online.spec.ts` | Move by click (B-16), Offer draw (B-22), tracks (B-14), pick confirm (B-12), costs (B-09), destiny dialog (B-01), table (B-23), camera (B-13) |
| `tests/i18n.test.ts` | New strings; the no-raw-key check (X-01, X-02) |
| `tests/boundaries.test.ts` | Unchanged; the new `src/game` modules must pass it |

---

## R-17 Epic destinies in Mirror mode (B-01, decided 2026-11-11)

**Found (Read)**: Basic Rules *Mirror*: "both sides play the same two starting Heroes and Epic Destinies", with no steps for how the destinies are chosen. `src/rules/epic.ts` queues one `epicDestiny` decision per hero in every mode (`maybeStartEpic`, `choiceOrder`), and the 003 spec's edge cases say "each side's heroes still choose separately". So a Mirror game could end with different forms on the two sides.

**Decision** (the designer's rule): in Mirror mode there are two choices. One side chooses a destiny, and both heroes of that class become it; then the other side chooses for the other class.

- `maybeStartEpic` reads `state.setup.mode`. In Mirror it queues two decisions:
  - the first for the first hero in `choiceOrder` (unchanged order: turn order from the active hero, the hero who emptied the Well last);
  - the second for the hero of the other class on the other side.
- Each decision carries `appliesTo`: the chooser and its twin (the hero with the same `definitionId` on the other side). `chooseDestiny` applies the form to both and emits `destinyChosen` for each.
- `destinyOptions` is unchanged. The Fanatic / Dominant limit works for the second choice as it is, because the chooser's own side already holds the first destiny.
- Draft is unchanged, also with the generic heroes, where both sides hold the same two definitions: only the mode pairs heroes.
- The dialog (R-01) shows "choice n of 2" and both heroes' names.
- Online: the decision belongs to the chooser's seat, as every `epicDestiny` decision does (005 authority); no protocol change.
- The 003 spec's edge case is corrected with a pointer to this feature, and the rule goes into the rulebook corrections file.

The order was confirmed on 2026-11-11 (Q-75): the first hero in the 003 choice order chooses first.

**Alternatives**: Keep four decisions and restrict the twin's options to one (rejected: two dialogs with nothing to choose). Pair heroes by definition in every mode (rejected: it would change Draft games with the generic heroes, which 003 tests rely on).

---

## R-18 The own King: refused Leads and the warning before an ability (decided 2026-11-11)

**Rule**: a Lead that would put the own King in check is not allowed, also when it is made with an "Instead of Lead" ability; the player is told "That would place your King in check". Any other ability that would put the own King in check may be used, after a warning with Continue and Undo; the other side then gains its check Destiny (R-02). Basic Rules *Check*: "A unit cannot be Led if that Lead would leave its King in Check"; *Lead*: "You cannot attempt a Lead that would put your King in check."

**Found (Read)**:
- Leads are already refused. `legalLeadsForUnit` (`check.ts:104`) drops every Lead that leaves the own King in check, and `announceLead` refuses what is not in that list (`lead.ts:92`).
- Of the eight abilities with the "Instead of Lead" timing, seven Lead a unit and go through `abilityLead` (`heroes/util.ts:82`), which refuses the same way: *Tight Formation*, *Draconic Descent*, *Crusade*, *Pilgrimage*, *Blind Faith*, *Red Carpet*, *Certainty and Death*. The eighth, *Infiltrate*, places a Pawn and is not a Lead.
- What the player sees is the gap. Such squares are simply not highlighted, so nothing says why a unit cannot go there. And `announceLead` uses the code `LEAD_LEAVES_KING_IN_CHECK` for **every** refused non-King Lead, also for a square the unit cannot move to at all (seen while testing: a Bishop sent to a square off its diagonal got this code).
- Other abilities can open a line to the own King without a word. *Souls Clash* Destroys a friendly Pawn first; nothing checks whether that Pawn was shielding the King. The "Must not check the King" symbol (17 abilities, 004 FR-014) only refuses a check given by the ability's own unit, and by its definition not a discovered check.

**Decision**:
- `leadRefusal(state, unitId, to)` gives the reason a Lead is refused: `wouldCheckOwnKing` when the unit could go there by its own rules and only check forbids it; otherwise the existing reasons, with a new code `NOT_A_LEAD` for a square the unit cannot move to. `announceLead` and `abilityLead` use it, so `LEAD_LEAVES_KING_IN_CHECK` means what it says. Its text becomes "That would place your King in check".
- `blockedLeads(state, unitId)` lists a unit's Leads that only check forbids. `highlights()` returns them as kind `blocked`; a click shows the message. The target prompt (R-08) does the same for the unit-and-square step of an "Instead of Lead" ability: each such ability's target function already builds its options from `legalLeadsForUnit`, so the blocked ones come from the same helper.
- `wouldCheckOwnKing(state, action)`: applies the action to a copy (the rules core is pure) and reports whether a unit checks the acting side's King afterwards that did not before. The UI asks it before it sends `useAbility` (hero abilities, general abilities, Legendary Power actions). If true: a dialog "This will put your King in check" with Continue and Undo. Undo sends nothing (spec A-12).
- The rules core does not refuse such an ability: the designer allows it. Online, the warning is the client's; the server accepts the action as any other.
- One test walks all eight "Instead of Lead" abilities: the seven that Lead are refused when the Lead would leave the King in check; *Infiltrate* is flagged by `wouldCheckOwnKing` when it uncovers the King.

**Alternatives**: Let the ability happen and offer Undo afterwards (rejected: Destroyed units and wounds are reveals and cannot be undone, 005 FR-030; online the other players would already have seen it). Refuse such abilities in the core (rejected: the designer wants a choice). Leave blocked squares hidden and only fix the message (rejected: the message would never be seen).

---

## R-19 Which abilities may place a King in check (decided 2026-11-11, fourth and fifth round)

**The designer's rule (final, fifth round)**: an ability is refused when the unit it affects would itself check a King. A discovered check is allowed, however the line was opened (a Destroyed, pushed or moved unit). This holds for every ability, with or without the "Must not check the King" symbol. In the fourth round the rule was first given as "only abilities that Destroy units"; the designer withdrew that after the check below.

**Checked against `Basic Rules 2_5.docx`** (read as text; `Hero Rules 2_0.docx` is not in the repository, so it could not be checked):

| Rulebook | Text | Covers |
| --- | --- | --- |
| *Create* | "You may never create a unit if it would immediately result in a check." | Created units |
| *Modify* | "You may never modify a unit if it would immediately result in a check." | Modified units |
| Symbol Legend, *King's Powers* | "Must not check the King, in abilities with this symbol, this does not apply to discovered checks" | The 17 abilities with the symbol |
| Legendary Power *Hero Unit* | A hero may not turn into a unit "if they would check the King from that square" | Becoming a Hero Unit |
| Royal Favor IV *Tactical Genius* | "Make a discovered check without Destroying a friendly unit with an ability." | Shows that a check opened by an ability is an allowed, known case |

The final rule is the Symbol Legend's rule, applied to all abilities. The one thing it adds to the printed text is the abilities without the symbol, for which Basic Rules has no check limit (for example the pushes *Terrifying Roar*, *Divine Protector*, *Bushwack*, *Misinformation*); that sentence goes into the corrections file.

**Today in the code**: `engine.ts` `runEffect` refuses a `mustNotCheck` ability when a unit that is new, moved or retyped checks either King after the effect (`newCheck`, `abilities/targets.ts:73`); discovered checks pass. That is exactly the final rule, but only for the 17 flagged abilities. Abilities without the flag are never refused for check.

**Decision** (FR-016):
- `runEffect` applies the `newCheck` test to every ability whose effect can change units, not only to flagged ones. No new logic.
- Abilities that make the turn's Lead (`abilityLead`) are not tested this way; the Lead rules apply to them (R-18).
- `mustNotCheck` stays in the data for the sheet symbol. `ABILITY_WOULD_CHECK` keeps its code; its text becomes "That would place a King in check".
- Refused targets are not simply dropped: `abilityOffers` returns them as `blocked` with the reason, so the board can show them and say why (FR-026). `abilityStatus` (R-05) reports `wouldCheck` when no other target is left.
- The own-King warning (R-18) shows for any ability that opens a line to the own King.
- The check Destiny rule (R-02) is unchanged: an allowed check gains its 2 D.

**Cost**: every offered target of an ability with unit effects is run on a copy, as flagged and `simulate` abilities already are. Abilities that cannot change units (wounds, heals, hero moves, bonuses) are skipped by a data flag (`changesUnits: false`).

**Alternatives**: Only a line opened by a Destroyed unit (the fourth-round wording; withdrawn by the designer). The rule only for symbol abilities (the rulebook as printed; rejected by the designer: abilities without the symbol follow it too).

---

## R-20 Refusals say why (decided 2026-11-11, fifth round)

**Found (Read)**: a refused action already shows a toast with the reason and the rule's name (`main.ts` `showError`, 001 FR-202), also for refusals from the online server. What gives no reason is everything the game simply does not offer: Lead squares dropped for check, ability targets dropped by the engine, abilities without a Use button.

**Decision**: three places, one rule: if something is unavailable for a rule reason, it is visible and gives its reason on hover (the designer's choice, 2026-11-11).
- Lead squares blocked by check: R-18.
- Board squares (blocked Leads, blocked ability targets): the picker already knows the square under the pointer; when it is a blocked one, a small tooltip at the pointer gives the reason. A click shows the same text and does nothing else. `AbilityOffer.blocked` lists the targets refused for check with their code.
- Touch screens have no hover; the click path covers them.
- Ability rows without a Use button: the reason from `abilityStatus` (R-05) as a tooltip on hover and keyboard focus.
- `tests/i18n.test.ts` already checks that every error code has a text; it gets the new codes.

Not included: reasons for squares a unit can never reach by its own movement (that is not a refusal).

---

## R-21 One use or both (Q-62a, decided 2026-11-11)

**Found (Read)**: *Preaching*: "Mark an adjacent enemy unit with the Preaching token. That unit has a -4 penalty to Lead on the next turn. If you spend both uses on it, that unit cannot be Led on the next turn." 004 (Q-50) built this as two separate uses on the same unit in one turn (`heroes/monk.ts:73`); the player has to know to use it twice. It is the only ability with such a text; *Flaming Bolt* also has two uses but no both-uses effect.

**Decision**: the designer's rule: an ability with a different effect for both uses gives the choice to spend both, if both are available.
- Data: `bothUses: true` on `monk.preaching`, with the both-uses effect's values. The engine offers the options `one` and `both`; `both` needs 2 uses left and, with B-09, 2 D.
- `both` spends two uses and 2 D in one action and applies the stronger effect.
- *Preaching* becomes once per turn like every Starting ability (Basic Rules *Hero abilities*; spec A-13), so the old path of using it twice in a turn goes away.
- The interface shows the choice as two buttons in the ability's row or prompt before the target is picked.
