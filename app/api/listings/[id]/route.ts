import { type NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { UpdateListingSchema } from "@/lib/validations";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Validate input BEFORE checking listing ownership (400 before 404)
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = UpdateListingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  // Verify ownership after input is validated
  const { data: listing } = await adminSupabase
    .from("listings")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updates: Record<string, unknown> = {};
  if (parsed.data.descriptionMls !== undefined) updates.description_mls = parsed.data.descriptionMls;
  if (parsed.data.descriptionSocial !== undefined) updates.description_social = parsed.data.descriptionSocial;
  if (parsed.data.descriptionLuxury !== undefined) updates.description_luxury = parsed.data.descriptionLuxury;
  if (parsed.data.captionInstagram !== undefined) updates.caption_instagram = parsed.data.captionInstagram;
  if (parsed.data.captionTiktok !== undefined) updates.caption_tiktok = parsed.data.captionTiktok;
  if (parsed.data.captionFacebook !== undefined) updates.caption_facebook = parsed.data.captionFacebook;
  if (parsed.data.address !== undefined) updates.address = parsed.data.address;
  if (parsed.data.price !== undefined) updates.price = parsed.data.price;

  // Allow photos update from request body (not in schema but used by step 1)
  const rawBody = body as Record<string, unknown>;
  if (rawBody.photos) updates.photos = rawBody.photos;

  const { data: updated, error } = await adminSupabase
    .from("listings")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: "Update failed" }, { status: 500 });

  return NextResponse.json({ success: true, listing: updated });
}
