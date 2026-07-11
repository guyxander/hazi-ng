import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | Hazi.ng"
};

export default function PrivacyPage() {
  return (
    <main className="container py-10">
      <div className="mb-8">
        <span className="badge badge-premium">Legal</span>
        <h1 className="section-title mt-4">Privacy Policy</h1>
        <p className="mt-2 text-sm font-bold text-[var(--muted)]">Last updated: 11 July 2026</p>
      </div>

      <section className="legal-page">
        <p>
          This Privacy Policy explains how Hazi.ng collects, uses, stores, shares, and protects personal information when
          you use our Nigerian auction marketplace, wallet, escrow, agent, support, verification, and notification services.
        </p>

        <h2>1. Information we collect</h2>
        <p>
          We may collect account details, email, phone number, name, password authentication data, location and pickup
          details, wallet and payment references, listing content, uploaded images, bid history, escrow messages, support
          tickets, dispute evidence, verification documents, liveness/selfie evidence, device information, IP-derived
          analytics hashes, and notification preferences.
        </p>

        <h2>2. Why we process your data</h2>
        <p>
          We process data to create accounts, authenticate users, publish listings, support bidding, fund wallets, hold and
          release escrow, calculate agent commissions, prevent fraud, provide support, handle disputes, send notifications,
          improve product performance, meet legal obligations, and keep Hazi.ng safer.
        </p>

        <h2>3. Legal basis and Nigerian data protection</h2>
        <p>
          Hazi.ng aims to process personal data consistently with Nigeria&apos;s data protection framework, including the
          Nigeria Data Protection Act, regulatory guidance from the Nigeria Data Protection Commission, contractual
          necessity, user consent where needed, legitimate marketplace safety interests, and compliance with applicable law.
        </p>

        <h2>4. Location data</h2>
        <p>
          We use location and address data to support pickup, delivery estimates, listing trust, and fraud prevention.
          Where you use current location, coordinates may be converted into a readable town/state for marketplace display.
        </p>

        <h2>5. Payments, wallet, and providers</h2>
        <p>
          Payment and wallet records may be shared with payment processors such as Flutterwave, banks, fraud prevention
          services, and operational providers when needed to fund wallets, verify transactions, process refunds, or support
          payout review. We do not ask you to share full card PINs or bank OTPs on Hazi.ng.
        </p>

        <h2>6. Identity, trust, and safety checks</h2>
        <p>
          Verification data may be reviewed by authorised admins or trusted service providers for fraud prevention,
          marketplace safety, seller trust badges, payout eligibility, and dispute investigation. Rejected verification
          attempts may retain limited records to prevent abuse and support resubmission.
        </p>

        <h2>7. Cookies, analytics, and device data</h2>
        <p>
          We use cookies and local storage for sessions, authentication, preferences, visitor analytics, and product
          performance. Admin and superadmin visits are excluded from Hazi.ng&apos;s internal site analytics. Vercel analytics
          and other infrastructure providers may process technical usage data for reliability and performance.
        </p>

        <h2>8. Sharing and disclosure</h2>
        <p>
          We may share data with service providers, payment processors, email/SMS providers, cloud hosting providers,
          support tools, verification providers, professional advisers, regulators, or law enforcement where lawful and
          necessary. We may also show limited public profile, verification, location, listing, and bid information to other
          users as part of marketplace operation.
        </p>

        <h2>9. Retention</h2>
        <p>
          We keep data for as long as needed for account operation, legal compliance, fraud prevention, accounting, escrow,
          dispute resolution, audit trails, and platform security. Some transaction and wallet records may be retained even
          after account closure where required for legal or financial recordkeeping.
        </p>

        <h2>10. Your rights</h2>
        <p>
          Subject to Nigerian law and identity verification, you may request access, correction, deletion, restriction,
          withdrawal of consent, or review of certain personal data. Some requests may be limited where data is needed for
          escrow, disputes, fraud prevention, accounting, or legal obligations.
        </p>

        <h2>11. Security</h2>
        <p>
          We use technical and organisational safeguards such as Supabase authentication, row-level database controls,
          signed file access where appropriate, server-side wallet updates, audit logs, and provider webhook verification.
          No online service is perfectly secure, so users should keep passwords private and report suspicious activity.
        </p>

        <h2>12. Contact</h2>
        <p>
          For privacy questions or data requests, contact <Link href="/support">Hazi.ng Support</Link> or email
          support@hazi.ng. Include the email connected to your Hazi.ng account and a clear description of your request.
        </p>
      </section>
    </main>
  );
}
