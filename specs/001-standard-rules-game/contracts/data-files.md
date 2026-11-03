# Contract: Static Data Files

**Feature**: `001-standard-rules-game` | Folder: `src/data/`

The rules core loads these at `createGame`. Each file is validated against its schema at build time (`npm run check:data`) and in tests. Adding a named hero later = a new entry in `heroes.json` (+ ability code), per constitution III.

## heroes.json

```json
{
  "$schema": "./schemas/heroes.schema.json",
  "heroes": [
    { "id": "generic-short", "name": "Short range hero", "rangeType": "short",
      "movement": 5, "range": 1, "maxHealth": 10, "epicMaxHealth": 20,
      "healthBar": "bar-20", "abilities": [], "art": "hero.short" },
    { "id": "generic-long", "name": "Long range hero", "rangeType": "long",
      "movement": 3, "range": 3, "maxHealth": 8, "epicMaxHealth": 16,
      "healthBar": "bar-16", "abilities": [], "art": "hero.long" }
  ]
}
```

Rules: `movement` 1…10, `range` 1…10, `maxHealth` ≥ 1 and ≤ the bar's red area top, `healthBar` must exist, `art` must exist in `assets.json`.

## healthbars.json

```json
{
  "bars": [
    { "id": "bar-16", "max": 16, "startingMax": 8,  "resilientPoints": [1, 2, 4, 6, 8, 9, 11, 14] },
    { "id": "bar-20", "max": 20, "startingMax": 10, "resilientPoints": [1, 2, 4, 6, 8, 10, 11, 13, 15, 18] }
  ]
}
```

Rules: points ascending, unique, within 1…max. Resilient Destiny = count of points `p` with `newHealth ≤ p < oldHealth`.

## board.json

```json
{
  "size": 10,
  "battlefield": { "x": [1, 8], "y": [1, 8] },
  "kingsCourt": { "light": 0, "dark": 9 },
  "taverns": [
    { "at": [0, 0], "owner": "light" }, { "at": [9, 0], "owner": "light" },
    { "at": [0, 9], "owner": "dark" },  { "at": [9, 9], "owner": "dark" }
  ],
  "heroStartSquares": { "light": [[3, 0], [6, 0]], "dark": [[3, 9], [6, 9]] }
}
```

`heroStartSquares[side][0]` is the square behind the c-file Bishop, `[1]` behind the f-file Bishop. Each side chooses which hero starts where (FR-083).

## units.json

```json
{
  "types": {
    "king":   { "directions": "all8", "maxSteps": 1, "jump": false, "royal": true },
    "queen":  { "directions": "all8", "maxSteps": 7, "jump": false, "royal": true },
    "rook":   { "directions": "orthogonal", "maxSteps": 7, "jump": false },
    "bishop": { "directions": "diagonal", "maxSteps": 7, "jump": false },
    "knight": { "directions": "knight", "maxSteps": 1, "jump": true },
    "pawn":   { "special": "pawn" }
  },
  "start": {
    "light": { "rank": 1, "pawnRank": 2, "order": ["rook","knight","bishop","queen","king","bishop","knight","rook"] },
    "dark":  { "rank": 8, "pawnRank": 7, "order": ["rook","knight","bishop","queen","king","bishop","knight","rook"] }
  },
  "promotion": ["queen", "rook", "bishop", "knight"]
}
```

Pawn, castling and en passant are coded rules (not data) because they have conditions beyond direction and distance.

## rules.json

```json
{
  "leadTarget": 6, "die": 20,
  "modifiers": { "war": 2, "kingInCheck": 4, "inspiredLeadPerDestiny": 2 },
  "ramWounds": 3,
  "tavern": { "drink": { "cost": 1, "heal": 1 }, "meal": { "cost": 2, "heal": 3 }, "startTurnMovementPenalty": 1 },
  "maxMovementReduction": 2,
  "revengeMax": 2,
  "destiny": { "wellInitial": 16, "heroPoolStart": 3, "check": 2, "destroyEnemy": 2, "ownUnitLost": 1, "woundEnemyHero": 1, "failedLead": 1 },
  "abilities": { "heroRetreat": { "cost": 2 } }
}
```

## assets.json

```json
{
  "unit.light.king": { "placeholder": "king", "color": "#e8e2d0" },
  "unit.dark.king":  { "placeholder": "king", "color": "#2b2b2b" },
  "hero.short": { "placeholder": "hero-short" },
  "hero.long":  { "placeholder": "hero-long" },
  "die.d20": { "placeholder": "d20" },
  "board": { "placeholder": "board" }
}
```

Each value is exactly one of `{ "placeholder": <shape> }`, `{ "gltf": <path> }`, `{ "image": <path> }`, with optional `color` and `scale`.
