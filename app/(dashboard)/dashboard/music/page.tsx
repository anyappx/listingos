"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Pause, Heart, Music2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { MusicTrack } from "@/lib/types";

const GENRE_LABELS: Record<string, string> = {
  all: "All",
  modern: "Modern",
  luxury: "Luxury",
  upbeat: "Upbeat",
  calm: "Calm",
  bold: "Bold",
};

export default function MusicPage() {
  const supabase = createClient();
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGenre, setActiveGenre] = useState("all");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("music_favorites");
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      try { setFavorites(new Set(JSON.parse(stored))); } catch {}
    }
  }, []);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("music_tracks")
        .select("*")
        .order("display_order");
      setTracks((data as MusicTrack[]) || []);
      setLoading(false);
    }
    load();
  }, [supabase]);

  function togglePlay(track: MusicTrack) {
    if (playingId === track.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(track.file_path);
      audio.volume = 0.5;
      audio.play();
      audio.onended = () => setPlayingId(null);
      audioRef.current = audio;
      setPlayingId(track.id);
    }
  }

  function toggleFavorite(id: string) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem("music_favorites", JSON.stringify([...next]));
      return next;
    });
  }

  const filtered = activeGenre === "all"
    ? tracks
    : tracks.filter((t) => t.genre === activeGenre);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Music Library</h1>
        <p className="text-muted-foreground text-sm mt-1">
          20 pre-cleared tracks for commercial use. Previews at 30s.
        </p>
      </div>

      {/* Genre tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {Object.entries(GENRE_LABELS).map(([genre, label]) => (
          <Button
            key={genre}
            variant={activeGenre === genre ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveGenre(genre)}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Track list */}
      <div className="space-y-2">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))
          : filtered.map((track) => (
              <Card
                key={track.id}
                className={`transition-colors ${playingId === track.id ? "border-primary bg-primary/5" : ""}`}
              >
                <CardContent className="flex items-center gap-4 py-3 px-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-9 w-9 rounded-full"
                    onClick={() => togglePlay(track)}
                  >
                    {playingId === track.id ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{track.name}</p>
                      {playingId === track.id && (
                        <span className="flex gap-0.5">
                          {[1, 2, 3].map((i) => (
                            <span
                              key={i}
                              className="w-0.5 bg-primary rounded-full animate-bounce"
                              style={{ height: `${8 + i * 4}px`, animationDelay: `${i * 0.1}s` }}
                            />
                          ))}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-xs capitalize">{track.genre}</Badge>
                      {track.bpm && <span className="text-xs text-muted-foreground">{track.bpm} BPM</span>}
                      <span className="text-xs text-muted-foreground">{track.duration_seconds}s</span>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => toggleFavorite(track.id)}
                  >
                    <Heart
                      className={`w-4 h-4 transition-colors ${
                        favorites.has(track.id) ? "fill-red-500 text-red-500" : "text-muted-foreground"
                      }`}
                    />
                  </Button>
                </CardContent>
              </Card>
            ))}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Music2 className="w-10 h-10 mx-auto mb-3" />
            <p>No tracks in this genre</p>
          </div>
        )}
      </div>
    </div>
  );
}
