import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BellRing,
  BriefcaseBusiness,
  CreditCard,
  Eye,
  FileText,
  HandCoins,
  Headphones,
  HeartPulse,
  IdCard,
  Landmark,
  ScrollText,
  TriangleAlert,
  Truck,
  Users
} from "lucide-react";

const adminLinks = [
  { href: "/admin/health", label: "Health", icon: HeartPulse },
  { href: "/admin/auctions", label: "Auctions", icon: Eye, primary: true },
  { href: "/admin/kyc", label: "KYC queue", icon: IdCard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/payouts", label: "Payouts", icon: HandCoins },
  { href: "/admin/deliveries", label: "Deliveries", icon: Truck },
  { href: "/admin/notifications", label: "Notifications", icon: BellRing },
  { href: "/admin/reports", label: "Reports", icon: FileText },
  { href: "/admin/agent-leads", label: "Agent leads", icon: BriefcaseBusiness },
  { href: "/admin/audit", label: "Audit trail", icon: ScrollText },
  { href: "/admin/finance", label: "Finance", icon: Landmark },
  { href: "/admin/analytics", label: "Site analytics", icon: BarChart3 },
  { href: "/admin/support", label: "Support", icon: Headphones },
  { href: "/admin/errors", label: "Errors", icon: TriangleAlert }
];

export function AdminOperationsNav() {
  return (
    <aside className="admin-operations-menu" aria-label="Admin operations menu">
      <p className="admin-operations-menu__title">Operations</p>
      {adminLinks.map((item) => (
        <AdminShortcutLink key={item.href} {...item} />
      ))}
    </aside>
  );
}

function AdminShortcutLink({
  href,
  label,
  icon: Icon,
  primary = false
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  primary?: boolean;
}) {
  return (
    <Link href={href} className={primary ? "admin-operations-menu__primary" : ""}>
      <Icon size={17} />
      {label}
    </Link>
  );
}
