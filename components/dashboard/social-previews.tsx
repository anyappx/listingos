"use client";

import { Heart, MessageCircle, Share2, Music, ThumbsUp } from "lucide-react";

interface SocialPreviewsProps {
  thumbnailUrl: string;
  title: string;
  duration: number;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Shared phone frame shell */
function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative rounded-3xl border-4 border-gray-800 bg-black overflow-hidden w-44 h-80 shadow-xl flex-shrink-0">
      {/* Notch */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-4 bg-gray-800 rounded-b-xl z-20" />
      {children}
    </div>
  );
}

/** Instagram Reel card */
function InstagramPreview({ thumbnailUrl }: { thumbnailUrl: string }) {
  return (
    <PhoneFrame>
      {/* Thumbnail */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${thumbnailUrl})` }}
      />
      {/* Dark gradient overlay at bottom */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

      {/* Top bar */}
      <div className="absolute top-5 left-0 right-0 flex items-center justify-between px-3 z-10">
        <span className="text-white text-[9px] font-semibold tracking-wide">Reels</span>
        <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center">
          <span className="text-white text-[7px]">+</span>
        </div>
      </div>

      {/* Bottom UI */}
      <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 z-10 space-y-1.5">
        {/* Username */}
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-pink-500 to-yellow-400" />
          <span className="text-white text-[9px] font-semibold">@listingos</span>
          <span className="text-white/60 text-[8px] ml-auto">Follow</span>
        </div>
        {/* Caption stub */}
        <p className="text-white text-[8px] leading-tight line-clamp-2 opacity-90">
          Just listed ✨ Check this out
        </p>
        {/* Icons row */}
        <div className="flex items-center gap-3 pt-0.5">
          <Heart className="h-3.5 w-3.5 text-white" />
          <MessageCircle className="h-3.5 w-3.5 text-white" />
          <Share2 className="h-3.5 w-3.5 text-white" />
        </div>
        {/* Progress bar */}
        <div className="w-full h-0.5 bg-white/30 rounded-full mt-1">
          <div className="h-0.5 bg-white rounded-full w-1/3" />
        </div>
      </div>
    </PhoneFrame>
  );
}

/** TikTok card */
function TikTokPreview({ thumbnailUrl, title }: { thumbnailUrl: string; title: string }) {
  return (
    <PhoneFrame>
      {/* Thumbnail */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${thumbnailUrl})` }}
      />
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

      {/* Right side icon column */}
      <div className="absolute right-2 bottom-16 flex flex-col items-center gap-3 z-10">
        {/* Avatar */}
        <div className="relative mb-1">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 border-2 border-white" />
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-[#EE1D52] flex items-center justify-center">
            <span className="text-white text-[6px] font-bold">+</span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <Heart className="h-5 w-5 text-white" />
          <span className="text-white text-[8px]">12k</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <MessageCircle className="h-5 w-5 text-white" />
          <span className="text-white text-[8px]">348</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <Share2 className="h-5 w-5 text-white" />
          <span className="text-white text-[8px]">Share</span>
        </div>
        {/* Spinning disc */}
        <div className="w-6 h-6 rounded-full bg-gray-700 border-2 border-gray-600 flex items-center justify-center">
          <Music className="h-3 w-3 text-white" />
        </div>
      </div>

      {/* Bottom username + caption */}
      <div className="absolute bottom-3 left-3 right-12 z-10 space-y-0.5">
        <span className="text-white text-[9px] font-bold">@listingos</span>
        <p className="text-white text-[8px] leading-tight line-clamp-2 opacity-90">
          {title}
        </p>
        <div className="flex items-center gap-1 mt-1">
          <Music className="h-2.5 w-2.5 text-white" />
          <span className="text-white text-[7px] truncate">Original sound · listingos</span>
        </div>
      </div>
    </PhoneFrame>
  );
}

/** YouTube Short card */
function YouTubePreview({
  thumbnailUrl,
  title,
  duration,
}: {
  thumbnailUrl: string;
  title: string;
  duration: number;
}) {
  return (
    <PhoneFrame>
      {/* Thumbnail */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${thumbnailUrl})` }}
      />
      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30" />

      {/* Top bar with Shorts logo */}
      <div className="absolute top-5 left-3 z-10 flex items-center gap-1">
        <div className="w-3 h-3 rounded-sm bg-[#FF0000] flex items-center justify-center">
          <Play className="h-2 w-2 text-white fill-white" />
        </div>
        <span className="text-white text-[9px] font-bold">Shorts</span>
      </div>

      {/* Duration badge */}
      <div className="absolute top-5 right-3 z-10">
        <span className="text-white text-[8px] bg-black/60 rounded px-1 py-0.5 tabular-nums">
          {formatDuration(duration)}
        </span>
      </div>

      {/* Right side icons */}
      <div className="absolute right-2 bottom-20 flex flex-col items-center gap-3 z-10">
        <div className="flex flex-col items-center gap-0.5">
          <ThumbsUp className="h-5 w-5 text-white" />
          <span className="text-white text-[8px]">4.2k</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <MessageCircle className="h-5 w-5 text-white" />
          <span className="text-white text-[8px]">92</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <Share2 className="h-5 w-5 text-white" />
          <span className="text-white text-[8px]">Share</span>
        </div>
      </div>

      {/* Bottom: title + subscribe */}
      <div className="absolute bottom-3 left-3 right-12 z-10 space-y-1">
        <p className="text-white text-[8px] font-semibold leading-tight line-clamp-2">
          {title}
        </p>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-[#FF0000] flex items-center justify-center">
            <Play className="h-2 w-2 text-white fill-white" />
          </div>
          <span className="text-white text-[8px]">ListingOS</span>
          <button className="ml-auto text-white text-[7px] font-bold bg-white/20 rounded px-1.5 py-0.5 hover:bg-white/30 transition-colors">
            Subscribe
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20 z-10">
        <div className="h-0.5 bg-[#FF0000] w-2/5" />
      </div>
    </PhoneFrame>
  );
}

/** Dummy Play icon used internally */
function Play({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
    >
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

export function SocialPreviews({ thumbnailUrl, title, duration }: SocialPreviewsProps) {
  return (
    <div className="w-full overflow-x-auto">
      <div className="flex flex-row flex-wrap gap-6 justify-start min-w-0">
        {/* Instagram Reel */}
        <div className="flex flex-col items-center gap-2">
          <InstagramPreview thumbnailUrl={thumbnailUrl} />
          <span className="text-xs text-muted-foreground font-medium">Instagram Reel</span>
        </div>

        {/* TikTok */}
        <div className="flex flex-col items-center gap-2">
          <TikTokPreview thumbnailUrl={thumbnailUrl} title={title} />
          <span className="text-xs text-muted-foreground font-medium">TikTok</span>
        </div>

        {/* YouTube Short */}
        <div className="flex flex-col items-center gap-2">
          <YouTubePreview thumbnailUrl={thumbnailUrl} title={title} duration={duration} />
          <span className="text-xs text-muted-foreground font-medium">YouTube Short</span>
        </div>
      </div>
    </div>
  );
}
