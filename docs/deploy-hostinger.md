# Putting Rošada online on Hostinger

This guide puts the game on a Hostinger VPS: the website plus the online game server, under your domain with HTTPS. The design is in [specs/005-online-multiplayer](../specs/005-online-multiplayer/) (research R-01, R-07; [contracts/deployment.md](../specs/005-online-multiplayer/contracts/deployment.md)).

Nothing secret is stored in this repository. Your passwords, keys and account stay with you.

## What you need to do or provide

| # | What | Where | Notes |
| --- | --- | --- | --- |
| 1 | Buy a **KVM 1** VPS (1 vCPU, 4 GB RAM) | hPanel → VPS | KVM 1 is plenty for friends' games; move to KVM 2 later in hPanel if needed. Check the renewal price, not only the first-term price. Pick a data centre in Europe. |
| 2 | Choose the OS template **Ubuntu 24.04** (plain, no control panel) | hPanel → VPS → OS & Panel | Do not choose a template with a panel, Docker or Coolify. |
| 3 | Add your **SSH public key** | hPanel → VPS → Settings → SSH keys | Make one on Windows with `ssh-keygen -t ed25519` and paste `~/.ssh/id_ed25519.pub`. Never paste the private key anywhere. |
| 4 | Create your **own user** on the VPS (once, as root over SSH) | VPS | `adduser luka && usermod -aG sudo luka && rsync -a ~/.ssh /home/luka/ && chown -R luka:luka /home/luka/.ssh` |
| 5 | Decide the **domain** (or a subdomain such as `rosada.example.com`) | your registrar or hPanel → Domains | Spec Open Question Q-59. |
| 6 | Point the domain's **A record** to the VPS IP address | hPanel → Domains → DNS / Nameservers (or your registrar) | Wait until `nslookup <domain>` shows the VPS IP. |
| 7 | An **email** for Let's Encrypt certificate notices | — | Only used by Let's Encrypt. |

## One-time server setup

From PowerShell on your computer, in the repository folder:

```powershell
scp scripts/vps-setup.sh luka@<domain>:/tmp/
ssh luka@<domain>
```

On the VPS:

```bash
sudo bash /tmp/vps-setup.sh --domain <domain> --email <email> --user luka
```

The script does the following:
- installs Node.js 24, nginx, certbot, the firewall (SSH, HTTP and HTTPS only) and automatic security updates;
- creates the `rosada` service user, `/opt/rosada` and `/var/lib/rosada/rooms`;
- sets up the `rosada` systemd service and the nginx site;
- gets the HTTPS certificate, which renews automatically.

Optionally, turn off SSH password login: in `/etc/ssh/sshd_config` set `PasswordAuthentication no` and `PermitRootLogin no`, then run `sudo systemctl restart ssh`. Do this only after key login works for your user.

## Deploy (first time and every update)

```powershell
./scripts/deploy.ps1 -VpsHost <domain> -User luka
```

The script does the following:
1. runs the tests and builds `dist/` (the website) and `dist-server/` (the game server);
2. uploads both to a new release folder and installs the server's runtime packages;
3. switches `current` to the new release and restarts the game server;
4. checks `https://<domain>/api/health`.

Rooms in progress continue: players see "reconnecting" for a moment. Players with the old page open are asked to reload.

Then check the deployment:

```powershell
npx tsx scripts/smoke.ts https://<domain>
```

If something is wrong, go back to the previous release:

```powershell
./scripts/rollback.ps1 -VpsHost <domain> -User luka
```

## Checks after the first deployment (spec US5)

1. `https://<domain>/` loads with a valid certificate, and `http://` redirects to it.
2. `https://<domain>/api/health` shows `"ok": true` and the build you deployed.
3. Two people on different networks create and join a room and play a Lead.
4. `sudo reboot` the VPS: after about a minute, checks 1 and 2 pass again without logging in.
5. `sudo certbot renew --dry-run` succeeds.

## Where things are on the VPS

| Path | What |
| --- | --- |
| `/opt/rosada/current` | The running release (`dist/` website, `server/index.js`) |
| `/opt/rosada/releases/` | The five newest releases |
| `/var/lib/rosada/rooms/` | One file per online room (kept across deploys; seat tokens only as hashes) |
| `journalctl -u rosada` | Game server log |
| `/etc/nginx/sites-available/rosada` | Website and proxy (`/ws/` → game server, `/api/` → health) |
