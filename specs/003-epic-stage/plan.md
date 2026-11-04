# Implementation Plan: Epic Stage, Destiny Generation, Royal Favors and Legendary Powers

**Branch**: `003-epic-stage` | **Date**: 2026-11-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-epic-stage/spec.md`

## Summary

The rest of the basic rules on top of 001/002, plus a visual pass towards the Tabletop Simulator table.
- **Epic Stage**: when the initial 16 Destiny run out, the next *Before Turn* opens a destiny choice for every hero in turn order (depleting hero last, no Fanatic + Dominant on one side). Then the game applies Manifest Epic Destiny, the Common Pool split and +10 / +8 health, and removes the War token, which ends the +2.
- **Economy**: derived Destiny generation (1 + missing unit types + auxiliary pawn bonus), gained at each Epic hero's *End of Turn*, and derived Bloodied.
- **Royal Favors**: data-driven, checked at the events that complete them and after every action for state conditions, filling a per-side track. A tracker modal and the table track both read one headless model.
- **Legendary Powers**: Hero Units are real units (`kind: 'hero'`), so Battle, check and paths reuse the existing rules. King's Forces creates auxiliary units under the *Create* rules. Advanced Warfare, Far Reach, Swift Change and Final Form (either path, both threats).
- **Table**: a wooden table in a dim room, an illustrated board border, a Graveyard / Well strip, hero sheets with portrait, health track, pool and generation tracker, Royal Favor tracks and turn-order medallions. All drawn as placeholders behind data keys, using the hero and epic art from `assets/`.

## Technical Context

**Language/Version**: TypeScript 7.x on Node.js 24 LTS; current desktop browsers (unchanged)

**Primary Dependencies**: three 0.187.x, @dimforge/rapier3d-compat 0.21.x, Vite 8.x; dev: Vitest 5.x, @playwright/test 1.64.x, ajv 8, tsx. No new dependencies.

**Storage**: Unchanged (action-log saves). Older saves load with defaults for the new fields.

**Testing**: Vitest for every rules scenario (`US1…US6-AS*`) and the Royal Favor/tracker model; Playwright for the destiny-choice dialog, the tracker modal, the table elements and a screenshot of the new table; 001/002 suites stay green.

**Target Platform**: Desktop Chrome, Edge, Firefox (unchanged)

**Project Type**: Single-project web application (unchanged)

**Performance Goals**: 60 fps on the 001 reference machine with the new table art (canvas textures are drawn once and redrawn only when a sheet or track changes).

**Constraints**:
- The rules core stays engine-free (constitution II).
- All new numbers (thresholds, counts, Hero Unit values) and art keys live in data (constitution III).
- No invented rules: gaps are spec Q-35…Q-36 with documented defaults (constitution I).

**Scale/Scope**: 7 user stories, 25 functional requirements, 12 Royal Favors, 6 powers. Touches `src/rules` (stage, destiny, lead modifiers, ram, paths for multi-type units, endgame unchanged), `src/game` (Royal Favor model), `src/data`, `src/table` (table, sheets, tracks, medallions), `src/ui` (destiny dialog, tracker modal, Hero Unit and King's Forces actions, sandbox editors).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
| --- | --- | --- |
| I. Rulebook is the source of truth | Every rule comes from the rulebook sections listed in the spec or from Luka's clarifications (generic heroes Knight/Bishop, War +2 ends, Final Form). Gaps are logged as Q-35…Q-36 with defaults; nothing is built silently | ✅ Pass |
| II. Engine-free rules core | Stage, generation, Royal Favors and Hero Units are rules-core code; the tracker model is in `src/game`; the table reads the state only. The boundary test keeps guarding | ✅ Pass |
| III. Data-driven content | `royal-favors.json` (new, with schema), new `rules.json` values, `heroUnitType` and art keys in `heroes.json`, all art in `assets.json` | ✅ Pass |
| IV. Rules tested first | Each acceptance scenario gets a failing test before its code; rule bugs fixed test-first | ✅ Pass |
| V. Verifiable without a human | Headless tests for rules and tracker; Playwright screenshots of the table and the modal | ✅ Pass |
| VI. Keep it simple | No new dependency; Hero Units reuse the unit model instead of a parallel system; derived values instead of stored trackers; named heroes and abilities stay out | ✅ Pass |

**Re-check after Phase 1 design**: ✅ Pass. The contracts keep presentation out of the rules core; Royal Favors and art are data. *Complexity Tracking* stays empty.

## Project Structure

### Documentation (this feature)

```text
specs/003-epic-stage/
├── spec.md               # Feature spec (with Clarifications)
├── plan.md               # This file
├── research.md           # Phase 0: R-01…R-11
├── data-model.md         # Phase 1
├── quickstart.md         # Phase 1
├── contracts/
│   ├── rules-api-changes.md
│   └── royal-favors-data.md
├── checklists/requirements.md
└── tasks.md              # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── rules/
│   ├── epic.ts            # NEW: epicPending, destiny decisions, applying the Epic Stage
│   ├── generation.ts      # NEW: destinyGeneration, isBloodied
│   ├── royal-favors.ts    # NEW: event and state checks, track, powers, King's Forces tokens
│   ├── hero-unit.ts       # NEW: become/leave, restrictions, destroyed Hero Units
│   ├── create.ts          # NEW: createUnit (Create rules), King's Forces
│   ├── destiny.ts         # depletedBy, epicPending, Tides hook
│   ├── tokens.ts          # peaceTreaty 'removed'
│   ├── lead.ts            # no War bonus after removal; heroUnit +4; Hero Unit Battle; Royal's Fury, Castle Gates, discovered check
│   ├── paths.ts / check.ts# union paths/threats over extraTypes
│   ├── ram.ts             # Hero Units never Rammed; rammedBy {unitId, turn}; Overwhelm
│   ├── heroes.ts          # wounds → Vanquish / Bloodied progress
│   ├── turn.ts            # resting phases for King's Forces / Hero Unit / Swift Change; End of Turn generation
│   ├── sandbox.ts         # new editable values; position checks for Hero Units and aux units
│   └── model/*            # fields from data-model.md
├── game/
│   └── favor-model.ts  # NEW: tracker view (modal + table track)
├── data/
│   ├── royal-favors.json + schemas/royal-favors.schema.json   # NEW
│   ├── heroes.json, rules.json, assets.json, strings.en.json  # extended
├── table/
│   ├── room.ts            # NEW: stone floor, fog, warm lights, wooden table slab
│   ├── board.ts           # illustrated border, parchment squares
│   ├── sheets.ts          # NEW: hero sheets (canvas: portrait, health track, pool, destiny, generation)
│   ├── tracks.ts          # NEW: Royal Favor tracks and turn-order medallions
│   └── strip.ts           # NEW: Graveyard / Destiny Well strip
├── ui/
│   ├── tracker.ts         # NEW: tracker modal
│   ├── dialogs.ts         # epicDestiny decision dialog with Epic art
│   └── hud/*              # Hero Unit / King's Forces buttons; Bloodied and generation in hero panels
public/
└── art/heroes/            # NEW: copies of assets/ hero and epic images (served and bundled)

tests/
├── rules/epic.test.ts, generation.test.ts, Royal Favors.test.ts, hero-unit.test.ts, create.test.ts, bloodied.test.ts
├── game/favor-model.test.ts
└── e2e/epic.spec.ts, tracker.spec.ts, table.spec.ts
```

**Structure Decision**: Same single web project. New rules modules per rulebook area keep files small; Hero Units reuse units.

## Build Order

| Phase | Scope | Stories | Done when |
| --- | --- | --- | --- |
| A | Model fields, data files + schemas, save defaults | — | `npm test` green, old saves load |
| B | Epic Stage, War removal, generation, Bloodied | US1, US2, US6 | Their scenario tests pass |
| C | Royal Favors engine + tracker model + modal | US3 | All 12 Royal Favors tested; modal shows both sides |
| D | Multi-type paths, Hero Units, auxiliary units, Create, King's Forces, other Powers | US4, US5 | Their scenario tests pass |
| E | Table visuals: room, table, border, strip, sheets, tracks, medallions, art | US7 | Screenshot matches the reference layout; fps check passes |
| F | Sandbox editors for new values, docs, quickstart run | — | Quickstart steps 1–7 pass |

## Risks

| Risk | Mitigation |
| --- | --- |
| Royal Favor conditions read differently from the designer's intent | Defaults logged (Q-35…Q-36); timing of position checks clarified; scripted tests per Royal Favor so a ruling change is one test + one check |
| Hero Units touch many rules (Battle, check, Ram, range) | Model them as units so existing tests cover check/paths; dedicated tests for each US4 scenario |
| Canvas-drawn table art looks cheap | Keys in `assets.json` so Luka's textures/models drop in; layout follows the screenshots |
| Large hero images slow the first load | Load portraits lazily after the board; downscale on load to sheet size |
| Main checkout's asset reorganisation (new folders, renamed rulebook) is not in this worktree | Copy the needed images into `public/art/heroes/` on this branch; note the renamed rulebook file in the spec |

## Complexity Tracking

No constitution violations.
