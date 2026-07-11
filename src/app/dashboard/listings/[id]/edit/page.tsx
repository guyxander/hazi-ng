import Link from "next/link";
import { redirect } from "next/navigation";
import { updateAuction } from "@/app/actions";
import { GeolocationFields } from "@/components/geolocation-fields";
import { getCategories } from "@/lib/supabase/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function EditListingPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const [supabase, categories] = await Promise.all([createSupabaseServerClient(), getCategories()]);

  if (!supabase) {
    return (
      <main className="container py-10">
        <div className="card p-6">Add Supabase environment variables to edit listings.</div>
      </main>
    );
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect(`/auth?next=/dashboard/listings/${id}/edit`);
  }

  const { data: auction } = await supabase
    .from("auctions")
    .select("id,seller_id,category_id,title,description,condition,location,latitude,longitude,seller_price,reserve_price,status,pickup_available,delivery_available")
    .eq("id", id)
    .eq("seller_id", user.id)
    .single();

  if (!auction) {
    redirect("/dashboard");
  }

  const editable = ["draft", "active", "paused"].includes(auction.status);

  return (
    <main className="container py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="badge badge-premium">Seller listing</span>
          <h1 className="section-title mt-4">Edit auction</h1>
          <p className="mt-2 max-w-2xl text-[var(--muted)]">Update buyer-facing details while the listing is draft, active, or paused.</p>
        </div>
        <Link href="/dashboard" className="button button-outline">Back to dashboard</Link>
      </div>

      {query?.error === "pickup-location" ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          Choose a suggested pickup address or use your current location before saving this listing.
        </div>
      ) : null}

      {!editable ? (
        <div className="card p-6">
          <p className="font-bold text-[var(--muted)]">Accepted or closed auctions cannot be edited.</p>
        </div>
      ) : (
        <form action={updateAuction} className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <input type="hidden" name="auction_id" value={auction.id} />
          <section className="card space-y-5 p-6">
            <div>
              <label className="text-sm font-extrabold text-[var(--primary)]">Title</label>
              <input className="input mt-2" name="title" required defaultValue={auction.title} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-extrabold text-[var(--primary)]">Category</label>
                <select className="select mt-2" name="category_id" required defaultValue={auction.category_id ?? ""}>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-extrabold text-[var(--primary)]">Condition</label>
                <select className="select mt-2" name="condition" defaultValue={auction.condition}>
                  <option value="new">New</option>
                  <option value="like_new">Like new</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="needs_repair">Needs repair</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-extrabold text-[var(--primary)]">Description</label>
              <textarea className="textarea mt-2" name="description" required defaultValue={auction.description} />
            </div>
            <div>
              <label className="text-sm font-extrabold text-[var(--primary)]">Seller price</label>
              <input className="input mt-2" name="seller_price" required type="number" min="1" defaultValue={Number(auction.seller_price)} />
            </div>
            <GeolocationFields
              required
              addressName="location"
              defaultAddress={auction.location}
              defaultLatitude={auction.latitude ?? null}
              defaultLongitude={auction.longitude ?? null}
            />
          </section>

          <aside className="card h-fit space-y-5 p-6">
            <h2 className="text-2xl font-extrabold text-[var(--primary)]">Fulfilment</h2>
            <label className="flex items-center gap-3 text-sm font-bold text-[var(--muted)]">
              <input type="checkbox" name="pickup_available" defaultChecked={auction.pickup_available} />
              Pickup available
            </label>
            <label className="flex items-center gap-3 text-sm font-bold text-[var(--muted)]">
              <input type="checkbox" name="delivery_available" defaultChecked={auction.delivery_available} />
              Delivery available
            </label>
            <button className="button button-primary w-full" type="submit">Save changes</button>
            <Link href={`/auctions/${auction.id}`} className="button button-outline w-full">View listing</Link>
          </aside>
        </form>
      )}
    </main>
  );
}
