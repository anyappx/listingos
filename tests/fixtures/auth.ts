/**
 * Playwright test fixture: authenticated browser context.
 * Loads saved auth state from global-setup so tests don't re-login each time.
 */
import { test as base, BrowserContext, Page } from "@playwright/test";
import path from "path";
import fs from "fs";

const AUTH_STATE_FILE = path.resolve(__dirname, "../.auth-state.json");

type AuthFixtures = {
  authPage: Page;
  authContext: BrowserContext;
};

export const test = base.extend<AuthFixtures>({
  authContext: async ({ browser }, use) => {
    // Load saved auth state if it exists
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
});

export { expect } from "@playwright/test";
