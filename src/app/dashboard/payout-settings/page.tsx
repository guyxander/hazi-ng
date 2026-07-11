import Link from "next/link";
import { redirect } from "next/navigation";
import { Landmark } from "lucide-react";
import { updatePayoutSettings } from "@/app/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function PayoutSettingsPage({
  searchParams
}: {
  searchParams?: Promise<{ saved?: string; error?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return <main className="container py-10"><div className="card p-6">Supabase env is missing.</div></main>;
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/dashboard/payout-settings");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("payout_bank_name,payout_account_number,payout_account_name,payout_bank_code,payout_verified_at,payout_provider_reference")
    .eq("id", user.id)
    .single();

  return (
    <main className="container py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="badge badge-trust"><Landmark size={14} /> Payout settings</span>
          <h1 className="section-title mt-4">Bank payout verification</h1>
          <p className="mt-2 text-[var(--muted)]">Save the bank account Hazi.ng should use for seller, agent, and refund withdrawals.</p>
        </div>
        <Link href="/dashboard/wallet" className="button button-outline">Wallet</Link>
      </div>

      {query?.saved ? <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">Payout settings saved and ready for admin payout review.</div> : null}
      {query?.error === "missing" ? <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">Bank name, account number, and account name are required.</div> : null}

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <form action={updatePayoutSettings} className="card grid gap-4 p-6">
          <input className="input" name="payout_bank_name" defaultValue={profile?.payout_bank_name ?? ""} placeholder="Bank name" required />
          <div className="grid gap-4 md:grid-cols-2">
            <input className="input" name="payout_account_number" defaultValue={profile?.payout_account_number ?? ""} placeholder="Account number" required />
            <input className="input" name="payout_bank_code" defaultValue={profile?.payout_bank_code ?? ""} placeholder="Bank code, optional" />
          </div>
          <input className="input" name="payout_account_name" defaultValue={profile?.payout_account_name ?? ""} placeholder="Account name" required />
          <button className="button button-primary" type="submit">Save payout account</button>
        </form>

        <aside className="card p-6">
          <h2 className="text-2xl font-extrabold text-[var(--primary)]">Verification status</h2>
          <p className="mt-4 text-sm font-bold text-[var(--muted)]">Status</p>
          <p className="mt-1 text-2xl font-extrabold text-[var(--primary)]">{profile?.payout_verified_at ? "Verified" : "Not verified"}</p>
          <p className="mt-4 text-sm text-[var(--muted)]">Reference: {profile?.payout_provider_reference ?? "Pending"}</p>
        </aside>
      </section>
    </main>
  );
}
