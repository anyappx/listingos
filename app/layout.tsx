import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ListingOS — Real Estate Video AI",
  description:
    "Paste a listing URL, get a branded cinematic video in under 2 minutes.",
  openGraph: {
    title: "ListingOS — Real Estate Video AI",
    description: "Branded cinematic videos for real estate listings in under 2 minutes.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster richColors closeButton />
      </body>
    </html>
  );
}
