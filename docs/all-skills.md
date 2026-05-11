# ═══════════════════════════════════════════════════════════
# SKILL: API Route Pattern
# File: skills/api-route-pattern.md
# Read before: creating ANY API route
# ═══════════════════════════════════════════════════════════

Every API route follows this EXACT structure. No exceptions.

```ts
import { type NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  // 1. AUTH — always first (skip for /api/leads and /api/webhooks/*)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. PARSE INPUT — always validate with Zod
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = SomeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  // 3. BUSINESS LOGIC — always try/catch
  try {
    const admin = createAdminClient();
    // ... do the thing, use admin for writes, supabase for reads
    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error(`[api/route-name] ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

NEVER skip: auth, input validation, try/catch, console.error.
NEVER use: res.send(), res.status() (Pages Router syntax).
NEVER return raw Error objects to client.


# ═══════════════════════════════════════════════════════════
# SKILL: Component Pattern
# File: skills/component-pattern.md
# Read before: creating ANY dashboard page
# ═══════════════════════════════════════════════════════════

Every dashboard page has 4 states. NO page shows blank white screen.

```tsx
"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function SomePage() {
  const [data, setData] = useState<SomeType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createBrowserClient();
        const { data, error } = await supabase
          .from("table")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw new Error(error.message);
        setData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // STATE 1: Loading
  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    );
  }

  // STATE 2: Error
  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => window.location.reload()} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // STATE 3: Empty
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="mb-4">Nothing here yet.</p>
            <Button asChild><a href="/dashboard/new">Create Your First Video</a></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // STATE 4: Data loaded
  return (
    <div className="p-6 space-y-6">
      {/* actual page content */}
    </div>
  );
}
```

EVERY page must have all 4 states.
EVERY async button: disabled during loading + spinner icon.
EVERY success action: toast.success("Message").
EVERY failed action: toast.error("Message").
EVERY form submission: prevent double-submit.


# ═══════════════════════════════════════════════════════════
# SKILL: Supabase Patterns
# File: skills/supabase-patterns.md
# Read before: ANY Supabase query
# ═══════════════════════════════════════════════════════════

## Server-side (API routes, pipeline)
```ts
import { createAdminClient } from "@/lib/supabase/server";

const supabase = createAdminClient();

// SELECT — always filter by user_id
const { data, error } = await supabase
  .from("listings")
  .select("*, videos(*)")
  .eq("user_id", userId)
  .order("created_at", { ascending: false });
if (error) throw new Error(`DB: ${error.message}`);

// INSERT — always include user_id
const { data: row, error: insertErr } = await supabase
  .from("listings")
  .insert({ ...values, user_id: userId })
  .select()
  .single();
if (insertErr) throw new Error(`Insert: ${insertErr.message}`);

// UPDATE — always filter by id AND user_id
const { error: updateErr } = await supabase
  .from("listings")
  .update({ description_mls: text })
  .eq("id", listingId)
  .eq("user_id", userId);

// DELETE — always filter by id AND user_id
const { error: deleteErr } = await supabase
  .from("listings")
  .delete()
  .eq("id", listingId)
  .eq("user_id", userId);
```

## Client-side (React components)
```ts
import { createBrowserClient } from "@/lib/supabase/client";

const supabase = createBrowserClient();
// RLS enforces user_id — but still good practice to filter
const { data } = await supabase
  .from("listings")
  .select("*")
  .order("created_at", { ascending: false });
```

## Pipeline (scripts/*.js — CJS, not ESM)
```js
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
```

NEVER use service role key on the client.
NEVER skip .eq("user_id", userId) on server queries.
NEVER use raw SQL unless absolutely necessary.


# ═══════════════════════════════════════════════════════════
# SKILL: Pipeline Patterns
# File: skills/pipeline-patterns.md
# Read before: modifying scripts/pipeline.js
# ═══════════════════════════════════════════════════════════

## pipeline.js is CJS (CommonJS)
```js
// YES:
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

// NO:
import fs from "fs";  // WILL NOT WORK — this file is CJS
```

## FFmpeg via fluent-ffmpeg
```js
const ffmpegLib = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
if (ffmpegStatic) ffmpegLib.setFfmpegPath(ffmpegStatic);

function ffrun(cmd) {
  return new Promise((resolve, reject) => {
    cmd.on("end", () => resolve()).on("error", reject).run();
  });
}
```

## Calling Python from pipeline.js
```js
function runPython(scriptPath, args) {
  return new Promise((resolve, reject) => {
    const python = process.platform === "win32" ? "python" : "python3";
    const child = require("child_process").spawn(python, [scriptPath, ...args]);
    let stderr = "";
    child.stdout.on("data", (d) => process.stdout.write(`[py] ${d}`));
    child.stderr.on("data", (d) => { stderr += d; process.stderr.write(`[py:err] ${d}`); });
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`Python exit ${code}: ${stderr}`)));
    child.on("error", (err) => reject(new Error(`Python spawn failed: ${err.message}`)));
  });
}
```

## Progress updates
```js
async function updateProgress(step, percent) {
  await supabase.from("video_jobs").update({
    status: "processing",
    progress_step: step,
    progress_percent: percent,
  }).eq("id", jobId);
}
```

## R2 upload with fallback
```js
async function uploadOutput(filePath, r2Key, contentType) {
  const r2KeyId = process.env.R2_ACCESS_KEY_ID || "";
  if (!r2KeyId || r2KeyId.startsWith("placeholder")) {
    // Dev fallback: copy to /public/videos/
    const publicDir = path.join(process.cwd(), "public", "videos", jobId);
    fs.mkdirSync(publicDir, { recursive: true });
    const dest = path.join(publicDir, path.basename(r2Key));
    fs.copyFileSync(filePath, dest);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return `${appUrl}/videos/${jobId}/${path.basename(r2Key)}`;
  }
  // Prod: upload to R2
  const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  await client.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: r2Key,
    Body: fs.readFileSync(filePath),
    ContentType: contentType,
  }));
  return r2Key;
}
```


# ═══════════════════════════════════════════════════════════
# SKILL: Parallax Patterns
# File: skills/parallax-patterns.md
# Read before: modifying scripts/parallax-cpu.py
# ═══════════════════════════════════════════════════════════

## ONNX model loading (Depth Anything V2 Small — Apache-2.0)
```python
import onnxruntime as ort
import os, urllib.request

MODEL_URL = "https://github.com/fabio-sim/Depth-Anything-ONNX/releases/download/v2.0.0/depth_anything_v2_vits.onnx"
MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
MODEL_PATH = os.path.join(MODEL_DIR, "depth_anything_v2_vits.onnx")

def load_model():
    if not os.path.exists(MODEL_PATH):
        os.makedirs(MODEL_DIR, exist_ok=True)
        print(f"Downloading depth model to {MODEL_PATH}...")
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
    return ort.InferenceSession(MODEL_PATH, providers=["CPUExecutionProvider"])
```

## Motion easing (ALWAYS use ease-in-out, never linear)
```python
import math
t_raw = frame_idx / total_frames      # 0.0 to 1.0 linear
t = 0.5 - 0.5 * math.cos(t_raw * math.pi)  # smooth S-curve
```

## Edge handling (ALWAYS use these 3 techniques)
```python
# 1. Overscan: render 10% larger then crop
render_w = int(width * 1.1)
render_h = int(height * 1.1)

# 2. Reflection at borders (not replicate)
frame = cv2.remap(image, src_x, src_y, cv2.INTER_LINEAR,
                   borderMode=cv2.BORDER_REFLECT_101)

# 3. Crop to target after rendering
cx = (render_w - width) // 2
cy = (render_h - height) // 2
frame = frame[cy:cy+height, cx:cx+width]
```

## Depth-of-field (background blur)
```python
# blur_strength based on depth: background=more blur, foreground=sharp
for sigma in [1, 2, 4]:
    blurred = cv2.GaussianBlur(frame, (0, 0), sigma)
    mask = ((1.0 - depth) > sigma * 0.25).astype(np.float32)[..., np.newaxis]
    frame = (frame * (1 - mask) + blurred * mask).astype(np.uint8)
```

## Output encoding (ALWAYS re-encode with FFmpeg, not cv2)
```python
# cv2.VideoWriter produces bad codec. Always re-encode:
subprocess.run([
    "ffmpeg", "-y",
    "-i", raw_output,
    "-c:v", "libx264", "-preset", "fast", "-crf", "18",
    "-pix_fmt", "yuv420p", "-an",
    output_path
], check=True, capture_output=True)
os.remove(raw_output)  # cleanup raw file
```


# ═══════════════════════════════════════════════════════════
# SKILL: Claude AI Patterns
# File: skills/claude-patterns.md
# Read before: ANY Claude Haiku integration
# ═══════════════════════════════════════════════════════════

## Client setup
```ts
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
```

## Structured JSON output
```ts
const response = await anthropic.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 600,
  messages: [{
    role: "user",
    content: `Your instructions here.

Return ONLY valid JSON matching this exact structure:
{
  "field1": "description of what goes here",
  "field2": ["array items"]
}

Do NOT include markdown, code fences, or explanation outside the JSON.`
  }],
});

const text = response.content[0]?.type === "text" ? response.content[0].text : "";
```

## Parsing (always defensive)
```ts
function parseJSON<T>(raw: string): T | null {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}
```

## Fair Housing — EVERY prompt includes this
```
CRITICAL: Comply with Fair Housing Act in ALL outputs.
NEVER mention: families, children, schools nearby, religion,
nationality, disability, gender, age, safe area, quiet neighborhood,
exclusive, walking distance to schools, ideal for couples,
bachelor pad, no kids, adults only, church/mosque/synagogue nearby.
```

## Cost control
- Always claude-haiku-4-5 (cheapest)
- max_tokens: 600 for descriptions, 2000 for content pack
- Log token usage if debugging cost
- Target: <$0.01 per listing for ALL Claude calls combined


# ═══════════════════════════════════════════════════════════
# SKILL: Testing Patterns
# File: skills/testing-patterns.md
# Read before: writing ANY test
# ═══════════════════════════════════════════════════════════

## Test format (inline, not test framework — keep it simple)

For API routes:
```bash
# Test in terminal:
curl -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-access-token=YOUR_TOKEN" \
  -d '{"url":"https://www.redfin.com/CA/..."}'

# Assert: HTTP 200
# Assert: response has .photoUrls array with length >= 5
# Assert: response has .address as non-empty string
```

For Python scripts:
```bash
# Test parallax:
python3 scripts/parallax-cpu.py test-photo.jpg /tmp/test-clip.mp4 dolly 1.0 4 30 1920 1080

# Assert: /tmp/test-clip.mp4 exists
# Assert: ffprobe -v quiet -print_format json -show_streams /tmp/test-clip.mp4
#         → codec_name: "h264", width: 1920, height: 1080, duration ~4s
```

For pipeline:
```bash
# Test full pipeline (needs a job in DB):
node scripts/pipeline.js $JOB_ID $LISTING_ID $USER_ID 30 modern

# Assert: exit code 0
# Assert: video_jobs row has status "complete"
# Assert: videos row exists with url_16x9 set
# Assert: /public/videos/$JOB_ID/ has 16x9.mp4 and 9x16.mp4
```

For UI:
```
# Manual browser test:
1. Navigate to page
2. Verify loading skeleton appears briefly
3. Verify data loads
4. Verify error state (disconnect network, reload)
5. Verify empty state (new user with no data)
6. Verify mobile (DevTools → 375px width)
7. Verify all buttons have loading states
8. Verify all copy buttons show toast
```
