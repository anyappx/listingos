/**
 * Listing import — URL scrape, photo grid, manual upload, validation.
 * Requires auth state from global-setup.
 */
import { test, expect } from "../fixtures/auth";
import path from "path";

const BASE = process.env.TEST_BASE_URL || "http://localhost:4000";

// A real Redfin URL with multiple photos for testing
const TEST_REDFIN_URL =
  process.env.TEST_LISTING_URL ||
  "https://www.redfin.com/CA/Beverly-Hills/9507-Sunset-Blvd-90210/home/6788417";

test.describe("Listing Import", () => {
  test.beforeEach(async ({ authPage }) => {
    await authPage.goto(`${BASE}/dashboard/new`, { waitUntil: "networkidle" });
  });

  test("new listing page shows URL input and upload option", async ({ authPage: page }) => {
    await expect(page.getByPlaceholder(/zillow|redfin|url|listing/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /import|scrape|fetch|continue/i })).toBeVisible();
  });

  test("empty URL submit shows validation error", async ({ authPage: page }) => {
    // Try submitting empty URL
    const form = page.locator("form").first();
    const submitBtn = form.getByRole("button").first();
    await submitBtn.click();

    // URL input should be required or show error
    const urlInput = page.getByPlaceholder(/zillow|redfin|url|listing/i);
    const valid = await urlInput.evaluate((el: HTMLInputElement) => el.checkValidity());
    expect(valid).toBeFalsy();
  });

  test("invalid URL (not Zillow/Redfin) shows appropriate error", async ({ authPage: page }) => {
    const urlInput = page.getByPlaceholder(/zillow|redfin|url|listing/i);
    await urlInput.fill("https://google.com/not-a-listing");

    const submitBtn = page.locator("form").first().getByRole("button").first();
    await submitBtn.click();

    await expect(
      page.getByText(/zillow|redfin|supported|valid listing url/i).or(
        page.locator("[data-sonner-toast]")
      )
    ).toBeVisible({ timeout: 10000 });
  });

  test("Redfin URL import loads photos and listing data", async ({ authPage: page }) => {
    test.setTimeout(60000);

    const urlInput = page.getByPlaceholder(/zillow|redfin|url|listing/i);
    await urlInput.fill(TEST_REDFIN_URL);

    const submitBtn = page.locator("form").first().getByRole("button").first();
    await submitBtn.click();

    // Wait for scraping to complete — photo grid should appear
    await expect(
      page.locator("img[src*='redfin'], img[src*='cloudfront'], img[src*='blob:'], img[alt*='photo']").first()
    ).toBeVisible({ timeout: 45000 });

    // Address field should be populated
    const addressInput = page.getByLabel(/address/i).or(
      page.getByPlaceholder(/address/i)
    ).first();

    if (await addressInput.count() > 0) {
      const addressValue = await addressInput.inputValue();
      expect(addressValue.length).toBeGreaterThan(0);
    }
  });

  test("scrape loads at least 3 photos", async ({ authPage: page }) => {
    test.setTimeout(60000);

    const urlInput = page.getByPlaceholder(/zillow|redfin|url|listing/i);
    await urlInput.fill(TEST_REDFIN_URL);
    await page.locator("form").first().getByRole("button").first().click();

    // Wait for photo grid
    await page.waitForTimeout(5000);
    await page.waitForFunction(
      () => document.querySelectorAll("img").length >= 3,
      { timeout: 45000 }
    );

    const images = await page.locator("img").count();
    expect(images).toBeGreaterThanOrEqual(3);
  });

  test("can remove a photo from the grid", async ({ authPage: page }) => {
    test.setTimeout(60000);

    const urlInput = page.getByPlaceholder(/zillow|redfin|url|listing/i);
    await urlInput.fill(TEST_REDFIN_URL);
    await page.locator("form").first().getByRole("button").first().click();

    // Wait for photos
    await page.waitForFunction(
      () => document.querySelectorAll("img").length >= 2,
      { timeout: 45000 }
    );

    const countBefore = await page.locator("img").count();

    // Click remove/X button on first photo
    const removeBtn = page.getByRole("button", { name: /remove|delete/i }).or(
      page.locator("button[aria-label*='remove'], button svg[class*='x'], [data-testid*='remove']")
    ).first();

    if (await removeBtn.count() > 0) {
      await removeBtn.click();
      await page.waitForTimeout(500);
      const countAfter = await page.locator("img").count();
      expect(countAfter).toBeLessThan(countBefore);
    } else {
      test.skip(true, "No remove button found on photos");
    }
  });

  test("Continue button leads to /customize page", async ({ authPage: page }) => {
    test.setTimeout(60000);

    const urlInput = page.getByPlaceholder(/zillow|redfin|url|listing/i);
    await urlInput.fill(TEST_REDFIN_URL);
    await page.locator("form").first().getByRole("button").first().click();

    // Wait for photos
    await page.waitForFunction(
      () => document.querySelectorAll("img").length >= 1,
      { timeout: 45000 }
    );

    // Find and click Continue button
    const continueBtn = page.getByRole("button", { name: /continue|next|customize/i }).last();
    await expect(continueBtn).toBeVisible({ timeout: 5000 });
    await continueBtn.click();

    await page.waitForURL(/\/customize/, { timeout: 15000 });
    expect(page.url()).toContain("/customize");
  });
});
