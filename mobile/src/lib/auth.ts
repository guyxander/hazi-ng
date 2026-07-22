import type { User } from "@supabase/supabase-js";
import { supabase } from "./marketplace";
import type { UserRole } from "../types";

export type MobileAccount = {
  user: User;
  fullName: string;
  role: UserRole;
  verificationStatus: "unverified" | "pending" | "verified" | "rejected";
  accountStatus: string;
};

export async function loadCurrentAccount(): Promise<MobileAccount | null> {
  if (!supabase) return null;
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name,role,verification_status,account_status,suspension_reason")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (profile?.account_status === "suspended") {
    await supabase.auth.signOut();
    throw new Error(profile.suspension_reason || "This account is suspended. Contact Hazi support.");
  }

  return {
    user: userData.user,
    fullName: profile?.full_name || userData.user.email?.split("@")[0] || "Hazi user",
    role: (profile?.role || "buyer") as UserRole,
    verificationStatus: profile?.verification_status || "unverified",
    accountStatus: profile?.account_status || "active"
  };
}

export async function signInWithEmail(email: string, password: string) {
  if (!supabase) throw new Error("Hazi mobile is not connected to Supabase.");
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw error;
  return loadCurrentAccount();
}

export async function createHaziAccount(fullName: string, email: string, password: string) {
  if (!supabase) throw new Error("Hazi mobile is not connected to Supabase.");
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { full_name: fullName.trim() } }
  });
  if (error) throw error;
  return data;
}

export async function signOutAccount() {
  if (supabase) await supabase.auth.signOut();
}

export async function sendPasswordRecovery(email: string) {
  if (!supabase) throw new Error("Hazi mobile is not connected to Supabase.");
  if (!email.trim()) throw new Error("Enter your email address first.");
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: "hazi://auth/recovery" });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  if (!supabase) throw new Error("Hazi mobile is not connected to Supabase.");
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}/.test(password)) throw new Error("Use at least 8 characters with uppercase, lowercase, number, and symbol.");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}
