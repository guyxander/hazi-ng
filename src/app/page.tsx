import Link from "next/link";
import Image from "next/image";
import { ArrowRight, PackageCheck, Search, ShieldCheck, Truck } from "lucide-react";
import { AuctionCard } from "@/components/auction-card";
import { StatCard } from "@/components/stat-card";
import { getAuctions, getCategories } from "@/lib/supabase/queries";

export default async function HomePage() {
  const [auctions, categories] = await Promise.all([getAuctions(), getCategories()]);
  const featured = auctions.slice(0, 3);

  return (
    <main>
      <section className="container hero-grid py-12 md:py-20">
        <div>
          <span className="badge badge-premium mb-5">Nigeria&apos;s verified declutter auction marketplace</span>
          <h1 className="text-4xl font-extrabold leading-[1.05] text-[var(--primary)] md:text-7xl">
            Declutter your space, fill your wallet.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--muted)]">
            Hazi.ng helps buyers, sellers, businesses, and declutter agents auction used household items with identity verification, visible bids, price intelligence, and logistics support.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/sell" className="button button-primary">Start Selling <ArrowRight size={17} /></Link>
            <Link href="/auctions" className="button button-outline">Browse Auctions</Link>
            <Link href="/agent/apply" className="button button-accent">Become an Agent</Link>
            <Link href="/agent/request" className="button button-outline">Request an Agent</Link>
          </div>
        </div>
        <div className="card overflow-hidden">
          <div className="relative h-[440px]">
          <Image
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuD5TA8-erpTHW1i8ECH7lF91BqjXRgNvGMY7ahWJf-2Qhl-LvwOb_R-jZq_3oKmRDqSPApQK-hDDD0LaDHiGtw0K7dQzSBabPX52VgdbgElBIwUfe9W9Rj3jZBR8nzZTeF_E64OjKzzKMWcn4kvUKbDZIBj2vn3zWR47HZv3R9tzoNw4bG8xuudBtBuX8ZMr6SLEZoQT8w213IS41Pgmj1ZM1kdY_onGK_aK2wSl2CB5gnFMam5vQsK"
            alt="Modern uncluttered Lagos apartment"
            fill
            priority
            sizes="(max-width: 900px) 100vw, 45vw"
            className="object-cover"
          />
          </div>
        </div>
      </section>

      <section className="container grid gap-4 py-4 md:grid-cols-4">
        <StatCard icon={ShieldCheck} label="Trust layer" value="KYC" hint="Identity checks for high-value trades." />
        <StatCard icon={Search} label="Discovery" value="Live" hint="Search, categories, and premium placement." />
        <StatCard icon={PackageCheck} label="Auction rules" value="50%" hint="Minimum bid starts at half seller price." />
        <StatCard icon={Truck} label="Delivery" value="AI" hint="Independent buyer/seller courier estimates." />
      </section>

      <section className="container py-12">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="section-title">Featured Auctions</h2>
            <p className="mt-2 text-[var(--muted)]">Premium, verified listings styled from your original design system.</p>
          </div>
          <Link href="/auctions" className="button button-outline hidden md:inline-flex">View all</Link>
        </div>
        <div className="auction-grid">
          {featured.map((auction) => (
            <AuctionCard key={auction.id} auction={auction} />
          ))}
        </div>
      </section>

      <section className="container pb-16">
        <div className="card p-6">
          <h2 className="section-title text-3xl">Popular Categories</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-6">
            {categories.map((category) => (
              <Link key={category.id} href={`/auctions?category=${category.slug}`} className="rounded-xl bg-[var(--surface-soft)] p-4 text-sm font-extrabold text-[var(--primary)] hover:bg-[var(--accent-soft)]">
                {category.name}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
