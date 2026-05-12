import * as cheerio from "cheerio";
import { createAdminClient } from "@/lib/supabase/server";

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
];

const ALLOWED_DOMAINS = ["zillow.com", "redfin.com", "realtor.com"];

export function validateDomain(url: string): boolean {
  return ALLOWED_DOMAINS.some((domain) => url.includes(domain));
}

function randomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ScrapedData {
  address: string;
  city: string;
  state: string;
  zip: string;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  description: string;
  photoUrls: string[];
  warnings?: { photoIndex: number; warning: string }[];
}

// ─── Playwright — uses rebrowser-playwright to patch CDP Runtime.enable leak ──
// rebrowser-playwright patches the Runtime.enable CDP call that PerimeterX detects.
// Strategy: navigate to site root first (lets PerimeterX initialize), then listing.
async function playwrightFetch(
  urls: string[],  // [warmupUrl, targetUrl] — navigate in sequence
  waitMs = 3000    // pause after warmup for bot-protection JS to run
): Promise<string> {
  // Use rebrowser-playwright — patches CDP Runtime.enable leak that PerimeterX detects
  const { chromium } = await import("rebrowser-playwright");

  // Try system Chrome first, fall back to bundled Chromium
  const executablePaths = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
  ];

  let executablePath: string | undefined;
  for (const p of executablePaths) {
    try {
      const { existsSync } = await import("fs");
      if (existsSync(p)) { executablePath = p; break; }
    } catch {}
  }

  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
    ],
  });

  try {
    const context = await browser.newContext({
      userAgent: randomUserAgent(),
      viewport: { width: 1366, height: 768 },
      locale: "en-US",
      timezoneId: "America/New_York",
    });

    // Patch automation signals
    await context.addInitScript(() => {
      delete (Object.getPrototypeOf(navigator) as Record<string, unknown>).webdriver;
      (window as unknown as Record<string, unknown>).chrome = { runtime: {} };
      Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3] });
      Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
    });

    const page = await context.newPage();

    for (let i = 0; i < urls.length; i++) {
      await page.goto(urls[i], { waitUntil: "domcontentloaded", timeout: 45000 });
      if (i < urls.length - 1) await sleep(waitMs);
    }

    const html = await page.content();
    return html;
  } finally {
    await browser.close();
  }
}

// ─── got-scraping — HTTP/2 + Chrome TLS fingerprint via header-generator ─────
async function gotFetch(url: string, referer?: string): Promise<string> {
  const { gotScraping } = await import("got-scraping");
  const res = await gotScraping({
    url,
    headerGeneratorOptions: {
      browsers: [{ name: "chrome", minVersion: 120 }],
      devices: ["desktop"],
      operatingSystems: ["macos"],
    },
    headers: referer ? { Referer: referer } : {},
    timeout: { request: 30000 },
  });
  return res.body;
}

// ─── Zillow ───────────────────────────────────────────────────────────────────

function extractZillowPhotosFromHtml(html: string): string[] {
  // Photos: photos.zillowstatic.com/fp/{hash}-cc_ft_{size}.jpg
  // Multiple sizes per photo — pick the highest-res jpg per unique hash.
  const seen = new Map<string, { size: number; url: string }>();
  const re = /https?:\/\/photos\.zillowstatic\.com\/fp\/([a-zA-Z0-9_-]+)-cc_ft_(\d+)\.jpg/g;
  let match;
  while ((match = re.exec(html)) !== null) {
    const [url, hash, sizeStr] = match;
    const size = parseInt(sizeStr, 10);
    const best = seen.get(hash);
    if (!best || size > best.size) seen.set(hash, { size, url });
  }
  return [...seen.values()].map((v) => v.url);
}

function parseZillowHtml($: cheerio.CheerioAPI, html: string): ScrapedData {
  let nextData: Record<string, unknown> = {};
  const nextMatch =
    html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>({.+?})<\/script>/s) ||
    html.match(/__NEXT_DATA__\s*=\s*({.+?})\s*<\/script>/s);
  if (nextMatch) {
    try { nextData = JSON.parse(nextMatch[1]); } catch {}
  }

  // JSON-LD
  let jsonLd: Record<string, unknown> = {};
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const d = JSON.parse($(el).html() || "{}");
      if (d["@type"] === "SingleFamilyResidence" || d["@type"] === "RealEstateListing") {
        jsonLd = d;
      }
    } catch {}
  });

  const addr = (jsonLd.address as Record<string, string>) || {};
  const pp = ((nextData.props as Record<string, unknown>)?.pageProps as Record<string, unknown>) || {};
  const compProps = (pp.componentProps as Record<string, unknown>) || {};

  const address = addr.streetAddress || String(compProps.streetAddress || "");
  const city = addr.addressLocality || String(compProps.city || "");
  const state = addr.addressRegion || String(compProps.state || "");
  const zip = addr.postalCode || String(compProps.zipcode || "");

  const priceText =
    $('[data-testid="price"]').text() ||
    String((compProps as Record<string, unknown>).price || "");
  const price = parsePrice(priceText);

  const beds = parseNumber(
    $('[data-testid="bed-bath-beyond"] [data-testid="bed"]').text() ||
    String((compProps as Record<string, unknown>).bedrooms || "")
  );
  const baths = parseNumber(
    $('[data-testid="bed-bath-beyond"] [data-testid="bath"]').text() ||
    String((compProps as Record<string, unknown>).bathrooms || "")
  );
  const sqft = parseNumber(
    $('[data-testid="home-summary-size"]').text() ||
    String((compProps as Record<string, unknown>).livingArea || "")
  );
  const description =
    $('[data-testid="listing-description-text"]').text().trim() ||
    String((compProps as Record<string, unknown>).description || "");

  const photoUrls = extractZillowPhotosFromHtml(html);

  return { address, city, state, zip, price, beds, baths, sqft, description, photoUrls };
}

async function scrapeZillowViaScraperApi(url: string): Promise<string> {
  const key = process.env.SCRAPER_API_KEY;
  if (!key) throw new Error("No SCRAPER_API_KEY");
  const apiUrl = `http://api.scraperapi.com?api_key=${key}&url=${encodeURIComponent(url)}&render=true&premium=true`;
  const res = await fetch(apiUrl, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`ScraperAPI ${res.status}`);
  return res.text();
}

// ─── Layer 1: Zillow GraphQL API (no browser needed — uses internal API) ──────
async function scrapeZillowGraphQL(url: string): Promise<ScrapedData> {
  const zpidMatch = url.match(/\/(\d+)_zpid/);
  if (!zpidMatch) throw new Error("No ZPID found in URL");
  const zpid = zpidMatch[1];

  const { gotScraping } = await import("got-scraping");
  const res = await gotScraping.post("https://www.zillow.com/graphql/", {
    headerGeneratorOptions: {
      browsers: [{ name: "chrome", minVersion: 124 }],
      devices: ["desktop"],
      operatingSystems: ["macos"],
    },
    headers: {
      "content-type": "application/json",
      "accept": "*/*",
      "accept-language": "en-US,en;q=0.9",
      "origin": "https://www.zillow.com",
      "referer": `https://www.zillow.com/homedetails/${zpid}_zpid/`,
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "x-client": "web",
    },
    body: JSON.stringify({
      query: `query GetHomeDetails($zpid: ID!) {
        property(zpid: $zpid) {
          address { streetAddress city state zipcode }
          price bedrooms bathrooms livingArea yearBuilt homeType
          description
          photos { url mixedSources { jpeg { url width } } }
          originalPhotos { url }
          responsivePhotos { url mixedSources { jpeg { url width } } }
        }
      }`,
      variables: { zpid: zpid.toString() },
    }),
    timeout: { request: 15000 },
  });

  let gqlData: Record<string, unknown>;
  try { gqlData = JSON.parse(res.body); } catch { throw new Error("GraphQL: invalid JSON response"); }

  const property = (gqlData?.data as Record<string, unknown>)?.property as Record<string, unknown> | undefined;
  if (!property) throw new Error("GraphQL: no property data returned");

  const rawPhotos = (property.photos || property.responsivePhotos) as Array<Record<string, unknown>> | undefined;
  const photoUrls: string[] = (rawPhotos || [])
    .map((p) => {
      const sources = ((p.mixedSources as Record<string, unknown>)?.jpeg as Array<{ url: string; width: number }>) || [];
      return sources.sort((a, b) => b.width - a.width)[0]?.url;
    })
    .filter((u): u is string => Boolean(u));

  const street = String(property.streetAddress || "");
  const city = String(property.city || "");
  const state = String(property.state || "");
  const zip = String(property.zipcode || "");

  console.log(`[scraper] Zillow GraphQL: ${photoUrls.length} photos for ${street}`);

  return {
    address: street,
    city, state, zip,
    price: typeof property.price === "number" ? property.price : null,
    beds: typeof property.bedrooms === "number" ? property.bedrooms : null,
    baths: typeof property.bathrooms === "number" ? property.bathrooms : null,
    sqft: typeof property.livingArea === "number" ? property.livingArea : null,
    description: String(property.description || ""),
    photoUrls,
    warnings: [],
  };
}

// ─── Layer 3: Google Cache fallback (static HTML, no JS challenges) ───────────
async function scrapeZillowCache(url: string): Promise<ScrapedData> {
  const cacheUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(url)}`;
  const html = await playwrightFetch([cacheUrl], 1000);
  if (!html || html.length < 5000) throw new Error("Cache: empty response");

  const $ = cheerio.load(html);
  const data = parseZillowHtml($, html);

  // Cache pages often have photos in regular img tags too
  if (!data.photoUrls.length) {
    const cachePhotos: string[] = [];
    $('img[src*="photos.zillowstatic.com"]').each((_, el) => {
      const src = $(el).attr("src");
      if (src) cachePhotos.push(src);
    });
    data.photoUrls = cachePhotos;
  }

  if (!data.address && !data.photoUrls.length) throw new Error("Cache: no usable data");
  console.log(`[scraper] Zillow cache: ${data.photoUrls.length} photos`);
  return data;
}

async function scrapeZillow(url: string): Promise<ScrapedData> {
  // Layer 1: GraphQL API (fastest, no browser — Zillow's own internal API)
  try {
    return await scrapeZillowGraphQL(url);
  } catch (e) {
    console.warn("[scraper] Zillow GraphQL failed:", (e as Error).message);
  }

  // Layer 2: ScraperAPI (residential proxy) — only if key is configured
  const scraperKey = process.env.SCRAPER_API_KEY;
  if (scraperKey) {
    try {
      const html = await scrapeZillowViaScraperApi(url);
      if (html.length > 10000 && !html.includes("Access to this page has been denied")) {
        const $ = cheerio.load(html);
        const data = parseZillowHtml($, html);
        if (!data.address) Object.assign(data, parseZillowUrl(url));
        console.log(`[scraper] Zillow ScraperAPI: ${data.photoUrls.length} photos`);
        return data;
      }
    } catch (e) {
      console.warn("[scraper] Zillow ScraperAPI failed:", (e as Error).message);
    }
  }

  // Layer 3: rebrowser-playwright with homepage warmup (patches CDP Runtime.enable leak)
  try {
    const html = await playwrightFetch(["https://www.zillow.com/", url], 3000);
    if (html.length > 10000 && !html.includes("Access to this page has been denied")) {
      const $ = cheerio.load(html);
      const data = parseZillowHtml($, html);
      if (!data.address) Object.assign(data, parseZillowUrl(url));
      console.log(`[scraper] Zillow rebrowser: ${data.photoUrls.length} photos`);
      return data;
    }
    throw new Error("rebrowser: blocked or insufficient content");
  } catch (e) {
    console.warn("[scraper] Zillow rebrowser failed:", (e as Error).message);
  }

  // Layer 4: Google Cache (static snapshot, no JS challenge)
  try {
    const data = await scrapeZillowCache(url);
    if (!data.address) Object.assign(data, parseZillowUrl(url));
    return data;
  } catch (e) {
    console.warn("[scraper] Zillow cache failed:", (e as Error).message);
  }

  // All layers failed — return what we can parse from URL with clear warning
  const fromUrl = parseZillowUrl(url);
  if (fromUrl.address) {
    return {
      address: fromUrl.address || "",
      city: fromUrl.city || "",
      state: fromUrl.state || "",
      zip: fromUrl.zip || "",
      price: null, beds: null, baths: null, sqft: null,
      description: "",
      photoUrls: [],
      warnings: [{ photoIndex: -1, warning: "Zillow blocked automated access. Photos must be uploaded manually." }],
    };
  }
  throw new Error("Zillow blocked this request. Try a Redfin URL instead, or upload photos manually.");
}

// ─── Redfin ───────────────────────────────────────────────────────────────────

function extractRedfinPhotos(html: string): string[] {
  const photoSet = new Set<string>();

  // Unescape JSON-encoded forward slashes so regex can match both forms
  const src = html.replace(/\\\//g, "/");

  // Capture ALL cdn-redfin photo URL variants (bigphoto, isphoto, thumbphoto, etc.)
  const re = /https?:\/\/ssl\.cdn-redfin\.com\/photo\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)/gi;
  let m;
  while ((m = re.exec(src)) !== null) {
    photoSet.add(m[0].split("?")[0]);
  }

  const allUrls = [...photoSet];
  // Prefer highest-quality variants in order: bigphoto > isphoto > others (excluding thumbs)
  const bigPhotos = allUrls.filter(u => u.includes("/bigphoto/"));
  if (bigPhotos.length > 0) return bigPhotos;
  const isPhotos = allUrls.filter(u => u.includes("/isphoto/"));
  if (isPhotos.length > 0) return isPhotos;
  return allUrls.filter(u => !u.includes("thumb"));
}

function parseRedfinHtml(html: string): Omit<ScrapedData, "warnings"> {
  const $ = cheerio.load(html);

  const streetLine =
    $('[data-rf-test-id="abp-streetLine"]').text().trim() ||
    $(".street-address").text().trim() || "";

  let city = "", state = "", zip = "";
  const csz = $('[data-rf-test-id="abp-cityStateZip"]').text().trim();
  if (csz) {
    const cszMatch = csz.match(/^(.+?),\s*([A-Z]{2})\s+(\d{5})?/);
    if (cszMatch) { city = cszMatch[1]; state = cszMatch[2]; zip = cszMatch[3] || ""; }
  }
  if (!city) {
    const title = $("title").text();
    const titleMatch = title.match(/,\s*([^,]+),\s*([A-Z]{2})\s+(\d{5})/);
    if (titleMatch) { city = titleMatch[1].trim(); state = titleMatch[2]; zip = titleMatch[3]; }
  }

  const hasFullAddress = streetLine.includes(",") && /[A-Z]{2}\s+\d{5}/.test(streetLine);
  const address = hasFullAddress
    ? streetLine
    : streetLine
      ? `${streetLine}${city ? `, ${city}, ${state} ${zip}`.trim() : ""}`
      : "";

  const priceText =
    $('[data-rf-test-id="abp-price"] .statsValue').text() ||
    $('[data-rf-test-id="abp-price"]').text() ||
    $(".price .value").text() || "";
  const price = parsePrice(priceText);

  const beds = parseNumber(
    $('[data-rf-test-id="abp-beds"] .statsValue').text() ||
    $('[data-rf-test-id="abp-beds"]').text() || ""
  );
  const baths = parseNumber(
    $('[data-rf-test-id="abp-baths"] .statsValue').text() ||
    $('[data-rf-test-id="abp-baths"]').text() || ""
  );
  const sqft = parseNumber(
    $('[data-rf-test-id="abp-sqFt"] .statsValue').text() ||
    $('[data-rf-test-id="abp-sqFt"]').text() || ""
  );
  const description =
    $(".remarks").text().trim() ||
    $(".listing-remarks").text().trim() || "";

  const photoUrls = extractRedfinPhotos(html);
  return { address, city, state, zip, price, beds, baths, sqft, description, photoUrls };
}

async function scrapeRedfin(url: string): Promise<ScrapedData> {
  // Layer 1: got-scraping (fast, no browser — Chrome TLS fingerprint)
  try {
    const html = await gotFetch(url, "https://www.redfin.com/");
    const data = parseRedfinHtml(html);
    if (data.photoUrls.length > 0 || data.address) {
      console.log(`[scraper] Redfin got-scraping: ${data.photoUrls.length} photos, address="${data.address}"`);
      return data;
    }
    throw new Error("got-scraping returned no photos and no address");
  } catch (e) {
    console.warn("[scraper] Redfin got-scraping failed:", (e as Error).message);
  }

  // Layer 2: Playwright fallback with homepage warmup
  console.log("[scraper] Redfin falling back to Playwright...");
  const html = await playwrightFetch(["https://www.redfin.com/", url], 2000);
  const data = parseRedfinHtml(html);
  console.log(`[scraper] Redfin Playwright: ${data.photoUrls.length} photos, address="${data.address}"`);
  return data;
}

// ─── Realtor.com ──────────────────────────────────────────────────────────────

async function scrapeRealtor(url: string): Promise<ScrapedData> {
  // Use Playwright — Realtor.com rate-limits got-scraping and curl
  const html = await playwrightFetch(
    ["https://www.realtor.com/", url],
    2000
  );

  const $ = cheerio.load(html);

  let ld: Record<string, unknown> = {};
  const m = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>({.+?})<\/script>/s);
  if (m) {
    try {
      const nd = JSON.parse(m[1]);
      const pp = (nd?.props as Record<string, unknown>)?.pageProps as Record<string, unknown>;
      ld = ((pp?.data as Record<string, unknown>)?.home as Record<string, unknown>) || {};
    } catch {}
  }

  const location = (ld.location as Record<string, unknown>) || {};
  const addrBlock = (location.address as Record<string, string>) || {};
  const address = $('[data-testid="street-address"]').text().trim() || addrBlock.line || "";
  const city = $('[data-testid="city"]').text().trim() || addrBlock.city || "";
  const state = $('[data-testid="state"]').text().trim() || addrBlock.state_code || "";
  const zip = $('[data-testid="postal-code"]').text().trim() || addrBlock.postal_code || "";

  const listPrice = (ld.list_price as number) || 0;
  const priceText =
    $('[data-testid="list-price"]').text() ||
    $(".price-section").text() ||
    String(listPrice);
  const price = parsePrice(priceText) || (listPrice > 0 ? listPrice : null);

  const details = (ld.description as Record<string, unknown>) || {};
  const beds =
    parseNumber(String(details.beds || "")) ??
    parseNumber($('[data-testid="beds"]').text());
  const baths =
    parseNumber(String(details.baths_consolidated || details.baths || "")) ??
    parseNumber($('[data-testid="baths"]').text());
  const sqft =
    parseNumber(String(details.sqft || "")) ??
    parseNumber($('[data-testid="sqft"]').text());
  const description =
    $('[data-testid="listing-description"]').text().trim() ||
    (ld.description as Record<string, string>)?.text || "";

  // Photos: rdcpix.com URLs from nextData recursion + HTML
  const photoSet = new Set<string>();
  function findRealtorPhotos(obj: unknown) {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) { obj.forEach(findRealtorPhotos); return; }
    const rec = obj as Record<string, unknown>;
    if (typeof rec.href === "string" && rec.href.includes("rdcpix.com")) {
      photoSet.add(rec.href.replace(/[?&](w|h|width|height)=\d+/g, ""));
    }
    Object.values(rec).forEach(findRealtorPhotos);
  }
  if (m) {
    try { findRealtorPhotos(JSON.parse(m[1])); } catch {}
  }
  $('img[src*="rdcpix.com"]').each((_, el) => {
    const src = $(el).attr("src");
    if (src) photoSet.add(src);
  });

  return { address, city, state, zip, price, beds, baths, sqft, description, photoUrls: [...photoSet] };
}

// ─── Street suffix set ────────────────────────────────────────────────────────

const STREET_SUFFIXES = new Set([
  "ln", "dr", "st", "ave", "rd", "blvd", "ct", "way", "pl", "cir", "circle",
  "ter", "trl", "trail", "pkwy", "hwy", "loop", "pass", "row", "sq", "run",
  "path", "pike", "xing", "aly", "bnd", "brg", "brk", "cv", "fwy", "lk",
  "mdws", "ms", "pt", "smt", "spg", "vly", "vis", "walk",
]);

function parseZillowUrl(url: string): Partial<ScrapedData> {
  const match = url.match(/\/homedetails\/([^/]+)\//);
  if (!match) return {};
  const slug = match[1];
  const parts = slug.split("-");
  const zip = /^\d{5}$/.test(parts[parts.length - 1]) ? parts.pop()! : "";
  const state = /^[A-Z]{2}$/.test(parts[parts.length - 1]) ? parts.pop()! : "";
  const cityParts: string[] = [];
  while (parts.length > 0) {
    const last = parts[parts.length - 1];
    if (/^\d/.test(last)) break;
    if (STREET_SUFFIXES.has(last.toLowerCase())) break;
    cityParts.unshift(parts.pop()!);
  }
  return { address: parts.join(" "), city: cityParts.join(" "), state, zip };
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function scrapeUrl(url: string): Promise<ScrapedData> {
  if (url.includes("zillow.com")) {
    try {
      return await scrapeZillow(url);
    } catch (err) {
      console.warn("[scraper] Zillow blocked:", err);
      const fromUrl = parseZillowUrl(url);
      if (fromUrl.address) {
        return {
          address: fromUrl.address || "",
          city: fromUrl.city || "",
          state: fromUrl.state || "",
          zip: fromUrl.zip || "",
          price: null, beds: null, baths: null, sqft: null,
          description: "",
          photoUrls: [],
          warnings: [{ photoIndex: -1, warning: "Zillow blocked automated access. Photos must be uploaded manually." }],
        };
      }
      throw new Error(
        "Zillow blocked this request. Try a Redfin URL instead, or upload photos manually."
      );
    }
  }

  if (url.includes("redfin.com")) {
    return await scrapeRedfin(url);
  }

  if (url.includes("realtor.com")) {
    try {
      return await scrapeRealtor(url);
    } catch (err) {
      console.warn("[scraper] Realtor.com scrape failed:", err);
      return {
        address: "", city: "", state: "", zip: "",
        price: null, beds: null, baths: null, sqft: null,
        description: "", photoUrls: [],
      };
    }
  }

  throw new Error("Unsupported domain");
}

// ─── Photo storage ────────────────────────────────────────────────────────────

// Detect floor plans / site maps: mostly grayscale, high white ratio
async function isFloorPlanImage(buffer: Buffer): Promise<boolean> {
  try {
    const sharp = (await import("sharp")).default;
    const { data, info } = await sharp(buffer)
      .resize(120, 80, { fit: "fill" })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const pixels = info.width * info.height;
    let whiteCount = 0;
    let colorVariance = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r > 230 && g > 230 && b > 230) whiteCount++;
      colorVariance += Math.abs(r - g) + Math.abs(g - b);
    }
    const whiteRatio = whiteCount / pixels;
    const avgColorVariance = colorVariance / pixels;
    // Floor plans: >60% white pixels AND very low color variance (gray/black lines only)
    return whiteRatio > 0.60 && avgColorVariance < 12;
  } catch { return false; }
}

export async function downloadAndStorePhotos(
  photoUrls: string[],
  userId: string,
  listingId: string
): Promise<{ photos: { url: string; order: number; is_cover: boolean }[]; warnings: { photoIndex: number; warning: string }[] }> {
  const supabase = createAdminClient();
  const photos: { url: string; order: number; is_cover: boolean }[] = [];
  const warnings: { photoIndex: number; warning: string }[] = [];
  const limited = photoUrls.slice(0, 40);
  let order = 0;

  for (let i = 0; i < limited.length; i++) {
    try {
      const res = await fetch(limited[i], {
        headers: { "User-Agent": randomUserAgent() },
      });
      if (!res.ok) continue;

      const buffer = Buffer.from(await res.arrayBuffer());

      // Detect floor plans — include but flag with a warning
      if (await isFloorPlanImage(buffer)) {
        console.log(`[scraper] Floor plan detected at index ${i}: ${limited[i].substring(0, 60)}`);
        warnings.push({ photoIndex: order, warning: "Floor plan detected — review before including" });
      }

      const path = `listings/${userId}/${listingId}/photos/${order}.jpg`;

      const { error } = await supabase.storage
        .from("listing-photos")
        .upload(path, buffer, { contentType: "image/jpeg", upsert: true });

      if (error) continue;

      const { data: { publicUrl } } = supabase.storage
        .from("listing-photos")
        .getPublicUrl(path);

      photos.push({ url: publicUrl, order, is_cover: order === 0 });
      order++;
    } catch {
      // skip failed photos
    }
  }

  return { photos, warnings };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parsePrice(text: string): number | null {
  const cleaned = text.replace(/[^0-9]/g, "");
  const num = parseInt(cleaned, 10);
  return isNaN(num) || num === 0 ? null : num;
}

function parseNumber(text: string): number | null {
  if (!text) return null;
  // Strip commas (e.g. "1,724" → "1724") then extract first number
  const cleaned = text.replace(/,/g, "");
  const match = cleaned.match(/[\d.]+/);
  if (!match) return null;
  const num = parseFloat(match[0]);
  return isNaN(num) ? null : num;
}

export function generateSlug(address: string, city: string): string {
  const base = `${address} ${city}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
  const suffix = Math.random().toString(36).substring(2, 7);
  return `${base}-${suffix}`;
}
