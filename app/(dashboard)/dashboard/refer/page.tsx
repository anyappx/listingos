"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Copy, Gift, Users } from "lucide-react";

interface ReferralData {
  referralCode: string | null;
  referredUsers: {
    id: string;
    full_name: string | null;
    email: string;
    plan: string;
    created_at: string;
  }[];
  creditsEarned: number;
}

export default function ReferPage() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const appUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "";

  useEffect(() => {
    fetch("/api/refer")
      .then((r) => r.json())
      .then((d: ReferralData & { error?: string }) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8 max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => window.location.reload()} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const referralLink = data?.referralCode
    ? `${appUrl}/signup?ref=${data.referralCode}`
    : null;

  async function copyLink() {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      toast.success("Referral link copied!");
    } catch {
      toast.error("Failed to copy");
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Refer &amp; Earn</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Invite other agents. Earn a free listing credit for every paid referral.
        </p>
      </div>

      {/* Referral link card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="w-4 h-4" />
            Your Referral Link
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {referralLink ? (
            <>
              <div className="bg-muted/50 rounded-lg p-3 font-mono text-sm break-all">
                {referralLink}
              </div>
              <Button onClick={copyLink} className="w-full sm:w-auto">
                <Copy className="w-4 h-4 mr-2" />
                Copy referral link
              </Button>
              <p className="text-xs text-muted-foreground">
                Share this link with other real estate agents. When they upgrade to a paid plan, you
                earn one free listing credit.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No referral code set up yet. Contact support to get yours.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold">{data?.referredUsers.length ?? 0}</p>
            <p className="text-sm text-muted-foreground mt-1">Agents referred</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-green-600">{data?.creditsEarned ?? 0}</p>
            <p className="text-sm text-muted-foreground mt-1">Credits earned</p>
          </CardContent>
        </Card>
      </div>

      {/* Referred agents table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            Referred Agents
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data?.referredUsers.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No referrals yet. Share your link to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {data.referredUsers.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">{u.full_name || u.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Joined {new Date(u.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={u.plan === "trial" ? "secondary" : "default"}>
                    {u.plan}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
