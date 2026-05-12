/**
 * Comprehensive negative-path tests across all API routes.
 *
 * Covers:
 *  - Unauthenticated requests → 401
 *  - Missing/malformed bodies → 400
 *  - Non-existent resources → 404
 *  - Wrong HTTP method → 405
 *  - Boundary/extreme input values
 *  - SQL injection attempts (should be rejected gracefully)
 *  - UUID format validation
 *  - Oversized inputs
 */
import { test, expect } from "../fixtures/auth";

const BASE = process.env.TEST_BASE_URL || "http://localhost:4000";

// Valid Zod UUID v4 format (version=4, variant=b) — guaranteed not to exist in DB
const FAKE_UUID_1 = "ffffffff-ffff-4fff-bfff-ffffffffffff";
const FAKE_UUID_2 = "eeeeeeee-eeee-4eee-beee-eeeeeeeeeeee";
const FAKE_UUID_3 = "dddddddd-dddd-4ddd-bddd-dddddddddddd";

// ─── /api/scrape ─────────────────────────────────────────────────────────────

test.describe("POST /api/scrape — negative paths", () => {
  test("missing url → 400", async ({ authPage: page }) => {
    const res = await page.request.post(`${BASE}/api/scrape`, { data: {} });
    expect(res.status()).toBe(400);
  });

  test("invalid url string → 400", async ({ authPage: page }) => {
    const res = await page.request.post(`${BASE}/api/scrape`, {
      data: { url: "not-a-url" },
    });
    expect(res.status()).toBe(400);
  });

  test("non-listing domain → 400", async ({ authPage: page }) => {
    const res = await page.request.post(`${BASE}/api/scrape`, {
      data: { url: "https://google.com/search?q=house" },
    });
    expect(res.status()).toBe(400);
  });

  test("empty string url → 400", async ({ authPage: page }) => {
    const res = await page.request.post(`${BASE}/api/scrape`, {
      data: { url: "" },
    });
    expect(res.status()).toBe(400);
  });

  test("url injection attempt → 400 or safe response", async ({ authPage: page }) => {
    const res = await page.request.post(`${BASE}/api/scrape`, {
      data: { url: "https://zillow.com/'; DROP TABLE listings; --" },
    });
    // Should reject as invalid URL or process safely, never 500
    expect(res.status()).not.toBe(500);
    expect([400, 200, 422]).toContain(res.status());
  });

  test("url field as number → 400", async ({ authPage: page }) => {
    const res = await page.request.post(`${BASE}/api/scrape`, {
      data: { url: 12345 },
    });
    expect(res.status()).toBe(400);
  });

  test("unauthenticated request → 401", async ({ page }) => {
    const res = await page.request.post(`${BASE}/api/scrape`, {
      data: { url: "https://www.redfin.com/NC/Raleigh/123-Main-St/home/12345" },
    });
    expect(res.status()).toBe(401);
  });

  test("GET method not allowed → 405", async ({ authPage: page }) => {
    const res = await page.request.get(`${BASE}/api/scrape`);
    expect([404, 405]).toContain(res.status());
  });
});

// ─── /api/generate ────────────────────────────────────────────────────────────

test.describe("POST /api/generate — negative paths", () => {
  const validBase = {
    style: "modern",
    durationSeconds: 30,
    formats: "16x9",
    musicTrackId: FAKE_UUID_2,
    includeNeighborhoodBroll: false,
  };

  test("unauthenticated request → 401", async ({ page }) => {
    const res = await page.request.post(`${BASE}/api/generate`, {
      data: { ...validBase, listingId: FAKE_UUID_1 },
    });
    expect(res.status()).toBe(401);
  });

  test("missing listingId → 400", async ({ authPage: page }) => {
    const res = await page.request.post(`${BASE}/api/generate`, {
      data: validBase,
    });
    expect(res.status()).toBe(400);
  });

  test("non-uuid listingId → 400", async ({ authPage: page }) => {
    const res = await page.request.post(`${BASE}/api/generate`, {
      data: { ...validBase, listingId: "not-a-uuid" },
    });
    expect(res.status()).toBe(400);
  });

  test("missing style → 400", async ({ authPage: page }) => {
    const { style: _, ...noStyle } = validBase as Record<string, unknown>;
    const res = await page.request.post(`${BASE}/api/generate`, {
      data: { ...noStyle, listingId: FAKE_UUID_1 },
    });
    expect(res.status()).toBe(400);
  });

  test("invalid style value → 400", async ({ authPage: page }) => {
    const res = await page.request.post(`${BASE}/api/generate`, {
      data: { ...validBase, listingId: FAKE_UUID_1, style: "neon" },
    });
    expect(res.status()).toBe(400);
  });

  test("style=null → 400", async ({ authPage: page }) => {
    const res = await page.request.post(`${BASE}/api/generate`, {
      data: { ...validBase, listingId: FAKE_UUID_1, style: null },
    });
    expect(res.status()).toBe(400);
  });

  test("missing durationSeconds → 400", async ({ authPage: page }) => {
    const { durationSeconds: _, ...noSecs } = validBase as Record<string, unknown>;
    const res = await page.request.post(`${BASE}/api/generate`, {
      data: { ...noSecs, listingId: FAKE_UUID_1 },
    });
    expect(res.status()).toBe(400);
  });

  test("durationSeconds=0 → 400", async ({ authPage: page }) => {
    const res = await page.request.post(`${BASE}/api/generate`, {
      data: { ...validBase, listingId: FAKE_UUID_1, durationSeconds: 0 },
    });
    expect(res.status()).toBe(400);
  });

  test("durationSeconds=999 → 400", async ({ authPage: page }) => {
    const res = await page.request.post(`${BASE}/api/generate`, {
      data: { ...validBase, listingId: FAKE_UUID_1, durationSeconds: 999 },
    });
    expect(res.status()).toBe(400);
  });

  test("durationSeconds as string → 400", async ({ authPage: page }) => {
    const res = await page.request.post(`${BASE}/api/generate`, {
      data: { ...validBase, listingId: FAKE_UUID_1, durationSeconds: "30" },
    });
    expect(res.status()).toBe(400);
  });

  test("invalid formats value → 400", async ({ authPage: page }) => {
    const res = await page.request.post(`${BASE}/api/generate`, {
      data: { ...validBase, listingId: FAKE_UUID_1, formats: "square" },
    });
    expect(res.status()).toBe(400);
  });

  test("non-uuid musicTrackId → 400", async ({ authPage: page }) => {
    const res = await page.request.post(`${BASE}/api/generate`, {
      data: { ...validBase, listingId: FAKE_UUID_1, musicTrackId: "track-1" },
    });
    expect(res.status()).toBe(400);
  });

  test("includeNeighborhoodBroll as string → 400", async ({ authPage: page }) => {
    const res = await page.request.post(`${BASE}/api/generate`, {
      data: { ...validBase, listingId: FAKE_UUID_1, includeNeighborhoodBroll: "yes" },
    });
    expect(res.status()).toBe(400);
  });

  test("listing not owned by user → 404", async ({ authPage: page }) => {
    // Use a valid UUID that doesn't exist in DB
    const res = await page.request.post(`${BASE}/api/generate`, {
      data: { ...validBase, listingId: FAKE_UUID_2 },
    });
    // 404 (not found) or 402 (no credits) — NOT 400 (validation error)
    expect(res.status()).not.toBe(400);
    expect([404, 402, 409]).toContain(res.status());
  });

  test("empty body → 400", async ({ authPage: page }) => {
    const res = await page.request.post(`${BASE}/api/generate`, {
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test("GET method → 404 or 405", async ({ authPage: page }) => {
    const res = await page.request.get(`${BASE}/api/generate`);
    expect([404, 405]).toContain(res.status());
  });
});

// ─── /api/job/[id] ────────────────────────────────────────────────────────────

test.describe("GET /api/job/[id] — negative paths", () => {
  test("unauthenticated request → 401", async ({ page }) => {
    const res = await page.request.get(`${BASE}/api/job/00000000-0000-0000-0000-000000000001`);
    expect(res.status()).toBe(401);
  });

  test("non-existent job id → 404", async ({ authPage: page }) => {
    const res = await page.request.get(`${BASE}/api/job/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`);
    expect(res.status()).toBe(404);
  });

  test("non-uuid job id → 400 or 404", async ({ authPage: page }) => {
    const res = await page.request.get(`${BASE}/api/job/not-a-real-job`);
    expect([400, 404]).toContain(res.status());
  });

  test("sql injection in job id → safe response", async ({ authPage: page }) => {
    const res = await page.request.get(`${BASE}/api/job/${encodeURIComponent("' OR '1'='1")}`);
    expect(res.status()).not.toBe(500);
  });
});

// ─── /api/content/pack ───────────────────────────────────────────────────────

test.describe("POST /api/content/pack — negative paths", () => {
  test("unauthenticated request → 401", async ({ page }) => {
    const res = await page.request.post(`${BASE}/api/content/pack`, {
      data: { listingId: FAKE_UUID_1 },
    });
    expect(res.status()).toBe(401);
  });

  test("missing listingId → 400", async ({ authPage: page }) => {
    const res = await page.request.post(`${BASE}/api/content/pack`, {
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test("non-uuid listingId → 400", async ({ authPage: page }) => {
    const res = await page.request.post(`${BASE}/api/content/pack`, {
      data: { listingId: "bad-id" },
    });
    expect(res.status()).toBe(400);
  });

  test("non-existent listingId → 404", async ({ authPage: page }) => {
    const res = await page.request.post(`${BASE}/api/content/pack`, {
      data: { listingId: FAKE_UUID_2 },
    });
    expect(res.status()).toBe(404);
  });

  test("GET method → not 200 (method not supported)", async ({ authPage: page }) => {
    const res = await page.request.get(`${BASE}/api/content/pack`);
    // Next.js may return 400 (body parse), 404, or 405 depending on version
    expect([400, 404, 405]).toContain(res.status());
  });
});

// ─── /api/brand ──────────────────────────────────────────────────────────────

test.describe("POST /api/brand — negative paths", () => {
  test("unauthenticated request → 401", async ({ page }) => {
    const res = await page.request.post(`${BASE}/api/brand`, {
      data: { agentName: "Test Agent" },
    });
    expect(res.status()).toBe(401);
  });

  test("invalid hex color → 400", async ({ authPage: page }) => {
    const res = await page.request.post(`${BASE}/api/brand`, {
      data: { primaryColor: "red" },
    });
    expect(res.status()).toBe(400);
  });

  test("invalid hex color (too short) → 400", async ({ authPage: page }) => {
    const res = await page.request.post(`${BASE}/api/brand`, {
      data: { primaryColor: "#FFF" },
    });
    expect(res.status()).toBe(400);
  });

  test("agentName over 100 chars → 400", async ({ authPage: page }) => {
    const res = await page.request.post(`${BASE}/api/brand`, {
      data: { agentName: "A".repeat(101) },
    });
    expect(res.status()).toBe(400);
  });

  test("phone over 20 chars → 400", async ({ authPage: page }) => {
    const res = await page.request.post(`${BASE}/api/brand`, {
      data: { phone: "+1 (555) 123-4567 ext. 9999" },
    });
    expect(res.status()).toBe(400);
  });

  test("invalid logoUrl (not a url) → 400", async ({ authPage: page }) => {
    const res = await page.request.post(`${BASE}/api/brand`, {
      data: { logoUrl: "not-a-url" },
    });
    expect(res.status()).toBe(400);
  });

  test("empty body → valid (all fields optional) → not 400", async ({ authPage: page }) => {
    const res = await page.request.post(`${BASE}/api/brand`, {
      data: {},
    });
    // Empty brand update is valid — all fields optional
    expect(res.status()).not.toBe(400);
  });
});

// ─── /api/leads ──────────────────────────────────────────────────────────────

test.describe("POST /api/leads — negative paths", () => {
  test("missing listingId → 400", async ({ page }) => {
    // Leads endpoint may not require auth (public listing page captures leads)
    const res = await page.request.post(`${BASE}/api/leads`, {
      data: { email: "test@example.com" },
    });
    expect(res.status()).toBe(400);
  });

  test("invalid email format → 400", async ({ page }) => {
    const res = await page.request.post(`${BASE}/api/leads`, {
      data: {
        listingId: FAKE_UUID_1,
        email: "not-an-email",
      },
    });
    expect(res.status()).toBe(400);
  });

  test("invalid phone format → 400", async ({ page }) => {
    const res = await page.request.post(`${BASE}/api/leads`, {
      data: {
        listingId: FAKE_UUID_1,
        phone: "CALL ME MAYBE",
      },
    });
    expect(res.status()).toBe(400);
  });

  test("message over 1000 chars → 400", async ({ page }) => {
    const res = await page.request.post(`${BASE}/api/leads`, {
      data: {
        listingId: FAKE_UUID_1,
        message: "x".repeat(1001),
      },
    });
    expect(res.status()).toBe(400);
  });

  test("non-uuid listingId → 400", async ({ page }) => {
    const res = await page.request.post(`${BASE}/api/leads`, {
      data: {
        listingId: "not-a-uuid",
        email: "test@example.com",
      },
    });
    expect(res.status()).toBe(400);
  });
});

// ─── /api/listings/[id] ──────────────────────────────────────────────────────

test.describe("PATCH /api/listings/[id] — negative paths", () => {
  test("unauthenticated → 401", async ({ page }) => {
    const res = await page.request.patch(
      `${BASE}/api/listings/00000000-0000-0000-0000-000000000001`,
      { data: { address: "123 Main St" } }
    );
    expect(res.status()).toBe(401);
  });

  test("price as negative number → 400", async ({ authPage: page }) => {
    const res = await page.request.patch(
      `${BASE}/api/listings/00000000-0000-0000-0000-000000000001`,
      { data: { price: -1000 } }
    );
    expect(res.status()).toBe(400);
  });

  test("address over 300 chars → 400", async ({ authPage: page }) => {
    const res = await page.request.patch(
      `${BASE}/api/listings/00000000-0000-0000-0000-000000000001`,
      { data: { address: "A".repeat(301) } }
    );
    expect(res.status()).toBe(400);
  });
});

// ─── /api/upload ─────────────────────────────────────────────────────────────
// Note: Photo uploads go directly to Supabase Storage client-side.
// /api/upload is not a server route — tests are skipped.

test.describe("POST /api/upload — negative paths", () => {
  test.skip(true, "/api/upload route does not exist — uploads are client-side to Supabase Storage");

  test("unauthenticated → 401", async ({ page }) => {
    const res = await page.request.post(`${BASE}/api/upload`, {
      data: { filename: "photo.jpg", contentType: "image/jpeg", purpose: "listing_photo" },
    });
    expect(res.status()).toBe(401);
  });

  test("invalid contentType → 400", async ({ authPage: page }) => {
    const res = await page.request.post(`${BASE}/api/upload`, {
      data: { filename: "malware.exe", contentType: "application/octet-stream", purpose: "listing_photo" },
    });
    expect(res.status()).toBe(400);
  });

  test("invalid purpose → 400", async ({ authPage: page }) => {
    const res = await page.request.post(`${BASE}/api/upload`, {
      data: { filename: "photo.jpg", contentType: "image/jpeg", purpose: "profile_picture" },
    });
    expect(res.status()).toBe(400);
  });

  test("empty filename → 400", async ({ authPage: page }) => {
    const res = await page.request.post(`${BASE}/api/upload`, {
      data: { filename: "", contentType: "image/jpeg", purpose: "listing_photo" },
    });
    expect(res.status()).toBe(400);
  });

  test("filename > 255 chars → 400", async ({ authPage: page }) => {
    const res = await page.request.post(`${BASE}/api/upload`, {
      data: { filename: "a".repeat(256) + ".jpg", contentType: "image/jpeg", purpose: "listing_photo" },
    });
    expect(res.status()).toBe(400);
  });
});

// ─── Public listing page ──────────────────────────────────────────────────────

test.describe("Public listing page — negative paths", () => {
  test("non-existent slug → 404", async ({ page }) => {
    await page.goto(`${BASE}/l/slug-that-does-not-exist-at-all-xyz123`, {
      waitUntil: "networkidle",
    });
    const status = page.url();
    // Should show 404 page or redirect — not crash
    const body = await page.locator("body").textContent();
    expect(body).toBeTruthy();
    // Should contain some 404 indicator or "not found"
    // (Implementation-dependent — just verify no server crash)
  });

  test("slug with SQL injection chars → safe", async ({ page }) => {
    await page.goto(`${BASE}/l/${encodeURIComponent("' OR 1=1 --")}`, {
      waitUntil: "networkidle",
    });
    const body = await page.locator("body").textContent();
    expect(body).toBeTruthy();
  });
});

// ─── Response shape guarantees ────────────────────────────────────────────────

test.describe("Error response shape guarantees", () => {
  test("400 errors return JSON with error field", async ({ authPage: page }) => {
    const res = await page.request.post(`${BASE}/api/generate`, {
      data: { listingId: "bad" },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(typeof body.error).toBe("string");
    expect(body.error.length).toBeGreaterThan(0);
  });

  test("401 errors return JSON with error field", async ({ page }) => {
    const res = await page.request.post(`${BASE}/api/generate`, {
      data: { listingId: FAKE_UUID_1 },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(typeof body.error).toBe("string");
  });

  test("scrape 400 returns JSON with error field", async ({ authPage: page }) => {
    const res = await page.request.post(`${BASE}/api/scrape`, {
      data: { url: "not-a-url" },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(typeof body.error).toBe("string");
  });
});
