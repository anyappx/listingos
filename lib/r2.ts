import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as fs from "fs";

function getClient(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export async function uploadToR2(
  key: string,
  filePath: string,
  contentType: string
): Promise<void> {
  const client = getClient();
  const buffer = fs.readFileSync(filePath);

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await client.send(command);
}

export async function uploadBufferToR2(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  const client = getClient();

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await client.send(command);
}

export async function getSignedVideoUrl(key: string, expiresInSeconds = 86400): Promise<string> {
  const client = getClient();
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

export function getThumbnailUrl(key: string): string {
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}

export async function uploadToR2WithRetry(
  key: string,
  filePath: string,
  contentType: string,
  maxRetries = 3
): Promise<void> {
  let lastError: Error | null = null;
  for (let i = 0; i < maxRetries; i++) {
    try {
      await uploadToR2(key, filePath, contentType);
      return;
    } catch (err) {
      lastError = err as Error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw lastError;
}
