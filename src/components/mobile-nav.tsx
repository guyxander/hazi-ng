"use client";

import Link from "next/link";
import {
  BriefcaseBusiness,
  Gavel,
  LayoutDashboard,
  Package,
  ShieldCheck,
  UserCircle,
  WalletCards
} from "lucide-react";
import { useState } from "react";
import { signOut } from "@/app/actions";

const dashboardLinks = [
  { href: "/dashboard/profile", label: "Profile", icon: UserCircle },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/listings", label: "Your listings", icon: Package },
  { href: "/dashboard/wallet", label: "Wallet", icon: WalletCards },
  { href: "/dashboard/payout-settings", label: "Payouts", icon: BriefcaseBusiness },
  { href: "/dashboard/bids", label: "Bids", icon: Gavel },
  { href: "/dashboard/verification", label: "Verification", icon: ShieldCheck }
];

export function MobileDashboardMenu({
  initials,
  isAdmin,
  canAccessAgentDashboard,
  isAuthenticated
}: {
  initials: string;
  isAdmin: boolean;
  canAccessAgentDashboard: boolean;
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
            {canAccessAgentDashboard ? (
              <Link
                href="/dashboard/agent"
                className="mobile-dashboard-link"
                onClick={closeMenu}
              >
                <BriefcaseBusiness size={17} />
                Agent dashboard
              </Link>
            ) : null}
            {isAdmin ? (
              <Link
                href="/admin"
                className="mobile-dashboard-link"
                onClick={closeMenu}
              >
                <ShieldCheck size={17} />
                Admin page
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
