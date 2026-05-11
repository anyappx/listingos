import { type NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { ListingPhoto } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as {
      id: string;
      slug: string;
      address: string;
      city: string;
      state: string;
      zip: string;
      price?: number | null;
      beds?: number | null;
      baths?: number | null;
      sqft?: number | null;
      raw_description?: string;
      source_url?: string | null;
      photos?: ListingPhoto[];
    };

    const adminSupabase = createAdminClient();
    const { error } = await adminSupabase.from("listings").insert({
      id: body.id,
      user_id: user.id,
      slug: body.slug,
      address: body.address ?? "",
      city: body.city ?? "",
      state: body.state ?? "",
      zip: body.zip ?? "",
      price: body.price ?? null,
      beds: body.beds ?? null,
      baths: body.baths ?? null,
      sqft: body.sqft ?? null,
      raw_description: body.raw_description ?? null,
      source_url: body.source_url ?? null,
      photos: body.photos ?? [],
    });

    if (error) {
      console.error("[/api/listings/create] insert error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ listingId: body.id, slug: body.slug });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/listings/create] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
