import { redirect } from "next/navigation";
import { SellPublishForm } from "@/components/sell-publish-form";
import { canUseAgentDashboard } from "@/lib/roles";
import { getCategories } from "@/lib/supabase/queries";
import { getSafeUser } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AgentSellPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const categories = await getCategories();
  const supabase = await createSupabaseServerClient();
  const user = await getSafeUser(supabase);

  if (!user) {
    redirect("/auth?next=/sell/agent");
  }

  const [{ data: profile }, { data: activePremium }, { data: agentJobs }] = supabase
    ? await Promise.all([
        supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
        supabase
          .from("premium_subscriptions")
          .select("plan")
          .eq("user_id", user.id)
          .is("auction_id", null)
          .eq("plan", "premium_agent")
          .eq("status", "active")
          .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
          .limit(1)
          .maybeSingle(),
        supabase
          .from("agent_jobs")
          .select("id,requester_id,status,agent_leads(full_name,item_summary,location)")
          .eq("agent_id", user.id)
          .neq("status", "cancelled")
          .order("created_at", { ascending: false })
          .limit(50)
      ])
    : [{ data: null }, { data: null }, { data: [] }];

  if (!canUseAgentDashboard(profile?.role, activePremium?.plan)) {
    redirect("/agent/apply");
  }

  const agentJobOptions = (agentJobs ?? []).map((job) => {
    const lead = Array.isArray(job.agent_leads) ? job.agent_leads[0] : job.agent_leads;

    return {
      id: job.id,
      label: `${lead?.full_name ?? "Assigned user"} - ${lead?.item_summary ?? "Agent sale"}`,
      status: job.status,
      location: lead?.location ?? null
    };
  });

  const errorMessages: Record<string, string> = {
    "pickup-location": "Choose a suggested pickup address or use your current location before publishing the auction.",
    "missing-fields": "Complete the title, description, and seller price before publishing the auction.",
    "image-type": "Upload JPEG, PNG, WebP, or GIF images only.",
    "image-size": "Each auction photo must be 5MB or smaller.",
    "image-upload": "We could not upload the photos. Try smaller images or a stronger connection.",
    "image-save": "Your auction was created, but the photos could not be attached. Please try again.",
    "publish-failed": "We could not publish the auction yet. Please try again.",
    "agent-job": "Choose a valid assigned client before publishing an agent listing."
  };
  const errorMessage = params?.error ? errorMessages[params.error] : null;

  return (
    <main className="container py-10">
      <div className="mb-8">
        <span className="badge badge-premium">Agent workflow</span>
        <h1 className="section-title mt-4">Post an auction for a client</h1>
        <p className="mt-2 max-w-2xl text-[var(--muted)]">Every agent listing must be tied to an assigned client so payouts split correctly when escrow is released.</p>
      </div>

      {errorMessage ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <SellPublishForm categories={categories} agentJobs={agentJobOptions} agentModeRequired returnTo="/sell/agent" />
    </main>
  );
}
