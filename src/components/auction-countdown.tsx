"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock } from "lucide-react";

type AuctionCountdownProps = {
  endsAt: string | null;
  status: string;
  compact?: boolean;
};

function formatRemaining(milliseconds: number) {
  if (milliseconds <= 0) {
    return "Ended";
  }

  const totalSeconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

export function AuctionCountdown({ endsAt, status, compact = false }: AuctionCountdownProps) {
  const endTime = useMemo(() => endsAt ? new Date(endsAt).getTime() : null, [endsAt]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!endTime || status !== "active") {
    return null;
  }

  const remaining = now > 0 ? endTime - now : null;

  if (compact) {
    return (
      <div className="flex items-center gap-1 rounded-lg bg-[rgba(0,52,43,0.88)] px-2 py-1 text-[11px] font-extrabold text-white shadow-lg sm:text-xs">
        <Clock size={12} />
        <span>{remaining === null ? "Starting..." : formatRemaining(remaining)}</span>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] px-4 py-3 text-sm font-extrabold text-[var(--primary)]">
      <Clock size={16} />
      <span>{remaining === null ? "Starting..." : formatRemaining(remaining)}</span>
      {remaining !== null && remaining > 0 && remaining <= 5 * 60 * 1000 ? <span className="badge badge-premium">Anti-sniping active</span> : null}
    </div>
  );
}
