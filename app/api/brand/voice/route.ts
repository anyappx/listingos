import { type NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { BrandVoiceInputSchema } from "@/lib/validations";
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-haiku-4-5";

function hasRealApiKey(): boolean {
  const key = process.env.ANTHROPIC_API_KEY;
  return !!key && !key.startsWith("placeholder");
}

const MOCK_VOICE_PROFILE =
  "Professional and engaging tone with clear property highlights.";

export async function POST(request: NextRequest) {
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

  const parsed = BrandVoiceInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  // 3. BUSINESS LOGIC
  try {
    let voiceProfile: string;

    if (!hasRealApiKey()) {
      voiceProfile = MOCK_VOICE_PROFILE;
    } else {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const prompt = `Analyze this agent's writing style from these caption examples and return a 2-3 sentence description of their voice, tone, and style preferences for future content generation. Examples:\n\n${parsed.data.voiceExamples}\n\nReturn ONLY the voice description, no other text.`;

      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      });

      const text =
        response.content[0]?.type === "text" ? response.content[0].text : "";
      voiceProfile = text.trim() || MOCK_VOICE_PROFILE;
    }

    // Save to brand_kits.voice_profile (upsert by user_id)
    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("brand_kits")
      .select("id")
      .eq("user_id", user.id)
      .single();

    let error: { message?: string } | null = null;

    if (existing?.id) {
      ({ error } = await admin
        .from("brand_kits")
        .update({ voice_profile: voiceProfile })
        .eq("id", existing.id));
    } else {
      ({ error } = await admin
        .from("brand_kits")
        .insert({ user_id: user.id, voice_profile: voiceProfile }));
    }

    if (error) {
      console.error("[api/brand/voice] db save error:", error.message);
      return NextResponse.json({ error: "Save failed" }, { status: 500 });
    }

    return NextResponse.json({ voiceProfile });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error(`[api/brand/voice] ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
