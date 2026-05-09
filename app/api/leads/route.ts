import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { LeadInputSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = LeadInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const { listingId, name, email, phone, message } = parsed.data;
  const admin = createAdminClient();

  // Resolve agent user_id from listing
  const { data: listingRow } = await admin
    .from("listings")
    .select("user_id")
    .eq("id", listingId)
    .single();

  if (!listingRow) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  // Insert lead
  const { error: insertError } = await admin.from("leads").insert({
    listing_id: listingId,
    user_id: listingRow.user_id,
    name,
    email,
    phone: phone || null,
    message: message || null,
  });

  if (insertError) {
    return NextResponse.json({ error: "Failed to save lead" }, { status: 500 });
  }

  // Increment lead_count directly
  const { data: listingData } = await admin.from("listings").select("lead_count").eq("id", listingId).single();
  await admin.from("listings").update({ lead_count: (listingData?.lead_count || 0) + 1 }).eq("id", listingId);

  // Email agent (non-blocking)
  if (name && email) {
    emailAgent(admin, listingId, name, email, phone ?? undefined, message ?? undefined).catch(() => {});
  }

  return NextResponse.json({ success: true });
}

async function emailAgent(
  admin: ReturnType<typeof createAdminClient>,
  listingId: string,
  leadName: string,
  leadEmail: string,
  leadPhone?: string,
  leadMessage?: string,
) {
  if (!process.env.RESEND_API_KEY) return;

  const { data: listing } = await admin
    .from("listings")
    .select("address, user_id")
    .eq("id", listingId)
    .single();

  if (!listing) return;

  const { data: brandKit } = await admin
    .from("brand_kits")
    .select("agent_name")
    .eq("user_id", listing.user_id)
    .single();

  const { data: user } = await admin
    .from("users")
    .select("email")
    .eq("id", listing.user_id)
    .single();

  if (!user?.email) return;

  const agentName = brandKit?.agent_name || "Agent";

  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: "ListingOS <noreply@listingos.com>",
    to: user.email,
    subject: `New lead: ${leadName} is interested in ${listing.address}`,
    html: `
      <h2>New Lead for ${listing.address}</h2>
      <p>Hi ${agentName},</p>
      <p><strong>${leadName}</strong> submitted a contact request through your listing page.</p>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:8px;font-weight:bold">Name</td><td style="padding:8px">${leadName}</td></tr>
        <tr><td style="padding:8px;font-weight:bold">Email</td><td style="padding:8px"><a href="mailto:${leadEmail}">${leadEmail}</a></td></tr>
        ${leadPhone ? `<tr><td style="padding:8px;font-weight:bold">Phone</td><td style="padding:8px">${leadPhone}</td></tr>` : ""}
        ${leadMessage ? `<tr><td style="padding:8px;font-weight:bold">Message</td><td style="padding:8px">${leadMessage}</td></tr>` : ""}
      </table>
    `,
  });
}
