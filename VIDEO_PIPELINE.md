# ListingOS — Video Pipeline Specification

## Overview

Fully async. API route returns in <500ms. Worker does all heavy lifting.

```
Client → POST /api/generate
       ← { jobId }          (immediate)

Worker (BullMQ):
  → fal.ai × 8 clips (parallel)
  → Pexels × 3 clips
  → FFmpeg assemble
  → R2 upload
  → DB update: status=complete

Client polls GET /api/job/[id] every 5s
         ← { status, progressPercent, video } when done
```

---

## Worker Flow (/workers/video.ts)

```ts
async function processVideoJob(job: VideoJob) {

  // 1. Fetch listing data
  const listing = await supabase
    .from('listings')
    .select('*')
    .eq('id', job.listingId)
    .single()

  // 2. Pick photos (max 8, cover photo first)
  const photos = listing.photos
    .sort((a, b) => a.order - b.order)
    .slice(0, 8)

  await updateProgress(job.id, 'Rendering cinematic motion', 35)

  // 3. Generate video clips via fal.ai (parallel, max 4 at a time)
  const clipUrls = await pLimit(4)(
    photos.map(photo => () => generateClip(photo.url, job.style))
  )

  await updateProgress(job.id, 'Fetching neighborhood clips', 55)

  // 4. Fetch neighborhood B-roll from Pexels
  let brollPaths = []
  if (job.includeNeighborhoodBroll) {
    brollPaths = await fetchPexelsClips(listing.city, 3)
  }

  await updateProgress(job.id, 'Assembling your video', 70)

  // 5. FFmpeg: assemble 16:9
  const assembled16x9 = await assembleVideo({
    clips: [...clipUrls, ...brollPaths],
    musicPath: getMusicPath(job.musicTrackId),
    durationSeconds: job.durationSeconds,
    brandKit: await getBrandKit(job.userId),
    watermark: isFreePlan(job.userId),
    format: '16x9'
  })

  await updateProgress(job.id, 'Creating your 9:16 version', 88)

  // 6. FFmpeg: crop to 9:16
  const assembled9x16 = await cropTo9x16(assembled16x9)

  await updateProgress(job.id, 'Uploading final video', 95)

  // 7. Upload both to R2
  const [url16x9, url9x16] = await Promise.all([
    uploadToR2(assembled16x9, `videos/${job.userId}/${job.id}/16x9.mp4`),
    uploadToR2(assembled9x16, `videos/${job.userId}/${job.id}/9x16.mp4`),
  ])

  // 8. Extract thumbnail
  const thumbnailUrl = await extractThumbnail(assembled16x9, job)

  // 9. Insert video row + update job status
  await supabase.from('videos').insert({
    jobId: job.id,
    listingId: job.listingId,
    userId: job.userId,
    url16x9, url9x16, thumbnailUrl,
    isWatermarked: isFreePlan(job.userId)
  })

  await updateJobStatus(job.id, 'complete')

  // 10. Send email
  await sendVideoReadyEmail(job.userId, listing.address, url16x9)

  // 11. Cleanup temp files
  await cleanupTempFiles(job.id)
}
```

---

## fal.ai Clip Generation

```ts
async function generateClip(imageUrl: string, style: string): Promise<string> {
  const motionStrength = {
    modern:    0.7,
    luxury:    0.5,  // slower, more elegant
    energetic: 0.9,
    minimal:   0.4,
  }[style]

  const result = await fal.subscribe(
    "fal-ai/seedance/v1/lite/image-to-video",
    {
      input: {
        image_url: imageUrl,
        duration: 4,
        resolution: "720p",
        motion_strength: motionStrength,
      },
      timeout: 90_000, // 90s timeout
    }
  )

  // Download immediately — fal.ai URLs expire in 1 hour
  const localPath = await downloadToTemp(result.video.url, job.id)
  return localPath
}
```

**On timeout**: retry once. On second failure: skip clip, use static photo → Ken Burns pan via FFmpeg (no fal.ai cost).

---

## FFmpeg Assembly

```ts
async function assembleVideo(opts: AssembleOptions): Promise<string> {
  const outputPath = `/tmp/${opts.jobId}/output_16x9.mp4`

  return new Promise((resolve, reject) => {
    const command = ffmpeg()

    // Add all clips as inputs
    opts.clips.forEach(clip => command.input(clip))

    // Concat filter
    const concatFilter = `concat=n=${opts.clips.length}:v=1:a=0[v]`

    // Lower third text
    const brandText = `${opts.brandKit.agentName} | ${opts.brandKit.brokerage}`
    const lowerThird = [
      `[v]drawtext=`,
      `text='${brandText}':`,
      `fontfile=/app/public/fonts/Inter-SemiBold.ttf:`,
      `fontsize=22:fontcolor=white:`,
      `x=40:y=h-70:`,
      `box=1:boxcolor=black@0.6:boxborderw=10`,
      `[vbranded]`
    ].join('')

    command
      .complexFilter([concatFilter, lowerThird])
      .input(opts.musicPath)
      .audioFilter(`volume=0.35,afade=t=out:st=${opts.durationSeconds - 3}:d=3`)
      .outputOptions(['-map [vbranded]', '-map 1:a', '-shortest'])
      .duration(opts.durationSeconds)
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run()
  })
}
```

---

## Pexels B-roll Fetch

```ts
async function fetchPexelsClips(city: string, count: number): Promise<string[]> {
  const query = `${city} neighborhood lifestyle`

  const response = await fetch(
    `https://api.pexels.com/videos/search?query=${query}&per_page=${count}&size=small`,
    { headers: { Authorization: process.env.PEXELS_API_KEY } }
  )

  const data = await response.json()

  // Download videos to temp
  return Promise.all(
    data.videos.slice(0, count).map(video => {
      const file = video.video_files.find(f => f.quality === 'sd')
      return downloadToTemp(file.link, job.id)
    })
  )
}
```

---

## Error Handling

| Error | Action |
|-------|--------|
| fal.ai timeout (1st) | Retry once |
| fal.ai timeout (2nd) | Skip clip, use static photo + FFmpeg Ken Burns |
| fal.ai all clips fail | Fail job, refund credit, notify agent |
| Pexels API down | Skip B-roll silently, continue |
| FFmpeg error | Fail job, refund credit, log error |
| R2 upload fail | Retry 3x, then fail job |
| Any unhandled error | Fail job, refund credit via `check_and_deduct_credit` reversal |

**Credit refund SQL**:
```sql
update users set listings_used_this_month = listings_used_this_month - 1
where id = $userId and listings_used_this_month > 0
```

---

## Queue Config (BullMQ)

```ts
const videoQueue = new Queue('video-generation', {
  connection: upstashRedis,
  defaultJobOptions: {
    attempts: 1,        // no auto-retry (we handle internally)
    removeOnComplete: { age: 86400 },   // keep 24h
    removeOnFail: { age: 604800 },      // keep 7 days for debugging
  }
})

const worker = new Worker('video-generation', processVideoJob, {
  connection: upstashRedis,
  concurrency: 3,       // max 3 videos processing at once (Railway free tier limit)
})
```

---

## Temp File Cleanup

All temp files in `/tmp/{jobId}/`. Delete after upload completes.
Railway's ephemeral filesystem handles cleanup on restart.
Explicit cleanup on success:

```ts
async function cleanupTempFiles(jobId: string) {
  await fs.rm(`/tmp/${jobId}`, { recursive: true, force: true })
}
```
