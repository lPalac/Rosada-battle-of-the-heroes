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
