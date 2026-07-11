import { ImageIcon } from "lucide-react";

export function AuctionImagePlaceholder({ title }: { title: string }) {
  return (
    <div className="auction-placeholder">
      <div className="auction-placeholder__brand" aria-hidden="true">H</div>
      <div className="auction-placeholder__content">
        <span className="auction-placeholder__icon" aria-hidden="true">
          <ImageIcon size={24} />
        </span>
        <span className="auction-placeholder__eyebrow">Photo coming soon</span>
        <p className="line-clamp-2">{title}</p>
      </div>
    </div>
  );
}
