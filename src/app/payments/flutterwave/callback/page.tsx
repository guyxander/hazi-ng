import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { verifyFlutterwavePayment } from "@/lib/flutterwave";
import { formatNaira } from "@/lib/format";
import { isAdminRole } from "@/lib/roles";
import { getAutomationServerSecret } from "@/lib/server-secret";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CallbackSearchParams = {
  status?: string;
  tx_ref?: string;
  transaction_id?: string;
  purpose?: string;
  wallet_intent_id?: string;
  plan?: string;
  auction_id?: string;
  boost_plan?: string;
};

export default async function FlutterwaveCallbackPage({
  searchParams
}: {
  searchParams: Promise<CallbackSearchParams>;
}) {
  const params = await searchParams;
  const txRef = params.tx_ref ?? "";
  const flutterwaveTransactionId = params.transaction_id ?? "";
  const returnedStatus = params.status ?? "";
  const purpose = params.purpose ?? "escrow";

  if (returnedStatus !== "successful" || !txRef || !flutterwaveTransactionId) {
    return <PaymentResult success={false} title="Payment was not completed" message="Flutterwave did not return a successful payment." />;
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return <PaymentResult success={false} title="Supabase is not configured" message="The payment could not be saved because Supabase env vars are missing." />;
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    return <PaymentResult success={false} title="Sign in required" message="Sign in with the buyer account, then open this Flutterwave return link again." />;
  }

  let result: {
    success: boolean;
    title: string;
    message: string;
    transactionId?: string;
    dashboardHref?: string;
  };

  try {
    const verified = await verifyFlutterwavePayment(flutterwaveTransactionId);

    if (verified.status !== "successful" || verified.tx_ref !== txRef || verified.currency !== "NGN") {
      result = {
        success: false,
        title: "Payment could not be verified",
        message: "Flutterwave returned payment details that do not match this Hazi.ng transaction."
      };
    } else if (purpose === "launch_test") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!isAdminRole(profile?.role)) {
        result = {
          success: false,
          title: "Admin required",
          message: "Only an admin can complete a launch payment test."
        };
      } else {
        const paymentType = verified.payment_type ? ` via ${verified.payment_type}` : "";
        const { error: checklistError } = await supabase.from("launch_checklist_items").upsert({
          id: "flutterwave_live_payment",
          label: "Full Flutterwave live payment test",
          category: "payments",
          status: "passed",
          notes: `Flutterwave verified ${formatNaira(Number(verified.amount))}${paymentType}. Reference: ${txRef}. Transaction ID: ${flutterwaveTransactionId}.`,
          checked_at: new Date().toISOString(),
          checked_by: user.id,
          updated_at: new Date().toISOString()
        });

        result = checklistError
          ? {
              success: false,
              title: "Payment verified, checklist update failed",
              message: checklistError.message,
              dashboardHref: "/admin/health"
            }
          : {
              success: true,
              title: "Launch payment verified",
              message: `Flutterwave verified ${formatNaira(Number(verified.amount))}${paymentType}. The launch checklist is updated.`,
              dashboardHref: "/admin/health"
            };
      }
    } else {
      const { data: reconciled, error: reconcileError } = await supabase.rpc("complete_provider_payment_reference", {
        p_provider: "flutterwave",
        p_reference: txRef,
        p_provider_transaction_id: flutterwaveTransactionId,
        p_verified_amount: Number(verified.amount),
        p_currency: verified.currency,
        p_provider_status: verified.status,
        p_event_id: `callback:${flutterwaveTransactionId}`,
        p_payload: { verified, purpose },
        p_server_secret: getAutomationServerSecret()
      });

      if (reconcileError) {
        result = {
          success: false,
          title: "Payment update failed",
          message: reconcileError.message
        };
      } else {
        const kind = typeof reconciled === "object" && reconciled && "kind" in reconciled ? String(reconciled.kind) : "payment";
        result = {
          success: true,
          title: kind === "wallet_funding" ? "Wallet funded" : kind === "premium_subscription" ? "Premium active" : "Payment verified",
          message: `Flutterwave verified ${formatNaira(Number(verified.amount))}${verified.payment_type ? ` via ${verified.payment_type}` : ""}. Hazi.ng has reconciled the payment.`,
          dashboardHref: kind === "wallet_funding" ? "/dashboard/wallet" : kind === "premium_subscription" ? "/dashboard" : "/dashboard/orders"
        };
      }
    }
  } catch (error) {
    result = {
      success: false,
      title: "Verification failed",
      message: error instanceof Error ? error.message : "Flutterwave payment verification failed."
    };
  }

  return <PaymentResult {...result} />;
}

function PaymentResult({
  success,
  title,
  message,
  transactionId,
  dashboardHref
}: {
  success: boolean;
  title: string;
  message: string;
  transactionId?: string;
  dashboardHref?: string;
}) {
  const Icon = success ? CheckCircle2 : XCircle;

  return (
    <main className="container grid min-h-[70vh] place-items-center py-10">
      <section className="card max-w-xl p-6 text-center">
        <div className={`mx-auto grid size-14 place-items-center rounded-2xl ${success ? "bg-[#e8f7ee] text-[var(--primary)]" : "bg-[#fff1f0] text-[#b42318]"}`}>
          <Icon size={28} />
        </div>
        <h1 className="mt-5 text-3xl font-extrabold text-[var(--primary)]">{title}</h1>
        <p className="mt-3 text-[var(--muted)]">{message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {transactionId ? (
            <Link href={`/transactions/${transactionId}`} className="button button-primary">
              Return to transaction
            </Link>
          ) : null}
          <Link href={dashboardHref ?? "/dashboard/orders"} className={transactionId ? "button button-outline" : "button button-primary"}>
            {dashboardHref ? "Return to dashboard" : "View orders"}
          </Link>
        </div>
      </section>
    </main>
  );
}
