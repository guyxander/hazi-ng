import Link from "next/link";
import { Award, BriefcaseBusiness, ClipboardCheck, ShieldCheck } from "lucide-react";

export default function AgentPage() {
  return (
    <main className="container py-10">
      <section className="grid gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
        <div>
          <span className="badge badge-trust"><Award size={14} /> Hazi.ng declutter agents</span>
          <h1 className="section-title mt-4">Get help selling bulky items, bundles, and full clearouts.</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-[var(--muted)]">
            Hazi.ng agents help inspect items, prepare listings, manage auction activity, and support the sale workflow for users who need hands-on help.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/agent/request" className="button button-primary">Request an agent</Link>
            <Link href="/agent/apply" className="button button-accent">Become an agent</Link>
            <Link href="/sell" className="button button-outline">Post item yourself</Link>
          </div>
        </div>

        <aside className="card space-y-4 p-6">
          <h2 className="text-2xl font-extrabold text-[var(--primary)]">How agent-assisted sales work</h2>
          <div className="space-y-3 text-sm font-bold text-[var(--muted)]">
            <p className="flex gap-3"><ClipboardCheck className="shrink-0 text-[var(--primary)]" size={18} /> You send a request with item and pickup details.</p>
            <p className="flex gap-3"><BriefcaseBusiness className="shrink-0 text-[var(--primary)]" size={18} /> Hazi.ng assigns an approved agent to support the sale.</p>
            <p className="flex gap-3"><ShieldCheck className="shrink-0 text-[var(--primary)]" size={18} /> When an agent-assisted sale closes, the user receives 70%, the agent receives 21%, and Hazi.ng receives 9%.</p>
          </div>
        </aside>
      </section>
    </main>
  );
}
