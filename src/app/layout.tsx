import type { Metadata } from "next";
import { Suspense } from "react";
import { unstable_noStore as noStore } from "next/cache";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Link from "next/link";
import { Bell, ShieldCheck } from "lucide-react";
import { signOut } from "@/app/actions";
import { BottomNav } from "@/components/bottom-nav";
import { MobileDashboardMenu } from "@/components/mobile-nav";
import { SiteFooter } from "@/components/site-footer";
import { SiteVisitTracker } from "@/components/site-visit-tracker";
import { isAdminRole, isAgentRole } from "@/lib/roles";
import { getSafeUser } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://hazi.ng"),
  title: "Hazi.ng | Auction Marketplace",
  description: "A trusted Nigerian declutter marketplace for live auctions, verified sellers, and logistics-backed purchases.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png"
  }
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  noStore();

  const supabase = await createSupabaseServerClient();
  const user = await getSafeUser(supabase);
  const isAuthenticated = Boolean(user);
  const [{ data: profile }, { count: unreadNotifications }] = user && supabase
    ? await Promise.all([
        supabase.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle(),
        supabase.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null)
      ])
    : [{ data: null }, { count: 0 }];
  const isAdmin = isAdminRole(profile?.role);
  const isAgent = isAgentRole(profile?.role);
  const postHref = isAgentRole(profile?.role) ? "/sell/agent" : "/sell";
  const dashboardInitials = getDashboardInitials(profile?.full_name ?? user?.email);

  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[rgba(248,249,255,0.92)] backdrop-blur-xl">
          <nav className="site-header__nav container flex min-h-16 items-center justify-between gap-4">
            <div className="site-header__left flex min-w-0 items-center gap-2">
              <Link href="/" className="site-header__brand flex min-w-0 items-center gap-3 font-extrabold text-[var(--primary)]">
                <span className="grid size-10 place-items-center rounded-xl bg-[var(--primary)] text-white">H</span>
                <span>Hazi.ng</span>
              </Link>
            </div>
            <div className="hidden items-center gap-6 text-sm font-bold text-[var(--muted)] lg:flex">
              <Link href="/auctions" className="hover:text-[var(--primary)]">Auctions</Link>
              <Link href={postHref} className="hover:text-[var(--primary)]">Sell</Link>
              <Link href="/agent" className="hover:text-[var(--primary)]">Agents</Link>
              <Link href="/dashboard" className="hover:text-[var(--primary)]">Dashboard</Link>
              <Link href="/support" className="hover:text-[var(--primary)]">Support</Link>
              {isAdmin ? <Link href="/admin" className="hover:text-[var(--primary)]">Admin</Link> : null}
            </div>
            <div className="site-header__actions flex items-center gap-2">
              <Link href="/dashboard/notifications" className="button button-outline relative hidden px-3 lg:inline-flex" aria-label={`${unreadNotifications ?? 0} unread notifications`}>
                <Bell size={17} />
                {unreadNotifications ? (
                  <span className="notification-count">{unreadNotifications > 99 ? "99+" : unreadNotifications}</span>
                ) : null}
              </Link>
              {isAuthenticated ? (
                <form action={signOut} className="hidden lg:block">
                  <button className="button button-outline" type="submit">Log out</button>
                </form>
              ) : (
                <Link href="/auth" className="site-header__signin button button-outline">Sign in</Link>
              )}
              <Link href={postHref} className="site-header__post-item button button-primary hidden lg:inline-flex">
                <ShieldCheck size={17} />
                Post Item
              </Link>
              <MobileDashboardMenu
                initials={dashboardInitials}
                isAdmin={isAdmin}
                isAgent={isAgent}
                isAuthenticated={isAuthenticated}
              />
            </div>
          </nav>
        </header>
        {children}
        <SiteFooter />
        <BottomNav postHref={postHref} />
        <Suspense fallback={null}>
          <SiteVisitTracker />
        </Suspense>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

function getDashboardInitials(value?: string | null) {
  const compactName = (value ?? "").split("@")[0]?.replace(/[^a-z0-9]/gi, "") ?? "";

  return (compactName.slice(0, 2).toUpperCase() || "HZ").padEnd(2, "Z");
}
