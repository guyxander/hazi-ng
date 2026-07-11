import Link from "next/link";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div>
          <Link href="/" className="site-footer__brand">
            <span>H</span>
            <strong>Hazi.ng</strong>
          </Link>
          <p className="mt-3 max-w-md text-sm leading-6 text-[rgba(255,255,255,0.74)]">
            Nigeria's trusted auction marketplace for decluttering, verified buyers and sellers, wallet escrow, agent-assisted sales, and safer used-item transactions.
          </p>
        </div>

        <div>
          <h2 className="site-footer__heading">Marketplace</h2>
          <div className="site-footer__links">
            <Link href="/auctions">Browse auctions</Link>
            <Link href="/sell">Post item</Link>
            <Link href="/agent">Agents</Link>
            <Link href="/premium">Premium</Link>
          </div>
        </div>

        <div>
          <h2 className="site-footer__heading">Support</h2>
          <div className="site-footer__links">
            <Link href="/support">Help and tickets</Link>
            <Link href="/terms">Terms and conditions</Link>
            <Link href="/privacy">Privacy policy</Link>
            <Link href="/dashboard/notifications">Notifications</Link>
          </div>
        </div>

        <div>
          <h2 className="site-footer__heading">Contact</h2>
          <div className="site-footer__contact">
            <p><Mail size={15} /> support@hazi.ng</p>
            <p><Phone size={15} /> +234 800 HAZI NG</p>
            <p><MessageCircle size={15} /> WhatsApp support via ticket page</p>
            <p><MapPin size={15} /> Lagos, Nigeria</p>
          </div>
        </div>
      </div>
      <div className="container site-footer__bottom">
        <span>© {new Date().getFullYear()} Hazi.ng. All rights reserved.</span>
        <span>Built for Nigerian marketplace users. Times shown in UTC+1.</span>
      </div>
    </footer>
  );
}
