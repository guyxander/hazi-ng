"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyReferralLink({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
      <p className="min-w-0 break-all rounded-xl bg-[var(--surface-soft)] p-3 text-sm font-bold text-[var(--primary)]">
        {value}
      </p>
      <button className="button button-primary" type="button" onClick={copyLink}>
        {copied ? <Check size={17} /> : <Copy size={17} />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
