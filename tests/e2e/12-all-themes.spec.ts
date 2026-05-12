/**
 * All 8 theme validation tests.
 *
 * Strategy: Use the /api/generate API directly to validate each theme is
 * accepted by the server-side Zod schema (no actual video rendered).
 * Also verifies Cinematic/Coastal/Desert/Urban aren't rejected as "invalid option".
 *
 * Negative path: 9th fake theme "galaxy" is rejected with 400.
 */
import { test, expect } from "../fixtures/auth";

const BASE = process.env.TEST_BASE_URL || "http://localhost:4000";

const VALID_THEMES = [
  "modern", "luxury", "energetic", "minimal",
  "cinematic", "coastal", "desert", "urban",
];

// Valid Zod UUID v4 format: version=4, variant=b
const FAKE_LISTING_ID = "ffffffff-ffff-4fff-bfff-ffffffffffff";
const FAKE_TRACK_ID = "eeeeeeee-eeee-4eee-beee-eeeeeeeeeeee";

test.describe("Theme Validation (API)", () => {
  test("all 8 themes pass server-side Zod validation", async ({ authPage: page, testListingId }) => {
    const listingId = testListingId || FAKE_LISTING_ID;

    for (const style of VALID_THEMES) {
      const res = await page.request.post(`${BASE}/api/generate`, {
        data: {
          listingId,
          style,
          durationSeconds: 15,
          formats: "16x9",
          musicTrackId: FAKE_TRACK_ID,
          includeNeighborhoodBroll: false,
        },
      });

      // 400 = validation error (theme rejected)
      // 402 = no credits (theme accepted, just no credits) — acceptable
      // 404 = listing not found (theme accepted, listing just not in DB) — acceptable
      // 200/201 = job queued — acceptable
      // 409 = duplicate job — acceptable
      expect(
        res.status(),
        `Theme "${style}" should not fail validation (got ${res.status()})`
      ).not.toBe(400);
    }
  });

  test("invalid theme 'galaxy' is rejected with 400", async ({ authPage: page }) => {
    const res = await page.request.post(`${BASE}/api/generate`, {
      data: {
        listingId: FAKE_LISTING_ID,
        style: "galaxy",
        durationSeconds: 30,
        formats: "16x9",
        musicTrackId: FAKE_TRACK_ID,
        includeNeighborhoodBroll: false,
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test("empty style string is rejected with 400", async ({ authPage: page }) => {
    const res = await page.request.post(`${BASE}/api/generate`, {
      data: {
        listingId: FAKE_LISTING_ID,
        style: "",
        durationSeconds: 30,
        formats: "16x9",
        musicTrackId: FAKE_TRACK_ID,
        includeNeighborhoodBroll: false,
      },
    });
    expect(res.status()).toBe(400);
  });

  test("cinematic theme specifically not rejected (was bug in previous version)", async ({ authPage: page, testListingId }) => {
    const listingId = testListingId || FAKE_LISTING_ID;

    const res = await page.request.post(`${BASE}/api/generate`, {
      data: {
        listingId,
        style: "cinematic",
        durationSeconds: 30,
        formats: "16x9",
        musicTrackId: FAKE_TRACK_ID,
        includeNeighborhoodBroll: false,
      },
    });
    // Must NOT be 400 (validation error)
    expect(res.status()).not.toBe(400);
  });
});

test.describe("Theme UI Rendering", () => {
  test("all 8 theme names shown on customize page", async ({ authPage: page, testListingId }) => {
    if (!testListingId) {
      test.skip(true, "No test listing available — run global-setup with TEST_EMAIL/TEST_PASSWORD");
      return;
    }

    await page.goto(`${BASE}/dashboard/new/customize?listingId=${testListingId}`, {
      waitUntil: "networkidle",
    });

    const bodyText = await page.locator("body").textContent();
    for (const theme of VALID_THEMES) {
      expect(bodyText, `Expected theme "${theme}" on customize page`).toMatch(
        new RegExp(theme, "i")
      );
    }
  });

  test("clicking each theme doesn't produce JS error", async ({ authPage: page, testListingId }) => {
    if (!testListingId) {
      test.skip(true, "No test listing available — run global-setup with TEST_EMAIL/TEST_PASSWORD");
      return;
    }

    await page.goto(`${BASE}/dashboard/new/customize?listingId=${testListingId}`, {
      waitUntil: "networkidle",
    });

    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    for (const theme of ["Cinematic", "Coastal", "Desert", "Urban"]) {
      const btn = page
        .getByRole("button", { name: new RegExp(theme, "i") })
        .or(page.getByText(theme, { exact: true }).locator(".."))
        .first();

      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(200);
      }
    }

    expect(errors, `JS errors clicking themes: ${errors.join(", ")}`).toHaveLength(0);
  });
});
