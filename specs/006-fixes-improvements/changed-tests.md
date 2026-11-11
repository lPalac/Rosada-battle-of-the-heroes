# Earlier tests changed by 006

Tests of 001–005 whose expectation or set-up changed, one line each with the reason. New 006 tests are not listed.

| Test | Change | Why |
| --- | --- | --- |
| `tests/rules/destiny.test.ts` US5-AS1 | `turn.checkBonusClaimed` is `true` → `turn.checkDestinyClaimed` is `['light']` | FR-001: the once-per-turn mark is per side now (data-model) |
| `tests/online/authority.test.ts` "a decision belongs to its owner" | the hand-built `epicDestiny` decision gets `appliesTo: ['H3']` | FR-012: the decision has a new field (type only; the expectation is unchanged) |
| `tests/i18n.test.ts` "has a message for every RuleError code" | `CHECKMATE` added to the codes that are not errors | FR-009: a position warning with its own dialog strings, not a refused action |
