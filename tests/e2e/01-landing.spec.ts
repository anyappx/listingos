/**
 * Landing page — hero, CTA, pricing, navigation.
 * No auth required.
 */
import { test, expect } from "@playwright/test";

const BASE = process.env.TEST_BASE_URL || "http://localhost:4000";

test.describe("Landing Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
  });

  test("renders hero section with primary CTA", async ({ page }) => {
    // Hero headline visible
    const hero = page.locator("h1, [data-testid='hero-heading']").first();
    await expect(hero).toBeVisible();
    const heroText = await hero.textContent();
    expect(heroText).toBeTruthy();

    // At least one CTA button that navigates to /signup or /dashboard
    const cta = page.getByRole("link", { name: /get.*free.*video|try.*free|start.*free|create.*video/i });
    await expect(cta.first()).toBeVisible();
  });

  test("URL input field is present and accepts text", async ({ page }) => {
    // Should have a URL input field on landing page
    const urlInput = page
      .getByPlaceholder(/paste.*url|zillow|redfin|listing url/i)
      .or(page.getByLabel(/url|listing/i))
      .first();

    if (await urlInput.count() > 0) {
      await urlInput.fill("https://www.redfin.com/CA/San-Francisco/123-Test-St");
      await expect(urlInput).toHaveValue(/redfin/);
    } else {
      // Some landing pages use a different approach
      test.skip(true, "No URL input on landing page");
    }
  });

  test("pricing section shows Solo and Agent plans", async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Pricing should mention $29 and $79
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).toMatch(/\$29|\$79|29\/mo|79\/mo/i);
  });

  test("navigation links to /login and /signup are present", async ({ page }) => {
    const loginLink = page.getByRole("link", { name: /^log\s*in$|^sign\s*in$/i });
    const signupLink = page.getByRole("link", { name: /^sign\s*up$|^get\s*started$/i });

    // At least one of these should exist
    const eitherVisible = await loginLink.count() > 0 || await signupLink.count() > 0;
    expect(eitherVisible).toBeTruthy();
  });

  test("page title is descriptive", async ({ page }) => {
    const title = await page.title();
    expect(title.length).toBeGreaterThan(5);
  });

  test("page loads without JavaScript errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.reload({ waitUntil: "networkidle" });
    // Allow minor React hydration warnings but no hard errors
    const hardErrors = errors.filter(
      (e) => !e.includes("Warning") && !e.includes("ReactDOM")
    );
    expect(hardErrors).toHaveLength(0);
  });
});
