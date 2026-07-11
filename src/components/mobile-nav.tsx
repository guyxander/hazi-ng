"use client";

import Link from "next/link";
import { Bell, X } from "lucide-react";
import { useState } from "react";
import { signOut } from "@/app/actions";

const links = [
  { href: "/auctions", label: "Auctions" },
  { href: "/sell", label: "Sell" },
  { href: "/agent", label: "Agents" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/support", label: "Support" },
  { href: "/admin", label: "Admin" }
];

export function MobileNav({
  isAuthenticated,
  isAdmin,
  unreadNotifications,
  postHref = "/sell"
}: {
  isAuthenticated: boolean;
  isAdmin: boolean;
  unreadNotifications: number;
  postHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const visibleLinks = (isAdmin ? links : links.filter((link) => link.href !== "/admin"))
    .map((link) => link.href === "/sell" ? { ...link, href: postHref } : link);

  function closeMenu() {
    setOpen(false);
  }

  return (
    <div className="lg:hidden">
      <button
        className="grid size-12 shrink-0 place-items-center rounded-lg border border-[var(--primary)] text-[var(--primary)]"
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
          className="absolute inset-x-0 top-16 border-b border-[var(--line)] bg-[var(--surface)] px-5 py-4 shadow-lg"
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
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <Link href="/dashboard/notifications" className="button button-outline relative" onClick={closeMenu}>
                <Bell size={17} />
                Alerts
                {unreadNotifications ? (
                  <span className="notification-count">{unreadNotifications > 99 ? "99+" : unreadNotifications}</span>
                ) : null}
              </Link>
              {isAuthenticated ? (
                <form action={signOut}>
                  <button className="button button-primary w-full" type="submit">
                    Log out
                  </button>
                </form>
              ) : (
                <Link href="/auth" className="button button-primary" onClick={closeMenu}>
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
