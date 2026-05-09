"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, Play, Clock, Smartphone, Monitor, ArrowLeft, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { MusicTrack, VideoStyle, VideoFormat, BrandKit } from "@/lib/types";

const STYLES: { id: VideoStyle; label: string; description: string; emoji: string }[] = [
  { id: "modern", label: "Modern", description: "Clean, contemporary cuts", emoji: "🏙️" },
  { id: "luxury", label: "Luxury", description: "Slow, elegant panning", emoji: "✨" },
  { id: "energetic", label: "Energetic", description: "Fast-paced dynamic motion", emoji: "⚡" },
  { id: "minimal", label: "Minimal", description: "Subtle, understated movement", emoji: "◻️" },
];

const DURATIONS = [
  { value: 15, label: "15s", description: "Instagram Story" },
  { value: 30, label: "30s", description: "Most platforms" },
  { value: 45, label: "45s", description: "YouTube Shorts" },
  { value: 60, label: "60s", description: "Full showcase" },
];

const FORMATS: { id: VideoFormat; label: string; icon: React.ReactNode }[] = [
  { id: "both", label: "Both formats", icon: <><Smartphone className="w-3 h-3" /><Monitor className="w-3 h-3" /></> },
  { id: "16x9", label: "16:9 only", icon: <Monitor className="w-3 h-3" /> },
  { id: "9x16", label: "9:16 only", icon: <Smartphone className="w-3 h-3" /> },
];

function CustomizeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const listingId = searchParams.get("listingId");
  const supabase = createClient();

  const [style, setStyle] = useState<VideoStyle>("modern");
  const [duration, setDuration] = useState(30);
  const [format, setFormat] = useState<VideoFormat>("both");
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [includeBroll, setIncludeBroll] = useState(true);
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!listingId) { router.push("/dashboard/new"); return; }

    async function load() {
      const [tracksRes, brandRes] = await Promise.all([
        supabase.from("music_tracks").select("*").order("display_order"),
        fetch("/api/brand"),
      ]);
      const { data: trackData } = tracksRes;
      const { brandKit: kit } = await brandRes.json();

      const loaded = (trackData as MusicTrack[]) || [];
      setTracks(loaded);
      if (loaded.length > 0) setSelectedTrackId(loaded[0].id);
      setBrandKit(kit);
      setLoading(false);
    }
    load();
  }, [listingId, router, supabase]);

  async function handleGenerate() {
    if (!listingId || !selectedTrackId) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId,
          style,
          durationSeconds: duration,
          formats: format,
          musicTrackId: selectedTrackId,
          includeNeighborhoodBroll: includeBroll,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 402) {
          toast.error("No credits remaining. Upgrade your plan.");
          router.push("/dashboard/account");
          return;
        }
        throw new Error(data.error || "Generation failed");
      }
      router.push(`/dashboard/new/generating?jobId=${data.jobId}&listingId=${listingId}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to start generation");
      setGenerating(false);
    }
  }

  const agentName = brandKit?.agent_name || "Agent Name";
  const brokerageName = brandKit?.brokerage || "Brokerage";
  const primaryColor = brandKit?.primary_color || "#1A2E4A";
  const accentColor = brandKit?.accent_color || "#F5A623";
  const fontFamily = brandKit?.font || "Inter";

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8 text-sm text-muted-foreground">
        <span className="w-6 h-6 border rounded-full flex items-center justify-center text-xs">1</span>
        <span className="opacity-50">Import</span>
        <span className="mx-2">→</span>
        <span className="font-medium text-foreground bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs">2</span>
        <span className="font-medium text-foreground">Customize</span>
        <span className="mx-2">→</span>
        <span className="opacity-50 w-6 h-6 border rounded-full flex items-center justify-center text-xs">3</span>
        <span className="opacity-50">Generating</span>
        <span className="mx-2 opacity-50">→</span>
        <span className="opacity-50 w-6 h-6 border rounded-full flex items-center justify-center text-xs">4</span>
        <span className="opacity-50">Done</span>
      </div>

      <div className="grid grid-cols-3 gap-8">
        {/* Options panel */}
        <div className="col-span-2 space-y-8">
          <div>
            <h1 className="text-2xl font-bold mb-1">Customize your video</h1>
            <p className="text-muted-foreground text-sm">Choose a style, duration, and music for your listing video.</p>
          </div>

          {/* Style picker */}
          <div>
            <h3 className="font-semibold mb-3">Video Style</h3>
            <div className="grid grid-cols-2 gap-3">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    style === s.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <span className="text-2xl mb-2 block">{s.emoji}</span>
                  <p className="font-medium text-sm">{s.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Duration */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Duration
            </h3>
            <div className="flex gap-3">
              {DURATIONS.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDuration(d.value)}
                  className={`flex-1 p-3 rounded-xl border-2 text-center transition-all ${
                    duration === d.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <p className="font-bold text-lg">{d.label}</p>
                  <p className="text-xs text-muted-foreground">{d.description}</p>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Format */}
          <div>
            <h3 className="font-semibold mb-3">Format</h3>
            <div className="flex gap-3">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  className={`flex-1 p-3 rounded-xl border-2 text-center transition-all ${
                    format === f.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center justify-center gap-1 mb-1">{f.icon}</div>
                  <p className="text-sm">{f.label}</p>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Music */}
          <div>
            <h3 className="font-semibold mb-3">Music</h3>
            <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
              {tracks.map((track) => (
                <button
                  key={track.id}
                  onClick={() => setSelectedTrackId(track.id)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    selectedTrackId === track.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate">{track.name}</p>
                    {selectedTrackId === track.id && (
                      <Play className="w-3 h-3 text-primary shrink-0 ml-1" />
                    )}
                  </div>
                  <div className="flex gap-1 mt-1">
                    <Badge variant="secondary" className="text-xs capitalize">{track.genre}</Badge>
                    {track.bpm && <span className="text-xs text-muted-foreground">{track.bpm}bpm</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* B-roll toggle */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Neighborhood B-roll</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Add lifestyle clips from around the neighborhood</p>
            </div>
            <button
              onClick={() => setIncludeBroll(!includeBroll)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                includeBroll ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  includeBroll ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={generating || !selectedTrackId}
              size="lg"
              className="flex-1"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Starting generation...
                </>
              ) : (
                <>
                  Generate Video →
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Live CSS mockup preview */}
        <div className="space-y-4 sticky top-8">
          <h3 className="font-semibold text-sm">Preview</h3>

          {/* Phone mockup */}
          <div className="mx-auto w-32">
            <div className="rounded-2xl bg-black border-4 border-gray-800 overflow-hidden aspect-[9/16] relative">
              <div
                className="absolute inset-0 flex flex-col justify-end"
                style={{
                  background: `linear-gradient(135deg, ${primaryColor}88, ${accentColor}44)`,
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div
                  className="relative px-2 py-1.5"
                  style={{ backgroundColor: `${primaryColor}dd` }}
                >
                  <p
                    className="text-white text-[7px] font-semibold truncate"
                    style={{ fontFamily }}
                  >
                    {agentName}
                  </p>
                  <p
                    className="text-[6px] truncate"
                    style={{ fontFamily, color: accentColor }}
                  >
                    {brokerageName}
                  </p>
                </div>
              </div>
              <Badge className="absolute top-1 left-1 text-[6px] py-0 px-1" variant="secondary">
                9:16
              </Badge>
            </div>
            <p className="text-xs text-center text-muted-foreground mt-1">Mobile</p>
          </div>

          {/* Laptop mockup */}
          <div>
            <div className="rounded-lg bg-black border-2 border-gray-800 overflow-hidden aspect-video relative">
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(135deg, ${primaryColor}88, ${accentColor}44)`,
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div
                className="absolute bottom-0 left-0 right-0 px-2 py-1"
                style={{ backgroundColor: `${primaryColor}dd` }}
              >
                <p className="text-white text-[8px] font-semibold truncate" style={{ fontFamily }}>
                  {agentName}
                </p>
                <p className="text-[7px] truncate" style={{ fontFamily, color: accentColor }}>
                  {brokerageName}
                </p>
              </div>
              <Badge className="absolute top-1 left-1 text-[6px] py-0 px-1" variant="secondary">
                16:9
              </Badge>
            </div>
            <p className="text-xs text-center text-muted-foreground mt-1">Desktop / TV</p>
          </div>

          {/* Summary */}
          <div className="bg-muted/50 rounded-xl p-3 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Style</span>
              <span className="capitalize font-medium">{style}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Duration</span>
              <span className="font-medium">{duration}s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Format</span>
              <span className="font-medium">{format === "both" ? "16:9 + 9:16" : format}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">B-roll</span>
              <span className="font-medium">{includeBroll ? "Yes" : "No"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CustomizePage() {
  return (
    <Suspense fallback={<div className="p-8"><Skeleton className="h-96" /></div>}>
      <CustomizeContent />
    </Suspense>
  );
}
