import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Video, Eye, Users, Plus, TrendingUp } from "lucide-react";
import type { Listing, User } from "@/lib/types";

const planLimits: Record<string, number> = { trial: 1, solo: 3, agent: 10 };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const [{ data: userData }, { data: listings }, { data: videos }] = await Promise.all([
    supabase.from("users").select("*").eq("id", authUser.id).single(),
    supabase
      .from("listings")
      .select("id, address, city, price, photos, slug, view_count, lead_count, created_at")
      .eq("user_id", authUser.id)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("videos")
      .select("id, listing_id, thumbnail_url, created_at")
      .eq("user_id", authUser.id)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const user = userData as User | null;
  const plan = user?.plan || "trial";
  const used = user?.listings_used_this_month || 0;
  const limit = planLimits[plan] || 1;
  const usagePercent = Math.min((used / limit) * 100, 100);

  const totalViews = (listings || []).reduce((sum, l) => sum + (l.view_count || 0), 0);
  const totalLeads = (listings || []).reduce((sum, l) => sum + (l.lead_count || 0), 0);

  const videoMap = new Map((videos || []).map((v) => [v.listing_id, v]));

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Welcome back{user?.full_name ? `, ${user.full_name}` : ""}
          </p>
        </div>
        <Link href="/dashboard/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Video
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Video className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Videos this month</p>
                <p className="text-2xl font-bold">{used}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Eye className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total listing views</p>
                <p className="text-2xl font-bold">{totalViews}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Users className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Leads captured</p>
                <p className="text-2xl font-bold">{totalLeads}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Monthly usage</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {used} / {limit} listings
              </span>
              <Badge variant={plan === "trial" ? "secondary" : "default"} className="text-xs capitalize">
                {plan}
              </Badge>
            </div>
          </div>
          <Progress value={usagePercent} className="h-2" />
          {plan === "trial" && (
            <p className="text-xs text-muted-foreground mt-2">
              Upgrade to generate more videos.{" "}
              <Link href="/dashboard/account" className="text-primary hover:underline">
                View plans →
              </Link>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recent listings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent listings</CardTitle>
          <Link href="/dashboard/listings">
            <Button variant="ghost" size="sm" className="text-xs">
              View all →
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {!listings || listings.length === 0 ? (
            <div className="text-center py-12">
              <Video className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">No videos yet. Create your first one!</p>
              <Link href="/dashboard/new">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create first video
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {listings.map((listing: Partial<Listing>) => {
                const video = videoMap.get(listing.id || "");
                const photos = (listing.photos as { url: string }[]) || [];
                const thumbUrl = video?.thumbnail_url || photos[0]?.url;
                return (
                  <Link
                    key={listing.id}
                    href={`/dashboard/listings/${listing.id}`}
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-16 h-10 rounded bg-muted overflow-hidden shrink-0">
                      {thumbUrl ? (
                        <Image
                          src={thumbUrl}
                          alt={listing.address || "Listing"}
                          width={64}
                          height={40}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Video className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {listing.address || "Untitled listing"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {listing.city} · {listing.price ? `$${listing.price.toLocaleString()}` : "—"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">
                        {listing.view_count || 0} views
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
