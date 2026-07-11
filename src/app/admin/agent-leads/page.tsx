import { formatDateTime } from "@/lib/format";
import Link from "next/link";
import type { ReactNode } from "react";
import { BriefcaseBusiness, CheckCircle2, ClipboardCheck, PhoneCall } from "lucide-react";
import { updateAgentLeadStatus } from "@/app/actions";
import { requireAdmin } from "@/lib/supabase/admin";

export default async function AdminAgentLeadsPage() {
  const supabase = await requireAdmin("/admin/agent-leads");
  const [{ data: leads }, { data: agents }, { data: jobs }] = supabase
    ? await Promise.all([
      supabase
        .from("agent_leads")
        .select("id,full_name,phone,location,item_summary,preferred_schedule,budget,status,created_at,profiles!agent_leads_assigned_agent_id_fkey(full_name)")
        .order("created_at", { ascending: false })
        .limit(40),
      supabase
        .from("profiles")
        .select("id,full_name")
        .eq("role", "agent")
        .order("full_name"),
      supabase
        .from("agent_jobs")
        .select("id,status,commission_amount,commission_status,agent_id,created_at")
        .order("created_at", { ascending: false })
        .limit(20)
    ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  return (
    <main className="container py-10">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="badge badge-premium"><BriefcaseBusiness size={14} /> Agent operations</span>
          <h1 className="section-title mt-4">Agent lead queue</h1>
          <p className="mt-2 text-[var(--muted)]">Review customer declutter requests, mark contacted leads, assign ownership, and close completed requests.</p>
        </div>
        <Link href="/admin" className="button button-outline">Back to admin</Link>
      </div>

      <section className="card overflow-hidden">
        <div className="divide-y divide-[var(--line)]">
          {leads?.length ? leads.map((lead) => {
            const assignedAgent = Array.isArray(lead.profiles) ? lead.profiles[0] : lead.profiles;

            return (
              <div key={lead.id} className="grid gap-5 p-5 lg:grid-cols-[1fr_220px_310px]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-lg text-[var(--primary)]">{lead.full_name}</strong>
                    <span className="badge badge-trust capitalize">{lead.status}</span>
                  </div>
                  <p className="mt-2 text-sm font-bold text-[var(--muted)]">{lead.item_summary}</p>
                  <p className="mt-3 text-sm text-[var(--muted)]">
                    {lead.location} {lead.preferred_schedule ? `- ${lead.preferred_schedule}` : ""}
                  </p>
                </div>

                <div className="space-y-2 text-sm">
                  <p className="flex items-center gap-2 font-extrabold text-[var(--primary)]"><PhoneCall size={16} /> {lead.phone}</p>
                  <p className="font-bold text-[var(--muted)]">Budget: {lead.budget || "Not stated"}</p>
                  <p className="font-bold text-[var(--muted)]">Assigned: {assignedAgent?.full_name ?? "Unassigned"}</p>
                  <p className="font-bold text-[var(--muted)]">{formatDateTime(lead.created_at)}</p>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <LeadStatusButton leadId={lead.id} status="contacted" label="Contacted" icon={<PhoneCall size={16} />} />
                  <LeadStatusButton leadId={lead.id} status="assigned" label="Assign to me" icon={<ClipboardCheck size={16} />} />
                  <LeadStatusButton leadId={lead.id} status="closed" label="Close" icon={<CheckCircle2 size={16} />} primary />
                </div>
              </div>
            );
          }) : <p className="p-5 text-[var(--muted)]">No agent requests have been submitted yet.</p>}
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-2xl font-extrabold text-[var(--primary)]">Agent roster</h2>
          <div className="mt-4 space-y-3">
            {agents?.length ? agents.map((agent) => (
              <div key={agent.id} className="rounded-xl bg-[var(--surface-soft)] p-4">
                <strong>{agent.full_name}</strong>
              </div>
            )) : <p className="text-sm text-[var(--muted)]">No agents found.</p>}
          </div>
        </div>
        <div className="card p-5">
          <h2 className="text-2xl font-extrabold text-[var(--primary)]">Commission tracking</h2>
          <div className="mt-4 space-y-3">
            {jobs?.length ? jobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between rounded-xl bg-[var(--surface-soft)] p-4">
                <span className="font-bold capitalize">{job.status.replaceAll("_", " ")}</span>
                <span className="font-extrabold text-[var(--primary)]">{Number(job.commission_amount ?? 0).toLocaleString("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 })}</span>
              </div>
            )) : <p className="text-sm text-[var(--muted)]">No job commissions yet.</p>}
          </div>
        </div>
      </section>
    </main>
  );
}

function LeadStatusButton({
  leadId,
  status,
  label,
  icon,
  primary = false
}: {
  leadId: string;
  status: string;
  label: string;
  icon: ReactNode;
  primary?: boolean;
}) {
  return (
    <form action={updateAgentLeadStatus}>
      <input type="hidden" name="lead_id" value={leadId} />
      <input type="hidden" name="status" value={status} />
      <button className={`button ${primary ? "button-primary" : "button-outline"}`} type="submit">{icon}{label}</button>
    </form>
  );
}
