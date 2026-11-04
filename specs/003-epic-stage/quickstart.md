# Quickstart: Epic Stage, Destiny Generation, Royal Favors and Legendary Powers

**Feature**: `003-epic-stage`

Setup and commands as in 001 ([001 quickstart](../001-standard-rules-game/quickstart.md)).

```powershell
npm run dev          # http://localhost:5173
npm test             # rules (Epic Stage, generation, Royal Favors, Hero Units), all 001/002 tests
npm run test:e2e     # browser: table elements, tracker modal, destiny choice
```

## Manual check (10 minutes)

1. **Table.** Start a 4-player game. The board lies on a wooden table in a dim room, with an illustrated border, a Graveyard / Well strip, a hero sheet with portrait and health track at each seat, a turn-order medallion per sheet (active one glowing) and a Royal Favor track per side.
2. **Epic Stage.** Settings → Sandbox, set the Well's remaining Destiny low (or use the position editor), resume and make a Battle so the Well empties. Play continues. At the next Before Turn each hero chooses a destiny in turn order, the depleting hero last; a side with a Fanatic hero cannot pick Dominant. Health rises (+10 / +8), Common Pools split, the War token disappears, and sheets show the Epic art.
3. **No more War bonus.** The next Lead's preview shows no +2; a roll of 5 fails, 6 succeeds.
4. **Destiny generation.** Destroy a side's Queen; at that side's next End of Turn the hero gains 2 D (generation 1 + 1 missing type).
5. **Royal Favors.** Ram an enemy hero twice → *Overwhelm* in the track; open the tracker (button or `A`): both sides' Royal Favors, progress, Powers and "n more for …".
6. **Hero Unit.** In sandbox give a side 6 Royal Favors (value editor), resume. At Beginning of Turn a Short range hero becomes a Knight Hero Unit, Leads itself with +4, and when Destroyed takes 3 wounds and goes to its starting square.
7. **King's Forces.** With 7 Royal Favors, at Beginning of Turn create an auxiliary Knight on the hero's square; it has an auxiliary marker and leaves play when Destroyed.

## Acceptance traceability

Each scenario in [spec.md](./spec.md) maps to `US<story>-AS<scenario>` tests. Contracts: [rules-api-changes.md](./contracts/rules-api-changes.md), [royal-favors-data.md](./contracts/royal-favors-data.md). Data: [data-model.md](./data-model.md).
