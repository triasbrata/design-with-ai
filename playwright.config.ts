import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  retries: 0,
  fullyParallel: false,
  use: {
    baseURL: "http://localhost:4200",
    headless: true,
    viewport: { width: 1440, height: 900 },
    actionTimeout: 10_000,
  },
  webServer: {
    command: "npm run review",
    port: 4200,
    timeout: 30_000,
    reuseExistingServer: !process.env.CI,
    env: {
      // Ensure the app loads with real golden data by default
      GOLDEN_DIR: "",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
