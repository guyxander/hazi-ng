"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type TransactionRealtimeRefreshProps = {
  transactionId: string;
};

export function TransactionRealtimeRefresh({ transactionId }: TransactionRealtimeRefreshProps) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const refreshSoon = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => router.refresh(), 500);
    };
    const channel = supabase
      .channel(`transaction-live:${transactionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter: `id=eq.${transactionId}` }, refreshSoon)
      .on("postgres_changes", { event: "*", schema: "public", table: "transaction_messages", filter: `transaction_id=eq.${transactionId}` }, refreshSoon)
      .on("postgres_changes", { event: "*", schema: "public", table: "transaction_payments", filter: `transaction_id=eq.${transactionId}` }, refreshSoon)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_orders", filter: `transaction_id=eq.${transactionId}` }, refreshSoon)
      .subscribe();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      void supabase.removeChannel(channel);
    };
  }, [router, transactionId]);

  return null;
}
