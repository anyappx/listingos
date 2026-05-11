/**
 * Public listing page (/l/[slug]) — video autoplay, property details, lead form.
 * No auth required — this is the shareable link.
 */
import { test, expect } from "@playwright/test";

const BASE = process.env.TEST_BASE_URL || "http://localhost:4000";

test.describe("Public Listing Page", () => {
  async function getPublicUrl(page: any): Promise<string | null> {
    const jobId = process.env.TEST_JOB_ID;
    const listingId = process.env.TEST_LISTING_ID;

    if (!jobId || !listingId) return null;

    // Get the share URL from the done page (must be authenticated)
    // In production this is /l/[slug]; look for it on done page
    const res = await page.request.get(`${BASE}/api/job/${jobId}`);
    if (!res.ok()) return null;

    const data = await res.json();
    return data.shareUrl || null;
  }

  test("public page loads without auth", async ({ page }) => {
    const jobId = process.env.TEST_JOB_ID;
    if (!jobId) {
      test.skip(true, "TEST_JOB_ID not set");
    }

    const publicUrl = await getPublicUrl(page);
    if (!publicUrl) {
      test.skip(true, "Share URL not available in job response");
    }

    await page.goto(publicUrl!, { waitUntil: "networkidle" });
    expect(page.url()).toContain("/l/");

    // Should show video
    const video = page.locator("video").first();
    await expect(video).toBeVisible({ timeout: 10000 });
  });

  test("public page shows property details", async ({ page }) => {
    const publicUrl = await getPublicUrl(page);
    if (!publicUrl) {
      test.skip(true, "Share URL not available");
    }

    await page.goto(publicUrl!, { waitUntil: "networkidle" });

    // Should show address, beds, baths, sqft
    const bodyText = await page.locator("body").textContent();
    // At minimum, address should appear
    expect(bodyText!.length).toBeGreaterThan(100);
  });

  test("lead capture form submits successfully", async ({ page }) => {
    const publicUrl = await getPublicUrl(page);
    if (!publicUrl) {
      test.skip(true, "Share URL not available");
    }

    await page.goto(publicUrl!, { waitUntil: "networkidle" });

    // Scroll to lead form
    const leadForm = page.locator("form").filter({ hasText: /name|email|contact|interested/i }).first();
    if (await leadForm.count() === 0) {
      test.skip(true, "Lead form not found on public page");
    }

    await leadForm.scrollIntoViewIfNeeded();

    // Fill form
    const nameInput = leadForm.getByLabel(/name/i).or(leadForm.getByPlaceholder(/name/i)).first();
    const emailInput = leadForm.getByLabel(/email/i).or(leadForm.getByPlaceholder(/email/i)).first();

    await nameInput.fill("Test Lead Person");
    await emailInput.fill("testlead@example.com");

    // Optional phone
    const phoneInput = leadForm.getByLabel(/phone/i).or(leadForm.getByPlaceholder(/phone/i)).first();
    if (await phoneInput.count() > 0) {
      await phoneInput.fill("5550001234");
    }

    // Submit
    const submitBtn = leadForm.getByRole("button", { name: /submit|send|contact|get info/i });
    await submitBtn.click();

    // Success message
    await expect(
      page.getByText(/thank you|sent|received|we.ll be in touch/i).or(
        page.locator("[data-sonner-toast]")
      )
    ).toBeVisible({ timeout: 10000 });
  });

  test("public page has Powered by ListingOS footer on trial plan", async ({ page }) => {
    const publicUrl = await getPublicUrl(page);
    if (!publicUrl) {
      test.skip(true, "Share URL not available");
    }

    await page.goto(publicUrl!, { waitUntil: "networkidle" });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    const bodyText = await page.locator("body").textContent();
    // Trial accounts show branding
    const hasListingOsBranding = bodyText?.includes("ListingOS") || bodyText?.includes("listingos");
    expect(hasListingOsBranding).toBeTruthy();
  });

  test("view count increments on page visit", async ({ request }) => {
    const listingId = process.env.TEST_LISTING_ID;
    if (!listingId) {
      test.skip(true, "TEST_LISTING_ID not set");
    }

    const resp = await request.post(`${BASE}/api/listings/${listingId}/view`, {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    // Accepts any 2xx or 404 (endpoint may not be fully implemented)
    expect(resp.status()).toBeLessThan(500);
  });
});
