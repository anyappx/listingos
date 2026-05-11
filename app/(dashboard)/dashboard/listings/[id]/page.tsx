"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Download, Copy, Share2, ExternalLink, Eye, Users, Save, Loader2, Video
} from "lucide-react";
import type { Listing, Video as VideoType, ContentPack } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { ContentPackView } from "@/components/dashboard/content-pack";

function copyToClipboard(text: string, message = "Copied!") {
  navigator.clipboard.writeText(text).then(() => toast.success(message));
}

export default function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [listing, setListing] = useState<Listing | null>(null);
  const [video, setVideo] = useState<(VideoType & { signedUrl16x9?: string; signedUrl9x16?: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signedUrls, setSignedUrls] = useState<{ url16x9: string; url9x16: string } | null>(null);

  const [mlsDesc, setMlsDesc] = useState("");
  const [socialDesc, setSocialDesc] = useState("");
  const [luxuryDesc, setLuxuryDesc] = useState("");
  const [instaCap, setInstaCap] = useState("");
  const [tiktokCap, setTiktokCap] = useState("");
  const [fbCap, setFbCap] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const [listingRes, videoRes] = await Promise.all([
        supabase.from("listings").select("*").eq("id", id).eq("user_id", user.id).single(),
        supabase.from("videos").select("*").eq("listing_id", id).order("created_at", { ascending: false }).limit(1).single(),
      ]);

      if (listingRes.data) {
        const l = listingRes.data as Listing;
        setListing(l);
        setMlsDesc(l.description_mls || "");
        setSocialDesc(l.description_social || "");
        setLuxuryDesc(l.description_luxury || "");
        setInstaCap(l.caption_instagram || "");
        setTiktokCap(l.caption_tiktok || "");
        setFbCap(l.caption_facebook || "");
      }

      if (videoRes.data) {
        setVideo(videoRes.data as VideoType);
        // Get signed URLs
        const jobRes = await supabase.from("video_jobs").select("id").eq("listing_id", id).order("created_at", { ascending: false }).limit(1).single();
        if (jobRes.data) {
          const statusRes = await fetch(`/api/job/${jobRes.data.id}`);
          const statusData = await statusRes.json();
          if (statusData.status === "complete" && statusData.video) {
            setSignedUrls({ url16x9: statusData.video.url16x9, url9x16: statusData.video.url9x16 });
          }
        }
      }
      setLoading(false);
    }
    load();
  }, [id, supabase, router]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descriptionMls: mlsDesc,
          descriptionSocial: socialDesc,
          descriptionLuxury: luxuryDesc,
          captionInstagram: instaCap,
          captionTiktok: tiktokCap,
          captionFacebook: fbCap,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Changes saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-8 max-w-5xl mx-auto space-y-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 gap-6">
        <Skeleton className="aspect-video rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </div>;
  }

  if (!listing) return <div className="p-8">Listing not found.</div>;

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || ""}/l/${listing.slug}`;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button onClick={() => router.push("/dashboard/listings")} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold">{listing.address || "Listing Detail"}</h1>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground ml-7">
            {listing.city && <span>{listing.city}</span>}
            {listing.price && <span>· ${listing.price.toLocaleString()}</span>}
            {listing.beds && <span>· {listing.beds} bd</span>}
            {listing.baths && <span>{listing.baths} ba</span>}
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{listing.view_count} views</span>
            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{listing.lead_count} leads</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open(shareUrl, "_blank")}>
            <ExternalLink className="w-4 h-4 mr-2" />
            View page
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Video players */}
        <div className="col-span-2 space-y-6">
          {video && signedUrls ? (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <Tabs defaultValue="16x9">
                  <TabsList>
                    <TabsTrigger value="16x9">16:9</TabsTrigger>
                    <TabsTrigger value="9x16">9:16</TabsTrigger>
                  </TabsList>
                  <TabsContent value="16x9">
                    <div className="rounded-lg overflow-hidden bg-black aspect-video mb-3">
                      <video src={signedUrls.url16x9} controls muted loop className="w-full h-full object-cover" />
                    </div>
                    <Button variant="outline" className="w-full" onClick={() => window.open(signedUrls.url16x9, "_blank")}>
                      <Download className="w-4 h-4 mr-2" />Download 16:9
                    </Button>
                  </TabsContent>
                  <TabsContent value="9x16">
                    <div className="rounded-lg overflow-hidden bg-black mx-auto" style={{ aspectRatio: "9/16", maxHeight: "300px" }}>
                      <video src={signedUrls.url9x16} controls muted loop className="w-full h-full object-cover" />
                    </div>
                    <Button variant="outline" className="w-full mt-3" onClick={() => window.open(signedUrls.url9x16, "_blank")}>
                      <Download className="w-4 h-4 mr-2" />Download 9:16
                    </Button>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <Video className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground mb-4">No video generated yet</p>
                <Link href={`/dashboard/new/customize?listingId=${listing.id}`}>
                  <Button>Generate Video</Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Editable descriptions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Descriptions</CardTitle>
              <Badge variant="secondary" className="text-xs">Fair Housing compliant</Badge>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="mls">
                <TabsList className="mb-4">
                  <TabsTrigger value="mls">MLS</TabsTrigger>
                  <TabsTrigger value="social">Social</TabsTrigger>
                  <TabsTrigger value="luxury">Luxury</TabsTrigger>
                </TabsList>
                {[
                  { key: "mls", value: mlsDesc, onChange: setMlsDesc, max: 500 },
                  { key: "social", value: socialDesc, onChange: setSocialDesc, max: 150 },
                  { key: "luxury", value: luxuryDesc, onChange: setLuxuryDesc, max: 300 },
                ].map(({ key, value, onChange, max }) => (
                  <TabsContent key={key} value={key} className="space-y-2">
                    <Textarea
                      value={value}
                      onChange={(e) => onChange(e.target.value.substring(0, max))}
                      rows={4}
                      className="resize-none"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{value.length}/{max} chars</span>
                      <button onClick={() => copyToClipboard(value)} className="flex items-center gap-1 hover:text-foreground">
                        <Copy className="w-3 h-3" />Copy
                      </button>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>

          {/* Editable captions */}
          <Card>
            <CardHeader><CardTitle className="text-base">Social Captions</CardTitle></CardHeader>
            <CardContent>
              <Tabs defaultValue="instagram">
                <TabsList className="mb-4">
                  <TabsTrigger value="instagram">Instagram</TabsTrigger>
                  <TabsTrigger value="tiktok">TikTok</TabsTrigger>
                  <TabsTrigger value="facebook">Facebook</TabsTrigger>
                </TabsList>
                {[
                  { key: "instagram", value: instaCap, onChange: setInstaCap, max: 200 },
                  { key: "tiktok", value: tiktokCap, onChange: setTiktokCap, max: 100 },
                  { key: "facebook", value: fbCap, onChange: setFbCap, max: 180 },
                ].map(({ key, value, onChange, max }) => (
                  <TabsContent key={key} value={key} className="space-y-2">
                    <Textarea
                      value={value}
                      onChange={(e) => onChange(e.target.value.substring(0, max))}
                      rows={3}
                      className="resize-none"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{value.length}/{max} chars</span>
                      <button onClick={() => copyToClipboard(value)} className="flex items-center gap-1 hover:text-foreground">
                        <Copy className="w-3 h-3" />Copy
                      </button>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>

          {/* Content Pack */}
          <Card>
            <CardHeader><CardTitle className="text-base">Content Pack</CardTitle></CardHeader>
            <CardContent>
              <ContentPackView
                listingId={listing.id}
                initialPack={listing.content_pack as ContentPack | null}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right panel: share + stats */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Share2 className="w-4 h-4" />Share</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-muted/50 rounded p-2">
                <p className="text-xs font-mono truncate">{shareUrl}</p>
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={() => copyToClipboard(shareUrl, "Link copied!")}>
                <Copy className="w-3 h-3 mr-2" />Copy link
              </Button>
              <Button variant="outline" size="sm" className="w-full" onClick={() => window.open(shareUrl, "_blank")}>
                <ExternalLink className="w-3 h-3 mr-2" />Open page
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Stats</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Page views</span>
                <span className="font-medium">{listing.view_count}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Leads captured</span>
                <span className="font-medium">{listing.lead_count}</span>
              </div>
            </CardContent>
          </Card>

          <Link href={`/dashboard/new/customize?listingId=${listing.id}`}>
            <Button variant="outline" className="w-full" size="sm">
              Regenerate video
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
