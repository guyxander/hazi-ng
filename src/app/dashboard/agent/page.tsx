import { formatDateTime } from "@/lib/format";
import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { BriefcaseBusiness, CheckCircle2, ClipboardCheck, PhoneCall, ShieldCheck } from "lucide-react";
import { claimAgentLead, updateAgentJobStatus, updateAssignedAgentLeadStatus } from "@/app/actions";
import { StatCard } from "@/components/stat-card";
import { canUseAgentDashboard } from "@/lib/roles";
import { getSafeUser } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AgentDashboardPage() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return <MissingSupabase />;
  }

  const user = await getSafeUser(supabase);

  if (!user) {
    redirect("/auth?next=/dashboard/agent");
  }

  const [{ data: profile }, { data: activePremium }] = await Promise.all([
    supabase
    .from("profiles")
    .select("full_name,role,verification_status,response_rate,rating")
    .eq("id", user.id)
      .single(),
    supabase
      .from("premium_subscriptions")
      .select("plan")
      .eq("user_id", user.id)
      .is("auction_id", null)
      .eq("plan", "premium_agent")
      .eq("status", "active")
      .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
      .limit(1)
      .maybeSingle()
  ]);

  const isAgent = canUseAgentDashboard(profile?.role, activePremium?.plan);

  if (!isAgent) {
    redirect("/agent/apply");
  }

  const [{ data: assignedLeads }, { data: availableLeads }, { count: closedCount }, { data: jobs }] = await Promise.all([
    supabase
      .from("agent_leads")
      .select("id,full_name,phone,location,item_summary,preferred_schedule,budget,status,created_at")
      .eq("assigned_agent_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("agent_leads")
      .select("id,full_name,phone,location,item_summary,preferred_schedule,budget,status,created_at")
      .is("assigned_agent_id", null)
      .in("status", ["new", "contacted"])
      .order("created_at", { ascending: true })
      .limit(10),
    supabase
      .from("agent_leads")
      .select("*", { count: "exact", head: true })
      .eq("assigned_agent_id", user.id)
      .eq("status", "closed"),
    supabase
      .from("agent_jobs")
      .select("id,status,scheduled_at,commission_amount,commission_status,notes,created_at")
      .eq("agent_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  const activeAssigned = assignedLeads?.filter((lead) => lead.status !== "closed").length ?? 0;

  return (
    <main className="container py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="badge badge-trust"><ShieldCheck size={14} /> {profile?.verification_status ?? "verification pending"}</span>
          <h1 className="section-title mt-4">Agent workspace</h1>
          <p className="mt-2 text-[var(--muted)]">Claim declutter requests, contact customers, and move assigned leads through the service pipeline.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/agent/request" className="button button-outline">Customer request page</Link>
          <Link href="/sell/agent" className="button button-primary">Create client auction</Link>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard icon={BriefcaseBusiness} label="Assigned" value={String(assignedLeads?.length ?? 0)} hint="Total leads in your workspace." />
        <StatCard icon={PhoneCall} label="Active" value={String(activeAssigned)} hint="Needs follow-up or listing work." />
        <StatCard icon={CheckCircle2} label="Closed" value={String(closedCount ?? 0)} hint="Completed declutter requests." />
        <StatCard icon={ShieldCheck} label="Response" value={`${profile?.response_rate ?? 90}%`} hint="Agent trust signal." />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="card overflow-hidden">
          <div className="border-b border-[var(--line)] p-5">
            <h2 className="text-2xl font-extrabold text-[var(--primary)]">Assigned leads</h2>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {assignedLeads?.length ? assignedLeads.map((lead) => (
              <AgentLeadCard key={lead.id} lead={lead} assigned />
            )) : <p className="p-5 text-[var(--muted)]">No assigned leads yet. Claim an available request to start.</p>}
          </div>
        </div>

        <aside className="card overflow-hidden">
          <div className="border-b border-[var(--line)] p-5">
            <h2 className="text-2xl font-extrabold text-[var(--primary)]">Available requests</h2>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {availableLeads?.length ? availableLeads.map((lead) => (
              <AgentLeadCard key={lead.id} lead={lead} />
            )) : <p className="p-5 text-[var(--muted)]">No unassigned requests waiting right now.</p>}
          </div>
        </aside>
      </section>

      <section className="card mt-8 overflow-hidden">
        <div className="border-b border-[var(--line)] p-5">
          <h2 className="text-2xl font-extrabold text-[var(--primary)]">Agent jobs and commissions</h2>
        </div>
        <div className="divide-y divide-[var(--line)]">
          {jobs?.length ? jobs.map((job) => (
            <article key={job.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_260px]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-[var(--primary)]">Job {job.id.slice(0, 8)}</strong>
                  <span className="badge badge-trust capitalize">{job.status.replaceAll("_", " ")}</span>
                  <span className="badge badge-live capitalize">{job.commission_status.replaceAll("_", " ")}</span>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">Commission: {Number(job.commission_amount ?? 0).toLocaleString("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 })}</p>
                {job.notes ? <p className="mt-1 text-sm text-[var(--muted)]">{job.notes}</p> : null}
              </div>
              <form action={updateAgentJobStatus} className="grid gap-2">
                <input type="hidden" name="job_id" value={job.id} />
                <select className="select" name="status" defaultValue={job.status}>
                  <option value="assigned">Assigned</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="in_progress">In progress</option>
                  <option value="inventory_ready">Inventory ready</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <input className="input" name="commission_amount" type="number" step="100" min="0" defaultValue={Number(job.commission_amount ?? 0)} />
                <input className="input" name="notes" defaultValue={job.notes ?? ""} placeholder="Job notes" />
                <button className="button button-primary" type="submit">Update job</button>
              </form>
            </article>
          )) : <p className="p-5 text-[var(--muted)]">No agent jobs assigned yet.</p>}
        </div>
      </section>
    </main>
  );
}

function AgentLeadCard({
  lead,
  assigned = false
}: {
  lead: {
    id: string;
    full_name: string;
    phone: string;
    location: string;
    item_summary: string;
    preferred_schedule: string | null;
    budget: string | null;
    status: string;
    created_at: string;
  };
  assigned?: boolean;
}) {
  return (
    <div className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        <strong className="text-[var(--primary)]">{lead.full_name}</strong>
        <span className="badge badge-trust capitalize">{lead.status}</span>
      </div>
      <p className="mt-2 text-sm font-bold text-[var(--muted)]">{lead.item_summary}</p>
      <div className="mt-3 grid gap-2 text-sm text-[var(--muted)]">
        <p className="font-bold">{lead.location} {lead.preferred_schedule ? `- ${lead.preferred_schedule}` : ""}</p>
        <p className="font-bold">Phone: {lead.phone}</p>
        <p className="font-bold">Budget: {lead.budget || "Not stated"}</p>
        <p>{formatDateTime(lead.created_at)}</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {assigned ? (
          <>
            <AssignedLeadStatusButton leadId={lead.id} status="contacted" label="Contacted" icon={<PhoneCall size={16} />} />
            <AssignedLeadStatusButton leadId={lead.id} status="closed" label="Close" icon={<CheckCircle2 size={16} />} primary />
          </>
        ) : (
          <form action={claimAgentLead}>
            <input type="hidden" name="lead_id" value={lead.id} />
            <button className="button button-primary" type="submit"><ClipboardCheck size={16} /> Claim</button>
          </form>
        )}
      </div>
    </div>
  );
}

function AssignedLeadStatusButton({
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
    <form action={updateAssignedAgentLeadStatus}>
      <input type="hidden" name="lead_id" value={leadId} />
      <input type="hidden" name="status" value={status} />
      <button className={`button ${primary ? "button-primary" : "button-outline"}`} type="submit">{icon}{label}</button>
    </form>
  );
}

function MissingSupabase() {
  return (
    <main className="container py-10">
      <div className="card p-6">
        <h1 className="text-3xl font-extrabold text-[var(--primary)]">Supabase env is missing</h1>
      </div>
    </main>
  );
}
