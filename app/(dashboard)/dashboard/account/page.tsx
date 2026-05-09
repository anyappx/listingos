"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Crown, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@/lib/types";

const PLAN_LIMITS = { trial: 1, solo: 3, agent: 10 };
const PLAN_PRICES = { trial: 0, solo: 29, agent: 79 };
const PLAN_ICONS = { trial: Zap, solo: Zap, agent: Crown };

function AccountPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [dbUser, setDbUser] = useState<User | null>(null);
  const [authUser, setAuthUser] = useState<{ email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [fullName, setFullName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    setAuthUser({ email: user.email! });

    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    if (data) {
      setDbUser(data as User);
      setFullName(data.full_name || "");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (searchParams.get("upgraded") === "1") {
      toast.success("Plan upgraded successfully!");
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUpgrade(plan: "solo" | "agent") {
    setUpgrading(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else throw new Error("No checkout URL");
    } catch {
      toast.error("Failed to start checkout");
      setUpgrading(null);
    }
  }

  async function handlePortal() {
    setOpeningPortal(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else throw new Error("No portal URL");
    } catch {
      toast.error("Failed to open billing portal");
      setOpeningPortal(false);
    }
  }

  async function handleSaveProfile() {
    setSavingProfile(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from("users")
        .update({ full_name: fullName })
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Profile saved");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSavingProfile(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 max-w-2xl mx-auto flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!dbUser) return null;

  const plan = dbUser.plan || "trial";
  const limit = PLAN_LIMITS[plan];
  const used = dbUser.listings_used_this_month || 0;
  const usagePct = Math.min(100, (used / limit) * 100);
  const PlanIcon = PLAN_ICONS[plan];

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Account</h1>
        <p className="text-muted-foreground text-sm mt-1">{authUser?.email}</p>
      </div>

      {/* Current plan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PlanIcon className="w-4 h-4" />
            Current Plan
            <Badge variant={plan === "trial" ? "secondary" : "default"} className="capitalize">
              {plan}
            </Badge>
            {dbUser.subscription_status === "past_due" && (
              <Badge variant="destructive">Payment overdue</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Listings used this month</span>
              <span className="font-medium">{used} / {limit}</span>
            </div>
            <Progress value={usagePct} className="h-2" />
          </div>

          {plan !== "trial" && (
            <Button variant="outline" size="sm" onClick={handlePortal} disabled={openingPortal}>
              {openingPortal && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Manage Billing
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Upgrade cards */}
      {plan === "trial" && (
        <div>
          <h2 className="font-semibold mb-3">Upgrade Your Plan</h2>
          <div className="grid grid-cols-2 gap-4">
            {(["solo", "agent"] as const).map((planKey) => (
              <Card key={planKey} className={planKey === "agent" ? "border-primary" : ""}>
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-center gap-2">
                    {planKey === "agent" ? <Crown className="w-5 h-5 text-primary" /> : <Zap className="w-5 h-5" />}
                    <span className="font-semibold capitalize">{planKey}</span>
                  </div>
                  <p className="text-2xl font-bold">${PLAN_PRICES[planKey]}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>✓ {PLAN_LIMITS[planKey]} listings/month</li>
                    <li>✓ 16:9 + 9:16 formats</li>
                    <li>✓ Full brand kit</li>
                    {planKey === "agent" && <li>✓ Remove &quot;Powered by ListingOS&quot;</li>}
                  </ul>
                  <Button
                    className="w-full"
                    variant={planKey === "agent" ? "default" : "outline"}
                    onClick={() => handleUpgrade(planKey)}
                    disabled={upgrading !== null}
                  >
                    {upgrading === planKey && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Upgrade to {planKey}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* Profile */}
      <Card>
        <CardHeader><CardTitle className="text-base">Profile</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Full name</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input value={authUser?.email || ""} disabled className="bg-muted" />
          </div>
          <Button onClick={handleSaveProfile} disabled={savingProfile} size="sm">
            {savingProfile && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save profile
          </Button>
        </CardContent>
      </Card>

      {/* Sign out */}
      <Button
        variant="outline"
        className="w-full text-destructive hover:text-destructive"
        onClick={async () => {
          await createClient().auth.signOut();
          router.push("/login");
        }}
      >
        Sign out
      </Button>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense>
      <AccountPageContent />
    </Suspense>
  );
}
