import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const ReeditSchema = z.object({
  type: z.enum(["music", "headline"]),
  musicTrackId: z.string().uuid("Invalid music track ID").optional(),
  musicVolume: z.number().min(0).max(1).optional(),
  headline: z.string().max(200).optional(),
  customHeadline: z.string().max(200).optional(),
});

type ReeditInput = z.infer<typeof ReeditSchema>;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 1. AUTH
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. PARSE INPUT
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ReeditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const input: ReeditInput = parsed.data;

  // 3. BUSINESS LOGIC
  try {
    const admin = createAdminClient();

    // Verify listing ownership
    const { data: listing, error: listingErr } = await admin
      .from("listings")
      .select("id, slug")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (listingErr || !listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    if (input.type === "music") {
      if (!input.musicTrackId) {
        return NextResponse.json(
          { error: "musicTrackId is required for type=music" },
          { status: 400 }
        );
      }

      // Fetch the most recent completed job for this listing
      const { data: job, error: jobErr } = await admin
        .from("video_jobs")
        .select("id")
        .eq("listing_id", id)
        .eq("user_id", user.id)
        .eq("status", "complete")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (jobErr || !job) {
        return NextResponse.json(
          { error: "No completed video job found for this listing" },
          { status: 404 }
        );
      }

      // Update music_track_id on the job
      const { error: updateErr } = await admin
        .from("video_jobs")
        .update({ music_track_id: input.musicTrackId })
        .eq("id", job.id)
        .eq("user_id", user.id);

      if (updateErr) {
        throw new Error(`Update failed: ${updateErr.message}`);
      }

      return NextResponse.json({
        success: true,
        message: "Music updated. Video will re-render shortly.",
      });
    }

    if (input.type === "headline") {
      // Update listings table — store headline in raw_description metadata or headline column
      const updatePayload: Record<string, unknown> = {};

      if (input.customHeadline !== undefined) {
        updatePayload.raw_description = input.customHeadline;
      } else if (input.headline !== undefined) {
        updatePayload.raw_description = input.headline;
      } else {
        return NextResponse.json(
          { error: "headline or customHeadline is required for type=headline" },
          { status: 400 }
        );
      }

      const { error: updateErr } = await admin
        .from("listings")
        .update(updatePayload)
        .eq("id", id)
        .eq("user_id", user.id);

      if (updateErr) {
        throw new Error(`Update failed: ${updateErr.message}`);
      }

      return NextResponse.json({
        success: true,
        message: "Headline updated.",
      });
    }

    // Should never reach here due to Zod enum validation
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error(`[api/listings/${id}/reedit] ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
