import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  timeout: 60_000,
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
