/**
 * Customize page — style, duration, format, music selection.
 * Updated: all 8 themes + all 6 durations (15s–120s) + format options.
 */
import { test, expect } from "../fixtures/auth";

const BASE = process.env.TEST_BASE_URL || "http://localhost:4000";

// All valid styles as per lib/validations.ts GenerateInputSchema
const ALL_STYLES = [
  "Modern", "Luxury", "Energetic", "Minimal",
  "Cinematic", "Coastal", "Desert", "Urban",
];

// All valid durations as per lib/validations.ts GenerateInputSchema
const ALL_DURATIONS = ["15s", "30s", "45s", "60s", "90s", "120s"];

test.describe("Customize Page", () => {
  test.beforeEach(async ({ authPage, testListingId }) => {
    if (!testListingId) {
      // Skip all tests in this describe block when no listing is available
      return;
    }
    await authPage.goto(`${BASE}/dashboard/new/customize?listingId=${testListingId}`, {
      waitUntil: "networkidle",
    });
  });

  // ─── THEME TESTS ────────────────────────────────────────────────────────────

  test("shows all 8 style tiles", async ({ authPage: page, testListingId }) => {
    if (!testListingId) { test.skip(true, "No test listing — set TEST_EMAIL/TEST_PASSWORD"); return; }
    const bodyText = await page.locator("body").textContent();
    for (const style of ALL_STYLES) {
      expect(bodyText, `Expected style "${style}" to be present`).toMatch(
        new RegExp(style, "i")
      );
    }
  });

  test("original 4 themes visible: Modern, Luxury, Energetic, Minimal", async ({ authPage: page, testListingId }) => {
    if (!testListingId) { test.skip(true, "No test listing"); return; }
    for (const style of ["Modern", "Luxury", "Energetic", "Minimal"]) {
      await expect(
        page.getByText(style, { exact: true }).or(page.getByRole("button", { name: style })).first()
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test("new 4 themes visible: Cinematic, Coastal, Desert, Urban", async ({ authPage: page, testListingId }) => {
    if (!testListingId) { test.skip(true, "No test listing"); return; }
    for (const style of ["Cinematic", "Coastal", "Desert", "Urban"]) {
      await expect(
        page.getByText(style, { exact: true }).or(page.getByRole("button", { name: style })).first()
      ).toBeVisible({ timeout: 10000 });
    }
  });

  for (const style of ALL_STYLES) {
    test(`clicking "${style}" style does not crash or navigate away`, async ({ authPage: page, testListingId }) => {
      if (!testListingId) { test.skip(true, "No test listing"); return; }
      const btn = page
        .getByRole("button", { name: new RegExp(style, "i") })
        .or(page.getByText(style, { exact: true }).locator(".."))
        .first();

      await expect(btn).toBeVisible({ timeout: 8000 });
      await btn.click();
      await page.waitForTimeout(300);

      expect(page.url()).toContain("/customize");
    });
  }

  // ─── DURATION TESTS ─────────────────────────────────────────────────────────

  test("all 6 duration options present (15s–120s)", async ({ authPage: page, testListingId }) => {
    if (!testListingId) { test.skip(true, "No test listing"); return; }
    const bodyText = await page.locator("body").textContent();
    for (const dur of ALL_DURATIONS) {
      expect(bodyText, `Expected duration "${dur}" to be present`).toMatch(
        new RegExp(dur, "i")
      );
    }
  });

  test("90s duration option is clickable", async ({ authPage: page, testListingId }) => {
    if (!testListingId) { test.skip(true, "No test listing"); return; }
    const btn = page
      .getByRole("button", { name: /90s?(?!\d)/i })
      .or(page.getByText("90s").locator(".."))
      .first();
    await expect(btn).toBeVisible({ timeout: 8000 });
    await btn.click();
    await page.waitForTimeout(200);
    expect(page.url()).toContain("/customize");
  });

  test("120s (2-minute) duration option is clickable", async ({ authPage: page, testListingId }) => {
    if (!testListingId) { test.skip(true, "No test listing"); return; }
    const btn = page
      .getByRole("button", { name: /120s?/i })
      .or(page.getByText("120s").locator(".."))
      .first();
    await expect(btn).toBeVisible({ timeout: 8000 });
    await btn.click();
    await page.waitForTimeout(200);
    expect(page.url()).toContain("/customize");
  });

  // ─── FORMAT TESTS ───────────────────────────────────────────────────────────

  test("format options 16:9, 9:16 are present", async ({ authPage: page, testListingId }) => {
    if (!testListingId) { test.skip(true, "No test listing"); return; }
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).toMatch(/16:9|16x9/i);
    expect(bodyText).toMatch(/9:16|9x16/i);
  });

  // ─── GENERATE BUTTON ────────────────────────────────────────────────────────

  test("Generate Video button is present and visible", async ({ authPage: page, testListingId }) => {
    if (!testListingId) { test.skip(true, "No test listing"); return; }
    const genBtn = page.getByRole("button", { name: /generate|create.*video/i });
    await expect(genBtn.first()).toBeVisible({ timeout: 5000 });
  });

  test("Generate Video button enabled or shows credit message if no credits", async ({ authPage: page, testListingId }) => {
    if (!testListingId) { test.skip(true, "No test listing"); return; }
    const genBtn = page.getByRole("button", { name: /generate|create.*video/i }).first();
    await expect(genBtn).toBeVisible({ timeout: 5000 });

    const isDisabled = await genBtn.isDisabled();
    if (isDisabled) {
      const bodyText = await page.locator("body").textContent();
      expect(bodyText).toMatch(/credit|upgrade|limit|quota/i);
    }
  });

  // ─── MUSIC SECTION ──────────────────────────────────────────────────────────

  test("music section or track selector visible", async ({ authPage: page, testListingId }) => {
    if (!testListingId) { test.skip(true, "No test listing"); return; }
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).toMatch(/music|track|audio|sound/i);
  });

  // ─── HEADLINE SECTION ───────────────────────────────────────────────────────

  test("headline presets visible when listing loaded", async ({ authPage: page, testListingId }) => {
    if (!testListingId) { test.skip(true, "No listing loaded — headline section not testable"); return; }
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).toMatch(/just listed|open house|price reduced|coming soon|headline/i);
  });
});
