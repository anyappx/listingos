import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.supabase.in" },
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "photos.zillowstatic.com" },
      { protocol: "https", hostname: "ssl.cdn-redfin.com" },
      { protocol: "https", hostname: "**.rdcpix.com" },
      { protocol: "http", hostname: "localhost" },
    ],
  },
  serverExternalPackages: [
    "fluent-ffmpeg",
    "ffmpeg-static",
    "playwright",
    "rebrowser-playwright",
    "got-scraping",
    "header-generator",
    "@imgly/background-removal",
    "sharp",
    "bullmq",
    "ioredis",
    "onnxruntime-node",
    "canvas",
    "@aws-sdk/client-s3",
    "@aws-sdk/s3-request-presigner",
  ],
};

export default nextConfig;
