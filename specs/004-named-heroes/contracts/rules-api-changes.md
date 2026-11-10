# Contract changes: Rules Core API

**Feature**: `004-named-heroes` | Base: 001 `contracts/rules-api.md` + 002/003 `contracts/rules-api-changes.md`

## Actions (added / changed)

```ts
| { type: 'pickHero'; side: Side; heroDefinitionId: string }   // replaces rangeType picks (generic ids still accepted)
| { type: 'useAbility'; abilityId: string; targets?: AbilityTarget[]; option?: string; pay?: Payment }
// decisions
| { type: 'decide'; decision: { type: 'reaction'; use: boolean; pay?: Payment; targets?: AbilityTarget[] } }
| { type: 'decide'; decision: { type: 'abilityChoice'; choice: string } }

type AbilityTarget = { square: Coord } | { unitId: string } | { heroId: HeroId } | { unitType: UnitType };
```

001's `inspiredLead` and `heroRetreat` actions stay as aliases for `useAbility` with the general ability ids.

Errors (added):
- `ABILITY_UNKNOWN`, `ABILITY_WRONG_TIMING`, `ABILITY_NO_USES`, `ABILITY_USED_THIS_TURN`;
- `ABILITY_NOT_AS_HERO_UNIT`, `ABILITY_BAD_TARGET`, `ABILITY_ROYALTY`, `ABILITY_WOULD_CHECK`;
- `NOT_ENOUGH_DESTINY` (001).

## Helpers (added, derived)

```ts
function abilityOffers(state: GameState): AbilityOffer[];            // usable now, with targets and the cost to pay
function abilityCost(state: GameState, heroId: HeroId, abilityId: string): number;  // Bloodied-aware
function activeEffects(state: GameState, target?: EffectTarget): Effect[];
function heroForm(state: GameState, heroId: HeroId): { id: string; abilities: string[] };
```

`src/game/sheet-model.ts` (engine-free) builds what each sheet shows: image key, health, pool, uses left per ability, marks on the hero, corrected-cost badges.

## Guarantees (added)

13. `useAbility` is legal exactly when `abilityOffers` lists it with those targets.
14. Every effect has an expiry, and expired effects are gone at the next phase boundary; none outlives its target.
15. An ability with `mustNotCheck` never leaves a King in check, except by discovered check.
16. Uses never go below 0; the Destiny paid equals the cost for the Bloodied state at the moment of use.
17. Replaying the log rebuilds the same effects, uses and forms (001 guarantee 3a).
18. With no named heroes in play (generic setup), the game behaves exactly as in 003 (all 001–003 tests unchanged).
