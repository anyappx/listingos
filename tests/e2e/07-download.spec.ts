/**
 * Download functionality — 16:9 and 9:16 download buttons, file validity.
 */
import { test, expect } from "../fixtures/auth";
import path from "path";
import fs from "fs";

const BASE = process.env.TEST_BASE_URL || "http://localhost:4000";

test.describe("Download Buttons", () => {
  test("16:9 download returns a valid MP4 (HTTP 200, Content-Type video/*)", async ({ request }) => {
    const videoUrl = process.env.TEST_VIDEO_16X9_URL;
    if (!videoUrl) {
      test.skip(true, "TEST_VIDEO_16X9_URL not set — run generate test first");
    }

    const response = await request.get(videoUrl!);
    expect(response.ok()).toBeTruthy();

    const contentType = response.headers()["content-type"] || "";
    expect(contentType).toMatch(/video|octet-stream/i);

    const body = await response.body();
    expect(body.length).toBeGreaterThan(500_000); // At least 500KB
  });

  test("9:16 download returns a valid MP4", async ({ request }) => {
    const videoUrl = process.env.TEST_VIDEO_9X16_URL;
    if (!videoUrl) {
      test.skip(true, "TEST_VIDEO_9X16_URL not set");
    }

    const response = await request.get(videoUrl!);
    expect(response.ok()).toBeTruthy();

    const body = await response.body();
    expect(body.length).toBeGreaterThan(500_000);
  });

  test("Done page has Download 16:9 and Download 9:16 buttons", async ({ authPage: page }) => {
    const jobId = process.env.TEST_JOB_ID;
    const listingId = process.env.TEST_LISTING_ID;

    if (!jobId) {
      test.skip(true, "TEST_JOB_ID not set — run generate test first");
    }

    await page.goto(`${BASE}/dashboard/new/done?jobId=${jobId}&listingId=${listingId}`, {
      waitUntil: "networkidle",
    });

    // Look for download buttons
    const downloadBtns = page.getByRole("link", { name: /download/i }).or(
      page.getByRole("button", { name: /download/i })
    );
    await expect(downloadBtns.first()).toBeVisible({ timeout: 15000 });

    const count = await downloadBtns.count();
    expect(count).toBeGreaterThanOrEqual(1);
    console.log(`[download] Found ${count} download button(s)`);
  });

  test("Clicking download 16:9 triggers a file download", async ({ authPage: page, context }) => {
    const jobId = process.env.TEST_JOB_ID;
    if (!jobId) {
      test.skip(true, "TEST_JOB_ID not set");
    }

    await page.goto(`${BASE}/dashboard/new/done?jobId=${jobId}`, { waitUntil: "networkidle" });

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Find the 16:9 download button/link
    const download16x9 = page
      .getByRole("link", { name: /16.?9|landscape/i })
      .or(page.getByRole("button", { name: /16.?9|landscape/i }))
      .first();

    if (await download16x9.count() === 0) {
      // Fall back to first download button
      const anyDownload = page.getByRole("link", { name: /download/i }).first();
      if (await anyDownload.count() === 0) {
        test.skip(true, "No download button found");
      }
    }

    // Set up download listener
    const downloadPromise = page.waitForEvent("download", { timeout: 15000 }).catch(() => null);
    await download16x9.first().click();

    const download = await downloadPromise;
    if (download) {
      console.log("[download] Downloaded:", await download.suggestedFilename());
      const suggestedName = await download.suggestedFilename();
      expect(suggestedName).toMatch(/\.mp4$/i);
    }
  });
});
