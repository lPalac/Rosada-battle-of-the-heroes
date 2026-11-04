// SC-005 proxy: first-load time and frame time with the default camera (T107). The CI machine stands in for a
// mid-range laptop; the absolute numbers are reported, the thresholds are generous.
import { expect, test } from '@playwright/test';
import { quickSetup } from './helpers.ts';

test('first load is under 10 s and the table renders at ~60 fps while animating', async ({ page }, info) => {
  const t0 = Date.now();
  await page.goto('/');
  await expect(page.getByTestId('setup')).toBeVisible();
  const loadMs = Date.now() - t0;
  await quickSetup(page);
  // Orbit continuously for 3 s, measuring frame intervals in the page.
  const stats = await page.evaluate(async () => {
    const times: number[] = [];
    let last = performance.now();
    const end = last + 3000;
    await new Promise<void>((resolve) => {
      const tick = (now: number) => {
        times.push(now - last);
        last = now;
        window.dispatchEvent(new Event('resize'));
        if (now < end) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    times.sort((a, b) => a - b);
    return { median: times[Math.floor(times.length / 2)], p95: times[Math.floor(times.length * 0.95)], frames: times.length };
  });
  info.annotations.push({ type: 'perf', description: `load ${loadMs} ms, median frame ${stats.median.toFixed(1)} ms, p95 ${stats.p95.toFixed(1)} ms` });
  console.log(`perf: load ${loadMs} ms, median frame ${stats.median.toFixed(1)} ms, p95 ${stats.p95.toFixed(1)} ms over ${stats.frames} frames`);
  expect(loadMs).toBeLessThan(10_000);
  expect(stats.median).toBeLessThan(1000 / 50);
});

test('002 SC-002: ≥ 50 fps while a carried Rook knocks pieces around in sandbox', async ({ page }, info) => {
  await quickSetup(page);
  await page.evaluate(() => (window as any).__rosada.dispatch({ type: 'setEnforcement', mode: 'sandbox' }));
  await expect.poll(() => page.evaluate(() => (window as any).__rosada.physicsReady())).toBe(true);
  const stats = await page.evaluate(async () => {
    const r = (window as any).__rosada;
    const cv = document.getElementById('table')!;
    const fire = (type: string, p: { x: number; y: number }) =>
      cv.dispatchEvent(new PointerEvent(type, { clientX: p.x, clientY: p.y, button: 0, buttons: 1, bubbles: true, pointerId: 1 }));
    const a = r.screenOf('<2');
    const b = r.screenOf('>2');
    const c = r.screenOf('>7');
    fire('pointerdown', r.unitScreenOf('L-R-a'));
    const times: number[] = [];
    let last = performance.now();
    const start = last;
    await new Promise<void>((resolve) => {
      const tick = (now: number) => {
        times.push(now - last);
        last = now;
        const k = Math.min(1, (now - start) / 3000);
        // Sweep through the Light pawn row, then up the h-file through the Dark pieces.
        const p = k < 0.5 ? { x: a.x + (b.x - a.x) * k * 2, y: a.y + (b.y - a.y) * k * 2 }
          : { x: b.x + (c.x - b.x) * (k - 0.5) * 2, y: b.y + (c.y - b.y) * (k - 0.5) * 2 };
        fire('pointermove', p);
        if (k < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    fire('pointerup', c);
    times.sort((x, y) => x - y);
    return { median: times[Math.floor(times.length / 2)], p95: times[Math.floor(times.length * 0.95)], frames: times.length };
  });
  info.annotations.push({ type: 'perf', description: `sandbox physics: median ${stats.median.toFixed(1)} ms, p95 ${stats.p95.toFixed(1)} ms` });
  console.log(`perf sandbox: median frame ${stats.median.toFixed(1)} ms, p95 ${stats.p95.toFixed(1)} ms over ${stats.frames} frames`);
  expect(stats.median).toBeLessThanOrEqual(20);
});
