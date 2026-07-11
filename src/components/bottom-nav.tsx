"use client";

import Link from "next/link";
import { Bookmark, Home, LayoutDashboard, MessageCircle, PlusSquare } from "lucide-react";
import { useEffect, useState } from "react";

export function BottomNav({ postHref = "/sell" }: { postHref?: string }) {
  const [visible, setVisible] = useState(true);
  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/dashboard/watchlist", label: "Saved", icon: Bookmark },
    { href: postHref, label: "Post", icon: PlusSquare },
    { href: "/dashboard/orders", label: "Escrow", icon: MessageCircle },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }
  ];

  useEffect(() => {
    let previousY = window.scrollY;

    function handleScroll() {
      const currentY = window.scrollY;
      const delta = currentY - previousY;

      if (Math.abs(delta) > 8) {
        setVisible(delta > 0);
        previousY = currentY;
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className={`bottom-nav ${visible ? "bottom-nav--visible" : "bottom-nav--hidden"}`} aria-label="Primary mobile navigation">
      {navItems.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} className="bottom-nav__item">
          <Icon size={20} aria-hidden="true" />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
