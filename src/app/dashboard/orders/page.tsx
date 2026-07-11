import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageSquareText, PackageCheck, Search } from "lucide-react";
import { formatNaira } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type OrdersPageProps = {
  searchParams: Promise<{
    role?: string;
    status?: string;
  }>;
};

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return (
      <main className="container py-10">
        <div className="card p-6">Add Supabase environment variables to view orders.</div>
      </main>
    );
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/dashboard/orders");
  }

  const role = params.role === "sales" || params.role === "purchases" ? params.role : "all";
  const status = params.status ?? "";

  let query = supabase
    .from("transactions")
    .select(`
      id,
      auction_id,
      buyer_id,
      seller_id,
      amount,
      status,
      created_at,
      auctions(id,title,location,auction_images(image_url,alt_text,position))
    `)
    .order("created_at", { ascending: false });

  if (role === "sales") {
    query = query.eq("seller_id", user.id);
  } else if (role === "purchases") {
    query = query.eq("buyer_id", user.id);
  } else {
    query = query.or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const { data: orders } = await query;
  const counterpartyIds = [...new Set((orders ?? []).flatMap((order) => [
    order.buyer_id,
    order.seller_id
  ]).filter(Boolean))];
  const { data: profiles } = counterpartyIds.length
    ? await supabase.from("public_profiles").select("id,full_name,verification_status").in("id", counterpartyIds)
    : { data: [] };
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return (
    <main className="container py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="badge badge-trust"><PackageCheck size={14} /> Escrow</span>
          <h1 className="section-title mt-4">Escrow chats</h1>
          <p className="mt-2 max-w-2xl text-[var(--muted)]">Track accepted auctions, escrow status, counterparties, and linked transaction chats.</p>
        </div>
        <Link href="/dashboard" className="button button-outline">Back to dashboard</Link>
      </div>

      <form action="/dashboard/orders" className="card mb-8 grid gap-3 p-4 md:grid-cols-[1fr_220px_160px]">
        <label className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
          <select className="select pl-10" name="role" defaultValue={role}>
            <option value="all">All orders</option>
            <option value="purchases">Purchases</option>
            <option value="sales">Sales</option>
          </select>
        </label>
        <select className="select" name="status" defaultValue={status}>
          <option value="">Any status</option>
          <option value="escrow_pending">Escrow pending</option>
          <option value="paid">Paid</option>
          <option value="released">Released</option>
          <option value="refunded">Refunded</option>
          <option value="disputed">Disputed</option>
        </select>
        <button className="button button-primary" type="submit">Filter</button>
      </form>

      <section className="card overflow-hidden">
        <div className="divide-y divide-[var(--line)]">
          {orders?.length ? orders.map((order) => {
            const auction = Array.isArray(order.auctions) ? order.auctions[0] : order.auctions;
            const mineAsSeller = order.seller_id === user.id;
            const buyer = profileById.get(order.buyer_id);
            const seller = profileById.get(order.seller_id);
            const counterparty = mineAsSeller ? buyer : seller;

            return (
              <article key={order.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_180px_180px_150px]">
                <div>
                  <Link href={`/transactions/${order.id}`} className="font-extrabold text-[var(--primary)] hover:underline">
                    {auction?.title ?? "Accepted auction"}
                  </Link>
                  <p className="mt-1 text-sm font-bold text-[var(--muted)]">{auction?.location ?? "Location pending"}</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {mineAsSeller ? "Buyer" : "Seller"}: {counterparty?.full_name ?? "Hazi user"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--muted)]">Amount</p>
                  <p className="font-extrabold text-[var(--primary)]">{formatNaira(Number(order.amount))}</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--muted)]">Status</p>
                  <span className={order.status === "disputed" ? "badge bg-red-50 text-red-700" : "badge badge-live"}>{order.status}</span>
                </div>
                <Link href={`/transactions/${order.id}`} className="button button-outline self-start lg:justify-self-end">
                  <MessageSquareText size={16} /> Chat
                </Link>
              </article>
            );
          }) : <p className="p-5 text-[var(--muted)]">No matching orders yet.</p>}
        </div>
      </section>
    </main>
  );
}
