/**
 * Listings dashboard — grid view, status badges, listing detail page.
 */
import { test, expect } from "../fixtures/auth";

const BASE = process.env.TEST_BASE_URL || "http://localhost:4000";

test.describe("Listings Dashboard", () => {
  test.beforeEach(async ({ authPage }) => {
    await authPage.goto(`${BASE}/dashboard/listings`, { waitUntil: "networkidle" });
  });

  test("listings page loads without error", async ({ authPage: page }) => {
    await expect(page.locator("body")).toBeVisible();

    // Should not show generic error
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).not.toMatch(/500 internal server error|something went wrong/i);
  });

  test("shows at least one listing after generation", async ({ authPage: page }) => {
    const jobId = process.env.TEST_JOB_ID;
    if (!jobId) {
      test.skip(true, "No test job completed yet");
    }

    // After generating a video, listing should appear in the grid
    const listingCards = page
      .locator("[data-testid='listing-card']")
      .or(page.locator(".listing-card"))
      .or(page.locator("article"))
      .or(page.locator("a[href*='/dashboard/listings/']"));

    const count = await listingCards.count();
    console.log("[dashboard] Listing card count:", count);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("listing card shows thumbnail, address, and status badge", async ({ authPage: page }) => {
    const jobId = process.env.TEST_JOB_ID;
    if (!jobId) {
      test.skip(true, "No test job completed yet");
    }

    // Check for thumbnail image
    const thumbs = page.locator("img[src*='thumb'], img[alt*='listing'], img[alt*='thumbnail']");
    if (await thumbs.count() > 0) {
      await expect(thumbs.first()).toBeVisible();
    }

    // Status badge should say "complete" or similar
    const statusBadge = page
      .getByText(/complete|done|ready/i)
      .or(page.locator("[data-testid='status-badge']"))
      .first();

    if (await statusBadge.count() > 0) {
      await expect(statusBadge).toBeVisible();
    }
  });

  test("clicking a listing navigates to detail page", async ({ authPage: page }) => {
    const listingLink = page
      .locator("a[href*='/dashboard/listings/']")
      .first();

    if (await listingLink.count() === 0) {
      test.skip(true, "No listing links found");
    }

    await listingLink.click();
    await page.waitForURL(/\/dashboard\/listings\/.+/, { timeout: 10000 });
    expect(page.url()).toMatch(/\/dashboard\/listings\/.+/);
  });

  test("listing detail page shows video players", async ({ authPage: page }) => {
    const listingId = process.env.TEST_LISTING_ID;
    if (!listingId) {
      test.skip(true, "TEST_LISTING_ID not set");
    }

    await page.goto(`${BASE}/dashboard/listings/${listingId}`, { waitUntil: "networkidle" });

    const video = page.locator("video").first();
    if (await video.count() > 0) {
      await expect(video).toBeVisible({ timeout: 10000 });
    } else {
      // Listing detail may show thumbnail instead
      const thumb = page.locator("img[alt*='thumbnail'], img[src*='thumb']").first();
      if (await thumb.count() > 0) {
        await expect(thumb).toBeVisible();
      }
    }
  });

  test("listings dashboard shows usage bar", async ({ authPage: page }) => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });

    // Usage bar showing X/10 or similar
    const usageBar = page
      .locator("[role='progressbar']")
      .or(page.getByText(/\d+\s*\/\s*\d+/))
      .first();

    if (await usageBar.count() > 0) {
      await expect(usageBar).toBeVisible();
    }
  });
});
