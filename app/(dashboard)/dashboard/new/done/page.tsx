"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Download, Copy, Share2, QrCode, CheckCircle2, Loader2, ExternalLink, ArrowLeft, RefreshCw
} from "lucide-react";
import type { JobStatusComplete } from "@/lib/types";
import { ContentPackView } from "@/components/dashboard/content-pack";
import { VideoPlayer } from "@/components/dashboard/video-player";
import { SocialPreviews } from "@/components/dashboard/social-previews";

const MUSIC_TRACKS = [
  { id: "track-01", label: "Modern Vibe (95 BPM)" },
  { id: "track-02", label: "Upbeat Groove (120 BPM)" },
  { id: "track-03", label: "Luxury Mood (85 BPM)" },
  { id: "track-04", label: "Club Energy (128 BPM)" },
  { id: "track-05", label: "Fresh Beat (110 BPM)" },
  { id: "track-06", label: "Calm Flow (75 BPM)" },
  { id: "track-07", label: "High Energy (140 BPM)" },
  { id: "track-08", label: "Smooth Jazz (100 BPM)" },
];

function copyToClipboard(text: string, label = "Copied!") {
  navigator.clipboard.writeText(text).then(() => toast.success(label));
}

function DoneContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId");
  const listingId = searchParams.get("listingId");

  const [data, setData] = useState<JobStatusComplete | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const [reEditMusic, setReEditMusic] = useState("");
  const [reEditHeadline, setReEditHeadline] = useState("");
  const [reediting, setReediting] = useState(false);
  const [activeCover, setActiveCover] = useState<number>(0);

  async function applyReedit(type: "music" | "headline", value: string) {
    if (!listingId || !value.trim()) return;
    setReediting(true);
    try {
      const res = await fetch(`/api/listings/${listingId}/reedit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(type === "music" ? { type: "music", musicTrackId: value } : { type: "headline", headline: value }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(type === "music" ? "Music updated!" : "Headline updated!");
    } catch (e) {
      toast.error("Re-edit failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setReediting(false);
    }
  }

  async function setCoverPhoto(thumbIdx: number, thumbUrl: string) {
    if (!listingId) return;
    setActiveCover(thumbIdx);
    try {
      await fetch(`/api/listings/${listingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverUrl: thumbUrl }),
      });
      toast.success("Cover photo updated!");
    } catch {
      toast.error("Failed to update cover");
    }
  }

  useEffect(() => {
    if (!jobId) { router.push("/dashboard/new"); return; }

    fetch(`/api/job/${jobId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.status === "complete") {
          setData(d as JobStatusComplete);
        } else {
          // Still processing, redirect back
          router.push(`/dashboard/new/generating?jobId=${jobId}&listingId=${listingId}`);
        }
      })
      .catch(() => toast.error("Failed to load results"))
      .finally(() => setLoading(false));
  }, [jobId, listingId, router]);

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="aspect-video rounded-xl" />
          <Skeleton className="aspect-[9/16] max-h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8 text-sm text-muted-foreground">
        {[1, 2, 3].map((n) => (
          <span key={n} className="flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="opacity-50 text-xs">{["Import", "Customize", "Generated"][n - 1]}</span>
            {n < 3 && <span className="mx-1">→</span>}
          </span>
        ))}
        <span className="mx-1">→</span>
        <span className="font-medium text-foreground bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">4</span>
        <span className="font-medium text-foreground">Done!</span>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-6 h-6 text-green-500" />
            <h1 className="text-2xl font-bold">Your video is ready!</h1>
          </div>
          <p className="text-muted-foreground text-sm">Download, share, or copy descriptions below.</p>
        </div>
        <Button variant="outline" onClick={() => router.push("/dashboard/new")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          New video
        </Button>
      </div>

      {/* Video players */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* 16:9 */}
        <div className="space-y-3">
          <Badge variant="secondary">16:9 — Desktop / TV</Badge>
          {data.video.url16x9 ? (
            <VideoPlayer src={data.video.url16x9} poster={data.video.thumbnailUrl} />
          ) : (
            <div className="rounded-xl bg-black aspect-video flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-white/40" />
            </div>
          )}
          <Button className="w-full" onClick={() => window.open(data.video.url16x9, "_blank")}>
            <Download className="w-4 h-4 mr-2" />Download 16:9
          </Button>
        </div>

        {/* 9:16 */}
        <div className="space-y-3">
          <Badge variant="secondary">9:16 — Mobile / Story</Badge>
          <div className="flex justify-center">
            <div className="w-48 rounded-xl overflow-hidden bg-black" style={{ aspectRatio: "9/16" }}>
              {data.video.url9x16 ? (
                <video src={data.video.url9x16} controls muted loop className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <p className="text-white/40 text-xs">Not generated</p>
                </div>
              )}
            </div>
          </div>
          {data.video.url9x16 && (
            <Button variant="outline" className="w-full" onClick={() => window.open(data.video.url9x16, "_blank")}>
              <Download className="w-4 h-4 mr-2" />Download 9:16
            </Button>
          )}
        </div>
      </div>

      {/* Extra formats: 1:1 and 4:5 */}
      {(data.video.url1x1 || data.video.url4x5) && (
        <div className="flex gap-3 mb-6">
          {data.video.url1x1 && (
            <Button variant="outline" onClick={() => window.open(data.video.url1x1, "_blank")}>
              <Download className="w-4 h-4 mr-2" />Download 1:1 (Feed)
            </Button>
          )}
          {data.video.url4x5 && (
            <Button variant="outline" onClick={() => window.open(data.video.url4x5, "_blank")}>
              <Download className="w-4 h-4 mr-2" />Download 4:5 (Portrait)
            </Button>
          )}
        </div>
      )}

      {/* GIF preview */}
      {data.video.gifUrl && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-sm">Animated GIF Preview</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.video.gifUrl} alt="Listing GIF" className="rounded-lg h-32 object-cover" />
            <Button variant="outline" size="sm" onClick={() => window.open(data.video.gifUrl, "_blank")}>
              <Download className="w-4 h-4 mr-2" />Download GIF
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Thumbnail selector */}
      {data.video.selectorThumbnails && data.video.selectorThumbnails.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-sm">Choose Cover Thumbnail</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              {data.video.selectorThumbnails.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setCoverPhoto(i, url)}
                  className={`rounded-lg overflow-hidden border-2 transition-all ${activeCover === i ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Thumbnail ${i + 1}`} className="w-24 h-14 object-cover" />
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Click a frame to set as listing cover photo.</p>
          </CardContent>
        </Card>
      )}

      {/* Re-edit card */}
      {listingId && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Not happy? Quick re-edit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Swap music track</p>
                <Select value={reEditMusic} onValueChange={(v) => setReEditMusic(v ?? "")}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Pick a track…" />
                  </SelectTrigger>
                  <SelectContent>
                    {MUSIC_TRACKS.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" disabled={!reEditMusic || reediting} onClick={() => applyReedit("music", reEditMusic)}>
                {reediting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Apply"}
              </Button>
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Change headline text</p>
                <Input
                  className="h-9 text-sm"
                  placeholder="e.g. Luxury Living in Austin"
                  value={reEditHeadline}
                  onChange={(e) => setReEditHeadline(e.target.value)}
                />
              </div>
              <Button size="sm" disabled={!reEditHeadline.trim() || reediting} onClick={() => applyReedit("headline", reEditHeadline)}>
                {reediting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Apply"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Social Previews */}
      {data.video.url16x9 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Platform Previews</h3>
          <SocialPreviews
            thumbnailUrl={data.video.thumbnailUrl || data.video.url16x9}
            title={data.listing.descriptionMls?.split(".")[0] || "Your Listing"}
            duration={data.video.durationSeconds}
          />
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Descriptions */}
        <div className="col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Listing Descriptions</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="mls">
                <TabsList className="mb-4">
                  <TabsTrigger value="mls">MLS</TabsTrigger>
                  <TabsTrigger value="social">Social</TabsTrigger>
                  <TabsTrigger value="luxury">Luxury</TabsTrigger>
                </TabsList>
                {[
                  { key: "mls", text: data.listing.descriptionMls, limit: "500 chars" },
                  { key: "social", text: data.listing.descriptionSocial, limit: "150 chars" },
                  { key: "luxury", text: data.listing.descriptionLuxury, limit: "300 chars" },
                ].map(({ key, text, limit }) => (
                  <TabsContent key={key} value={key}>
                    <div className="relative bg-muted/50 rounded-lg p-4">
                      <p className="text-sm leading-relaxed pr-8">{text || "Not yet generated"}</p>
                      {text && (
                        <button
                          onClick={() => copyToClipboard(text, "Description copied!")}
                          className="absolute top-3 right-3"
                        >
                          <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{limit} · Fair Housing compliant</p>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Social Captions</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="instagram">
                <TabsList className="mb-4">
                  <TabsTrigger value="instagram">Instagram</TabsTrigger>
                  <TabsTrigger value="tiktok">TikTok</TabsTrigger>
                  <TabsTrigger value="facebook">Facebook</TabsTrigger>
                </TabsList>
                {[
                  { key: "instagram", text: data.listing.captionInstagram },
                  { key: "tiktok", text: data.listing.captionTiktok },
                  { key: "facebook", text: data.listing.captionFacebook },
                ].map(({ key, text }) => (
                  <TabsContent key={key} value={key}>
                    <div className="relative bg-muted/50 rounded-lg p-4">
                      <p className="text-sm leading-relaxed pr-8">{text || "Not yet generated"}</p>
                      {text && (
                        <button
                          onClick={() => copyToClipboard(text, "Caption copied!")}
                          className="absolute top-3 right-3"
                        >
                          <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                        </button>
                      )}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Share panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Share2 className="w-4 h-4" />
                Share
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Public listing page</p>
                <p className="text-xs font-mono truncate">{data.listing.shareUrl}</p>
              </div>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => copyToClipboard(data.listing.shareUrl, "Share link copied!")}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy link
              </Button>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => window.open(data.listing.shareUrl, "_blank")}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open page
              </Button>

              <Separator />

              <Button
                className="w-full"
                variant="outline"
                onClick={() => setShowQR(!showQR)}
              >
                <QrCode className="w-4 h-4 mr-2" />
                {showQR ? "Hide" : "Show"} QR Code
              </Button>

              {showQR && data.listing.qrCodeUrl && (
                <div className="space-y-2">
                  <div className="bg-white p-3 rounded-lg mx-auto w-fit">
                    <Image
                      src={data.listing.qrCodeUrl}
                      alt="QR Code"
                      width={160}
                      height={160}
                      className="block"
                    />
                  </div>
                  <Button
                    className="w-full"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const link = document.createElement("a");
                      link.href = data.listing.qrCodeUrl;
                      link.download = "listing-qr.png";
                      link.click();
                    }}
                  >
                    <Download className="w-3 h-3 mr-2" />
                    Download QR
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {listingId && (
            <Button
              className="w-full"
              variant="outline"
              onClick={() => router.push(`/dashboard/listings/${listingId}`)}
            >
              View full listing →
            </Button>
          )}
        </div>
      </div>

      {/* Content Pack */}
      {listingId && (
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Content Pack</CardTitle>
            </CardHeader>
            <CardContent>
              <ContentPackView listingId={listingId} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function DonePage() {
  return (
    <Suspense fallback={<div className="p-8 flex items-center justify-center"><Loader2 className="animate-spin" /></div>}>
      <DoneContent />
    </Suspense>
  );
}
