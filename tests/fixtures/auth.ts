/**
 * Playwright test fixture: authenticated browser context.
 * Loads saved auth state from global-setup so tests don't re-login each time.
 */
import { test as base, BrowserContext, Page } from "@playwright/test";
import path from "path";
import fs from "fs";

const AUTH_STATE_FILE = path.resolve(__dirname, "../.auth-state.json");
const TEST_LISTING_FILE = path.resolve(__dirname, "../.test-listing-id");

type AuthFixtures = {
  authPage: Page;
  authContext: BrowserContext;
  testListingId: string | null;
};

export const test = base.extend<AuthFixtures>({
  authContext: async ({ browser }, use) => {
    const options = fs.existsSync(AUTH_STATE_FILE)
      ? { storageState: AUTH_STATE_FILE }
      : {};
    const context = await browser.newContext(options);
    await use(context);
    await context.close();
  },
  authPage: async ({ authContext }, use) => {
    const page = await authContext.newPage();
    await use(page);
  },
  testListingId: async ({}, use) => {
    const fromEnv = process.env.TEST_LISTING_ID;
    if (fromEnv) { await use(fromEnv); return; }
    const fromFile = fs.existsSync(TEST_LISTING_FILE)
      ? fs.readFileSync(TEST_LISTING_FILE, "utf8").trim()
      : null;
    await use(fromFile || null);
  },
});

export { expect } from "@playwright/test";
