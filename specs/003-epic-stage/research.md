# Research: Epic Stage, Destiny Generation, Royal Favors and Legendary Powers

**Feature**: `003-epic-stage` | **Date**: 2026-11-04 | **Spec**: [spec.md](./spec.md)

Phase 0 of `/speckit-plan`. Builds on 001 and 002 research (001 R-nn, 002 R-nn). Each entry: decision, why, alternatives. No new dependencies.

---

## R-01 Stage in the state

**Decision**: `GameState.stage: 'starting' | 'epic'`, `destiny.well.depletedBy: HeroId | null` and `epicPending: boolean`. `gain()` (001 R-09) records `depletedBy` = the active hero when the initial 16 run out and sets `epicPending`. At the next `beforeTurn` (after the checkmate check, so a mate still ends the game first) the rules core opens the destiny choice. When the last hero has chosen, it applies the Epic Stage in one step (R-02) and sets `stage = 'epic'`.

**Why**: The rulebook ties the start to the *next* Before Turn (spec FR-001); a flag plus the existing phase machine (001 R-08) does that without a new phase. The Well stays "unlimited after depletion" as in 001, which matches "all Destiny not in pools is added to the Well".

## R-02 Destiny choice as decisions

**Decision**: One `pendingDecision: epicDestiny { heroId, options }` per hero, queued in turn order from the active hero with the depleting hero moved to the end (spec FR-002). `options` excludes Dominant if the side's other hero chose Fanatic, and the other way round. Answer: `decide { type: 'destiny', destiny }`. After the last answer:
1. *Manifest Epic Destiny* to the depleting hero's side (Royal Favor, R-05).
2. Each side's Common Pool split: `floor(c / 2)` to each hero, `c mod 2` stays.
3. `maxHealth` and `health` rise by `epicMaxHealth − maxHealth` from `heroes.json` (+10 Short, +8 Long).
4. `tokens.peaceTreaty = 'removed'`; the War +2 ends (clarified).
5. `stage = 'epic'`, `hero.epic = { destiny }`.

**Why**: Decisions already block other actions, are answered by whoever holds the device, and replay from the log (001 contract guarantee 4).

## R-03 Lead modifiers in the Epic Stage

**Decision**: `computeModifiers` adds War +2 only while `peaceTreaty === 'war'`; with `'removed'` there is no War bonus and Leads need a roll (target 6) unless another rule says otherwise (King, Revenge, or the 001 Q-24 "cannot fail" rule). `flipToWar` only acts on `'peace'`.

**Why**: Spec clarification Q2: "in the Epic Stage a Lead roll of 1–5 without any bonus fails and 6+ succeeds".

## R-04 Destiny generation and Bloodied are derived

**Decision**: Pure functions, never stored:
- `destinyGeneration(state, side)` = 1 + number of types in {Queen, Rook, Bishop, Knight, Pawn} with no friendly *main or auxiliary* unit on the board (Hero Units excluded; clarified) + 1 if any friendly auxiliary pawn stands on the enemy royal rank. Only in the Epic Stage.
- At each hero's `endOfTurn` entry in the Epic Stage: `gain({ side, heroId }, generation, 'destinyGeneration')`.
- `isBloodied(hero)` = Epic Stage and `health ≤ healthBar.startingMax` (the red area).

**Why**: Derived values cannot drift from the board; the rulebook's tracker "goes up and down" with units, which a function gives exactly.

## R-05 Royal Favors engine

**Decision**: Data-driven list `src/data/royal-favors.json` (ids, rulebook order, kind `once | half | count`, target, text keys) and per-side state `royalFavors[side] = { status: { [id]: { progress, done } }, tides, track: FavorId[], kingsForces }`. Two kinds of checks:
- **Event checks** in the rules core where the event happens: Battle (*Bloody the Castle Gates*, *Royal's Fury*), Ram (*Overwhelm*), wounds (*Vanquish your Foes*: 0 health → done; Epic enemy newly Bloodied → add to a set, two different → done), check (*Tactical Genius* if the check is discovered), Destiny gain to the Common Pool on the side's own turn after depletion (*Tides of Destiny*, once per turn, ≤ 5).
- **State checks** after every action for both sides (clarified; earned progress is never lost): *Great Incursion*, *Deploy Troops*, *Decimate*, *Offense is the Best Defense*; *Destined for Greatness* at the side's heroes' End of Turn.
Completion appends to `track`; when `track.length` reaches a threshold (6…11), the Power unlocks; reaching 7 adds one King's Forces token. Several completions from one action are added in rulebook order (spec edge case).

**Why**: Event checks have the facts at hand (which unit Led, which hero Rammed); state checks are cheap on a 10×10 board. Keeping the list in data follows constitution III and lets named-hero features add Royal Favors later.

**Alternatives**: Recomputing everything from the log each time (rejected: slow and hard to read).

## R-06 Hero Units are units

**Decision**: A hero becoming a Hero Unit adds a `Unit` with `kind: 'hero'`, id `HU-<heroId>`, `type` (Knight for Short range, Bishop for Long range, or Rook with *Advanced Warfare*) and optional `extraTypes` (*Final Form*: Rook + own type). The hero gets `heroUnitId` and moves with it. Effects:
- Paths, threats, check and checkmate work unchanged because it is a unit; `basicLeads` and `attackSquares` take the union over `[type, ...extraTypes]` (clarified Q3).
- Battle against it: the unit leaves the board (not to the Graveyard), the hero takes 3 wounds, goes to its starting square and stops being a Hero Unit; the attacker gets the normal Battle Destiny.
- It is never Rammed or pushed (clarified); 002's occupancy counts it as a unit.
- Range 2 (4 with *Far Reach*); Move phase skipped; Leading itself, or being Led by a friendly hero, gets modifier `heroUnit +4`; Leading others leaves it in place.
- `rammedBy` becomes `{ unitId, turn }`; a Hero Unit cannot Lead itself into Battle with a unit that Rammed it on the previous turn (001 Q-07).
- Becoming one: action `becomeHeroUnit { types }` at *Beginning of Turn* (clarified by Luka) and also at *End of Turn* with *Swift Change*; refused on an occupied square, off the Battlefield, if it would check the enemy King from there, or if its King is in check and the hero stands on that check's path. `leaveHeroUnit` at the same times.

**Why**: Treating it as a unit reuses all 001/002 rules (Battle, check, shared squares, threats) and makes the rulebook's "interacts with other Units as a Unit" literal.

## R-07 Auxiliary units and Create

**Decision**: `Unit.kind = 'auxiliary'` (already in the 001 model). `createUnit(state, { side, type, at })` refuses when the result would put either King in check (*Create*) or the square holds a unit. Destroyed auxiliary units leave play (no Graveyard) but give the normal Destiny. Auxiliary pawns never promote (001 `isPromotionSquare` already requires `kind === 'main'`). *King's Forces*: action `kingsForces` at *Beginning of Turn* spends a token and creates an auxiliary unit of the hero's type on the hero's square under R-06's restrictions.

## R-08 Phases that now have choices

**Decision**: `beginningOfTurn` rests when *King's Forces* can be used or the hero may become or leave a Hero Unit; `endOfTurn` also rests for *Swift Change*. Otherwise these phases still pass automatically (001 R-08).

## R-09 Table visuals (from the Tabletop Simulator screenshots)

**Decision**: What the screenshots show, built with procedural or canvas-drawn placeholders, every key in `assets.json` so real textures and models replace them (constitution III):
- **Room and table**: a dark stone floor plane with fog and warm point lights; an irregular, thick wooden table top (extruded shape, canvas wood-grain texture) under the board and zones.
- **Board**: the 10×10 board with an illustrated-looking border strip (green forest, blue water, grey castle walls drawn on a canvas) around the Battlefield; checkered squares with a parchment tint.
- **Graveyard / Destiny Well strip**: one long illustrated card beside the board (swirl and graveyard art drawn on a canvas), holding the Graveyard and the Well crystals.
- **Hero sheets**: one card per hero in front of its seat, drawn on a canvas texture: portrait (from `assets/`), name and range type, a health track with a marker, the hero pool, and in the Epic Stage the destiny, Epic art and a Destiny Generation tracker (1…n). Redrawn when the hero changes.
- **Royal Favor tracks**: one card per side with 16 slots and the 6…11 Power marks; tokens appear as Royal Favors complete.
- **Turn-order medallions**: a disc with the number next to each sheet; the active hero's glows.
- **Art**: the hero images are copied to `public/art/heroes/` (so Vite serves and builds them) and referenced from `assets.json`. Epic art images hold three forms side by side; the key gives the column (left Fanatic, middle Resolute, right Dominant, Q-36) and the sheet shows that third. Placeholder mapping by range type: Short → Cavalier, Long → Magus (spec A-01).
- The video in the reference folder was not reviewed (no frame extraction tool on this machine); the 7 screenshots define the layout.

**Why**: Matches what players know from the prototype while staying data-driven until Luka's models arrive.

**Alternatives**: Waiting for final art (rejected: the user asked for improvements now); a DOM overlay for sheets (rejected: the sheets belong on the table like in the prototype; the DOM HUD stays for quick reading).

## R-10 Tracker modal

**Decision**: A DOM dialog opened from the HUD (button and a keyboard shortcut), built from the same Royal Favor data: two columns (Light, Dark), every Royal Favor with requirement text, status (✓ / ½ with progress / open), the Tides count, the track in order, unlocked Powers and "n more for <next Power>". A pure `favorModel(state)` in `src/game/` feeds both the modal and the table track so they always agree, and is tested headless.

## R-11 Testing

**Decision**: Every acceptance scenario gets a `US<n>-AS<m>` test; rules in Vitest with fixtures (Epic Stage forced by setting `wellRemaining` low, Royal Favors by small positions), the tracker model headless, the table in Playwright (screenshot + presence of sheets, track, medallions), and the 001/002 suites stay green. Save files from 001/002 load: missing new fields get defaults (`stage: 'starting'`, empty Royal Favors).
