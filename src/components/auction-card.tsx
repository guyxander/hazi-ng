import Link from "next/link";
import Image from "next/image";
import { MapPin } from "lucide-react";
import type { Auction } from "@/lib/types";
import { formatNaira } from "@/lib/format";
import { AuctionCountdown } from "@/components/auction-countdown";
import { AuctionImagePlaceholder } from "@/components/auction-image-branding";

export function AuctionCard({ auction }: { auction: Auction }) {
  const image = auction.auction_images?.[0];

  return (
    <Link href={`/auctions/${auction.id}`} className="card group overflow-hidden transition hover:-translate-y-1 hover:shadow-xl">
      <div className="relative aspect-square overflow-hidden bg-[var(--surface-soft)] sm:aspect-[4/3]">
        {image ? (
          <Image
            src={image.image_url}
            alt={image.alt_text || auction.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 900px) 33vw, 25vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <AuctionImagePlaceholder title={auction.title} />
        )}
        <div className="absolute left-2 top-2">
          <AuctionCountdown endsAt={auction.ends_at} status={auction.status} compact />
        </div>
      </div>
      <div className="space-y-1.5 p-3">
        <h3 className="line-clamp-2 text-sm font-extrabold leading-snug text-[var(--text)] sm:text-base">{auction.title}</h3>
        <p className="text-base font-extrabold text-[var(--primary)] sm:text-lg">{formatNaira(auction.seller_price)}</p>
        <p className="flex min-w-0 items-center gap-1 text-xs font-semibold text-[var(--muted)] sm:text-sm">
          <MapPin className="shrink-0" size={13} />
          <span className="truncate">
            {auction.location}
          </span>
        </p>
      </div>
    </Link>
  );
}
