// 005 T049: deployment smoke test (US5). `npx tsx scripts/smoke.ts https://game.example.com`
// Checks HTTPS and the health endpoint, then creates a room and joins it with a second client over wss://.
import { GameServer } from '../src/net/client.ts';
import { OnlineSession } from '../src/net/online-session.ts';
import { dataHash } from '../src/online/version.ts';

const url = process.argv[2];
if (!url) {
  console.error('Usage: npx tsx scripts/smoke.ts https://<domain>');
  process.exit(1);
}
const base = new URL(url);

async function main(): Promise<void> {
  if (base.protocol === 'https:') {
    const http = await fetch(`http://${base.host}/`, { redirect: 'manual' });
    console.log(`http:// answers ${http.status} → ${http.headers.get('location') ?? '(no redirect)'}`);
  }
  const page = await fetch(base); // TLS errors throw here
  if (!page.ok) throw new Error(`The site answered ${page.status}`);
  console.log(`site ok (${page.status})`);
  const health = (await (await fetch(new URL('/api/health', base))).json()) as { ok: boolean; buildId: string; rooms: number };
  if (!health.ok) throw new Error('health not ok');
  console.log(`health ok: build ${health.buildId}, ${health.rooms} rooms`);

  const endpoint = { hostname: base.hostname, port: base.port ? Number(base.port) : base.protocol === 'https:' ? 443 : 80, secure: base.protocol === 'https:', pathname: '/ws' };
  const version = { buildId: health.buildId, dataHash: dataHash() };
  const a = await new GameServer(endpoint).create({ name: 'Smoke A', playerCount: 2, mode: 'draft', ...version });
  const sa = new OnlineSession(a);
  await sa.ready();
  const b = await new GameServer(endpoint).join(a.code, version);
  const sb = new OnlineSession(b);
  await sb.ready();
  sb.takeSeat('P2', 'Smoke B');
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('second player did not get a seat')), 5000);
    sa.onRoom((r) => r.seats.every((s) => s.taken) && (clearTimeout(timer), resolve()));
  });
  console.log(`room ${a.code}: two players seated over ${endpoint.secure ? 'wss' : 'ws'}://`);
  await a.leave();
  await b.leave();
  console.log('smoke test passed');
}

main().then(() => process.exit(0), (e) => {
  console.error(`smoke test FAILED: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
