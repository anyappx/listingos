import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCheckoutSession } from "@/lib/stripe";
import { z } from "zod";

const Schema = z.object({ plan: z.enum(["solo", "agent"]) });

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const session = await createCheckoutSession({
    userId: user.id,
    userEmail: user.email!,
    planKey: parsed.data.plan,
    successUrl: `${appUrl}/dashboard/account?upgraded=1`,
    cancelUrl: `${appUrl}/dashboard/account`,
  });

  return NextResponse.json({ url: session.url });
}
