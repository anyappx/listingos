import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { getNeighborhoodData } from "@/lib/places";
import { getSignedVideoUrl } from "@/lib/r2";
import { LeadCaptureForm } from "./lead-capture-form";
import { ViewTracker } from "./view-tracker";
import { Separator } from "@/components/ui/separator";
import { Phone, Building, MapPin, Bed, Bath, Square } from "lucide-react";
import type { Listing, Video as VideoType, BrandKit, User } from "@/lib/types";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createAdminClient();
  const { data: listing } = await supabase
    .from("listings")
    .select("address, city, price, description_mls")
    .eq("slug", slug)
    .single();

  if (!listing) return { title: "Listing Not Found" };

  return {
    title: `${listing.address} — ${listing.city}`,
    description: listing.description_mls || `${listing.address}, ${listing.city}`,
  };
}

export default async function PublicListingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createAdminClient();

  const { data: listing } = await supabase
    .from("listings")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!listing) notFound();

  const typedListing = listing as Listing;

  // Fetch agent info + video + brand kit in parallel
  const [{ data: agentUser }, { data: video }, { data: brandKit }] = await Promise.all([
    supabase.from("users").select("id, full_name, plan").eq("id", typedListing.user_id).single(),
    supabase.from("videos").select("*").eq("listing_id", typedListing.id).order("created_at", { ascending: false }).limit(1).single(),
    supabase.from("brand_kits").select("*").eq("user_id", typedListing.user_id).single(),
  ]);

  const typedUser = agentUser as User | null;
  const typedBrandKit = brandKit as BrandKit | null;
  const typedVideo = video as VideoType | null;

  // Get signed video URL if exists
  let videoUrl: string | null = null;
  if (typedVideo?.url_16x9) {
    try { videoUrl = await getSignedVideoUrl(typedVideo.url_16x9); } catch {}
  }

  // Neighborhood data (non-blocking)
  const neighborhoodData = typedListing.city
    ? await getNeighborhoodData(typedListing.city).catch(() => ({ nearbyPlaces: [] }))
    : { nearbyPlaces: [] };

  const isPaidPlan = typedUser?.plan !== "trial";
  const agentName = typedBrandKit?.agent_name || typedUser?.full_name || "Agent";
  const brokerage = typedBrandKit?.brokerage || "";
  const phone = typedBrandKit?.phone || "";
  const headshotUrl = typedBrandKit?.headshot_url || null;
  const primaryColor = typedBrandKit?.primary_color || "#1A2E4A";
  const photos = typedListing.photos || [];

  return (
    <div className="min-h-screen bg-background">
      {/* View tracker */}
      <ViewTracker listingId={typedListing.id} />

      {/* Agent header */}
      <header className="border-b" style={{ borderTopColor: primaryColor, borderTopWidth: 3 }}>
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {headshotUrl ? (
              <div className="w-12 h-12 rounded-full overflow-hidden">
                <Image src={headshotUrl} alt={agentName} width={48} height={48} className="object-cover" />
              </div>
            ) : (
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: primaryColor }}
              >
                {agentName.charAt(0)}
              </div>
            )}
            <div>
              <p className="font-semibold">{agentName}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {brokerage && (
                  <span className="flex items-center gap-1">
                    <Building className="w-3 h-3" />
                    {brokerage}
                  </span>
                )}
              </div>
            </div>
          </div>
          {phone && (
            <a
              href={`tel:${phone}`}
              className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
            >
              <Phone className="w-4 h-4" />
              {phone}
            </a>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Video */}
        {videoUrl && (
          <div className="rounded-2xl overflow-hidden bg-black aspect-video mb-8 shadow-xl">
            <video
              src={videoUrl}
              autoPlay
              muted
              loop
              controls
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="grid grid-cols-3 gap-8">
          {/* Left: property details */}
          <div className="col-span-2 space-y-6">
            {/* Address + price */}
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold">{typedListing.address}</h1>
                  <p className="text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="w-4 h-4" />
                    {[typedListing.city, typedListing.state, typedListing.zip].filter(Boolean).join(", ")}
                  </p>
                </div>
                {typedListing.price && (
                  <p className="text-2xl font-bold">${typedListing.price.toLocaleString()}</p>
                )}
              </div>

              <div className="flex gap-4 mt-4">
                {typedListing.beds && (
                  <div className="flex items-center gap-1 text-sm">
                    <Bed className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{typedListing.beds}</span>
                    <span className="text-muted-foreground">beds</span>
                  </div>
                )}
                {typedListing.baths && (
                  <div className="flex items-center gap-1 text-sm">
                    <Bath className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{typedListing.baths}</span>
                    <span className="text-muted-foreground">baths</span>
                  </div>
                )}
                {typedListing.sqft && (
                  <div className="flex items-center gap-1 text-sm">
                    <Square className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{typedListing.sqft.toLocaleString()}</span>
                    <span className="text-muted-foreground">sqft</span>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            {typedListing.description_mls && (
              <div>
                <h2 className="font-semibold mb-2">About this home</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {typedListing.description_mls}
                </p>
              </div>
            )}

            <Separator />

            {/* Photo gallery */}
            {photos.length > 1 && (
              <div>
                <h2 className="font-semibold mb-3">Photos</h2>
                <div className="grid grid-cols-3 gap-2">
                  {photos.slice(0, 9).map((photo, i) => (
                    <div key={i} className="aspect-video rounded-lg overflow-hidden bg-muted">
                      <Image
                        src={photo.url}
                        alt={`Photo ${i + 1}`}
                        width={300}
                        height={200}
                        className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Neighborhood */}
            {neighborhoodData.nearbyPlaces.length > 0 && (
              <>
                <Separator />
                <div>
                  <h2 className="font-semibold mb-3">Neighborhood</h2>
                  <div className="grid grid-cols-2 gap-2">
                    {neighborhoodData.nearbyPlaces.map((place, i) => (
                      <div key={i} className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                        <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{place.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{place.type}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right: lead capture */}
          <div>
            <LeadCaptureForm
              listingId={typedListing.id}
              agentName={agentName}
              primaryColor={primaryColor}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      {!isPaidPlan && (
        <footer className="border-t mt-16 py-6">
          <p className="text-center text-xs text-muted-foreground">
            Powered by{" "}
            <Link href="/" className="hover:text-foreground font-medium">
              ListingOS
            </Link>
          </p>
        </footer>
      )}
    </div>
  );
}
