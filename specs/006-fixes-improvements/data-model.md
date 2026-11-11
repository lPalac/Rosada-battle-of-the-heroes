# Data Model: Fixes and Improvements from the First Playtests

**Feature**: `006-fixes-improvements` | Base: the 001–005 data models

Three kinds of change: the game state (saved and replayed), static data (JSON), and view models (computed from the state, never saved). Interface state that lives only in the browser is listed last.

## 1. Game state (`src/rules/model`)

### GameState (changed)

| Field | Type | Notes |
| --- | --- | --- |
| `sandboxResume` | `SandboxResume \| null` | NEW (B-06). Set when rules are turned off while `status` is `playing`; cleared when rules come back on. `null` in new games and in migrated saves |
| `version` | number | `STATE_VERSION` + 1 |

### SandboxResume (new)

| Field | Type | Notes |
| --- | --- | --- |
| `turnNumber` | number | The turn the resume point belongs to |
| `activeHeroId` | `HeroId` | |
| `phase` | `Phase` | |
| `turn` | `TurnFlags` | A copy: Movement left, move path, Lead, abilities used, … |
| `pendingDecision` | `PendingDecision \| null` | |
| `decisionQueue` | `PendingDecision[]` | |

Rules:
- Resume applies only when `turnNumber` and `activeHeroId` equal the state's and `restart` is not set; otherwise play restarts at Before Turn as in 001.
- On resume, a Lead with `success === null` is kept only if its unit still stands on `lead.from` and the announced option is still legal; otherwise `turn.lead = null`, `turn.leadAttempted = false`, and an Inspired Lead bonus it had used goes back to `turn.inspiredLeadBonus`.
- Square decisions get fresh options; a decision with no option left is dropped.
- `turn.leadPossible` is recomputed when the phase is Lead and no Lead was attempted.

### Action (changed)

```ts
| { type: 'setEnforcement'; mode: 'rules' | 'sandbox'; restart?: boolean }   // restart: always begin at Before Turn
| { type: 'inspiredLead'; destiny: number; pay?: Payment }                   // now also legal in the Lead phase until the roll
```

### PendingDecision (changed)

```ts
| { type: 'epicDestiny'; heroId: HeroId; options: EpicDestiny[]; appliesTo: HeroId[] }
```

`appliesTo` lists the heroes that take the chosen destiny: the chooser alone in Draft; the chooser and its twin (same `definitionId`, other side) in Mirror. `migrateState` fills `[heroId]` for a decision saved without it.

Mirror picks (FR-013): the setup's two picks may not name the same named hero (same `heroDefinitionId`), so the two heroes of a side always differ. Picks of the generic test heroes are unchanged. No field changes.

Mirror queue (`setup.mode === 'mirror'` and named heroes): two decisions instead of four. With the generic test heroes the 003 queue stays. The first is for the first hero of `choiceOrder`; the second is for the hero of the other definition on the other side.

### Event (changed)

```ts
| { type: 'check'; side: Side; units: string[] }   // side: whose King; units: the units that newly check it
```

Emitted once per action and King when at least one unit newly checks, whatever kind of action caused it. No longer emitted for a Lead that only leaves an existing check in place.

### PositionWarning (new, derived, not saved)

| Field | Type | Notes |
| --- | --- | --- |
| `code` | `'CHECKMATE'` | The only warning for now |
| `side` | `Side` | The side whose King is checkmated |

A warning does not stop rules from coming back on; a `PositionProblem` (001) does.

### TurnFlags, LeadAttempt (changed)

- `turn.moveStart: Coord | null` is NEW: the hero's square when the Move phase began (FR-003). `turn.movePath` is unchanged (squares entered), because existing abilities read an empty `movePath` as "has not moved". `migrateState` fills `null`.
- `checkBonusClaimed: boolean` is replaced by `checkDestinyClaimed: Side[]`: the sides that gained check Destiny this turn (decided 2026-11-11: at most once per turn per side; the side not on turn can gain too, when the side on turn uncovers its own King or a reaction checks). `migrateState` maps `true` to the active side.
- "New check" needs no stored field: the units checking each King are computed before and after every action.
- `kingInCheckAfterLead` is unchanged and is copied as it is into and out of the sandbox resume point.
- An Inspired Lead paid after the announcement adds `{ source: 'inspiredLead', value }` to `lead.modifiers` and may set `lead.needsRoll` to `false`.

### State transitions touched

```text
rules ──setEnforcement(sandbox)──▶ sandbox            sandboxResume := snapshot (if playing)
sandbox ──setEnforcement(rules)──▶ rules, same phase  if resume point matches and !restart
sandbox ──setEnforcement(rules, restart)──▶ rules, Before Turn
Lead announced, waiting for roll ──inspiredLead──▶ waiting for roll (more modifiers)
                                              └──▶ resolved as success (cannot fail any more)
Epic Stage starts, Draft  ──▶ 4 epicDestiny decisions (003)
Epic Stage starts, Mirror ──▶ 2 epicDestiny decisions, each applied to both heroes of a class
```

## 2. Static data (`src/data`)

### abilities.json (changed)

| Field | Change |
| --- | --- |
| `cost` | `{ "normal": 1, "bloodied": 1 }` on `cavalier.demoralise`, `cavalier.tightFormation`, `monk.preaching`, `monk.makePeaceNotWar`, `scout.bearTraps`, `scout.poisonWater`, `magus.flamingBolt`, `magus.soulsClash`. `uses` stays |
| `flags.noUnitEffect` | NEW flag in the existing `flags` object (beside `mustNotCheck`, `notRoyalty`, `notAsHeroUnit`; absent = false): true for abilities whose effect cannot add, move, retype or remove a unit (wounds, heals, hero moves, bonuses), so the check test of FR-016 is skipped for them |
| `flags.bothUses` | NEW flag, on `monk.preaching`. The engine then offers the options `one` and `both`; `both` spends two uses and their Destiny and applies the both-uses effect. `oncePerTurn` becomes true for it (false today) |
| `targetHint` | NEW, optional string key: what the ability needs as a target, for the "why not" line: `enemyHeroOnPath`, `friendlyHeroOnPath`, `enemyHeroInRange`, `adjacentEnemyUnit`, … One string `hint.<key>` each |

Validation (schema and `scripts/check-data.ts`): `targetHint` must have a string; an ability with `uses` on a Starting Hero must have a cost (so a new starting ability cannot be free by accident).

### assets.json (changed)

| Key | Change |
| --- | --- |
| `unit.<side>.<type>` (12 entries, 6 models) | NEW optional `yaw` (degrees, default 0): turn of the model inside its holder. 180 for the TTS unit models |
| `tts.table` | NEW optional `scale`, `offsetY`, `yaw`: how the table model is fitted |
| `epic.short`, `epic.long` | Unchanged; used only by the generic heroes' canvas sheet |

### heroes.json (unchanged)

The destiny dialog and the Hero Unit icons read what is already there: `name`, `portrait`, `heroUnitType`, `forms[destiny].name`, `.portrait`, `.sheet`.

### strings.en.json (changed)

New groups: `lead.auto.*` (replaces `lead.noRoll`), `hint.*`, `status.*` (why an ability is not usable), `flash.*`, `settings.resume`, `settings.offerDraw`, `setup.confirmPick`, `dialog.destinyStep`, `dialog.destinyChosen`, `dialog.destinyBoth` (Mirror: "for both Cavaliers"), `dialog.checkmate.*` (alert text, "Continue the game", "Back to sandbox"), `check.flash` ("CHECK"), `check.badge` ("{side}: in check"), `check.rule` (the *Check* rule about the end of the Lead), `dialog.ownCheck.*` ("This will put your King in check", "Continue", "Undo"), `error.NOT_A_LEAD`; `error.LEAD_LEAVES_KING_IN_CHECK` changes to "That would place your King in check", `hud.move`, `hud.rangeBadge`, `hud.heroUnitIcon`, `track.shared`, `save.olderRules`, `ability.panel.*`.

## 3. View models (`src/game`, engine-free, not saved)

### Reach (B-16) — from `moveReach(state)` in `src/rules/heroes.ts`

| Field | Type | Notes |
| --- | --- | --- |
| `to` | `Coord` | |
| `cost` | number | Steps from the hero's square, ≤ Movement left |
| `path` | `Coord[]` | Squares to step on, in order, ending at `to` |
| `canEnd` | boolean | False for a square the Move may pass but not end on (an enemy unit or a King, unless *Elusive*) |

### MovePlan (B-16) — `move-plan.ts`

| Field | Type | Notes |
| --- | --- | --- |
| `path` | `Coord[]` | Every step from the hero's square, in order |
| `left` | number | Movement left after the plan |
| `reach` | `Reach[]` | Squares reachable from the plan's end with `left` |

Rules: `extendPlan` appends the shortest path from the plan's end to the clicked square; a square not in `reach` clears the plan; the plan is never longer than the Movement left.

### TargetPrompt (B-02) — `target-model.ts`

| Field | Type | Notes |
| --- | --- | --- |
| `abilityId`, `option` | string | |
| `steps` | `TargetStep[]` | One step per target position |
| `fallback` | `'dialog' \| null` | `dialog` when a target is not on the board (`unitType`) |

`TargetStep`: `{ picks: { coord: Coord; target: AbilityTarget }[] }`, filtered by the picks already made. A unit or hero target is picked by its square.

### Flash (B-19) — `flash-model.ts`

| Field | Type | Notes |
| --- | --- | --- |
| `kind` | `'check' \| 'wound' \| 'heal' \| 'destiny' \| 'roll' \| 'ability' \| 'destroyed' \| 'leadFailed' \| 'skipped'` | A `destiny` flash is per pool and reason, with the reason in its text. `skipped` is one per phase the game passed by itself ("Phase 'Before Lead' skipped"); for Before Turn, Beginning of Turn and Before Move only when the active hero has an ability with that timing. `check` carries the checked side; it is drawn above that King, blinks three times for one second each and does not slide |
| `textKey`, `params` | string, record | Text from the string file |
| `tone` | `'good' \| 'bad' \| 'neutral'` | Colour |
| `side` | `Side \| null` | For the side's colour on the edge |

### DestinyChoiceModel (B-01) — `destiny-model.ts`

| Field | Type | Notes |
| --- | --- | --- |
| `heroId`, `heroName`, `side`, `playerId` | | The chooser |
| `appliesTo` | `{ heroId; side }[]` | Mirror: both heroes of the class; Draft: the chooser |
| `step`, `of` | number | "choice 2 of 4"; in Mirror "of 2" |
| `cards` | `{ destiny; formName; portraitKey; allowed; blockedBy }[]` | Three cards, from `heroes.json` forms; for the generic test heroes the cards show what the dialog shows today (destiny name, `epicArt` picture), nothing new |
| `chosen` | `{ heroId; heroName; formName; destiny }[]` | Choices made so far |

### HudModel (changed) — `hud-model.ts`

| Field | Change |
| --- | --- |
| `heroes[].name` | Always filled for named heroes: the hero or Epic form name. The generic test heroes keep today's text |
| `heroes[].heroUnitIcons` | NEW `{ types: UnitType[]; unlocked: boolean }` (B-21) |
| `lead.auto` | NEW `'king' \| 'peace' \| 'ability' \| 'cannotFail' \| null`: why no roll is needed (B-04) |
| `lead.modifierLabels` | NEW string per modifier, from `labels.ts` (X-01) |
| `can.inspiredLeadMax` | Unchanged field; now also above 0 in the Lead phase before the roll (B-07) |
| `abilityStatus` | NEW per ability of the active hero: `usable` or a reason with its hint (B-10, B-11) |
| `phaseLabel` | Existing phase name, now also shown in the ability panel's phase box |
| `inCheck` | NEW `Side[]`: the sides whose King is in check now, for the "In check" pop-up (B-05) |
| `Highlights.reach`, `.range` | NEW: `Reach[]` in the Move phase (replaces `moves` for drawing); squares in Range in the Lead phase (B-16, B-20) |
| `Highlights.blocked` | NEW: for the selected unit, the squares it could be Led to but for check on the own King (B-05); also in the unit-and-square step of an "Instead of Lead" ability |

### FavorModel (changed) — `favor-model.ts`

| Field | Change |
| --- | --- |
| `shared` | NEW `{ slots: 11; light: number; dark: number; powers: { threshold; id; nameKey }[] }`; `light` and `dark` are capped at 11 |
| `light.track`, `dark.track`, `slots` (16) | Unchanged; the menu's lists and counts still use them |

### SheetModel (changed) — `sheet-model.ts`

`AbilityOffer` gains `blocked: { targets: AbilityTarget[]; code: string }[]`: targets refused for a rule reason (check), so the board can show them and say why. `AbilityRow` already has `cost`, `uses`, `usesLeft`; the cost is now present together with uses for the eight starting abilities. NEW `status` (same values as `HudModel.abilityStatus`).

## 4. Interface state (browser only)

| State | Where | Notes |
| --- | --- | --- |
| Move plan | `main.ts` | Cleared on any state change that is not its own walk |
| Walk in progress | `main.ts` | Remaining steps; blocks other input; ends on refusal, decision, wound |
| Target prompt progress | `main.ts` | Replaces `targeting: { kind: 'retreat' }`; Hero Retreat becomes one prompt of this kind |
| Own-King warning | `ui/dialogs.ts` | Open between the last target pick and sending the action; Undo drops the picks |
| "CHECK" notice | `ui/hud/flashes.ts` | One per checked King; placed from the King's square each frame for 3 s |
| Pending hero pick | setup wizard / online picks | The card clicked once |
| Ability panel collapsed | `localStorage` `rosada.ui.abilities` | Per browser |
| Flash queue | `ui/hud/flashes.ts` | Not saved; `flashes()` in the test hook keeps a history |

None of this is in save files, the action log or the online protocol.
