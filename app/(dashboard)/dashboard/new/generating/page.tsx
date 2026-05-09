"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, Copy, AlertCircle } from "lucide-react";
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

  useEffect(() => {
    if (!jobId) {
      router.push("/dashboard/new");
      return;
    }

    // Show descriptions after 15 seconds (productive dead time)
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

        if (data.status === "failed") {
          toast.error(data.error || "Video generation failed. Credit refunded.");
          return;
        }

        // Continue polling
        setTimeout(poll, 5000);
      } catch {
        setTimeout(poll, 5000);
      }
    };

    poll();
    return () => clearTimeout(descTimer);
  }, [jobId, listingId, router]);

  const progressPercent = status?.status === "processing" || status?.status === "queued"
    ? status.progressPercent
    : 0;
  const progressStep = status?.status === "processing" || status?.status === "queued"
    ? status.progressStep
    : "Waiting to start...";

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
        {status?.status === "failed" ? (
          <div className="flex flex-col items-center">
            <AlertCircle className="w-12 h-12 text-destructive mb-4" />
            <h1 className="text-2xl font-bold mb-2">Generation Failed</h1>
            <p className="text-muted-foreground mb-4">Your credit has been refunded.</p>
            <Button onClick={() => router.push("/dashboard/new")}>Try Again</Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center gap-3 mb-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <h1 className="text-2xl font-bold">Creating your video...</h1>
            </div>
            <p className="text-muted-foreground">
              Usually ready in about 2 minutes...
            </p>
          </>
        )}
      </div>

      {/* Progress bar */}
      {status?.status !== "failed" && (
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
      )}

      {/* Descriptions appear after 15s — productive wait */}
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
    // Try to generate content if not already done
    fetch(`/api/content`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId }),
    })
      .then((r) => r.json())
      .then((d) => {
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
            { key: "mls", label: "MLS", text: data.descriptionMls },
            { key: "social", label: "Social", text: data.descriptionSocial },
            { key: "luxury", label: "Luxury", text: data.descriptionLuxury },
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
    <Suspense fallback={<div className="p-8 flex items-center justify-center"><Loader2 className="animate-spin" /></div>}>
      <GeneratingContent />
    </Suspense>
  );
}
