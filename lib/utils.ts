import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isDevMode(): boolean {
  const falKey = process.env.FAL_KEY || "";
  const r2Key = process.env.R2_ACCESS_KEY_ID || "";
  return falKey.startsWith("placeholder") || r2Key.startsWith("placeholder");
}
