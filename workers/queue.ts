import { Queue, Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import type { VideoJobPayload } from "@/lib/types";

function getRedisConnection(): Redis {
  const conn = new Redis(process.env.UPSTASH_REDIS_URL!, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: () => null, // don't retry — fail fast in dev
    lazyConnect: true,
  });
  conn.on("error", () => {}); // suppress ioredis spam when Redis not configured
  return conn;
}

export const QUEUE_NAME = "video-generation";

export function createVideoQueue() {
  const connection = getRedisConnection();
  return new Queue<VideoJobPayload>(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 1, // We handle retries internally
      removeOnComplete: { age: 86400, count: 100 }, // Keep 24h
      removeOnFail: { age: 604800, count: 500 }, // Keep 7 days for debugging
    },
  });
}

export function createVideoWorker(
  processor: (job: Job<VideoJobPayload>) => Promise<void>,
  concurrency = 3
): Worker<VideoJobPayload> {
  const connection = getRedisConnection();
  return new Worker<VideoJobPayload>(QUEUE_NAME, processor, {
    connection,
    concurrency,
  });
}

export async function enqueueVideoJob(payload: VideoJobPayload): Promise<string> {
  const queue = createVideoQueue();
  const job = await queue.add("generate", payload, {
    jobId: payload.jobId,
  });
  await queue.close();
  return job.id!;
}
