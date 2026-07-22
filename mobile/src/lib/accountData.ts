import type { UserRole } from "../types";
import { supabase } from "./marketplace";

export type AccountSummaryTile = { label: string; value: string };
export type AccountSummaryRow = { id: string; title: string; detail: string; status: string };
export type AccountSectionData = { status: string; tiles: AccountSummaryTile[]; rows: AccountSummaryRow[] };
export type DataAccountSection = "wallet" | "payouts" | "listings" | "agent";

const money = (value: unknown) => Number(value ?? 0).toLocaleString("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

function assertQuery(error: { message: string } | null, label: string) {
  if (error) throw new Error(`Could not load ${label}: ${error.message}`);
}

export async function loadAccountSectionData(section: DataAccountSection, userId: string, role: UserRole): Promise<AccountSectionData> {
  if (!supabase) throw new Error("Hazi mobile is not connected to Supabase.");

  if (section === "wallet") {
    const [{ data: wallet, error: walletError }, { data: ledger, error: ledgerError }] = await Promise.all([
      supabase.from("wallet_accounts").select("available_balance,escrow_balance,earnings_balance,refund_balance,pending_withdrawal_balance").eq("user_id", userId).maybeSingle(),
      supabase.from("wallet_ledger_entries").select("id,amount,direction,balance_bucket,status,description,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(8)
    ]);
    assertQuery(walletError, "wallet balance");
    assertQuery(ledgerError, "wallet activity");
    return {
      status: money(wallet?.available_balance),
      tiles: [
        { label: "Escrow hold", value: money(wallet?.escrow_balance) },
        { label: "Seller earnings", value: money(wallet?.earnings_balance) },
        { label: "Buyer refunds", value: money(wallet?.refund_balance) },
        { label: "Pending payout", value: money(wallet?.pending_withdrawal_balance) }
      ],
      rows: (ledger ?? []).map((entry) => ({ id: entry.id, title: entry.description || entry.balance_bucket.replaceAll("_", " "), detail: `${entry.direction === "credit" ? "+" : "−"}${money(entry.amount)}`, status: entry.status }))
    };
  }

  if (section === "payouts") {
    const { data: profile, error } = await supabase.from("profiles").select("payout_bank_name,payout_account_number,payout_account_name,payout_verified_at,payout_provider_reference").eq("id", userId).maybeSingle();
    assertQuery(error, "payout settings");
    const maskedNumber = profile?.payout_account_number ? `•••• ${profile.payout_account_number.slice(-4)}` : "Not provided";
    return {
      status: profile?.payout_verified_at ? "Verified" : "Not verified",
      tiles: [
        { label: "Bank", value: profile?.payout_bank_name || "Not provided" },
        { label: "Account", value: maskedNumber },
        { label: "Account name", value: profile?.payout_account_name || "Not provided" },
        { label: "Reference", value: profile?.payout_provider_reference || "Pending" }
      ], rows: []
    };
  }

  if (section === "listings") {
    const { data: listings, error } = await supabase.from("auctions").select("id,title,status,current_bid,seller_price,is_premium,seller_id,created_at").or(`seller_id.eq.${userId},listed_for_user_id.eq.${userId}`).order("created_at", { ascending: false }).limit(30);
    assertQuery(error, "listings");
    const active = listings?.filter((listing) => listing.status === "active").length ?? 0;
    return {
      status: `${listings?.length ?? 0} total`,
      tiles: [{ label: "Active", value: String(active) }, { label: "Other statuses", value: String((listings?.length ?? 0) - active) }],
      rows: (listings ?? []).map((listing) => ({ id: listing.id, title: listing.title, detail: money(listing.current_bid || listing.seller_price), status: listing.seller_id === userId ? listing.status : `agent managed · ${listing.status}` }))
    };
  }

  const { data: premium, error: premiumError } = await supabase.from("premium_subscriptions").select("plan").eq("user_id", userId).is("auction_id", null).eq("plan", "premium_agent").eq("status", "active").or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`).limit(1).maybeSingle();
  assertQuery(premiumError, "agent entitlement");
  const canUseWorkspace = role === "agent" || premium?.plan === "premium_agent";
  if (!canUseWorkspace) return { status: "Not an agent", tiles: [], rows: [] };

  const [{ data: leads, error: leadsError }, { data: jobs, error: jobsError }] = await Promise.all([
    supabase.from("agent_leads").select("id,item_summary,location,status,created_at").eq("assigned_agent_id", userId).order("created_at", { ascending: false }).limit(20),
    supabase.from("agent_jobs").select("id,status,commission_amount,commission_status,created_at").eq("agent_id", userId).order("created_at", { ascending: false }).limit(20)
  ]);
  assertQuery(leadsError, "assigned agent requests");
  assertQuery(jobsError, "agent jobs");
  const activeLeads = leads?.filter((lead) => lead.status !== "closed").length ?? 0;
  return {
    status: "Agent access",
    tiles: [{ label: "Active requests", value: String(activeLeads) }, { label: "Jobs", value: String(jobs?.length ?? 0) }],
    rows: [
      ...(leads ?? []).map((lead) => ({ id: `lead-${lead.id}`, title: lead.item_summary, detail: lead.location, status: lead.status })),
      ...(jobs ?? []).map((job) => ({ id: `job-${job.id}`, title: "Agent job", detail: `Commission ${money(job.commission_amount)}`, status: `${job.status} · ${job.commission_status}` }))
    ]
  };
}
