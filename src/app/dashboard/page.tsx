import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, Bell, Bookmark, BriefcaseBusiness, Gavel, LifeBuoy, Package, Plus, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import { boostAuction, relistAuction, signOut, updateAuctionStatus } from "@/app/actions";
import { CopyReferralLink } from "@/components/copy-referral-link";
import { StatCard } from "@/components/stat-card";
import { formatNaira } from "@/lib/format";
import { isAdminRole, isAgentRole } from "@/lib/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PREMIUM_PLAN_LABELS: Record<string, string> = {
  premium_seller: "Premium Seller",
  premium_agent: "Premium Agent",
  premium_business: "Premium Business"
};

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: Promise<{ boost?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return <MissingEnvDashboard />;
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/auth?next=/dashboard");
  }

  const [{ data: listings }, { data: notifications }, { count: unreadNotifications }, { count: savedCount }, { count: bidCount }, { data: profile }, { data: transactions }, { data: wallet }, { count: referralCount }, { count: referralRewards }, { data: activePremium }] = await Promise.all([
    supabase.from("auctions").select("id,title,status,current_bid,seller_price,is_premium,created_at,seller_id,listed_for_user_id").or(`seller_id.eq.${user.id},listed_for_user_id.eq.${user.id}`).order("created_at", { ascending: false }),
    supabase.from("notifications").select("id,title,body,created_at,read_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
    supabase.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null),
    supabase.from("auction_watchlist").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("bids").select("*", { count: "exact", head: true }).eq("bidder_id", user.id),
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("transactions")
      .select("id,auction_id,buyer_id,seller_id,amount,status,created_at")
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("wallet_accounts")
      .select("available_balance,earnings_balance,refund_balance,pending_withdrawal_balance")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("user_referrals").select("*", { count: "exact", head: true }).eq("inviter_id", user.id),
    supabase.from("referral_boost_rewards").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "unused"),
    supabase
      .from("premium_subscriptions")
      .select("id,plan,ends_at,provider")
      .eq("user_id", user.id)
      .is("auction_id", null)
      .in("plan", ["premium_seller", "premium_agent", "premium_business"])
      .eq("status", "active")
      .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const walletBalance = Number(wallet?.available_balance ?? 0) + Number(wallet?.earnings_balance ?? 0) + Number(wallet?.refund_balance ?? 0);
  const referralLink = `https://hazi.ng/auth?mode=signup&ref=${user.id}`;
  const newAuctionHref = isAgentRole(profile?.role) ? "/sell/agent" : "/sell";

  return (
    <main className="container py-10">
      {query?.boost === "active" ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          Listing boost is active.
        </div>
      ) : null}

      {query?.boost === "referral" ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          Free referral boost applied.
        </div>
      ) : null}

      {query?.boost === "subscription-ready" ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          Your premium subscription is active. Choose Boost on a listing to promote it.
        </div>
      ) : null}

      {query?.boost === "failed" ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          We could not boost this listing yet. Make sure the auction is active or paused, then try again.
        </div>
      ) : null}

      {query?.boost?.startsWith("limit-") ? (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
          Your current premium plan has reached its active boost limit of {query.boost.replace("limit-", "")} listings.
        </div>
      ) : null}

      <div className="mb-8">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="badge badge-trust"><ShieldCheck size={14} /> {profile?.verification_status ?? "Profile pending"}</span>
            {activePremium ? (
              <span className="badge badge-premium"><Sparkles size={14} /> {PREMIUM_PLAN_LABELS[activePremium.plan] ?? activePremium.plan}</span>
            ) : null}
          </div>
          <h1 className="section-title mt-4">Welcome, {profile?.full_name || user.email}</h1>
          <p className="mt-2 text-[var(--muted)]">Manage listings, bids, notifications, verification, premium, and payouts.</p>
        </div>
      </div>

      <section className="dashboard-shell">
        <aside className="dashboard-shell__menu" aria-label="Dashboard menu">
          <p className="dashboard-shell__menu-title">Dashboard</p>
          <Link href={newAuctionHref} className="dashboard-shell__menu-primary"><Plus size={17} /> New auction</Link>
          <Link href="/dashboard/profile"><BadgeCheck size={17} /> Profile</Link>
          <Link href="/dashboard/wallet"><WalletCards size={17} /> Wallet</Link>
          <Link href="/dashboard/payout-settings"><WalletCards size={17} /> Payouts</Link>
          <Link href="/dashboard/watchlist"><Bookmark size={17} /> Saved auctions</Link>
          <Link href="/dashboard/bids"><Gavel size={17} /> Bids</Link>
          <Link href="/dashboard/verification"><ShieldCheck size={17} /> Verification</Link>
          <Link href="/premium"><Sparkles size={17} /> Premium</Link>
          <Link href="/support"><LifeBuoy size={17} /> Support</Link>
          {isAgentRole(profile?.role) ? <Link href="/dashboard/agent"><BriefcaseBusiness size={17} /> Agent dashboard</Link> : null}
          {isAdminRole(profile?.role) ? <Link href="/admin"><ShieldCheck size={17} /> Admin dashboard</Link> : null}
          <form action={signOut}><button type="submit"><ShieldCheck size={17} /> Sign out</button></form>
        </aside>

        <div className="dashboard-shell__content">
          <section className="grid gap-4 md:grid-cols-5">
            <StatCard icon={Package} label="Listings" value={String(listings?.length ?? 0)} hint="Seller auction inventory." />
            <StatCard icon={WalletCards} label="Wallet" value={formatNaira(walletBalance)} hint="Available, earnings, and refunds." />
            <StatCard icon={Bell} label="Notifications" value={String(unreadNotifications ?? 0)} hint="Unread updates." />
            <StatCard icon={Bookmark} label="Watchlist" value={String(savedCount ?? 0)} hint="Saved auctions." />
            <StatCard icon={Gavel} label="Bids" value={String(bidCount ?? 0)} hint="Offers placed." />
          </section>

      <section className="card mt-8 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-[var(--primary)]">Referral bonus</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Invite 3 friends who register on Hazi.ng and get 1 free promoted listing.</p>
            <CopyReferralLink value={referralLink} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl bg-[var(--surface-soft)] p-4">
              <p className="text-sm font-bold text-[var(--muted)]">Registered invites</p>
              <p className="text-2xl font-extrabold text-[var(--primary)]">{referralCount ?? 0}</p>
            </div>
            <div className="rounded-xl bg-[var(--accent-soft)] p-4">
              <p className="text-sm font-bold text-[#693c00]">Free boosts</p>
              <p className="text-2xl font-extrabold text-[#2c1600]">{referralRewards ?? 0}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="card min-w-0 overflow-hidden">
          <div className="border-b border-[var(--line)] p-5">
            <h2 className="text-2xl font-extrabold text-[var(--primary)]">Your listings</h2>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {(listings?.length ? listings : []).map((listing) => (
              <div key={listing.id} className="dashboard-listing">
                <div className="dashboard-listing__top">
                  <div className="min-w-0">
                    <Link href={`/auctions/${listing.id}`} className="dashboard-listing__title hover:underline">
                      {listing.title}
                    </Link>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="badge badge-trust capitalize">{listing.seller_id !== user.id ? "Agent listed" : listing.status}</span>
                      {listing.is_premium ? <span className="badge badge-premium">Boost active</span> : null}
                      {listing.seller_id !== user.id ? <span className="badge badge-trust">Client view</span> : null}
                    </div>
                  </div>
                  <p className="dashboard-listing__price">
                    {formatNaira(Number(listing.current_bid || listing.seller_price))}
                  </p>
                </div>

                <div className="dashboard-listing__actions">
                  {listing.seller_id !== user.id ? (
                    <span className="text-sm font-bold text-[var(--muted)]">Managed by agent</span>
                  ) : listing.is_premium ? null : (
                    <form action={boostAuction} className="dashboard-listing__boost">
                      <input type="hidden" name="auction_id" value={listing.id} />
                      <select className="select min-h-[42px]" name="plan" defaultValue="listing_boost_7d">
                        <option value="listing_boost_7d">7d</option>
                        <option value="listing_boost_14d">14d</option>
                        <option value="listing_boost_30d">30d</option>
                      </select>
                      <button className="button button-accent" type="submit">Boost</button>
                    </form>
                  )}

                  {listing.seller_id !== user.id ? null : listing.status === "active" || listing.status === "paused" ? (
                    <>
                      <Link href={`/dashboard/listings/${listing.id}/edit`} className="button button-outline">Edit</Link>
                      <form action={updateAuctionStatus}>
                        <input type="hidden" name="auction_id" value={listing.id} />
                        <input type="hidden" name="status" value={listing.status === "active" ? "paused" : "active"} />
                        <button className="button button-outline w-full" type="submit">{listing.status === "active" ? "Pause" : "Resume"}</button>
                      </form>
                      <form action={updateAuctionStatus}>
                        <input type="hidden" name="auction_id" value={listing.id} />
                        <input type="hidden" name="status" value="closed" />
                        <button className="button button-outline w-full" type="submit">Close</button>
                      </form>
                    </>
                  ) : ["expired", "closed"].includes(listing.status) ? (
                    <>
                      <Link href={`/dashboard/listings/${listing.id}/edit`} className="button button-outline">Edit</Link>
                      <form action={relistAuction} className="dashboard-listing__boost">
                        <input type="hidden" name="auction_id" value={listing.id} />
                        <select className="select min-h-[42px]" name="duration_hours" defaultValue="72">
                          <option value="24">24h</option>
                          <option value="72">3d</option>
                          <option value="168">7d</option>
                        </select>
                        <button className="button button-primary" type="submit">Relist</button>
                      </form>
                    </>
                  ) : (
                    <span className="text-sm font-bold text-[var(--muted)]">No seller actions</span>
                  )}
                </div>
              </div>
            ))}
            {!listings?.length ? <p className="p-5 text-[var(--muted)]">No listings yet. Create your first auction.</p> : null}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-extrabold text-[var(--primary)]">Escrow chats</h2>
              <Link href="/dashboard/orders" className="button button-outline px-3">Orders</Link>
            </div>
            <div className="mt-4 space-y-3">
              {transactions?.length ? transactions.map((item) => (
                <Link key={item.id} href={`/transactions/${item.id}`} className="block rounded-xl bg-[var(--surface-soft)] p-4 hover:bg-[var(--accent-soft)]">
                  <strong>{Number(item.amount).toLocaleString("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 })}</strong>
                  <p className="mt-1 text-sm font-bold text-[var(--muted)]">{item.status}</p>
                </Link>
              )) : <p className="text-sm text-[var(--muted)]">No accepted auction transactions yet.</p>}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="text-2xl font-extrabold text-[var(--primary)]">Notifications</h2>
            <div className="mt-4 space-y-3">
              {notifications?.length ? notifications.map((item) => (
                <div key={item.id} className="rounded-xl bg-[var(--surface-soft)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <strong>{item.title}</strong>
                    {!item.read_at ? <span className="badge badge-live">New</span> : null}
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted)]">{item.body}</p>
                </div>
              )) : <p className="text-sm text-[var(--muted)]">No notifications yet.</p>}
            </div>
          </div>
        </aside>
      </section>
        </div>
      </section>
    </main>
  );
}

function MissingEnvDashboard() {
  return (
    <main className="container py-10">
      <div className="card max-w-2xl p-6">
        <h1 className="text-3xl font-extrabold text-[var(--primary)]">Supabase keys needed locally</h1>
        <p className="mt-3 text-[var(--muted)]">The database schema is created, but the app needs <code>.env.local</code> with your Supabase URL and publishable key to use Auth and protected dashboard data.</p>
      </div>
    </main>
  );
}
