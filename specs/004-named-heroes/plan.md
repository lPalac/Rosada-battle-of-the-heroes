# Implementation Plan: Named Heroes, Epic Forms and the Tabletop Simulator Look

**Branch**: `004-named-heroes` | **Date**: 2026-11-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-named-heroes/spec.md`

## Summary

Replace the generic heroes with the four named heroes from `Hero Rules 2_0.docx`, each with its starting abilities and three Epic forms (16 hero faces, about 75 abilities). Make the table look like the Tabletop Simulator export.

- **Ability engine** (rules core): each ability is data plus one effect function, looked up by id. The engine handles:
  - timing windows, costs (normal / Bloodied), limited uses and once-per-turn;
  - conditions (adjacent, range, unoccupied, royalty, "Must not check the King");
  - reactions during the enemy's Lead.
- **Shared mechanisms** the abilities use: marks, square tokens, Modify, Push, lead modifiers and auras, special auxiliary units, hero-to-hero wounds and heals. Each has an expiry, and the existing action log replays it.
- **Content**: one module per hero (`src/rules/heroes/<hero>.ts`) holding its ability effects, built hero by hero with a scenario test per ability.
- **Table**: the TTS sheet images become the hero sheets, with the health-bar, pool and medallion overlays placed as in Tabletop Simulator. The TTS meshes, table, sky, Graveyard / Well board, pools and tokens replace the placeholders. An import script copies and compresses the assets into `public/tts/` and writes their `assets.json` keys.

## Technical Context

**Language/Version**: TypeScript 7.x on Node.js 24 LTS; current desktop browsers (unchanged)

**Primary Dependencies**:
- Runtime (unchanged): three 0.187.x, @dimforge/rapier3d-compat 0.21.x, Vite 8.x.
- Dev (unchanged): Vitest 5.x, @playwright/test 1.64.x, ajv 8, tsx.
- New dev-only dependency: `sharp`, for the one-off asset import (research R-09).
- three's `OBJLoader` (already in `three/addons`) loads the TTS meshes.

**Storage**: Unchanged (action-log saves). 003 saves load with generic heroes.

**Testing**:
- Vitest: a scenario test for every ability (main effect plus a refusal), the engine (timings, costs, uses, expiries) and the shared mechanisms.
- Playwright: setup with named heroes, an ability through the HUD, sheet and table screenshots, the frame-rate check.
- 001–003 suites stay green.

**Target Platform**: Desktop Chrome, Edge, Firefox (unchanged)

**Project Type**: Single-project web application (unchanged)

**Performance Goals**:
- First load ≤ 10 s.
- 60 fps on the 001 reference machine with the TTS meshes (about 6k vertices each, 32 pieces) and the sheet textures.
- Each ability legality check < 5 ms, so `legalActions` stays fast enough for random playouts.

**Constraints**:
- The rules core stays engine-free (constitution II).
- Ability data, numbers and art keys live in `src/data/` (III).
- Rule gaps are Q-38…Q-46 with defaults (I).
- Raw TTS files (about 150 MB) are not shipped: the import keeps what is used and compresses it.

**Scale/Scope**:
- 6 user stories, 4 heroes and 12 Epic forms, about 75 abilities, about 20 kinds of mark or token.
- Touches `src/rules` (abilities engine, effects, heroes, lead modifiers, turn timing, setup), `src/game` (HUD and sheet models), `src/data`, `src/table` (meshes, sheets, tokens), `src/ui` (ability panel, targeting, reactions), `scripts/` (asset import).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
| --- | --- | --- |
| I. Rulebook is the source of truth | Every ability comes from Hero Rules 2_0 (clarified: the rules win over the sheets). The Cultist is built from its Hero Rules section (R-13); open wording is Q-40a/b, and other gaps Q-39, Q-42…Q-46, all with defaults | ✅ Pass |
| II. Engine-free rules core | Engine, effects and hero modules live in `src/rules`; tokens on the table only read the state; the boundary test keeps guarding | ✅ Pass |
| III. Data-driven content | Hero and ability definitions (stats, costs, timings, conditions, text, icons, art) in `heroes.json` / `abilities.json`. Effects are code by id, because ~75 different behaviours are not data-expressible without an interpreter (research R-02) | ✅ Pass (justified in Complexity Tracking) |
| IV. Rules tested first | One failing scenario test per ability before its effect; engine tests before the engine | ✅ Pass |
| V. Verifiable without a human | All abilities headless; sheets and table by Playwright screenshots and hooks | ✅ Pass |
| VI. Keep it simple | One engine, a few shared effect kinds, one small module per hero. `sharp` is dev-only, for a one-off import. No scripting language for abilities | ✅ Pass |

**Re-check after Phase 1 design**: ✅ Pass. The contracts keep effects in the rules core and the TTS art behind `assets.json` keys.

## Project Structure

### Documentation (this feature)

```text
specs/004-named-heroes/
├── spec.md               # Feature spec (Clarifications; Open Questions Q-38…Q-46)
├── plan.md               # This file
├── research.md           # Phase 0: R-01…R-13
├── data-model.md         # Phase 1
├── quickstart.md         # Phase 1
├── contracts/
│   ├── abilities-data.md       # heroes.json / abilities.json format
│   ├── rules-api-changes.md    # actions, decisions, events, guarantees
│   └── tts-assets.md           # import script and asset keys
├── checklists/requirements.md
└── tasks.md              # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
scripts/
└── import-tts-assets.ts      # NEW: copy + resize + compress TTS files into public/tts, write the asset key list

src/
├── rules/
│   ├── abilities/
│   │   ├── engine.ts         # NEW: offers, validation, payment, uses, timing windows, reactions
│   │   ├── effects.ts        # NEW: marks, square tokens, Modify, Push, expiries
│   │   ├── modifiers.ts      # NEW: lead modifiers and auras (replaces the fixed list in lead.ts)
│   │   ├── targets.ts        # NEW: adjacent / in range / unoccupied / royalty / must-not-check helpers
│   │   └── units.ts          # NEW: special auxiliary units (undead, Legendary Ancient, Shadow Demon)
│   ├── heroes/
│   │   ├── cavalier.ts       # NEW: Cavalier, Death Knight, Dragon Lord, Holy Paladin
│   │   ├── monk.ts           # NEW: Monk, Cultist (R-13), Saint, Supreme Inquisitor
│   │   ├── scout.ts          # NEW: Scout, Scoundrel, Spy Master, Royal Assassin
│   │   ├── magus.ts          # NEW: Magus, Necromancer, Grand Arcanist, Chronomonger
│   │   └── index.ts          # NEW: ability id → effect table
│   ├── abilities.ts          # 001 Inspired Lead / Hero Retreat move onto the engine
│   ├── lead.ts, paths.ts     # modifiers from modifiers.ts; "cannot be Led" / "cannot Battle" filters; path hooks
│   ├── heroes.ts, ram.ts     # wound/heal hooks (Elusive, Divine Protector, Soul Syphon …)
│   ├── turn.ts               # timing windows rest when an ability is usable; expiries at phase boundaries
│   ├── epic.ts, setup.ts     # Epic form from destiny; named-hero picks
│   └── model/*               # fields from data-model.md
├── game/
│   ├── hud-model.ts          # ability rows (usable now, cost, uses)
│   └── sheet-model.ts        # NEW: what each sheet shows (image key, health, pool, uses, marks)
├── data/
│   ├── heroes.json           # 4 named heroes + 12 forms (generic kept for tests)
│   ├── abilities.json + schemas/abilities.schema.json   # NEW
│   ├── assets.json           # tts.* keys
│   └── strings.en.json       # ability names, texts, timing names, token names
├── table/
│   ├── tts-models.ts         # NEW: OBJ + texture loading with placeholder fallback
│   ├── sheets.ts             # TTS sheet image + overlays (health bar, pool, medallion, use tokens)
│   ├── effects.ts            # NEW: marks and square tokens on the table
│   └── room.ts, strip.ts     # TTS table, sky, Graveyard / Well board
├── physics/sandbox.ts        # colliders from the TTS collider meshes
└── ui/
    ├── hud/abilities.ts      # NEW: ability panel with Symbol Legend icons
    ├── targeting.ts          # NEW: pick squares / units / heroes for an ability on the table
    └── dialogs.ts            # reactions during the enemy Lead, choices (OR abilities, unit type)

public/tts/                   # generated by the import script (compressed images, meshes)

tests/
├── rules/abilities/engine.test.ts, effects.test.ts, modifiers.test.ts
├── rules/heroes/cavalier.test.ts, monk.test.ts, scout.test.ts, magus.test.ts
├── game/sheet-model.test.ts
└── e2e/heroes.spec.ts, sheets.spec.ts, tts-table.spec.ts
```

**Structure Decision**: Same single web project. Abilities get their own folders (engine and shared effects separate from per-hero content), so each hero can be built and reviewed alone.

## Build Order

| Phase | Scope | Stories | Done when |
| --- | --- | --- | --- |
| A | Asset import script, `assets.json` TTS keys, ability data + schema, model fields, save defaults | — | `npm test` green; `public/tts` built; data valid |
| B | Ability engine, shared effects, modifiers, targeting helpers, reactions; 001 abilities ported | US4 | Engine and effect tests pass; 001–003 green |
| C | Named heroes in setup and Epic forms from destiny | US1 | US1 tests pass |
| D | Starting abilities of the 4 heroes | US2 | US2-AS1…AS12 pass |
| E | Epic forms, one hero at a time (Cavalier → Magus → Scout → Monk; the Cultist last, since its details may still change, Q-40a/b) | US3 | Every ability has its scenario tests |
| F | TTS sheets with overlays, ability panel, targeting UI | US5 | Sheet screenshots, e2e ability use |
| G | TTS meshes, colliders, table, sky, boards, tokens | US6 | Frame rate and load checks pass |
| H | Sandbox editors for marks/uses/forms, contract guarantees, scripted game 04, docs | — | Quickstart passes |

## Risks

| Risk | Mitigation |
| --- | --- |
| About 75 abilities, many with unique rules: scope is large | Per-hero modules and phases; each hero is a mergeable increment; shared mechanisms first so most abilities are short |
| The sheets print older numbers than Hero Rules 2_0 (research R-11); the Cultist text is still a draft (Q-40a/b) | Hero Rules 2_0 is the data (clarified); sheet images get a corrected badge where they differ. The Cultist is built last, as data plus small effect functions, so later fixes stay local |
| Abilities that change core rules (Make Peace Not War, Portals, Converge Timelines, Timey-Wimey Shift, Religious Fervor tokens) touch Battle, check and turn order | Hooks in the core (path, battle, wound, turn order) instead of special cases; contract guarantees re-run with random playouts that use abilities |
| TTS meshes and 2048² textures are heavy | Import script decimates nothing but resizes textures to 1024², WebP/JPEG, and loads lazily after the board; fps test with the gpu project |
| The TTS sheets already contain text; when rules change they are wrong | The sheet model draws a corrected value badge where the data differs from the printed sheet, so data stays the source |

## Complexity Tracking

| Violation | Why needed | Simpler alternative rejected because |
| --- | --- | --- |
| Ability effects are code, not data (partial deviation from III) | ~75 abilities with distinct behaviour; expressing them as data needs a rule scripting language | A scripting DSL is more code, harder to test and against VI. Everything numeric, textual and visual stays data; code is one small function per ability id |
