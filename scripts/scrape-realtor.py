#!/usr/bin/env python3
"""
Scrapes a single Realtor.com listing using HomeHarvest.
Called from lib/scraper.ts via child_process.execSync.
Outputs a single JSON line to stdout; progress logs go to stderr.
"""
import sys
import json
import re
import urllib.request

def normalize_photo_url(url: str) -> str:
    url = url.split("?")[0]
    for suffix in ["-s.", "-t.", "-l.", "-e."]:
        url = re.sub(r"-[stle]\.", "-o.", url)
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

    # Primary photo from API
    primary = prop.get("primary_photo") or prop.get("img_src") or ""
    if isinstance(primary, str) and "rdcpix" in primary:
        photo_urls.append(normalize_photo_url(primary))

    # Alt photos from API (comma-separated string or list)
    alt_photos = prop.get("alt_photos") or ""
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

    # If fewer than 3 photos, try fetching the listing page for __NEXT_DATA__ photos
    if len(photo_urls) < 3:
        listing_url = prop.get("property_url") or ""
        if listing_url:
            print(f"[scrape-realtor] Only {len(photo_urls)} photo(s) from API — trying page scrape for more", file=sys.stderr)
            try:
                req = urllib.request.Request(listing_url, headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
                })
                resp = urllib.request.urlopen(req, timeout=10)
                html = resp.read().decode("utf-8", errors="ignore")
                nd_match = re.search(r'<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
                if nd_match:
                    nd = json.loads(nd_match.group(1))
                    def find_photos(obj, depth=0):
                        if depth > 8:
                            return
                        if isinstance(obj, dict):
                            for k, v in obj.items():
                                if k in ("photos", "photo_list", "responsivePhotos", "originalPhotos"):
                                    if isinstance(v, list):
                                        for photo in v:
                                            href = photo.get("href", "") if isinstance(photo, dict) else ""
                                            if href and "rdcpix" in href:
                                                normed = normalize_photo_url(href)
                                                if normed not in photo_urls:
                                                    photo_urls.append(normed)
                                else:
                                    find_photos(v, depth + 1)
                        elif isinstance(obj, list):
                            for item in obj:
                                find_photos(item, depth + 1)
                    find_photos(nd)
            except Exception as page_err:
                print(f"[scrape-realtor] Page scrape failed (non-fatal): {page_err}", file=sys.stderr)

    print(f"[scrape-realtor] Found {len(photo_urls)} photo(s) for {prop.get('full_street_line', address)}", file=sys.stderr)

    result = {
        "address": str(prop.get("full_street_line") or prop.get("street_address") or ""),
        "city": str(prop.get("city") or ""),
        "state": str(prop.get("state") or ""),
        "zip": str(prop.get("zip_code") or ""),
        "price": int(prop["list_price"]) if prop.get("list_price") and str(prop["list_price"]) not in ("nan", "None", "") else None,
        "beds": int(prop["beds"]) if prop.get("beds") and str(prop["beds"]) not in ("nan", "None", "") else None,
        "baths": float(prop["full_baths"]) if prop.get("full_baths") and str(prop["full_baths"]) not in ("nan", "None", "") else None,
        "sqft": int(prop["sqft"]) if prop.get("sqft") and str(prop["sqft"]) not in ("nan", "None", "") else None,
        "description": str(prop.get("text") or prop.get("description") or ""),
        "photoUrls": photo_urls,
        "source": "realtor.com",
        "propertyUrl": str(prop.get("property_url") or ""),
    }

    print(json.dumps(result))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: scrape-realtor.py <realtor.com URL>"}))
        sys.exit(1)
    scrape_listing(sys.argv[1])
