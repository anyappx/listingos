"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, Play, Clock, ArrowLeft, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { MusicTrack, VideoStyle, BrandKit } from "@/lib/types";

// ── Constants ─────────────────────────────────────────────────────────────────

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

const HEADLINE_OPTIONS = [
  "JUST LISTED",
  "OPEN HOUSE",
  "COMING SOON",
  "PRICE REDUCED",
  "JUST SOLD",
  "BACK ON MARKET",
  "NEW CONSTRUCTION",
  "FOR RENT",
  "Custom",
] as const;

const VIDEO_FORMATS = ["16:9", "9:16", "1:1", "4:5"] as const;
type VideoFormatOption = (typeof VIDEO_FORMATS)[number];

const GENRE_FILTERS = ["All", "Modern", "Luxury", "Upbeat", "Calm", "Bold"] as const;
type GenreFilter = (typeof GENRE_FILTERS)[number];

// ── Main Component ─────────────────────────────────────────────────────────────

function CustomizeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const listingId = searchParams.get("listingId");
  const supabase = createClient();

  // Existing state
  const [style, setStyle] = useState<VideoStyle>("modern");
  const [duration, setDuration] = useState(30);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [includeBroll, setIncludeBroll] = useState(true);
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  // LOS-032: Headline state
  const [headline, setHeadline] = useState<string>("JUST LISTED");
  const [customHeadline, setCustomHeadline] = useState<string>("");

  // LOS-033: Format + Version state (default: 16:9 + 9:16 checked, Branded checked)
  const [selectedFormats, setSelectedFormats] = useState<VideoFormatOption[]>(["16:9", "9:16"]);
  const [includeClean, setIncludeClean] = useState(false);

  // LOS-034: Music genre filter + volume
  const [genreFilter, setGenreFilter] = useState<GenreFilter>("All");
  const [musicVolume, setMusicVolume] = useState(50);

  useEffect(() => {
    if (!listingId) { router.push("/dashboard/new"); return; }

    async function load() {
      const [tracksRes, brandRes] = await Promise.all([
        supabase.from("music_tracks").select("*").order("display_order"),
        fetch("/api/brand"),
      ]);
      const { data: trackData } = tracksRes;
      const { brandKit: kit } = await brandRes.json() as { brandKit: BrandKit | null };

      const loaded = (trackData as MusicTrack[]) || [];
      setTracks(loaded);
      if (loaded.length > 0) setSelectedTrackId(loaded[0].id);
      setBrandKit(kit);
      setLoading(false);
    }
    load();
  }, [listingId, router, supabase]);

  // Derived: filtered tracks by genre
  const filteredTracks = genreFilter === "All"
    ? tracks
    : tracks.filter((t) => t.genre.toLowerCase() === genreFilter.toLowerCase());

  // LOS-033: disable generate if no format or no version selected
  const noFormatSelected = selectedFormats.length === 0;
  const generateDisabled = generating || !selectedTrackId || noFormatSelected;

  // Format toggle helper
  function toggleFormat(fmt: VideoFormatOption) {
    setSelectedFormats((prev) =>
      prev.includes(fmt) ? prev.filter((f) => f !== fmt) : [...prev, fmt]
    );
  }

  async function handleGenerate() {
    if (!listingId || !selectedTrackId) return;
    setGenerating(true);
    try {
      const effectiveHeadline = headline === "Custom" ? customHeadline : headline;
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId,
          style,
          durationSeconds: duration,
          formats: selectedFormats,
          includeClean,
          musicTrackId: selectedTrackId,
          includeNeighborhoodBroll: includeBroll,
          headline: effectiveHeadline,
          customHeadline,
          musicVolume,
        }),
      });
      const data = await res.json() as { jobId?: string; error?: string };
      if (!res.ok) {
        if (res.status === 402) {
          toast.error("No credits remaining. Upgrade your plan.");
          router.push("/dashboard/account");
          return;
        }
        throw new Error(data.error ?? "Generation failed");
      }
      router.push(`/dashboard/new/generating?jobId=${data.jobId}&listingId=${listingId}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to start generation");
      setGenerating(false);
    }
  }

  const agentName = brandKit?.agent_name ?? "Agent Name";
  const brokerageName = brandKit?.brokerage ?? "Brokerage";
  const primaryColor = brandKit?.primary_color ?? "#1A2E4A";
  const accentColor = brandKit?.accent_color ?? "#F5A623";
  const fontFamily = brandKit?.font ?? "Inter";

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

          {/* ── LOS-032: Headline Picker ── */}
          <div>
            <h3 className="font-semibold mb-3">Headline</h3>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {HEADLINE_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => setHeadline(option)}
                  className={`p-2.5 rounded-xl border-2 text-center text-xs font-medium transition-all ${
                    headline === option
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            {headline === "Custom" && (
              <div className="mt-3">
                <Input
                  placeholder="Enter custom headline…"
                  value={customHeadline}
                  onChange={(e) => setCustomHeadline(e.target.value)}
                  maxLength={60}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">{customHeadline.length}/60 characters</p>
              </div>
            )}
          </div>

          <Separator />

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

          {/* ── LOS-033: Output Format Selector ── */}
          <div>
            <h3 className="font-semibold mb-3">Output Format</h3>
            <div className="grid grid-cols-2 gap-6">
              {/* Format checkboxes */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Format</p>
                <div className="space-y-2">
                  {VIDEO_FORMATS.map((fmt) => {
                    const checked = selectedFormats.includes(fmt);
                    return (
                      <label
                        key={fmt}
                        className="flex items-center gap-2.5 cursor-pointer select-none"
                      >
                        {/* Custom checkbox using Tailwind */}
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={checked}
                          onClick={() => toggleFormat(fmt)}
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                            checked
                              ? "bg-primary border-primary"
                              : "border-border hover:border-primary/60"
                          }`}
                        >
                          {checked && (
                            <svg
                              className="w-2.5 h-2.5 text-primary-foreground"
                              fill="none"
                              viewBox="0 0 10 10"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path d="M1.5 5l2.5 2.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </button>
                        <span className="text-sm font-medium">{fmt}</span>
                      </label>
                    );
                  })}
                </div>
                {noFormatSelected && (
                  <p className="text-xs text-destructive mt-1.5">Select at least one format.</p>
                )}
              </div>

              {/* Version checkboxes */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Version</p>
                <div className="space-y-2">
                  {/* Branded — always on (can be toggled off only if clean is on) */}
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={true}
                      disabled
                      className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 bg-primary border-primary opacity-70 cursor-not-allowed"
                    >
                      <svg
                        className="w-2.5 h-2.5 text-primary-foreground"
                        fill="none"
                        viewBox="0 0 10 10"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path d="M1.5 5l2.5 2.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <span className="text-sm font-medium">Branded</span>
                    <span className="text-xs text-muted-foreground">(with overlays)</span>
                  </label>

                  {/* Clean */}
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={includeClean}
                      onClick={() => setIncludeClean((v) => !v)}
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        includeClean
                          ? "bg-primary border-primary"
                          : "border-border hover:border-primary/60"
                      }`}
                    >
                      {includeClean && (
                        <svg
                          className="w-2.5 h-2.5 text-primary-foreground"
                          fill="none"
                          viewBox="0 0 10 10"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path d="M1.5 5l2.5 2.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                    <span className="text-sm font-medium">Clean</span>
                    <span className="text-xs text-muted-foreground">(MLS-safe, no branding)</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* ── LOS-034: Music with genre filter + BPM + volume ── */}
          <div>
            <h3 className="font-semibold mb-3">Music</h3>

            {/* Genre filter tabs */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {GENRE_FILTERS.map((g) => (
                <button
                  key={g}
                  onClick={() => setGenreFilter(g)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                    genreFilter === g
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>

            {/* Track list */}
            {filteredTracks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No tracks in this genre.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                {filteredTracks.map((track) => (
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
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge variant="secondary" className="text-xs capitalize">{track.genre}</Badge>
                      {track.bpm !== null && (
                        <span className="text-xs text-muted-foreground">{track.bpm} BPM</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Volume slider */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground font-medium">Music Volume</span>
                <span className="text-xs font-semibold tabular-nums">{musicVolume}%</span>
              </div>
              {/* Native range slider styled with Tailwind */}
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={musicVolume}
                onChange={(e) => setMusicVolume(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none bg-muted cursor-pointer accent-primary"
              />
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
              disabled={generateDisabled}
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
                {/* Headline badge in preview */}
                {headline && headline !== "Custom" && (
                  <div
                    className="absolute top-3 left-2 right-2 flex justify-center"
                  >
                    <span
                      className="text-[5px] font-bold px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: accentColor, color: "#fff" }}
                    >
                      {headline}
                    </span>
                  </div>
                )}
                {headline === "Custom" && customHeadline && (
                  <div className="absolute top-3 left-2 right-2 flex justify-center">
                    <span
                      className="text-[5px] font-bold px-1.5 py-0.5 rounded truncate max-w-full"
                      style={{ backgroundColor: accentColor, color: "#fff" }}
                    >
                      {customHeadline}
                    </span>
                  </div>
                )}
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
              <span className="text-muted-foreground">Headline</span>
              <span className="font-medium truncate max-w-[100px] text-right">
                {headline === "Custom" ? (customHeadline || "—") : headline}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Style</span>
              <span className="capitalize font-medium">{style}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Duration</span>
              <span className="font-medium">{duration}s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Formats</span>
              <span className="font-medium">{selectedFormats.length > 0 ? selectedFormats.join(" + ") : "None"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Version</span>
              <span className="font-medium">{includeClean ? "Branded + Clean" : "Branded"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Volume</span>
              <span className="font-medium">{musicVolume}%</span>
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
