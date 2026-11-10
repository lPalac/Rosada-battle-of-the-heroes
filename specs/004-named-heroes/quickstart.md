# Quickstart: Named Heroes, Epic Forms and the Tabletop Simulator Look

**Feature**: `004-named-heroes`

Setup and commands as in 001 ([001 quickstart](../001-standard-rules-game/quickstart.md)). The TTS assets are already imported in `public/tts/`; re-import only when the TTS folder changes ([contracts/tts-assets.md](./contracts/tts-assets.md)).

```powershell
npm run dev          # http://localhost:5173
npm test             # every ability scenario, engine, data checks, all 001–003 tests
npm run test:e2e     # setup with named heroes, ability use, sheets, TTS table, frame rate
```

## Manual check (15 minutes)

1. **Setup.** Draft a 4-player game: Light picks Cavalier and Magus, Dark picks Monk and Scout. The table shows each hero's TTS sheet with its health bar, Hero Destiny Pool and medallion in the "Turn Order" slot.
2. **Pieces and table.** The pieces are the TTS models in both colours on the TTS table under the TTS sky; the Graveyard / Destiny Well board and Peace / War token are the TTS images. Knock a piece over in sandbox: physics still works.
3. **Starting ability.** On the Scout's turn place a Bear Trap (Before Move): the token appears, the use token on the sheet disappears, and an enemy Lead next to it shows −3 in the Lead preview.
4. **Reaction.** With the Cavalier marked by Demoralise, let Dark Lead a unit past it and out of its range: the Lead fails and the log says why.
5. **Epic form.** Use sandbox to set the Well low and reach the Epic Stage. Choose Fanatic for the Cavalier: its sheet becomes Death Knight. Bloody it (sandbox health 10) and check that Duty Beyond the Grave costs 9 instead of 6.
6. **Marks and expiry.** As Grand Arcanist use Arcane Shackles on an enemy unit: it cannot be Led nor Destroyed until the end of your next turn; the mark is shown and disappears on time.
7. **Undo and replay.** Undo the last ability (if no reveal since) and reload the page: effects, uses and forms come back identical.

## Acceptance traceability

Each scenario in [spec.md](./spec.md) maps to `US<story>-AS<scenario>` tests. Per-ability tests are named `US3-<form>-<ability>`, for example `US3-deathKnight-auraOfFear`. Contracts: [abilities-data.md](./contracts/abilities-data.md), [rules-api-changes.md](./contracts/rules-api-changes.md), [tts-assets.md](./contracts/tts-assets.md). Data: [data-model.md](./data-model.md).
