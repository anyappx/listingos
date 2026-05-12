import { type NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { generateContentPack } from "@/lib/claude";
import { z } from "zod";

const ContentPackRequestSchema = z.object({
  listingId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  // Auth: accept either user session OR service key (for pipeline calls)
  const serviceKey = request.headers.get("x-service-key");
  const isServiceCall = serviceKey === process.env.SUPABASE_SERVICE_ROLE_KEY;

  let userId: string | null = null;

  if (!isServiceCall) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = user.id;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ContentPackRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const { listingId } = parsed.data;

  try {
    const admin = createAdminClient();

    // Fetch listing — if service call, skip user_id filter
    const query = admin
      .from("listings")
      .select("*")
      .eq("id", listingId);

    if (userId) {
      query.eq("user_id", userId);
    }

    const { data: listing, error: fetchErr } = await query.single();

    if (fetchErr || !listing) {
      console.error(`[api/content/pack] Listing not found: ${fetchErr?.message}`);
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    // If content pack already exists and is recent (< 24h), return it
    if (listing.content_pack) {
      const existing = listing.content_pack as { generatedAt?: string };
      if (existing.generatedAt) {
        const age = Date.now() - new Date(existing.generatedAt).getTime();
        if (age < 24 * 60 * 60 * 1000) {
          return NextResponse.json({ contentPack: listing.content_pack });
        }
      }
    }

    const contentPack = await generateContentPack({
      address: listing.address || "",
      city: listing.city || "",
      state: listing.state || undefined,
      price: listing.price || null,
      beds: listing.beds || null,
      baths: listing.baths || null,
      sqft: listing.sqft || null,
      features: Array.isArray(listing.features)
        ? (listing.features as string[]).join(", ")
        : undefined,
      style: listing.style || "modern",
      agentName: listing.agent_name || undefined,
      voiceProfile: undefined,
    });

    if (!contentPack) {
      return NextResponse.json(
        { error: "Failed to generate content pack" },
        { status: 500 }
      );
    }

    // Save to listing
    const { error: updateErr } = await admin
      .from("listings")
      .update({ content_pack: contentPack })
      .eq("id", listingId);

    if (updateErr) {
      console.error(`[api/content/pack] Save error: ${updateErr.message}`);
    }

    return NextResponse.json({ contentPack });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error(`[api/content/pack] ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const listingId = searchParams.get("listingId");

  if (!listingId) {
    return NextResponse.json({ error: "listingId required" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data: listing, error } = await admin
      .from("listings")
      .select("content_pack")
      .eq("id", listingId)
      .eq("user_id", user.id)
      .single();

    if (error || !listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    return NextResponse.json({ contentPack: listing.content_pack });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error(`[api/content/pack] GET ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
