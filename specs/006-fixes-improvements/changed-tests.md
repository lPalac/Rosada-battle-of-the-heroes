# Earlier tests changed by 006

Tests of 001–005 whose expectation or set-up changed, one line each with the reason. New 006 tests are not listed.

| Test | Change | Why |
| --- | --- | --- |
| `tests/rules/destiny.test.ts` US5-AS1 | `turn.checkBonusClaimed` is `true` → `turn.checkDestinyClaimed` is `['light']` | FR-001: the once-per-turn mark is per side now (data-model) |
| `tests/online/authority.test.ts` "a decision belongs to its owner" | the hand-built `epicDestiny` decision gets `appliesTo: ['H3']` | FR-012: the decision has a new field (type only; the expectation is unchanged) |
| `tests/i18n.test.ts` "has a message for every RuleError code" | `CHECKMATE` added to the codes that are not errors | FR-009: a position warning with its own dialog strings, not a refused action |
| `tests/rules/destiny.test.ts` US5-AS1 | the `check` event also has `units: ['L-R@a1']` | FR-001: the `check` event names the units that newly check (data-model) |
| `tests/rules/hero-unit.test.ts` US4-AS11 | the `check` event also has `units: ['HU-H1']` | FR-001, as above |
| `tests/rules/create.test.ts` US5-AS4 | the `check` event also has `units: ['L-R@h1']` | FR-001, as above |
| `tests/games/scripted-game-04.test.ts` "Cavalier, Scout, Magus and Monk into the Epic Stage" | after *Demoralise* the pools are `[2, 3, 3, 3]` (new check); after the Epic split `[3, 3, 4, 3]` instead of `[4, 3, 4, 3]` | FR-002: *Demoralise* costs 1 D (B-09) |
| `tests/server/game.test.ts` US2-AS1…AS3 | the random player undoes its last step when no action is legal; seed and checks unchanged | FR-002 changes the seeded random path, which now walks a hero onto a King's square with its last Movement point; End phase is then disabled (as since 001) and a player would undo. The dead end itself is unchanged (it also happens without 006 with other seeds) |
| `tests/rules/shared-squares.test.ts` US2-AS6 (002) | a Lead onto a square holding a friendly unit is refused with `NOT_A_LEAD` instead of `LEAD_LEAVES_KING_IN_CHECK` | FR-014: `LEAD_LEAVES_KING_IN_CHECK` now means only "check forbids it"; a square the unit cannot move to has its own reason |
| `tests/rules/heroes/monk.test.ts` US2-AS5 (004) | *Preaching* is used with the option `one` or `both`; a second use in the same turn is refused (`ABILITY_USED_THIS_TURN`); `both` marks the unit `cannotLead` | FR-017 / Q-62a, Q-78: one use or both in one action, once per turn (replaces 004 Q-50's two uses in one turn) |
| `tests/rules/abilities/effects.test.ts` US4-AS5 (004) | the *Preaching* use and its replay give `option: 'one'` | FR-017: *Preaching* now has the options `one` and `both` |
| `tests/rules/contract-004.test.ts` guarantee 16 (004) | the Destiny paid equals the cost times the uses spent (2 for `both`) | FR-017: spending both uses at once pays both costs |
