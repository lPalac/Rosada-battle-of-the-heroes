# Contract: Hero and ability data

**Feature**: `004-named-heroes` | Files: `src/data/heroes.json`, `src/data/abilities.json` (+ schemas)

## Example entries

```json
{
  "id": "deathKnight.auraOfFear",
  "kind": "passive",
  "timings": [],
  "cost": null,
  "uses": null,
  "flags": { "notRoyalty": true },
  "values": { "penalty": [-2, -3] },
  "icons": ["lead", "adjacent"],
  "text": "ability.deathKnight.auraOfFear"
}
```

```json
{
  "id": "grandArcanist.conjurePortal",
  "kind": "action",
  "timings": ["afterLead"],
  "cost": { "normal": 6, "bloodied": 8 },
  "flags": {},
  "values": {},
  "icons": ["linked"],
  "sheet": { "printedCost": [6, 9] },
  "text": "ability.grandArcanist.conjurePortal"
}
```

## Rules checked by `scripts/check-data.ts`

1. Every `heroes.json` ability and form ability id exists in `abilities.json`; every `abilities.json` id belongs to exactly one hero or form.
2. Every ability id has an effect implementation in `src/rules/heroes/index.ts` (checked by a Vitest test, since the data script does not import rules code).
3. `cost` is set for Epic form abilities, and `uses` for limited starting abilities; never both.
4. `values` pairs are `[normal, bloodied]`.
5. Every `text`, `name` and timing has a string in `strings.en.json`; every icon is a Symbol Legend key in `assets.json`.
6. Every hero and form art key exists in `assets.json`.
7. Each named hero has exactly the three forms `fanatic`, `resolute`, `dominant`.
