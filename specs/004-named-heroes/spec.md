# Feature Specification: Named Heroes, Epic Forms and the Tabletop Simulator Look

**Feature Branch**: `004-named-heroes`

**Created**: 2026-11-05

**Status**: Draft

**Input**: User description: "Next plan is adding 4 heroes and their epic stages. You are also adding new hero sheets: change them into something more like in the examples, and use tokens and assets from the new pool (`assets/Table top simulator tokens and other/`). Those are all assets added from Tabletop Simulator. If you find something useful, use it. Rules source: Hero Rules 2_0.docx."

**Builds on**: `specs/001-standard-rules-game` (rules core, abilities Inspired Lead / Hero Retreat), `specs/002-sandbox-physics` (physical sandbox) and `specs/003-epic-stage` (Epic Stage, destinies, Bloodied, Royal Favors, Hero Units, auxiliary units, Create, table visuals).

**Source rules**: `Hero Rules 2_0.docx` (the four heroes, their abilities and their three Epic forms each) on top of `Basic Rules 2_5.docx` + corrections. Where the Hero Rules leave a choice open (text like "2/3", "Reaver/Lord/Occultist", notes such as "(needs pics)"), it is listed in Open Questions.

**Reference art**: `assets/Table top simulator tokens and other/` (Tabletop Simulator export): 16 hero sheet faces (1500×902, starting hero + 3 Epic forms per hero), hero portraits (1020×1177), the Symbol Legend, health bars 16/20, Hero Destiny Pool, Common Destiny Pool, Graveyard / Destiny Well board, Peace / War token, ability tokens, auxiliary unit tokens, the six piece meshes with textures and colliders, the table mesh and the sky.

---

## Clarifications

### Session 2026-11-05

- Q: Hero Rules 2_0 and the TTS sheets disagree (abilities, costs, timings). Which wins? → A: The rules. Hero Rules 2_0 is the source of truth; the sheets are art only.
- Q: Monk's Fanatic form: the unfinished "Cultist" section of Hero Rules 2_0 or the TTS "Dark Prophet" sheet? → A: The new Cultist from Hero Rules 2_0; a few details may be fixed later.
- Q: In Draft, can both sides pick the same named hero? → A: No in Draft (each hero once); yes in Mirror.
- Q: Which abilities belong to the Cultist? → A: Righteous Might, Spiritual Healing, Religious Fervor, Knightmare, Sacrifice, False Salvation (6/8) and Dream of Ill Fate. Everything else in that section (Predestiny, Bad Omen, Prophecy of Bloodshed, the second False Salvation, Phantom of Eternal War) is left over from a past hero and is not part of the game. The Cultist is the Monk's Fanatic Epic form; "Reaver / Lord / Occultist" are naming hints that may be added to the name later.

---

## Scope

**In:**
- The four heroes as Starting Heroes: **Cavalier** (Short range, Knight), **Monk** (Short range, Bishop), **Scout** (Long range, Knight) and **Magus** (Long range, Bishop), picked in setup instead of the generic heroes. Their stats, Hero Unit type and starting abilities.
- Their twelve Epic forms, chosen by destiny at the Epic Stage (003):
  - Cavalier: Death Knight (Fanatic), Dragon Lord (Resolute), Holy Paladin (Dominant).
  - Monk: Cultist (Fanatic, clarified; contents in research R-13), Saint (Resolute), Supreme Inquisitor (Dominant).
  - Scout: Scoundrel (Fanatic), Spy Master (Resolute), Royal Assassin (Dominant).
  - Magus: Necromancer (Fanatic), Grand Arcanist (Resolute), Chronomonger (Dominant).
- What their abilities need from the rules core:
  - timing windows;
  - Destiny costs with Bloodied costs, and limited uses;
  - Mark, Modify and Push;
  - tokens on squares and on units;
  - auras and lead modifiers;
  - special auxiliary units (undead, Legendary Ancient, Shadow Demon);
  - Create variants;
  - "Must not check the King" (not for discovered checks);
  - hero-to-hero wounds and heals.
- Hero sheets on the table built from the Tabletop Simulator sheets, with the health bar, Hero Destiny Pool, turn-order medallion and generation tracker placed on and around them like in Tabletop Simulator. The Epic sheet replaces the starting sheet.
- The Tabletop Simulator assets where they help: piece meshes and textures, table, sky, Graveyard / Well board, pools, Peace / War token, ability and auxiliary tokens. All referenced from `assets.json`.

**Out (later features):**
- Heroes beyond these four (the legend lists Warrior, Sage, Tinkerer, Shaman).
- Online play.
- AI players.
- Abilities the rulebook marks as variants.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 – Pick a named hero (Priority: P1)

In setup each side picks its heroes from Cavalier, Monk, Scout and Magus (Draft or Mirror, as in 001). The hero's sheet, figure art, stats, Hero Unit type and starting abilities come from its data.

**Why this priority**: Everything else in this feature is attached to a named hero.

**Independent Test**: Draft Cavalier, Scout, Monk, Magus; check each hero's stats, Hero Unit type and the abilities offered in its first turn.

**Acceptance Scenarios**:

1. **Given** setup, **Then** the hero choices are the four named heroes with their range type, Movement, Range, health and Hero Unit type (Cavalier 10, Move 5, Range 1, Knight; Monk 10, 5, 1, Bishop; Scout 8, 3, 3, Knight; Magus 8, 3, 3, Bishop).
2. **Given** a named hero becomes a Hero Unit (003), **Then** it uses its own Hero Unit type (Scout → Knight, Monk → Bishop), not the generic range-type mapping.
3. **Given** a game in progress, **Then** each hero's sheet on the table and in the HUD shows its name, portrait, stats and abilities with costs, timing and remaining uses.
4. **Given** the generic heroes from 001, **Then** they stay available for tests and the position editor but are not offered in a normal setup (Q-42).

---

### User Story 2 – Starting Hero abilities (Priority: P1)

Each Starting Hero has its passive ability and its limited-use abilities (shown as Destiny symbols on the sheet), usable in their timing windows.

**Why this priority**: The first half of every game.

**Independent Test**: For each hero, play a position that uses each starting ability and check effect, uses left and timing.

**Acceptance Scenarios** (one per ability; text from Hero Rules 2_0):

1. **Cavalier – Warhorse**: once per turn, after Lead, the Cavalier may move one square.
2. **Cavalier – Demoralise** (1 use, Before Move / After Lead): the Cavalier is marked. An enemy Lead whose unit passes through a square adjacent to the Cavalier and leaves its range fails, and the token is removed. If no Lead failed, the token is removed at the start of the Cavalier's next turn. Royalty is not affected.
3. **Cavalier – Tight Formation** (1 use, Instead of Lead): Lead a friendly Knight without Battle; it cannot be Destroyed in Battle on the next turn.
4. **Monk – Rejuvenating Stroll**: once per turn, during Move or Lead, heal a friendly hero 1 when passing through its square.
5. **Monk – Preaching** (2 uses, Before Move / Before Lead / After Lead): mark an adjacent enemy unit (not royalty); it has −4 to be Led on the next turn. Both uses on the same unit mean it cannot be Led on the next turn.
6. **Monk – Make Peace Not War** (1 use, Beginning of Turn, while War is declared and the own King is not in check): until the Monk's next turn units are not Destroyed, heroes take no wounds, Leads need no roll and a Lead may not give check. If a King is Led into Battle or deals wounds to a hero, the token is removed.
7. **Scout – Elusive**: Ram wounds −2. The Scout may end its Move on a square with an enemy unit (not royalty); while there, units on that square cannot Ram it.
8. **Scout – Bear Traps** (1 use, Before Move / After Lead): a Bear Trap token goes on the Scout's square if it has no unit. Enemy Leads interacting with squares adjacent to it get −3. An enemy hero interacting with its square takes 4 wounds and the trap is removed; an enemy unit Led onto it also removes it. It stays in the Epic Stage.
9. **Scout – Poison Water** (1 use, Before Move / Before Lead): mark an enemy unit in the Scout's square. It cannot be Led on the next turn, and later Leads with it get −3 until the Epic Stage starts.
10. **Magus – Future Sight** (Before Lead): take 1 wound, +2 to the next Lead.
11. **Magus – Flaming Bolt** (2 uses, Before Move / After Lead): 2 wounds to an enemy hero in range.
12. **Magus – Souls Clash** (1 use, After Lead): Destroy an adjacent friendly Pawn, then Destroy an enemy Pawn in the same file within 3 squares of it, and heal 3.

---

### User Story 3 – Epic forms (Priority: P1)

At the Epic Stage (003) each hero's destiny selects its Epic form. The Epic sheet replaces the starting sheet; its abilities cost Destiny, more while the hero is Bloodied (the red number).

**Why this priority**: The second half of the game and the reason for the destiny choice.

**Independent Test**: Reach the Epic Stage with each hero, choose each destiny, and check the form's sheet, abilities and costs (normal and Bloodied).

**Acceptance Scenarios**:

1. **Given** a hero chooses a destiny, **Then** it becomes that destiny's Epic form (e.g. Cavalier + Fanatic → Death Knight), and its sheet, name and art change.
2. **Given** an Epic ability with cost "X/Y", **Then** it costs X Destiny, or Y while the hero is Bloodied (003 FR-012). A value written "a/b" in the text (e.g. "−2/−3", "2/4 wounds") is a when not Bloodied and b when Bloodied.
3. **Given** an Epic ability, **Then** it can be used only in its timing window and at most once per turn unless it says otherwise, and only when its conditions hold (adjacent, in range, unoccupied, not royalty, "Must not check the King").
4. **Given** an "Always Active" ability, **Then** its effect applies without an action while the hero is in that form.
5. For each of the 12 forms, every listed ability has at least one scenario test of its main effect and one of a refusal (US3-AS5 … are generated per ability in tasks).

---

### User Story 4 – Marks, tokens, Modify and Push (Priority: P1)

Many abilities place a mark or token that changes later Leads, or change a unit's type for a while. Players see them on the table and in the HUD, and they expire on time.

**Why this priority**: Shared by most abilities; without it US2 and US3 cannot be built.

**Independent Test**: Place a mark that blocks a Lead, a token that changes Lead modifiers, and a Modify that lasts until the end of the next turn; check them in the HUD, on the table and when they expire.

**Acceptance Scenarios**:

1. **Given** a unit marked "cannot be Led" (Preaching ×2, Poison Water, Mislead, Arcane Shackles, Martyrdom, Knightmare), **Then** it offers no Lead targets while marked, and checkmate (001) treats it as unable to move (Q-43).
2. **Given** a square token (Bear Trap, Religious Fervor, Portal, Fireball, Temporal Flux, Smuggler's Grotto), **Then** it is shown on that square, affects paths and Leads as written, and is removed when its condition happens.
3. **Given** a Modify (Inquisition, Knight a Peasant), **Then** the unit has the new type for paths, threats and generation, and returns to its original type when it ends (Inquisition: at the end of the Inquisitor's next turn; Knight a Peasant: permanent).
4. **Given** a Push (Terrifying Roar, Misdirection, Bushwack, Misinformation), **Then** the target moves one unoccupied square in the stated direction, or not at all if that square is blocked.
5. **Given** every mark or token, **Then** the log records when it is placed and removed, and undo and replay restore it (001 guarantee 3a).

---

### User Story 5 – Hero sheets like the Tabletop Simulator version (Priority: P2)

Each hero's sheet on the table is the Tabletop Simulator sheet image, with the health bar, Hero Destiny Pool, turn-order medallion and Destiny generation tracker placed around it the same way. Ability uses and marks show as tokens.

**Why this priority**: Requested; players recognise the physical prototype.

**Independent Test**: A default-camera screenshot shows the four sheets with their art, health bars with a marker, pools with crystals, medallions in the "Turn Order" slot, and ability-use tokens. Compare with the Tabletop Simulator screenshots.

**Acceptance Scenarios**:

1. **Given** a hero, **Then** its sheet shows the starting sheet image; in the Epic Stage it shows the Epic form's sheet image.
2. **Given** a hero's health, **Then** the matching health bar image (16 or 20) lies along the sheet with a marker at the current health, and the red (Bloodied) part is visible.
3. **Given** a hero's pool, **Then** the Hero Destiny Pool image lies beside the sheet with that many Destiny crystals on it; the Common Pools use the Common Destiny Pool image.
4. **Given** the turn order, **Then** the medallion sits in the sheet's "Turn Order" slot and the active hero's glows.
5. **Given** a limited-use ability, **Then** its remaining uses show as Destiny tokens on its sheet slot and disappear as they are used.
6. **Given** the HUD, **Then** a hero panel shows the same abilities as text with icons from the Symbol Legend, costs (normal / Bloodied), timing and whether they can be used now.

---

### User Story 6 – Tabletop Simulator pieces and table (Priority: P2)

The placeholder pieces, table and tokens are replaced by the Tabletop Simulator models and images where they exist.

**Why this priority**: Requested ("if you find something useful, use it"); the assets are ready.

**Independent Test**: The table shows the TTS piece meshes in both colours, the TTS table and sky, the Graveyard / Destiny Well board, the Peace / War token and auxiliary unit tokens; the 002 physics still works and the frame rate holds.

**Acceptance Scenarios**:

1. **Given** units, **Then** they use the TTS meshes with the light or dark texture; physics uses the TTS collider meshes.
2. **Given** an auxiliary unit, **Then** it shows the matching auxiliary token.
3. **Given** the table, **Then** the TTS table mesh, sky, Graveyard / Destiny Well board, Common Pools and Peace / War token are used.
4. **Given** any of these assets, **Then** it is referenced from `assets.json` with a placeholder fallback (001 FR-113), and the first load and frame rate meet the 001 targets.

---

### Edge Cases

- Two abilities with the same timing → the player chooses the order; each resolves fully before the next.
- An ability whose target becomes invalid while its effect waits (Kill Order target promoted, Converge Timelines copy Destroyed) → the effect ends without effect; logged.
- Effects that stop wounds or Destruction (Make Peace Not War, Divine Protector, Arcane Shackles, Crusade) meet effects that cause them (Fireball, Holy Wrath, Kill Order) → the protection wins while it lasts (Q-44).
- A marked or Modified unit is Promoted, Destroyed or leaves play → its marks are removed.
- A hero is Unconscious or a Hero Unit → "Cannot be used while you are a Hero unit" abilities are not offered; Always Active effects of an Unconscious hero do not apply (Q-45).
- Sandbox: marks, tokens, uses and the Epic form can be edited and are checked when rules resume.
- A save from 003 → plays on with generic heroes.

## Requirements *(mandatory)*

### Functional Requirements

**Heroes and data**

- **FR-001**: Heroes MUST be data (`heroes.json`): name, range type, Movement, Range, health bar, Hero Unit type, sheet and portrait art keys, starting abilities, and per destiny the Epic form (name, art, abilities, stat changes such as Winged Stride's Movement 6).
- **FR-001a**: Hero Rules 2_0 MUST be the source for every ability, cost, value and timing. The TTS sheet images are art only; where they print something else, the sheet MUST show the rule value over it (clarified).
- **FR-002**: Abilities MUST be data with name, timing windows, cost (normal / Bloodied) or uses, conditions, "Always Active" or action, "Cannot be used while you are a Hero unit", "Does not work on royalty", "Must not check the King", and text keys. Their effects are rules-core code selected by ability id.
- **FR-003**: Setup MUST offer the four named heroes. Each side picks as in 001 (Draft L, D, D, L; Mirror). In Draft each named hero can be picked only once; in Mirror both sides have the same heroes (clarified).

**Ability engine**

- **FR-010**: The rules core MUST offer each usable ability as a legal action in its timing window (Beginning of Turn, Before Move, During Move, After Lead, Before Lead, Instead of Lead, During Lead, End of Turn, During Enemy Lead, Before Turn, Beginning of Epic Stage), with its targets.
- **FR-011**: Paying MUST use the 001 payment rules (hero pool then Common Pool, or the player's split); the Bloodied cost applies while the hero is Bloodied.
- **FR-012**: Limited uses (Starting Heroes) MUST be tracked per hero and shown.
- **FR-013**: Marks, square tokens, Modify, Push, Create (undead, auxiliary, Legendary Ancient, Shadow Demon) and lead modifiers (auras, penalties, bonuses) MUST be general mechanisms that abilities use, with durations ("next turn", "until the beginning of your next turn", "until the end of your next turn", "until removed", "until the Epic Stage").
- **FR-014**: "Must not check the King" MUST refuse an effect that would put a King in check, except by discovered check (Symbol Legend).
- **FR-015**: "During Enemy Lead" abilities (Paragon of Honour, Devious Gambit, Counterintelligence's reaction) MUST be offered to their owner as a pending decision during the enemy's Lead, like 001 decisions. Demoralise is not a reaction: its mark makes the enemy Lead fail automatically (Hero Rules 2_0).
- **FR-017**: The Basic Rules King's Powers apply to hero abilities: **King's Supremacy** (the King and its square are immune to hero abilities and ignore their effects, e.g. Make Peace Not War and Lead modifiers) and **King's Verdict** (a King's Lead removes every token on the squares it interacts with). The Legendary Ancient also uses King's Banishment and King's Verdict.
- **FR-018**: The Peace Treaty flips to War when either side uses an ability affecting an enemy unit (Peace Treaty token text), as well as on the first Destiny gain (001).
- **FR-016**: Every ability use, effect, mark and expiry MUST appear in the log and replay exactly (no seed).

**Table and art**

- **FR-020**: Hero sheets MUST use the TTS sheet images (`sheet.<hero>.<form>`), with the health bar, pool, medallion and generation tracker laid out as in the Tabletop Simulator version.
- **FR-021**: Pieces, table, sky, Graveyard / Well board, pools, tokens and auxiliary markers MUST use the TTS assets through `assets.json`, with placeholders as fallback.
- **FR-022**: Large TTS images MUST be resized or compressed for the web so the first load stays under the 001 target (10 s) and the 60 fps target holds.

**Carry-over**

- **FR-030**: All 001–003 tests MUST keep passing with the generic heroes; every acceptance scenario of this feature MUST have an automated test.

### Key Entities

- **Hero definition**: named hero with stats, Hero Unit type, art keys, starting abilities and three Epic forms.
- **Ability definition**: id, timings, cost or uses, conditions, effect id, text keys, icon keys.
- **Ability state** (per hero): uses left, used this turn, active effects.
- **Effect**: a mark on a unit or hero, a token on a square, a Modify, or a lead modifier, each with an owner, a target, an expiry and a source ability.
- **Special unit**: auxiliary variants with their own rules (undead, Legendary Ancient with health, Shadow Demon).

## Success Criteria *(mandatory)*

- **SC-001**: Each of the 4 heroes and 12 Epic forms can be played through a full game in hot-seat without manual rule fixes in 3 internal playtests.
- **SC-002**: A referee agrees with the game's ability results (effects, costs, uses, expiries) on 100% of uses in 2 refereed playtests per hero.
- **SC-003**: People who know the Tabletop Simulator version recognise their hero sheet, health bar, pool and tokens without help in 4 of 5 interviews.
- **SC-004**: First load ≤ 10 s and 60 fps on the 001 reference machine with the TTS meshes and sheets; all 001–003 tests pass.

## Open Questions

| # | Question | Who | Blocking? |
| --- | --- | --- | --- |
| Q-38 | ~~Hero Rules 2_0 vs the TTS sheets~~ Resolved (clarified): Hero Rules 2_0 is the source of truth. | Luka | Resolved |
| Q-39 | What does "X/Y" mean in costs and values? Default: X normal, Y while Bloodied (red on the sheets). | Luka | No |
| Q-40 | ~~Monk Fanatic form~~ Resolved (clarified): the new Cultist from Hero Rules 2_0. | Luka | Resolved |
| Q-40a | ~~Which abilities belong to the Cultist~~ Resolved (clarified): the seven listed in research R-13. | Luka | Resolved |
| Q-40b | Cultist details left open in the text: the full name (Cultist + a hint such as Reaver / Lord / Occultist); the passive's name (Righteous Might, or Shield / Strength of Fate / Faith, Might of the Faithful); Religious Fervor's token removal (two wordings); Knightmare has no cost. Default: "Cultist", "Righteous Might", the wordings in R-13, Knightmare is Always Active. Names are strings in data, so a rename is a data change. | Luka | No (to fix later) |
| Q-41 | ~~Duplicate picks~~ Resolved (clarified): no in Draft, yes in Mirror. | Luka | Resolved |
| Q-42 | Do the generic heroes stay selectable in setup? Default: no; they stay for tests and the position editor. | Luka | No |
| Q-43 | Are units that "cannot be Led" counted when checking checkmate and "no eligible units"? Default: yes, a marked unit counts as unable to move for both. | Rules designer | No |
| Q-44 | Protection vs damage: does a protection (Make Peace Not War, Divine Protector, Arcane Shackles, Crusade) always beat an effect that wounds or Destroys? Default: yes, while the protection lasts. | Rules designer | No |
| Q-45 | Do Always Active abilities work while the hero is Unconscious? Default: no. | Rules designer | No |
| Q-46 | Draft notes left in Hero Rules 2_0: "(maybe pic explain)", "(ref pic need)", "(check Bear trap wording)", the comment on Terrifying Roar's wording (Davor), "NOTE: what happens to marks on the unit" (Converge Timelines), Bear Traps vs Make Peace Not War (comment). Default: build the written text; Converge Timelines copies do not copy marks; Make Peace Not War stops Bear Trap wounds. | Rules designer | No |
| Q-47 | The Legendary Ancient has no unit type in Hero Rules 2_0. Default: created as a Knight-shaped auxiliary unit with a King-like path (one square in any direction); it does not count as a unit type for Destiny Generation, like the Shadow Demon. | Rules designer | No |
| Q-48 | Undead Legions (Bloodied): "you can instantly make a Lead, without initiating Battle, with one of the created Pawns". Default: an extra move of one created Pawn without a roll, offered as a choice right after the ability. | Rules designer | No |
| Q-49 | Shadow Demon "unit*": the TTS tokens show Demons of several types (Rook, Knight, Bishop, Pawn). Default: the player chooses a non-royal type; the Demon moves as that type but only into Battle (research R-07 corrected). | Rules designer | No |
| Q-50 | Preaching "If you spend both uses of this ability": Default: both uses may be spent in the same turn (the ability is not once per turn); the second use on a unit already Preached makes it unable to be Led on the next turn. | Rules designer | No |
| Q-51 | Hero Rules abilities that heal, move or create without saying "enemy" or "friendly" (Leeching Touch "an adjacent hero", Magic Bombardment "a hero in range" / "an adjacent auxiliary unit"). Default: Leeching Touch and Magic Bombardment's wound option target enemy heroes; Magic Bombardment's Destroy option targets any auxiliary unit. | Rules designer | No |

## Assumptions

- **A-01**: Destiny names stay Fanatic / Resolute / Dominant (003). The Epic form order is from the sheets: Cavalier — Death Knight, Dragon Lord, Holy Paladin; Magus — Necromancer, Grand Arcanist, Chronomonger; Scout — Scoundrel, Spy Master, Royal Assassin; Monk — Cultist (clarified), Saint, Supreme Inquisitor. This confirms 003 Q-36.
- **A-05**: The Cultist has no TTS sheet. It uses the canvas-drawn sheet (003 style) with its abilities from data, and the Monk's Fanatic portrait art, until a Cultist sheet image exists.
- **A-02**: A hero's Epic form replaces its starting abilities (the Epic sheets do not repeat them).
- **A-03**: Numbers before starting ability names ("1 Demoralise", "2 Preaching") are uses per game, shown as Destiny symbols on the sheet.
- **A-04**: The TTS assets are Luka's own and may be shipped with the game.
