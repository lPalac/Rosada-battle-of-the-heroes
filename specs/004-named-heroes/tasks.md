---

description: "Task list for 004-named-heroes"
---

# Tasks: Named Heroes, Epic Forms and the Tabletop Simulator Look

**Input**: Design documents from `/specs/004-named-heroes/`

**Prerequisites**: plan.md, spec.md (with Clarifications), research.md (R-01…R-13), data-model.md, contracts/abilities-data.md, contracts/rules-api-changes.md, contracts/tts-assets.md, quickstart.md

**Tests**: Required. Constitution IV and spec FR-030: every acceptance scenario has an automated test named `US<story>-AS<scenario>`, and every ability has a main-effect test and a refusal test named `US3-<form>-<ability>` (Starting Hero abilities: `US2-<hero>-<ability>`). Write each group's tests first and see them fail.

**Organization**: By user story, in dependency order:
- Setup (asset import, data) → Foundational (model, ability engine core);
- then US4 shared mechanisms → US1 named heroes in setup → US2 starting abilities → US3 Epic forms, one hero at a time;
- then US5 sheets → US6 TTS pieces and table → Polish.

US6's asset import is in Setup because the sheets need its images.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story from spec.md (US1…US6)
- Paths are from the repository root

## Ground rules for every task

- `src/rules/` and `src/game/` stay engine-free; state changes only through `apply` (constitution II).
- Hero Rules 2_0 is the source of truth (spec FR-001a). Costs, values, timings and text go in `src/data/abilities.json`, never as literals in effect code (III). Each ability's numbers are in research R-11 / R-13 and in `Hero Rules 2_0.docx`.
- "X/Y" = normal / Bloodied (Q-39); "a/b" values in the text are `[normal, bloodied]` pairs.
- Rule gaps: use the spec Open Questions defaults (Q-39, Q-40b, Q-42…Q-46); add a new row instead of inventing a rule (I).
- All 001–003 tests stay green after every task. Generic heroes behave exactly as in 003 (contract guarantee 18).

---

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 Add `sharp` as a devDependency in package.json (dev-only, research R-09); no runtime dependency changes
- [ ] T002 Write scripts/import-tts-assets.ts per contracts/tts-assets.md, using the mapping table from research R-10:
  - kinds: sheet, portrait, texture, normal, mesh, collider, board, token, sky;
  - sizes as in the contract's budget;
  - it prints the `assets.json` entries.

  View the "to sort at import" files (`Custom_Token__Image__*`, `<Hero>_Custom_Token__*`, `Custom_Model__*`, `Custom_Tile__Image__22e7d5/fff643/556301/fef92d`, `ImageBack__176642`, the four portraits per hero) and name the ones the game uses. Unused files are not copied.
- [ ] T003 Run the import into `public/tts/` and check that the folder is ≤ 30 MB (tts-assets.md budget); commit the output
- [ ] T004 [P] Extend src/data/schemas/assets.schema.json with `mesh`, `texture`, `normal`, `collider`, and merge the `tts.*`, `sheet.*`, `portrait.*`, `bar.*`, `pool.*`, `token.ability.*`, `marker.auxiliary.*`, `legend.*` and `room.sky` keys into src/data/assets.json. Existing 001–003 keys keep their placeholders as fallback
- [ ] T005 [P] Create src/data/abilities.json and src/data/schemas/abilities.schema.json per contracts/abilities-data.md, with every ability of the 4 heroes and 12 forms:
  - 12 starting abilities (spec US2);
  - the Epic form lists in research R-11 and R-13 (the Cultist has 7);
  - 001's Inspired Lead and Hero Retreat as general abilities.

  Numbers come from Hero Rules 2_0, and `sheet.printedCost` from the TTS sheet where it differs (R-11).
- [ ] T006 [P] Extend src/data/heroes.json (and schema) with `cavalier`, `monk`, `scout`, `magus` per data-model.md:
  - stats from research R-08 and `heroUnitType`;
  - `selectable: true`, and `false` on the generic heroes (Q-42);
  - `art`, starting `abilities`, and `forms.{fanatic,resolute,dominant}` with id, name, art and abilities;
  - Dragon Lord `stats.movement: 6`.
- [ ] T007 Extend scripts/check-data.ts with the cross-file rules 1, 3, 4, 5, 6 and 7 of contracts/abilities-data.md
- [ ] T008 [P] Add strings to src/data/strings.en.json:
  - names for heroes and forms (`hero.<id>.name`, `form.<id>.name`);
  - `ability.<id>.name` / `.text` for every ability;
  - timing names (`timing.<id>`);
  - effect and token names (`effect.<kind>`);
  - the new `error.*` codes from contracts/rules-api-changes.md;
  - setup labels.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T009 Extend the model in src/rules/model/*.ts per data-model.md:
  - `GameState.effects`, `abilityState`, `nextEffectId`;
  - `Hero.form`;
  - `Unit.tags`, `health`, `modifiedFrom`;
  - `Modifier.source: string`;
  - `PendingDecision` `reaction` and `abilityChoice`, with their `DecisionAnswer`s;
  - actions `useAbility` and `pickHero { heroDefinitionId }`;
  - events `effectAdded`, `effectRemoved`, `unitModified`, `unitPushed`.
- [ ] T010 Defaults in src/rules/setup.ts (empty effects; `abilityState` with uses from data) and `migrateState` in src/game/save.ts for 003 saves; test with a 003-shaped save in tests/game/save.test.ts
- [ ] T011 Load abilities in src/rules/data.ts (`ABILITIES`, `abilityDefinition(id)`, `heroForm(state, heroId)`)
- [ ] T012 [P] Write tests/rules/abilities/engine.test.ts for the engine core (research R-01, R-03):
  - offers per timing window;
  - cost normal vs Bloodied;
  - uses per game; once per turn;
  - `notAsHeroUnit`, Unconscious (Q-45), payment split (001);
  - "Instead of Lead" counts as the Lead attempt;
  - phases rest while an ability is usable;
  - contract guarantees 13 and 16.
- [ ] T013 Implement src/rules/abilities/engine.ts:
  - `abilityOffers`, `abilityCost`, `useAbility` validation and payment;
  - use and once-per-turn tracking, the effect dispatch table `src/rules/heroes/index.ts` (empty map first);
  - the timing hooks in src/rules/turn.ts (rest when an ability is usable);
  - the `useAbility` branch in src/rules/index.ts `dispatch` and `legalActions`.
- [ ] T014 Port 001's Inspired Lead and Hero Retreat in src/rules/abilities.ts onto the engine (kept as action aliases, contract); all 001 ability tests unchanged
- [ ] T015 [P] Implement src/rules/abilities/targets.ts:
  - adjacent, in range, unoccupied, not royalty, starting square of its type, in the enemy's Royal Rank, same file;
  - "Must not check the King" except discovered checks (FR-014; the 003 `isDiscoveredCheck`);
  - unit tests in tests/rules/abilities/targets.test.ts.
- [ ] T016 Add a Vitest test in tests/rules/abilities/coverage.test.ts that every `abilities.json` id has an implementation in src/rules/heroes/index.ts and the other way round (contracts/abilities-data.md rule 2). It is expected to fail until Phase 6 is done; mark its per-form checks `todo` until each form lands

**Checkpoint**: `npm test` green (coverage test todo); 001–003 unchanged; the engine offers the general abilities

---

## Phase 3: User Story 4 – Marks, tokens, Modify and Push (Priority: P1)

**Goal**: The shared mechanisms every hero ability uses (research R-04…R-07)

**Independent Test**: A cannot-Lead mark, a square token with a Lead modifier, and a Modify that expires at the end of the next turn, visible in the HUD model and log, undone and replayed (spec US4)

### Tests for User Story 4 (write first, must fail) ⚠️

- [ ] T017 [P] [US4] Write tests/rules/abilities/effects.test.ts:
  - `US4-AS1`: a cannot-Lead mark removes Lead targets, and checkmate / no-eligible-units treat the unit as unable to move (Q-43);
  - `US4-AS2`: a square token is shown in the state, affects paths and Leads, and is removed on its condition;
  - `US4-AS3`: a Modify changes type for paths, threats and generation, then returns to `originalType`;
  - `US4-AS4`: a Push moves one unoccupied square, or not at all when blocked;
  - `US4-AS5`: log, undo and replay (guarantee 17);
  - edge cases: a Destroyed, Promoted or removed target drops its effects; expiries at each `expires.at` (guarantee 14).
- [ ] T018 [P] [US4] Write tests/rules/abilities/modifiers.test.ts: built-in modifiers unchanged (001/003 values), a unit penalty, an aura near a hero, a path-adjacent penalty, Bloodied pairs, the Q-24 no-roll rule over the new total, and `noRoll` effects

### Implementation for User Story 4

- [ ] T019 [US4] Implement src/rules/abilities/effects.ts:
  - `addEffect`, `removeEffect`, `activeEffects`;
  - expiries at phase boundaries (call sites in src/rules/turn.ts);
  - target clean-up on Destroy, Promotion and leaving play (src/rules/lead.ts, src/rules/sandbox.ts);
  - Modify (`modifiedFrom`) and Push helpers.
- [ ] T020 [US4] Implement src/rules/abilities/modifiers.ts and switch `computeModifiers` in src/rules/lead.ts to it (research R-05). `leadPreview` shows every modifier with its text key
- [ ] T021 [US4] Add the core hook points of research R-06 to src/rules/paths.ts, src/rules/check.ts, src/rules/lead.ts, src/rules/ram.ts and src/rules/heroes.ts:
  - `pathFilter`, `leadBlocked`, `onBattle`, `onDestroyed`, `onWound`, `onLeadPath`, `onEndOfTurn`.

  With no effects registered, every 001–003 test is unchanged.
- [ ] T022 [US4] Implement the reaction decision flow for "During Enemy Lead" in src/rules/abilities/engine.ts and src/rules/lead.ts: raise a `reaction` decision at announce, Battle or destroy (research R-03), and continue the Lead after the answer; test in tests/rules/abilities/engine.test.ts
- [ ] T023 [US4] Implement special units in src/rules/abilities/units.ts (research R-07):
  - the `undead`, `legendaryAncient` (5 health, King-like path, 1 wound per Lead, Banishment and Verdict) and `demon` (King-like path, Battle only, no generation) tags;
  - src/rules/generation.ts skips the `demon` tag;
  - tests in tests/rules/abilities/units.test.ts.
- [ ] T024 [US4] Make T017–T018 pass

**Checkpoint**: Shared mechanisms done; `US4-*` pass; 001–003 green

---

## Phase 4: User Story 1 – Pick a named hero (Priority: P1)

**Goal**: Setup with Cavalier, Monk, Scout and Magus; Epic forms from destiny

**Independent Test**: Draft the four heroes and check stats, Hero Unit types and first-turn ability offers (spec US1)

### Tests for User Story 1 (write first, must fail) ⚠️

- [ ] T025 [P] [US1] Write tests/rules/named-heroes.test.ts:
  - `US1-AS1`: the four heroes with their stats;
  - `US1-AS2`: the Hero Unit type comes from the hero (Scout → Knight, Monk → Bishop);
  - `US1-AS3`: the HUD and sheet models list name, stats and abilities with cost, timing and uses;
  - `US1-AS4`: generic heroes are not selectable but still load in fixtures;
  - FR-003: Draft refuses the same hero twice, Mirror gives both sides the same heroes;
  - US3-AS1: the destiny sets `hero.form` (Cavalier + Fanatic → Death Knight).
- [ ] T026 [P] [US1] Write tests/e2e/heroes.spec.ts: Draft through the UI picks named heroes (cards with portrait and range type); in Draft a picked hero is disabled for the other side

### Implementation for User Story 1

- [ ] T027 [US1] Named-hero picks in src/rules/setup.ts and src/rules/index.ts (`pickHero { heroDefinitionId }`; `rangeType` derived; Draft uniqueness, Mirror copy); src/rules/epic.ts sets `hero.form` and the form's stats (Dragon Lord Movement 6)
- [ ] T028 [US1] Fixture options in tests/fixtures/position.ts: `heroDefs` (heroId → definition id), `forms`, `uses`, `effects`; generic heroes stay the default
- [ ] T029 [US1] Setup wizard hero cards in src/ui/setup/* (portrait, name, range, Hero Unit type), using the named heroes from data; make T025–T026 pass

**Checkpoint**: Games start with named heroes; `US1-*` pass

---

## Phase 5: User Story 2 – Starting Hero abilities (Priority: P1)

**Goal**: The 12 starting abilities (spec US2-AS1…AS12)

**Independent Test**: One position per ability; check effect, uses left and timing (spec US2)

- [ ] T030 [P] [US2] Write tests/rules/heroes/cavalier.test.ts (starting part): `US2-AS1` Warhorse, `US2-AS2` Demoralise (mark, failed enemy Lead, expiry, royalty), `US2-AS3` Tight Formation (Lead without Battle, protection next turn, counts as the Lead); a refusal each
- [ ] T031 [P] [US2] Write tests/rules/heroes/monk.test.ts (starting part): `US2-AS4` Rejuvenating Stroll, `US2-AS5` Preaching (−4; both uses on one unit → cannot be Led), `US2-AS6` Make Peace Not War (all four effects; removal by a King's Battle or wounds; only at War and not in check); a refusal each
- [ ] T032 [P] [US2] Write tests/rules/heroes/scout.test.ts (starting part): `US2-AS7` Elusive (Ram −2; ending a Move on an enemy unit; no Ram there), `US2-AS8` Bear Traps (−3 near; 4 wounds; removal; survives the Epic Stage; Make Peace Not War stops the wounds, Q-46), `US2-AS9` Poison Water (cannot be Led next turn; −3 until the Epic Stage); a refusal each
- [ ] T033 [P] [US2] Write tests/rules/heroes/magus.test.ts (starting part): `US2-AS10` Future Sight, `US2-AS11` Flaming Bolt (2 uses), `US2-AS12` Souls Clash; a refusal each
- [ ] T034 [US2] Implement the Cavalier starting abilities in src/rules/heroes/cavalier.ts and register them in src/rules/heroes/index.ts
- [ ] T035 [US2] Implement the Monk starting abilities in src/rules/heroes/monk.ts
- [ ] T036 [US2] Implement the Scout starting abilities in src/rules/heroes/scout.ts (Elusive's end-Move rule in src/rules/heroes.ts `isForbiddenEndSquare` through the hook)
- [ ] T037 [US2] Implement the Magus starting abilities in src/rules/heroes/magus.ts; make T030–T033 pass

**Checkpoint**: Starting Heroes fully playable; `US2-*` pass

---

## Phase 6: User Story 3 – Epic forms (Priority: P1)

**Goal**: All 12 Epic forms with their abilities (spec US3); one hero at a time, Cultist last

**Independent Test**: Per form, every ability's main effect and a refusal; costs normal and Bloodied (spec US3)

### Engine-level tests

- [ ] T038 [P] [US3] Write tests/rules/epic-forms.test.ts: `US3-AS1` (form, sheet key and name follow the destiny), `US3-AS2` (X/Y cost and a/b values by Bloodied), `US3-AS3` (timing window, once per turn, conditions), `US3-AS4` (Always Active effects need no action)

### Cavalier forms

- [ ] T039 [P] [US3] Tests in tests/rules/heroes/cavalier.test.ts (`US3-deathKnight-*`): Aura of Fear (−2/−3), Seek Revenge, Pale Steed, I'm Not Done With You, Duty Beyond the Grave, Legendary Ancient (5 health, wounds per Lead, cannot Battle on its first turn)
- [ ] T040 [P] [US3] Tests (`US3-dragonLord-*`): Winged Stride, Dragon Mount, Breath of Fiery Destruction (both options), Draconic Descent (2×2 path; no Battle with royalty), Terrifying Roar, Great Wyrm Offering
- [ ] T041 [P] [US3] Tests (`US3-holyPaladin-*`): Aura of Radiance, Magnificent Stallion, Divine Protector (wound redirect; no push; Ram wounds taken instead), Paragon of Honor (token After Lead; the 2 D swap as a reaction), Crusade, Knight a Peasant (permanent Modify), Holy Wrath
- [ ] T042 [US3] Implement the Death Knight, Dragon Lord and Holy Paladin abilities in src/rules/heroes/cavalier.ts; make T039–T041 pass

### Magus forms

- [ ] T043 [P] [US3] Tests in tests/rules/heroes/magus.test.ts (`US3-necromancer-*`): Grave Sacrifice (+1 generation per 5 Graveyard units, at End of Turn), Soul Syphon, Blood Ritual (+3/+4), Leeching Touch (both options, 2/4 wounds), Awaken the Deathless (3/2 wounds to the caster), Undead Legions (1 + created / 1 wound and a free Lead without Battle when Bloodied)
- [ ] T044 [P] [US3] Tests (`US3-grandArcanist-*`): Magic Bombardment (both options), Arcane Shackles (no re-mark; cannot be Led nor Destroyed in Battle), Conjure Portal (same colour, not the Royal Rank, teleport, Battle through a portal, removal), Summon Shadow Demon (Battle only; previous vanishes; no generation), Fireball (2×2 in range; at end of next turn 5 wounds and Destroy)
- [ ] T045 [P] [US3] Tests (`US3-chronomonger-*`): No Time to Lose?, Certainty & Death (auto-success, then Destroyed after the next Lead), Rapid March (3 squares; no en passant), Timey-Wimey Shift (turn order swap with the ally; Active Hero passes), Converge Timelines (copy, original rules, removal next turn; marks not copied, Q-46), Temporal Flux
- [ ] T046 [US3] Implement the Necromancer, Grand Arcanist and Chronomonger abilities in src/rules/heroes/magus.ts (Timey-Wimey's turn-order swap in src/rules/turn.ts `handOff`; portals through `pathFilter`); make T043–T045 pass

### Scout forms

- [ ] T047 [P] [US3] Tests in tests/rules/heroes/scout.test.ts (`US3-scoundrel-*`): Elusive Sabotage (−3 for Leads from the Scoundrel's square), Bushwack (2/3 wounds, push, +1 into a friendly unit), Mass Confusion, Misdirection, Devious Gambit (reaction), High Treason
- [ ] T048 [P] [US3] Tests (`US3-spyMaster-*`): Evasive (Grotto escape when Rammed), Smuggler's Grotto (Beginning of Epic Stage; taverns for the Spy Master and ally; adjacent to each other), Misinformation (not on a Hero Unit), Infiltrate (Spy pawn reversed; re-use returns it), Mislead, Counterintelligence (cannot Battle; escape instead of Destroy, not into check)
- [ ] T049 [P] [US3] Tests (`US3-royalAssassin-*`): Patient Preparation (+2 after 0 Move), Kill Order (Destroy at End of Turn when adjacent; lasts until Destroyed or re-used), Assassinate the Unworthy, Reap the Weary, Red Carpet (Queen Battle continues along the path), Regicide (unprotected this turn before the Lead; Bishops when there is no Queen)
- [ ] T050 [US3] Implement the Scoundrel, Spy Master and Royal Assassin abilities in src/rules/heroes/scout.ts (Grotto taverns in src/rules/taverns.ts through a hook); make T047–T049 pass

### Monk forms (Cultist last, research R-13)

- [ ] T051 [P] [US3] Tests in tests/rules/heroes/monk.test.ts (`US3-saint-*`): Saintly Inspiration, Sacred Rite, Pilgrimage (through enemy units in its file, not to the Royal Rank, no Ram, no Battle), Martyrdom (2 wounds per unit; Movement 1 next turn; not as Hero Unit), Wings of Destiny
- [ ] T052 [P] [US3] Tests (`US3-supremeInquisitor-*`): Zealot Mob, Unexpected Visit, Inquisition (temporary Modify to Pawn), Sanctimonious, Blind Faith, Dogmatic Indoctrination
- [ ] T053 [P] [US3] Tests (`US3-cultist-*`): Righteous Might, Spiritual Healing, Religious Fervor (occupied but passable token; pawn, then bishop; Bloodied straight to bishop; removal and 3 wounds to an enemy hero), Knightmare (fork detection), Sacrifice, False Salvation (create an auxiliary Pawn; Bloodied option returns a main Pawn), Dream of Ill Fate (unit type not royalty; 4 wounds to the enemy hero who Leads it next turn)
- [ ] T054 [US3] Implement the Saint, Supreme Inquisitor and Cultist abilities in src/rules/heroes/monk.ts; make T051–T053 and T016 (coverage) pass

**Checkpoint**: Every ability implemented and tested; coverage test green

---

## Phase 7: User Story 5 – Hero sheets like the Tabletop Simulator version (Priority: P2)

**Goal**: TTS sheet images with health bar, pool, medallion, use tokens and badges; ability panel and targeting

**Independent Test**: Screenshot with the four sheets and overlays; use an ability from the HUD (spec US5)

### Tests for User Story 5 (write first, must fail) ⚠️

- [ ] T055 [P] [US5] Write tests/game/sheet-model.test.ts:
  - `US5-AS1`: starting sheet key, then the Epic sheet key;
  - `US5-AS2`: health marker and bar (16 or 20);
  - `US5-AS3`: pool crystals;
  - `US5-AS5`: uses left per ability;
  - corrected-cost badges where `sheet.printedCost` differs (FR-001a);
  - the Cultist uses the canvas sheet (A-05).
- [ ] T056 [P] [US5] Write tests/e2e/sheets.spec.ts:
  - `US5-AS1…AS5` through the `tableElements()` hook (sheet image keys, bar marker, pool count, medallion in the Turn Order slot with the active one glowing, use tokens);
  - `US5-AS6`: the HUD ability panel shows icons, costs, timing and usable-now, and a Bear Trap used from the panel appears on the table;
  - a screenshot to test-results/sheets-004.png.

### Implementation for User Story 5

- [ ] T057 [US5] Implement src/game/sheet-model.ts (engine-free) per contracts/rules-api-changes.md
- [ ] T058 [US5] Rework src/table/sheets.ts (research R-12):
  - the TTS sheet image plane at about 4.4 × 2.65;
  - the health bar image strip with marker, the Hero Destiny Pool image with crystals, the medallion in the Turn Order circle (src/table/tracks.ts);
  - use tokens on the ability slots, and a badge canvas overlay;
  - the 003 canvas sheet as fallback (Cultist, generic heroes);
  - new layout constants in src/table/coords.ts, and src/table/camera.ts keeps the board and the active sheet in view.
- [ ] T059 [US5] Implement src/table/effects.ts: marks on units and heroes (`token.ability.*` images), and square tokens (Bear Trap, Religious Fervor, Portal, Fireball area, Temporal Flux, Grotto)
- [ ] T060 [US5] Implement src/ui/hud/abilities.ts (Symbol Legend icons cut from `legend`; cost normal / Bloodied; timing; usable now; uses), src/ui/targeting.ts (pick squares, units or heroes on the table from the offer's targets), and reaction and choice dialogs in src/ui/dialogs.ts; wire them in src/main.ts
- [ ] T061 [US5] Make T055–T056 pass

---

## Phase 8: User Story 6 – Tabletop Simulator pieces and table (Priority: P2)

**Goal**: TTS meshes, colliders, table, sky, Graveyard / Well board, pools, Peace / War and auxiliary tokens

**Independent Test**: Table screenshot with TTS models; sandbox physics and frame rate hold (spec US6)

### Tests for User Story 6 (write first, must fail) ⚠️

- [ ] T062 [P] [US6] Write tests/e2e/tts-table.spec.ts:
  - `US6-AS1`: unit meshes are TTS models in both colours (hook reports the asset kind per piece);
  - `US6-AS2`: the auxiliary token on auxiliary units;
  - `US6-AS3`: table mesh, sky, Graveyard / Well board, Common Pools and Peace / War token;
  - `US6-AS4`: with a key pointed at a missing file, the placeholder shows;
  - first load ≤ 10 s;
  - a screenshot to test-results/tts-table-004.png.

  Extend tests/e2e/perf.spec.ts (gpu project) for 60 fps with the TTS models and the 002 sandbox ≥ 50 fps.

### Implementation for User Story 6

- [ ] T063 [US6] Implement src/table/tts-models.ts: OBJLoader with texture and normal maps, scale and centring per piece, caching, and placeholder until loaded; src/table/assets.ts `createAsset` uses it for `mesh` entries
- [ ] T064 [US6] Use the TTS collider meshes for unit bodies in src/physics/sandbox.ts (convex hull from `collider`, fallback to the 002 shapes); the 002 sandbox tests stay green
- [ ] T065 [US6] TTS table mesh and sky in src/table/room.ts; the Graveyard / Well board image in src/table/strip.ts; pool images under the Common Pool crystals; Peace / War token faces and auxiliary tokens in src/table/pieces.ts; make T062 pass

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T066 [P] Sandbox editors in src/ui/hud/sandbox-editors.ts and `sandboxSet` paths in src/rules/sandbox.ts for hero form, uses, and adding or removing effects; position checks for tokens on squares and special units (spec edge case); tests in tests/rules/sandbox.test.ts
- [ ] T067 [P] Extend tests/rules/contract.test.ts with guarantees 13–18 over random playouts with named heroes that use abilities (heroes `cavalier`, `monk`, `scout`, `magus`; `wellRemaining` low so Epic forms appear)
- [ ] T068 [P] Write tests/games/scripted-game-04.test.ts: a game with all four heroes into the Epic Stage, with a hand-kept ledger of pools, uses, costs (one Bloodied) and effects per turn
- [ ] T069 [P] Log lines for ability use, effects added and removed, Modify and Push in src/game/log.ts
- [ ] T070 Run specs/004-named-heroes/quickstart.md steps 1–7 in the browser and fix differences
- [ ] T071 Update README.md, CLAUDE.md and the 003 docs where 004 changes them (Modifier source, setup picks, Unit tags); note Q-40b and the other open questions for Luka

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 → T002 → T003; T004–T008 in parallel after T003 (T004 needs the import output)
- **Foundational (Phase 2)**: after Setup; blocks all stories
- **US4 (Phase 3)**: after Foundational; blocks US2 and US3
- **US1 (Phase 4)**: after Foundational (can run beside US4)
- **US2 (Phase 5)**: after US4 and US1
- **US3 (Phase 6)**: after US2 (shares the hero modules); the hero groups in order Cavalier → Magus → Scout → Monk; the Cultist last (R-13, Q-40b)
- **US5 (Phase 7)**: T057 after US1; T058–T060 after US2 (needs abilities to show); can start beside US3
- **US6 (Phase 8)**: after Setup (assets); independent of US1–US5
- **Polish (Phase 9)**: after all stories

### Story completion order

```text
Setup → Foundational → US4 ║ US1 → US2 → US3 (Cavalier → Magus → Scout → Monk) → Polish
                                     └── US5 (beside US3) ──┘
Setup ────────────────────────────── US6 (any time after Setup) ──┘
```

## Parallel Opportunities

- Setup: T004–T008 together after T003
- Foundational: T012 and T015 beside T013
- US4: T017 and T018 together
- US2: T030–T033 (tests per hero) together
- US3: the three test tasks of each hero group together (T039–T041, T043–T045, T047–T049, T051–T053)
- US6 entirely parallel to US1–US5 (different files: table, physics)
- Polish: T066–T069 together

## Parallel Example: Cavalier Epic forms

```text
Task: "T039 [US3] tests/rules/heroes/cavalier.test.ts – Death Knight"
Task: "T040 [US3] tests/rules/heroes/cavalier.test.ts – Dragon Lord"   (same file: write in separate describe blocks, merge after)
Task: "T041 [US3] tests/rules/heroes/cavalier.test.ts – Holy Paladin"
Task: "T063 [US6] src/table/tts-models.ts"                            (different area, any time)
```

---

## Implementation Strategy

### MVP first

1. Setup + Foundational + US4 (the engine and shared mechanisms)
2. US1 + US2 → **MVP**: games with the four named Starting Heroes and their abilities

### Incremental delivery

3. US3 one hero at a time; each hero is a mergeable increment (its three forms and tests)
4. US5 sheets (beside US3), US6 TTS table (any time after Setup)
5. Polish: sandbox editors, guarantees, scripted game, quickstart, docs

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- Commit after each task or logical group, on branch `004-named-heroes`
- New rule gaps → spec Open Questions, never silent defaults
- The Cultist's names and wordings may change (Q-40b): keep them in data so the fix is a data edit plus at most one effect function
