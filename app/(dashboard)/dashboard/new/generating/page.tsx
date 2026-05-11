"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, Copy, AlertCircle, Clock } from "lucide-react";
import type { JobStatusResponse } from "@/lib/types";

const STEPS = [
  "Importing your listing photos",
  "Fetching neighborhood clips",
  "Rendering cinematic motion",
  "Assembling your video",
  "Adding your branding",
  "Mixing music",
  "Creating your 9:16 version",
  "Uploading final video",
  "Done!",
];

const STUCK_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success("Copied!"));
}

function GeneratingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId");
  const listingId = searchParams.get("listingId");

  const [status, setStatus] = useState<JobStatusResponse | null>(null);
  const [showDescriptions, setShowDescriptions] = useState(false);
  const [showStuckWarning, setShowStuckWarning] = useState(false);

  const lastProgressRef = useRef<number>(-1);
  const lastProgressTimeRef = useRef<number>(0);
  const stuckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!jobId) {
      router.push("/dashboard/new");
      return;
    }

    // Show descriptions after 15 seconds
    const descTimer = setTimeout(() => setShowDescriptions(true), 15000);

    const poll = async () => {
      try {
        const res = await fetch(`/api/job/${jobId}`);
        const data = (await res.json()) as JobStatusResponse;
        setStatus(data);

        if (data.status === "complete") {
          router.push(`/dashboard/new/done?jobId=${jobId}&listingId=${listingId}`);
          return;
        }

        if (data.status === "failed") return;

        // Stuck detection
        const currentPercent =
          (data.status === "processing" || data.status === "queued")
            ? data.progressPercent
            : 0;

        if (currentPercent !== lastProgressRef.current) {
          lastProgressRef.current = currentPercent;
          lastProgressTimeRef.current = performance.now();
          setShowStuckWarning(false);
          if (stuckTimerRef.current) clearTimeout(stuckTimerRef.current);
          stuckTimerRef.current = setTimeout(() => setShowStuckWarning(true), STUCK_THRESHOLD_MS);
        }

        pollRef.current = setTimeout(poll, 5000);
      } catch {
        pollRef.current = setTimeout(poll, 5000);
      }
    };

    poll();

    return () => {
      clearTimeout(descTimer);
      if (pollRef.current) clearTimeout(pollRef.current);
      if (stuckTimerRef.current) clearTimeout(stuckTimerRef.current);
    };
  }, [jobId, listingId, router]);

  const progressPercent =
    status?.status === "processing" || status?.status === "queued"
      ? status.progressPercent
      : 0;
  const progressStep =
    status?.status === "processing" || status?.status === "queued"
      ? status.progressStep
      : "Waiting to start...";

  if (status?.status === "failed") {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="text-center py-16">
          <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-6" />
          <h1 className="text-2xl font-bold mb-2">Generation Failed</h1>
          <p className="text-muted-foreground mb-1">
            {status.error || "Something went wrong during video generation."}
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            Your credit has been refunded automatically.
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard/new")}
            >
              Start fresh
            </Button>
            {listingId && (
              <Button
                onClick={() =>
                  router.push(`/dashboard/new/customize?listingId=${listingId}`)
                }
              >
                Try Again
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8 text-sm text-muted-foreground">
        <span className="w-6 h-6 border rounded-full flex items-center justify-center text-xs">1</span>
        <span className="opacity-50">Import</span>
        <span className="mx-2">→</span>
        <span className="w-6 h-6 border rounded-full flex items-center justify-center text-xs">2</span>
        <span className="opacity-50">Customize</span>
        <span className="mx-2">→</span>
        <span className="font-medium text-foreground bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs">3</span>
        <span className="font-medium text-foreground">Generating</span>
        <span className="mx-2">→</span>
        <span className="opacity-50 w-6 h-6 border rounded-full flex items-center justify-center text-xs">4</span>
        <span className="opacity-50">Done</span>
      </div>

      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <h1 className="text-2xl font-bold">Creating your video...</h1>
        </div>
        <p className="text-muted-foreground">Usually ready in about 2 minutes</p>
      </div>

      {/* Stuck warning */}
      {showStuckWarning && (
        <Card className="mb-6 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
                  Taking longer than usual
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">
                  Still working on it. Large photos can take a little longer.
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setShowStuckWarning(false)}
                >
                  Keep waiting
                </Button>
                {listingId && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs"
                    onClick={() =>
                      router.push(`/dashboard/new/customize?listingId=${listingId}`)
                    }
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress bar */}
      <Card className="mb-8">
        <CardContent className="pt-6 space-y-4">
          <Progress value={progressPercent} className="h-3" />
          <div className="space-y-2">
            {STEPS.map((step, i) => {
              const stepPercent = (i / (STEPS.length - 1)) * 100;
              const isComplete = progressPercent > stepPercent;
              const isCurrent = progressStep === step;
              return (
                <div
                  key={step}
                  className={`flex items-center gap-3 text-sm transition-colors ${
                    isComplete
                      ? "text-foreground"
                      : isCurrent
                      ? "text-primary font-medium"
                      : "text-muted-foreground"
                  }`}
                >
                  {isComplete ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  ) : isCurrent ? (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border shrink-0" />
                  )}
                  {step}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Descriptions appear after 15s — productive dead time */}
      {showDescriptions && listingId && <DescriptionPreview listingId={listingId} />}
    </div>
  );
}

function DescriptionPreview({ listingId }: { listingId: string }) {
  const [data, setData] = useState<{
    descriptionMls?: string;
    descriptionSocial?: string;
    descriptionLuxury?: string;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/content`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId }),
    })
      .then((r) => r.json())
      .then((d: { descriptions?: typeof data }) => {
        if (d.descriptions) setData(d.descriptions);
      })
      .catch(() => {});
  }, [listingId]);

  if (!data) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <p className="text-sm font-medium">Generating descriptions while you wait...</p>
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <p className="text-sm font-medium">Listing descriptions ready</p>
          <Badge variant="secondary" className="text-xs ml-auto">AI-generated</Badge>
        </div>
        <Tabs defaultValue="mls">
          <TabsList className="mb-4">
            <TabsTrigger value="mls">MLS</TabsTrigger>
            <TabsTrigger value="social">Social</TabsTrigger>
            <TabsTrigger value="luxury">Luxury</TabsTrigger>
          </TabsList>
          {[
            { key: "mls", text: data.descriptionMls },
            { key: "social", text: data.descriptionSocial },
            { key: "luxury", text: data.descriptionLuxury },
          ].map(({ key, text }) => (
            <TabsContent key={key} value={key}>
              <div className="relative">
                <p className="text-sm leading-relaxed pr-8">{text || "Generating..."}</p>
                {text && (
                  <button
                    onClick={() => copyToClipboard(text)}
                    className="absolute top-0 right-0 p-1"
                  >
                    <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
                  </button>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default function GeneratingPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 flex items-center justify-center">
          <Loader2 className="animate-spin" />
        </div>
      }
    >
      <GeneratingContent />
    </Suspense>
  );
}
