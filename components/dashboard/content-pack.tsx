"use client";

import { useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Copy, RefreshCw, Zap, Film, Type, Globe, MessageCircle } from "lucide-react";
import type { ContentPack, ShotScene } from "@/lib/types";

interface ContentPackViewProps {
  listingId: string;
  initialPack?: ContentPack | null;
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copying, setCopying] = useState(false);

  async function handleCopy() {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(text);
      toast.success(label ? `Copied: ${label}` : "Copied!");
    } catch {
      toast.error("Failed to copy");
    } finally {
      setCopying(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      disabled={copying}
      className="h-7 px-2 text-muted-foreground hover:text-foreground"
    >
      <Copy className="h-3.5 w-3.5" />
    </Button>
  );
}

export function ContentPackView({ listingId, initialPack }: ContentPackViewProps) {
  const [pack, setPack] = useState<ContentPack | null>(initialPack ?? null);
  const [loading, setLoading] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/content/pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      });
      const data = (await res.json()) as { contentPack?: ContentPack; error?: string };
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to generate");
      }
      if (data.contentPack) {
        setPack(data.contentPack);
        toast.success("Content pack generated!");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  if (!pack && !loading) {
    return (
      <div className="py-8 text-center space-y-4">
        <p className="text-muted-foreground text-sm">
          Generate hooks, captions, scripts, and platform posts for this listing.
        </p>
        <Button onClick={generate} disabled={loading}>
          <Zap className="h-4 w-4 mr-2" />
          Generate Content Pack
        </Button>
      </div>
    );
  }

  if (loading && !pack) {
    return (
      <div className="space-y-3 py-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
    );
  }

  if (!pack) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Generated {new Date(pack.generatedAt).toLocaleDateString()}
        </p>
        <Button variant="outline" size="sm" onClick={generate} disabled={loading}>
          {loading ? (
            <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          )}
          Regenerate
        </Button>
      </div>

      <Tabs defaultValue="hooks">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="hooks" className="text-xs">
            <Zap className="h-3.5 w-3.5 mr-1 hidden sm:block" />
            Hooks
          </TabsTrigger>
          <TabsTrigger value="script" className="text-xs">
            <Film className="h-3.5 w-3.5 mr-1 hidden sm:block" />
            Script
          </TabsTrigger>
          <TabsTrigger value="captions" className="text-xs">
            <Type className="h-3.5 w-3.5 mr-1 hidden sm:block" />
            Captions
          </TabsTrigger>
          <TabsTrigger value="platforms" className="text-xs">
            <Globe className="h-3.5 w-3.5 mr-1 hidden sm:block" />
            Platforms
          </TabsTrigger>
          <TabsTrigger value="engage" className="text-xs">
            <MessageCircle className="h-3.5 w-3.5 mr-1 hidden sm:block" />
            Engage
          </TabsTrigger>
        </TabsList>

        {/* HOOKS */}
        <TabsContent value="hooks" className="space-y-2 mt-4">
          <p className="text-xs text-muted-foreground mb-3">
            Scroll-stopping hooks for Reels &amp; TikTok. Tap to copy.
          </p>
          {pack.hooks.map((hook, i) => (
            <div
              key={i}
              className="flex items-start justify-between gap-2 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
            >
              <span className="text-sm flex-1">{hook}</span>
              <CopyButton text={hook} label={`Hook ${i + 1}`} />
            </div>
          ))}
        </TabsContent>

        {/* SCRIPT / SHOT LIST */}
        <TabsContent value="script" className="space-y-3 mt-4">
          <p className="text-xs text-muted-foreground mb-3">
            6-scene shot-by-shot script for your video walkthrough.
          </p>
          {pack.shotList.map((scene: ShotScene) => (
            <Card key={scene.sceneNumber} className="overflow-hidden">
              <CardHeader className="py-2 px-4 bg-muted/40 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-medium">
                  Scene {scene.sceneNumber} · {scene.duration}
                </CardTitle>
                <CopyButton
                  text={`Scene ${scene.sceneNumber} (${scene.duration})\nCamera: ${scene.camera}\nSpeak: ${scene.speak}`}
                  label={`Scene ${scene.sceneNumber}`}
                />
              </CardHeader>
              <CardContent className="py-3 px-4 space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Camera:</span> {scene.camera}
                </p>
                <p className="text-xs">
                  <span className="font-medium">Say:</span>{" "}
                  <em className="not-italic text-muted-foreground">{scene.speak}</em>
                </p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* CAPTIONS */}
        <TabsContent value="captions" className="space-y-3 mt-4">
          <p className="text-xs text-muted-foreground mb-3">
            5 ready-to-post caption styles. Mix and match per platform.
          </p>
          {Object.entries(pack.captionStyles).map(([style, text]) => (
            <div key={style} className="rounded-lg border p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium capitalize text-muted-foreground">
                  {style.replace(/([A-Z])/g, " $1").trim()}
                </span>
                <CopyButton text={text} label={style} />
              </div>
              <p className="text-sm">{text}</p>
            </div>
          ))}
        </TabsContent>

        {/* PLATFORM POSTS */}
        <TabsContent value="platforms" className="space-y-3 mt-4">
          <p className="text-xs text-muted-foreground mb-3">
            Platform-optimised posts ready to paste.
          </p>
          {Object.entries(pack.platformPosts).map(([platform, text]) => {
            const icons: Record<string, string> = {
              instagram: "📸",
              tiktok: "🎵",
              linkedin: "💼",
              facebook: "👥",
              twitter: "🐦",
              youtubeShort: "▶️",
              emailSnippet: "📧",
            };
            return (
              <div key={platform} className="rounded-lg border p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium capitalize text-muted-foreground">
                    {icons[platform] ?? "📱"}{" "}
                    {platform.replace(/([A-Z])/g, " $1").trim()}
                  </span>
                  <CopyButton text={text} label={platform} />
                </div>
                <p className="text-sm whitespace-pre-wrap">{text}</p>
              </div>
            );
          })}
        </TabsContent>

        {/* ENGAGEMENT */}
        <TabsContent value="engage" className="space-y-2 mt-4">
          <p className="text-xs text-muted-foreground mb-3">
            Questions that drive comments, saves, and shares.
          </p>
          {pack.engagementQuestions.map((q, i) => (
            <div
              key={i}
              className="flex items-start justify-between gap-2 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
            >
              <span className="text-sm flex-1">{q}</span>
              <CopyButton text={q} label={`Question ${i + 1}`} />
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
