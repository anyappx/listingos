#!/usr/bin/env python3
"""
Scrapes a single Realtor.com listing using HomeHarvest.
Called from lib/scraper.ts via child_process.execSync.
Outputs a single JSON line to stdout; progress logs go to stderr.
"""
import sys
import json
import re
import ssl
import urllib.request

# macOS Python 3.10 (python.org installer) ships without system CA certs.
# Use an unverified context for scraping public read-only pages only —
# no credentials or sensitive data are ever sent via this context.
_SSL_CTX = ssl._create_unverified_context()

def normalize_photo_url(url: str) -> str:
    # Strip query string
    url = url.split("?")[0]
    # Classic format: hash-fNUMBERs.jpg / -t.jpg / -l.jpg / -e.jpg → -o.jpg
    url = re.sub(r"-[stle]\.(jpe?g|webp|png)", "-o.jpg", url)
    # New HomeHarvest format: hash-fNUMBERod-w480_h360_x2.webp → hash-fNUMBERo.jpg
    url = re.sub(r"od-w\d+_h\d+_x\d+\.(webp|jpe?g|png)", "o.jpg", url)
    # Normalise subdomain: nh.rdcpix.com → ap.rdcpix.com (full-res CDN node)
    url = url.replace("//nh.rdcpix.com/", "//ap.rdcpix.com/")
    return url

def scrape_listing(url: str):
    from homeharvest import scrape_property

    # Parse address from URL slug
    # Format: /realestateandhomes-detail/123-Main-St_City_ST_12345_M12345-67890
    parts = url.split("/realestateandhomes-detail/")
    if len(parts) < 2:
        print(json.dumps({"error": f"Unrecognized Realtor.com URL format: {url}"}))
        sys.exit(1)

    slug = parts[-1].split("_M")[0]  # strip MLS ID suffix
    tokens = slug.split("_")
    # tokens: ["123-Main-St", "City", "ST", "12345"]
    if len(tokens) >= 3:
        street = tokens[0].replace("-", " ")
        city_part = tokens[1].replace("-", " ")
        state_part = tokens[2]
        zip_part = tokens[3] if len(tokens) >= 4 and tokens[3].isdigit() else ""
        address = f"{street}, {city_part}, {state_part}"
        if zip_part:
            address += f" {zip_part}"
    else:
        address = slug.replace("_", ", ").replace("-", " ")

    print(f"[scrape-realtor] Searching HomeHarvest for: {address}", file=sys.stderr)

    properties = None
    try:
        properties = scrape_property(location=address, listing_type="for_sale")
    except Exception as e:
        print(f"[scrape-realtor] for_sale failed ({e}), retrying without listing_type", file=sys.stderr)
        try:
            properties = scrape_property(location=address)
        except Exception as e2:
            print(json.dumps({"error": f"HomeHarvest failed: {str(e2)}"}))
            sys.exit(1)

    if properties is None or len(properties) == 0:
        print(json.dumps({"error": f"No listing found for address: {address}"}))
        sys.exit(1)

    prop = properties.iloc[0]

    photo_urls = []

    def safe_str(val) -> str:
        """Convert a pandas / numpy scalar to str, returning '' for NA/None/nan."""
        if val is None:
            return ""
        try:
            if str(val) in ("nan", "None", "<NA>", "NaT"):
                return ""
        except Exception:
            return ""
        return str(val)

    # Primary photo from API
    primary = safe_str(prop.get("primary_photo")) or safe_str(prop.get("img_src"))
    if "rdcpix" in primary:
        photo_urls.append(normalize_photo_url(primary))

    # Alt photos from API (comma-separated string or list)
    alt_photos_raw = prop.get("alt_photos")
    alt_photos = safe_str(alt_photos_raw) if not isinstance(alt_photos_raw, list) else alt_photos_raw
    if isinstance(alt_photos, str):
        for u in alt_photos.split(","):
            u = u.strip()
            if u and "rdcpix" in u:
                normed = normalize_photo_url(u)
                if normed not in photo_urls:
                    photo_urls.append(normed)
    elif isinstance(alt_photos, list):
        for u in alt_photos:
            if isinstance(u, str) and "rdcpix" in u:
                normed = normalize_photo_url(u)
                if normed not in photo_urls:
                    photo_urls.append(normed)

    # Always try the detail page for the full gallery — HomeHarvest's search API
    # is hard-limited to 2-3 photos; the listing page __NEXT_DATA__ has all of them.
    listing_url = prop.get("property_url") or ""
    if listing_url:
        print(f"[scrape-realtor] Upgrading photos via page scrape (have {len(photo_urls)} so far)", file=sys.stderr)
        import time; time.sleep(2)  # avoid 429 after HomeHarvest's API calls
        try:
            req = urllib.request.Request(listing_url, headers={
                # Googlebot UA bypasses Akamai rate-limiting that blocks browser UAs
                "User-Agent": "Googlebot/2.1 (+http://www.google.com/bot.html)",
                "Accept": "text/html",
            })
            resp = urllib.request.urlopen(req, timeout=15, context=_SSL_CTX)

            raw = resp.read()
            # urllib doesn't auto-decompress; handle gzip/br if needed
            content_encoding = resp.headers.get("Content-Encoding", "")
            if "gzip" in content_encoding:
                import gzip
                raw = gzip.decompress(raw)
            elif "br" in content_encoding:
                try:
                    import brotli
                    raw = brotli.decompress(raw)
                except ImportError:
                    pass  # brotli not installed; decode as-is
            html = raw.decode("utf-8", errors="ignore")

            nd_match = re.search(r'<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
            if nd_match:
                nd = json.loads(nd_match.group(1))
                before = len(photo_urls)
                seen = set(photo_urls)

                def find_all_photos(obj, depth=0):
                    """Recursively harvest every rdcpix.com href in the JSON tree."""
                    if depth > 12:
                        return
                    if isinstance(obj, dict):
                        # Check every string value — catches href, url, src, etc.
                        for v in obj.values():
                            if isinstance(v, str) and "rdcpix.com" in v:
                                normed = normalize_photo_url(v)
                                if normed not in seen:
                                    seen.add(normed)
                                    photo_urls.append(normed)
                            else:
                                find_all_photos(v, depth + 1)
                    elif isinstance(obj, list):
                        for item in obj:
                            find_all_photos(item, depth + 1)
                    elif isinstance(obj, str) and "rdcpix.com" in obj:
                        normed = normalize_photo_url(obj)
                        if normed not in seen:
                            seen.add(normed)
                            photo_urls.append(normed)

                find_all_photos(nd)
                print(f"[scrape-realtor] Page scrape added {len(photo_urls) - before} photos (total: {len(photo_urls)})", file=sys.stderr)
            else:
                print(f"[scrape-realtor] No __NEXT_DATA__ found on page (may be Akamai-blocked)", file=sys.stderr)
        except Exception as page_err:
            print(f"[scrape-realtor] Page scrape failed (non-fatal): {page_err}", file=sys.stderr)

    print(f"[scrape-realtor] Found {len(photo_urls)} photo(s) for {safe_str(prop.get('full_street_line')) or address}", file=sys.stderr)

    def safe_int(val):
        s = safe_str(val)
        try: return int(float(s)) if s else None
        except (ValueError, TypeError): return None

    def safe_float(val):
        s = safe_str(val)
        try: return float(s) if s else None
        except (ValueError, TypeError): return None

    result = {
        "address": safe_str(prop.get("full_street_line") or prop.get("street_address")),
        "city":    safe_str(prop.get("city")),
        "state":   safe_str(prop.get("state")),
        "zip":     safe_str(prop.get("zip_code")),
        "price":   safe_int(prop.get("list_price")),
        "beds":    safe_int(prop.get("beds")),
        "baths":   safe_float(prop.get("full_baths")),
        "sqft":    safe_int(prop.get("sqft")),
        "description": safe_str(prop.get("text") or prop.get("description")),
        "photoUrls": photo_urls,
        "source": "realtor.com",
        "propertyUrl": safe_str(prop.get("property_url")),
    }

    print(json.dumps(result))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: scrape-realtor.py <realtor.com URL>"}))
        sys.exit(1)
    scrape_listing(sys.argv[1])
