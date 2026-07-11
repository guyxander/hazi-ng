import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container grid min-h-[70vh] place-items-center py-10">
      <div className="card max-w-lg p-8 text-center">
        <h1 className="text-4xl font-extrabold text-[var(--primary)]">Page not found</h1>
        <p className="mt-3 text-[var(--muted)]">That Hazi marketplace page does not exist yet.</p>
        <Link href="/auctions" className="button button-primary mt-6">Browse auctions</Link>
      </div>
    </main>
  );
}
