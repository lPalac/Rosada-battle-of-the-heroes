# Contract: Tabletop Simulator asset import

**Feature**: `004-named-heroes` | Script: `scripts/import-tts-assets.ts` | Output: `public/tts/`

## Command

```powershell
npx tsx scripts/import-tts-assets.ts "<path to assets/Table top simulator tokens and other>"
```

- Reads the mapping table in the script (research R-10): source file, output name, kind (`sheet`, `portrait`, `texture`, `normal`, `mesh`, `collider`, `board`, `token`, `sky`).
- Writes resized and compressed files to `public/tts/<kind>/<name>.<ext>` and prints the `assets.json` entries (`image`, `gltf`-style `mesh` + `texture` + `normal`, `collider`).
- Idempotent: same input, same output. Output is committed, so the build does not need the TTS folder or `sharp`.

## Size budget (FR-022)

| Kind | Format | Max size |
| --- | --- | --- |
| Sheet | JPEG q85, 1500×902 | 300 KB each |
| Portrait | WebP 512 wide | 120 KB |
| Piece texture / normal | WebP 1024² | 400 KB each |
| Board, table diffuse | WebP 2048 wide | 1 MB |
| Sky | JPEG 2048×1024 | 600 KB |
| Token | PNG/WebP ≤ 256² | 40 KB |
| Mesh / collider | OBJ as is | – |

The whole `public/tts/` stays under 30 MB; the e2e load test measures the first load (≤ 10 s).

## `assets.json` entries (examples)

```json
"unit.light.king": { "mesh": "tts/mesh/king.obj", "texture": "tts/texture/king-light.webp", "normal": "tts/texture/king-normal.webp", "collider": "tts/mesh/king-collider.obj", "scale": 1 },
"sheet.deathKnight": { "image": "tts/sheet/death-knight.jpg" },
"token.ability.killOrder": { "image": "tts/token/kill-order.webp" }
```

The asset schema gains the `mesh`, `texture`, `normal` and `collider` fields. A key without art keeps its placeholder (001 FR-113).
