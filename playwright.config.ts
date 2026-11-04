import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  timeout: 120_000, // physics tests take ~30 s each in software WebGL with the 003 table; parallel runs need headroom
  // The 003 table (canvas textures, room) is heavy in software WebGL: more workers time out.
  workers: 3,
  use: {
    baseURL: 'http://localhost:5174',
    viewport: { width: 1280, height: 800 },
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', testIgnore: /perf\.spec/, use: { ...devices['Desktop Chrome'] } },
    // Frame-time check on the machine's real GPU; default headless Chromium renders WebGL in software (SwiftShader).
    {
      name: 'gpu',
      testMatch: /perf\.spec/,
      use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] } },
    },
  ],
  webServer: {
    command: 'npx vite --mode e2e --port 5174 --strictPort',
    port: 5174,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
