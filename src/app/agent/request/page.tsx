import { formatDate } from "@/lib/format";
import { redirect } from "next/navigation";
import { MessageSquareText } from "lucide-react";
import { submitAgentLead } from "@/app/actions";
import { AgentSearchSelect } from "@/components/agent-search-select";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AgentRequestPage() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/agent/request");
  }

  const [{ data: profile }, { data: leads }, { data: agents }] = supabase
    ? await Promise.all([
        supabase.from("profiles").select("full_name,phone,location").eq("id", user.id).maybeSingle(),
        supabase
          .from("agent_leads")
          .select("id,item_summary,location,status,created_at,preferred_schedule")
          .eq("requester_id", user.id)
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("public_profiles")
          .select("id,full_name,location")
          .eq("role", "agent")
          .order("full_name", { ascending: true })
          .limit(100)
      ])
    : [{ data: null }, { data: [] }, { data: [] }];

  return (
    <main className="container py-10">
      <div className="mb-8">
        <span className="badge badge-trust"><MessageSquareText size={14} /> Agent request</span>
        <h1 className="section-title mt-4">Request a Hazi.ng agent</h1>
        <p className="mt-2 max-w-2xl text-[var(--muted)]">Send the details of what you want to sell. A Hazi.ng operator can route your request to an approved agent.</p>
      </div>

      <section className="grid gap-8 lg:grid-cols-[1fr_420px]">
        <form action={submitAgentLead} className="card space-y-4 p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="input" name="full_name" required defaultValue={profile?.full_name ?? user.email?.split("@")[0] ?? ""} placeholder="Full name" />
            <input className="input" name="phone" required defaultValue={profile?.phone ?? ""} placeholder="+234..." />
          </div>
          <input className="input" name="location" required defaultValue={profile?.location ?? "Lagos"} placeholder="Pickup location" />
          <textarea className="textarea" name="item_summary" required placeholder="Tell us what you want to sell, quantity, condition, and pickup notes." />
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="input" name="preferred_schedule" placeholder="Preferred day/time" />
            <input className="input" name="budget" placeholder="Expected value or reserve" />
          </div>
          <AgentSearchSelect agents={agents ?? []} />
          <button className="button button-primary w-full" type="submit">Send request</button>
        </form>

        <aside className="card overflow-hidden">
          <div className="border-b border-[var(--line)] p-5">
            <h2 className="text-2xl font-extrabold text-[var(--primary)]">Your requests</h2>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {leads?.length ? leads.map((lead) => (
              <div key={lead.id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="line-clamp-2">{lead.item_summary}</strong>
                  <span className="badge badge-trust capitalize">{lead.status}</span>
                </div>
                <p className="mt-2 text-sm font-bold text-[var(--muted)]">{lead.location} {lead.preferred_schedule ? `- ${lead.preferred_schedule}` : ""}</p>
                <p className="mt-1 text-xs font-bold text-[var(--muted)]">{formatDate(lead.created_at)}</p>
              </div>
            )) : <p className="p-5 text-[var(--muted)]">No agent requests yet.</p>}
          </div>
        </aside>
      </section>
    </main>
  );
}
