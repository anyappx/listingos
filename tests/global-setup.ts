/**
 * Global setup: runs once before all tests.
 * Logs in with TEST_EMAIL/TEST_PASSWORD (or creates account if login fails)
 * and saves auth state for all specs.
 *
 * Set TEST_EMAIL + TEST_PASSWORD env vars to use an existing account.
 * Default: creates a fresh account via signup.
 */
import { chromium, FullConfig } from "@playwright/test";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:4000";
export const TEST_EMAIL = process.env.TEST_EMAIL || `e2e+${Date.now()}@listingos-test.com`;
export const TEST_PASSWORD = process.env.TEST_PASSWORD || "TestPass123!";
export const AUTH_STATE_FILE = path.resolve(__dirname, ".auth-state.json");
export const TEST_LISTING_FILE = path.resolve(__dirname, ".test-listing-id");

async function globalSetup(config: FullConfig) {
  // Skip auth setup when running unit tests only
  if (process.env.PLAYWRIGHT_PROJECT === "unit") {
    console.log("[setup] Unit project — skipping auth setup");
    return;
  }

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

  // Strategy: try login first (faster, works with existing accounts),
  // fall back to signup if login fails
  const usingExistingCreds = !!process.env.TEST_EMAIL;

  if (usingExistingCreds) {
    console.log(`[setup] Logging in as: ${TEST_EMAIL}`);
    try {
      await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: 30000 });
      await page.getByLabel(/email/i).fill(TEST_EMAIL);
      await page.getByLabel(/password/i).fill(TEST_PASSWORD);
      await page.getByRole("button", { name: /sign in/i }).click();
      await page.waitForURL(/\/dashboard/, { timeout: 15000 });
      console.log("[setup] Logged in successfully");
      await page.context().storageState({ path: AUTH_STATE_FILE });
      console.log(`[setup] Auth state saved to ${AUTH_STATE_FILE}`);
      // Create a persistent test listing for UI tests that need a listingId
      await createTestListing(page);
      await browser.close();
      return;
    } catch (e) {
      console.warn("[setup] Login failed, falling back to signup:", (e as Error).message);
    }
  }

  // Signup path (fresh account)
  console.log(`[setup] Creating test account: ${TEST_EMAIL}`);
  try {
    await page.goto(`${BASE_URL}/signup`, { waitUntil: "networkidle", timeout: 30000 });

    await page.getByLabel(/name/i).fill("E2E Test Agent");
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /create.*account|free account|sign up|get started/i }).click();

    try {
      await page.waitForURL(/\/dashboard/, { timeout: 15000 });
      console.log("[setup] Signed up and redirected to dashboard");
    } catch {
      console.warn("[setup] Redirect to dashboard timed out — email confirmation may be required.");
      console.warn("[setup] Set TEST_EMAIL + TEST_PASSWORD env vars to use an existing confirmed account.");
    }

    await page.context().storageState({ path: AUTH_STATE_FILE });
    console.log(`[setup] Auth state saved to ${AUTH_STATE_FILE}`);
  } catch (e) {
    console.warn("[setup] Auth state setup failed:", (e as Error).message);
  }

  await browser.close();
}

async function createTestListing(page: import("@playwright/test").Page) {
  try {
    const listingId = crypto.randomUUID();
    const slug = `e2e-test-${listingId.slice(0, 8)}`;
    const res = await page.request.post(`${BASE_URL}/api/listings/create`, {
      data: {
        id: listingId,
        slug,
        address: "123 Test St",
        city: "Austin",
        state: "TX",
        zip: "78701",
        price: 500000,
        beds: 3,
        baths: 2,
        sqft: 1800,
        photos: [
          { url: "https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?w=1920", order: 0, is_cover: true },
          { url: "https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?w=1920", order: 1, is_cover: false },
        ],
      },
    });
    if (res.ok()) {
      fs.writeFileSync(TEST_LISTING_FILE, listingId, "utf8");
      console.log(`[setup] Test listing created: ${listingId}`);
    } else {
      const body = await res.json().catch(() => ({}));
      console.warn(`[setup] Test listing creation failed: ${res.status()} ${JSON.stringify(body)}`);
    }
  } catch (e) {
    console.warn("[setup] Test listing creation error:", (e as Error).message);
  }
}

export default globalSetup;
