"use client";

import { useState } from "react";
import Link from "next/link";
import { X, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BrandKit } from "@/lib/types";

const DISMISSED_KEY = "listingos_onboarding_dismissed";

interface OnboardingBannerProps {
  brandKit: BrandKit | null;
}

export function OnboardingBanner({ brandKit }: OnboardingBannerProps) {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(DISMISSED_KEY) === "true";
  });

  const hasLogo = !!brandKit?.logo_url;
  const hasName = !!brandKit?.agent_name;
  const hasPhone = !!brandKit?.phone;

  const steps = [
    { label: "Upload your logo", done: hasLogo, href: "/dashboard/brand" },
    { label: "Add your agent name", done: hasName, href: "/dashboard/brand" },
    { label: "Add your phone number", done: hasPhone, href: "/dashboard/brand" },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;

  // Hide if all done or dismissed
  if (allDone || dismissed) return null;

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  }

  return (
    <div className="mx-4 mt-4 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold">Setup your brand kit</span>
            <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
              {completedCount}/3 complete
            </span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            {steps.map((step) => (
              <Link
                key={step.label}
                href={step.href}
                className="flex items-center gap-1.5 text-xs hover:underline"
              >
                {step.done ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                <span className={step.done ? "text-muted-foreground line-through" : ""}>
                  {step.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleDismiss} className="h-7 w-7 p-0 shrink-0">
          <X className="h-3.5 w-3.5" />
          <span className="sr-only">Dismiss</span>
        </Button>
      </div>
    </div>
  );
}
