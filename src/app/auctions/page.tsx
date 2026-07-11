import { Search, SlidersHorizontal } from "lucide-react";
import { AuctionCard } from "@/components/auction-card";
import { getAuctions, getCategories } from "@/lib/supabase/queries";

type AuctionsPageProps = {
  searchParams: Promise<{
    q?: string;
    category?: string;
    location?: string;
    sort?: string;
  }>;
};

export default async function AuctionsPage({ searchParams }: AuctionsPageProps) {
  const params = await searchParams;
  const categories = await getCategories();
  const selectedCategory = categories.find((category) => category.slug === params.category);
  const auctions = await getAuctions({
    q: params.q,
    categoryId: selectedCategory?.id,
    location: params.location,
    sort: params.sort
  });

  return (
    <main className="container py-10">
      <div className="mb-8">
        <span className="badge badge-live"><span className="pulse-dot" /> Live marketplace</span>
        <h1 className="section-title mt-4">Browse auctions</h1>
        <p className="mt-2 max-w-2xl text-[var(--muted)]">Search verified sellers, visible bid histories, premium listings, and items across Lagos.</p>
      </div>

      <form action="/auctions" className="card mb-8 grid gap-3 p-4 md:grid-cols-[1fr_180px_180px_170px_150px]">
        <label className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
          <input className="input pl-10" name="q" defaultValue={params.q ?? ""} placeholder="Search furniture, gadgets, appliances..." />
        </label>
        <select className="select" name="category" defaultValue={params.category ?? ""}>
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>{category.name}</option>
          ))}
        </select>
        <input className="input" name="location" defaultValue={params.location ?? ""} placeholder="Location" />
        <select className="select" name="sort" defaultValue={params.sort ?? "newest"}>
          <option value="newest">Newest</option>
          <option value="price_low">Price low</option>
          <option value="price_high">Price high</option>
        </select>
        <button className="button button-primary" type="submit"><SlidersHorizontal size={17} /> Filter</button>
      </form>

      {auctions.length ? (
        <div className="auction-grid">
          {auctions.map((auction) => (
          <AuctionCard key={auction.id} auction={auction} />
          ))}
        </div>
      ) : (
        <div className="card p-8 text-center">
          <p className="text-lg font-extrabold text-[var(--primary)]">No matching auctions yet</p>
          <p className="mt-2 text-[var(--muted)]">Try a different keyword, category, or Lagos location.</p>
        </div>
      )}
    </main>
  );
}
