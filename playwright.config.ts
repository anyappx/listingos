import { defineConfig, devices } from "@playwright/test";
import path from "path";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:4000";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,       // serial: tests share state (auth session)
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,                  // single worker for sequential flow
  reporter: [
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["list"],
  ],
  timeout: 180_000,            // 3 min per test (video generation can take 2 min)
  expect: {
    timeout: 30_000,
  },
  use: {
    baseURL: BASE_URL,
    headless: true,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  globalSetup: path.resolve(__dirname, "tests/global-setup.ts"),
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  outputDir: "test-results/",
});
