# Quickstart: Online Multiplayer and Hosting

**Feature**: `005-online-multiplayer`

Setup is as in 001 ([001 quickstart](../001-standard-rules-game/quickstart.md)): Node.js 24 LTS, `npm install`, `npx playwright install chromium`.

## Run locally

```powershell
npm run dev:server   # game server on http://localhost:2567 (tsx watch)
npm run dev          # the game on http://localhost:5173; /ws and /api are proxied to 2567
```

Without `dev:server`, hot-seat and the sandbox still work, and Play online shows "server not available" (FR-073).

## Tests

```powershell
npm test             # + src/online (RoomCore, authority, auto setup, undo, rolls, persistence), throwDieTo, server integration and fuzz test
npm run test:e2e     # + online specs: Playwright starts the game server in test mode on 2568 (ROSADA_TEST=1)
```

## Manual check, local (10 minutes)

1. **Create.** Window A: Play online → name "Luka" → 4 players, Draft → Create. It shows a 7-character code and a Copy link button.
2. **Join.** Windows B, C, D (use separate browser profiles or private windows, so each has its own seat token): open the link, type a name, take the free seats. Every window shows the same seat list within a second. A starts.
3. **Picks.** Each window can pick only when its own seat's slot is up; the others see "waiting for <name>". After the last pick, turn order and starting squares are shown, and turn 1 begins (Q-52 default).
4. **Turn flow.** On H1's turn, try to move from window B: nothing happens and the HUD says it is not your turn. Move and Lead from window A; B–D follow live.
5. **Dice.** On a Lead that needs a roll, press Roll in A: every window shows the die tumbling and landing on the same value, and the same result.
6. **Reaction.** Set up a "During Enemy Lead" reaction (004 manual check 4): only the reacting hero's window is asked.
7. **Undo.** A undoes its last move (before any reveal). Then B tries to undo A's action: refused.
8. **Reconnect.** Reload window C: within 10 s it is back in its seat with the current table. Stop `dev:server` and start it again: all windows show "reconnecting", then continue at the same position (FR-044).
9. **Save.** Download the save in any window and load it in hot-seat: same position. Create a new room from it: after everyone sits, the game continues.

## Deploy to Hostinger (first time)

Details: [contracts/deployment.md](./contracts/deployment.md).

1. Buy a **KVM 1** VPS, choose the **Ubuntu 24.04** template and add your SSH public key in hPanel.
2. Point the domain's `A` record to the VPS IP (hPanel DNS or your registrar). Wait until `nslookup <domain>` shows the IP.
3. Copy `scripts/vps-setup.sh` to the VPS and run it as root with the domain and an email for Let's Encrypt:
   ```bash
   sudo bash vps-setup.sh --domain <domain> --email <email>
   ```
4. From Windows:
   ```powershell
   ./scripts/deploy.ps1 -VpsHost <domain>
   ```
5. Check:
   ```powershell
   npx tsx scripts/smoke.ts https://<domain>
   ```
   Then open `https://<domain>` in two browsers on different networks and play one Lead.

## Deploy a new version (under 15 minutes, SC-007)

```powershell
./scripts/deploy.ps1 -VpsHost <domain>     # tests, builds, uploads, switches, restarts, checks /api/health
./scripts/rollback.ps1 -VpsHost <domain>   # only if something is wrong
```

Players who have an older version open are asked to reload (US5-AS3). Rooms in progress continue after the restart.

## Acceptance traceability

Each scenario in [spec.md](./spec.md) maps to a `US<story>-AS<scenario>` test: Vitest for `src/online` and the server integration, Playwright for screens across several windows. US5 deployment scenarios are checked by `scripts/smoke.ts` and the checks in [contracts/deployment.md](./contracts/deployment.md); US5-AS3 (version mismatch) also has a Playwright test. Contracts: [protocol.md](./contracts/protocol.md), [online-core-api.md](./contracts/online-core-api.md), [deployment.md](./contracts/deployment.md). Data: [data-model.md](./data-model.md).
