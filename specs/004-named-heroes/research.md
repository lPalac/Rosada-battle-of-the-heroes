# Research: Named Heroes, Epic Forms and the Tabletop Simulator Look

**Feature**: `004-named-heroes` | **Date**: 2026-11-05 | **Spec**: [spec.md](./spec.md)

Phase 0 of `/speckit-plan`. Builds on 001–003 research. Each entry: decision, why, alternatives.

Sources reviewed:
- `Hero Rules 2_0.docx`: 351 paragraphs and 2 comments (Davor). No tracked changes.
- All 16 TTS hero sheet faces, the Symbol Legend, a portrait per hero, health bar 20, the Hero Destiny Pool, and the Graveyard / Destiny Well board.
- File list, sizes and image dimensions of the whole TTS folder.

---

## R-01 Ability engine

**Decision**: One generic engine in `src/rules/abilities/engine.ts`:
- `abilityOffers(state)` lists, for the active hero (and for reactions, the hero owning the reaction), every ability usable now, with its target choices. It checks:
  - the timing window;
  - form (starting / Epic) and Hero Unit / Unconscious status;
  - uses left or Destiny available (normal / Bloodied cost);
  - once per turn;
  - the ability's own condition function.
- Action `useAbility { abilityId, targets, pay?, option? }` validates through the same path, pays (001 payment rules), records the use and runs the effect.
- Passive ("Always Active") abilities have no action; they register **hooks** (lead modifier, path, Ram, wound, destroy, end of turn, generation) that the core calls.

001's Inspired Lead and Hero Retreat move onto the engine as "general abilities", which proves the engine on behaviour already tested.

**Why**: One validation path for UI, legalActions and tests (001 R-07 pattern). Hooks keep the core free of per-hero `if`s.

**Alternatives**: One action type per ability (rejected: ~75 action types, duplicated validation).

## R-02 Effects are code by id, everything else is data

**Decision**:
- `abilities.json` holds id, hero/form, timings, cost `{ normal, bloodied }` or `uses`, flags (`notAsHeroUnit`, `notRoyalty`, `mustNotCheck`, `oncePerTurn`, `instantOf: 'lead'`), icons, text keys, and numbers that vary (wounds, bonuses, ranges, durations).
- `src/rules/heroes/<hero>.ts` exports `{ [abilityId]: { condition, targets, effect, hooks } }`, reading its numbers from the data.
- A schema check fails when an ability id has no implementation, or an implementation has no data.

**Why**: Constitution III for every number and text, without inventing a rule language (VI). Changing a cost or a wound count stays a data change.

**Alternatives**: A JSON effect DSL (rejected: its interpreter would be bigger than the effects, and much harder to read).

## R-03 Timing windows

**Decision**:
- Phases from 001 stay. Windows map to them: Beginning of Turn, Before Move (= `beforeMove`), During Move (on each `moveStep`), Before Lead, Instead of Lead, During Lead (a choice attached to `announceLead`, e.g. Rapid March), After Lead, End of Turn, Before Turn (Timey-Wimey Shift), Beginning of Epic Stage (Smuggler's Grotto).
- An "Instead of Lead" ability counts as the turn's Lead attempt.
- A phase rests while an ability is usable (003 R-08 rule extended), so automatic phases still pass when nothing can be done.
- **During Enemy Lead** reactions (Paragon of Honour, Devious Gambit, Counterintelligence, Demoralise) are `pendingDecision`s for the reacting hero's player, raised at the exact point in the Lead (after announce, at Battle, before Destroy). This is the 001 decision mechanism, so undo and replay work unchanged.

**Why**: Reuses the phase machine and decisions, both proven by 001–003 tests.

## R-04 Effects model: marks, square tokens, Modify, lead modifiers

**Decision**: `GameState.effects: Effect[]`. Each effect has:
- `id`, `kind`, `source` (abilityId and heroId);
- a `target`: a unit, a hero, a square, a side, or a unit type;
- `expires`: `{ at: 'startOfTurn' | 'endOfTurn' | 'epicStage' | 'removed', heroId?, turns? }`;
- `data`.

Kinds used:
- `cannotLead`
- `cannotBattle`
- `cannotBeDestroyed` (and the in-Battle-only variant)
- `leadModifier` (on a unit or for Leads whose path is near a square)
- `aura` (centred on a hero)
- `token` (Bear Trap, Religious Fervor, Portal, Fireball, Temporal Flux, Grotto, Prophecy, Eternal War, Make Peace Not War)
- `modify` (temporary type, with `originalType`)
- `killOrder`, `divineProtector`, `paragon`, `demoralise`, `sacrifice`, `converge`

Expiry runs at phase boundaries in `turn.ts`. A Destroyed, Promoted or removed target drops its effects (spec edge case).

**Why**: About 20 behaviours share a handful of shapes. One list with expiries is easy to show (table, HUD), log and replay.

## R-05 Lead modifiers replace the fixed list

**Decision**: `computeModifiers` (001/003) collects modifiers from:
- the built-in sources: War, King in check, Inspired Lead, Hero Unit;
- effects: Preaching −4, Poison Water −3, Bear Trap −3 near, Elusive Sabotage −3;
- auras: Aura of Fear −2 / −3 Bloodied; Aura of Radiance +1; Patient Preparation +2; Seek Revenge +2; Future Sight +2; Blood Ritual +3 / +4; Righteous Might +1 per auxiliary pawn;
- ability uses.

`Modifier.source` becomes `string` with a text key. The Q-24 "cannot fail" rule (001) uses the total as before, and Make Peace Not War / Certainty & Death set "no roll".

**Why**: Many abilities are just a modifier with a condition.

## R-06 Paths, Battle and protection hooks

**Decision**: The core gets a small set of hook points that effects use:
- `pathFilter`: Portals, Draconic Descent's 2×2 path, Pilgrimage, Rapid March, Infiltrate's reversed pawn, the Dark Battlefield wilderness rule.
- `leadBlocked`: cannot be Led or cannot Battle; Eternal War's "must Battle".
- `onBattle`: Paragon swap, Devious Gambit, Counterintelligence escape, Red Carpet continuation, Crusade / Tight Formation protection.
- `onDestroyed`: Seek Revenge, Soul Syphon, Bad Omen, Temporal Flux, Converge original, Dark Pact.
- `onWound`: Divine Protector redirect, Elusive −2, Make Peace Not War, Zealot Mob.
- `onEndOfTurn`: Kill Order, Sacrifice, Fireball, Religious Fervor brewing, Grave Sacrifice generation.
- `onLeadPath`: Demoralise, Zealot Mob, Bear Trap, Breath of Fiery Destruction, Religious Fervor token.

Check, checkmate and "no eligible units" use the same filters (Q-43 default).

**Why**: The rules that abilities bend are few (who may be Led, which paths, what happens at Battle and wounds). Hooks there keep each ability local.

## R-07 Special units

**Decision**: `Unit.kind` stays `main | auxiliary | hero`, and `Unit.tags` adds `undead`, `legendaryAncient`, `demon`, `spy`, `clone`.
- The Legendary Ancient gets `health` (5) and takes wounds like a hero; it is Led one square in any direction (King-like path); it may use King's Banishment and King's Verdict; it takes 1 wound per Lead.
- The Shadow Demon has a King-like path, only Battles, and does not count for generation (003 R-04 excludes tags in `noGeneration`).
- Undead units are auxiliary with the tag, for their art.

**Why**: Reuses 003's auxiliary units and Create; tags keep special rules explicit.

## R-08 Hero data and setup

**Decision**:
- `heroes.json` gets four named entries (Cavalier, Monk, Scout, Magus) with stats from the TTS sheets and Hero Rules: Cavalier 10/20, Move 5, Range 1, Knight; Monk 10/20, 5, 1, Bishop; Scout 8/16, 3, 3, Knight; Magus 8/16, 3, 3, Bishop.
- Each entry has `forms: { fanatic, resolute, dominant }` with `{ id, name, art, sheet, abilities, stats? }` (Dragon Lord: Movement 6).
- Setup picks hero ids instead of range types. `Pick.rangeType` becomes derived, so `heroId` is the new key and setup actions take `{ heroDefinitionId }`.
- Generic entries stay for fixtures (Q-42). Duplicates follow Q-41's default.

## R-09 TTS asset import

**Decision**: `scripts/import-tts-assets.ts` (tsx, dev-only `sharp`). It reads a mapping table (R-10) and writes `public/tts/`:
- **Sheets**: 1500×902 JPEG at 85%, about 250 KB each.
- **Portraits**: 1020×1177 → 512 wide WebP.
- **Piece textures**: 2048² → 1024² WebP (diffuse) and 1024² PNG→WebP (normal).
- **Meshes**: piece OBJ meshes and colliders copied as is (0.6–2.4 MB each; gzip by the server); table mesh copied.
- **Large art**: Graveyard / Well board 5465×1380 → 2048 wide WebP; table diffuse → 2048²; sky 4000×2000 → 2048×1024 JPEG.
- **Tokens**: copied, or resized to 256².

It prints the `assets.json` entries to merge. The script runs only when the TTS folder changes; its output is committed, so builds don't need `sharp`.

**Why**: The raw folder is about 150 MB, mostly 2048² PNG textures; the web build must stay small for the 10 s first load (FR-022).

**Alternatives**: Using the files raw (rejected: load time). Converting in the browser at runtime (rejected: slow first load, still downloads everything).

## R-10 Asset mapping (from viewing the files)

| Key | File(s) | Notes |
| --- | --- | --- |
| `sheet.cavalier` / `sheet.deathKnight` / `sheet.dragonLord` / `sheet.holyPaladin` | `Custom_Tile__Image__b18778` / `Image__005dad` / `ImageBack__b18778` / `ImageBack__005dad` | Fanatic / Resolute / Dominant printed on the sheets |
| `sheet.monk` / `sheet.saint` / `sheet.supremeInquisitor` | `Image__c32610` / `ImageBack__c32610` / `ImageBack__d037f6` | The Cultist has no sheet image: canvas-drawn sheet (R-13). `Image__d037f6` (Dark Prophet) is not used, its text is the old form |
| `sheet.scout` / `sheet.scoundrel` / `sheet.spyMaster` / `sheet.royalAssassin` | `Image__176642` / `Image__7936e1` / `ImageBack__176642` (to confirm at import) / `ImageBack__7936e1` | |
| `sheet.magus` / `sheet.necromancer` / `sheet.grandArcanist` / `sheet.chronomonger` | `Image__5d643b` / `Image__199d3e` / `ImageBack__5d643b` / `ImageBack__199d3e` | |
| `portrait.<hero>[.<form>]` | `Cavalier_dark__Image__*`, `Mank_light__Image__*`, `Scout_light__Image__*`, `Magus_light`, `Magus_Necromancer_light`, `Magus_Grand-Arcanist_light`, `Magus_Cronomonger_light` | 4 per hero, base + 3 forms (order to confirm at import) |
| `legend` | `Custom_Tile__Image__b2ed5d` | Symbol Legend; icons are cut from it for the HUD |
| `bar.16`, `bar.20` | `Health Bar 16__Image`, `Health Bar 20__Image` | Red part = Bloodied area; Destiny marks = Resilient points |
| `pool.hero`, `pool.common.light` | `Hero Pool 1__Image`, `Common Destiny Pool Light__Image` | |
| `strip.graveyard` | `Grave Yard_D Well__Image` | Graveyard / Well / Well / Graveyard board |
| `token.peace` / `token.war` | `Peace_War__Image`, `Peace_War_Custom_Token__Image__5c7861` | Two faces |
| `token.ability.<id>` | `Arcane Shackles`, `Bad Omen`, `Banishment`, `Certainty & Death`, `Charge Enemy Lines`, `Converge Timelines`, `Counter-inteligence`, `Crusade`, `Dark Pact`, `Divine Protector`, `Infiltrate Spy`, `Inquisition`, `Kill Order`, `Martyrdom 02`, `Mislead`, `Paragon of Honour`, `Poison Water`, `Preaching 01`, `Sanctimonious`, `Seek Revenge` | 380×285 marker tokens |
| `marker.auxiliary.<type>` | `Aux Pawn/Knight/Bishop/Rook/Queen__Image__*` (two colours each) | Auxiliary unit tokens |
| `unit.<side>.<type>` | `<Type>__Mesh.obj` + `__Diffuse__*` (two colours) + `__Normal`; `__Collider.obj` for physics | `Aux Queen__Mesh` for an auxiliary Queen |
| `table.top`, `room.sky` | `Table__Mesh.obj` + `Table__Diffuse`, `Table_Sky__Sky.jpg` | |
| (to sort at import) | `Custom_Token__Image__*` (about 30 small tokens), `<Hero>_Custom_Token__Image__*`, `Custom_Model__*`, `Custom_Tile__Image__22e7d5 / fff643 / 556301 / fef92d`, `Custom_PDF__PDF__368c04.pdf` | Viewed and named during the import task. Unused files are not shipped |

## R-11 Hero Rules 2_0 vs the TTS sheets (Q-38)

Read side by side. The sheets are an earlier balance: Bloodied costs are higher on almost every sheet, and a few abilities and timings differ. **Clarified: Hero Rules 2_0 is the source of truth** (spec FR-001a); the table below lists where the sheet art prints something else:

| Hero / form | Differences (Hero Rules 2_0 → sheet) |
| --- | --- |
| Cavalier | Demoralise: 1 use, After Lead, marks the Cavalier → sheet: During Enemy Lead, no mark. Tight Formation → sheet has Charge Enemy Lines instead |
| Dragon Lord | Breath 3/4 → 3/5; Draconic Descent 4/5 → 4/6; Terrifying Roar 5/6 → 5/8; Great Wyrm Offering 9/11 → 9/13 |
| Holy Paladin | Paragon of Honour After Lead → During enemy Lead; Crusade 4/5 → 4/6; Knight a Peasant 5/6 → 5/8; Holy Wrath 9/11 → 9/13 |
| Saint | Saintly Inspiration 1 → 1/1; Sacred Rite 3/4 → 3/5; Pilgrimage 3/4 → 3/5; Martyrdom 8/10 → 8/12; Wings of Destiny 8/10 → 8/12 |
| Supreme Inquisitor | Inquisition 4/5 → 4/6; Sanctimonious 4/5 → 4/6; Blind Faith 5/6 → 5/8; Dogmatic Indoctrination 9/11 → 9/13 |
| Royal Assassin | Kill Order 4/5 → 4/6; Assassinate 5/6 → 5/8; Reap the Weary 6/8 → 6/9; Red Carpet 8/10 → 8/12; Regicide 8/10 → 8/12 |
| Necromancer | Grave Sacrifice End of Turn → Always Active; Leeching Touch 3/5 → 3/6; Awaken the Deathless 6/8 → 5/7; Undead Legions 10/15 → 10/16 |
| Grand Arcanist | Magic Bombardment 3/4 → 3/5; Arcane Shackles 4/5 → 4/6; Conjure Portal 6/8 → 6/9; Shadow Demon 8/10 → 7/10; Fireball 13/16 → 13/17 |
| Chronomonger | Rapid March 3/4 → 3/5; Timey-Wimey 4/5 → 4/6; Converge Timelines 6/8 → 6/9; Temporal Flux 9/11 → 9/13 |
| Monk Fanatic | Hero Rules: Cultist (built, R-13) → sheet: Dark Prophet (not used) |
| Death Knight, Scoundrel, Monk, Scout, Magus | Same |

Because the sheet images print the old numbers, the sheet model adds a small corrected badge over a cost that differs from the data (R-12).

## R-12 Hero sheets on the table

**Decision**: The sheet mesh uses the TTS sheet image, 1500×902 at about 4.4 × 2.65 world units, like 003's sheet size scaled up. Laid out as in Tabletop Simulator:
- the health bar image along the sheet's board-side edge, with a marker at the current health;
- the Hero Destiny Pool image beside the sheet, with that many crystals;
- the 003 medallion in the "Turn Order" circle at the bottom centre;
- one Destiny token per remaining use on the ability's Destiny symbols;
- the Destiny generation tracker as a row of small markers under the sheet.

A canvas overlay layer only draws badges (costs that differ from the data, Bloodied, Unconscious) and the hover highlight of a usable ability. The 003 canvas-drawn sheet stays as the fallback for heroes without sheet art (generic heroes).

The HUD ability panel shows the same abilities as text, with Symbol Legend icons, cost (normal / Bloodied), timing and "usable now", and starts targeting on the table (`ui/targeting.ts`).

**Why**: The sheet images carry the art and layout players know; overlays keep the state live without redrawing the art.

**Alternatives**: Redrawing the sheets from data on a canvas (rejected: loses the art the user wants to see).

## R-13 The Cultist (Monk, Fanatic)

**Decision** (clarified twice: the Cultist is the Monk's Fanatic Epic form, and Luka named its abilities). The Hero Rules 2_0 section also holds leftovers from a past hero: Predestiny, Bad Omen, Prophecy of Bloodshed, the second False Salvation (6/9) and Phantom of Eternal War. They are not part of the game. The Cultist is:

| Ability | Cost | Timing | Effect (Hero Rules 2_0) |
| --- | --- | --- | --- |
| Righteous Might | – | Always Active | Friendly auxiliary units in your square can only be Destroyed in Battle. +1 to Leads into Battle per friendly auxiliary pawn |
| Spiritual Healing | 1/2 | Before Move / After Lead | Heal yourself 1 + 1 per adjacent friendly auxiliary unit |
| Religious Fervor | 3/6 | Before Lead / After Lead | Token on an adjacent square: counts as occupied but does not block Leads through or onto it. At the end of your next turn it becomes an auxiliary Pawn; at the end of the turn after, an auxiliary Bishop is added there. Bloodied: straight to the Bishop. Removed when an enemy unit is Led onto or through it, or an enemy hero interacts with its square (that hero takes 3 wounds) |
| Knightmare | – | Always Active (after a Lead that forks) | After forking with a Knight, that Knight and the 2 forked enemy units cannot be Led; marks removed at the beginning of your next turn |
| Sacrifice | 4/5 | After Lead | Mark a friendly Pawn. At the end of your next turn: remove the mark, Destroy the Pawn if it is not on a starting square of its type, and deal 3 wounds to enemy heroes within 2 squares of it |
| False Salvation | 6/8 | After Lead | Destroy an adjacent enemy Pawn not on a starting square of its type, then create a friendly auxiliary Pawn there (Bloodied, the "/" option: return a Destroyed friendly main Pawn from the Graveyard there instead) |
| Dream of Ill Fate | 2/4 | Before Lead | Choose a unit type. An enemy hero who Leads a unit of that type on the next turn takes 4 wounds (not royalty: the ability marks unit types with *, so King and Queen cannot be chosen) |

- **Not part of the game:** Predestiny, Bad Omen, Prophecy of Bloodshed, False Salvation 6/9 and Phantom of Eternal War (leftovers from a past hero, clarified).
- **Names:** "Cultist" for now; "Reaver / Lord / Occultist" are naming hints that may be added later (Q-40b). "Righteous Might" for the passive. Both are strings, so renaming is a data change.
- **Sheet:** a canvas-drawn sheet in the TTS layout (stats, abilities from data, Monk border colours), with a Monk Fanatic portrait from `Mank_light__Image__*`.
- **Fix later:** wording details stay in spec Q-40b. A change to the Cultist is a data change plus that ability's effect function, with no engine change.
