import Link from "next/link";
import { notFound } from "next/navigation";
import { Flag, ShieldAlert } from "lucide-react";
import { submitReport } from "@/app/actions";
import { getAuction } from "@/lib/supabase/queries";

export default async function ReportAuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auction = await getAuction(id);

  if (!auction) {
    notFound();
  }

  return (
    <main className="container py-10">
      <div className="mb-8">
        <span className="badge badge-premium"><ShieldAlert size={14} /> Listing safety</span>
        <h1 className="section-title mt-4">Report this listing</h1>
        <p className="mt-2 max-w-2xl text-[var(--muted)]">
          {auction.title}
        </p>
      </div>

      <section className="card max-w-2xl p-6">
        <form action={submitReport} className="space-y-4">
          <input type="hidden" name="auction_id" value={auction.id} />
          <input type="hidden" name="reported_user_id" value={auction.seller_id} />
          <div>
            <label className="text-sm font-extrabold text-[var(--primary)]">Reason</label>
            <select className="select mt-2" name="reason" required defaultValue="">
              <option value="" disabled>Choose a reason</option>
              <option value="misleading_listing">Misleading listing</option>
              <option value="counterfeit_or_stolen">Counterfeit or stolen item</option>
              <option value="unsafe_or_prohibited">Unsafe or prohibited item</option>
              <option value="seller_behavior">Seller behavior</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-extrabold text-[var(--primary)]">Details</label>
            <textarea className="textarea mt-2" name="details" maxLength={1000} placeholder="Add details for the Hazi.ng moderation team." />
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="button button-primary" type="submit"><Flag size={16} /> Send report</button>
            <Link href={`/auctions/${auction.id}`} className="button button-outline">Back to listing</Link>
          </div>
        </form>
      </section>
    </main>
  );
}
