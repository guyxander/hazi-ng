import { redirect } from "next/navigation";
import { BriefcaseBusiness, ShieldCheck } from "lucide-react";
import { submitSupportTicket } from "@/app/actions";
import { getSafeUser } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AgentApplyPage({
  searchParams
}: {
  searchParams?: Promise<{ ticket?: string; error?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const user = await getSafeUser(supabase);

  if (!user) {
    redirect("/auth?next=/agent/apply");
  }

  const { data: profile } = supabase
    ? await supabase.from("profiles").select("full_name,phone,location").eq("id", user.id).maybeSingle()
    : { data: null };

  return (
    <main className="container py-10">
      <div className="mb-8">
        <span className="badge badge-trust"><BriefcaseBusiness size={14} /> Agent application</span>
        <h1 className="section-title mt-4">Apply to become a Hazi.ng agent</h1>
        <p className="mt-2 max-w-2xl text-[var(--muted)]">
          Tell Hazi.ng where you operate, what items you can inspect/list, and your experience. Admin will review your application before assigning the agent role.
        </p>
      </div>

      {query?.ticket === "created" ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          Agent application submitted. Admin will review it.
        </div>
      ) : null}
      {query?.error === "missing" ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          Complete the required fields before submitting your application.
        </div>
      ) : null}

      <section className="grid gap-8 lg:grid-cols-[1fr_420px]">
        <form action={submitSupportTicket} className="card grid gap-4 p-6">
          <input type="hidden" name="category" value="agent_application" />
          <input type="hidden" name="return_to" value="/agent/apply" />
          <input type="hidden" name="subject" value="Agent application" />

          <div className="grid gap-3 sm:grid-cols-2">
            <input className="input" name="full_name_display" defaultValue={profile?.full_name ?? user.email?.split("@")[0] ?? ""} placeholder="Full name" disabled />
            <input className="input" name="phone_display" defaultValue={profile?.phone ?? ""} placeholder="Phone number saved on profile" disabled />
          </div>
          <textarea
            className="textarea min-h-[180px]"
            name="description"
            required
            placeholder="Include your city/coverage area, item categories you can handle, availability, experience, and why Hazi.ng should approve you as an agent."
          />
          <button className="button button-primary" type="submit">Submit agent application</button>
        </form>

        <aside className="card space-y-4 p-6">
          <h2 className="text-2xl font-extrabold text-[var(--primary)]">Before approval</h2>
          <p className="flex gap-3 text-sm font-bold text-[var(--muted)]"><ShieldCheck className="shrink-0 text-[var(--primary)]" size={18} /> Complete profile and identity verification to improve approval chances.</p>
          <p className="flex gap-3 text-sm font-bold text-[var(--muted)]"><ShieldCheck className="shrink-0 text-[var(--primary)]" size={18} /> Admin must assign the `agent` role before the agent dashboard appears.</p>
          <p className="flex gap-3 text-sm font-bold text-[var(--muted)]"><ShieldCheck className="shrink-0 text-[var(--primary)]" size={18} /> Agent-assisted sales split proceeds as 70% user, 21% agent, and 9% Hazi.ng.</p>
        </aside>
      </section>
    </main>
  );
}
