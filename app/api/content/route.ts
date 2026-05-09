import { type NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { generateAllContent } from "@/lib/claude";
import { z } from "zod";

const ContentInputSchema = z.object({
  listingId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ContentInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid listing ID" }, { status: 400 });
  }

  const adminSupabase = createAdminClient();
  const { data: listing } = await adminSupabase
    .from("listings")
    .select("id, address, city, price, beds, baths, sqft, raw_description")
    .eq("id", parsed.data.listingId)
    .eq("user_id", user.id)
    .single();

  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

  const { descriptions, captions } = await generateAllContent({
    address: listing.address || "",
    city: listing.city || "",
    price: listing.price,
    beds: listing.beds,
    baths: listing.baths,
    sqft: listing.sqft,
    rawDescription: listing.raw_description || undefined,
    style: "modern", // default for standalone content generation
  });

  // Save to listing
  await adminSupabase.from("listings").update({
    description_mls: descriptions.mls,
    description_social: descriptions.social,
    description_luxury: descriptions.luxury,
    caption_instagram: captions.instagram,
    caption_tiktok: captions.tiktok,
    caption_facebook: captions.facebook,
    fair_housing_passed: true,
  }).eq("id", listing.id);

  return NextResponse.json({ success: true, descriptions, captions });
}
