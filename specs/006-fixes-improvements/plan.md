# Implementation Plan: Fixes and Improvements from the First Playtests

**Branch**: `006-fixes-improvements` | **Date**: 2026-11-10, updated 2026-11-11 after clarification | **Spec**: [spec.md](./spec.md)

**Input**: `Fixes & Improvements.xlsx` (24 rows, kept in [backlog.md](./backlog.md)) and the feature specification in `/specs/006-fixes-improvements/spec.md`, which this command wrote from the spreadsheet because no spec existed.

**Note**: Filled in by `/speckit-plan`. `setup-plan.ps1` could not be run here (no PowerShell), so the branch name and folder were set by hand to what the script would produce. No `before_plan` hook was run (the only one is the optional git commit).

## Summary

24 playtest items: 6 are rule or session items, 1 is already fixed on `main`, and 17 are interface and table changes. The designer answered all blocking questions on 2026-11-11 in six rounds (spec, Clarifications). Additions that came out of the answers: a checkmate alert when leaving the sandbox, Epic destinies in Mirror mode, check warnings (a "CHECK" flash above the King and an "In check" pop-up), a warning before an ability that puts the own King in check, and a clear message for a Lead that would.

**What was found** (details in [research.md](./research.md)):

- **B-01 Epic choice**: the dialog shows the Cavalier's Epic pictures for the Monk and the Magus's for the Scout, and never names the hero or the forms. Fix in the view, from data that already exists (R-01). **Decided**: in Mirror mode there are two choices, each for both heroes of a class (R-17).
- **B-05 check Destiny**: **decided**: 2 D for a new check from any kind of action, at most once per turn per side. The reported case (Lead check, then an ability uncovers the Queen's check) already gains once; its second +2 D is the Destiny for Destroying an enemy unit. Three other cases are wrong today and are fixed by one rule evaluated after every action: a King left in check makes every later Lead gain again; a promotion that gives check gains nothing; an ability-only check gains nothing. A check a side uncovers on its own King gives the other side its 2 D. New: the "CHECK" notice above the King (three blinks of one second) and the "In check" pop-up with the rule on hover (R-02).
- **Own King (decided)**: Leads that would leave the own King in check are already refused, also for the seven "Instead of Lead" abilities that Lead a unit; what is missing is the reason on screen, and the error code is also used for plain illegal moves. Fix: blocked squares are shown and say "That would place your King in check". Other abilities can expose the own King silently today; they get a warning with Continue and Undo before they take effect (R-18).
- **Abilities and check (decided, fifth round)**: an ability is refused when the unit it affects would itself check a King; every discovered check is allowed. That is the "Must not check the King" symbol's rule from the rulebook, now for all abilities; the code already has it for the 17 flagged ones, so the change is to apply the same test to the rest (R-19).
- **Refusals say why (decided)**: refused actions already show the reason and rule. Blocked Lead squares, blocked ability targets and abilities without a Use button now give theirs as a warning on hover (R-20).
- ***Preaching* (decided)**: one use or both in one action, when both are available; once per turn (R-21).
- **Phases (decided)**: every phase the game passes by itself is announced; the three at the start of a turn only for a hero with an ability timed there. The ability panel shows the current phase in a small light green box (R-10, R-11).
- **B-09 starting abilities**: **decided**: each symbol is one use and costs 1 Destiny; the game charges nothing today. Fix: a cost of 1 in `abilities.json` for the eight limited abilities (R-04).
- **B-03 undo**: built in 005 on the same day; the screenshot case works on `main`. Only a regression test is added (R-03).
- **B-10, B-11**: in both screenshots the hero in the square is not a legal target by the ability's text, which the designer confirmed as right. **Decided**: the square the Move starts on counts as in the path. Real gaps: the two healing abilities stop being offered once the hero steps further, and the panel never says why an ability cannot be used (R-05).
- **B-06 sandbox**: **decided**: the turn continues where it was; the state keeps a resume point. New: if a King is checkmated when rules come back on, the players are told and choose to continue or to go back to the sandbox. The rule "in check at the end of your Lead: no After Lead or End of Turn abilities" is kept through the trip and has its own tests (R-06).
- **B-07**: **decided**: `inspiredLead` is accepted until the die is rolled, and the roll prompt gets the button (R-07).

**Approach for the rest**:

- **Pure models first.** Everything a screen needs is computed in engine-free modules and tested headless: reach and move plan (B-16), target prompt (B-02), flashes (B-19), destiny choice (B-01), labels (X-01, X-02), shared favor track (B-14), view side (B-13). The DOM and Three.js code only draws them.
- **Moving stays one step per action.** A planned walk sends ordinary `moveStep` actions one after another, so the log, undo, replay and the online server need no change (R-09).
- **Data, not code**, for the ability cost, the unit model turn, the table model's scale, and all new text.
- **No new dependency.** Flashes are CSS.

All questions are answered; none is open.

## Technical Context

**Language/Version**: TypeScript 7.x; Node.js 24 LTS; current desktop Chrome, Edge, Firefox (unchanged)

**Primary Dependencies**: unchanged: three 0.187.x, @dimforge/rapier3d-compat 0.21.x, Colyseus 0.18.x, Vite 8.x; dev: Vitest 5.x, @playwright/test 1.64.x, ajv 8, tsx, sharp. **No new runtime or dev dependency.**

**Storage**:
- Save files and room files keep their format. `GameState` gains one optional field (`sandboxResume`), filled by `migrateState`; `STATE_VERSION` goes up by one.
- `localStorage`: one new key for interface choices (`rosada.ui.abilities`: panel collapsed or open).

**Testing**:
- Vitest, rules core: every rule scenario of US1, US2 and the Mirror scenarios of US3 as `US<n>-AS<m>`, each bug fix starting from a failing test; a property test that every `moveReach` path is accepted by `moveStep`.
- Vitest, `src/game` models: move plan, target prompt, flash model, destiny choice model, labels, favor model, HUD model.
- Vitest, online and server: `inspiredLead` in the Lead phase through `RoomCore`; a room file that no longer replays is skipped at start (the server already does this; the test pins it).
- Playwright: one spec per user story for US3–US7, with screenshots at 1920×1080 and 1366×768 for the layout checks. The test hook gains `flashes()`, `plan()`, `panelRects()` and the shared track in `tableElements()`.
- The 001–005 suites stay green; R-16 lists the ones whose expectations change.

**Target Platform**: Browser, as before. The server changes only by running the same rules core.

**Project Type**: Web application: one front-end project with a small Node.js game server in the same repository (unchanged).

**Performance Goals**:
- 60 fps with the table model (24,651 faces) and the reach highlights (up to 100 squares, one instanced or merged mesh).
- `moveReach` under 1 ms per call (a 10×10 grid).
- A flash is visible for 0.5 s and gone within 1 s; at most 4 at once.
- First load stays ≤ 10 s: the table model (2.8 MB) loads after the first frame.

**Constraints**:
- `src/rules`, `src/game` and `src/online` stay engine-free; new modules there must pass `tests/boundaries.test.ts`.
- Rules behaviour changes only at FR-001, FR-002, FR-003, FR-006, FR-007, FR-012, FR-016, FR-017. Everything else in `src/rules` is additive (helpers).
- The *Check* rule about the end of the Lead (`turn.kingInCheckAfterLead`, `abilitiesBlocked`) must behave exactly as today, also after a sandbox return.
- Online: the server keeps checking every action; no new message type. Client and server must be deployed together, as `dataHash` changes with `abilities.json`.
- Old saves that used a starting ability may not replay (R-04); an imported one must fail with a clear message.
- No panel may cover a board square at the default camera (SC-004).

**Scale/Scope**:
- 7 user stories, 74 acceptance scenarios, 39 functional requirements, no open questions, 19 resolved.
- New engine-free modules: 6 in `src/game`; none in `src/rules`, where about 12 existing files change.
- New UI modules: 3 (`ui/hud/flashes.ts`, `ui/hud/badges.ts`, `ui/hud/check.ts`); about 14 UI and table files changed.
- Data: `abilities.json` (a cost on 8 abilities, `targetHint` where an ability has targets), `assets.json` (`yaw` on the 12 unit model entries, 3 fields on `tts.table`), `strings.en.json` (about 60 new strings), 2 schemas.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
| --- | --- | --- |
| I. Rulebook is the source of truth | B-05 and B-09 are traced to Basic Rules *Destiny* and *Hero abilities* (quoted in R-02, R-04). The designer decided Q-61, Q-62, Q-64, Q-65, Q-66 on 2026-11-11; the decisions are in the spec's Clarifications and Resolved table and go into the rulebook corrections file. The designer also decided Q-73, Q-74 and Q-75 and confirmed the reading of "Continue the game". In the third round the designer confirmed A-10 (a new check is a newly checking unit), overruled A-09 (the other side does gain when a side uncovers its own King) and added the own-King warning and the Lead message, both traced to Basic Rules *Check* and *Lead* (R-18). One reading is recorded for the designer (A-12: the warning comes before the ability takes effect). The rule for abilities and check (FR-016) was checked against the rulebook; the designer then settled it as the Symbol Legend's rule for all abilities, and confirmed A-12. The remaining questions were answered in the fifth round. The sixth round confirmed A-14 and settled Q-77; A-13 (*Preaching* once per turn) was asked back and confirmed. No rule waits for an answer | ✅ Pass |
| II. Engine-free rules core | Rule changes are in `src/rules`; new view logic is in `src/game`. Neither imports Three.js, Rapier, Colyseus or the DOM. The sandbox resume point is part of the serialisable state. The UI still only sends actions | ✅ Pass |
| III. Data-driven content | Ability costs in `abilities.json`; `targetHint` per ability in data; model turn and table scale in `assets.json`; Hero Unit icons from `heroes.json`; texts in `strings.en.json`. No hero is named in core code | ✅ Pass |
| IV. Rules tested first | Each rule bug has a reproduced case (research) that becomes the failing test. Every acceptance scenario gets a `US<n>-AS<m>` test. Rolls in tests are fixed values | ✅ Pass |
| V. Verifiable without a human | All models are headless. Layout, flashes, the track, the table and the camera are checked by Playwright through the test hook and screenshots. The quickstart lists commands and a manual check | ✅ Pass |
| VI. Keep it simple | No new dependency. No new action type except one optional flag (`restart`) and one widened timing (`inspiredLead`). Walking reuses `moveStep`. No state for "Destiny on the sheet". The checkmate alert is a derived helper plus a dialog, not a new action. Mirror reuses the `epicDestiny` decision. The table collider is not imported | ✅ Pass |
| Technology Constraints | Unchanged stack. Desktop browsers. The sandbox core stays separate from the game module | ✅ Pass |
| Development Workflow | One folder and branch. The spec was written by this command instead of `/speckit-specify`; the clarification was done in six rounds with the rules designer on 2026-11-11 (spec.md, Clarifications); `tasks.md` was written the same day | ✅ |

**Re-check after Phase 1 design**: ✅ Pass.
- The contracts add four derived helpers, change two actions and extend one decision in `src/rules`; everything else is in `src/game` and the UI.
- The data model adds one optional state field and one field on a decision, and no new stored entity.
- Re-checked on 2026-11-11 after all five clarification rounds: still ✅ Pass. FR-016 reuses the existing `newCheck` test. The own-King warning is a derived helper and a dialog; the core refuses nothing new. The check rule moved from `lead.ts` to one place in `apply`, which is simpler than three special cases; the warnings are a view of state and events.
- No Complexity Tracking entries.

## Project Structure

### Documentation (this feature)

```text
specs/006-fixes-improvements/
├── backlog.md            # The 24 spreadsheet rows as written, ids B-01…B-24, plus X-01, X-02
├── screenshots/          # The 10 screenshots from the spreadsheet (downscaled)
├── spec.md               # Feature spec (written by /speckit-plan; clarified 2026-11-11; questions Q-61…Q-75)
├── plan.md               # This file
├── research.md           # Phase 0: R-01…R-16
├── data-model.md         # Phase 1: state, data and view-model changes
├── quickstart.md         # Phase 1: run, tests, manual check per backlog item
├── contracts/
│   ├── rules-api-changes.md  # Actions, helpers and guarantees changed in src/rules
│   └── ui-interactions.md    # Clicks, keys, panels, test ids and the test hook
└── tasks.md              # Phase 2 (/speckit-tasks): 87 tasks
```

### Source Code (repository root)

```text
src/
├── rules/
│   ├── lead.ts               # B-05: the check gain and event move out; B-07: recompute an announced Lead
│   ├── check.ts              # B-05: checkingUnits, blockedLeads, leadRefusal
│   ├── destiny.ts            # B-05: new-check gain, once per turn per side
│   ├── epic.ts               # B-01: Mirror mode queues two choices, each for both heroes of a class
│   ├── abilities.ts          # B-07: inspiredLead also in the Lead phase until the roll
│   ├── abilities/engine.ts   # B-10/11: abilityStatus (why not usable); B-05: the newCheck test for every ability, blocked targets with reasons (FR-016, FR-026); both-uses option (FR-017)
│   ├── heroes.ts             # B-16: moveSquaresFrom, moveReach
│   ├── heroes/util.ts        # B-10/11: heroesOnMovePath; B-05: abilityLead uses leadRefusal
│   ├── heroes/cavalier.ts, monk.ts   # B-10/11: use the path helper; Preaching one use or both
│   ├── turn.ts               # B-10/11: turn.moveStart set when the Move phase begins
│   ├── sandbox.ts            # B-06: resume point, restart flag, positionWarnings (checkmate)
│   ├── setup.ts              # STATE_VERSION + 1
│   ├── index.ts              # apply: new-check evaluation after every action; wouldCheckOwnKing; legalActions (inspiredLead in lead); exports
│   └── model/state.ts, actions.ts    # sandboxResume; checkDestinyClaimed; setEnforcement.restart; epicDestiny.appliesTo; check event units; PositionWarning
├── game/
│   ├── labels.ts             # NEW X-01/02: modifierLabel, reasonLabel, markLabel
│   ├── move-plan.ts          # NEW B-16: extendPlan, planReach, planLeft
│   ├── target-model.ts       # NEW B-02: targetPrompt
│   ├── flash-model.ts        # NEW B-19: flashesFor
│   ├── destiny-model.ts      # NEW B-01: destinyChoiceModel
│   ├── view-side.ts          # NEW B-13: viewSide
│   ├── hud-model.ts          # B-04, B-20, B-21: lead.auto reason, hero name, badges, Hero Unit icons, range squares; B-05: inCheck
│   ├── sheet-model.ts        # B-09: cost with uses; B-10/11: status reason
│   ├── favor-model.ts        # B-14: shared track
│   └── save.ts               # migrateState: sandboxResume; older-rules message
├── ui/
│   ├── dialogs.ts            # B-01: destiny dialog from destiny-model; B-06: checkmate alert; B-05: own-King warning
│   ├── settings.ts           # B-08 Resume game; B-22 Offer draw
│   ├── tracker.ts            # B-14: shared 1…11 row
│   ├── setup/picks.ts, index.ts      # B-12: click again to confirm
│   ├── hud/abilities.ts      # B-17: dock, collapse, current-phase box; reasons on hover
│   ├── hud/actions.ts        # B-22: no Offer draw; Inspired Lead only in Before Lead
│   ├── hud/heroes.ts, phase-bar.ts   # B-18, B-20, B-21
│   ├── hud/roll.ts           # B-04, B-07, X-01
│   ├── hud/badges.ts         # NEW: Movement / Range badges, Hero Unit icons, health bar
│   ├── hud/check.ts          # NEW B-05: "In check" pop-up above the ability panel, rule on hover
│   ├── hud/flashes.ts        # NEW B-19; the "CHECK" notice anchored above the King
│   └── style.css
├── table/
│   ├── highlights.ts         # B-16 reach, pass-only, path; B-20 Range outline; B-02 target steps; B-05 blocked Lead squares
│   ├── picking.ts            # FR-026: the square under the pointer, for the hover warning on blocked squares
│   ├── tracks.ts             # B-14: one vertical shared track; medallions stay
│   ├── coords.ts             # B-14: ZONES moved outwards
│   ├── sheets.ts             # B-18 bar; B-09 crystals on used symbols; marks by name; seatPose without 'track'
│   ├── room.ts               # B-23: TTS table model, slab as placeholder
│   ├── tts-models.ts         # B-24: yaw per model, also for colliders
│   ├── pieces.ts             # B-24 (unchanged yawOf; model turn comes from data)
│   └── camera.ts             # B-13: side from viewSide; B-14: target if needed
├── main.ts                   # targeting state, move plan and walker, Space, flashes, view side, pick confirm (online), checkmate alert before rules come back on, own-King warning before an ability is sent
└── data/
    ├── abilities.json        # B-09: cost 1/1 on 8 abilities; targetHint
    ├── assets.json           # B-24: yaw on 6 unit models; B-23: tts.table scale / offset
    ├── strings.en.json       # new texts; lead.noRoll removed
    └── schemas/abilities.schema.json, assets.schema.json
scripts/
└── import-tts-assets.ts      # writes yaw and the table fields, so a re-import keeps them
server/
└── index.ts                  # unchanged: already logs and skips a room that does not restore (test added)
tests/
├── rules/                    # destiny-check, starting-cost, move-path abilities, sandbox-resume, position-warnings, epic-mirror, inspired-lead, move-reach, undo
├── game/                     # labels, move-plan, target-model, flash-model, destiny-model, favor-model, hud-model, sheet-model
├── online/, server/          # inspiredLead in lead; old room file
├── fixtures/position.ts      # restart: true
└── e2e/                      # fixes-epic, fixes-board, fixes-lead, fixes-hud, fixes-table (+ updated 001–005 specs)
```

**Structure Decision**: Keep the 005 layout. Rule changes go into the existing `src/rules` files; every new piece of view logic is a small pure module in `src/game`; `main.ts` keeps the wiring (it gains the walker, the generalised targeting and the Space key, and should lose the code that moves into the models).

## Backlog to plan

| Id | Pri | Story | Requirement | Research | Main files | Waits for |
| --- | --- | --- | --- | --- | --- | --- |
| B-01 | 1 | US3 | FR-010, FR-011, FR-012 | R-01, R-17 | `game/destiny-model.ts`, `ui/dialogs.ts`, `rules/epic.ts` | — |
| B-03 | 1 | US2 | FR-005 | R-03 | tests only | — |
| B-05 | 2 | US1, US4, US6 | FR-001, FR-014, FR-015, FR-016, FR-024, FR-025, FR-026, FR-039 | R-02, R-18, R-19, R-20 | `rules/index.ts`, `check.ts`, `destiny.ts`, `lead.ts`, `heroes/util.ts`, `game/hud-model.ts`, `flash-model.ts`, `ui/hud/check.ts`, `flashes.ts`, `ui/dialogs.ts`, `table/highlights.ts` | — |
| B-09 | 2 | US1 | FR-002 | R-04 | `data/abilities.json`, `game/sheet-model.ts`, `table/sheets.ts`, `game/save.ts` | — |
| Q-62a | — | US1 | FR-017 | R-21 | `data/abilities.json`, `rules/abilities/engine.ts`, `heroes/monk.ts`, `ui/hud/abilities.ts` | — |
| B-10 | 2 | US1 | FR-003, FR-004, FR-026 | R-05, R-20 | `rules/heroes/util.ts`, `cavalier.ts`, `abilities/engine.ts`, `ui/hud/abilities.ts` | — |
| B-11 | 4 | US1 | FR-003, FR-004 | R-05 | `rules/heroes/monk.ts` | — |
| B-02 | 3 | US4 | FR-020 | R-08 | `game/target-model.ts`, `main.ts`, `table/highlights.ts` | — |
| B-06 | 3 | US2 | FR-006, FR-009 | R-06 | `rules/sandbox.ts`, `model/state.ts`, `tests/fixtures/position.ts`, `ui/dialogs.ts`, `main.ts` | — |
| B-20 | 3 | US6 | FR-036 | R-11 | `game/hud-model.ts`, `ui/hud/badges.ts`, `phase-bar.ts`, `heroes.ts`, `setup/picks.ts` | — |
| B-07 | 4 | US5 | FR-007, FR-031 | R-07 | `rules/abilities.ts`, `rules/lead.ts`, `ui/hud/roll.ts` | — |
| B-13 | 4 | US7 | FR-040 | R-15 | `game/view-side.ts`, `main.ts`, `table/camera.ts` | — |
| B-14 | 4 | US7 | FR-041 | R-12 | `game/favor-model.ts`, `table/tracks.ts`, `coords.ts`, `ui/tracker.ts` | — |
| B-18 | 4 | US6 | FR-034 | R-11 | `ui/hud/badges.ts`, `table/sheets.ts` | — |
| B-19 | 4 | US6 | FR-035 | R-10 | `game/flash-model.ts`, `ui/hud/flashes.ts` | — |
| B-04 | 5 | US5 | FR-030 | R-11 | `game/hud-model.ts`, `ui/hud/roll.ts` | — |
| B-08 | 5 | US6 | FR-038 | R-11 | `ui/settings.ts` | — |
| B-12 | 5 | US4 | FR-022 | R-11 | `ui/setup/picks.ts`, `index.ts`, `main.ts` | — |
| B-15 | 5 | US4 | FR-023 | R-11 | `main.ts` | — |
| B-16 | 5 | US4 | FR-008, FR-021 | R-09 | `rules/heroes.ts`, `game/move-plan.ts`, `main.ts`, `table/highlights.ts` | — |
| B-17 | 5 | US6 | FR-033 | R-11 | `ui/hud/abilities.ts`, `style.css` | — |
| B-21 | 5 | US6 | FR-037 | R-11 | `game/hud-model.ts`, `ui/hud/badges.ts` | — |
| B-22 | 5 | US6 | FR-038 | R-11 | `ui/settings.ts`, `ui/hud/actions.ts` | — |
| B-23 | 5 | US7 | FR-042 | R-13 | `table/room.ts`, `data/assets.json` | — |
| B-24 | 5 | US7 | FR-043 | R-14 | `table/tts-models.ts`, `data/assets.json` | — |
| X-01, X-02 | — | US5 | FR-032 | R-11 | `game/labels.ts`, `ui/hud/roll.ts`, `game/log.ts`, `table/sheets.ts` | — |

## Phases for /speckit-tasks (guidance)

Order follows the sheet's priorities where items do not depend on each other. B-16 comes before the last part of B-10/B-11's interface work, as the sheet suggests.

1. **Foundations**
   - `game/labels.ts` with tests, and the i18n check for raw keys (X-01, X-02). Small, and every later screen uses it.
   - Test hook additions (`flashes()`, `plan()`, `panelRects()`).
   - `STATE_VERSION` + 1, `migrateState`, the "older rules" message for an imported save, a test that the server skips a room file that does not replay.
2. **US1 rules (P1)**, each from a failing test:
   - B-05: failing tests for the four cases of R-02 (the reported one stays green), then the new-check rule in `apply`, `checkingUnits`, the per-side mark, the `check` event with its units, and the four older tests that compare that event. Then `leadRefusal` and `blockedLeads` (the error code means what it says), `wouldCheckOwnKing`, and the test over all eight "Instead of Lead" abilities. Then FR-016: the `newCheck` test for every ability, from failing tests (a pushed unit that would itself check is refused; a push that opens a line is allowed), blocked targets with their reason, and a pass over the 004 ability tests it changes. Then FR-017: *Preaching* one use or both.
   - B-09 cost in data, sheet model and sheet drawing, updated 004 tests and scripted-game ledgers.
   - B-10/B-11 `heroesOnMovePath` with the start square, `abilityStatus`, reasons in the panel.
3. **US2 (P1)**: B-03 regression tests; B-06 resume point, `restart` flag, fixture and position editor; `positionWarnings` and the checkmate alert with its two choices; the tests that the in-check rule at the end of the Lead survives the trip (US2-AS10).
4. **US3 (P1)**: B-01 `destinyChoiceModel` and the dialog; browser test over all four heroes. Mirror: two queued choices with `appliesTo` in `epic.ts`, from failing tests; the dialog's "choice n of 2".
5. **US4 (P2)**: B-02 target prompt and board targeting; B-16 `moveReach`, move plan, highlights, walker; B-12 pick confirm; B-15 Space; blocked Lead squares with their message, and the own-King warning before an ability is sent (FR-024, FR-025; after the target prompt, which they build on).
6. **US5 (P2)**: B-04 automatic-success texts; B-07 rule and button.
7. **US6 (P2)**: B-20 names and badges, Range outline; B-18 health bar; B-21 icons; B-17 dock and collapse with the overlap test; B-08, B-22 Settings; B-19 flash model and layer; the "CHECK" flash and the "In check" pop-up (FR-039).
8. **US7 (P2)**: B-14 shared track, zones, menu row; B-13 view side; B-24 model turn; B-23 table model.
9. **Polish**: strings, README and CLAUDE.md (active feature, new commands none), 004 A-03 corrected, the 003 Mirror edge case and 001 User Story 6 scenario 5 corrected with pointers here, quickstart manual check, all suites green, screenshots at both sizes, redeploy the Render test site.

Phases 4–8 touch different files except `main.ts`, `style.css`, `hud-model.ts` and `strings.en.json`; within a phase, model work and its tests can run in parallel with other stories' model work.

## Risks

| Risk | Mitigation |
| --- | --- |
| The new-check rule runs after every action and could gain Destiny where it did not before (created units, reactions, unusual abilities) | That is the decided rule; the scripted games' ledgers show every changed gain in review; simulations and sandbox mode are excluded |
| The own-King warning misses a case because the result of an ability cannot be known beforehand (a roll, a later decision) | The warning is best effort by design; the "CHECK" notice, the pop-up and the Destiny gain still follow from the real result |
| FR-016 refuses ability uses that were legal until now (abilities without the symbol) | It is the existing test applied more widely, with a data flag for abilities that cannot change units; the 004 ability tests show every use that changes |
| Hover warnings do not exist on touch screens | A click on a blocked square or target shows the same text; desktop browsers are the target (constitution) |
| The "CHECK" notice (3 s) covers pieces near the King or piles up with a second check | It is small, sits above the piece, does not block clicks, and a new check on the same King restarts it instead of stacking |
| The sandbox return breaks the in-check rule at the end of the Lead | The resume copies the turn flags unchanged; US2-AS10 and a flag-kept test guard it |
| B-09 changes Destiny in every game with named heroes: many 004 tests and both scripted games change | Update expectations test by test, failing first; the ledgers in `tests/games/` make the difference visible in review |
| Old saves and running online rooms stop replaying | The loader and the server already refuse them without crashing; an imported file gets a clear message (R-04). The Render site is a test deployment, so only test rooms are lost |
| `main.ts` (750 lines) takes the walker, targeting and Space and grows hard to follow | Logic lives in `src/game` models; `main.ts` holds state and wiring only. If it passes about 900 lines, the walker and targeting move to `src/ui/board-input.ts` |
| A planned walk and "During Move" abilities or taverns surprise players | Path-based abilities (R-05); the walk never stops silently except on a wound or decision; Q-70 asks about taverns |
| The shared track and the moved strip do not fit the default view at 1366×768 | Numbers in R-12 are starting values; the screenshot test checks the strip's corners from both sides and the camera target is adjusted |
| The table model's top is not where the pieces stand, or its shape hides sheets | Scale and offset are data; the slab stays as placeholder; `tts-table.spec.ts` compares piece and sheet positions with the table top |
| Flashes are noisy | One flash per pool and reason, a cap of 4 visible with the rest queued, reduced-motion support; skipped phases as the designer decided (the three start-of-turn phases only for heroes with abilities there) |
| Space ends a phase by accident | Only when the End phase button is enabled, no dialog is open, and the key is not held; Undo crosses phases |
| The repository asks for Node 24; the checks here ran on Node 22 | Run the full suite on Node 24 before `/speckit-implement` starts |

## Follow-ups (not part of this plan)

- Write the decisions of 2026-11-11 (2 D for a new check of any kind, once per turn; 1 D per symbol; *Inspired Lead* until the roll; Mirror destinies) into `Basic Rules 2_5 - corrections.docx`.
- *Tactical Genius*: whether a discovered check made by an ability should count for it (today only a Lead's does).
- Rulebook corrections: the sentence that the "Must not check the King" rule holds for every ability (FR-016); *Preaching* one use or both (FR-017); the start square counts as in the path (FR-003).
- Add `Hero Rules 2_0.docx` to the repository, or record where it lives; CLAUDE.md names it as a rules source but the file is not there.
- A heal offered for a hero at full health (R-05): decide whether to hide it.
- Croatian strings.

## Complexity Tracking

No constitution violations to justify.
