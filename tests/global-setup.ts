/**
 * Global setup: runs once before all tests.
 * Creates a test user in Supabase and saves auth state for all specs.
 */
import { chromium, FullConfig } from "@playwright/test";
import path from "path";
import fs from "fs";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:4000";
export const TEST_EMAIL = process.env.TEST_EMAIL || `e2e+${Date.now()}@listingos-test.com`;
export const TEST_PASSWORD = process.env.TEST_PASSWORD || "TestPass123!";
export const AUTH_STATE_FILE = path.resolve(__dirname, ".auth-state.json");

async function globalSetup(config: FullConfig) {
  // Check if server is reachable before doing anything
  try {
    const { default: http } = await import("http");
    await new Promise<void>((resolve, reject) => {
      const req = http.get(BASE_URL, (res) => { res.resume(); resolve(); });
      req.on("error", reject);
      req.setTimeout(5000, () => { req.destroy(); reject(new Error("timeout")); });
    });
  } catch {
    console.warn(`[setup] Server not reachable at ${BASE_URL} — skipping auth state creation.`);
    console.warn("[setup] Start the dev server with: npm run dev:4000");
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log(`[setup] Creating test account: ${TEST_EMAIL}`);

  try {
    await page.goto(`${BASE_URL}/signup`, { waitUntil: "networkidle", timeout: 30000 });

    await page.getByLabel(/name/i).fill("E2E Test Agent");
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /create account|sign up|get started/i }).click();

    try {
      await page.waitForURL(/\/dashboard/, { timeout: 15000 });
      console.log("[setup] Signed up and redirected to dashboard");
    } catch {
      console.warn("[setup] Redirect to dashboard timed out. Email confirmation may be required.");
    }

    await page.context().storageState({ path: AUTH_STATE_FILE });
    console.log(`[setup] Auth state saved to ${AUTH_STATE_FILE}`);
  } catch (e) {
    console.warn("[setup] Auth state setup failed:", (e as Error).message);
  }

  await browser.close();
}

export default globalSetup;
