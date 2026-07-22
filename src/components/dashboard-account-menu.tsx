import Link from "next/link";
import { BadgeCheck, BriefcaseBusiness, Gavel, LayoutDashboard, Package, ShieldCheck, UserCircle, WalletCards } from "lucide-react";

export function DashboardAccountMenu({
  canAccessAgentDashboard,
  isAdmin
}: {
  canAccessAgentDashboard: boolean;
  isAdmin: boolean;
}) {
  return (
    <aside className="dashboard-shell__menu dashboard-shell__menu--desktop" aria-label="Dashboard menu">
      <p className="dashboard-shell__menu-title">Account</p>
      <Link href="/dashboard/profile"><UserCircle size={17} /> Profile</Link>
      <Link href="/dashboard"><LayoutDashboard size={17} /> Dashboard</Link>
      <Link href="/dashboard/listings"><Package size={17} /> Your listings</Link>
      <Link href="/dashboard/wallet"><WalletCards size={17} /> Wallet</Link>
      <Link href="/dashboard/payout-settings"><WalletCards size={17} /> Payouts</Link>
      <Link href="/dashboard/bids"><Gavel size={17} /> Bids</Link>
      <Link href="/dashboard/verification"><BadgeCheck size={17} /> Verification</Link>
      {canAccessAgentDashboard ? <Link href="/dashboard/agent"><BriefcaseBusiness size={17} /> Agent dashboard</Link> : null}
      {isAdmin ? <Link href="/admin"><ShieldCheck size={17} /> Admin page</Link> : null}
    </aside>
  );
}
