import { type NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { BrandInputSchema } from "@/lib/validations";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminSupabase = createAdminClient();
  const { data: brandKit } = await adminSupabase
    .from("brand_kits")
    .select("*")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({ brandKit: brandKit || null });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BrandInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const adminSupabase = createAdminClient();
  const upsertData: Record<string, unknown> = { user_id: user.id };

  if (parsed.data.logoUrl !== undefined) upsertData.logo_url = parsed.data.logoUrl;
  if (parsed.data.primaryColor !== undefined) upsertData.primary_color = parsed.data.primaryColor;
  if (parsed.data.accentColor !== undefined) upsertData.accent_color = parsed.data.accentColor;
  if (parsed.data.font !== undefined) upsertData.font = parsed.data.font;
  if (parsed.data.agentName !== undefined) upsertData.agent_name = parsed.data.agentName;
  if (parsed.data.licenseNumber !== undefined) upsertData.license_number = parsed.data.licenseNumber;
  if (parsed.data.brokerage !== undefined) upsertData.brokerage = parsed.data.brokerage;
  if (parsed.data.phone !== undefined) upsertData.phone = parsed.data.phone;
  if (parsed.data.headshotUrl !== undefined) upsertData.headshot_url = parsed.data.headshotUrl;

  // Check if brand kit already exists (no unique constraint on user_id — do manual upsert)
  const { data: existing } = await adminSupabase
    .from("brand_kits")
    .select("id")
    .eq("user_id", user.id)
    .single();

  let brandKit, error;
  if (existing?.id) {
    ({ data: brandKit, error } = await adminSupabase
      .from("brand_kits")
      .update(upsertData)
      .eq("id", existing.id)
      .select()
      .single());
  } else {
    ({ data: brandKit, error } = await adminSupabase
      .from("brand_kits")
      .insert(upsertData)
      .select()
      .single());
  }

  if (error) {
    console.error("[brand] save error:", error);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true, brandKit });
}
