import { supabase } from "./marketplace";

export type EditableProfile = { fullName: string; companyName: string; phone: string; location: string; avatarUrl: string };

async function currentUser() {
  if (!supabase) throw new Error("Hazi mobile is not connected to Supabase.");
  const result = await supabase.auth.getUser();
  if (result.error || !result.data.user) throw new Error("Sign in again to continue.");
  return result.data.user;
}

export async function loadEditableProfile(): Promise<EditableProfile> {
  const user = await currentUser();
  const result = await supabase!.from("profiles").select("full_name,company_name,phone,location,avatar_url").eq("id", user.id).maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return {
    fullName: result.data?.full_name || user.email?.split("@")[0] || "Hazi user",
    companyName: result.data?.company_name || "",
    phone: result.data?.phone || "",
    location: result.data?.location || "",
    avatarUrl: result.data?.avatar_url || ""
  };
}

export async function saveEditableProfile(value: EditableProfile) {
  const user = await currentUser();
  if (!value.fullName.trim()) throw new Error("Enter your full name.");
  if (value.avatarUrl.trim()) {
    try { new URL(value.avatarUrl.trim()); } catch { throw new Error("Enter a valid avatar URL or leave it blank."); }
  }
  const result = await supabase!.from("profiles").update({
    full_name: value.fullName.trim(),
    company_name: value.companyName.trim() || null,
    phone: value.phone.trim() || null,
    location: value.location.trim() || null,
    avatar_url: value.avatarUrl.trim() || null
  }).eq("id", user.id);
  if (result.error) throw new Error(result.error.message);
}
