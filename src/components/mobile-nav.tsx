"use client";

import Link from "next/link";
import {
  BriefcaseBusiness,
  Gavel,
  LayoutDashboard,
  Package,
  ShieldCheck,
  UserCircle,
  WalletCards,
  X
} from "lucide-react";
import { useState } from "react";
import { signOut } from "@/app/actions";

const links = [
  { href: "/auctions", label: "Auctions" },
  { href: "/sell", label: "Sell" },
  { href: "/agent", label: "Agents" },
  { href: "/support", label: "Support" }
];

export function MobileNav({
  isAdmin,
  postHref = "/sell"
}: {
  isAdmin: boolean;
  postHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const visibleLinks = links.map((link) => link.href === "/sell" ? { ...link, href: postHref } : link);

  function closeMenu() {
    setOpen(false);
  }

  return (
    <div className="lg:hidden">
      <button
        className="mobile-menu-button"
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-navigation"
        onClick={() => setOpen((current) => !current)}
      >
        {open ? (
          <X size={22} strokeWidth={2.5} />
        ) : (
          <span className="grid w-5 gap-1" aria-hidden="true">
            <span className="h-0.5 rounded-full bg-current" />
            <span className="h-0.5 rounded-full bg-current" />
            <span className="h-0.5 rounded-full bg-current" />
          </span>
        )}
      </button>

      {open ? (
        <div
          id="mobile-navigation"
          className="mobile-menu-panel"
        >
          <div className="container grid gap-2 p-0">
            {visibleLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-3 text-sm font-extrabold text-[var(--primary)] hover:bg-[var(--surface-soft)]"
                onClick={closeMenu}
              >
                {link.label}
              </Link>
            ))}
            {isAdmin ? (
              <Link
                href="/admin"
                className="rounded-lg px-3 py-3 text-sm font-extrabold text-[var(--primary)] hover:bg-[var(--surface-soft)]"
                onClick={closeMenu}
              >
                Admin
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const dashboardLinks = [
  { href: "/dashboard/profile", label: "Profile", icon: UserCircle },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/listings", label: "Your listings", icon: Package },
  { href: "/dashboard/wallet", label: "Wallet", icon: WalletCards },
  { href: "/dashboard/payouts", label: "Payouts", icon: BriefcaseBusiness },
  { href: "/dashboard/bids", label: "Bids", icon: Gavel },
  { href: "/dashboard/verification", label: "Verification", icon: ShieldCheck }
];

export function MobileDashboardMenu({
  initials,
  isAgent,
  isAuthenticated
}: {
  initials: string;
  isAgent: boolean;
  isAuthenticated: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (!isAuthenticated) {
    return null;
  }

  function closeMenu() {
    setOpen(false);
  }

  return (
    <div className="lg:hidden">
      <button
        className="mobile-dashboard-button"
        type="button"
        aria-label={open ? "Close dashboard menu" : "Open dashboard menu"}
        aria-expanded={open}
        aria-controls="mobile-dashboard-navigation"
        onClick={() => setOpen((current) => !current)}
      >
        {initials}
      </button>

      {open ? (
        <div
          id="mobile-dashboard-navigation"
          className="mobile-menu-panel"
        >
          <div className="container grid gap-2 p-0">
            {dashboardLinks.map((link) => {
              const Icon = link.icon;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="mobile-dashboard-link"
                  onClick={closeMenu}
                >
                  <Icon size={17} />
                  {link.label}
                </Link>
              );
            })}
            {isAgent ? (
              <Link
                href="/agent/dashboard"
                className="mobile-dashboard-link"
                onClick={closeMenu}
              >
                <BriefcaseBusiness size={17} />
                Agent dashboard
              </Link>
            ) : null}
            <form action={signOut} className="pt-2">
              <button className="button button-primary w-full" type="submit">
                Log out
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
