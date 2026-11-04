# Contract: Rules Core API

> **Changed by 002**: `LeadOption.battleUnitIds` (a Battle destroys every enemy unit on a square), new position problem codes (`OPPOSING_UNITS_SHARE`, `TOO_MANY_UNITS`; `TWO_UNITS` removed), and `sandboxPlace` accepts table squares beside the board. See [002 rules-api-changes.md](../../002-sandbox-physics/contracts/rules-api-changes.md).

**Feature**: `001-standard-rules-game` | Module: `src/rules/index.ts`

This is the only interface between the rules core and everything else (3D table, HUD, tests, a later online server). The rules core is pure: same input, same output, no I/O, no DOM, no Three.js/Rapier (constitution II).

## Functions

```ts
// A setup state (status 'setup') that takes the setup actions below.
function createSetup(options: { mode; playerCount; players?; singleSide? }): GameState;

// Create a new game from completed setup choices and static data (also used for a rematch).
function createGame(setup: SetupChoices, data?: StaticData): GameState;

// Every action the active player (or the player owning a pendingDecision) may take now.
// Used by the UI for highlights and by tests to check legality.
function legalActions(state: GameState): Action[];

// Apply one action. Never mutates the input.
function apply(state: GameState, action: Action):
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: RuleError };

// In src/game/session.ts (engine-free, outside the rules core): undo the last action if no reveal event or phase
// change happened since (R-11). The history is the action log; the state is rebuilt by re-applying it.
function undo(initial: GameState, history: Action[]): Action[] | null;
function replay(initial: GameState, history: Action[]): GameState;

// Position checks used when switching sandbox → rules (FR-103).
function validatePosition(state: GameState): PositionProblem[];

// Helpers for the UI (derived, never stored).
function legalMoveSquares(state: GameState): Coord[];
function legalLeadTargets(state: GameState, unitId: string): { to: Coord; isBattle: boolean; path: Coord[] }[];
function isInCheck(state: GameState, side: Side): boolean;
function leadPreview(state: GameState, unitId?: string): { needsRoll: boolean; modifiers: Modifier[]; target: number } | null;
```

## Actions

```ts
type Action =
  // setup
  | { type: 'pickHero'; side: Side; rangeType: RangeType }   // Draft or Mirror order (FR-081)
  | { type: 'setTurnOrder'; side: Side; first: number }      // pickIndex of the side's hero that plays first; Light before Dark (FR-082)
  | { type: 'setStartFile'; pickIndex: number; file: 'c' | 'f' } // which Bishop the hero starts behind (FR-083)
  | { type: 'startGame' }                                    // needs all picks, both turn orders and start files
  // phase control
  | { type: 'endPhase' }                        // advance when the phase has nothing mandatory left
  // move
  | { type: 'moveStep'; to: Coord }             // one adjacent square
  | { type: 'buy'; item: 'drink' | 'meal'; pay?: Payment }    // only while tavernShopOpen
  // general abilities
  | { type: 'inspiredLead'; destiny: number; pay?: Payment }  // Before Lead; bonus only for this turn's Lead
  | { type: 'heroRetreat'; tavern: Coord; pay?: Payment }     // End of Turn
  // lead
  | { type: 'announceLead'; unitId: string; to: Coord; promoteTo?: UnitType }
  | { type: 'useRevenge' }                      // while awaiting the roll: discard a token instead of rolling
  | { type: 'submitRoll'; value: number }       // 1..20, from the physics die or a test
  // decisions
  | { type: 'decide'; decision: DecisionAnswer }
  // game
  | { type: 'offerDraw' } | { type: 'answerDraw'; accept: boolean }
  | { type: 'setEnforcement'; mode: 'rules' | 'sandbox' }
  // sandbox only
  | { type: 'sandboxPlace'; target: { unitId?: string; heroId?: string }; to: Coord | 'graveyard' }
  | { type: 'sandboxSet'; path: 'health' | 'pool' | 'common' | 'revenge' | 'peaceTreaty'; // 003 adds stage, destiny, favor, kingsForces, heroUnit, well target?: string; value: number | string };
```

`Payment = { hero: number; common: number }` splits a cost between the hero pool and the side's Common Pool (FR-072). Without it the hero pool pays first. The UI asks for the split when more than one works, so no `payDestiny` decision is needed.

## Events (for animation, sound, log)

```ts
type GameEvent =
  | { type: 'phaseChanged'; heroId; phase }
  | { type: 'heroMoved'; heroId; from; to }
  | { type: 'rollRequested'; leadId }
  | { type: 'rolled'; value; total; success }
  | { type: 'unitLed'; unitId; from; to; path }
  | { type: 'unitDestroyed'; unitId; by: 'battle' }
  | { type: 'heroRammed'; heroId; byUnitId; landing; sentToStart }
  | { type: 'heroWounded'; heroId; amount; health }
  | { type: 'heroHealed'; heroId; amount; health }
  | { type: 'heroUnconscious'; heroId } | { type: 'heroRecovered'; heroId }
  | { type: 'destinyChanged'; pool; side?; heroId?; delta; reason }
  | { type: 'tokenChanged'; token: 'peaceTreaty' | 'revenge'; value }
  | { type: 'promoted'; unitId; to }
  | { type: 'check'; side } | { type: 'gameEnded'; result }
  | { type: 'enforcementChanged'; mode };
```

The built union also has `turnStarted`, `turnSkipped`, `leadAnnounced`, `leadFailed`, `heroPushed` (King's Banishment, friendly heroes), `wellDepleted`, `abilityUsed`, `bought`, `drawOffered`, `drawDeclined`, `sandboxEdited` and `setupChanged` (see `src/rules/model/actions.ts`).

Events marked as *reveal* for undo: `rolled`, `unitDestroyed`, `heroRammed`, `heroWounded`. Undo also stops at every phase change (FR-012: undo within the current phase).

## Errors

`RuleError = { code: string; message: string; rule: string; problems?: PositionProblem[] }` (`problems` with `POSITION_INVALID`, FR-103). `rule` names the rulebook section (for FR-202 later), for example `{ code: 'KING_THREATENED_SQUARE', rule: 'Threaten' }`, `{ code: 'LEAD_LEAVES_KING_IN_CHECK', rule: 'Check' }`, `{ code: 'MUST_ATTEMPT_LEAD', rule: 'Lead' }`, `{ code: 'SHOP_CLOSED', rule: 'Taverns' }`.

## Guarantees (tested)

1. `apply` never returns a state that fails `validatePosition` while `enforcement = 'rules'`, except the active hero passing over a King's square during its Move (FR-022 forbids only ending there; `endPhase` refuses it).
2. Every action in `legalActions(state)` succeeds with `apply`; any other action returns `ok: false`.
3. `JSON.parse(JSON.stringify(state))` deep-equals `state`.
3a. Re-applying the action log (with its roll values) to `createGame(setup, data)` gives the same state. No seed is needed.
4. While `pendingDecision` is set, `legalActions` only contains answers to it.
5. In `sandbox` mode only `sandbox*`, `setEnforcement` and `submitRoll` (free roll, not applied) are legal; no result is declared. `legalActions` does not list the open-ended `sandbox*` actions.
