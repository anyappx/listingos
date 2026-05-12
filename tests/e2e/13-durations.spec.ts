/**
 * Duration validation — all 6 values (15/30/45/60/90/120s).
 *
 * Happy paths:
 *  - All 6 accepted by server-side Zod schema
 *  - UI shows all 6 options
 *
 * Negative paths:
 *  - durationSeconds=0 rejected
 *  - durationSeconds=75 (non-allowed value) rejected
 *  - durationSeconds=300 (too long) rejected
 *  - Missing durationSeconds rejected
 */
import { test, expect } from "../fixtures/auth";

const BASE = process.env.TEST_BASE_URL || "http://localhost:4000";

const VALID_DURATIONS = [15, 30, 45, 60, 90, 120];
const INVALID_DURATIONS = [0, 10, 75, 180, 300, -1];

// Valid Zod UUID v4 format: version=4, variant=b
const FAKE_LISTING_ID = "ffffffff-ffff-4fff-bfff-ffffffffffff";
const FAKE_TRACK_ID = "eeeeeeee-eeee-4eee-beee-eeeeeeeeeeee";

const BASE_PAYLOAD = {
  style: "modern",
  formats: "16x9" as const,
  musicTrackId: FAKE_TRACK_ID,
  includeNeighborhoodBroll: false,
};

test.describe("Duration Validation (API)", () => {
  test("all 6 valid durations accepted (not 400)", async ({ authPage: page, testListingId }) => {
    const listingId = testListingId || FAKE_LISTING_ID;

    for (const duration of VALID_DURATIONS) {
      const res = await page.request.post(`${BASE}/api/generate`, {
        data: { ...BASE_PAYLOAD, listingId, durationSeconds: duration },
      });

      expect(
        res.status(),
        `Duration ${duration}s should not fail Zod validation`
      ).not.toBe(400);
    }
  });

  test("90s duration specifically accepted (was missing before fix)", async ({ authPage: page, testListingId }) => {
    const listingId = testListingId || FAKE_LISTING_ID;

    const res = await page.request.post(`${BASE}/api/generate`, {
      data: { ...BASE_PAYLOAD, listingId, durationSeconds: 90 },
    });
    expect(res.status(), "90s should be accepted").not.toBe(400);
  });

  test("120s duration specifically accepted (was missing before fix)", async ({ authPage: page, testListingId }) => {
    const listingId = testListingId || FAKE_LISTING_ID;

    const res = await page.request.post(`${BASE}/api/generate`, {
      data: { ...BASE_PAYLOAD, listingId, durationSeconds: 120 },
    });
    expect(res.status(), "120s should be accepted").not.toBe(400);
  });

  for (const duration of INVALID_DURATIONS) {
    test(`invalid duration ${duration}s rejected with 400`, async ({ authPage: page }) => {
      const res = await page.request.post(`${BASE}/api/generate`, {
        data: { ...BASE_PAYLOAD, listingId: FAKE_LISTING_ID, durationSeconds: duration },
      });
      expect(
        res.status(),
        `Duration ${duration}s should be rejected as invalid`
      ).toBe(400);
    });
  }

  test("missing durationSeconds rejected with 400", async ({ authPage: page }) => {
    const res = await page.request.post(`${BASE}/api/generate`, {
      data: {
        listingId: FAKE_LISTING_ID,
        style: "modern",
        formats: "16x9",
        musicTrackId: FAKE_TRACK_ID,
        includeNeighborhoodBroll: false,
        // durationSeconds intentionally omitted
      },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe("Duration UI", () => {
  test("all 6 duration labels visible on customize page", async ({ authPage: page, testListingId }) => {
    if (!testListingId) {
      test.skip(true, "No test listing available — run global-setup with TEST_EMAIL/TEST_PASSWORD");
      return;
    }

    await page.goto(`${BASE}/dashboard/new/customize?listingId=${testListingId}`, {
      waitUntil: "networkidle",
    });

    const bodyText = await page.locator("body").textContent();
    for (const dur of VALID_DURATIONS) {
      expect(bodyText, `Expected duration "${dur}s" on page`).toMatch(
        new RegExp(`${dur}s?`, "i")
      );
    }
  });

  test("90s and 120s buttons are clickable without crash", async ({ authPage: page, testListingId }) => {
    if (!testListingId) {
      test.skip(true, "No test listing available — run global-setup with TEST_EMAIL/TEST_PASSWORD");
      return;
    }

    await page.goto(`${BASE}/dashboard/new/customize?listingId=${testListingId}`, {
      waitUntil: "networkidle",
    });

    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    for (const dur of ["90s", "120s"]) {
      const btn = page
        .getByRole("button", { name: new RegExp(`^${dur}$`, "i") })
        .or(page.getByText(dur, { exact: true }).locator(".."))
        .first();

      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(200);
      }
    }

    expect(errors, `JS errors clicking durations: ${errors.join(", ")}`).toHaveLength(0);
  });
});
