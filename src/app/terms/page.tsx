import Link from "next/link";

export const metadata = {
  title: "Terms and Conditions | Hazi.ng"
};

export default function TermsPage() {
  return (
    <main className="container py-10">
      <LegalHero eyebrow="Legal" title="Terms and Conditions" updated="Last updated: 11 July 2026" />

      <section className="legal-page">
        <p>
          These Terms and Conditions govern your access to and use of Hazi.ng, including auctions, wallet funding, escrow,
          agent-assisted listings, support, reporting, premium boosts, and related marketplace services. By using Hazi.ng,
          you agree to these terms.
        </p>

        <h2>1. About Hazi.ng</h2>
        <p>
          Hazi.ng is a Nigerian auction marketplace for used household and personal items. We provide listing tools,
          bidding, wallet escrow, notifications, optional premium promotion, agent workflows, and dispute support. Hazi.ng
          is not the owner of user-listed items unless expressly stated.
        </p>

        <h2>2. Eligibility and account duties</h2>
        <p>
          You must provide accurate account information, keep your password secure, and use the platform lawfully. You may
          be asked to complete profile, phone, location, identity, or liveness checks before posting, bidding, receiving
          payouts, or using higher-trust features.
        </p>

        <h2>3. Listings, bids, and seller responsibilities</h2>
        <p>
          Sellers must describe items truthfully, upload accurate photos where available, disclose faults, state pickup
          information, and only list items they own or are authorised to sell. Prohibited listings include stolen goods,
          counterfeit goods, unsafe products, illegal items, regulated items without approval, and anything that violates
          Nigerian law or Hazi.ng policy.
        </p>
        <p>
          Bids are binding offers. Buyers cannot bid above their available wallet balance. When a seller accepts a bid,
          the accepted amount may be moved immediately from the buyer&apos;s wallet into escrow.
        </p>

        <h2>4. Wallet, escrow, release, and refunds</h2>
        <p>
          Wallet balances are maintained by Hazi.ng&apos;s backend records and payment provider confirmations. Users must not
          attempt to manipulate wallet balances, payment references, webhook events, or escrow records. Escrow funds are
          held for the accepted transaction until release, refund, or dispute resolution.
        </p>
        <p>
          For standard non-agent sales, Hazi.ng may deduct a 9% platform fee and credit the seller with 91% after release.
          For agent-assisted sales, the current split is 70% to the client/seller, 21% to the agent, and 9% to Hazi.ng.
        </p>

        <h2>5. Delivery and receipt confirmation</h2>
        <p>
          Buyers and sellers are responsible for agreeing on pickup or delivery arrangements unless a specific Hazi.ng
          delivery service is offered. The seller may mark an item as on the way. The buyer should release funds only
          after receiving and checking the item. False receipt, false delivery, or collusion may lead to account
          restrictions and dispute review.
        </p>

        <h2>6. Agents</h2>
        <p>
          Approved agents may list items for assigned clients only through the agent listing workflow. Agents must not
          misrepresent client ownership, divert client proceeds, or list client items as personal sales. Clients may choose
          a preferred agent or allow Hazi.ng to assign any available agent.
        </p>

        <h2>7. Premium, boosts, and promotions</h2>
        <p>
          Premium plans and listing boosts increase visibility but do not guarantee bids, sales, delivery, or profit.
          Boost availability and limits may vary by plan. Hazi.ng may grant premium access administratively for promotions,
          support resolution, or manual correction.
        </p>

        <h2>8. Reports, disputes, and moderation</h2>
        <p>
          Users may report suspicious listings, unsafe items, fraud, harassment, or rule breaches. Hazi.ng may pause,
          remove, or delete listings; suspend accounts; request evidence; reverse wallet entries; refund buyers; release
          escrow; or refer serious matters to relevant authorities where appropriate.
        </p>

        <h2>9. Nigerian law and consumer protection</h2>
        <p>
          These terms are intended to align with applicable Nigerian law, including consumer protection principles under
          the Federal Competition and Consumer Protection framework, cybercrime/fraud prevention obligations, and data
          protection requirements. Nothing in these terms removes non-waivable rights available under Nigerian law.
        </p>

        <h2>10. Limitation of liability</h2>
        <p>
          Hazi.ng provides marketplace infrastructure and support tools. To the maximum extent allowed by law, we are not
          liable for indirect losses, lost profits, user misrepresentations, failed third-party services, delivery provider
          issues, bank delays, or off-platform dealings.
        </p>

        <h2>11. Changes and contact</h2>
        <p>
          We may update these terms as the product, law, or provider relationships change. For questions, complaints, or
          dispute support, contact <Link href="/support">Hazi.ng Support</Link>, email hello@hazi.ng, or WhatsApp
          09029840305.
        </p>
      </section>
    </main>
  );
}

function LegalHero({ eyebrow, title, updated }: { eyebrow: string; title: string; updated: string }) {
  return (
    <div className="mb-8">
      <span className="badge badge-premium">{eyebrow}</span>
      <h1 className="section-title mt-4">{title}</h1>
      <p className="mt-2 text-sm font-bold text-[var(--muted)]">{updated}</p>
    </div>
  );
}
