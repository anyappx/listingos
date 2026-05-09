import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Video, Plus, Eye, Users } from "lucide-react";
import type { Listing } from "@/lib/types";

export default async function ListingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: listings } = await supabase
    .from("listings")
    .select("id, address, city, price, beds, baths, photos, slug, view_count, lead_count, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const { data: videoJobs } = await supabase
    .from("video_jobs")
    .select("listing_id, status")
    .eq("user_id", user.id);

  const { data: videos } = await supabase
    .from("videos")
    .select("listing_id, thumbnail_url")
    .eq("user_id", user.id);

  const jobStatusMap = new Map(
    (videoJobs || []).map((j) => [j.listing_id as string, j.status as string])
  );
  // Normalize thumbnail URLs to relative paths so they work regardless of port
  const toRelative = (url: string) => {
    try { return new URL(url).pathname; } catch { return url; }
  };
  const thumbnailMap = new Map(
    (videos || []).map((v) => [v.listing_id as string, toRelative(v.thumbnail_url as string)])
  );

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">My Listings</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {listings?.length || 0} listing{(listings?.length || 0) !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/dashboard/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Video
          </Button>
        </Link>
      </div>

      {!listings || listings.length === 0 ? (
        <div className="text-center py-20">
          <Video className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">No listings yet</h2>
          <p className="text-muted-foreground mb-6">Create your first video to get started.</p>
          <Link href="/dashboard/new">
            <Button size="lg">
              <Plus className="w-4 h-4 mr-2" />
              Create first video
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map((listing: Partial<Listing>) => {
            const photos = (listing.photos as { url: string }[]) || [];
            const thumbUrl = thumbnailMap.get(listing.id!) || photos[0]?.url;
            const jobStatus = jobStatusMap.get(listing.id!);

            return (
              <Link key={listing.id} href={`/dashboard/listings/${listing.id}`}>
                <Card className="hover:shadow-md transition-shadow overflow-hidden cursor-pointer group">
                  {/* Thumbnail */}
                  <div className="aspect-video bg-muted relative">
                    {thumbUrl ? (
                      <Image
                        src={thumbUrl}
                        alt={listing.address || "Listing"}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    {/* Status badge */}
                    {jobStatus && (
                      <div className="absolute top-2 right-2">
                        <Badge
                          variant={
                            jobStatus === "complete" ? "default" :
                            jobStatus === "failed" ? "destructive" : "secondary"
                          }
                          className="text-xs capitalize"
                        >
                          {jobStatus === "complete" ? "Video ready" :
                           jobStatus === "processing" || jobStatus === "queued" ? "Generating..." :
                           "Failed"}
                        </Badge>
                      </div>
                    )}
                    {/* Photo count */}
                    <div className="absolute bottom-2 left-2">
                      <Badge variant="secondary" className="text-xs">
                        {photos.length} photos
                      </Badge>
                    </div>
                  </div>

                  <CardContent className="p-4">
                    <p className="font-medium text-sm truncate">
                      {listing.address || "Untitled listing"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {listing.city}
                      {listing.price ? ` · $${listing.price.toLocaleString()}` : ""}
                    </p>
                    {(listing.beds || listing.baths) && (
                      <p className="text-xs text-muted-foreground">
                        {listing.beds ? `${listing.beds} bd` : ""} {listing.baths ? `· ${listing.baths} ba` : ""}
                      </p>
                    )}
                    <div className="flex gap-3 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {listing.view_count || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {listing.lead_count || 0} leads
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
