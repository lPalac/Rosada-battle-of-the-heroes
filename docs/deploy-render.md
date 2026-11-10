# Free test deployment on Render

This puts the whole game online for testing on one free Render web service: the website, the online game server and `/api/health`, at a `https://<name>.onrender.com` address. Hosting on Hostinger under your own subdomain is the later go-live step ([deploy-hostinger.md](deploy-hostinger.md)). The decision is in [specs/005-online-multiplayer/research.md](../specs/005-online-multiplayer/research.md) R-14.

## What the free plan means

From Render's [free plan docs](https://render.com/docs/free), checked 2026-11-10:

- **Sleep**: the service sleeps after 15 minutes without traffic. The next visitor waits up to about a minute while it starts again. Open WebSocket traffic, such as a game in progress, keeps it awake.
- **Temporary disk**: online rooms are lost when the service restarts, redeploys or goes to sleep. Players then create a new room. A downloaded save file can continue the game in a new room.
- **Hours**: 750 free instance hours a month per workspace, which is enough for this one service.
- **No payment method** is needed for a free web service.

## Set it up (once)

1. Sign in at [dashboard.render.com](https://dashboard.render.com).
2. **New → Blueprint**, then connect GitHub and allow Render to read the `Rosada-battle-of-the-heroes` repository. This is a GitHub permission you grant yourself.
3. Pick the repository and the branch `005-online-multiplayer`. Render reads `render.yaml`:
   - one free web service `rosada`, Node 24;
   - build `npm ci --include=dev && npm run build`;
   - start `node dist-server/index.js`;
   - health check `/api/health`.
4. **Apply**. The first build takes a few minutes. The address appears at the top of the service page.

Every push to the branch deploys again automatically.

## Check it

```powershell
npx tsx scripts/smoke.ts https://<name>.onrender.com
```

The smoke test checks HTTPS, `/api/health`, and that a room can be created and joined over `wss://`. Then open the address in two browsers (or one normal and one private window), choose **Play online**, create a room, and send the link.

## Settings in render.yaml

| Variable | Value | Why |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | Render routes traffic to the service from outside the container |
| `ROSADA_STATIC_DIR` | `dist` | The game server also serves the website (one origin, no CORS) |
| `ROSADA_ROOMS_DIR` | `/tmp/rosada-rooms` | Room files go to the temporary disk |
| `ROSADA_TEST` | *not set* | Test mode lets clients force die rolls; never on a public server |

`PORT` is set by Render.
