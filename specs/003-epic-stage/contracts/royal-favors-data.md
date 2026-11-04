# Contract: Royal Favors and table art data

**Feature**: `003-epic-stage` | Folder: `src/data/`

## royal-favors.json

```json
{
  "$schema": "./schemas/royal-favors.schema.json",
  "favors": [
    { "id": "bloodyTheCastleGates", "order": 1, "kind": "once" },
    { "id": "overwhelm", "order": 2, "kind": "half", "target": 2 },
    { "id": "greatIncursion", "order": 3, "kind": "once" },
    { "id": "tacticalGenius", "order": 4, "kind": "once" },
    { "id": "deployTroops", "order": 5, "kind": "once" },
    { "id": "royalsFury", "order": 6, "kind": "count", "target": 3 },
    { "id": "decimate", "order": 7, "kind": "once" },
    { "id": "offenseIsTheBestDefense", "order": 8, "kind": "once" },
    { "id": "vanquishYourFoes", "order": 9, "kind": "half", "target": 2 },
    { "id": "destinedForGreatness", "order": 10, "kind": "once" },
    { "id": "tidesOfDestiny", "order": 11, "kind": "once", "repeat": 5 },
    { "id": "manifestEpicDestiny", "order": 12, "kind": "once" }
  ],
  "powers": [
    { "id": "heroUnit", "threshold": 6 },
    { "id": "kingsForces", "threshold": 7 },
    { "id": "advancedWarfare", "threshold": 8 },
    { "id": "farReach", "threshold": 9 },
    { "id": "swiftChange", "threshold": 10 },
    { "id": "finalForm", "threshold": 11 }
  ]
}
```

Rules: ids unique; `order` unique; `half`/`count` need `target ≥ 2`; thresholds ascending. Text lives in `strings.en.json` under `favor.<id>.name`, `favor.<id>.requirement`, `power.<id>.name`, `power.<id>.text`.

## heroes.json (added fields)

```json
{ "id": "generic-short", "heroUnitType": "knight", "portrait": "portrait.short", "epicArt": "epic.short" }
{ "id": "generic-long",  "heroUnitType": "bishop", "portrait": "portrait.long",  "epicArt": "epic.long" }
```

## assets.json (added keys)

```json
{
  "portrait.short": { "image": "art/heroes/Cavalier.png" },
  "portrait.long": { "image": "art/heroes/Magus.png" },
  "epic.short": { "image": "art/heroes/Cavalier - epic heroes.png", "columns": 3 },
  "epic.long": { "image": "art/heroes/Magus - epic heroes.png", "columns": 3 },
  "table.top": { "placeholder": "wood-slab", "color": "#6b4a2b" },
  "room.floor": { "placeholder": "stone-floor", "color": "#3a2c22" },
  "board.border": { "placeholder": "illustrated-border" },
  "strip.graveyard": { "placeholder": "graveyard-strip" },
  "sheet.hero": { "placeholder": "hero-sheet" },
  "track.favors": { "placeholder": "Royal Favor-track" },
  "medallion": { "placeholder": "medallion", "color": "#d9d2c0" },
  "marker.auxiliary": { "placeholder": "aux-ring", "color": "#7fd1ff" }
}
```

`columns` (new, optional) means the image holds N forms side by side; the destiny order is `["fanatic", "resolute", "dominant"]` (spec Q-36). Paths are relative to `public/`. The 001 rule "exactly one of placeholder / gltf / image" stays.
