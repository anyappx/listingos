/**
 * Auth flow — signup, login, logout, protected route redirect.
 */
import { test, expect } from "@playwright/test";
import crypto from "crypto";

const BASE = process.env.TEST_BASE_URL || "http://localhost:4000";

test.describe("Authentication", () => {
  test("signup page renders all required fields", async ({ page }) => {
    await page.goto(`${BASE}/signup`);

    await expect(page.getByLabel(/name/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /create|sign up|get started/i })).toBeVisible();
  });

  test("signup validates email format", async ({ page }) => {
    await page.goto(`${BASE}/signup`);

    await page.getByLabel(/name/i).fill("Test User");
    await page.getByLabel(/email/i).fill("not-an-email");
    await page.getByLabel(/password/i).fill("TestPass123!");
    await page.getByRole("button", { name: /create|sign up|get started/i }).click();

    // Browser HTML5 validation or toast error
    const emailInput = page.getByLabel(/email/i);
    const isInvalid = await emailInput.evaluate(
      (el: HTMLInputElement) => !el.checkValidity()
    );
    if (!isInvalid) {
      // Check for toast error instead
      await expect(
        page.getByText(/invalid email|valid email/i).or(page.locator("[data-sonner-toast]"))
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test("signup rejects password under 8 characters", async ({ page }) => {
    await page.goto(`${BASE}/signup`);

    await page.getByLabel(/name/i).fill("Test User");
    await page.getByLabel(/email/i).fill(`test+${Date.now()}@example.com`);
    await page.getByLabel(/password/i).fill("short");
    await page.getByRole("button", { name: /create|sign up|get started/i }).click();

    await expect(
      page.getByText(/at least 8|minimum 8|password.*8/i).or(
        page.locator("[data-sonner-toast]")
      )
    ).toBeVisible({ timeout: 5000 });
  });

  test("login page renders email + password form", async ({ page }) => {
    await page.goto(`${BASE}/login`);

    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in|log in/i })).toBeVisible();
  });

  test("login shows error for invalid credentials", async ({ page }) => {
    await page.goto(`${BASE}/login`);

    await page.getByLabel(/email/i).fill("nonexistent@example.com");
    await page.getByLabel(/password/i).fill("WrongPassword123!");
    await page.getByRole("button", { name: /sign in|log in/i }).click();

    await expect(
      page.getByText(/invalid|incorrect|wrong|not found/i).or(
        page.locator("[data-sonner-toast]")
      )
    ).toBeVisible({ timeout: 10000 });
  });

  test("unauthenticated access to /dashboard redirects to /login", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/login|\/signup/);
  });

  test("successful signup redirects to /dashboard/new", async ({ page }) => {
    const uniqueEmail = `e2e+${crypto.randomUUID().slice(0, 8)}@test.com`;

    await page.goto(`${BASE}/signup`);
    await page.getByLabel(/name/i).fill("E2E Tester");
    await page.getByLabel(/email/i).fill(uniqueEmail);
    await page.getByLabel(/password/i).fill("TestPass123!");
    await page.getByRole("button", { name: /create|sign up|get started/i }).click();

    // Should redirect to /dashboard/new (or /dashboard if email confirm required)
    await page.waitForURL(/\/dashboard/, { timeout: 20000 });
    expect(page.url()).toMatch(/\/dashboard/);
  });
});
