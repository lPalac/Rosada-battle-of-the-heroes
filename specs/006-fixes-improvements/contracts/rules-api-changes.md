# Contract changes: Rules Core API

**Feature**: `006-fixes-improvements` | Base: 001 `contracts/rules-api.md` + 002 / 003 / 004 `contracts/rules-api-changes.md`

Everything here is in `src/rules` (engine-free). The online protocol (005 `contracts/protocol.md`) does not change: the same intents carry the same actions.

## Actions (changed)

```ts
| { type: 'setEnforcement'; mode: 'rules' | 'sandbox'; restart?: boolean }
| { type: 'inspiredLead'; destiny: number; pay?: Payment }
```

### `setEnforcement` (B-06)

- `mode: 'sandbox'` while playing: also stores `state.sandboxResume` (data-model.md).
- `mode: 'rules'`:
  - position check first, as in 001 (`POSITION_INVALID` with the problem list);
  - with a matching resume point and no `restart`: the turn continues in the saved phase with the saved turn flags and decisions, after the checks in data-model.md;
  - otherwise: Before Turn of the current active hero, as in 001.
- `sandboxResume` is `null` after either path.
- `restart: true` is used by the position editor and by test fixtures.

### `inspiredLead` (B-07)

Legal when all hold:
- the phase is `beforeLead`, or the phase is `lead` and the turn's Lead is not resolved (`turn.lead` is null or `turn.lead.success === null`);
- `inspiredLead` was not used this turn;
- at least 1 D is available.

Effect in the Lead phase with an announced Lead: the bonus is added to `turn.lead.modifiers`; if `1 + sum(modifiers) ≥ leadTarget`, `needsRoll` becomes false and the Lead resolves as a success in the same action. `legalActions` lists it in the Lead phase under the same conditions.

Errors: unchanged codes (`WRONG_PHASE`, `ABILITY_USED`, `BAD_AMOUNT`, `NOT_ENOUGH_DESTINY`).

## Behaviour (changed, no API change)

### Check Destiny (B-05)

Decided 2026-11-11: 2 D for a **new check** made by any kind of action, at most once per turn per side.

```ts
/** Ids of the units that check `side`'s King now. */
function checkingUnits(state: GameState, side: Side): string[];
```

Evaluated once per applied action in rules mode, after the action's own effects and before any automatic phase change:

```text
for each King side K:
  fresh := checkingUnits(after, K) \ checkingUnits(before, K)
  if fresh is empty: nothing
  else:
    emit { type: 'check', side: K, units: fresh }
    maker := otherSide(K)
    if maker ∉ turn.checkDestinyClaimed:
        turn.checkDestinyClaimed += maker
        gain DESTINY.check for maker, reason 'check'
```

- The gain does not depend on who took the action: a side that uncovers a check on its own King gives the other side its 2 D (decided 2026-11-11, third round).
- This covers a Lead, a promotion chosen by decision, an ability effect and a created unit. The Lead's own resolution no longer gains check Destiny or emits `check`.
- Not evaluated in sandbox mode, and never inside simulations (`simulate` abilities, the checkmate search, `leadPreview`).
- The Lead modifier for an own King in check (+4) and `turn.kingInCheckAfterLead` / `abilitiesBlocked` are unchanged.
- *Tactical Genius* is unchanged (a discovered check by a Lead).

### Leads and the own King (B-05, decided 2026-11-11)

```ts
type LeadRefusal = 'wouldCheckOwnKing' | 'notALead' | 'kingThreatenedSquare' | 'outOfRange' | 'notFriendly' | 'rammedByTarget';

/** Why `unitId` cannot be Led to `to` now; null when it can. Range and phase are checked by the caller's context. */
function leadRefusal(state: GameState, unitId: string, to: Coord): LeadRefusal | null;

/** Leads the unit could make by its own rules that are refused only because they leave the own King in check. */
function blockedLeads(state: GameState, unitId: string): LeadOption[];
```

- `announceLead` fails with `LEAD_LEAVES_KING_IN_CHECK` only for `wouldCheckOwnKing`, and with the new `NOT_A_LEAD` for a square the unit cannot move to. Today both get `LEAD_LEAVES_KING_IN_CHECK`.
- `abilityLead` (every "Instead of Lead" ability that Leads a unit) refuses the same way with the same code. Unchanged in effect; pinned by a test over all of them.
- No Lead that leaves the own King in check is accepted by any action.

### Abilities and the own King (B-05, decided 2026-11-11)

```ts
/** Would `action`, applied now, leave a unit checking the acting side's own King that does not check it now? Runs on a copy; false if the action would be refused. */
function wouldCheckOwnKing(state: GameState, action: Action): boolean;
```

- Derived and optional: the core accepts such an ability. The UI asks before sending `useAbility` and other non-Lead actions of the player, and shows the Continue / Undo warning.

Which abilities may place a King in check (decided 2026-11-11, fifth round). For every ability whose effect can change units, except those that make the turn's Lead, the engine applies the test it has for `mustNotCheck` abilities today:

```text
for each King side K:
  if newCheck(before, after, K):      // a unit that is new, moved or retyped by the effect checks K
      fail ABILITY_WOULD_CHECK        // "That would place a King in check"
```

- A discovered check (a unit the effect did not touch checks because a line opened) passes, however the line was opened.
- `abilityOffers` keeps refused targets out of `targets` and lists them in `blocked` with the code; `abilityStatus` reports `wouldCheck` when no target is left.
- The `mustNotCheck` flag stays in the data for the sheet symbol and no longer decides the test.

### One use or both (Q-62a, decided 2026-11-11)

An ability with `bothUses` (*Preaching*) is offered with the options `one` and `both`. `both` is offered only with 2 uses left and the Destiny for both; it spends both in one `useAbility { option: 'both' }` and applies the both-uses effect. The ability is once per turn.

### Epic destinies in Mirror mode (B-01, decided 2026-11-11)

```ts
| { type: 'epicDestiny'; heroId: HeroId; options: EpicDestiny[]; appliesTo: HeroId[] }
```

- `setup.mode === 'draft'`: four decisions as in 003, each with `appliesTo: [heroId]`.
- `setup.mode === 'mirror'`: two decisions. The first is for `choiceOrder(state)[0]`; the second is for the hero of the other definition on the other side. `appliesTo` holds the chooser and its twin (same `definitionId`, other side).
- `decide { destiny }` applies the destiny and the form to every hero in `appliesTo` and emits one `destinyChosen` per hero. Options and errors are those of the chooser (`destinyOptions`, `BAD_DESTINY`).
- The Epic Stage applies when every hero has a destiny, as in 003.

### Starting ability cost (B-09)

No code path changes: `abilityCost`, the `blocker` and `useAbility` already read `cost` from data. With the data change, a use of the eight limited starting abilities spends 1 D with reason `<abilityId>` and emits `destinyChanged`.

### "During Move" abilities (B-10, B-11)

```ts
/** `turn.moveStart` and the squares of `turn.movePath` (the current one included), without duplicates. `turn.movePath` keeps its meaning. */
function movePathSquares(state: GameState): Coord[];
/** Heroes (not Unconscious) standing on those squares, other than the active hero. */
function heroesOnMovePath(state: GameState): Hero[];
```

- `dragonLord.breathOfFieryDestruction` (square): targets are the path squares with an enemy hero (as today).
- `monk.rejuvenatingStroll`, `saint.saintlyInspiration`: targets are the friendly heroes on the path (today: on the current square only).

## Helpers (added, derived)

```ts
interface Reach { to: Coord; cost: number; path: Coord[]; canEnd: boolean }

/** Squares a hero standing on `pos` may step to (the rule `moveStep` checks). */
function moveSquaresFrom(state: GameState, hero: Hero, pos: Coord): Coord[];

/** Every square the active hero can reach this Move with the Movement left; empty outside the Move phase. */
function moveReach(state: GameState): Reach[];

type AbilityStatus =
  | { abilityId: string; usable: true }
  | { abilityId: string; usable: false; reason: 'timing' | 'noUses' | 'usedThisTurn' | 'notEnoughDestiny' | 'notAsHeroUnit' | 'noTarget' | 'wouldCheck'; hint?: string };

/** Every ability of the active hero with why it can or cannot be used now. */
function abilityStatus(state: GameState): AbilityStatus[];
```

`legalMoveSquares(state)` stays and equals `moveSquaresFrom(state, activeHero, activeHero.pos)` when Movement is left.

```ts
interface PositionWarning { code: 'CHECKMATE'; side: Side }

/** Things the players should know before rules come back on; never blocks. One entry per checkmated King. */
function positionWarnings(state: GameState): PositionWarning[];
```

The caller (the UI) reads `positionWarnings` before it sends `setEnforcement { mode: 'rules' }` and asks the players when it is not empty (B-06, decided 2026-11-11). `setEnforcement` itself accepts a checkmated position, as it does today; the win is ruled at the next Before Turn.

## Guarantees (added)

19. For every `Reach` of `moveReach(state)`: applying `moveStep` for each square of `path` in order succeeds (when no step opens a decision or wounds the hero), costs `cost` Movement and ends on `to`. `cost` is the smallest possible.
20. `moveReach` and `abilityStatus` never change the state and give the same result for the same state.
21. `abilityStatus(state)` says `usable: true` for exactly the abilities `abilityOffers(state)` lists.
22. After `setEnforcement('sandbox')` followed by `setEnforcement('rules')` with no edit in between, the state equals the state before, except for the log and `sandboxMoved` bookkeeping.
23. A side's Destiny from check rises by at most `DESTINY.check` per turn, and only in an action after which a unit of that side checks the enemy King that did not check it before the action, whichever side took the action.
23a. A `check` event is emitted exactly for the actions after which some unit newly checks a King; an action that leaves an existing check as it is emits none.
23b. `turn.kingInCheckAfterLead` after a resolved Lead, and what `abilitiesBlocked` returns, are the same as before this feature for every position, also when the turn was continued from a sandbox resume point.
24. An `inspiredLead` in the Lead phase never changes the announced unit or square, and never turns a resolved Lead back into an open one.
25. With `restart: true`, `setEnforcement('rules')` behaves exactly as in 001 (all 001–005 fixtures unchanged).
25a. `blockedLeads(state, u)` and `legalLeadsForUnit(state, u)` never share an option, and `leadRefusal` is `wouldCheckOwnKing` exactly for the options of `blockedLeads`.
25c. No `useAbility` is accepted after which a unit that the ability created, moved, placed or changed checks a King. A check by a unit the ability did not touch is accepted. (Abilities that make the turn's Lead are covered by the Lead rules.)
25d. Every target in `AbilityOffer.blocked` is refused by `useAbility` with the code listed for it, and no target is in both `targets` and `blocked`.
25b. `wouldCheckOwnKing(state, a)` is true exactly when applying `a` succeeds and emits a `check` event for the acting side's own King. It never changes `state`.
26. `positionWarnings(state)` contains `CHECKMATE` for a side exactly when `isCheckmate(state, side)` holds, and never changes the state.
27. In a Mirror game, after the Epic Stage has applied, the two heroes with the same definition have the same destiny and form. In a Draft game the 003 guarantees are unchanged.

## Not changed

- No new action for walking a path: a walk is a sequence of `moveStep` actions (research R-09).
- No new events; `check` gains the `units` field. Flashes are built from the events.
- `REVEAL_EVENTS` and the undo barrier (005) are unchanged.
- `validatePosition` and `POSITION_INVALID`: checkmate is a warning, not a problem.
