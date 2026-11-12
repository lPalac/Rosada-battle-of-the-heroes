# Tasks: Fixes and Improvements from the First Playtests

**Input**: Design documents from `specs/006-fixes-improvements/` (spec.md, plan.md, research.md, data-model.md, contracts/, quickstart.md, backlog.md, screenshots/)

**Tests**: Required. Constitution IV and CLAUDE.md say every acceptance scenario gets a test named `US<n>-AS<m>`, written before its code. A rule fix starts from a test that fails on `main`. Scenarios with a rule or model part get a Vitest test against the headless core or the `src/game` models; scenarios that only exist on screen (layout, table, camera, clicks) get a Playwright test with the same name, as in 004 and 005 (plan, Constitution Check IV and Complexity Tracking).

**Format**: `- [ ] T### [P?] [US?] Description with file path`. [P] = can run in parallel (different files, no open dependency).

**Ids**: `B-nn` is a row of the playtest sheet (backlog.md). `R-nn` is a research entry. `FR-nnn` and `US<n>-AS<m>` are in spec.md. "Guarantee n" is in contracts/rules-api-changes.md.

**Notes for whoever implements**:
- All rule decisions are made (spec.md, Clarifications and Resolved). Do not reopen them; if code and spec disagree, the spec wins, and a real gap goes to the user as a question.
- Three cases in research.md were replayed against `main` and are the first failing tests: R-02 (King left in check; promotion with check), R-04 (*Demoralise* costs nothing), R-06 (sandbox restarts the turn). One reported case already works and must stay green: R-02 (Lead check, then *Souls Clash* uncovers the Queen), R-03 (Undo after End phase).
- When an existing 001–005 test changes its expectation, change the expectation first, see it fail, then change the code.
- `src/rules`, `src/game`, `src/online` stay engine-free (`tests/boundaries.test.ts`).
- All new text goes into `src/data/strings.en.json` with the task that needs it.
- The checks in research.md ran on Node 22; the project asks for Node 24.
- The generic Short range / Long range heroes are test-only (spec, seventh round): keep them and their behaviour exactly as they are, build nothing new for them, and keep the existing tests that use them green.

---

## Phase 1: Setup

- [X] T001 Run `npm install`, `npm test` and `npm run test:e2e` on Node 24 on this branch before any change, and write the result (files, tests, failures if any) as a short "Baseline" note at the end of specs/006-fixes-improvements/research.md
- [X] T002 [P] Extend the test hook in src/main.ts (`window.__rosada`, dev and e2e builds) with `plan()`, `flashes()`, `panelRects()`, `boardRect()` and `viewSide()` as in contracts/ui-interactions.md, returning empty values for now, and add typed helpers for them in tests/e2e/helpers.ts
- [X] T003 [P] Extend the schemas and the data check: `targetHint` (string) on the ability, and the flags `noUnitEffect` and `bothUses` (booleans, absent = false, like the existing `mustNotCheck`) in the `flags` object of src/data/schemas/abilities.schema.json; `yaw` (number, degrees) and `offsetY` (number) on mesh entries in src/data/schemas/assets.schema.json; in scripts/check-data.ts require a `hint.<targetHint>` string for every `targetHint` and a `cost` on every ability of a Starting Hero that has `uses`

## Phase 2: Foundational (blocks every story)

- [X] T004 Add the state shapes of data-model.md in src/rules/model/state.ts and src/rules/model/actions.ts with no behaviour yet: `GameState.sandboxResume: SandboxResume | null`; `TurnFlags.moveStart: Coord | null`; `TurnFlags.checkDestinyClaimed: Side[]` replacing `checkBonusClaimed: boolean`; `appliesTo: HeroId[]` on the `epicDestiny` decision; `restart?: boolean` on `setEnforcement`; `units: string[]` on the `check` event; `PositionWarning { code: 'CHECKMATE'; side: Side }`; fill the new fields in `freshTurnFlags` (src/rules/turn.ts) and `createGame` (src/rules/setup.ts), make src/rules/lead.ts use `checkDestinyClaimed` with today's behaviour (the active side only), change the one assertion on `checkBonusClaimed` in tests/rules/destiny.test.ts (line 14) to `checkDestinyClaimed` containing the side, and keep every other existing test green
- [X] T005 Raise `STATE_VERSION` to 3 in src/rules/setup.ts and extend `migrateState` in src/game/save.ts (`sandboxResume: null`, `moveStart: null`, `checkBonusClaimed: true` → `checkDestinyClaimed: [active side]` else `[]`, `appliesTo: [heroId]` on a saved `epicDestiny` decision), with tests in tests/game/save.test.ts: a version 2 save loads; a save whose replay fails throws an error whose text is the new string `save.olderRules` ("This save was made with older rules and cannot be continued")
- [X] T006 [P] Add a test in tests/server/restart.test.ts that a room file which no longer replays is logged and skipped at start and the server keeps running (research R-04; the code in server/index.ts already does this)
- [X] T007 [P] Tests then code for src/game/labels.ts in tests/game/labels.test.ts (X-01, X-02, FR-032): `modifierLabel(source, value)`, `reasonLabel(reason)`, `markLabel(kind)` return the specific string when it exists (`mod.war`), else the ability's name for an ability id, else the `effect.<kind>` string, and never a key; add a check in tests/i18n.test.ts that every ability id used as a modifier source, Destiny reason or heal reason resolves to a name

**Checkpoint**: types, save migration and labels are in place; every 001–005 test passes.

---

## Phase 3: User Story 1 – Destiny and abilities follow the rulebook (P1) 🎯 MVP

**Goal**: check Destiny for new checks of any kind, once per turn; Starting abilities cost 1 D per symbol; path abilities; the check rule for every ability; refused Leads with their own reason; *Preaching* one use or both.

**Independent test**: `npx vitest run tests/rules` is green, including the new files below; `tests/games/scripted-game-03` and `-04` replay with their updated ledgers.

### Check Destiny (FR-001, R-02)

- [X] T008 [US1] Write failing tests `US1-AS1`…`US1-AS6` and `US1-AS15` plus guarantees 23 and 23a in tests/rules/destiny-check.test.ts, using the positions of research R-02: Bishop c4→b5 check then *Souls Clash* on e4/e6 (one `check` entry, one `destroyEnemy` entry; must already pass); Rook a1→a8 on turn 1 then Rook h1→h2 on turn 3 (no gain; fails today); a Queen joining a Bishop's older check (gain); an ability-only discovered check (gain); Pawn a7→a8 promoting to a Queen that checks e8 (gain at the promotion; fails today); a side uncovering its own King (the other side gains, once per turn)
- [X] T009 [US1] Add `checkingUnits(state, side): string[]` beside `isInCheck` in src/rules/check.ts (built on `attackersOf`), with unit tests in tests/rules/check.test.ts
- [X] T010 [US1] Implement the new-check rule of contracts/rules-api-changes.md ("Check Destiny") in `apply` in src/rules/index.ts: compare `checkingUnits` of both Kings before and after every applied action in rules mode, after the action's effects and before any automatic phase change; emit `{ type: 'check', side, units }` once per King with a new checking unit; gain `DESTINY.check` (reason `check`) for the checking side unless it is in `turn.checkDestinyClaimed`; skip in sandbox mode and inside simulations; remove the gain and the `check` emit from src/rules/lead.ts (lines 263–269) but keep the *Tactical Genius* completion there (line 265: a discovered check by a Lead, unchanged by this feature)
- [X] T011 [US1] Update the tests that compare the `check` event for its `units` field and its "new checks only" meaning in tests/rules/destiny.test.ts, tests/rules/lead.test.ts, tests/rules/hero-unit.test.ts, tests/rules/royal-favors.test.ts and tests/rules/create.test.ts, and the log line for it in src/game/log.ts (name the checking units' types)

### Starting abilities cost Destiny (FR-002, R-04)

- [X] T012 [US1] Write failing tests `US1-AS7`…`US1-AS11` in tests/rules/starting-cost.test.ts: *Demoralise* pays 1 D from the Hero Pool (and from the Common Pool when the Hero Pool is empty, and by a chosen `pay` split); not offered and `NOT_ENOUGH_DESTINY` with 0 D; *Warhorse*, *Rejuvenating Stroll*, *Elusive*, *Future Sight* cost nothing; *Flaming Bolt* costs 1 D per use; no pool changes when the Epic Stage starts
- [X] T013 [US1] Set `"cost": { "normal": 1, "bloodied": 1 }` on `cavalier.demoralise`, `cavalier.tightFormation`, `monk.preaching`, `monk.makePeaceNotWar`, `scout.bearTraps`, `scout.poisonWater`, `magus.flamingBolt`, `magus.soulsClash` in src/data/abilities.json (`uses` stays)
- [X] T014 [US1] Update the 004 expectations that change with the cost, expectation first. Files that use the eight abilities: tests/rules/heroes/cavalier.test.ts, monk.test.ts, scout.test.ts, magus.test.ts, tests/rules/named-heroes.test.ts, tests/rules/abilities/engine.test.ts, effects.test.ts, targets-units.test.ts, tests/rules/sandbox.test.ts, tests/game/sheet-model.test.ts, tests/e2e/sheets.spec.ts, and tests/games/scripted-game-04.test.ts with the ledger kept inside it (scripted-game-03 uses no Starting ability; run it to confirm); also tests/rules/contract-004.test.ts. Change only the files that fail, and list each in the changed-tests list
- [X] T015 [P] [US1] Show cost and uses together in the sheet model, tests first in tests/game/sheet-model.test.ts: `AbilityRow.costText` reads "1 D · 1 of 1 left" when an ability has both, in src/game/sheet-model.ts
- [X] T016 [P] [US1] Draw a Destiny crystal on each used symbol of a Starting sheet (uses spent = `uses − usesLeft`) in src/table/sheets.ts, for the TTS overlay and the canvas sheet, and extend tests/e2e/sheets.spec.ts to read it through the test hook

### "During Move" abilities and why an ability is not usable (FR-003, FR-004, R-05)

- [X] T017 [US1] Write failing tests `US1-AS12`…`US1-AS14` and guarantee 21 in tests/rules/move-path-abilities.test.ts: *Breath* offered for a square with an enemy hero that the Dragon Lord started on, stepped onto or passed (until the Move ends), not for a friendly hero; *Rejuvenating Stroll* and *Saintly Inspiration* offered for a friendly hero on the start square or the path, also after stepping further, not for an enemy hero; the two screenshot positions (screenshots/B-10, B-11) give `noTarget`
- [X] T018 [US1] Set `turn.moveStart` to the active hero's square when the Move phase begins in src/rules/turn.ts; add `movePathSquares(state)` (`moveStart` plus `turn.movePath`, no duplicates) and `heroesOnMovePath(state)` in src/rules/heroes/util.ts; leave `turn.movePath` as it is (src/rules/heroes/monk.ts:171 and src/rules/heroes/scout.ts:301 read it as "has not moved")
- [X] T019 [US1] Use the path helpers in `dragonLord.breathOfFieryDestruction` (src/rules/heroes/cavalier.ts) and in `monk.rejuvenatingStroll` and `saint.saintlyInspiration` (src/rules/heroes/monk.ts, replacing `heroesHere`)
- [X] T020 [US1] Tests then code for `abilityStatus(state): AbilityStatus[]` in src/rules/abilities/engine.ts (exported from src/rules/index.ts), tests in tests/rules/abilities/status.test.ts: reasons `timing`, `noUses`, `usedThisTurn`, `notEnoughDestiny`, `notAsHeroUnit`, `noTarget`, `wouldCheck`, with `hint` from the ability's `targetHint`; `usable: true` exactly for the abilities `abilityOffers` lists
- [X] T021 [P] [US1] Add `targetHint` to every ability with targets in src/data/abilities.json (`enemyHeroOnPath`, `friendlyHeroOnPath`, `enemyHeroInRange`, `adjacentEnemyUnit`, …, as few distinct keys as cover them) and the strings `hint.*` and `status.*` in src/data/strings.en.json

### The own King and Leads (FR-014, FR-015, R-18)

- [X] T022 [US1] Write failing tests `US1-AS16` and guarantees 25a and 25b in tests/rules/own-king.test.ts: a pinned unit's Lead off the line is refused with `LEAD_LEAVES_KING_IN_CHECK`; a square the unit cannot move to at all is refused with `NOT_A_LEAD` (today it also gets `LEAD_LEAVES_KING_IN_CHECK`); each of the seven "Instead of Lead" abilities that Lead a unit (*Tight Formation*, *Draconic Descent*, *Crusade*, *Pilgrimage*, *Blind Faith*, *Red Carpet*, *Certainty and Death*) refuses the same way; `blockedLeads` and `legalLeadsForUnit` never share an option; `wouldCheckOwnKing` is true exactly when the applied action emits `check` for the acting side's own King, and never changes the state
- [X] T023 [US1] Implement `leadRefusal(state, unitId, to)` and `blockedLeads(state, unitId)` in src/rules/check.ts; use `leadRefusal` in `announceLead` (src/rules/lead.ts:92) and in `abilityLead` (src/rules/heroes/util.ts:82); add the error `NOT_A_LEAD` ("That unit cannot be Led there") and change the text of `LEAD_LEAVES_KING_IN_CHECK` to "That would place your King in check" in src/data/strings.en.json and the rules' error table
- [X] T024 [US1] Implement `wouldCheckOwnKing(state, action): boolean` in src/rules/index.ts (apply on a copy; false if refused) and export it with `leadRefusal`, `blockedLeads` and `checkingUnits`

### Abilities and check (FR-016, FR-026, R-19)

- [X] T025 [US1] Write failing tests `US1-AS17`, `US1-AS18` and guarantees 25c and 25d in tests/rules/ability-check.test.ts: a push without the symbol (*Terrifying Roar* or *Bushwack*) that would move a unit onto a square from which it checks either King is refused with `ABILITY_WOULD_CHECK` and that target is in `blocked`, not in `targets`; a push that moves a unit off a line so another unit checks is accepted; *Infiltrate* placing a Pawn that checks is refused, and accepted when it only opens a line; an ability that makes the turn's Lead is not tested this way
- [X] T026 [US1] Apply the existing `newCheck` test (src/rules/abilities/targets.ts:73) to every ability without `flags.noUnitEffect`, instead of only `mustNotCheck` abilities, in `runEffect` in src/rules/abilities/engine.ts; add `blocked: { targets: AbilityTarget[]; code: string }[]` to `AbilityOffer` in src/rules/abilities/types.ts and fill it in `abilityOffers`; change the text of `ABILITY_WOULD_CHECK` to "That would place a King in check"
- [X] T027 [P] [US1] Set `"noUnitEffect": true` in the `flags` of every ability in src/data/abilities.json whose effect cannot add, move, retype or remove a unit (wounds, heals, hero moves, bonuses, marks), checked against each effect in src/rules/heroes/*.ts
- [X] T028 [US1] Run the 004 ability suites (tests/rules/heroes/*.test.ts, tests/rules/abilities/*.test.ts) and fix any expectation that changes because an ability without the symbol is now refused for a direct check, expectation first

### One use or both (FR-017, R-21)

- [X] T029 [US1] Write failing test `US1-AS19` in tests/rules/both-uses.test.ts: *Preaching* with 2 uses and 2 D offers options `one` and `both`; `both` spends 2 uses and 2 D in one action and marks the unit `cannotLead` for the next turn; with 1 use or 1 D only `one` is offered; a second use in the same turn is refused (`ABILITY_USED`); a single use on a later turn still works
- [X] T030 [US1] Set `"bothUses": true` in the `flags` of `monk.preaching` and its `"oncePerTurn"` to true (false today) in src/data/abilities.json; let the engine offer the options `one` / `both` for a `bothUses` ability and charge uses and cost twice for `both` (src/rules/abilities/engine.ts); replace the "again" branch of the effect in src/rules/heroes/monk.ts:73 with the option; add the option labels to src/data/strings.en.json; update tests/rules/heroes/monk.test.ts

**Checkpoint**: US1 complete. `npx vitest run tests/rules tests/game tests/online` is green.

---

## Phase 4: User Story 2 – Undo and sandbox keep the turn (P1)

**Goal**: the Undo case of the sheet is pinned; a sandbox trip continues the turn; a checkmate is pointed out before play goes on.

**Independent test**: `npx vitest run tests/rules/undo.test.ts tests/rules/sandbox-resume.test.ts tests/rules/position-warnings.test.ts` and `npx playwright test tests/e2e/fixes-sandbox.spec.ts`.

- [X] T031 [P] [US2] Add tests `US2-AS1` and `US2-AS2` to tests/rules/undo.test.ts with a Cavalier that has *Warhorse* in After Lead: After Lead → End phase → End of Turn, `canUndo()` is true and Undo returns to After Lead with *Warhorse* offered; with a roll earlier in the turn Undo goes back to the roll and no further (these pass on `main`, research R-03) (FR-005)
- [X] T032 [US2] Write failing tests `US2-AS3`…`US2-AS7`, `US2-AS10` and guarantees 22, 23b and 25 in tests/rules/sandbox-resume.test.ts: Lead phase with Movement left 2 survives `setEnforcement` sandbox → rules; a resolved Lead stays resolved (no second Lead); an announced Lead whose unit was moved in sandbox is cancelled and its Inspired Lead bonus goes back to `turn.inspiredLeadBonus`; a square decision gets fresh options; an illegal position still fails with `POSITION_INVALID`; `restart: true` begins at Before Turn; with the own King in check, a failed Lead after the trip sets `turn.kingInCheckAfterLead` and no After Lead or End of Turn ability is offered (FR-006)
- [X] T033 [US2] Implement the resume point in src/rules/sandbox.ts as in data-model.md and research R-06: store `sandboxResume` on entering sandbox while `status` is `playing`; on `setEnforcement { mode: 'rules' }` without `restart` and with matching `turnNumber` and `activeHeroId`, put back phase, turn flags and decisions, validate the announced Lead and the decisions, recompute `leadPossible`; otherwise restart at Before Turn as today; set `sandboxResume` to null either way (FR-006)
- [X] T034 [US2] Pass `restart: true` where a fresh start is meant: in `position()` / `board()` of tests/fixtures/position.ts, and for the position editor in src/main.ts (`openPositionEditor` at line 273 marks the session; the "rules back on" dispatch at line 403 adds `restart: true` for it); confirm all 001–005 tests are unchanged
- [X] T035 [US2] Tests then code for `positionWarnings(state): PositionWarning[]` in src/rules/sandbox.ts (exported from src/rules/index.ts), tests in tests/rules/position-warnings.test.ts (rule part of `US2-AS8`, guarantee 26): `CHECKMATE` for a side exactly when `isCheckmate(state, side)`; both sides when both are mated; never changes the state (FR-009)
- [X] T036 [US2] Add the checkmate alert of contracts/ui-interactions.md (`checkmate-alert`, `checkmate-continue`, `checkmate-back`, Esc = back) in src/ui/dialogs.ts and ask it in src/main.ts before `setEnforcement { mode: 'rules' }` is sent when `positionWarnings` is not empty (a position with problems still shows the 001 problem list first); strings `dialog.checkmate.*` saying which side is checkmated and that the other side wins when the next turn begins (FR-009)
- [X] T037 [US2] Browser tests `US2-AS1`, `US2-AS3`, `US2-AS8`, `US2-AS9` in tests/e2e/fixes-sandbox.spec.ts: the Undo button is enabled after End phase from After Lead; a sandbox round trip in the Lead phase keeps phase and Movement left; the checkmate alert appears, "Back to sandbox" changes nothing, "Continue the game" turns rules on and the game ends by checkmate at the next Before Turn

**Checkpoint**: US2 complete.

---

## Phase 5: User Story 3 – A clear Epic destiny choice (P1)

**Goal**: each choice shows the hero's own forms by name and portrait; Mirror asks two choices; in Mirror the second hero picked in setup must differ from the first.

**Independent test**: `npx vitest run tests/game/destiny-model.test.ts tests/rules/epic-mirror.test.ts tests/rules/setup.test.ts` and `npx playwright test tests/e2e/fixes-epic.spec.ts`.

- [X] T038 [P] [US3] Tests then code for `destinyChoiceModel(state)` in src/game/destiny-model.ts, tests `US3-AS1`…`US3-AS4` in tests/game/destiny-model.test.ts: chooser (`heroId`, `heroName`, `side`, `playerId`), `appliesTo`, `step` / `of`, three `cards` with `formName` and `portraitKey` from `heroes.json` forms for all four named heroes (the generic test heroes: nothing new; the dialog keeps working for them as today, with the destiny names and the `epicArt` pictures, and the existing tests that use them stay green), `allowed` / `blockedBy` from `destinyOptions`, and `chosen` so far (FR-010, FR-011)
- [X] T039 [US3] Write failing test `US3-AS8` and guarantee 28 in tests/rules/setup.test.ts (FR-013): in a Mirror game, after Light picked a hero, Dark's pick of the same named hero is refused with `HERO_TAKEN` and `pickableHeroes` no longer lists it; Draft and picks of the generic test heroes are unchanged (the existing setup tests stay green). Then write failing tests `US3-AS6`, `US3-AS7` and guarantee 27 in tests/rules/epic-mirror.test.ts: in a Mirror game the Epic Stage queues two `epicDestiny` decisions; the first is for the first hero of `choiceOrder` with `appliesTo` = that hero and its twin (same `definitionId`, other side); the second is for the hero of the other definition on the other side; `decide` applies destiny and form to both and emits `destinyChosen` for each; the Fanatic / Dominant limit applies to the second choice; games with the generic test heroes, in Draft or Mirror, still ask four as in 003 (nothing new for them) (FR-012)
- [X] T040 [US3] Implement the Mirror pick rule in `pickHero` and `pickableHeroes` in src/rules/setup.ts (the second pick may not repeat the first named hero, same `heroDefinitionId`; picks of the generic test heroes untouched; error `HERO_TAKEN` with the string "That hero is already on this side"); update the comment that cites 004 Q-41 and the test name in tests/rules/named-heroes.test.ts that says Mirror allows any hero (FR-013). Then implement the Mirror queue and `appliesTo` in `maybeStartEpic` and `chooseDestiny` in src/rules/epic.ts (reads `state.setup.mode`; only when the heroes are named heroes, the generic test heroes keep the 003 queue); Draft decisions get `appliesTo: [heroId]`; add a case to tests/online/authority.test.ts that the decision belongs to the chooser's seat (FR-012)
- [X] T041 [US3] Rebuild the `epicDestiny` dialog in src/ui/dialogs.ts from `destinyChoiceModel` with the test ids of contracts/ui-interactions.md (`destiny-hero`, `destiny-step`, `destiny-<destiny>`, `destiny-<destiny>-form`, `destiny-chosen`, `destiny-applies`); strings `dialog.destinyStep`, `dialog.destinyChosen`, `dialog.destinyBoth` (FR-010, FR-011)
- [X] T042 [US3] Browser tests `US3-AS1`…`US3-AS8` in tests/e2e/fixes-epic.spec.ts: in Mirror setup, Light's hero is not offered for Dark's pick; with Cavalier, Monk, Scout and Magus, each of the four dialogs shows its hero's name, "choice n of 4", three different form names and three image sources that differ from the other heroes' dialogs, and the chosen list; a disabled card shows its reason; after the last choice sheets and hero cards show the forms; a Mirror game shows two dialogs naming both heroes; update tests/e2e/epic.spec.ts where it clicks the old dialog

**Checkpoint**: US3 complete. All P1 stories are done.

---

## Phase 6: User Story 4 – Choose on the board (P2)

**Goal**: ability targets on the board; reach, planned path and walk for the Move; reasons on hover; the own-King warning; pick confirm; Space.

**Independent test**: `npx vitest run tests/rules/move-reach.test.ts tests/game/target-model.test.ts tests/game/move-plan.test.ts` and `npx playwright test tests/e2e/fixes-board.spec.ts`.

### Ability targets on the board (FR-020, R-08)

- [X] T043 [P] [US4] Tests then code for `targetPrompt(offer, option)` in src/game/target-model.ts, tests in tests/game/target-model.test.ts (model part of `US4-AS1`, `US4-AS2`): steps of board picks for square, unit and hero targets (a unit or hero is picked by its square), later steps filtered by earlier picks, `fallback: 'dialog'` for a `unitType` target, blocked picks with their reason code from `AbilityOffer.blocked` (FR-020)
- [X] T044 [US4] Generalise `targeting` in src/main.ts from `{ kind: 'retreat' }` to `{ abilityId, option, step, chosen }` driven by `targetPrompt`; `useAbilityFromPanel` opens the prompt instead of `dialogs.choose` whenever every target is on the board; show `target-help` with the ability's name and `target-cancel`; Esc cancels; Hero Retreat becomes one prompt of this kind; draw the picks with kind `target` and blocked picks with kind `blocked` in src/table/highlights.ts (FR-020)

### Reach, planned path and walk (FR-008, FR-021, R-09)

- [X] T045 [US4] Tests then code for `moveSquaresFrom(state, hero, pos)` and `moveReach(state): Reach[]` in src/rules/heroes.ts, tests in tests/rules/move-reach.test.ts (guarantees 19, 20): every square within the Movement left with a shortest `path` and `canEnd`; Smuggler's Grotto squares; ties broken by fewest squares with a visible enemy square token, then straight before diagonal; a property test over the fixtures that every `path` is accepted step by step by `moveStep`; `legalMoveSquares` becomes a call to `moveSquaresFrom` (FR-008)
- [X] T046 [P] [US4] Tests then code for src/game/move-plan.ts in tests/game/move-plan.test.ts (model part of `US4-AS4`, `US4-AS5`, `US4-AS8`): `extendPlan(state, plan, to)` appends the shortest path from the plan's end, a square outside the reach clears the plan, `planLeft`, `planReach` (squares reachable from the plan's end with what is left)
- [X] T047 [US4] Return `reach` (kinds `move` and `pass` by `canEnd`) in the Move phase from `highlights()` in src/game/hud-model.ts and draw `move`, `pass` and the planned `path` (a line with step numbers) in src/table/highlights.ts; show "Movement left: n" for the plan in the help line (FR-021)
- [X] T048 [US4] Plan and walk in src/main.ts: a click on a reachable square extends the plan; a click on the plan's last square walks it; Esc or any other square clears it; the walker sends one `moveStep` per square, the next after the previous one arrived and its move animation ended (about 150 ms; no delay in e2e builds), and stops on a refused step, an open decision or a wound; other input is blocked during a walk; the same loop serves hot-seat and online; fill `plan()` in the test hook (FR-021)

### Reasons on hover and the own-King warning (FR-024, FR-025, FR-026, R-18, R-20)

- [X] T049 [US4] Return `blocked` Lead squares for the selected unit from `highlights()` in src/game/hud-model.ts (from `blockedLeads`), with tests in tests/game/hud-model.test.ts (a new file; today's HUD model tests are in tests/rules/bloodied.test.ts and stay there); report the square under the pointer from src/table/picking.ts; add a small tooltip module src/ui/hud/tooltip.ts (`board-tooltip` at the pointer) and show the reason on hover of a blocked Lead square or blocked ability target, and the same text on click, in src/main.ts (FR-025, FR-026)
- [X] T050 [US4] Ask `wouldCheckOwnKing` in src/main.ts before any `useAbility` (hero ability, general ability, Legendary Power action) is sent, and show the warning of contracts/ui-interactions.md (`own-check-warning`, `own-check-continue`, `own-check-undo`, Esc = Undo) in src/ui/dialogs.ts; Undo sends nothing and drops the chosen targets; strings `dialog.ownCheck.*` (FR-024)

### Pick confirm and Space (FR-022, FR-023)

- [X] T051 [P] [US4] Two-click hero pick: `renderPicks(setup, onPick, pendingId, setPending)` in src/ui/setup/picks.ts marks the card clicked once (`data-pending`, `pick-confirm-hint` with string `setup.confirmPick`) and picks on the second click of the same card; hold the pending id in the wizard (src/ui/setup/index.ts) and in `renderOnlinePicks` (src/main.ts:497) (FR-022)
- [X] T052 [US4] Bind Space to End phase in the `keydown` handler of src/main.ts under the conditions of contracts/ui-interactions.md (End phase enabled, this seat's move, no dialog / Settings / tracker open, no walk or roll running, target not a field, `event.repeat` false; `preventDefault`; a shown plan is dropped first) (FR-023)

### Browser tests

- [X] T053 [US4] Browser tests `US4-AS1`…`US4-AS14` in tests/e2e/fixes-board.spec.ts through the test hook (`highlighted()`, `plan()`): *Warhorse* highlights squares and opens no list; a two-part target; reach, plan, grow, walk, double click, clear, a walk stopped by a Bear Trap; pick confirm in hot-seat; Space (enabled, disabled, dialog open, held); the own-King warning with Continue and Undo; a blocked Lead square on hover and click; an ability row's reason on hover
- [X] T054 [US4] Update the existing browser tests for the new clicks, expectation first: hero moves by plan and walk in tests/e2e/helpers.ts, tests/e2e/turn.spec.ts, tests/e2e/quickstart.spec.ts and tests/e2e/shared-squares.spec.ts; two-click picks in tests/e2e/setup.spec.ts, tests/e2e/heroes.spec.ts and tests/e2e/online.spec.ts

**Checkpoint**: US4 complete.

---

## Phase 7: User Story 5 – The Lead prompt (P2)

**Goal**: no "No roll needed"; Inspired Lead at the roll; names instead of keys.

**Independent test**: `npx vitest run tests/rules/inspired-lead.test.ts tests/game/hud-model.test.ts` and `npx playwright test tests/e2e/fixes-lead.spec.ts`.

- [X] T055 [US5] Write failing tests `US5-AS2`…`US5-AS4` and guarantee 24 in tests/rules/inspired-lead.test.ts: `inspiredLead` is legal in the Lead phase before a Lead is announced and after it is announced until the roll, once per turn; after the announcement the bonus is added to `turn.lead.modifiers`; when `1 + sum ≥ target` the Lead resolves as a success in the same action; refused after the roll and after a use in Before Lead; the announced unit and square never change (FR-007)
- [X] T056 [US5] Implement it in src/rules/abilities.ts (`inspiredLead`, `canInspiredLead`) and src/rules/lead.ts (recompute `needsRoll`, resolve), list it in `legalActions` in src/rules/index.ts for the Lead phase, and add a case to tests/online/room-play.test.ts that the active hero's seat may send it during the Lead phase (FR-007)
- [X] T057 [P] [US5] Tests then code in tests/game/hud-model.test.ts (created in T049) and src/game/hud-model.ts (`US5-AS1`, `US5-AS5`): `lead.auto` = `king` | `peace` | `ability` | `cannotFail` | null, and `lead.modifierLabels` from `modifierLabel` (T007) (FR-030, FR-032)
- [X] T058 [US5] Lead panel in src/ui/hud/roll.ts: `lead-auto` with the string `lead.auto.<reason>` instead of `lead.noRoll` (remove that string); the line built from `modifierLabels`; `inspired-lead-roll` next to `roll-button` while the roll is awaited and `can.inspiredLeadMax > 0`; show the action bar's `inspired-lead` only in Before Lead (src/ui/hud/actions.ts) (FR-030, FR-031)
- [X] T059 [P] [US5] Use `reasonLabel` for Destiny and heal reasons in src/game/log.ts and `markLabel` for the marks drawn on hero sheets in src/table/sheets.ts (X-02) (FR-032)
- [X] T060 [US5] Browser tests `US5-AS1`…`US5-AS5` in tests/e2e/fixes-lead.spec.ts: a Peace Lead shows its reason and never "No roll needed"; with War, *Bear Traps* and *Future Sight* the line reads names; Inspired Lead at the roll adds +2 per D and can make the Lead succeed without a roll; the button is gone after the roll

**Checkpoint**: US5 complete.

---

## Phase 8: User Story 6 – A readable HUD (P2)

**Goal**: docked ability panel with the phase box; health bar; names, badges and Hero Unit icons; Settings; flashes; check warnings.

**Independent test**: `npx vitest run tests/game` and `npx playwright test tests/e2e/fixes-hud.spec.ts` at 1920×1080 and 1366×768.

- [X] T061 [US6] Tests then code in tests/game/hud-model.test.ts (created in T049) and src/game/hud-model.ts: `heroes[].name` always filled for named heroes (hero or Epic form name; the generic test heroes keep today's text, nothing new); `heroes[].heroUnitIcons = { types, unlocked }` (the hero's `heroUnitType`, plus `rook` with *Advanced Warfare*; `unlocked` from `unlockedPowers`); `Highlights.range` (squares in the active hero's Range in the Lead phase); `inCheck: Side[]`; `abilityStatus` passed through (`US6-AS6`…`US6-AS8`, `US6-AS12` model parts) (FR-036, FR-037, FR-039)
- [ ] T062 [US6] New src/ui/hud/badges.ts: Movement and Range badges with the `legend.movement` / `legend.range` icons; the health bar (18 px, red track, green fill = health / max, "6/8" centred in white with a dark outline, `aria-label` "Health 6 of 8"); Hero Unit icons (`token.ring.knight` / `.bishop` image, a chess glyph for the Rook, dimmed until unlocked); use them in src/ui/hud/heroes.ts (`hero-<id>-move`, `-range`, `-health`, `-unit-icons`) and src/ui/hud/phase-bar.ts (`active-hero` as "H1 · Cavalier (Light)", `active-movement`, `active-range`), with styles in src/ui/style.css (FR-034, FR-036, FR-037)
- [ ] T063 [P] [US6] Remove "Short range" / "Long range" for named heroes from the setup cards (src/ui/setup/picks.ts: Movement, Range and Health badges and the Hero Unit icon instead) and from the strings they used; the generic test heroes keep exactly what they show today (no badges or icons built for them; keep the strings they use) (FR-036)
- [ ] T064 [P] [US6] Draw the same green / red health bar with the numbers instead of the "7/8" tag on the TTS sheet overlay in src/table/sheets.ts (the canvas sheet keeps its per-point track) (FR-034)
- [ ] T065 [P] [US6] Draw `Highlights.range` as an outline (kind `range`) in the Lead phase in src/table/highlights.ts
- [ ] T066 [US6] Dock the ability panel on the right between the pools and the log in src/ui/hud/abilities.ts and src/ui/style.css: own scroll; `ability-panel-toggle` header with the hero or form name and "n usable"; `ability-panel-phase`, a small light green box with the current phase, visible also when collapsed; collapse state in `localStorage` key `rosada.ui.abilities` (helpers in src/ui/storage.ts), starting collapsed below 1500 px width; each row shows cost and uses and, for a row without a Use button, its `abilityStatus` reason as a tooltip on hover and keyboard focus (`ability-<id>-status`); *Preaching* shows `use-monk.preaching-one` and `use-monk.preaching-both`; fill `panelRects()` and `boardRect()` in the test hook (FR-033, FR-004, FR-026)
- [ ] T067 [P] [US6] Settings in src/ui/settings.ts: the last button is `settings-resume` with string `settings.resume` ("Resume game"); add `offer-draw` (enabled from `can.offerDraw`, closes Settings) to the hot-seat and the online menu; remove Offer draw from src/ui/hud/actions.ts (FR-038)
- [X] T068 [P] [US6] Tests then code for `flashesFor(events, state): Flash[]` in src/game/flash-model.ts, tests in tests/game/flash-model.test.ts (model part of `US6-AS4`, `US6-AS11`): `wound`, `heal` (amount > 0), `destroyed`, `ability`, `roll` (value, total, success or fail), `leadFailed`, `check` (with the checked side), `destiny` summed per pool and reason with the reason in the text (`epicSplit` left out), and one `skipped` per phase the game passed by itself ("Phase 'Before Lead' skipped"; for the Lead phase with "no Lead possible"), where Before Turn, Beginning of Turn and Before Move are included only when the active hero has an ability with that timing in `abilities.json` (FR-035)
- [ ] T069 [US6] New src/ui/hud/flashes.ts and styles in src/ui/style.css: a flash appears, stays 0.5 s, moves to the log panel's position and fades (about 0.4 s); starts 120 ms apart; at most 4 visible, the rest queued; no slide with `prefers-reduced-motion`; no animation time in e2e builds; call it from `onChange` in src/main.ts after the die has landed; fill `flashes()` in the test hook; strings `flash.*` (FR-035)
- [ ] T070 [US6] The "CHECK" notice (`check-flash`, `data-side`) in src/ui/hud/flashes.ts: on a `check` flash it appears above the checked King, placed from the King's square with `picker.screenOf` every frame while it shows, blinks three times of one second each (steady for three seconds with reduced motion), takes no clicks, and a new check on the same King restarts it; string `check.flash` (FR-039)
- [ ] T071 [US6] New src/ui/hud/check.ts: the "In check" pop-up (`in-check-<side>`) directly above the ability panel for every side in `HudModel.inCheck`, in the side's colour, focusable, with `in-check-rule` on hover and focus showing "If your King is in check at the end of your Lead, you cannot use After Lead nor End of Turn abilities that turn."; strings `check.badge`, `check.rule`; mount it in src/main.ts (FR-039)
- [ ] T072 [US6] Browser tests `US6-AS1`…`US6-AS12` in tests/e2e/fixes-hud.spec.ts at 1920×1080 and 1366×768: no rectangle of `panelRects()` contains a point inside `boardRect()` with the default camera from either side (SC-004); collapse, reopen, reload keeps the choice, the phase box follows the phase; health bar widths and text; names and badges, no "Short range"; Range outline in the Lead phase; Hero Unit icons dim then lit; "Resume game" and Offer draw in Settings (hot-seat and online); `flashes()` after a wound, a roll, an ability and a Destiny gain; skipped-phase messages (none of the three start phases for a Dragon Lord; "Before Move" for a Cavalier whose *Demoralise* is spent); `check-flash` above the King; the "In check" pop-up with its rule and its removal when the check ends; update any existing browser test that clicks the old ability panel (no existing browser test uses `offer-draw` or `settings-close`)

**Checkpoint**: US6 complete.

---

## Phase 9: User Story 7 – The table (P2)

**Goal**: own-side camera online; one shared Royal Favor track; the TTS table model; units turned.

**Independent test**: `npx vitest run tests/game/favor-model.test.ts tests/game/view-side.test.ts` and `npx playwright test tests/e2e/fixes-table.spec.ts`.

- [ ] T073 [P] [US7] Tests then code for `viewSide(state, seat)` in src/game/view-side.ts, tests in tests/game/view-side.test.ts (`US7-AS1` model part): online it is the local seat's side for every seat type (a 3-player seat with both heroes of a side sees that side); in hot-seat the active hero's side (FR-040)
- [ ] T074 [US7] Use `viewSide` in `onChange` in src/main.ts: call `camera.setSide` only when the value changes, so a player's own orbiting is kept; Reset camera returns to that side (src/table/camera.ts); fill `viewSide()` in the test hook (FR-040)
- [ ] T075 [P] [US7] Tests then code in tests/game/favor-model.test.ts and src/game/favor-model.ts (`US7-AS4`): `shared = { slots: 11, light, dark, powers }` with each count capped at 11; the per-side `track` and its 16 slots stay for the lists (FR-041)
- [ ] T076 [US7] One vertical shared track in src/table/tracks.ts (1.2 × 8.4 squares, centre x = −6.1 squares, slot 1 at Light's end, numbers and the power names at 6…11 drawn once for each seat, Light's gold marker in the half of the slot nearer Light, Dark's purple marker in the other half) replacing the two per-side tracks; move `ZONES.graveyard` and `ZONES.well` from x = −7.2 to x = −8.6 squares in src/table/coords.ts; remove `seatPose(side, 'track')` from src/table/sheets.ts; `tableElements().track = { slots: 11, light, dark }` in src/main.ts; adjust the camera target in src/table/camera.ts only as far as the screenshot test needs (research R-12: the numbers are starting values) (FR-041)
- [ ] T077 [P] [US7] Replace the two 16-slot rows in the Royal Favor menu with one `tracker-shared` row (11 slots, `data-light`, `data-dark`, both markers) in src/ui/tracker.ts; keep `tracker-light` and `tracker-dark` lists; string `track.shared` (FR-041)
- [ ] T078 [P] [US7] Turn the unit models: `"yaw": 180` on the twelve `unit.<side>.<type>` mesh entries in src/data/assets.json; apply the model's `yaw` inside its holder in src/table/tts-models.ts and turn `colliderPoints` the same way; write the field in scripts/import-tts-assets.ts so a re-import keeps it; placeholders are not turned; `yawOf(side)` in src/table/pieces.ts is unchanged (FR-043)
- [ ] T079 [US7] Show the TTS table model in src/table/room.ts: load `tts.table` after the first frame, scale it evenly (start about 0.58) so its top covers the sandbox rim area, place the top at the slab's height, lower the floor to the legs' feet; keep the drawn slab until the model has loaded and with `?placeholders`; `scale`, `offsetY`, `yaw` on the `tts.table` entry in src/data/assets.json; `tableElements().ttsTable`; the sandbox keeps its flat collider and rim (FR-042)
- [ ] T080 [US7] Browser tests `US7-AS1`…`US7-AS7` in tests/e2e/fixes-table.spec.ts: online, each client's `viewSide()` stays its own side over two turns and after orbiting; one track with both markers (Light 2, Dark 1; both on one slot); the strip's four corners inside the viewport at 1366×768 from both sides; the menu's shared row; `ttsTable` true after load and false with `?placeholders`; units turned (compare a model's world direction with `main`'s through the hook); screenshots at both sizes; update tests/e2e/table.spec.ts, tests/e2e/tracker.spec.ts, tests/e2e/tts-table.spec.ts and tests/e2e/sandbox-physics.spec.ts for the moved zones and the removed `tracks`

**Checkpoint**: US7 complete. All stories are done.

---

## Phase 10: Polish

- [ ] T081 [P] Go through src/data/strings.en.json: every new key of data-model.md exists, `lead.noRoll` and unused "Short range" keys are gone, and tests/i18n.test.ts passes (every used key exists, every error code has a text, no ability falls through to a key) (FR-051)
- [ ] T082 [P] Correct the earlier specs with one-line pointers to this feature: 004 A-03 (symbols are uses and cost 1 D), Q-50 (*Preaching*) and Q-41 / FR-003 (in Mirror the two heroes of a side differ) in specs/004-named-heroes/spec.md; the Mirror edge case in specs/003-epic-stage/spec.md; User Story 6 scenario 5 (sandbox resume) in specs/001-standard-rules-game/spec.md
- [ ] T083 [P] Write specs/006-fixes-improvements/rulebook-corrections.md: the sentences to add to `Basic Rules 2_5 - corrections.docx`, one per decision of 2026-11-11 (2 D for a new check of any kind, once per turn per side, also when a side uncovers its own King; 1 D per Destiny symbol; *Inspired Lead* until the roll; Mirror: the two heroes of a side differ, and the Epic destinies are chosen once per hero for both sides; "Must not check the King" for every ability, discovered checks allowed; *Preaching* one use or both, once per turn; the start square counts as in the path; sandbox return and the checkmate alert)
- [ ] T084 [P] Update README.md (controls: Space, plan and walk, hover reasons; Settings) and CLAUDE.md (active feature 006, the new `src/game` modules, the rule that `turn.movePath` keeps meaning "squares entered")
- [ ] T085 Run tests/e2e/perf.spec.ts with the table model and the reach highlights and confirm first load ≤ 10 s and about 60 fps (SC-006); if the table model costs too much, load it later or lower its texture size in src/table/room.ts
- [ ] T086 Run `npm test` and `npm run test:e2e` in full; every acceptance scenario of spec.md has a test named `US<n>-AS<m>` (list any that is missing and add it) (FR-050)
- [ ] T087 Walk through the manual check table of specs/006-fixes-improvements/quickstart.md in the browser, save the screenshots of T072 and T080, and compare them with specs/006-fixes-improvements/screenshots/

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (1)** → **Foundational (2)** → the stories.
- **US1, US2, US3** (P1) need only Phase 2 and can go in any order; do US1 first, because its data and engine changes touch the most tests.
- **US4** needs US1 for T049 and T050 (`blockedLeads`, `AbilityOffer.blocked`, `wouldCheckOwnKing`) and for the ability reasons (T020).
- **US5** needs T007 (labels); its rule part (T055, T056) is independent.
- **US6** needs US1 (`check` event, `abilityStatus`, *Preaching* options), T007, and for T070 the flash layer of T069; its other tasks are independent.
- **US7** needs only Phase 2.
- **Polish (10)** after the stories that are wanted.

### Inside a story

- The test task comes before its code task and must fail first (except where a note says the case already passes).
- T010 before T011; T013 before T014; T018 before T019; T023 before T024; T026 before T028; T033 before T034; T039 before T040; T045 before T046…T048; T043 before T044; T068 before T069 before T070.
- Tasks that touch src/main.ts are not parallel with each other: T002, T034, T036, T044, T048, T049, T050, T051, T052, T069, T071, T074, T076.
- Tasks that touch src/data/abilities.json are not parallel with each other: T013, T021, T027, T030.

### Parallel opportunities

- Phase 1: T002, T003. Phase 2: T006, T007 beside T004 → T005.
- US1: T015, T016 beside T014; T021 beside T020; T027 beside T025.
- After Phase 2, the model tasks of different stories are in different files and can run together: T038 (US3), T043 and T046 (US4), T057 (US5), T068 (US6), T073 and T075 (US7).
- US6: T063, T064, T065, T067 beside T062. US7: T077, T078 beside T076.

## Parallel Example: models after Phase 2

```text
Task: "T038 destinyChoiceModel in src/game/destiny-model.ts with tests/game/destiny-model.test.ts"
Task: "T043 targetPrompt in src/game/target-model.ts with tests/game/target-model.test.ts"
Task: "T046 move plan in src/game/move-plan.ts with tests/game/move-plan.test.ts"
Task: "T068 flashesFor in src/game/flash-model.ts with tests/game/flash-model.test.ts"
Task: "T073 viewSide in src/game/view-side.ts with tests/game/view-side.test.ts"
Task: "T075 shared track in src/game/favor-model.ts with tests/game/favor-model.test.ts"
```

## Implementation Strategy

### MVP first: the rules (US1)

1. Phases 1 and 2.
2. Phase 3 (US1). Stop and check: `npx vitest run tests/rules tests/game tests/online`; play one hot-seat game and watch the Destiny pools.
3. This alone fixes what changes who wins (check Destiny, free Starting abilities).

### Then in the sheet's order of priority

4. US2 and US3 (the other priority 1 and 2 rows): Undo test, sandbox, Epic choice. Stop and check with quickstart rows 10, 13, 13a, 13b, 18, 18a.
5. US4 (board), US5 (Lead prompt), US6 (HUD), US7 (table). Each ends with its own browser spec; stop after each and look at the game.
6. Polish.

### Notes

- Commit after each task or small group; never commit with a red suite.
- Mark a task `[X]` only when its tests pass.
- Layout numbers in T066, T076 and T079 are starting values; the browser tests and screenshots decide.
- If a task turns out to need a rule the spec does not give, stop and ask; do not pick one.
