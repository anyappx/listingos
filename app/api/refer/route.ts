import { type NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();

    // Get the current user's referral code
    const { data: currentUser, error: userErr } = await admin
      .from("users")
      .select("referral_code, listings_used_this_month")
      .eq("id", user.id)
      .single();

    if (userErr || !currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const referralCode = currentUser.referral_code as string | null;

    if (!referralCode) {
      return NextResponse.json({ referralCode: null, referredUsers: [], creditsEarned: 0 });
    }

    // Get users referred by this person
    const { data: referredUsers } = await admin
      .from("users")
      .select("id, full_name, email, plan, created_at")
      .eq("referred_by", referralCode)
      .order("created_at", { ascending: false });

    // Credits earned: 1 per referred user who upgraded (non-trial plan)
    const creditsEarned = (referredUsers || []).filter(
      (u) => u.plan !== "trial"
    ).length;

    return NextResponse.json({
      referralCode,
      referredUsers: referredUsers || [],
      creditsEarned,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error(`[api/refer] ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
