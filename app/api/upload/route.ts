import { type NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const listingId = formData.get("listingId") as string | null;

  if (!file || !listingId) {
    return NextResponse.json({ error: "Missing file or listingId" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Auto-create bucket if it doesn't exist yet
  const { error: bucketError } = await admin.storage.createBucket("listing-photos", {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
  });
  if (bucketError && !bucketError.message.toLowerCase().includes("already exists")) {
    console.error("[upload] bucket creation failed:", bucketError.message);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const storagePath = `listings/${user.id}/${listingId}/photos/${Date.now()}.${ext}`;

  const { error: uploadError } = await admin.storage
    .from("listing-photos")
    .upload(storagePath, buffer, { contentType: file.type || "image/jpeg", upsert: true });

  if (uploadError) {
    console.error("[upload] upload failed:", uploadError.message);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: { publicUrl } } = admin.storage
    .from("listing-photos")
    .getPublicUrl(storagePath);

  return NextResponse.json({ url: publicUrl });
}
