"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Link2,
  Upload,
  X,
  Star,
  GripVertical,
  ArrowRight,
  Loader2,
  Sparkles,
} from "lucide-react";
import type { ListingPhoto } from "@/lib/types";


interface ListingData {
  listingId: string;
  address: string;
  city: string;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  description: string;
  photos: ListingPhoto[];
}

export default function NewListingPage() {
  const router = useRouter();

  const [url, setUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [listing, setListing] = useState<ListingData | null>(null);
  const [photos, setPhotos] = useState<ListingPhoto[]>([]);
  const [editAddress, setEditAddress] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editBeds, setEditBeds] = useState("");
  const [editBaths, setEditBaths] = useState("");
  const [editSqft, setEditSqft] = useState("");
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  async function handleScrape(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setScraping(true);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.fallback === "manual_upload") {
          toast.warning("Could not auto-import. Please upload photos manually.");
          setListing({ listingId: crypto.randomUUID(), address: "", city: "", price: null, beds: null, baths: null, sqft: null, description: "", photos: [] });
          setPhotos([]);
        } else {
          throw new Error(data.error || "Scrape failed");
        }
        return;
      }
      setListing(data);
      setPhotos(data.photos || []);
      setEditAddress(data.address || "");
      setEditCity(data.city || "");
      setEditPrice(data.price ? String(data.price) : "");
      setEditBeds(data.beds ? String(data.beds) : "");
      setEditBaths(data.baths ? String(data.baths) : "");
      setEditSqft(data.sqft ? String(data.sqft) : "");

      // Surface any scraper warnings (e.g. Zillow blocked)
      const zillowWarning = data.warnings?.find((w: { photoIndex: number; warning: string }) => w.photoIndex === -1);
      if (zillowWarning) {
        toast.warning(zillowWarning.warning);
      } else if (data.photos.length === 0) {
        toast.warning("No photos found — drag and drop your own photos below.");
      } else {
        toast.success(`Found ${data.photos.length} photos`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to import listing");
    } finally {
      setScraping(false);
    }
  }

  async function handleDemoFill() {
    setScraping(true);
    try {
      const listingId = crypto.randomUUID();
      const slug = `demo-${listingId.slice(0, 8)}`;

      const demoPhotos: ListingPhoto[] = [
        { url: "https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?w=1920", order: 0, is_cover: true },
        { url: "https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?w=1920", order: 1, is_cover: false },
        { url: "https://images.pexels.com/photos/2724749/pexels-photo-2724749.jpeg?w=1920", order: 2, is_cover: false },
        { url: "https://images.pexels.com/photos/2062426/pexels-photo-2062426.jpeg?w=1920", order: 3, is_cover: false },
        { url: "https://images.pexels.com/photos/1643384/pexels-photo-1643384.jpeg?w=1920", order: 4, is_cover: false },
        { url: "https://images.pexels.com/photos/3935350/pexels-photo-3935350.jpeg?w=1920", order: 5, is_cover: false },
      ];

      const createRes = await fetch("/api/listings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: listingId,
          slug,
          address: "742 Evergreen Terrace",
          city: "Austin",
          state: "TX",
          zip: "78701",
          price: 485000,
          beds: 3,
          baths: 2,
          sqft: 1842,
          raw_description: "Charming 3-bedroom home in the heart of Austin with modern finishes, open floor plan, and a beautifully landscaped backyard.",
          source_url: null,
          photos: demoPhotos,
        }),
      });
      if (!createRes.ok) {
        const e = await createRes.json() as { error?: string };
        toast.error("Failed to create demo: " + (e.error ?? "unknown error"));
        return;
      }

      setListing({
        listingId, address: "742 Evergreen Terrace", city: "Austin",
        price: 485000, beds: 3, baths: 2, sqft: 1842,
        description: "Charming 3-bedroom home in the heart of Austin with modern finishes, open floor plan, and a beautifully landscaped backyard.",
        photos: demoPhotos,
      });
      setPhotos(demoPhotos);
      setIsDemo(false); // real DB row now exists
      setEditAddress("742 Evergreen Terrace");
      setEditCity("Austin");
      setEditPrice("485000");
      setEditBeds("3");
      setEditBaths("2");
      setEditSqft("1842");
      toast.success("Demo listing loaded — click Continue to generate a video!");
    } catch (err: unknown) {
      toast.error("Demo failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setScraping(false);
    }
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setUploadingPhotos(true);
    try {
      let currentListing = listing;

      // If no listing yet, create one on-the-fly for manual uploads
      if (!currentListing) {
        const listingId = crypto.randomUUID();
        const slug = `upload-${listingId.slice(0, 8)}`;

        const createRes = await fetch("/api/listings/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: listingId, slug, address: "", city: "", state: "", zip: "", photos: [] }),
        });
        if (!createRes.ok) {
          const e = await createRes.json() as { error?: string };
          toast.error("Failed to create listing: " + (e.error ?? "unknown error"));
          return;
        }

        currentListing = {
          listingId, address: "", city: "",
          price: null, beds: null, baths: null, sqft: null,
          description: "", photos: [],
        };
        setListing(currentListing);
        setIsDemo(false);
        toast.info("Listing created — fill in the details below");
      }

      const newPhotos: ListingPhoto[] = [];
      let failCount = 0;
      for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i];
        const fd = new FormData();
        fd.append("file", file);
        fd.append("listingId", currentListing.listingId);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (!res.ok) {
          const e = await res.json() as { error?: string };
          console.error("[upload] photo failed:", e.error);
          failCount++;
          continue;
        }
        const { url } = await res.json() as { url: string };
        newPhotos.push({ url, order: photos.length + i, is_cover: false });
      }
      setPhotos((prev) => [...prev, ...newPhotos]);
      if (newPhotos.length > 0) {
        toast.success(`${newPhotos.length} photo${newPhotos.length === 1 ? "" : "s"} added`);
      }
      if (failCount > 0) {
        toast.error(`${failCount} photo${failCount === 1 ? "" : "s"} failed to upload — check your connection`);
      }
    } finally {
      setUploadingPhotos(false);
    }
  }, [listing, photos]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
    maxFiles: 40,
    disabled: uploadingPhotos,
  });

  function removePhoto(idx: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== idx).map((p, i) => ({ ...p, order: i })));
  }

  function setCoverPhoto(idx: number) {
    setPhotos((prev) =>
      prev.map((p, i) => ({ ...p, is_cover: i === idx }))
    );
  }

  async function handleContinue() {
    if (!listing) return;
    if (photos.length < 3) {
      toast.error("Please add at least 3 photos");
      return;
    }

    // Demo mode: skip API call, pass data via query params
    if (isDemo) {
      const params = new URLSearchParams({
        listingId: listing.listingId,
        demo: "1",
        address: editAddress,
        city: editCity,
        price: editPrice,
        beds: editBeds,
        baths: editBaths,
        sqft: editSqft,
      });
      router.push(`/dashboard/new/customize?${params.toString()}`);
      return;
    }

    // Update listing with edits
    const res = await fetch(`/api/listings/${listing.listingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: editAddress,
        price: editPrice ? parseInt(editPrice) : null,
        photos,
      }),
    });

    if (!res.ok) {
      toast.error("Failed to save listing details");
      return;
    }

    router.push(`/dashboard/new/customize?listingId=${listing.listingId}`);
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8 text-sm text-muted-foreground">
        <span className="font-medium text-foreground bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs">1</span>
        <span className="font-medium text-foreground">Import Listing</span>
        <span className="mx-2">→</span>
        <span className="opacity-50 w-6 h-6 border rounded-full flex items-center justify-center text-xs">2</span>
        <span className="opacity-50">Customize</span>
        <span className="mx-2 opacity-50">→</span>
        <span className="opacity-50 w-6 h-6 border rounded-full flex items-center justify-center text-xs">3</span>
        <span className="opacity-50">Generating</span>
        <span className="mx-2 opacity-50">→</span>
        <span className="opacity-50 w-6 h-6 border rounded-full flex items-center justify-center text-xs">4</span>
        <span className="opacity-50">Done</span>
      </div>

      <h1 className="text-2xl font-bold mb-2">Import your listing</h1>
      <p className="text-muted-foreground mb-8">
        Paste a Zillow, Redfin, or Realtor.com URL to import automatically, or upload photos manually.
      </p>

      {/* URL input */}
      <form onSubmit={handleScrape} className="flex gap-3 mb-3">
        <div className="relative flex-1">
          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="url"
            placeholder="https://www.zillow.com/homes/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="pl-9"
            disabled={scraping}
          />
        </div>
        <Button type="submit" disabled={scraping || !url.trim()}>
          {scraping ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Importing...
            </>
          ) : (
            "Import"
          )}
        </Button>
      </form>

      {/* Demo listing shortcut */}
      <div className="flex items-center gap-2 mb-8">
        <span className="text-sm text-muted-foreground">No listing URL?</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleDemoFill}
          disabled={scraping}
          className="gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Try Demo Listing
        </Button>
      </div>

      {/* Loading skeleton */}
      {scraping && (
        <div className="space-y-4">
          <Skeleton className="h-6 w-64" />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-video rounded-lg" />
            ))}
          </div>
        </div>
      )}

      {/* Listing details + photos */}
      {listing && !scraping && (
        <div className="space-y-6">
          {/* Listing details */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <Label>Address</Label>
                  <Input
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    placeholder="123 Main St, San Francisco, CA 94102"
                  />
                </div>
                <div className="space-y-1">
                  <Label>City</Label>
                  <Input
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                    placeholder="San Francisco"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Price</Label>
                  <Input
                    type="number"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    placeholder="1250000"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Beds</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={editBeds}
                    onChange={(e) => setEditBeds(e.target.value)}
                    placeholder="3"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Baths</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={editBaths}
                    onChange={(e) => setEditBaths(e.target.value)}
                    placeholder="2"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Sq ft</Label>
                  <Input
                    type="number"
                    value={editSqft}
                    onChange={(e) => setEditSqft(e.target.value)}
                    placeholder="1850"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Photos grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label>
                Photos
                <span className="ml-2 text-muted-foreground font-normal text-xs">
                  ({photos.length} · min 3 required)
                </span>
              </Label>
              {photos.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  ⭐ = cover photo
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-4 gap-3 mb-3">
              {photos.map((photo, idx) => (
                <div key={idx} className="relative group aspect-video rounded-lg overflow-hidden bg-muted">
                  <Image
                    src={photo.url}
                    alt={`Photo ${idx + 1}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 25vw, 15vw"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                  <button
                    onClick={() => removePhoto(idx)}
                    className="absolute top-1 right-1 p-1 bg-black/70 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                  <button
                    onClick={() => setCoverPhoto(idx)}
                    className={`absolute top-1 left-1 p-1 rounded-full transition-opacity ${
                      photo.is_cover
                        ? "bg-yellow-500 opacity-100"
                        : "bg-black/70 opacity-0 group-hover:opacity-100"
                    }`}
                    title="Set as cover"
                  >
                    <Star className={`w-3 h-3 ${photo.is_cover ? "text-white fill-white" : "text-white"}`} />
                  </button>
                  {photo.is_cover && (
                    <div className="absolute bottom-1 left-1 right-1">
                      <Badge className="text-xs w-full justify-center bg-yellow-500 text-white border-0">
                        Cover
                      </Badge>
                    </div>
                  )}
                  <GripVertical className="absolute bottom-1 right-1 w-3 h-3 text-white/50 opacity-0 group-hover:opacity-100" />
                </div>
              ))}
            </div>

            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
              } ${uploadingPhotos ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <input {...getInputProps()} />
              {uploadingPhotos ? (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </div>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {isDragActive ? "Drop photos here" : "Drag photos here or click to upload"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP · up to 40 photos</p>
                </>
              )}
            </div>
          </div>

          {/* Continue button */}
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleContinue}
              disabled={photos.length < 3}
              size="lg"
            >
              Continue to Customize
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
