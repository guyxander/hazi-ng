import { Linking } from "react-native";
import { supabase } from "./marketplace";

const webUrl = process.env.EXPO_PUBLIC_HAZI_WEB_URL || "https://hazi.ng";

async function requireUser() {
  if (!supabase) throw new Error("Hazi mobile is not connected to Supabase.");
  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData.user) throw new Error("Sign in again to continue.");
  return userData.user;
}

export async function startWalletFunding(amount: number) {
  await requireUser();
  if (!Number.isFinite(amount) || amount < 100) throw new Error("Enter an amount of at least NGN 100.");
  const { data: sessionData } = await supabase!.auth.getSession();
  if (!sessionData.session?.access_token) throw new Error("Sign in again to continue.");
  const response = await fetch(`${webUrl}/api/mobile/wallet/fund`, { method: "POST", headers: { Authorization: `Bearer ${sessionData.session.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ amount }) });
  const payload = await response.json() as { checkoutUrl?: string; error?: string };
  if (!response.ok || !payload.checkoutUrl) throw new Error(payload.error || "Could not start wallet funding.");
  await Linking.openURL(payload.checkoutUrl);
}

export async function requestWithdrawal(input: { amount: number; sourceBucket: "earnings" | "refund"; bankName: string; accountNumber: string; accountName: string; bankCode?: string }) {
  await requireUser();
  const { error } = await supabase!.rpc("request_wallet_withdrawal", { p_amount: input.amount, p_source_bucket: input.sourceBucket, p_bank_name: input.bankName.trim(), p_account_number: input.accountNumber.trim(), p_account_name: input.accountName.trim(), p_bank_code: input.bankCode?.trim() || null });
  if (error) throw new Error(error.message);
}

export async function savePayoutSettings(input: { bankName: string; accountNumber: string; accountName: string; bankCode?: string }) {
  const user = await requireUser();
  if (!input.bankName.trim() || !input.accountNumber.trim() || !input.accountName.trim()) throw new Error("Bank name, account number, and account name are required.");
  const { error } = await supabase!.from("profiles").update({ payout_bank_name: input.bankName.trim(), payout_account_number: input.accountNumber.trim(), payout_account_name: input.accountName.trim(), payout_bank_code: input.bankCode?.trim() || null, payout_verified_at: null, payout_provider_reference: null }).eq("id", user.id);
  if (error) throw new Error(error.message);
}
