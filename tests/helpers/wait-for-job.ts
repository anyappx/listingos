/**
 * Poll /api/job/:jobId until complete, failed, or timeout.
 * Returns the final job status response.
 */

export interface JobStatus {
  status: "queued" | "processing" | "complete" | "failed";
  progressStep?: string;
  progressPercent?: number;
  url16x9?: string;
  url9x16?: string;
  thumbnailUrl?: string;
  error?: string;
}

export async function waitForJob(
  baseUrl: string,
  jobId: string,
  timeoutMs = 180_000,
  pollIntervalMs = 4_000,
  onProgress?: (status: JobStatus) => void
): Promise<JobStatus> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${baseUrl}/api/job/${jobId}`);
    if (!res.ok) {
      throw new Error(`Job poll HTTP ${res.status} for job ${jobId}`);
    }

    const status: JobStatus = await res.json();
    onProgress?.(status);

    if (status.status === "complete") return status;
    if (status.status === "failed") {
      throw new Error(`Job ${jobId} failed: ${status.error || "unknown error"}`);
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  throw new Error(`Job ${jobId} timed out after ${timeoutMs / 1000}s`);
}
