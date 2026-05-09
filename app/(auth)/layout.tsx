import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 px-4">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-sm">L</span>
        </div>
        <span className="text-xl font-semibold">ListingOS</span>
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
