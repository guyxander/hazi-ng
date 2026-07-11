import { formatDateTime } from "@/lib/format";
import { redirect } from "next/navigation";
import { LifeBuoy, ShieldCheck } from "lucide-react";
import { submitSupportTicket } from "@/app/actions";
import { getSafeUser } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SupportPage({
  searchParams
}: {
  searchParams?: Promise<{ ticket?: string; error?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return <main className="container py-10"><div className="card p-6">Supabase env is missing.</div></main>;
  }

  const user = await getSafeUser(supabase);

  if (!user) {
    redirect("/auth?next=/support");
  }

  const [{ data: tickets }, { data: profile }] = await Promise.all([
    supabase
      .from("support_tickets")
      .select("id,category,subject,status,priority,created_at,updated_at,resolved_at,admin_notes,escalation_level,escalation_reason,appeal_decision,appeal_decided_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("profiles")
      .select("account_status,suspension_reason")
      .eq("id", user.id)
      .maybeSingle()
  ]);

  const suspended = profile?.account_status === "suspended";

  return (
    <main className="container py-10">
      <div className="mb-8">
        <span className="badge badge-trust"><LifeBuoy size={14} /> Support</span>
        <h1 className="section-title mt-4">Safety and support hub</h1>
        <p className="mt-2 text-[var(--muted)]">Get help with escrow, delivery, bidding, account safety, and moderation decisions.</p>
      </div>

      {query?.ticket === "created" ? <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">Support ticket created.</div> : null}
      {query?.error === "missing" ? <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">Choose a category and describe the issue.</div> : null}
      {suspended ? (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-[#693c00]">
          Your account is suspended. You can submit a suspension appeal here for admin review.
          {profile?.suspension_reason ? <span className="mt-1 block">Reason: {profile.suspension_reason}</span> : null}
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Escrow", "Do not release funds until you receive and inspect the item."],
            ["Delivery", "Use provider tracking and report exceptions early."],
            ["Bidding", "Late bids are blocked after auction close; last-minute valid bids may extend the timer."]
          ].map(([title, copy]) => (
            <div key={title} className="card p-5">
              <ShieldCheck className="text-[var(--primary)]" />
              <h2 className="mt-3 text-xl font-extrabold text-[var(--primary)]">{title}</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">{copy}</p>
            </div>
          ))}
        </div>

        <form action={submitSupportTicket} className="card grid gap-3 p-5">
          <h2 className="text-2xl font-extrabold text-[var(--primary)]">Open a ticket</h2>
          <select className="select" name="category" required defaultValue={suspended ? "appeal" : ""}>
            <option value="" disabled>Choose category</option>
            <option value="escrow" disabled={suspended}>Escrow</option>
            <option value="delivery" disabled={suspended}>Delivery</option>
            <option value="bidding" disabled={suspended}>Bidding</option>
            <option value="kyc" disabled={suspended}>KYC / trust</option>
            <option value="safety" disabled={suspended}>Safety report</option>
            <option value="agent_application" disabled={suspended}>Agent application</option>
            <option value="appeal">Suspension appeal</option>
          </select>
          <p className="rounded-xl bg-[var(--surface-soft)] p-3 text-xs font-bold text-[var(--muted)]">
            Suspension appeals are automatically escalated to urgent admin review.
          </p>
          <input className="input" name="subject" placeholder="Subject" required />
          <textarea className="textarea min-h-[140px]" name="description" placeholder="Tell support what happened." required />
          <button className="button button-primary" type="submit">Submit ticket</button>
        </form>
      </section>

      <section className="card mt-8 overflow-hidden">
        <div className="border-b border-[var(--line)] p-5">
          <h2 className="text-2xl font-extrabold text-[var(--primary)]">Your tickets</h2>
        </div>
        <div className="divide-y divide-[var(--line)]">
          {tickets?.length ? tickets.map((ticket) => (
            <article key={ticket.id} className="grid gap-3 p-5 md:grid-cols-[1fr_140px]">
              <div>
                <strong className="text-[var(--primary)]">{ticket.subject}</strong>
                <p className="mt-1 text-sm text-[var(--muted)]">{ticket.category} - {ticket.priority}</p>
                {ticket.escalation_level > 0 ? <p className="mt-1 text-sm font-bold text-[#693c00]">Escalated level {ticket.escalation_level}</p> : null}
                {ticket.escalation_reason ? <p className="mt-1 text-sm text-[var(--muted)]">{ticket.escalation_reason}</p> : null}
                {ticket.appeal_decision ? <p className="mt-1 text-sm font-bold text-[var(--primary)]">Appeal: {ticket.appeal_decision.replaceAll("_", " ")}</p> : null}
                {ticket.appeal_decided_at ? <p className="mt-1 text-xs font-bold text-[var(--muted)]">Appeal updated {formatDateTime(ticket.appeal_decided_at)}</p> : null}
                {ticket.resolved_at ? <p className="mt-1 text-xs font-bold text-[var(--muted)]">Resolved {formatDateTime(ticket.resolved_at)}</p> : null}
                <p className="mt-1 text-xs font-bold text-[var(--muted)]">Last updated {formatDateTime(ticket.updated_at ?? ticket.created_at)}</p>
                {ticket.admin_notes ? <p className="mt-1 text-sm text-[var(--muted)]">{ticket.admin_notes}</p> : null}
              </div>
              <span className="badge badge-live capitalize md:justify-self-end">{ticket.status.replaceAll("_", " ")}</span>
            </article>
          )) : <p className="p-5 text-[var(--muted)]">No tickets yet.</p>}
        </div>
      </section>
    </main>
  );
}
