"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import type { User } from "@/lib/types";
import {
  Video,
  LayoutGrid,
  Palette,
  Music,
  User as UserIcon,
  LogOut,
  Plus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const navItems = [
  { href: "/dashboard/new", label: "New Video", icon: Plus },
  { href: "/dashboard/listings", label: "My Listings", icon: LayoutGrid },
  { href: "/dashboard/brand", label: "Brand Kit", icon: Palette },
  { href: "/dashboard/music", label: "Music", icon: Music },
  { href: "/dashboard/account", label: "Account", icon: UserIcon },
];

const planLabels: Record<string, string> = {
  trial: "Free Trial",
  solo: "Solo",
  agent: "Agent",
};

const planLimits: Record<string, number> = {
  trial: 1,
  solo: 3,
  agent: 10,
};

interface SidebarProps {
  user: User | null;
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const plan = user?.plan || "trial";
  const used = user?.listings_used_this_month || 0;
  const limit = planLimits[plan] || 1;
  const usagePercent = Math.min((used / limit) * 100, 100);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    toast.success("Signed out");
  }

  return (
    <aside className="w-64 h-full border-r bg-sidebar flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Video className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-lg">ListingOS</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/dashboard/new"
              ? pathname.startsWith("/dashboard/new")
              : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Usage + Plan */}
      <div className="p-4 border-t space-y-3">
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              {used}/{limit} listings this month
            </span>
            <Badge variant={plan === "trial" ? "secondary" : "default"} className="text-xs">
              {planLabels[plan]}
            </Badge>
          </div>
          <Progress value={usagePercent} className="h-1.5" />
        </div>
        {plan === "trial" && (
          <Link href="/dashboard/account">
            <Button variant="outline" size="sm" className="w-full text-xs">
              Upgrade plan
            </Button>
          </Link>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-xs text-muted-foreground"
          onClick={handleSignOut}
        >
          <LogOut className="w-3 h-3 mr-2" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
